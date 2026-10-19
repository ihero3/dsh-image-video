/**
 * 渲染耗时按段统计（Track A / A57）：从进度采样归因出各段耗时，找最慢的段。
 */
import { describe, expect, it } from 'vitest'
import { computeSegmentTimings } from '../src/media/render-registry.ts'

describe('computeSegmentTimings (A57)', () => {
  it('attributes sampled time to the segment containing each interval start', () => {
    // 两段各 1000ms；采样：0%@0ms, 25%@1000ms, 50%@5000ms, 75%@6000ms, 100%@7000ms
    const result = computeSegmentTimings([1000, 2000], [
      { percent: 0, atMs: 0 },
      { percent: 25, atMs: 1000 },   // 0→25% 花 1000ms，起点在第 1 段
      { percent: 50, atMs: 5000 },   // 25→50% 花 4000ms，起点 500ms 仍在第 1 段
      { percent: 75, atMs: 6000 },   // 50→75% 花 1000ms，起点 1000ms 属第 1 段（边界归前段）
      { percent: 100, atMs: 7000 },  // 75→100% 花 1000ms，起点 1500ms 属第 2 段
    ])
    // 边界（50% 恰好 1000ms）按文档语义归给起点所在的前段 → 前段累计 1000+4000+1000
    expect(result.segmentTimingsMs).toEqual([6000, 1000])
    expect(result.slowestSegment).toEqual({ index: 1, ms: 6000 })
  })

  it('returns nothing without enough samples or bounds', () => {
    expect(computeSegmentTimings([1000], [])).toEqual({})
    expect(computeSegmentTimings([1000], [{ percent: 10, atMs: 0 }])).toEqual({})
    expect(computeSegmentTimings([], [{ percent: 0, atMs: 0 }, { percent: 100, atMs: 1000 }])).toEqual({})
    // 时间没有推进（同一毫秒的重复采样）→ 不给结论
    expect(computeSegmentTimings([1000], [
      { percent: 0, atMs: 500 }, { percent: 50, atMs: 500 },
    ])).toEqual({})
  })

  it('ignores duplicated or decreasing samples safely', () => {
    const result = computeSegmentTimings([500, 1000], [
      { percent: 0, atMs: 0 },
      { percent: 40, atMs: 800 },
      { percent: 40, atMs: 800 },   // 重复采样 → delta 0，跳过
      { percent: 60, atMs: 1500 },  // 起点 60% → 600ms，属第 2 段
      { percent: 100, atMs: 2500 },
    ])
    // 40% 起点 400ms 仍在第 1 段（≤500），60% 起点 600ms 才进第 2 段
    expect(result.segmentTimingsMs).toEqual([1500, 1000])
    expect(result.slowestSegment?.index).toBe(1)
  })
})
