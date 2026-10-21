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
  return { ok, store, outputsDir, project }
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
})
