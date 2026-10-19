/**
 * 侧链压缩（Track A / A33）：旁白一响就把背景音乐压低（`sidechaincompress`）。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { DUCKING_DB_RANGE, normalizeTimelineTracks } from '../src/workbench/timeline.ts'
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
      '-i', 'testsrc=size=320x240:rate=30:duration=1', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', out],
      error => { error === null ? resolve() : reject(error) })
  })
  return out
}
async function makeAudio(dir: string, name: string, frequency: number): Promise<string> {
  const out = join(dir, name)
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
      '-i', `sine=frequency=${frequency}:duration=1`, '-c:a', 'aac', out],
      error => { error === null ? resolve() : reject(error) })
  })
  return out
}
function timeline(video: string, music: string, voice: string): TimelineRecord {
  return {
    schemaVersion: 3, id: 'tml-duck', projectId: 'prj-1', name: '侧链', frameRate: 30, burnSubtitles: false,
    tracks: [
      { id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: video, startMs: 0, durationMs: 1000 }] },
      { id: 'voice', kind: 'audio', clips: [{ id: 'a', assetPath: voice, startMs: 0, durationMs: 1000 }] },
      { id: 'music', kind: 'audio', duckUnderTrackId: 'voice', duckingDb: -12, clips: [{ id: 'b', assetPath: music, startMs: 0, durationMs: 1000 }] },
    ],
    createdAt: '', updatedAt: '',
  }
}

describe('sidechain ducking model (A33)', () => {
  it('validates the trigger id and the dB range', () => {
    const tracks = normalizeTimelineTracks([
      { id: 'voice', kind: 'audio', clips: [{ id: 'a', assetPath: '/tmp/v.aac', startMs: 0, durationMs: 1000 }] },
      { id: 'music', kind: 'audio', duckUnderTrackId: 'voice', duckingDb: -9, clips: [{ id: 'b', assetPath: '/tmp/m.aac', startMs: 0, durationMs: 1000 }] },
    ])
    const music = tracks[1]
    expect(music).toMatchObject({ duckUnderTrackId: 'voice', duckingDb: -9 })
    const clip = [{ id: 'c', assetPath: '/tmp/x.aac', startMs: 0, durationMs: 100 }]
    expect(() => normalizeTimelineTracks([{ id: 'm', kind: 'audio', duckUnderTrackId: '', clips: clip }]))
      .toThrow(/duckUnderTrackId/)
    expect(() => normalizeTimelineTracks([{ id: 'm', kind: 'audio', duckingDb: DUCKING_DB_RANGE.min - 1, clips: clip }]))
      .toThrow(/duckingDb/)
  })
})

describe('sidechaincompress in the graph (A33)', () => {
  it('ducks the music track by the voice track', () => {
    const args = buildRenderArgs(freezeTimeline(timeline('/tmp/v.mp4', '/tmp/music.aac', '/tmp/voice.aac')), { outputPath: '/tmp/out.mp4' })
    const filter = args[args.indexOf('-filter_complex') + 1] ?? ''
    expect(filter).toContain('sidechaincompress=')
    expect(filter).toContain('ratio=8.0') // -12 dB → ratio 8
    expect(filter).toContain('amix=inputs=2')
  })

  it('renders a real file with ducking (真机，零生成花费)', async () => {
    const work = await temp('dsh-duck-work-')
    const outputs = await temp('dsh-duck-out-')
    const video = await makeVideo(work)
    const music = await makeAudio(work, 'music.aac', 220)
    const voice = await makeAudio(work, 'voice.aac', 660)
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render(timeline(video, music, voice))
    const spec = await probeMediaSpec(FFMPEG, result.outputPath)
    expect(spec?.hasAudio).toBe(true)
    expect(result.bytes).toBeGreaterThan(1000)
  }, 60_000)
})
