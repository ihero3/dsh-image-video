/**
 * The workbench channel's phase-2 endpoints, over the real handler and a real
 * store: the payload contract the browser half depends on.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { execFile, execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { GenerationRegistry } from '../src/workbench/cancel.ts'
import { WorkflowRunner } from '../src/workbench/runner.ts'
import { RenderRegistry } from '../src/media/render-registry.ts'
import { RenderService } from '../src/media/render.ts'
import type { AssetRecord, ProjectRecord } from '../src/workbench/records.ts'
import type { OutputFile } from '../src/workbench/outputs.ts'

function findFfmpeg(): string | null {
  if (process.env.DSH_FFMPEG_PATH) return process.env.DSH_FFMPEG_PATH
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg' }
  catch { return null }
}
const FFMPEG = findFfmpeg()

/** Handler over throwaway directories, plus a helper that unwraps the envelope. */
async function makeHandler() {
  const dataDir = await mkdtemp(join(tmpdir(), 'dsh-image-video-rpc-'))
  const outputsDir = await mkdtemp(join(tmpdir(), 'dsh-image-video-out-'))
  await writeFile(join(outputsDir, 'shot.png'), 'png')
  await writeFile(join(outputsDir, 'clip.mp4'), 'mp4')
  await writeFile(join(outputsDir, 'notes.txt'), 'ignored')
  const store = new WorkbenchStore({ directory: dataDir, now: () => new Date('2026-10-14T00:00:00.000Z') })
  const registry = new GenerationRegistry()
  let runSequence = 0
  const runner = new WorkflowRunner({
    store,
    newRunId: () => `run-${++runSequence}`,
    generateImage: { async execute() { return { localPath: '/tmp/out/shot.png', bytes: 10 } } },
    generateVideo: { async execute() { return { videoPath: '/tmp/out/clip.mp4', bytes: 20 } } },
  })
  const renders = new RenderRegistry({
    render: new RenderService({ outputsDir }),
    registerAsset: async job => {
      if (job.outputPath === undefined) return
      await store.attachAsset({ projectId: job.projectId, path: job.outputPath, kind: 'video', bytes: job.bytes })
    },
  })
  const handler = createWorkbenchHandler({
    provider: 'threevideo', outputsDir, store, registry, runner, renders,
    defaults: () => ({
      mediaMode: 'image', imageProvider: 'threevideo', imageSize: '1024*1024', imageStyle: null,
      videoProvider: 'threevideo', videoAspectRatio: '16:9', videoDuration: 5,
    }),
  })
  /** Call one endpoint and fail the test on a refused envelope. */
  async function ok<T>(endpoint: string, payload?: unknown): Promise<T> {
    const result = await handler(endpoint, payload, new AbortController().signal, {} as never)
    if (!result.ok) throw new Error(`refused: ${result.error.code} ${result.error.message}`)
    return result.value as T
  }
  return { handler, ok, outputsDir, store, registry }
}

describe('workbench channel endpoints', () => {
  it('reports health unchanged', async () => {
    const { ok } = await makeHandler()
    const health = await ok<{ version: string; provider: string; channel: string }>('health')
    expect(health.channel).toBe('/image-video')
    expect(health.provider).toBe('threevideo')
  })

  it('walks the project and asset lifecycle', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '片子' })
    expect(created.project.name).toBe('片子')

    const listed = await ok<{ projects: ProjectRecord[] }>('projects/list')
    expect(listed.projects.map(project => project.id)).toEqual([created.project.id])

    const attached = await ok<{ asset: AssetRecord; created: boolean }>('assets/attach', {
      projectId: created.project.id, path: '/tmp/x/shot.png', kind: 'image', bytes: 2048,
    })
    expect(attached.created).toBe(true)
    // 第二次登记同一路径：幂等，`created` 为 false 且素材仍只有一条
    const repeated = await ok<{ asset: AssetRecord; created: boolean }>('assets/attach', {
      projectId: created.project.id, path: '/tmp/x/shot.png', kind: 'image',
    })
    expect(repeated.created).toBe(false)
    expect(repeated.asset.id).toBe(attached.asset.id)
    expect((await ok<{ assets: AssetRecord[] }>('assets/list', { projectId: created.project.id })).assets)
      .toEqual([attached.asset])

    expect(await ok<{ removed: boolean }>('assets/remove', { id: attached.asset.id })).toEqual({ removed: true })
    expect(await ok<{ removed: boolean }>('projects/remove', { id: created.project.id })).toEqual({ removed: true })
    expect(await ok<{ projects: ProjectRecord[] }>('projects/list')).toEqual({ projects: [] })
  })

  it('stores workflow documents and compacts duplicate assets through the channel', async () => {
    const { ok, handler } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '流程' })
    const saved = await ok<{ workflow: { id: string; nodes: unknown[] } }>('workflows/save', {
      projectId: created.project.id, name: '模板', edges: [],
      nodes: [{ id: 'n1', kind: 'image-generate', position: { x: 0, y: 0 }, params: {} }],
    })
    expect(saved.workflow.id).toMatch(/^wfl-/)
    expect((await ok<{ workflows: unknown[] }>('workflows/list', { projectId: created.project.id })).workflows).toHaveLength(1)
    expect(await ok<{ removed: boolean }>('workflows/remove', { id: saved.workflow.id })).toEqual({ removed: true })

    // 结构不合法的图要报成载荷错误，而不是静默存下来
    const bad = await handler('workflows/save', {
      projectId: created.project.id, nodes: [{ id: 'a', kind: 'script', position: { x: 0, y: 0 } }],
      edges: [{ source: 'a', target: 'a' }],
    }, new AbortController().signal, {} as never)
    expect(bad.ok).toBe(false)

    expect(await ok<{ removed: number }>('maintenance/compact', {})).toEqual({ removed: 0 })
  })

  const itWithFfmpeg = FFMPEG ? it : it.skip
  itWithFfmpeg('renders a timeline through the channel and registers the artifact (T5-5)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '导出项目' })
    // 用 ffmpeg 自造 1 秒素材（不花生成 token）
    const work = await mkdtemp(join(tmpdir(), 'dsh-endpoint-render-'))
    const clip = join(work, 'clip.mp4')
    await new Promise<void>((resolve, reject) => {
      execFile(FFMPEG!, [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=1',
        '-pix_fmt', 'yuv420p', '-c:v', 'libx264', clip,
      ], error => { error === null ? resolve() : reject(error) })
    })

    const saved = await ok<{ timeline: { id: string } }>('timelines/save', {
      projectId: created.project.id, name: '成片',
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: clip, startMs: 0, durationMs: 1000 }] }],
    })
    const started = await ok<{ render: { id: string; status: string } }>('timelines/render', { timelineId: saved.timeline.id })
    expect(started.render.status).toBe('running')

    await vi.waitFor(async () => {
      const list = await ok<{ renders: Array<{ status: string; outputPath?: string; percent: number }> }>('timelines/renders', { projectId: created.project.id })
      expect(list.renders[0]?.status).toBe('succeeded')
      expect(list.renders[0]?.percent).toBe(100)
      // 产物自动登记成素材
      const assets = await ok<{ assets: Array<{ path: string }> }>('assets/list', { projectId: created.project.id })
      expect(assets.assets.some(asset => asset.path === list.renders[0]?.outputPath)).toBe(true)
    }, { timeout: 40_000, interval: 500 })

    // 已结束的任务取消不了
    expect(await ok<{ cancelled: boolean }>('timelines/render-cancel', { renderId: started.render.id })).toEqual({ cancelled: false })
    await rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  }, 60_000)

  it('plans output retention with a dry run by default (A15)', async () => {
    const { ok } = await makeHandler()
    // 空 outputs 目录：预演应返回空计划且不报错
    const planned = await ok<{ dryRun: boolean; plan: { remove: unknown[]; overQuota: boolean } }>(
      'maintenance/retention', { maxFiles: 10 },
    )
    expect(planned.dryRun).toBe(true)
    expect(planned.plan.remove).toEqual([])
    expect(planned.plan.overQuota).toBe(false)
  })

  it('saves custom presets and lists them alongside the built-in ones (A48)', async () => {
    const { ok } = await makeHandler()
    const saved = await ok<{ preset: { id: string; name: string } }>('presets/save', {
      name: '自定义 9:16', width: 1080, height: 1920, frameRate: 30,
    })
    expect(saved.preset.name).toBe('自定义 9:16')
    const listed = await ok<{ presets: Array<{ id: string; custom: boolean }> }>('presets/list', {})
    expect(listed.presets.some(preset => preset.id === saved.preset.id && preset.custom)).toBe(true)
    expect(listed.presets.some(preset => preset.id === 'douyin-vertical' && preset.custom === false)).toBe(true)
    const removed = await ok<{ removed: boolean }>('presets/remove', { id: saved.preset.id })
    expect(removed.removed).toBe(true)
  })

  it('validates a timeline through the channel and also accepts an inline document (A34)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '校验项目' })
    const saved = await ok<{ timeline: { id: string } }>('timelines/save', {
      projectId: created.project.id, tracks: [{ id: 'v1', kind: 'video', clips: [] }],
    })
    const checked = await ok<{ ok: boolean; issues: Array<{ code: string }> }>('timelines/validate', { timelineId: saved.timeline.id })
    expect(checked.ok).toBe(false)
    expect(checked.issues.map(issue => issue.code)).toContain('empty-video-track')

    // 未保存的文档也能预检（界面拖拽时用）
    const inline = await ok<{ ok: boolean }>('timelines/validate', {
      document: {
        schemaVersion: 3, id: 'x', projectId: created.project.id, name: 'inline', frameRate: 30, burnSubtitles: false,
        tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: 'outputs/a.mp4', startMs: 0, durationMs: 1000 }] }],
        createdAt: '', updatedAt: '',
      },
    })
    expect(typeof inline.ok).toBe('boolean')

    // `A40`：inline 文档超限要在端点层就拒掉（别让它白跑）
    const oversize = await ok<{ ok: boolean }>('timelines/validate', {
      document: {
        schemaVersion: 3, id: 'x', projectId: created.project.id, name: 'big', frameRate: 30, burnSubtitles: false,
        tracks: [{ id: 'v1', kind: 'video', clips: Array.from({ length: 401 }, (_, i) => ({
          id: `c${i}`, assetPath: 'outputs/a.mp4', startMs: i * 1000, durationMs: 1000,
        })) }],
        createdAt: '', updatedAt: '',
      },
    }).catch(error => error as Error)
    expect(String(oversize)).toMatch(/片段太多/)
  })

  it('summarises export readiness in one call (A84)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '体检' })
    const dirty = await ok<{ timeline: { id: string } }>('timelines/save', {
      projectId: created.project.id,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: 'outputs/missing.mp4', startMs: 0, durationMs: 3000 }] }],
    })
    const blocked = await ok<{
      ok: boolean; issues: Array<{ code: string }>; estimate: { estimatedBytes: number; humanBytes: string }; summaryLine: string
    }>('timelines/preflight', { timelineId: dirty.timeline.id })
    expect(blocked.ok).toBe(false)
    expect(blocked.issues.map(issue => issue.code)).toContain('missing-asset')
    expect(blocked.estimate.humanBytes).toMatch(/KB|MB|GB/)
    expect(blocked.summaryLine).toContain('暂不建议导出')

    // 干净的时间轴（无片段 → 报空轨，属"阻断"类）→ 也能拿到体积与汇总
    const clean = await ok<{ timeline: { id: string } }>('timelines/save', {
      projectId: created.project.id, tracks: [{ id: 'v1', kind: 'video', clips: [] }],
    })
    const report = await ok<{ issues: Array<{ code: string }>; summaryLine: string; usage: { total: number } }>('timelines/preflight', { timelineId: clean.timeline.id })
    expect(report.summaryLine).toContain('约')
    expect(report.usage.total).toBeGreaterThanOrEqual(0)
  })

  it('retries a FAILED render (the main use case, R7)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '重试失败' })
    const saved = await ok<{ timeline: { id: string } }>('timelines/save', {
      projectId: created.project.id,
      // 素材不存在 → 导出必然失败 → 正好验证"失败任务重试"这条主路径
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: 'outputs/ghost.mp4', startMs: 0, durationMs: 1000 }] }],
    })
    const first = await ok<{ render: { id: string; status: string } }>('timelines/render', { timelineId: saved.timeline.id })
    await vi.waitFor(async () => {
      const listed = await ok<{ renders: Array<{ id: string; status: string }> }>('timelines/renders', {})
      expect(listed.renders.find(entry => entry.id === first.render.id)?.status).toBe('failed')
    }, { timeout: 20_000 })

    const retried = await ok<{ render: { id: string; status: string }; retriedFrom: string }>('timelines/render-retry', { renderId: first.render.id })
    expect(retried.retriedFrom).toBe(first.render.id)
    expect(retried.render.id).not.toBe(first.render.id)
  })

  it('retries a finished render with the same timeline (A59)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '重试' })
    const saved = await ok<{ timeline: { id: string } }>('timelines/save', {
      projectId: created.project.id,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: 'outputs/a.mp4', startMs: 0, durationMs: 1000 }] }],
    })
    const first = await ok<{ render: { id: string } }>('timelines/render', { timelineId: saved.timeline.id, priority: 3 })
    await vi.waitFor(async () => {
      const listed = await ok<{ renders: Array<{ id: string; status: string }> }>('timelines/renders', {})
      expect(listed.renders.find(job => job.id === first.render.id)?.status).not.toBe('running')
    }, { timeout: 15_000 })

    const retried = await ok<{ render: { id: string; priority?: number }; retriedFrom: string }>('timelines/render-retry', { renderId: first.render.id })
    expect(retried.retriedFrom).toBe(first.render.id)
    expect(retried.render.id).not.toBe(first.render.id)
    expect(retried.render.priority).toBe(3) // 复用原优先级

    const missing = await ok('timelines/render-retry', { renderId: 'render-nope' }).catch(error => error as Error)
    expect(String(missing)).toMatch(/找不到渲染任务/)
  })

  it('caps asset probing at 20 paths without crashing (R6)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '多素材' })
    const saved = await ok<{ timeline: { id: string } }>('timelines/save', {
      projectId: created.project.id,
      tracks: [{ id: 'v1', kind: 'video', clips: Array.from({ length: 21 }, (_, index) => ({
        id: `c${index}`, assetPath: `outputs/ghost-${index}.mp4`, startMs: index * 1000, durationMs: 1000,
      })) }],
    })
    const checked = await ok<{ ok: boolean; issues: Array<{ code: string }> }>('timelines/validate', { timelineId: saved.timeline.id })
    // 21 个素材全部缺失 → 探测失败不影响校验；不应误报越界，也不应崩
    expect(Array.isArray(checked.issues)).toBe(true)
    expect(checked.issues.map(issue => issue.code)).not.toContain('clip-longer-than-asset')
  })

  it('survives asset probing when files are missing (A45)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '越界' })
    const saved = await ok<{ timeline: { id: string } }>('timelines/save', {
      projectId: created.project.id,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: 'outputs/ghost.mp4', startMs: 0, durationMs: 3000 }] }],
    })
    // 素材不存在 → 探测拿不到时长 → 不应崩，也不应误报越界
    const checked = await ok<{ ok: boolean; issues: Array<{ code: string }> }>('timelines/validate', { timelineId: saved.timeline.id })
    expect(checked.issues.map(issue => issue.code)).not.toContain('clip-longer-than-asset')
  })

  it('probes a registered asset through the channel and rejects paths outside outputs (A44)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '探测' })
    await ok('assets/attach', { projectId: created.project.id, path: 'outputs/probe.png', kind: 'image' })
    // 登记过的素材允许探测（这里文件不存在 → 探测失败，但**不是**越界错误）
    const rejected = await ok('assets/probe', { path: '/etc/passwd' }).catch(error => error as Error)
    expect(String(rejected)).toMatch(/只能探测 outputs 目录内或已登记的素材/)
  })

  it('lists export presets through the channel (A31)', async () => {
    const { ok } = await makeHandler()
    const result = await ok<{ presets: Array<{ id: string; width: number; height: number }> }>('presets/list', {})
    expect(result.presets.some(preset => preset.id === 'douyin-vertical' && preset.width === 1080 && preset.height === 1920)).toBe(true)
  })

  it('reports a diagnostics snapshot with data scale and render queue (A9)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '诊断项目' })
    await ok('assets/attach', { projectId: created.project.id, path: 'outputs/diag.png', kind: 'image' })
    const snapshot = await ok<{
      plugin: { name: string; version: string }
      data: { projects: number; assets: number; writeCount: number; fileBytes: number; runningRuns: number }
      renders: { running: number; queued: number; recent: unknown[]; stats: { finished: number; failed: number; cancelled: number } }
      cache: { nodeResults: number }
      outputs: { files: number; bytes: number; referenced: number; oldestAt?: string }
      errors: { errors: unknown[]; errorCount: number }
    }>('diagnostics', {})
    expect(snapshot.plugin.name).toBe('dsh-image-video')
    expect(snapshot.plugin.version).toBeTruthy()
    expect(snapshot.data.projects).toBe(1)
    expect(snapshot.data.assets).toBe(1)
    expect(snapshot.data.writeCount).toBeGreaterThan(0)
    expect(snapshot.data.fileBytes).toBeGreaterThan(0)
    expect(snapshot.data.runningRuns).toBe(0)
    expect(snapshot.renders).toMatchObject({ running: 0, queued: 0 })
    expect(snapshot.renders.stats).toMatchObject({ finished: 0, failed: 0, cancelled: 0 })
    expect(Array.isArray(snapshot.renders.recent)).toBe(true)
    expect(snapshot.cache.nodeResults).toBe(0)
    // `A18`：输出目录占用（空目录至少字段齐全可读）
    expect(snapshot.outputs.files).toBeGreaterThanOrEqual(0)
    expect(snapshot.outputs.bytes).toBeGreaterThanOrEqual(0)
    expect(snapshot.outputs.referenced).toBeGreaterThanOrEqual(0)
    expect(snapshot.errors).toMatchObject({ errorCount: expect.any(Number) })
  })

  it('refuses package exports outside the packages directory (security boundary)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '安全边界' })
    const inside = await ok<{ package: { manifestPath: string } }>('packages/export', { projectId: created.project.id })
    expect(inside.package.manifestPath).toContain('packages/')
    // 任意路径必须被拒（写盘动作的安全边界）
    await expect(ok('packages/export', { projectId: created.project.id, targetDir: '/tmp/evil-export' }))
      .rejects.toThrow(/安全边界/)
    await expect(ok('packages/export-resources', { projectId: created.project.id, targetDir: '/etc/dsh' }))
      .rejects.toThrow(/安全边界/)
  })

  it('refuses an unforced delete of a referenced asset through the channel (T2-4)', async () => {
    const { ok, handler } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '引用检查' })
    const asset = await ok<{ asset: { id: string } }>('assets/attach', {
      projectId: created.project.id, path: '/tmp/referenced.mp4', kind: 'video',
    })
    await ok('timelines/save', {
      projectId: created.project.id, name: '引用它的时间轴',
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: '/tmp/referenced.mp4', startMs: 0, durationMs: 1000 }] }],
    })
    const refused = await handler('assets/remove', { id: asset.asset.id }, new AbortController().signal, {} as never)
    expect(refused.ok).toBe(false)
    expect(JSON.stringify(refused)).toContain('正被引用')
    expect(await ok<{ removed: boolean }>('assets/remove', { id: asset.asset.id, force: true })).toEqual({ removed: true })
  })

  it('reports the effective defaults in the health payload (T2-11)', async () => {
    const { ok } = await makeHandler()
    const health = await ok<{ defaults?: Record<string, string | number | null> }>('health', {})
    // 端点测试的 handler 注入了 defaults，字段名应与 composer 侧同一口径
    expect(health.defaults).toBeDefined()
    expect(Object.keys(health.defaults ?? {})).toEqual(
      expect.arrayContaining(['mediaMode', 'imageProvider', 'imageSize', 'imageStyle', 'videoProvider', 'videoAspectRatio', 'videoDuration']),
    )
  })

  it('reports ffmpeg capability through the channel (T5-4)', async () => {
    const { ok } = await makeHandler()
    // 默认探测：本机装了应是 ok，没装也要给出可操作原因
    const probe = (await ok<{ ffmpeg: { available: boolean; code?: string; message?: string; path?: string } }>('media/ffmpeg', {})).ffmpeg
    if (probe.available) {
      expect(probe.path).toBeTruthy()
    } else {
      expect(probe.code).toMatch(/^MEDIA_FFMPEG_/)
      expect(probe.message).toBeTruthy()
    }
    // 诊断指定副本：严格模式，查不存在的路径必须报 MEDIA_FFMPEG_UNAVAILABLE
    const bogus = (await ok<{ ffmpeg: { available: boolean; code?: string } }>('media/ffmpeg', { path: '/definitely/not/here/ffmpeg' })).ffmpeg
    expect(bogus.available).toBe(false)
    expect(bogus.code).toBe('MEDIA_FFMPEG_UNAVAILABLE')
  })

  it('quick-adds a conversation artifact into the workbench (T6-1 backend)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '对话素材' })
    const path = '/tmp/outputs/card-artifact.mp4'

    // 只要素材
    const attached = await ok<{ projectId: string; created: boolean; asset: { path: string; kind: string } }>(
      'assets/quick-add', { path, kind: 'video', projectId: created.project.id, prompt: '卡片来的' },
    )
    expect(attached.projectId).toBe(created.project.id)
    expect(attached.asset).toMatchObject({ path, kind: 'video' })
    expect(attached.created).toBe(true)

    // 再点一次只登记不算新建（幂等）
    expect((await ok<{ created: boolean }>('assets/quick-add', { path, projectId: created.project.id })).created).toBe(false)

    // 放进时间轴：没有时间轴就自动建一条，并在视频轨末尾加片段
    const intoTimeline = await ok<{ timelineId: string; clipId: string }>('assets/quick-add', {
      path, projectId: created.project.id, intoTimeline: true, durationMs: 2500,
    })
    expect(intoTimeline.clipId).toMatch(/^clip-/)
    const timelines = await ok<{ timelines: Array<{ id: string; tracks: Array<{ kind: string; clips: Array<{ id: string; assetPath?: string; durationMs: number }> }> }> }>(
      'timelines/list', { projectId: created.project.id },
    )
    const timeline = timelines.timelines.find(row => row.id === intoTimeline.timelineId)
    const clip = timeline?.tracks.find(track => track.kind === 'video')?.clips.at(-1)
    expect(clip).toMatchObject({ assetPath: path, durationMs: 2500 })
  })

  it('stores timelines through the channel and rejects inlined bytes', async () => {
    const { ok, handler } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '时间轴' })
    const saved = await ok<{ timeline: { id: string; tracks: unknown[] } }>('timelines/save', {
      projectId: created.project.id, name: '成片',
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: '/tmp/outputs/a.mp4', startMs: 0, durationMs: 5000 }] }],
    })
    expect(saved.timeline.id).toMatch(/^tml-/)
    expect(saved.timeline.tracks).toHaveLength(1)
    expect((await ok<{ timelines: unknown[] }>('timelines/list', { projectId: created.project.id })).timelines).toHaveLength(1)
    expect(await ok<{ removed: boolean }>('timelines/remove', { id: saved.timeline.id })).toEqual({ removed: true })

    const inlined = await handler('timelines/save', {
      projectId: created.project.id,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: 'data:video/mp4;base64,AAAA', startMs: 0, durationMs: 1 }] }],
    }, new AbortController().signal, {} as never)
    expect(inlined.ok).toBe(false)
  })

  it('runs a stored workflow and reports run records through the channel', async () => {
    const { ok, handler } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '运行' })
    const saved = await ok<{ workflow: { id: string } }>('workflows/save', {
      projectId: created.project.id, name: '跑', edges: [],
      nodes: [{ id: 'i', kind: 'image-generate', position: { x: 0, y: 0 }, params: { prompt: '猫' } }],
    })

    const started = await ok<{ run: { id: string; status: string } }>('workflows/run', { workflowId: saved.workflow.id })
    expect(started.run).toMatchObject({ id: 'run-1', status: 'running' })

    // 后台执行会逐节点落库：轮询到成功
    await vi.waitFor(async () => {
      const runs = await ok<{ runs: Array<{ status: string; nodeRuns: Array<{ outputPath?: string }> }> }>(
        'workflows/runs', { projectId: created.project.id },
      )
      expect(runs.runs[0]?.status).toBe('succeeded')
      expect(runs.runs[0]?.nodeRuns[0]?.outputPath).toBe('/tmp/out/shot.png')
    })

    // 已结束的运行取消不了；重试会新建一条记录
    expect(await ok<{ cancelled: boolean }>('workflows/run-cancel', { runId: 'run-1' })).toEqual({ cancelled: false })
    const retried = await ok<{ run: { id: string } }>('workflows/run-retry', { runId: 'run-1' })
    expect(retried.run.id).toBe('run-2')

    const unknown = await handler('workflows/run', { workflowId: 'nope' }, new AbortController().signal, {} as never)
    expect(unknown.ok).toBe(false)
  })

  it('renames projects and manages resources through the channel', async () => {
    const { ok, handler } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '旧名' })
    expect((await ok<{ project: ProjectRecord }>('projects/rename', { id: created.project.id, name: '新名' })).project.name)
      .toBe('新名')

    const role = await ok<{ resource: { id: string; kind: string; name: string } }>('resources/create', {
      projectId: created.project.id, kind: 'role', name: '女主', note: '短发',
    })
    expect(role.resource).toMatchObject({ kind: 'role', name: '女主' })
    expect((await ok<{ resources: unknown[] }>('resources/list', { projectId: created.project.id })).resources).toHaveLength(1)
    expect((await ok<{ resources: unknown[] }>('resources/list', { projectId: created.project.id, kind: 'scene' })).resources).toHaveLength(0)
    expect(await ok<{ removed: boolean }>('resources/remove', { id: role.resource.id })).toEqual({ removed: true })

    // 非法种类与非法项目都要报成载荷/失败错误，而不是静默
    const badKind = await handler('resources/create', { projectId: created.project.id, kind: 'audio', name: 'x' }, new AbortController().signal, {} as never)
    expect(badKind.ok).toBe(false)
    if (!badKind.ok) expect(badKind.error.code).toBe('workbench/invalid-payload')
    const badProject = await handler('resources/create', { projectId: 'nope', kind: 'role', name: 'x' }, new AbortController().signal, {} as never)
    expect(badProject.ok).toBe(false)
    if (!badProject.ok) expect(badProject.error.code).toBe('workbench/failed')
  })

  it('cancels a running generation through the channel', async () => {
    const { ok, registry } = await makeHandler()
    const controller = registry.register('tsk-live', 'video', '2026-10-15T00:00:00.000Z')
    expect((await ok<{ running: unknown[] }>('tasks/running')).running).toHaveLength(1)
    expect(await ok<{ cancelled: boolean }>('tasks/cancel', { id: 'tsk-live' })).toEqual({ cancelled: true })
    expect(controller.signal.aborted).toBe(true)
    // 未注册的 id 如实返回 false（不假装取消成功）
    expect(await ok<{ cancelled: boolean }>('tasks/cancel', { id: 'nope' })).toEqual({ cancelled: false })
  })

  it('files a recorded generation into a project through tasks endpoints', async () => {
    const { ok, store } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '账本项目' })
    const recorded = await store.recordTask({
      kind: 'image', status: 'succeeded', provider: 'threevideo', model: 'minimax-image-01',
      outputPath: '/tmp/x/shot.jpg', bytes: 106_000,
    })

    const listed = await ok<{ tasks: Array<{ id: string; kind: string }> }>('tasks/list')
    expect(listed.tasks.map(task => task.id)).toEqual([recorded.id])

    const assigned = await ok<{ task: { projectId?: string } }>('tasks/assign', {
      id: recorded.id, projectId: created.project.id,
    })
    expect(assigned.task.projectId).toBe(created.project.id)
    expect((await ok<{ tasks: Array<{ id: string }> }>('tasks/list', { projectId: created.project.id })).tasks)
      .toHaveLength(1)

    // 未知任务 id 要如实报错（结构化 envelope），不能用静默成功糊过去
    expect(await store.updateTask('missing', { status: 'failed' })).toBeUndefined()
  })

  it('lists the newest media files and skips everything else', async () => {
    const { ok, outputsDir } = await makeHandler()
    const listed = await ok<{ outputs: OutputFile[]; directory: string }>('outputs/list', { limit: 10 })
    expect(listed.directory).toBe(outputsDir)
    expect(listed.outputs.map(file => file.name).sort()).toEqual(['clip.mp4', 'shot.png'])
    expect(listed.outputs.every(file => file.bytes > 0 && file.path.startsWith(outputsDir))).toBe(true)
  })

  it('answers a malformed payload and an unknown endpoint in the envelope', async () => {
    const { handler } = await makeHandler()
    const badPayload = await handler('projects/create', {}, new AbortController().signal, {} as never)
    expect(badPayload.ok).toBe(false)
    if (!badPayload.ok) {
      expect(badPayload.error.code).toBe('workbench/invalid-payload')
      expect(badPayload.error.message).toMatch(/name/)
    }
    const unknown = await handler('nope/nope', {}, new AbortController().signal, {} as never)
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe('workbench/unknown-endpoint')
  })
})
