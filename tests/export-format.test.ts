/**
 * 导出参数化（Track A / A2，总任务书 §7.3）：
 * 分辨率/帧率/码率可设并入库；导出真按该规格出片；产物规格要被**实测复核**（不信参数）。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_EXPORT_FORMAT, EXPORT_BITRATE_RANGE, EXPORT_DIMENSION_RANGE, normalizeExportFormat,
} from '../src/workbench/timeline.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
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
async function makeVideo(dir: string, name: string): Promise<string> {
  const output = join(dir, name)
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
      '-i', 'testsrc=size=320x240:rate=30:duration=1', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', output],
      error => { error === null ? resolve() : reject(error) })
  })
  return output
}
function timeline(video: string, exportFormat?: unknown): TimelineRecord {
  return {
    schemaVersion: 1, id: 'tml-format', projectId: 'prj-1', name: '规格测试', frameRate: 30, burnSubtitles: false,
    ...exportFormat === undefined ? {} : { exportFormat: exportFormat as never },
    tracks: [
      { id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: video, startMs: 0, durationMs: 1000 }] },
      { id: 's1', kind: 'subtitle', clips: [] },
    ],
    createdAt: '', updatedAt: '',
  }
}

describe('export format validation (A2)', () => {
  it('defaults to 720p30 and rejects out-of-range values', () => {
    expect(normalizeExportFormat(undefined)).toEqual(DEFAULT_EXPORT_FORMAT)
    expect(normalizeExportFormat({ width: 1920, height: 1080, frameRate: 60, bitrateKbps: 8000 }))
      .toEqual({ width: 1920, height: 1080, frameRate: 60, bitrateKbps: 8000 })
    expect(() => normalizeExportFormat({ width: 641, height: 360, frameRate: 30 })).toThrow(/even number/)
    expect(() => normalizeExportFormat({ width: 64, height: 360, frameRate: 30 }))
      .toThrow(new RegExp(`between ${EXPORT_DIMENSION_RANGE.min}`))
    expect(() => normalizeExportFormat({ width: 640, height: 360, frameRate: 31 })).toThrow(/frameRate must be one of/)
    expect(() => normalizeExportFormat({ width: 640, height: 360, frameRate: 30, bitrateKbps: EXPORT_BITRATE_RANGE.max + 1 }))
      .toThrow(/bitrateKbps must be between/)
  })

  it('puts the format into the filter graph and encoder options', () => {
    const snapshot = freezeTimeline(timeline('/tmp/v.mp4', { width: 640, height: 360, frameRate: 24, bitrateKbps: 4000 }))
    const args = buildRenderArgs(snapshot, { outputPath: '/tmp/out.mp4' })
    const filter = args[args.indexOf('-filter_complex') + 1] ?? ''
    expect(filter).toContain('scale=640:360')
    expect(filter).toContain('fps=24')
    expect(args).toContain('-b:v')
    expect(args).toContain('4000k')

    // 未给规格时走默认 720p30
    const plain = freezeTimeline(timeline('/tmp/v.mp4'))
    const plainArgs = buildRenderArgs(plain, { outputPath: '/tmp/out.mp4' })
    expect((plainArgs[plainArgs.indexOf('-filter_complex') + 1] ?? '')).toContain('scale=1280:720')
    expect(plainArgs).toContain('-crf')
  })

  it('round-trips through the store and rejects invalid specs on save', async () => {
    const directory = await temp('dsh-format-store-')
    const store = new WorkbenchStore({ directory })
    const project = await store.createProject('规格')
    const saved = await store.saveTimeline({
      projectId: project.id, tracks: [],
      exportFormat: { width: 1080, height: 1920, frameRate: 30, bitrateKbps: 6000 },
    })
    expect(saved.exportFormat).toEqual({ width: 1080, height: 1920, frameRate: 30, bitrateKbps: 6000 })
    const reopened = new WorkbenchStore({ directory })
    expect((await reopened.listTimelines(project.id))[0]?.exportFormat?.height).toBe(1920)
    await expect(store.saveTimeline({ projectId: project.id, tracks: [], exportFormat: { width: 641, height: 360, frameRate: 30 } }))
      .rejects.toThrow(/even number/)
  })
})

describe('导出规格实测复核（A2，真机零费用）', () => {
  it('renders at the requested size/fps and verifies the actual output spec', async () => {
    const work = await temp('dsh-format-work-')
    const outputs = await temp('dsh-format-out-')
    const video = await makeVideo(work, 'v.mp4')
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render(timeline(video, { width: 640, height: 360, frameRate: 24 }))

    const spec = await probeMediaSpec(FFMPEG, result.outputPath)
    expect(spec?.width).toBe(640)
    expect(spec?.height).toBe(360)
    expect(spec?.fps).toBeCloseTo(24, 0)
    expect(spec?.hasAudio).toBe(false) // 无音轨 → -an
    expect(Math.abs(result.durationMs - 1000)).toBeLessThanOrEqual(45)
  }, 60_000)
})
