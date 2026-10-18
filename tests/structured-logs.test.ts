/**
 * 结构化日志（`T7-3`）：生成 / 工作流节点 / 导出三类事件各一条，字段能串起来
 * （taskId、runId/nodeId、renderId，加服务商、模型、耗时、状态）。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { withTaskLedger } from '../src/workbench/ledger.ts'
import { GenerationRegistry } from '../src/workbench/cancel.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { WorkflowRunner, type GenerationTool } from '../src/workbench/runner.ts'
import { RenderRegistry } from '../src/media/render-registry.ts'
import type { RenderService } from '../src/media/render.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })

async function store(): Promise<WorkbenchStore> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-logs-'))
  dirs.push(directory)
  return new WorkbenchStore({ directory })
}

describe('structured logs (T7-3)', () => {
  it('logs one generation event carrying taskId, provider, model, duration and status', async () => {
    const workbench = await store()
    const entries: Array<Record<string, unknown>> = []
    const tool = {
      name: 'generate_video',
      // 服务商/模型由工具的返回值带出来（账本与日志都用这份 outcome）
      execute: async () => ({ provider: 'threerouter', model: 'minimax-h3', prompt: '齿轮', videoPath: '/tmp/out/clip.mp4', bytes: 100 }),
    }
    const wrapped = withTaskLedger(tool as never, {
      store: workbench, registry: new GenerationRegistry(), kind: 'video',
      log: entry => { entries.push(entry) },
    }) as unknown as { execute: (args: unknown, exec: unknown) => Promise<unknown> }

    await wrapped.execute({ prompt: '齿轮', model: 'minimax-h3' }, { signal: undefined })
    expect(entries).toHaveLength(1)
    const entry = entries[0]!
    expect(entry).toMatchObject({ event: 'generation', kind: 'video', status: 'succeeded', provider: 'threerouter', model: 'minimax-h3' })
    expect(typeof entry.taskId).toBe('string')
    expect(entry.durationMs).toBeGreaterThanOrEqual(0)
    // 账本把各种路径键归一成 outputPath
    expect(entry.outputPath).toBe('/tmp/out/clip.mp4')
  })

  it('logs one workflow-node event per executed node with runId', async () => {
    const workbench = await store()
    const entries: Array<Record<string, unknown>> = []
    const runner = new WorkflowRunner({
      store: workbench, newRunId: () => 'run-1', log: entry => { entries.push(entry) },
      generateImage: { async execute() { return { localPath: '/tmp/out/shot.png' } } } as GenerationTool,
      generateVideo: { async execute() { return { videoPath: '/tmp/out/clip.mp4' } } } as GenerationTool,
      retryDelayMs: 1,
    })
    await runner.begin({
      schemaVersion: 1, id: 'wfl-1', projectId: 'prj-1', name: '图', edges: [],
      nodes: [{ id: 'v', kind: 'video-generate', position: { x: 0, y: 0 }, params: { prompt: '齿轮' } }],
      createdAt: '', updatedAt: '',
    })
    await new Promise(resolve => { setTimeout(resolve, 120) })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      event: 'workflow-node', runId: 'run-1', nodeId: 'v', kind: 'video-generate', status: 'succeeded', attempt: 1,
    })
    expect(entries[0]!.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('logs one render event with renderId and output path', async () => {
    const entries: Array<Record<string, unknown>> = []
    const fakeService = {
      async render() { return { outputPath: '/tmp/outputs/movie.mp4', bytes: 4096, durationMs: 3000 } },
    } as unknown as RenderService
    const registry = new RenderRegistry({ render: fakeService, log: entry => { entries.push(entry) } })
    const timeline: TimelineRecord = {
      schemaVersion: 1, id: 'tml-1', projectId: 'prj-1', name: '成片', frameRate: 30, burnSubtitles: true,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 3000 }] }],
      createdAt: '', updatedAt: '',
    }
    const job = registry.start(timeline)
    await new Promise(resolve => { setTimeout(resolve, 100) })
    const started = entries.filter(entry => entry.event === 'render')
    expect(started).toHaveLength(1)
    expect(started[0]).toMatchObject({
      event: 'render', renderId: job.id, timelineId: 'tml-1', status: 'succeeded', outputPath: '/tmp/outputs/movie.mp4',
    })
    // `A21`：完成后另有一条 render-finished（带实际耗时），供诊断统计
    const finished = entries.find(entry => entry.event === 'render-finished')
    expect(finished).toMatchObject({ renderId: job.id })
    expect(typeof finished?.durationMs).toBe('number')
  })
})
