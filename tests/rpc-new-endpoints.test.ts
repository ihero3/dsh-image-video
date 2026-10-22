/**
 * 新端点级覆盖（Track A / A136）。
 *
 * `src/host/rpc.ts` 此前大量新端点的 inline handler 没有端点级测试（纯函数测了、路由没测）。
 * 这里补上：assets/usage、assets/size-report、assets/project-stats、maintenance/integrity、
 * maintenance/archive、renders/overview、diagnostics、subtitles/export|import、timelines/estimate|preflight。
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { GenerationRegistry } from '../src/workbench/cancel.ts'
import { WorkflowRunner } from '../src/workbench/runner.ts'
import { RenderRegistry } from '../src/media/render-registry.ts'
import { RenderService } from '../src/media/render.ts'

async function harness() {
  const dataDir = await mkdtemp(join(tmpdir(), 'dsh-cov-rpc-'))
  const outputsDir = await mkdtemp(join(tmpdir(), 'dsh-cov-out-'))
  await writeFile(join(outputsDir, 'clip.mp4'), 'mp4')
  const store = new WorkbenchStore({ directory: dataDir, now: () => new Date('2026-10-20T00:00:00.000Z') })
  const registry = new GenerationRegistry()
  let runSequence = 0
  const runner = new WorkflowRunner({
    store,
    newRunId: () => `run-${++runSequence}`,
    generateImage: { async execute() { return { localPath: join(outputsDir, 'shot.png'), bytes: 10 } } },
    generateVideo: { async execute() { return { videoPath: join(outputsDir, 'clip.mp4'), bytes: 20 } } },
  })
  const renders = new RenderRegistry({
    render: new RenderService({ outputsDir }),
    registerAsset: async job => {
      if (job.outputPath === undefined) return
      await store.attachAsset({ projectId: job.projectId, path: job.outputPath, kind: 'video', bytes: job.bytes })
    },
  })
  const handler = createWorkbenchHandler({
    provider: 'threerouter', outputsDir, store, registry, runner, renders,
    defaults: () => ({
      mediaMode: 'image', imageProvider: 'threerouter', imageSize: '1024*1024', imageStyle: null,
      videoProvider: 'threerouter', videoAspectRatio: '16:9', videoDuration: 5,
    }),
  })
  async function ok<T>(endpoint: string, payload?: unknown): Promise<T> {
    const result = await handler(endpoint, payload, new AbortController().signal, {} as never)
    if (!result.ok) throw new Error(`refused: ${result.error.code} ${result.error.message}`)
    return result.value as T
  }
  const project = await store.createProject('覆盖测试')
  return { handler, ok, store, outputsDir, project }
}

describe('new endpoint coverage (A136)', () => {
  it('serves diagnostics, archive, overview and project stats', async () => {
    const { ok, store } = await harness()
    const diagnostics = await ok<{ logFiles: unknown[] }>('diagnostics', {})
    expect(Array.isArray(diagnostics.logFiles)).toBe(true)

    const archive = await ok<{ dryRun: boolean; archivedTasks: number }>('maintenance/archive', {})
    expect(archive.dryRun).toBe(true)

    const overview = await ok<{ overview: { running: { count: number }; recentItems: unknown[] } }>('renders/overview', {})
    expect(overview.overview.running.count).toBe(0)
    expect(overview.overview.recentItems).toEqual([])

    const integrity = await ok<{ integrity: { healthy: boolean } }>('maintenance/integrity', {})
    expect(integrity.integrity.healthy).toBe(true)
    void store
  })

  it('serves asset usage, size report and project stats', async () => {
    const { ok, store, project } = await harness()
    await store.attachAsset({ projectId: project.id, path: 'outputs/clip.mp4', kind: 'video', bytes: 100 })
    const usage = await ok<{ summary: { total: number; unused: number } }>('assets/usage', {})
    expect(usage.summary.total).toBe(1)
    expect(usage.summary.unused).toBe(1)

    const size = await ok<{ size: { count: number; top: unknown[] } }>('assets/size-report', { topN: 5 })
    expect(size.size.count).toBe(1)

    const stats = await ok<{ stats: { projects: Array<{ projectId: string; bytes: number }> } }>('assets/project-stats', {})
    expect(stats.stats.projects.some(row => row.projectId === project.id && row.bytes === 100)).toBe(true)
  })

  it('serves subtitle export/import and timeline estimate/preflight', async () => {
    const { ok, store, project } = await harness()
    const saved = await store.saveTimeline({
      projectId: project.id,
      tracks: [
        { id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: 'outputs/clip.mp4', startMs: 0, durationMs: 2000 }] },
        { id: 's1', kind: 'subtitle', clips: [{ id: 's1c', text: '你好', startMs: 0, durationMs: 800 }] },
      ],
    })
    const exported = await ok<{ text: string; cues: number }>('subtitles/export', { timelineId: saved.id })
    expect(exported.cues).toBe(1)
    expect(exported.text).toContain('00:00:00,000 --> 00:00:00,800')

    const imported = await ok<{ imported: number }>('subtitles/import', {
      timelineId: saved.id,
      srt: '1\n00:00:01,000 --> 00:00:02,000\n导入一句\n',
    })
    expect(imported.imported).toBe(1)

    const estimate = await ok<{ estimate: { durationMs: number; estimatedBytes: number } }>('timelines/estimate', { timelineId: saved.id })
    expect(estimate.estimate.durationMs).toBeGreaterThan(0)
    expect(estimate.estimate.estimatedBytes).toBeGreaterThan(0)

    const preflight = await ok<{ summaryLine: string; ok: boolean }>('timelines/preflight', { timelineId: saved.id })
    expect(preflight.summaryLine.length).toBeGreaterThan(0)
  })

  it('bulk-registers outputs and imports external files (A152)', async () => {
    const { ok, outputsDir, project } = await harness()

    // 批量登记（一次调用多条的路径）
    const bulk = await ok<{ created: number; assets: Array<{ path: string }> }>('assets/attach-many', {
      projectId: project.id,
      items: [{ path: join(outputsDir, 'clip.mp4'), kind: 'video', bytes: 3 }],
    })
    expect(bulk.created).toBe(1)
    expect(bulk.assets[0]?.path).toBe(join(outputsDir, 'clip.mp4'))

    // 外部文件导入：复制进 outputs 才能走 /outputs 预览
    const sourceDir = await mkdtemp(join(tmpdir(), 'dsh-import-'))
    const source = join(sourceDir, 'outside.png')
    await writeFile(source, 'png-bytes')
    await writeFile(join(sourceDir, 'notes.txt'), 'text') // 存在但扩展名不支持 → 应被跳过并说明原因
    const imported = await ok<{ imported: number; assets: Array<{ path: string }>; skipped: Array<{ path: string; reason: string }> }>(
      'media/import',
      { projectId: project.id, paths: [source, join(sourceDir, 'missing.png'), join(sourceDir, 'notes.txt')] },
    )
    expect(imported.imported).toBe(1)
    expect(imported.assets[0]?.path.startsWith(outputsDir)).toBe(true)
    expect(imported.skipped.length).toBe(2)
    expect(imported.skipped.some(entry => entry.reason.includes('不支持的扩展名'))).toBe(true)
  })

  it('keeps a reference image on resources (A153)', async () => {
    const { ok, project } = await harness()
    const created = await ok<{ resource: { id: string; assetPath?: string } }>('resources/create', {
      projectId: project.id, kind: 'role', name: '小雨', assetPath: '/tmp/outputs/ref.png',
    })
    expect(created.resource.assetPath).toBe('/tmp/outputs/ref.png')

    // 只改名字/备注时，参考图要保留
    const renamed = await ok<{ resource: { name: string; assetPath?: string } }>('resources/update', {
      id: created.resource.id, name: '小雨（红衣）', note: '女主角',
    })
    expect(renamed.resource.name).toBe('小雨（红衣）')
    expect(renamed.resource.assetPath).toBe('/tmp/outputs/ref.png')

    // 显式 null 才清除
    const cleared = await ok<{ resource: { assetPath?: string } }>('resources/update', {
      id: created.resource.id, assetPath: null,
    })
    expect(cleared.resource.assetPath).toBeUndefined()
  })

  it('removes assets in bulk (A-2)', async () => {
    const { ok, project, outputsDir } = await harness()
    const attached = await ok<{ asset: { id: string } }>('assets/attach', { projectId: project.id, path: join(outputsDir, 'clip.mp4'), kind: 'video' })
    const bulk = await ok<{ removed: number; skipped: Array<{ id: string }> }>('assets/remove-many', { ids: [attached.asset.id, 'ast-missing'], force: true })
    expect(bulk.removed).toBe(1)
    expect(bulk.skipped.length).toBe(1)
  })

  it('stores multiple reference images on a resource (A-3)', async () => {
    const { ok, project } = await harness()
    const created = await ok<{ resource: { id: string; assetPaths?: string[] } }>('resources/create', {
      projectId: project.id, kind: 'role', name: '小雨', assetPaths: ['/o/a.png', '/o/b.png'],
    })
    expect(created.resource.assetPaths).toEqual(['/o/a.png', '/o/b.png'])
    const cleared = await ok<{ resource: { assetPaths?: string[] } }>('resources/update', { id: created.resource.id, assetPaths: null })
    expect(cleared.resource.assetPaths).toBeUndefined()
  })

  it('splits and copies clips over RPC (A-9)', async () => {
    const { ok, store, project, outputsDir } = await harness()
    const saved = await store.saveTimeline({
      projectId: project.id,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: join(outputsDir, 'clip.mp4'), startMs: 0, durationMs: 2000 }] }],
    })
    const split = await ok<{ timeline: { tracks: Array<{ clips: Array<{ id: string; durationMs: number }> }> }; leftId: string; rightId: string }>(
      'timelines/split-clip', { timelineId: saved.id, clipId: 'c1', atMs: 800 },
    )
    expect(split.timeline.tracks[0]!.clips.length).toBe(2)
    expect(split.leftId).toBe('c1')
    expect(split.rightId).not.toBe('c1')

    const copied = await ok<{ timeline: { tracks: Array<{ clips: unknown[] }> } }>(
      'timelines/copy-clip', { timelineId: saved.id, clipId: split.rightId },
    )
    expect(copied.timeline.tracks[0]!.clips.length).toBe(3)
  })

  it('refuses to compose without a generation adapter instead of faking success (A-4)', async () => {
    const { handler, project } = await harness()
    const result = await handler('media/compose', { projectId: project.id, prompt: '小雨在雨夜街头', resourceIds: [] }, new AbortController().signal)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('生成能力未装配')
    }
  })

  it('saves/lists/removes prompts and refuses extraction without a vision adapter (A-5)', async () => {
    const { ok, handler } = await harness()
    const saved = await ok<{ prompt: { id: string; name: string } }>('prompts/save', { name: '雨夜', text: '雨夜霓虹街头，电影感' })
    expect(saved.prompt.name).toBe('雨夜')
    expect((await ok<{ prompts: unknown[] }>('prompts/list')).prompts.length).toBe(1)
    expect((await ok<{ removed: boolean }>('prompts/remove', { id: saved.prompt.id })).removed).toBe(true)

    const refused = await handler('prompts/extract', { path: '/tmp/whatever.png' }, new AbortController().signal, {} as never)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.error.message).toContain('视觉模型适配器')
  })
})
