/**
 * 导出完成摘要（Track A / A37）：纯函数语义 + 真实渲染任务上的集成。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { buildRenderSummary, describeTimeline } from '../src/media/render-summary.ts'
import { RenderService } from '../src/media/render.ts'
import { RenderRegistry } from '../src/media/render-registry.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}
const fixedNow = () => new Date('2026-10-19T00:00:00.000Z')

function timeline(extra: Partial<TimelineRecord> = {}): TimelineRecord {
  return {
    schemaVersion: 3, id: 'tml-sum', projectId: 'prj-1', name: '摘要', frameRate: 30, burnSubtitles: true,
    exportFormat: { width: 1080, height: 1920, frameRate: 30, bitrateKbps: 8000 },
    tracks: [
      { id: 'v1', kind: 'video', clips: [
        { id: 'v', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 },
        { id: 'v2', assetPath: '/tmp/a.mp4', startMs: 1000, durationMs: 1000, speed: 2 },
      ] },
      { id: 'a1', kind: 'audio', clips: [{ id: 'a', assetPath: '/tmp/a.aac', startMs: 0, durationMs: 1000 }] },
      { id: 's1', kind: 'subtitle', clips: [{ id: 's', text: '字幕', startMs: 0, durationMs: 1000 }] },
    ],
    createdAt: '', updatedAt: '',
    ...extra,
  }
}

describe('buildRenderSummary (A37)', () => {
  it('summarises artifacts, format and track counts', () => {
    const summary = buildRenderSummary(timeline(), { outputPath: '/tmp/out.mp4', bytes: 4096, durationMs: 1500 }, fixedNow)
    expect(summary).toMatchObject({
      outputPath: '/tmp/out.mp4', bytes: 4096, durationMs: 1500,
      format: { width: 1080, height: 1920, frameRate: 30, bitrateKbps: 8000 },
      tracks: { video: 2, audio: 1, subtitle: 1 }, totalClips: 4,
      hasAudio: true, hasSubtitles: true, burnedSubtitles: true,
      renderedAt: '2026-10-19T00:00:00.000Z',
    })
  })

  it('reports hasAudio=false when the only audio track is muted or silent', () => {
    const muted = timeline({ tracks: [
      { id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }] },
      { id: 'a1', kind: 'audio', muted: true, clips: [{ id: 'a', assetPath: '/tmp/a.aac', startMs: 0, durationMs: 1000 }] },
    ] })
    expect(buildRenderSummary(muted, { outputPath: '/tmp/x.mp4', bytes: 1, durationMs: 1 }, fixedNow).hasAudio).toBe(false)
    const silent = timeline({ tracks: [
      { id: 'a1', kind: 'audio', volume: 0, clips: [{ id: 'a', assetPath: '/tmp/a.aac', startMs: 0, durationMs: 1000 }] },
    ] })
    expect(buildRenderSummary(silent, { outputPath: '/tmp/x.mp4', bytes: 1, durationMs: 1 }, fixedNow).hasAudio).toBe(false)
  })

  it('describes a timeline with speed-adjusted durations', () => {
    const described = describeTimeline(timeline())
    expect(described.totalMs).toBe(1500) // 1000 + 1000/2
    expect(described.tracks.map(track => track.kind)).toEqual(['video', 'audio', 'subtitle'])
  })
})

describe('render registry attaches the summary (A37)', () => {
  it('puts a summary on a really finished render', async () => {
    const work = await temp('dsh-sum-work-')
    const outputs = await temp('dsh-sum-out-')
    const video = join(work, 'v.mp4')
    await new Promise<void>((resolve, reject) => {
      execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
        '-i', 'testsrc=size=320x240:rate=30:duration=1', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', video],
        error => { error === null ? resolve() : reject(error) })
    })
    const registry = new RenderRegistry({ render: new RenderService({ outputsDir: outputs }) })
    const job = registry.start({
      schemaVersion: 3, id: 'tml-int', projectId: 'prj-1', name: '集成', frameRate: 30, burnSubtitles: false,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: video, startMs: 0, durationMs: 1000 }] }],
      createdAt: '', updatedAt: '',
    })
    await vi.waitFor(() => {
      expect(registry.get(job.id)?.status).toBe('succeeded')
    }, { timeout: 20_000 })
    const finished = registry.get(job.id)!
    expect(finished.summary?.bytes).toBeGreaterThan(1000)
    expect(finished.summary?.tracks.video).toBe(1)
    expect(finished.summary?.hasAudio).toBe(false)
    expect(Math.abs((finished.summary?.durationMs ?? 0) - 1000)).toBeLessThanOrEqual(80)
  }, 60_000)
})
