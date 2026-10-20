/**
 * 音频淡入淡出 + 响度归一化（Track A / A20）。
 * 验证：域字段校验、导出链含 `afade`/`loudnorm`、真机出片仍有音轨且时长不变。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { MAX_TRACK_FADE_MS, normalizeTimelineTracks } from '../src/workbench/timeline.ts'
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
async function run(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], error => { error === null ? resolve() : reject(error) })
  })
}
const makeVideo = async (dir: string) => { const out = join(dir, 'v.mp4'); await run(['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=1', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', out]); return out }
const makeAudio = async (dir: string) => { const out = join(dir, 'a.aac'); await run(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', 'aac', out]); return out }

function timeline(video: string, audio: string, extra: { fadeMs?: number; normalizeLoudness?: boolean } = {}): TimelineRecord {
  return {
    schemaVersion: 3, id: 'tml-audio-fx', projectId: 'prj-1', name: '音频特效', frameRate: 30, burnSubtitles: false,
    ...extra.normalizeLoudness === undefined ? {} : { normalizeLoudness: extra.normalizeLoudness },
    tracks: [
      { id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: video, startMs: 0, durationMs: 1000 }] },
      { id: 'a1', kind: 'audio', clips: [{ id: 'a', assetPath: audio, startMs: 0, durationMs: 1000 }], ...extra.fadeMs === undefined ? {} : { fadeMs: extra.fadeMs } },
      { id: 's1', kind: 'subtitle', clips: [] },
    ],
    createdAt: '', updatedAt: '',
  }
}

describe('audio fade & loudness model (A20)', () => {
  it('validates the fade range and round-trips the loudness flag', async () => {
    const [videoTrack, audioTrack] = normalizeTimelineTracks([
      { id: 'v1', kind: 'video', clips: [] },
      { id: 'a1', kind: 'audio', fadeMs: 1200, clips: [] },
    ])
    expect(audioTrack?.fadeMs).toBe(1200)
    expect(videoTrack?.fadeMs).toBeUndefined()
    expect(() => normalizeTimelineTracks([{ id: 'a1', kind: 'audio', fadeMs: MAX_TRACK_FADE_MS + 1, clips: [] }]))
      .toThrow(/fadeMs/)

    const directory = await temp('dsh-audiofx-store-')
    const store = new WorkbenchStore({ directory })
    const project = await store.createProject('音频')
    const saved = await store.saveTimeline({ projectId: project.id, tracks: [], normalizeLoudness: true })
    expect(saved.normalizeLoudness).toBe(true)
    expect((await new WorkbenchStore({ directory }).listTimelines(project.id))[0]?.normalizeLoudness).toBe(true)
  })
})

describe('audio filters in the graph (A20)', () => {
  it('adds afade and loudnorm only when requested', () => {
    const withFx = buildRenderArgs(freezeTimeline(timeline('/tmp/v.mp4', '/tmp/a.aac', { fadeMs: 300, normalizeLoudness: true })), { outputPath: '/tmp/out.mp4' })
    const filter = withFx[withFx.indexOf('-filter_complex') + 1] ?? ''
    expect(filter).toContain('afade=t=in:st=0:d=0.300')
    expect(filter).toContain('afade=t=out:st=')
    expect(filter).toContain('loudnorm=I=-16:TP=-1.5:LRA=11')
    expect(withFx).toContain('[aoutn]')

    const plain = buildRenderArgs(freezeTimeline(timeline('/tmp/v.mp4', '/tmp/a.aac')), { outputPath: '/tmp/out.mp4' })
    const plainFilter = plain[plain.indexOf('-filter_complex') + 1] ?? ''
    expect(plainFilter).not.toContain('afade=')
    expect(plainFilter).not.toContain('loudnorm=')
  })

  it('renders a real file with fades + loudness and keeps the duration (零生成花费)', async () => {
    const work = await temp('dsh-audiofx-work-')
    const outputs = await temp('dsh-audiofx-out-')
    const video = await makeVideo(work)
    const audio = await makeAudio(work)
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render(timeline(video, audio, { fadeMs: 200, normalizeLoudness: true }))
    const spec = await probeMediaSpec(FFMPEG, result.outputPath)
    expect(spec?.hasAudio).toBe(true)
    expect(Math.abs(result.durationMs - 1000)).toBeLessThanOrEqual(80)
  }, 60_000)
})
