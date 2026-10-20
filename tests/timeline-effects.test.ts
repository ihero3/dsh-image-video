/**
 * 时间轴特效（Track A / A13）：变速、淡入淡出、裁剪。
 * 关键一致性：变速后片段在时间轴上的**占位时长**要按折算算（否则成片与时间轴错位）。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  CLIP_SPEED_RANGE, MAX_CLIP_FADE_MS, effectiveDurationMs, normalizeTimelineTracks, timelineDurationMs,
} from '../src/workbench/timeline.ts'
import { RenderService, buildRenderArgs, freezeTimeline, planVideoSegments } from '../src/media/render.ts'
import type { TimelineClip, TimelineRecord } from '../src/workbench/timeline.ts'

const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })
async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}
async function makeVideo(dir: string, name: string, seconds = 1): Promise<string> {
  const output = join(dir, name)
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
      '-i', `testsrc=size=320x240:rate=30:duration=${seconds}`, '-pix_fmt', 'yuv420p', '-c:v', 'libx264', output],
      error => { error === null ? resolve() : reject(error) })
  })
  return output
}
function timeline(video: string, extra: Partial<TimelineClip> = {}, second?: Partial<TimelineClip>): TimelineRecord {
  return {
    schemaVersion: 2, id: 'tml-fx', projectId: 'prj-1', name: '特效', frameRate: 30, burnSubtitles: false,
    tracks: [{
      id: 'v1', kind: 'video', clips: [
        { id: 'c1', assetPath: video, startMs: 0, durationMs: 1000, ...extra },
        ...second === undefined ? [] : [{ id: 'c2', assetPath: video, startMs: 800, durationMs: 1000, ...second }],
      ],
    }],
    createdAt: '', updatedAt: '',
  }
}

describe('clip effects model (A13)', () => {
  it('validates speed / fade / crop and rejects out-of-range values', () => {
    const [track] = normalizeTimelineTracks([{
      id: 'v1', kind: 'video', clips: [{
        id: 'c1', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000,
        speed: 2, fade: 300, crop: { x: 10, y: 20, width: 200, height: 100 },
      }],
    }])
    expect(track?.clips[0]).toMatchObject({ speed: 2, fade: 300, crop: { x: 10, y: 20, width: 200, height: 100 } })

    const clip = (extra: Record<string, unknown>) => [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000, ...extra }] }]
    expect(() => normalizeTimelineTracks(clip({ speed: CLIP_SPEED_RANGE.max + 1 }))).toThrow(/speed/)
    expect(() => normalizeTimelineTracks(clip({ fade: MAX_CLIP_FADE_MS + 1 }))).toThrow(/fade/)
    expect(() => normalizeTimelineTracks(clip({ crop: { x: 0, y: 0, width: 201, height: 100 } }))).toThrow(/even number/)
  })

  it('uses the speed-adjusted duration everywhere the timeline measures time', () => {
    const fast: TimelineClip = { id: 'c', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000, speed: 2 }
    expect(effectiveDurationMs(fast)).toBe(500)
    expect(timelineDurationMs([{ id: 'v1', kind: 'video', clips: [fast] }])).toBe(500)

    // 第二个片段排在 500ms 处 → 没有间隙、没有重叠
    const snapshot = freezeTimeline(timeline('/tmp/a.mp4', { speed: 2 }, { startMs: 500 }))
    const segments = planVideoSegments(snapshot)
    expect(segments.map(segment => segment.kind)).toEqual(['clip', 'clip'])
    expect(snapshot.durationMs).toBe(1500)
  })
})

describe('effects in the filter graph and a real render (A13, 零生成花费)', () => {
  it('puts crop / setpts / fade into the filter chain', () => {
    const snapshot = freezeTimeline(timeline('/tmp/a.mp4', {
      speed: 2, fade: 200, crop: { x: 0, y: 0, width: 200, height: 100 },
    }))
    const args = buildRenderArgs(snapshot, { outputPath: '/tmp/out.mp4' })
    const filter = args[args.indexOf('-filter_complex') + 1] ?? ''
    expect(filter).toContain('crop=200:100:0:0')
    expect(filter).toContain('setpts=0.5000*PTS')
    expect(filter).toContain('fade=t=in:st=0:d=0.200')
    expect(filter).toContain('fade=t=out:')
  })

  it('exports a 2x-speed clip in half the time with crop and fades applied', async () => {
    const work = await temp('dsh-fx-work-')
    const outputs = await temp('dsh-fx-out-')
    const video = await makeVideo(work, 'v.mp4', 1)
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render(timeline(video, {
      speed: 2, fade: 150, crop: { x: 0, y: 0, width: 240, height: 180 },
    }))
    expect(result.bytes).toBeGreaterThan(1000)
    // 1 秒素材 2 倍速 → 约 0.5 秒（曾因 freeze 另算总时长多补 0.5s 黑场，已修复）
    expect(Math.abs(result.durationMs - 500)).toBeLessThanOrEqual(70)
  }, 60_000)
})
