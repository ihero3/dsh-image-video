/**
 * 音轨能力（Track A / A1，对应总任务书 §7.2）：
 * 轨道音量与静音可入库并往返；导出 filter graph 真的带 `volume=`；
 * 静音轨不输出；有音轨时产物必须有音频流（真机 ffmpeg 验证，零生成花费）。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { MAX_TRACK_VOLUME, normalizeTimelineTracks } from '../src/workbench/timeline.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { RenderService, buildRenderArgs, freezeTimeline, planAudioTracks } from '../src/media/render.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

/** 造 1 秒测试视频。 */
async function makeVideo(dir: string, name: string): Promise<string> {
  const output = join(dir, name)
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=1',
      '-pix_fmt', 'yuv420p', '-c:v', 'libx264', output], error => { error === null ? resolve() : reject(error) })
  })
  return output
}

/** 造 1 秒 440Hz 音频。 */
async function makeAudio(dir: string, name: string): Promise<string> {
  const output = join(dir, name)
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', 'aac', output],
      error => { error === null ? resolve() : reject(error) })
  })
  return output
}

function timeline(video: string, audio?: string, trackExtra: { volume?: number; muted?: boolean } = {}): TimelineRecord {
  return {
    schemaVersion: 1, id: 'tml-audio', projectId: 'prj-1', name: '音轨测试', frameRate: 30, burnSubtitles: false,
    tracks: [
      { id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: video, startMs: 0, durationMs: 1000 }] },
      ...(audio === undefined
        ? [{ id: 'a1', kind: 'audio' as const, clips: [] as never[] }]
        : [{ id: 'a1', kind: 'audio' as const, clips: [{ id: 'a', assetPath: audio, startMs: 0, durationMs: 1000 }], ...trackExtra }]),
      { id: 's1', kind: 'subtitle', clips: [] },
    ],
    createdAt: '', updatedAt: '',
  }
}

describe('track volume & mute model (A1)', () => {
  it('round-trips volume/muted through validation and the store', async () => {
    const tracks = normalizeTimelineTracks([
      { id: 'a1', kind: 'audio', volume: 0.333, muted: true, clips: [] },
      { id: 'a2', kind: 'audio', clips: [] },
    ])
    expect(tracks[0]).toMatchObject({ volume: 0.33, muted: true })
    expect(tracks[1]?.volume).toBeUndefined()

    expect(() => normalizeTimelineTracks([{ id: 'a', kind: 'audio', volume: MAX_TRACK_VOLUME + 0.1, clips: [] }]))
      .toThrow(/between 0 and 2/)
    expect(() => normalizeTimelineTracks([{ id: 'a', kind: 'audio', volume: -1, clips: [] }])).toThrow(/between 0 and 2/)
    expect(() => normalizeTimelineTracks([{ id: 'a', kind: 'audio', volume: Number.NaN, clips: [] }])).toThrow(/finite/)

    const directory = await temp('dsh-audio-store-')
    const store = new WorkbenchStore({ directory })
    const project = await store.createProject('音轨')
    const saved = await store.saveTimeline({
      projectId: project.id, tracks: [{ id: 'a1', kind: 'audio', volume: 0.5, clips: [] }],
    })
    const reopened = new WorkbenchStore({ directory })
    expect((await reopened.listTimelines(project.id))[0]?.tracks[0]).toMatchObject({ volume: 0.5 })
    expect(saved.tracks[0]?.volume).toBe(0.5)
  })
})

describe('导出混音（A1）', () => {
  it('applies volume in the filter graph and skips muted tracks', () => {
    const snapshot = freezeTimeline(timeline('/tmp/v.mp4', '/tmp/a.aac', { volume: 0.5 }))
    const args = buildRenderArgs(snapshot, { outputPath: '/tmp/out.mp4' })
    const filter = args[args.indexOf('-filter_complex') + 1] ?? ''
    expect(filter).toContain('volume=0.50')
    expect(args).toContain('[aout]')
    expect(args).not.toContain('-an')
    expect(planAudioTracks(snapshot)).toHaveLength(1)

    const muted = freezeTimeline(timeline('/tmp/v.mp4', '/tmp/a.aac', { muted: true }))
    expect(planAudioTracks(muted)).toHaveLength(0)
    const mutedArgs = buildRenderArgs(muted, { outputPath: '/tmp/out.mp4' })
    expect(mutedArgs).toContain('-an')
  })

  it('exports a real file whose audio stream is present (真机，零生成花费)', async () => {
    const work = await temp('dsh-audio-work-')
    const outputs = await temp('dsh-audio-out-')
    const video = await makeVideo(work, 'v.mp4')
    const audio = await makeAudio(work, 'a.aac')
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render(timeline(video, audio, { volume: 0.8 }))
    expect(result.bytes).toBeGreaterThan(1000)

    // 用 ffmpeg -i 检查产物里确实有音频流
    const probe = await new Promise<string>(resolve => {
      execFile(FFMPEG, ['-hide_banner', '-i', result.outputPath], (_error, _stdout, stderr) => { resolve(String(stderr)) })
    })
    expect(probe).toMatch(/Audio: aac/)
    expect(Math.abs(result.durationMs - 1000)).toBeLessThanOrEqual(40)
  }, 60_000)
})
