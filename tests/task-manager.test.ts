/**
 * 生成任务轮询管理器（Track A / A138）——此前函数覆盖仅 20%，补关键路径。
 */
import { describe, expect, it } from 'vitest'
import { TaskManager } from '../src/task-manager.ts'
import type { Config } from '../src/config.ts'

const config = { pollIntervalMs: 1000, pollTimeoutMs: 4000 } as Config

/** 造一个最小 ctx：`effect` 立即执行并记住清理函数。 */
function fakeCtx() {
  let cleanup: (() => void) | undefined
  const ctx = { effect: (factory: () => (() => void)) => { cleanup = factory() } } as never
  return { ctx, dispose: () => cleanup?.() }
}

describe('TaskManager (A138)', () => {
  it('polls until the task succeeds and reports elapsed time', async () => {
    const { ctx } = fakeCtx()
    const manager = new TaskManager(ctx, config)
    let calls = 0
    const result = await manager.pollUntilDone('task-1', async () => {
      calls += 1
      return calls < 2 ? { status: 'pending' } as never : { status: 'succeeded', mediaUrl: 'https://cdn/x.mp4' } as never
    }, {} as never)
    expect(result.mediaUrl).toBe('https://cdn/x.mp4')
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
    expect(calls).toBe(2)
  }, 15_000)

  it('surfaces a failed task as a GenerationError', async () => {
    const { ctx } = fakeCtx()
    const manager = new TaskManager(ctx, config)
    await expect(manager.pollUntilDone('task-2', async () => ({ status: 'failed', error: '服务商内部错误' }) as never, {} as never))
      .rejects.toThrow(/服务商内部错误/)
  }, 15_000)

  it('honours an already-aborted external signal', async () => {
    const { ctx } = fakeCtx()
    const manager = new TaskManager(ctx, config)
    const controller = new AbortController()
    controller.abort()
    await expect(manager.pollUntilDone('task-3', async () => ({ status: 'pending' }) as never, {} as never, controller.signal))
      .rejects.toThrow(/取消|abort/i)
  }, 15_000)

  it('aborts in-flight polls when the plugin is disposed', async () => {
    const { ctx, dispose } = fakeCtx()
    const manager = new TaskManager(ctx, config)
    const pending = manager.pollUntilDone('task-4', async () => ({ status: 'pending' }) as never, {} as never)
    // 让第一次查询发生后再模拟卸载
    await new Promise(resolve => setTimeout(resolve, 50))
    dispose()
    await expect(pending).rejects.toThrow(/取消|abort/i)
  }, 15_000)
})
