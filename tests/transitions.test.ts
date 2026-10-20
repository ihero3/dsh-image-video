/**
 * 跨段转场（Track A / A13b）：`xfade` 链、重叠时长折算、真机拼接验证。
 * 与变速同一个坑：转场让两段重叠，总时长必须扣掉重叠，否则成片比时间轴长。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { CLIP_TRANSITIONS, normalizeTimelineTracks, timelineDurationMs } from '../src/workbench/timeline.ts'
import { RenderService, buildRenderArgs, freezeTimeline } from '../src/media/render.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

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
function timeline(videos: string[], transition = true): TimelineRecord {
  return {
    schemaVersion: 2, id: 'tml-xfade', projectId: 'prj-1', name: '转场', frameRate: 30, burnSubtitles: false,
    tracks: [{
      id: 'v1', kind: 'video', clips: videos.map((video, index) => ({
        id: `c${index}`, assetPath: video, startMs: index * 1000, durationMs: 1000,
        ...transition && index > 0 ? { transition: 'fade' as const, transitionDurationMs: 400 } : {},
      })),
    }],
    createdAt: '', updatedAt: '',
  }
}

describe('transition model (A13b)', () => {
  it('validates the whitelist and subtracts the overlap from the timeline duration', () => {
    expect(CLIP_TRANSITIONS).toContain('fade')
    expect(() => normalizeTimelineTracks([{
      id: 'v1', kind: 'video', clips: [
        { id: 'a', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 },
        { id: 'b', assetPath: '/tmp/b.mp4', startMs: 1000, durationMs: 1000, transition: 'flash' as never },
      ],
    }])).toThrow(/transition must be one of/)

    const record = timeline(['/tmp/a.mp4', '/tmp/b.mp4'])
    // 2 段各 1s，转场 400ms → 成片 1600ms
    expect(timelineDurationMs(record.tracks)).toBe(1600)
    // 没有转场时是 2000ms（零回归）
    expect(timelineDurationMs(timeline(['/tmp/a.mp4', '/tmp/b.mp4'], false).tracks)).toBe(2000)
  })
})

describe('xfade rendering (A13b)', () => {
  it('builds an xfade chain only when transitions are present', () => {
    const withFx = buildRenderArgs(freezeTimeline(timeline(['/tmp/a.mp4', '/tmp/b.mp4'])), { outputPath: '/tmp/out.mp4' })
    const filter = withFx[withFx.indexOf('-filter_complex') + 1] ?? ''
    expect(filter).toContain('xfade=transition=fade:duration=0.400:offset=')
    expect(filter).not.toContain('concat=n=2')

    const withoutFx = buildRenderArgs(freezeTimeline(timeline(['/tmp/a.mp4', '/tmp/b.mp4'], false)), { outputPath: '/tmp/out.mp4' })
    const plain = withoutFx[withoutFx.indexOf('-filter_complex') + 1] ?? ''
    expect(plain).not.toContain('xfade=')
    expect(plain).toContain('concat=n=2')
  })

  it('exports two 1s clips joined by a 0.4s transition as ~1.6s (真机，零生成花费)', async () => {
    const work = await temp('dsh-xfade-work-')
    const outputs = await temp('dsh-xfade-out-')
    const first = await makeVideo(work, 'a.mp4', 1)
    const second = await makeVideo(work, 'b.mp4', 1)
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render(timeline([first, second]))
    expect(result.bytes).toBeGreaterThan(1000)
    expect(Math.abs(result.durationMs - 1600)).toBeLessThanOrEqual(120)
  }, 60_000)
})
