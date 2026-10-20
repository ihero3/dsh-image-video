/**
 * 成片缩略图（Track A / A124）。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { RenderService } from '../src/media/render.ts'

const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

describe('render thumbnail (A124)', () => {
  it('extracts a jpg preview next to the video', async () => {
    const work = await temp('dsh-thumb-work-')
    const outputs = await temp('dsh-thumb-out-')
    const video = join(work, 'v.mp4')
    await new Promise<void>((resolve, reject) => {
      execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
        '-i', 'testsrc=size=320x240:rate=30:duration=2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', video],
        error => { error === null ? resolve() : reject(error) })
    })
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render({
      schemaVersion: 4, id: 'tml-thumb', projectId: 'prj-1', name: '缩略图', frameRate: 30, burnSubtitles: false,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: video, startMs: 0, durationMs: 2000 }] }],
      createdAt: '', updatedAt: '',
    })
    expect(result.thumbnailPath).toBeDefined()
    expect(result.thumbnailPath).toMatch(/-thumb\.jpg$/)
    const info = await stat(result.thumbnailPath!)
    expect(info.size).toBeGreaterThan(500) // 是个真 jpg
  }, 60_000)
})

describe('thumbnail frame position (A126)', () => {
  it('uses thumbnailAtMs when provided', async () => {
    const work = await temp('dsh-thumb2-work-')
    const outputs = await temp('dsh-thumb2-out-')
    const video = join(work, 'v.mp4')
    await new Promise<void>((resolve, reject) => {
      execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
        '-i', 'testsrc=size=320x240:rate=30:duration=2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', video],
        error => { error === null ? resolve() : reject(error) })
    })
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render({
      schemaVersion: 4, id: 'tml-thumb2', projectId: 'prj-1', name: '封面帧', frameRate: 30, burnSubtitles: false,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: video, startMs: 0, durationMs: 2000 }] }],
      createdAt: '', updatedAt: '',
    }, { thumbnailAtMs: 1500 })
    expect(result.thumbnailPath).toBeDefined()
    expect((await stat(result.thumbnailPath!)).size).toBeGreaterThan(500)
  }, 60_000)
})

describe('thumbnail clamping (R8)', () => {
  it('clamps an out-of-range thumbnailAtMs instead of producing no frame', async () => {
    const work = await temp('dsh-thumb3-work-')
    const outputs = await temp('dsh-thumb3-out-')
    const video = join(work, 'v.mp4')
    await new Promise<void>((resolve, reject) => {
      execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
        '-i', 'testsrc=size=320x240:rate=30:duration=1', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', video],
        error => { error === null ? resolve() : reject(error) })
    })
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render({
      schemaVersion: 4, id: 'tml-thumb3', projectId: 'prj-1', name: '越界封面', frameRate: 30, burnSubtitles: false,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: video, startMs: 0, durationMs: 1000 }] }],
      createdAt: '', updatedAt: '',
    }, { thumbnailAtMs: 999_999 }) // 远超片长 → 应被夹取到片尾前 100ms
    expect(result.thumbnailPath).toBeDefined()
    expect((await stat(result.thumbnailPath!)).size).toBeGreaterThan(500)
  }, 60_000)
})
