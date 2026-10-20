/**
 * 音轨交叉淡化（Track A / A30）：相邻片段用 `acrossfade`，有空档时回落普通拼接。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { MAX_TRACK_CROSSFADE_MS, normalizeTimelineTracks } from '../src/workbench/timeline.ts'
import { RenderService, buildRenderArgs, freezeTimeline, probeMediaSpec } from '../src/media/render.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })
async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}
async function makeVideo(dir: string): Promise<string> {
  const out = join(dir, 'v.mp4')
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
      '-i', 'testsrc=size=320x240:rate=30:duration=2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', out],
      error => { error === null ? resolve() : reject(error) })
  })
  return out
}
async function makeAudio(dir: string, name: string): Promise<string> {
  const out = join(dir, name)
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=1', '-c:a', 'aac', out],
      error => { error === null ? resolve() : reject(error) })
  })
  return out
}
function timeline(video: string, first: string, second: string, options: { crossfade?: number; gap?: number } = {}): TimelineRecord {
  return {
    schemaVersion: 3, id: 'tml-cross', projectId: 'prj-1', name: '交叉淡化', frameRate: 30, burnSubtitles: false,
    tracks: [
      { id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: video, startMs: 0, durationMs: 2000 }] },
      {
        id: 'a1', kind: 'audio',
        ...options.crossfade === undefined ? {} : { crossfadeMs: options.crossfade },
        clips: [
          { id: 'a', assetPath: first, startMs: 0, durationMs: 1000 },
          { id: 'b', assetPath: second, startMs: 1000 + (options.gap ?? 0), durationMs: 1000 },
        ],
      },
    ],
    createdAt: '', updatedAt: '',
  }
}

describe('audio crossfade model (A30)', () => {
  it('validates the range and keeps the field', () => {
    const [, track] = normalizeTimelineTracks([{ id: 'v1', kind: 'video', clips: [] }, { id: 'a1', kind: 'audio', crossfadeMs: 400, clips: [] }])
    expect(track?.crossfadeMs).toBe(400)
    expect(() => normalizeTimelineTracks([{ id: 'a1', kind: 'audio', crossfadeMs: MAX_TRACK_CROSSFADE_MS + 1, clips: [] }]))
      .toThrow(/crossfadeMs/)
  })
})

describe('acrossfade in the graph (A30)', () => {
  it('uses acrossfade for adjacent clips and falls back to concat when there is a gap', () => {
    const adjacent = buildRenderArgs(freezeTimeline(timeline('/tmp/v.mp4', '/tmp/a.aac', '/tmp/b.aac', { crossfade: 300 })), { outputPath: '/tmp/out.mp4' })
    const adjacentFilter = adjacent[adjacent.indexOf('-filter_complex') + 1] ?? ''
    expect(adjacentFilter).toContain('acrossfade=d=0.300')
    expect(adjacentFilter).not.toContain('concat=n=2:v=0:a=1')

    const gapped = buildRenderArgs(freezeTimeline(timeline('/tmp/v.mp4', '/tmp/a.aac', '/tmp/b.aac', { crossfade: 300, gap: 200 })), { outputPath: '/tmp/out.mp4' })
    const gappedFilter = gapped[gapped.indexOf('-filter_complex') + 1] ?? ''
    expect(gappedFilter).not.toContain('acrossfade=')
    expect(gappedFilter).toContain('concat=')
  })

  it('renders a real file with audio crossfade (真机，零生成花费)', async () => {
    const work = await temp('dsh-cross-work-')
    const outputs = await temp('dsh-cross-out-')
    const video = await makeVideo(work)
    const first = await makeAudio(work, 'a.aac')
    const second = await makeAudio(work, 'b.aac')
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render(timeline(video, first, second, { crossfade: 300 }))
    const spec = await probeMediaSpec(FFMPEG, result.outputPath)
    expect(spec?.hasAudio).toBe(true)
    // 视频轨 2s 决定成片长度（音轨交叉淡化后略短，ffmpeg 会保持视频时长）
    expect(Math.abs(result.durationMs - 2000)).toBeLessThanOrEqual(150)
  }, 60_000)
})
