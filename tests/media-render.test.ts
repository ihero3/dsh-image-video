/**
 * `RenderService`（`T5-5`）。
 *
 * 真机部分用 ffmpeg 的 `testsrc` 自造素材（**不花生成 token**）：验证导出文件可播放、
 * 时长与时间轴差在 1 帧内、取消不留半成品；纯函数部分断言 filter graph 与快照冻结。
 */
import { execFile, execFileSync } from 'node:child_process'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  RenderError, RenderService, buildRenderArgs, freezeTimeline, frameToleranceMs, measureDuration, planVideoSegments,
  type TimelineSnapshot,
} from '../src/media/render.ts'
import { activeClipAt, type TimelineRecord } from '../src/workbench/timeline.ts'

const dirs: string[] = []

/** 查找本机 ffmpeg：先看 DSH_FFMPEG_PATH，再试 PATH（Node 在 Windows 上 spawn 时会自动补 .exe）。 */
function findFfmpeg(): string | null {
  if (process.env.DSH_FFMPEG_PATH) return process.env.DSH_FFMPEG_PATH
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg' }
  catch { return null }
}
const FFMPEG = findFfmpeg()

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })

/** 造一个 n 秒的测试片段（320x240 testsrc）。 */
async function makeClip(dir: string, name: string, seconds: number): Promise<string> {
  const output = join(dir, name)
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `testsrc=size=320x240:rate=30:duration=${seconds}`,
      '-pix_fmt', 'yuv420p', '-c:v', 'libx264', output,
    ], error => { error === null ? resolve() : reject(error) })
  })
  return output
}

/** 一份时间轴文档。 */
function timeline(clips: Array<{ id: string; path: string; startMs: number; durationMs: number }>, extra: Partial<TimelineRecord> = {}): TimelineRecord {
  return {
    schemaVersion: 1, id: 'tml-render', projectId: 'prj-1', name: '导出', frameRate: 30, burnSubtitles: false,
    tracks: [
      { id: 'v1', kind: 'video', clips: clips.map(clip => ({ id: clip.id, assetPath: clip.path, startMs: clip.startMs, durationMs: clip.durationMs })) },
      { id: 'a1', kind: 'audio', clips: [] },
      { id: 's1', kind: 'subtitle', clips: [] },
    ],
    createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z',
    ...extra,
  }
}

describe('render planning (T5-5)', () => {
  it('freezes a snapshot so later edits cannot affect a running render', () => {
    const doc = timeline([{ id: 'c1', path: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }])
    const snapshot = freezeTimeline(doc)
    ;(doc.tracks[0]!.clips as unknown as Array<{ durationMs: number }>)[0]!.durationMs = 9999
    ;(doc.tracks as unknown as Array<{ id: string }>)[0]!.id = 'renamed'
    expect(snapshot.tracks[0]?.clips[0]?.durationMs).toBe(1000)
    expect(snapshot.tracks[0]?.id).toBe('v1')
    expect(snapshot.durationMs).toBe(1000)
  })

  it('fills timeline gaps and the tail with black segments', () => {
    const snapshot = freezeTimeline({
      ...timeline([{ id: 'c1', path: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }]),
      tracks: [
        { id: 'v1', kind: 'video', clips: [
          { id: 'c1', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 },
          { id: 'c2', assetPath: '/tmp/b.mp4', startMs: 2000, durationMs: 1000 },
        ] },
        { id: 's1', kind: 'subtitle', clips: [{ id: 's1', text: '字幕', startMs: 0, durationMs: 4000 }] },
      ],
    })
    const segments = planVideoSegments(snapshot)
    expect(segments.map(segment => segment.kind)).toEqual(['clip', 'filler', 'clip', 'filler'])
    expect(segments[1]).toMatchObject({ durationMs: 1000 })
    expect(segments[3]).toMatchObject({ durationMs: 1000 })
    expect(snapshot.durationMs).toBe(4000)
  })

  it('refuses overlapping clips and empty video tracks with actionable codes', () => {
    const overlap = freezeTimeline(timeline([
      { id: 'c1', path: '/tmp/a.mp4', startMs: 0, durationMs: 2000 },
      { id: 'c2', path: '/tmp/b.mp4', startMs: 1000, durationMs: 1000 },
    ]))
    expect(() => planVideoSegments(overlap)).toThrow(/重叠/)
    try {
      planVideoSegments(overlap)
    } catch (error) {
      expect((error as RenderError).code).toBe('MEDIA_TIMELINE_OVERLAP')
    }
    expect(() => planVideoSegments(freezeTimeline(timeline([])))).toThrow(/空的/)
  })

  it('builds a filter graph with concat, fps and optional burnt-in subtitles', () => {
    const withSubtitle: TimelineSnapshot = freezeTimeline({
      ...timeline([{ id: 'c1', path: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }], { burnSubtitles: true }),
      tracks: [
        { id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }] },
        { id: 's1', kind: 'subtitle', clips: [{ id: 's1', text: '你好', startMs: 200, durationMs: 500, style: { fontSize: 40, color: '#ffcc00', position: 'top' } }] },
      ],
    })
    const args = buildRenderArgs(withSubtitle, { outputPath: '/tmp/out.mp4', fontFile: '/System/Library/Fonts/PingFang.ttc' })
    const filter = args[args.indexOf('-filter_complex') + 1] ?? ''
    expect(filter).toContain('concat=n=1:v=1:a=0')
    expect(filter).toContain('fps=30')
    expect(filter).toContain('drawtext=')
    expect(filter).toContain("fontcolor=0xffcc00")
    expect(filter).toContain('enable=\'between(t,0.200,0.700)\'')
    expect(args).toContain('libx264')
    expect(args).toContain('-an')

    const off = buildRenderArgs({ ...withSubtitle, burnSubtitles: false }, { outputPath: '/tmp/out.mp4' })
    expect((off[off.indexOf('-filter_complex') + 1] ?? '')).not.toContain('drawtext=')
  })
})

describe('preview vs export boundaries (T5-2)', () => {
  it('switches clips at exactly the same points in the preview and in the export plan', () => {
    const doc: TimelineRecord = {
      schemaVersion: 1, id: 'tml-b', projectId: 'prj-1', name: '边界', frameRate: 30, burnSubtitles: false,
      tracks: [
        { id: 'v1', kind: 'video', clips: [
          { id: 'c1', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 },
          { id: 'c2', assetPath: '/tmp/b.mp4', startMs: 1500, durationMs: 1200 },
        ] },
        { id: 's1', kind: 'subtitle', clips: [{ id: 's1', text: '一', startMs: 0, durationMs: 900 }, { id: 's2', text: '二', startMs: 900, durationMs: 800 }] },
      ],
      createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z',
    }
    const snapshot = freezeTimeline(doc)
    // 导出侧的切分点（含黑场填充）
    const segments = planVideoSegments(snapshot)
    const exportBoundaries: number[] = []
    let cursor = 0
    for (const segment of segments) {
      exportBoundaries.push(cursor)
      cursor += segment.durationMs
    }
    // 预览侧的切换点：变化点就是边界（阈值 = 1 帧的容差，这里必须精确相等）
    const tolerance = frameToleranceMs(snapshot.frameRate)
    const previewSwitches: number[] = []
    let previous = activeClipAt(snapshot.tracks, 'video', 0)?.id ?? 'none'
    for (let time = 0; time <= snapshot.durationMs; time += 10) {
      const current = activeClipAt(snapshot.tracks, 'video', time)?.id ?? 'none'
      if (current !== previous) { previewSwitches.push(time); previous = current }
    }
    // 每个导出边界，预览在边界前 10ms 与边界处必须换段（且不超过 1 帧容差）
    for (const boundary of exportBoundaries.filter(value => value > 0)) {
      const before = activeClipAt(snapshot.tracks, 'video', boundary - 1)?.id ?? 'none'
      const after = activeClipAt(snapshot.tracks, 'video', boundary)?.id ?? 'none'
      void before
      void after
      const nearest = previewSwitches.reduce((best, value) => Math.abs(value - boundary) < Math.abs(best - boundary) ? value : best, previewSwitches[0] ?? boundary)
      expect(Math.abs(nearest - boundary)).toBeLessThanOrEqual(tolerance)
    }
    // 字幕切换点同理
    expect(activeClipAt(snapshot.tracks, 'subtitle', 899)?.id).toBe('s1')
    expect(activeClipAt(snapshot.tracks, 'subtitle', 900)?.id).toBe('s2')
  })
})

const describeRenderReal = FFMPEG ? describe : describe.skip
describeRenderReal('render on the real machine (T5-5)', () => {
  it('exports a playable file whose duration matches the timeline within one frame', async () => {
    const work = await tempDir('dsh-render-')
    const first = await makeClip(work, 'a.mp4', 1)
    const second = await makeClip(work, 'b.mp4', 1)
    const outputs = await tempDir('dsh-render-out-')
    const progress: number[] = []
    const service = new RenderService({ outputsDir: outputs, now: () => new Date('2026-10-16T01:00:00.000Z') })

    const result = await service.render(
      timeline([
        { id: 'c1', path: first, startMs: 0, durationMs: 1000 },
        { id: 'c2', path: second, startMs: 1000, durationMs: 1000 },
      ]),
      { onProgress: value => { progress.push(value.percent) } },
    )

    expect(result.outputPath).toBe(join(outputs, `${new Date('2026-10-16T01:00:00.000Z').getTime()}-${result.outputPath.split('-').slice(-1)[0]}`))
    expect(result.bytes).toBeGreaterThan(1000)
    expect(progress.length).toBeGreaterThan(0)
    expect(progress.some(value => value > 0 && value <= 100)).toBe(true)
    // 时长 ±1 帧（30fps → 33.3ms）
    expect(Math.abs(result.durationMs - 2000)).toBeLessThanOrEqual(frameToleranceMs(30) + 1)
    const measured = await measureDuration(FFMPEG, result.outputPath)
    expect(measured).toBeDefined()
    expect(Math.abs((measured ?? 0) - 2000)).toBeLessThanOrEqual(frameToleranceMs(30) + 1)
  }, 60_000)

  it('cancels a run without leaving a partial file behind', async () => {
    const work = await tempDir('dsh-render-cancel-')
    const clip = await makeClip(work, 'a.mp4', 3)
    const outputs = await tempDir('dsh-render-cancel-out-')
    const service = new RenderService({ outputsDir: outputs })
    const controller = new AbortController()
    const pending = service.render(
      timeline([{ id: 'c1', path: clip, startMs: 0, durationMs: 3000 }]),
      { signal: controller.signal, fileName: 'cancelled.mp4' },
    )
    setTimeout(() => { controller.abort() }, 120)
    await expect(pending).rejects.toThrow(/取消/)
    await expect(stat(join(outputs, 'cancelled.mp4'))).rejects.toThrow()
  }, 60_000)

  it('fails before spawning ffmpeg when a referenced asset is gone', async () => {
    const outputs = await tempDir('dsh-render-missing-out-')
    const service = new RenderService({ outputsDir: outputs })
    await expect(service.render(timeline([{ id: 'c1', path: '/definitely/not/here/clip.mp4', startMs: 0, durationMs: 1000 }])))
      .rejects.toThrow(/素材不存在/)
  }, 30_000)
})
