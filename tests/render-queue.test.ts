/**
 * 渲染队列与并发控制（Track A / A4）：
 * 并发上限内的立刻跑，超出的**排队**（queued + queuePosition，仅加法字段不破坏客户端）；
 * 槽位释放后按 FIFO 拉起下一个；排队中的任务可以直接取消。
 */
import { describe, expect, it, vi } from 'vitest'
import { RenderRegistry } from '../src/media/render-registry.ts'
import type { RenderService, RenderResult } from '../src/media/render.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

/** 可手动放行的假渲染服务。 */
function controllableService() {
  const gates: Array<{ resolve: (result: RenderResult) => void; reject: (error: Error) => void }> = []
  const service = {
    render: () => new Promise<RenderResult>((resolve, reject) => { gates.push({ resolve, reject }) }),
  } as unknown as RenderService
  return { service, gates }
}

function timeline(id: string, projectId = 'prj-1'): TimelineRecord {
  return {
    schemaVersion: 1, id, projectId, name: id, frameRate: 30, burnSubtitles: false,
    tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }] }],
    createdAt: '', updatedAt: '',
  }
}

const done = (name: string): RenderResult => ({ outputPath: `/tmp/${name}.mp4`, bytes: 10, durationMs: 1000 })
const flush = async (): Promise<void> => { await new Promise(resolve => { setTimeout(resolve, 0) }) }

describe('render queue fairness (A108)', () => {
  it('round-robins between projects at the same priority instead of starving one', async () => {
    const { service, gates } = controllableService()
    const registry = new RenderRegistry({ render: service, maxConcurrent: 1 })
    const a1 = registry.start(timeline('a1', 'prj-a')) // 占住唯一槽位
    const a2 = registry.start(timeline('a2', 'prj-a'))
    const a3 = registry.start(timeline('a3', 'prj-a'))
    const b1 = registry.start(timeline('b1', 'prj-b'))
    // A 连提 3 个、B 提 1 个。a2 早已在队（rank 0 且更早），b1 紧随其后 → 顺序 [a2, b1, a3]
    // 关键：B 的任务排在 A 的第 3 个之前，不会被 A 的三连发饿死。
    expect(registry.get(a2.id)?.queuePosition).toBe(1)
    expect(registry.get(b1.id)?.queuePosition).toBe(2)
    expect(registry.get(a3.id)?.queuePosition).toBe(3)
    void a1
    void gates
  })
})

describe('render queue (A4)', () => {
  it('queues beyond the concurrency limit and promotes FIFO when a slot frees', async () => {
    const { service, gates } = controllableService()
    const registry = new RenderRegistry({ render: service, maxConcurrent: 1 })

    const first = registry.start(timeline('t1'))
    const second = registry.start(timeline('t2'))
    expect(first.queued ?? false).toBe(false)
    expect(second.queued).toBe(true)
    expect(second.queuePosition).toBe(1)
    // 只有第一个真的开跑了
    await flush()
    expect(gates).toHaveLength(1)

    gates[0]!.resolve(done('t1'))
    await flush()
    await flush()
    // 第二个被拉起
    expect(gates).toHaveLength(2)
    expect(registry.get(second.id)).toMatchObject({ queued: false })
    gates[1]!.resolve(done('t2'))
    await flush()
    expect(registry.get(first.id)?.status).toBe('succeeded')
    expect(registry.get(second.id)?.status).toBe('succeeded')
  })

  it('cancels a queued job without touching the running one', async () => {
    const { service, gates } = controllableService()
    const registry = new RenderRegistry({ render: service, maxConcurrent: 1 })
    const running = registry.start(timeline('t1'))
    const queued = registry.start(timeline('t2'))
    expect(registry.cancel(queued.id)).toBe(true)
    expect(registry.get(queued.id)).toMatchObject({ status: 'cancelled', queued: false })
    expect(registry.get(running.id)?.status).toBe('running')
    // 跑完后队列里没有东西了（不会去启动被取消的那个）
    gates[0]!.resolve(done('t1'))
    await flush()
    await flush()
    expect(gates).toHaveLength(1)
    expect(registry.cancel('nope')).toBe(false)
  })

  it('runs up to maxConcurrent immediately when the limit is higher', async () => {
    const { service, gates } = controllableService()
    const registry = new RenderRegistry({ render: service, maxConcurrent: 2 })
    const a = registry.start(timeline('t1'))
    const b = registry.start(timeline('t2'))
    expect(a.queued ?? false).toBe(false)
    expect(b.queued ?? false).toBe(false)
    await flush()
    expect(gates).toHaveLength(2)
    gates[0]!.resolve(done('t1'))
    gates[1]!.resolve(done('t2'))
    await flush()
    expect(registry.list('prj-1')).toHaveLength(2)
  })

  it('clamps queue positions when a queued job is cancelled', async () => {
    const { service, gates } = controllableService()
    const registry = new RenderRegistry({ render: service, maxConcurrent: 1 })
    const running = registry.start(timeline('t1'))
    const second = registry.start(timeline('t2'))
    const third = registry.start(timeline('t3'))
    expect(second.queuePosition).toBe(1)
    expect(third.queuePosition).toBe(2)
    registry.cancel(second.id)
    expect(registry.get(third.id)?.queuePosition).toBe(1)
    gates[0]!.resolve(done('t1'))
    await flush()
    await flush()
    expect(gates).toHaveLength(2)
    void running
  })

  it('reports duration percentiles and outcome counts (A21)', async () => {
    const { service, gates } = controllableService()
    const registry = new RenderRegistry({ render: service, maxConcurrent: 2 })
    expect(registry.stats()).toEqual({ finished: 0, failed: 0, cancelled: 0 })
    const first = registry.start(timeline('t1'))
    const second = registry.start(timeline('t2'))
    await flush()
    gates[0]!.resolve(done('t1'))
    gates[1]!.reject(new Error('boom'))
    await flush()
    await flush()
    const stats = registry.stats()
    expect(stats.finished).toBe(1)
    expect(stats.failed).toBe(1)
    expect(stats.durationMs?.p50).toBeGreaterThanOrEqual(0)
    expect(stats.durationMs?.p90).toBeGreaterThanOrEqual(stats.durationMs?.p50 ?? 0)
    void first
    void second
  })

  it('runs higher priority jobs first but keeps FIFO within the same priority (A50)', async () => {
    const { service, gates } = controllableService()
    const registry = new RenderRegistry({ render: service, maxConcurrent: 1 })
    const first = registry.start(timeline('t1'))                       // 占住槽位
    const low = registry.start(timeline('t2'), { priority: 0 })        // 最低
    const high = registry.start(timeline('t3'), { priority: 5 })       // 最高
    const mid = registry.start(timeline('t4'), { priority: 1 })        // 中间
    // 队列位置按优先级排：high=1, mid=2, low=3
    expect(registry.get(high.id)?.queuePosition).toBe(1)
    expect(registry.get(mid.id)?.queuePosition).toBe(2)
    expect(registry.get(low.id)?.queuePosition).toBe(3)

    await flush()
    expect(gates).toHaveLength(1) // 只有 first 在跑
    // 共 4 个任务：每 resolve 一个就拉起下一个（gates 下标即启动顺序）
    for (let index = 0; index < 4; index += 1) {
      await vi.waitFor(() => { expect(gates.length).toBeGreaterThan(index) }, { timeout: 5000 })
      gates[index]!.resolve(done(`t${index}`))
      await flush()
    }
    // 启动顺序：first → high(5) → mid(1) → low(0)
    expect(gates).toHaveLength(4)
    void first
    // 收尾：全部成功
    for (const job of [first, low, high, mid]) {
      expect(registry.get(job.id)?.status).toBe('succeeded')
    }
  })

  it('keeps FIFO for equal priorities (A50)', async () => {
    const { service, gates } = controllableService()
    const registry = new RenderRegistry({ render: service, maxConcurrent: 1 })
    registry.start(timeline('t1'))
    const a = registry.start(timeline('a'), { priority: 3 })
    const b = registry.start(timeline('b'), { priority: 3 })
    expect(registry.get(a.id)?.queuePosition).toBe(1)
    expect(registry.get(b.id)?.queuePosition).toBe(2)
    await flush()
    gates[0]!.resolve(done('t1'))
    await flush()
    await flush()
    expect(gates).toHaveLength(2)
    expect(registry.get(a.id)?.queued).toBe(false) // a 先被拉起
    expect(registry.get(b.id)?.queued).toBe(true)
  })

  it('logs queue events so operators can see saturation', async () => {
    const entries: Array<Record<string, unknown>> = []
    const { service } = controllableService()
    const registry = new RenderRegistry({ render: service, maxConcurrent: 1, log: entry => { entries.push(entry) } })
    registry.start(timeline('t1'))
    registry.start(timeline('t2'))
    expect(entries.some(entry => entry.event === 'render-queued' && entry.position === 1)).toBe(true)
    void vi
  })
})
