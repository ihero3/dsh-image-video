/**
 * 素材体积排行（Track A / A116）。
 */
import { describe, expect, it } from 'vitest'
import { sizeReport } from '../src/workbench/size-report.ts'

describe('sizeReport (A116)', () => {
  it('ranks by size and computes share and median', () => {
    const report = sizeReport([
      { path: 'huge.mp4', bytes: 800, unused: true },
      { path: 'mid.mp4', bytes: 150 },
      { path: 'small.mp4', bytes: 40 },
      { path: 'tiny.mp4', bytes: 10 },
      { path: 'zero.mp4', bytes: 0 }, // 无大小 → 忽略
    ], { topN: 2 })
    expect(report.count).toBe(4)
    expect(report.totalBytes).toBe(1000)
    expect(report.top.map(entry => entry.path)).toEqual(['huge.mp4', 'mid.mp4'])
    expect(report.topBytes).toBe(950)
    expect(report.topShare).toBe(0.95) // 前两名吃掉 95% 空间
    expect(report.medianBytes).toBe(150) // 排序后 10,40,150,800 → 取 index 2
    expect(report.top[0]?.unused).toBe(true)
  })

  it('handles empty libraries and missing sizes', () => {
    expect(sizeReport([])).toMatchObject({ totalBytes: 0, topShare: 0, count: 0, medianBytes: 0, top: [] })
    expect(sizeReport([{ path: 'x', bytes: undefined }]).count).toBe(0)
  })
})
