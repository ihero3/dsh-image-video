/**
 * 素材探测（Track A / A44）：真实时长/分辨率/帧率/有无音轨。
 * 用途：界面拖入素材后能拿真实时长；Agent 能据此决定片段给多长。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { probeMediaSpec } from '../src/media/render.ts'

const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}
async function makeVideo(dir: string, seconds: number): Promise<string> {
  const out = join(dir, 'v.mp4')
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
      '-i', `testsrc=size=320x240:rate=30:duration=${seconds}`, '-pix_fmt', 'yuv420p', '-c:v', 'libx264', out],
      error => { error === null ? resolve() : reject(error) })
  })
  return out
}
async function makeAudio(dir: string): Promise<string> {
  const out = join(dir, 'a.aac')
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=1.5', '-c:a', 'aac', out],
      error => { error === null ? resolve() : reject(error) })
  })
  return out
}

describe('probeMediaSpec with duration (A44)', () => {
  it('reports duration, size and fps for a video file', async () => {
    const work = await temp('dsh-probe-')
    const video = await makeVideo(work, 2)
    const spec = await probeMediaSpec(FFMPEG, video)
    expect(spec?.width).toBe(320)
    expect(spec?.height).toBe(240)
    expect(spec?.fps).toBeCloseTo(30, 0)
    expect(Math.abs((spec?.durationMs ?? 0) - 2000)).toBeLessThanOrEqual(120)
    expect(spec?.hasAudio).toBe(false)
  }, 60_000)

  it('reports duration and hasAudio for an audio-only file', async () => {
    const work = await temp('dsh-probe-audio-')
    const audio = await makeAudio(work)
    const spec = await probeMediaSpec(FFMPEG, audio)
    expect(spec?.hasAudio).toBe(true)
    expect(Math.abs((spec?.durationMs ?? 0) - 1500)).toBeLessThanOrEqual(150)
    expect(spec?.width).toBeUndefined()
  }, 60_000)

  it('returns undefined for a non-media file', async () => {
    const work = await temp('dsh-probe-bad-')
    const spec = await probeMediaSpec(FFMPEG, join(work, 'missing.mp4'))
    expect(spec).toBeUndefined()
  })
})
