/**
 * 导出时同时输出 SRT（Track A / A120）。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
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

describe('render writes an SRT next to the video (A120)', () => {
  it('emits <output>.srt when the timeline has subtitles', async () => {
    const work = await temp('dsh-srt-render-')
    const outputs = await temp('dsh-srt-out-')
    const video = join(work, 'v.mp4')
    await new Promise<void>((resolve, reject) => {
      execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
        '-i', 'testsrc=size=320x240:rate=30:duration=1', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', video],
        error => { error === null ? resolve() : reject(error) })
    })
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render({
      schemaVersion: 4, id: 'tml-srt', projectId: 'prj-1', name: '带字幕', frameRate: 30, burnSubtitles: false,
      tracks: [
        { id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: video, startMs: 0, durationMs: 1000 }] },
        { id: 's1', kind: 'subtitle', clips: [{ id: 's', text: '第一句\n第二行', startMs: 0, durationMs: 500 }] },
      ],
      createdAt: '', updatedAt: '',
    })
    expect(result.subtitlePath).toBeDefined()
    const srt = await readFile(result.subtitlePath!, 'utf8')
    expect(srt).toContain('00:00:00,000 --> 00:00:00,500')
    expect(srt).toContain('第一句\n第二行')
  }, 60_000)

  it('does not create an SRT when there are no subtitle clips', async () => {
    const work = await temp('dsh-srt-none-')
    const outputs = await temp('dsh-srt-none-out-')
    const video = join(work, 'v.mp4')
    await new Promise<void>((resolve, reject) => {
      execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
        '-i', 'testsrc=size=320x240:rate=30:duration=1', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', video],
        error => { error === null ? resolve() : reject(error) })
    })
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render({
      schemaVersion: 4, id: 'tml-nosrt', projectId: 'prj-1', name: '无字幕', frameRate: 30, burnSubtitles: false,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: video, startMs: 0, durationMs: 1000 }] }],
      createdAt: '', updatedAt: '',
    })
    expect(result.subtitlePath).toBeUndefined()
  }, 60_000)
})
