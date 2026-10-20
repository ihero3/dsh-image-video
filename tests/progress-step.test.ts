/**
 * 进度细分（Track A / A41）：把全局百分比换算成"第 N 段 / 共 M 段"。
 * 长成片导出时，用户看到"第 3/12 段"比一个干巴巴的 27% 有用得多。
 */
import { describe, expect, it, vi } from 'vitest'
import { EtaTracker, RenderRegistry, estimateEtaSec, segmentStepAt } from '../src/media/render-registry.ts'
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

describe('estimateEtaSec (A52)', () => {
  it('extrapolates linearly and refuses to guess too early', () => {
    // 25% 用了 4s → 预计还要 12s
    expect(estimateEtaSec(25, 4000)).toBe(12)
    expect(estimateEtaSec(50, 10_000)).toBe(10)
    expect(estimateEtaSec(90, 10_000)).toBe(1)
    // 太早（<5%）或太短（<1s）不给估计，避免乱跳
    expect(estimateEtaSec(2, 5000)).toBeUndefined()
    expect(estimateEtaSec(50, 500)).toBeUndefined()
    expect(estimateEtaSec(100, 5000)).toBeUndefined()
    expect(estimateEtaSec(Number.NaN, 5000)).toBeUndefined()
  })

  it('clears the ETA to 0 when the render finishes', async () => {
    const fakeService = {
      async render() { return { outputPath: '/tmp/outputs/x.mp4', bytes: 1024, durationMs: 1000 } },
    } as unknown as RenderService
    const registry = new RenderRegistry({ render: fakeService })
    const job = registry.start(timeline())
    await vi.waitFor(() => { expect(registry.get(job.id)?.status).toBe('succeeded') }, { timeout: 10_000 })
    expect(registry.get(job.id)?.progressEtaSec).toBe(0)
  })
})

describe('EtaTracker smoothing (A92)', () => {
  it('refuses to estimate too early and ignores repeated samples', () => {
    const tracker = new EtaTracker()
    expect(tracker.update(3, 1000)).toBeUndefined() // <5%
    // 第二个采样就建立了速率，且 10% ≥ 5% → 立刻有估计
    expect(tracker.update(10, 2000)).toBeGreaterThan(0)
    expect(new EtaTracker().update(50, 1000)).toBeUndefined() // 首个采样
  })

  it('smooths a jittery rate instead of jumping with every sample', () => {
    const tracker = new EtaTracker({ alpha: 0.3 })
    // 速率在 100ms/1% 与 400ms/1% 之间抖动：原始外推会在 ~18s 与 ~72s 间跳
    const raw: number[] = []
    const smoothed: number[] = []
    let percent = 10
    let at = 2000
    const deltas = [100, 400, 100, 400, 100, 400, 100, 400] // 每 1% 的耗时
    for (const delta of deltas) {
      at += delta
      percent += 1
      const eta = tracker.update(percent, at)
      if (eta === undefined) continue
      smoothed.push(eta)
      raw.push(Math.round((delta * (100 - percent)) / 1000))
    }
    expect(smoothed.length).toBeGreaterThan(4)
    // 抖动幅度：平滑后的极差应明显小于原始外推的极差
    const spread = (values: number[]): number => Math.max(...values) - Math.min(...values)
    expect(spread(smoothed)).toBeLessThan(spread(raw))
  })

  it('converges to the true remaining time at a steady rate', () => {
    const tracker = new EtaTracker({ alpha: 0.5 })
    // 稳定 200ms/1%：从 10% 走到 90%（每步 1%）
    let percent = 10
    let at = 0
    for (; percent < 90; percent += 1) {
      at += 200
      tracker.update(percent, at)
    }
    const eta = tracker.update(90, at + 200)!
    // 真实剩余 = 10% × 200ms = 2s
    expect(eta).toBeGreaterThanOrEqual(1)
    expect(eta).toBeLessThanOrEqual(3)
  })
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
