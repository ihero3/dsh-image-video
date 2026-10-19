/**
 * 进度细分（Track A / A41）：把全局百分比换算成"第 N 段 / 共 M 段"。
 * 长成片导出时，用户看到"第 3/12 段"比一个干巴巴的 27% 有用得多。
 */
import { describe, expect, it, vi } from 'vitest'
import { RenderRegistry, segmentStepAt } from '../src/media/render-registry.ts'
import type { RenderService } from '../src/media/render.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const timeline = (): TimelineRecord => ({
  schemaVersion: 3, id: 'tml-step', projectId: 'prj-1', name: '进度', frameRate: 30, burnSubtitles: false,
  tracks: [{
    id: 'v1', kind: 'video', clips: [
      { id: 'a', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 },
      { id: 'b', assetPath: '/tmp/b.mp4', startMs: 1000, durationMs: 1000 },
    ],
  }],
  createdAt: '', updatedAt: '',
})

describe('progressStep (A41)', () => {
  it('maps global percent onto the current segment', async () => {
    // 纯函数直接验换算（不依赖 registry 内部）
    expect(segmentStepAt([1000, 2000], 25)).toEqual({ current: 1, total: 2 })
    expect(segmentStepAt([1000, 2000], 60)).toEqual({ current: 2, total: 2 })
    expect(segmentStepAt([1000, 2000], 95)).toEqual({ current: 2, total: 2 })
    expect(segmentStepAt([1000, 2000], 100)).toEqual({ current: 2, total: 2 })
    expect(segmentStepAt([], 50)).toBeUndefined()

    const fakeService = {
      async render() { return { outputPath: '/tmp/outputs/x.mp4', bytes: 1024, durationMs: 2000 } },
    } as unknown as RenderService
    const registry = new RenderRegistry({ render: fakeService })
    const job = registry.start(timeline())
    await vi.waitFor(() => {
      expect(registry.get(job.id)?.status).toBe('succeeded')
    }, { timeout: 10_000 })
    // 从最终任务状态里回读不到历史进度 → 用进度回调期间的快照断言（fake 里同步调用，registry 立即 patch）
    // 集成侧：任务收尾后 percent=100 且能算计划时，progressStep 应是最后一段
    const final = registry.get(job.id)!
    expect(final.progressStep?.total).toBe(2) // 2 段各 1s
    expect(final.progressStep?.current).toBe(2)
  })

  it('omits the field when the plan cannot be computed', async () => {
    const fakeService = {
      async render() { return { outputPath: '/tmp/outputs/x.mp4', bytes: 1024, durationMs: 1000 } },
    } as unknown as RenderService
    const registry = new RenderRegistry({ render: fakeService })
    // 空视频轨 → planVideoSegments 抛错 → 不带 progressStep，但任务照常成功
    const empty: TimelineRecord = { ...timeline(), tracks: [{ id: 'v1', kind: 'video', clips: [] }] }
    const job = registry.start(empty)
    await vi.waitFor(() => { expect(registry.get(job.id)?.status).toBe('succeeded') }, { timeout: 10_000 })
    expect(registry.get(job.id)?.progressStep).toBeUndefined()
  })
})
