/**
 * planned 能力的"防伪造"测试（`T3-3`）。
 *
 * 口径（`R-BND-4`）：`planned` 节点**不执行、不静默跳过、不伪造成功**。图里只要出现
 * planned 节点，执行侧必须直接拒绝整次运行——否则用户会以为"跑过了"，而实际上什么
 * 都没做（或更糟：被标成成功）。
 */
import { describe, expect, it, vi } from 'vitest'
import { WorkflowRunner, type GenerationTool } from '../src/workbench/runner.ts'
import type { WorkbenchStore } from '../src/workbench/store.ts'
import { validateWorkflow, type WorkflowEdge, type WorkflowNode, type WorkflowRunRecord } from '../src/workbench/workflow.ts'

/** 节点工场。 */
function node(id: string, kind: WorkflowNode['kind'], params: Record<string, string | number | boolean> = {}): WorkflowNode {
  return { id, kind, position: { x: 0, y: 0 }, params }
}

/** 连线工场。 */
function edge(source: string, target: string): WorkflowEdge {
  return { id: `${source}->${target}`, source, target }
}

/** 内存 store。 */
function fakeStore() {
  const runs: WorkflowRunRecord[] = []
  const store = {
    async recordRun(run: WorkflowRunRecord) { runs.push(run); return run },
    async updateRun(id: string, patch: Partial<WorkflowRunRecord>) {
      const index = runs.findIndex(run => run.id === id)
      if (index < 0) return undefined
      runs[index] = { ...runs[index]!, ...patch }
      return runs[index]
    },
  } as unknown as WorkbenchStore
  return { store, latest: () => runs[runs.length - 1] }
}

/** 计数的生成工具。 */
function countingTool(calls: string[]): GenerationTool {
  return { async execute() { calls.push('call'); return { videoPath: '/tmp/out/clip.mp4' } } }
}

describe('planned capabilities cannot pretend to succeed (T3-3)', () => {
  it('flags every planned kind in validation', () => {
    for (const kind of ['lip-sync', 'face-swap', 'voice-synthesize'] as const) {
      const result = validateWorkflow([node('p', kind)], [])
      expect(result.ok).toBe(false)
      expect(result.issues.map(issue => issue.code)).toContain('not-runnable')
      expect(result.issues[0]?.nodeId).toBe('p')
      expect(result.issues[0]?.message).toMatch(/planned/)
    }
  })

  it('refuses the whole run instead of executing or silently skipping', async () => {
    const calls: string[] = []
    const { store, latest } = fakeStore()
    const runner = new WorkflowRunner({
      store, newRunId: () => 'run-planned',
      generateImage: countingTool(calls), generateVideo: countingTool(calls),
    })
    const run = await runner.begin({
      schemaVersion: 1, id: 'wfl-1', projectId: 'prj-1', name: '含 planned',
      nodes: [node('gen', 'video-generate', { prompt: '正常节点' }), node('lip', 'lip-sync')],
      edges: [edge('gen', 'lip')],
      createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z',
    })

    expect(run.status).toBe('failed')
    expect(run.error).toMatch(/planned/)
    // 关键：一个外部调用都没发出去，也没有任何节点被标成成功
    expect(calls).toHaveLength(0)
    expect(run.nodeRuns.every(item => item.status !== 'succeeded')).toBe(true)
    expect(run.nodeRuns.find(item => item.nodeId === 'lip')).toMatchObject({ status: 'skipped' })
    expect(run.nodeRuns.find(item => item.nodeId === 'lip')?.error).toMatch(/validation/)

    // 重试同样拒绝（不会因为"重试"而把 planned 放过去）
    const retried = await runner.retry(run)
    expect(retried.status).toBe('failed')
    expect(calls).toHaveLength(0)
    await vi.waitFor(() => { expect(latest().status).toBe('failed') })
  })

  it('still runs a graph that only uses runnable nodes', async () => {
    const calls: string[] = []
    const { store, latest } = fakeStore()
    const runner = new WorkflowRunner({
      store, newRunId: () => 'run-ok',
      generateImage: countingTool(calls), generateVideo: countingTool(calls),
    })
    await runner.begin({
      schemaVersion: 1, id: 'wfl-2', projectId: 'prj-1', name: '纯可运行',
      nodes: [node('v', 'video-generate', { prompt: '正常节点' })], edges: [],
      createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z',
    })
    await vi.waitFor(() => { expect(latest().status).toBe('succeeded') })
    expect(calls).toHaveLength(1)
  })
})
