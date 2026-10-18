/**
 * 节点级超时与重试策略化（Track A / A5）：
 * 工具不听话（不理会取消信号）时节点也必须按时结束；超时按"瞬时失败"重试；
 * 重试次数与退避可配；默认超时按节点种类给（图像 3 分钟 / 视频 15 分钟）。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_NODE_TIMEOUT_MS, WorkflowRunner, isTransientFailure, type GenerationTool,
} from '../src/workbench/runner.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import type { WorkflowRunRecord } from '../src/workbench/workflow.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function store(): Promise<WorkbenchStore> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-timeout-'))
  dirs.push(directory)
  return new WorkbenchStore({ directory })
}
const graph = () => ({
  schemaVersion: 1 as const, id: 'wfl-t', projectId: 'prj-1', name: '超时图', edges: [] as never[],
  nodes: [{ id: 'v', kind: 'video-generate' as const, position: { x: 0, y: 0 }, params: { prompt: '齿轮' } }],
  createdAt: '', updatedAt: '',
})

describe('node timeout & retry policy (A5)', () => {
  it('times out a hanging tool and reports an actionable message', async () => {
    const workbench = await store()
    // 这个工具完全不看 abort 信号：必须靠超时护栏兜住
    const hanging: GenerationTool = { execute: () => new Promise(() => undefined) }
    const runner = new WorkflowRunner({
      store: workbench, newRunId: () => 'run-timeout',
      generateImage: hanging, generateVideo: hanging,
      nodeAttempts: 2, nodeTimeoutMs: () => 40, retryBackoffMs: () => 0,
    })
    const started = Date.now()
    await runner.begin(graph())
    await vi.waitFor(async () => {
      expect((await workbench.listRuns('prj-1'))[0]?.status).toBe('failed')
    }, { timeout: 5000 })
    const run = (await workbench.listRuns('prj-1'))[0] as WorkflowRunRecord
    expect(run.nodeRuns[0]?.attempts).toBe(2)
    expect(run.nodeRuns[0]?.error).toMatch(/超时/)
    // 两次超时 + 零退避 → 应该在几百毫秒内结束，而不是一直挂着
    expect(Date.now() - started).toBeLessThan(3000)
  }, 20_000)

  it('retries after a timeout and succeeds on the next attempt', async () => {
    const workbench = await store()
    let calls = 0
    const flaky: GenerationTool = {
      execute: () => {
        calls += 1
        if (calls === 1) return new Promise(() => undefined) // 第一次挂住
        return Promise.resolve({ videoPath: '/tmp/out/clip.mp4', bytes: 10 })
      },
    }
    const runner = new WorkflowRunner({
      store: workbench, newRunId: () => 'run-retry',
      generateImage: flaky, generateVideo: flaky,
      nodeAttempts: 3, nodeTimeoutMs: () => 40, retryBackoffMs: () => 0,
    })
    await runner.begin(graph())
    await vi.waitFor(async () => {
      expect((await workbench.listRuns('prj-1'))[0]?.status).toBe('succeeded')
    }, { timeout: 5000 })
    const run = (await workbench.listRuns('prj-1'))[0] as WorkflowRunRecord
    expect(run.nodeRuns[0]).toMatchObject({ status: 'succeeded', attempts: 2, outputPath: '/tmp/out/clip.mp4' })
    expect(calls).toBe(2)
  }, 20_000)

  it('ships sensible per-kind defaults and treats 超时 as transient', () => {
    expect(DEFAULT_NODE_TIMEOUT_MS['video-generate']).toBe(900_000)
    expect(DEFAULT_NODE_TIMEOUT_MS['image-generate']).toBe(180_000)
    expect(isTransientFailure('节点执行超时（900s）：上游没有在时限内返回')).toBe(true)
    expect(isTransientFailure('节点执行超时')).toBe(true)
    expect(isTransientFailure('HTTP 400 bad request')).toBe(false)
  })
})
