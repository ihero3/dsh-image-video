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

function timeline(id: string): TimelineRecord {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', name: id, frameRate: 30, burnSubtitles: false,
    tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }] }],
    createdAt: '', updatedAt: '',
  }
}

const done = (name: string): RenderResult => ({ outputPath: `/tmp/${name}.mp4`, bytes: 10, durationMs: 1000 })
const flush = async (): Promise<void> => { await new Promise(resolve => { setTimeout(resolve, 0) }) }

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
