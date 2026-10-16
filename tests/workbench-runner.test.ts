/**
 * `WorkflowRunner`（`T4-4`）。
 *
 * 重点是三条承诺：按拓扑顺序跑、**不伪造成功**（没有执行器的节点记 skipped）、
 * **重试只重跑失败节点及其下游**（前序成功节点不再调外部 API）。
 */
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_NODE_ATTEMPTS, WorkflowRunner, isTransientFailure, selectRunNodes, topologicalOrder, type GenerationTool,
} from '../src/workbench/runner.ts'
import type { WorkbenchStore } from '../src/workbench/store.ts'
import type { NodeParamValue, WorkflowEdge, WorkflowNode, WorkflowNodeKind, WorkflowRecord, WorkflowRunRecord } from '../src/workbench/workflow.ts'

/** 节点工场。 */
function node(id: string, kind: WorkflowNodeKind, params: Record<string, NodeParamValue> = {}): WorkflowNode {
  return { id, kind, position: { x: 0, y: 0 }, params }
}

/** 连线工场。 */
function edge(source: string, target: string): WorkflowEdge {
  return { id: `${source}->${target}`, source, target }
}

/** 流程文档工场。 */
function workflow(nodes: WorkflowNode[], edges: WorkflowEdge[] = []): WorkflowRecord {
  return {
    schemaVersion: 1, id: 'wfl-1', projectId: 'prj-1', name: '测试', nodes, edges,
    createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z',
  }
}

/** 内存 store：只实现运行器用到的那几个方法。 */
function fakeStore() {
  const runs: WorkflowRunRecord[] = []
  const store = {
    async recordRun(run: WorkflowRunRecord) { runs.push(run); return run },
    async lookupNodeCache() { return undefined },
    async rememberNodeCache() { /* 测试替身不落缓存 */ },
    async updateRun(id: string, patch: Partial<WorkflowRunRecord>) {
      const index = runs.findIndex(run => run.id === id)
      if (index < 0) return undefined
      runs[index] = { ...runs[index]!, ...patch }
      return runs[index]
    },
  } as unknown as WorkbenchStore
  return { store, runs, latest: () => runs[runs.length - 1] }
}

/** 记录调用的假工具。 */
function tool(result: unknown, calls: Array<{ args: Record<string, unknown>; signal?: AbortSignal }>): GenerationTool {
  return {
    async execute(args, exec) {
      calls.push({ args: args as Record<string, unknown>, signal: (exec as { signal?: AbortSignal }).signal })
      return result
    },
  }
}

describe('workflow run ordering helpers', () => {
  it('orders nodes topologically and falls back to input order on a cycle', () => {
    const nodes = [node('b', 'script', { text: 'x' }), node('a', 'script', { text: 'y' })]
    expect(topologicalOrder(nodes, [edge('a', 'b')]).map(item => item.id)).toEqual(['a', 'b'])
    expect(topologicalOrder(nodes, [edge('a', 'b'), edge('b', 'a')]).map(item => item.id)).toEqual(['b', 'a'])
  })

  it('selects the retry closure (failed node plus everything downstream)', () => {
    const nodes = [node('a', 'preview'), node('b', 'preview'), node('c', 'preview'), node('d', 'preview')]
    const edges = [edge('a', 'b'), edge('b', 'c')]
    expect([...selectRunNodes(nodes, edges, ['b'])].sort()).toEqual(['b', 'c'])
    expect(selectRunNodes(nodes, edges).size).toBe(4)
  })
})

describe('WorkflowRunner', () => {
  it('runs a chain in order, feeds upstream text into the prompt and records artifacts', async () => {
    const imageCalls: Array<{ args: Record<string, unknown> }> = []
    const videoCalls: Array<{ args: Record<string, unknown> }> = []
    const { store, latest } = fakeStore()
    const runner = new WorkflowRunner({
      store,
      newRunId: () => 'run-1',
      now: () => new Date('2026-10-15T00:00:00.000Z'),
      generateImage: tool({ localPath: '/tmp/out/shot.png', bytes: 2048 }, imageCalls),
      generateVideo: tool({ videoPath: '/tmp/out/clip.mp4', bytes: 4096 }, videoCalls),
    })

    const run = await runner.begin(workflow(
      [node('s', 'script', { text: '开场白' }), node('i', 'image-generate', { prompt: '一只猫', ratio: '3:4' }),
        node('v', 'video-generate', { prompt: '让猫动起来', duration: 6 })],
      [edge('s', 'i'), edge('i', 'v')],
    ))
    await vi.waitFor(() => { expect(latest().status).toBe('succeeded') })

    expect(run.id).toBe('run-1')
    expect(imageCalls[0]?.args).toMatchObject({ size: '3:4' })
    expect(String(imageCalls[0]?.args.prompt)).toContain('开场白')
    // 首帧来自上游产物（图 → 视频）
    expect(videoCalls[0]?.args).toMatchObject({ duration: 6, image: '/tmp/out/shot.png' })
    const nodeRuns = latest().nodeRuns
    expect(nodeRuns.find(item => item.nodeId === 'i')).toMatchObject({ status: 'succeeded', outputPath: '/tmp/out/shot.png', bytes: 2048 })
    // 数据节点没有执行器：如实记 skipped，不伪造成功
    expect(nodeRuns.find(item => item.nodeId === 's')).toMatchObject({ status: 'skipped' })
    expect(nodeRuns.find(item => item.nodeId === 's')?.error).toMatch(/no executor/)
  })

  it('reports a node as running while it executes', async () => {
    const states: string[] = []
    let release: (() => void) | undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    const { store, runs, latest } = fakeStore()
    const blocking: GenerationTool = {
      async execute() { await gate; return { localPath: '/tmp/out/shot.png' } },
    }
    const runner = new WorkflowRunner({
      store, newRunId: () => 'run-live',
      generateImage: blocking, generateVideo: tool({}, []),
    })
    await runner.begin(workflow([node('i', 'image-generate', { prompt: '猫' })]))
    // 执行期间运行记录里该节点应是 running（界面据此显示进度）
    await vi.waitFor(() => {
      const record = runs.find(candidate => candidate.id === 'run-live')
      states.push(record?.nodeRuns[0]?.status ?? 'missing')
      expect(record?.nodeRuns[0]?.status).toBe('running')
    }, { timeout: 3000 })
    release?.()
    await vi.waitFor(() => { expect(latest().status).toBe('succeeded') })
    expect(states).toContain('running')
  })

  it('omits blank model-specific parameters instead of sending them', async () => {
    const videoCalls: Array<{ args: Record<string, unknown> }> = []
    const { store } = fakeStore()
    const runner = new WorkflowRunner({
      store, newRunId: () => 'run-args',
      generateImage: tool({}, []), generateVideo: tool({ videoPath: '/tmp/out/clip.mp4' }, videoCalls),
    })
    await runner.begin(workflow([node('v', 'video-generate', { prompt: '齿轮', resolution: '' })]))
    await vi.waitFor(() => { expect(videoCalls).toHaveLength(1) })
    // 现场踩过：给模型发它不支持的 720P 会 400，所以留空必须"不发"
    expect(videoCalls[0]?.args).not.toHaveProperty('resolution')
    expect(videoCalls[0]?.args).not.toHaveProperty('model')

    const explicit: Array<{ args: Record<string, unknown> }> = []
    const second = new WorkflowRunner({
      store, newRunId: () => 'run-args-2',
      generateImage: tool({}, []), generateVideo: tool({ videoPath: '/tmp/out/clip.mp4' }, explicit),
    })
    await second.begin(workflow([node('v', 'video-generate', { prompt: '齿轮', resolution: '768P', model: 'x-model' })]))
    await vi.waitFor(() => { expect(explicit).toHaveLength(1) })
    expect(explicit[0]?.args).toMatchObject({ resolution: '768P', model: 'x-model' })
  })

  it('refuses to start when the graph fails validation', async () => {
    const imageCalls: Array<{ args: Record<string, unknown> }> = []
    const { store } = fakeStore()
    const runner = new WorkflowRunner({
      store, newRunId: () => 'run-bad',
      generateImage: tool({ localPath: '/tmp/x.png' }, imageCalls),
      generateVideo: tool({}, []),
    })
    const run = await runner.begin(workflow([node('i', 'image-generate', { prompt: '' })]))
    expect(run.status).toBe('failed')
    expect(run.error).toMatch(/required/)
    expect(imageCalls).toHaveLength(0)
  })

  it('stops at the first failure and marks the downstream as blocked', async () => {
    const { store, latest } = fakeStore()
    const failing: GenerationTool = { async execute() { throw new Error('provider said no') } }
    const runner = new WorkflowRunner({
      store, newRunId: () => 'run-fail',
      generateImage: tool({ localPath: '/tmp/out/shot.png' }, []),
      generateVideo: failing,
    })
    await runner.begin(workflow(
      [node('i', 'image-generate', { prompt: '猫' }), node('v', 'video-generate', { prompt: '动' })],
      [edge('i', 'v')],
    ))
    await vi.waitFor(() => { expect(latest().status).toBe('failed') })
    const nodeRuns = latest().nodeRuns
    expect(nodeRuns.find(item => item.nodeId === 'v')).toMatchObject({ status: 'failed', error: 'provider said no' })
  })

  it('retries only the failed node and its downstream, never re-calling the succeeded upstream', async () => {
    const imageCalls: Array<{ args: Record<string, unknown> }> = []
    let videoAttempts = 0
    const { store, latest } = fakeStore()
    const video: GenerationTool = {
      async execute() {
        videoAttempts += 1
        if (videoAttempts === 1) throw new Error('transient failure')
        return { videoPath: '/tmp/out/clip.mp4', bytes: 1024 }
      },
    }
    const runner = new WorkflowRunner({
      store, newRunId: (() => { let n = 0; return () => `run-${++n}` })(),
      now: () => new Date('2026-10-15T00:00:00.000Z'),
      generateImage: tool({ localPath: '/tmp/out/shot.png', bytes: 10 }, imageCalls),
      generateVideo: video,
    })
    await runner.begin(workflow(
      [node('i', 'image-generate', { prompt: '猫' }), node('v', 'video-generate', { prompt: '动' }),
        node('v2', 'video-generate', { prompt: '再动' })],
      [edge('i', 'v'), edge('v', 'v2')],
    ))
    await vi.waitFor(() => { expect(latest().status).toBe('failed') })
    expect(imageCalls).toHaveLength(1)
    const first = latest()

    await runner.retry(first)
    await vi.waitFor(() => { expect(latest().status).toBe('succeeded') })
    // 关键验收：前序成功节点没有再次调用外部生成
    expect(imageCalls).toHaveLength(1)
    expect(videoAttempts).toBe(3) // 第一次失败 + 重试时 v、v2 各一次
    expect(latest().startedAt).toBeDefined()
  })

  it('retries transient upstream failures (at least three attempts) but not deterministic ones', async () => {
    expect(DEFAULT_NODE_ATTEMPTS).toBeGreaterThanOrEqual(3)
    expect(isTransientFailure('Upstream response stream was interrupted')).toBe(true)
    expect(isTransientFailure('HTTP 503 upstream unavailable')).toBe(true)
    expect(isTransientFailure('generate_video 任务报错（HTTP 400）：resolution not supported')).toBe(false)
    expect(isTransientFailure('任务已被取消')).toBe(false)

    const attempts: string[] = []
    let call = 0
    const flaky: GenerationTool = {
      async execute() {
        call += 1
        attempts.push(`call-${call}`)
        if (call < 3) throw new Error('Upstream response stream was interrupted')
        return { videoPath: '/tmp/out/clip.mp4', bytes: 2048 }
      },
    }
    const { store, latest } = fakeStore()
    const runner = new WorkflowRunner({
      store, newRunId: () => 'run-flaky', retryDelayMs: 1,
      generateImage: tool({}, []), generateVideo: flaky,
    })
    await runner.begin(workflow([node('v', 'video-generate', { prompt: '齿轮' })]))
    await vi.waitFor(() => { expect(latest().status).toBe('succeeded') })
    expect(attempts).toHaveLength(3)
    expect(latest().nodeRuns[0]).toMatchObject({ status: 'succeeded', attempts: 3 })

    // 确定性失败不重试
    const hardCalls: string[] = []
    const hard: GenerationTool = {
      async execute() { hardCalls.push('x'); throw new Error('HTTP 400 bad request: prompt rejected') },
    }
    const second = new WorkflowRunner({ store, newRunId: () => 'run-hard', retryDelayMs: 1, generateImage: tool({}, []), generateVideo: hard })
    await second.begin(workflow([node('v', 'video-generate', { prompt: '齿轮' })]))
    await vi.waitFor(() => { expect(latest().status).toBe('failed') })
    expect(hardCalls).toHaveLength(1)
    expect(latest().nodeRuns[0]?.attempts).toBe(1)
  })

  it('cancels a running node and records the run as cancelled', async () => {
    const { store, latest } = fakeStore()
    let started: (() => void) | undefined
    const startedPromise = new Promise<void>(resolve => { started = resolve })
    const waiting: GenerationTool = {
      async execute(_args, exec) {
        const signal = (exec as { signal?: AbortSignal }).signal
        started?.()
        await new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => { reject(new Error('task cancelled')) }, { once: true })
        })
        return {}
      },
    }
    const runner = new WorkflowRunner({
      store, newRunId: () => 'run-cancel',
      generateImage: waiting, generateVideo: tool({}, []),
    })
    await runner.begin(workflow([node('i', 'image-generate', { prompt: '猫' })]))
    await startedPromise
    expect(runner.cancel('run-cancel')).toBe(true)
    await vi.waitFor(() => { expect(latest().status).toBe('cancelled') })
    expect(latest().nodeRuns[0]).toMatchObject({ status: 'cancelled' })
    expect(runner.cancel('missing')).toBe(false)
  })
})
