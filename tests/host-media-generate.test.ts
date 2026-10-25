/**
 * 工作台内直接生成 `media/generate`（Track A / A145）。
 *
 * 用假生成工具断言契约，**不调用真实生成**（不花钱）。
 */
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { GenerationRegistry } from '../src/workbench/cancel.ts'
import { WorkflowRunner } from '../src/workbench/runner.ts'
import { RenderRegistry } from '../src/media/render-registry.ts'
import { RenderService } from '../src/media/render.ts'
import type { GenerationTool } from '../src/workbench/runner.ts'

async function harness(options: { image?: GenerationTool; video?: GenerationTool } = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'dsh-gen-rpc-'))
  const outputsDir = await mkdtemp(join(tmpdir(), 'dsh-gen-out-'))
  const store = new WorkbenchStore({ directory: dataDir })
  const registry = new GenerationRegistry()
  const runner = new WorkflowRunner({
    store,
    newRunId: () => 'run-1',
    generateImage: { async execute() { return { localPath: join(outputsDir, 'x.png'), bytes: 1 } } },
    generateVideo: { async execute() { return { videoPath: join(outputsDir, 'x.mp4'), bytes: 1 } } },
  })
  const renders = new RenderRegistry({ render: new RenderService({ outputsDir }) })
  const handler = createWorkbenchHandler({
    provider: 'threevideo', outputsDir, store, registry, runner, renders,
    defaults: () => ({ mediaMode: 'image', imageProvider: 'threevideo', imageSize: '1024*1024', imageStyle: null, videoProvider: 'threevideo', videoAspectRatio: '16:9', videoDuration: 5 }),
    ...options.image === undefined && options.video === undefined ? {} : {
      generate: {
        image: options.image ?? ({ async execute() { throw new Error('no image tool') } }),
        video: options.video ?? ({ async execute() { throw new Error('no video tool') } }),
      },
    },
  })
  async function call(endpoint: string, payload?: unknown) {
    return handler(endpoint, payload, new AbortController().signal, {} as never)
  }
  async function ok<T>(endpoint: string, payload?: unknown): Promise<T> {
    const result = await call(endpoint, payload)
    if (!result.ok) throw new Error(`refused: ${result.error.code} ${result.error.message}`)
    return result.value as T
  }
  const project = await store.createProject('生成测试')
  return { ok, call, store, outputsDir, project }
}

describe('media/generate (A145)', () => {
  it('generates an image, files it as a project asset and records the task', async () => {
    const calls: unknown[] = []
    const { ok, store, outputsDir, project } = await harness({
      image: { async execute(args) { calls.push(args); return { localPath: join(outputsDir, 'gen.png'), bytes: 4096 } } },
    })
    const result = await ok<{ mediaMode: string; path: string; bytes: number; asset: { id: string; path: string }; taskId?: string }>(
      'media/generate', { mediaMode: 'image', prompt: '一只猫', size: '1024*1024', projectId: project.id },
    )
    expect(result.mediaMode).toBe('image')
    expect(result.path).toContain('gen.png')
    expect(result.bytes).toBe(4096)
    expect(result.asset.path).toBe(result.path)
    // 入参透传到工具（size 原样）
    expect(calls[0]).toMatchObject({ prompt: '一只猫', size: '1024*1024' })
    // 素材进了项目
    const { ok: ok2 } = { ok }
    const assets = await ok2<{ assets: Array<{ path: string }> }>('assets/list', { projectId: project.id })
    expect(assets.assets.some(asset => asset.path === result.path)).toBe(true)
    // 任务账本记录成功
    const tasks = await ok2<{ tasks: Array<{ status: string; kind: string; outputPath?: string }> }>('tasks/list', {})
    const done = tasks.tasks.find(task => task.status === 'succeeded' && task.outputPath === result.path)
    expect(done?.kind).toBe('image')
    void store
  })

  it('generates a video and passes video-specific params through', async () => {
    const calls: Array<Record<string, unknown>> = []
    const { ok, outputsDir } = await harness({
      video: { async execute(args) { calls.push(args as Record<string, unknown>); return { videoPath: join(outputsDir, 'gen.mp4'), bytes: 9000 } } },
    })
    const result = await ok<{ mediaMode: string; path: string }>('media/generate', {
      mediaMode: 'video', prompt: '海浪', duration: 6, aspectRatio: '9:16',
    })
    expect(result.mediaMode).toBe('video')
    expect(result.path).toContain('gen.mp4')
    expect(calls[0]).toMatchObject({ prompt: '海浪', duration: 6, aspectRatio: '9:16' })
  })

  it('forwards the video media[] sequence and realPerson flag (B-3 申请，A 认领)', async () => {
    const calls: Array<Record<string, unknown>> = []
    const { ok, outputsDir } = await harness({
      video: { async execute(args) { calls.push(args as Record<string, unknown>); return { videoPath: join(outputsDir, 'edited.mp4'), bytes: 2 } } },
    })
    await ok('media/generate', {
      mediaMode: 'video',
      prompt: '把背景换成雪夜街道，保留原片动作',
      duration: 5,
      media: [
        { image: 'last-frame.png', type: 'last_frame' },
        { video: 'source.mp4', type: 'reference_video' },
      ],
      realPerson: true,
    })
    // 原样透传给 generate_video：工具侧按 type/position 解释，宿主不该改写或丢字段
    expect(calls[0]).toMatchObject({
      prompt: '把背景换成雪夜街道，保留原片动作',
      media: [
        { image: 'last-frame.png', type: 'last_frame' },
        { video: 'source.mp4', type: 'reference_video' },
      ],
      realPerson: true,
    })
  })

  it('refuses clearly when no generation adapter is wired', async () => {
    const { call } = await harness()
    const result = await call('media/generate', { prompt: '随便' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('生成能力未装配')
  })

  it('surfaces a failed generation and marks the task failed', async () => {
    const { call, ok, project } = await harness({
      image: { async execute() { throw new Error('服务商 429 限流') } },
    })
    const result = await call('media/generate', { prompt: 'x', projectId: project.id })
    expect(result.ok).toBe(false)
    const tasks = await ok<{ tasks: Array<{ status: string; error?: string }> }>('tasks/list', {})
    expect(tasks.tasks.some(task => task.status === 'failed' && (task.error ?? '').includes('429'))).toBe(true)
  })
})

describe('media/generate cancellation (A146)', () => {
  it('can be cancelled from the workbench and lands as cancelled, not stuck running', async () => {
    let aborted = false
    const hanging: GenerationTool = {
      async execute(_args, exec) {
        const signal = (exec as { signal?: AbortSignal } | undefined)?.signal
        await new Promise<never>((_resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('超时（测试兜底）')), 5_000)
          signal?.addEventListener('abort', () => {
            aborted = true
            clearTimeout(timer)
            reject(new Error('aborted'))
          })
        })
        return { path: 'never.png' }
      },
    }
    const { call, ok, project } = await harness({ image: hanging })
    const pending = call('media/generate', { mediaMode: 'image', prompt: '慢图', projectId: project.id })
    // 等它登记成任务
    let taskId: string | undefined
    for (let attempt = 0; attempt < 40 && taskId === undefined; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 25))
      const tasks = await ok<{ tasks: Array<{ id: string; status: string }> }>('tasks/list', {})
      taskId = tasks.tasks.find(task => task.status === 'running')?.id
    }
    expect(taskId).toBeDefined()
    // 取消表里能看到它
    const running = await ok<{ running: Array<{ id: string; kind: string }> }>('tasks/running', {})
    expect(running.running.some(row => row.id === taskId && row.kind === 'image')).toBe(true)
    // 从工作台取消
    const cancelled = await ok<{ cancelled: boolean }>('tasks/cancel', { id: taskId })
    expect(cancelled.cancelled).toBe(true)
    const result = await pending
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('已取消')
    expect(aborted).toBe(true)
    // 任务落 cancelled（不是一直 running，也不是 failed）
    const after = await ok<{ tasks: Array<{ id: string; status: string }> }>('tasks/list', {})
    expect(after.tasks.find(task => task.id === taskId)?.status).toBe('cancelled')
    // 取消表已清理
    const runningAfter = await ok<{ running: Array<{ id: string }> }>('tasks/running', {})
    expect(runningAfter.running.some(row => row.id === taskId)).toBe(false)
  }, 20_000)
})

describe('media/generate non-blocking mode (A147)', () => {
  it('returns a taskId immediately and the result is pollable', async () => {
    const { call, ok, project, outputsDir } = await harness({
      image: {
        async execute() {
          await new Promise(resolve => setTimeout(resolve, 300))
          return { path: join(outputsDir, 'slow.png'), bytes: 777 }
        },
      },
    })
    const started = Date.now()
    const result = await call('media/generate', { mediaMode: 'image', prompt: '慢图', projectId: project.id, wait: false })
    const elapsed = Date.now() - started
    expect(result.ok).toBe(true)
    // 关键：不该等生成完成才返回
    expect(elapsed).toBeLessThan(250)
    if (!result.ok) return
    const value = result.value as { pending: boolean; taskId: string }
    expect(value.pending).toBe(true)
    expect(value.taskId.length).toBeGreaterThan(0)

    // 轮询到成功，并且素材已登记
    let status = ''
    for (let attempt = 0; attempt < 60 && status !== 'succeeded'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 25))
      const tasks = await ok<{ tasks: Array<{ id: string; status: string; outputPath?: string }> }>('tasks/list', {})
      const row = tasks.tasks.find(task => task.id === value.taskId)
      status = row?.status ?? ''
      if (status === 'succeeded') expect(row?.outputPath).toContain('slow.png')
    }
    expect(status).toBe('succeeded')
    const assets = await ok<{ assets: Array<{ path: string }> }>('assets/list', { projectId: project.id })
    expect(assets.assets.some(asset => asset.path.includes('slow.png'))).toBe(true)
  }, 20_000)

  it('refuses non-blocking without a project (result would be unqueryable)', async () => {
    const { call } = await harness({ image: { async execute() { return { path: '/tmp/x.png' } } } })
    const result = await call('media/generate', { prompt: 'x', wait: false })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('必须传 projectId')
  })
})
