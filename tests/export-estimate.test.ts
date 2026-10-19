/**
 * 导出预估（Track A / A80）。
 */
import { describe, expect, it } from 'vitest'
import { describeAspect, estimateBitrateKbps, estimateExport, formatBytes } from '../src/workbench/estimate.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const timeline = (overrides: Partial<TimelineRecord> = {}): TimelineRecord => ({
  schemaVersion: 4, id: 'tml-est', projectId: 'prj-1', name: '预估', frameRate: 30, burnSubtitles: false,
  exportFormat: { width: 1920, height: 1080, frameRate: 30, bitrateKbps: 8000 },
  tracks: [
    { id: 'v1', kind: 'video', clips: [
      { id: 'a', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 60_000 },
      { id: 'b', assetPath: '/tmp/b.mp4', startMs: 60_000, durationMs: 60_000, speed: 2 },
    ] },
  ],
  createdAt: '', updatedAt: '',
  ...overrides,
})

describe('export estimate (A80)', () => {
  it('estimates a 2-minute 1080p export at roughly the configured bitrate', () => {
    const estimate = estimateExport(timeline())
    expect(estimate).toMatchObject({ width: 1920, height: 1080, frameRate: 30, bitrateKbps: 8000, aspect: '16:9', bitrateEstimated: false })
    // 90s（第二段 60s 按 2x 变 30s）× 8000kbps = 90 MB，加 2% 容器开销
    expect(estimate.durationMs).toBe(90_000)
    expect(estimate.estimatedBytes / 1024 ** 2).toBeGreaterThan(85)
    expect(estimate.estimatedBytes / 1024 ** 2).toBeLessThan(95)
  })

  it('can preview a different format (e.g. how big would 4K be)', () => {
    const estimate = estimateExport(timeline(), { width: 3840, height: 2160, frameRate: 60 })
    expect(estimate.aspect).toBe('16:9')
    expect(estimate.bitrateEstimated).toBe(true) // 覆盖后没有显式码率 → 用估算
    expect(estimate.bitrateKbps).toBeGreaterThan(20_000)
    // 4K60 的 90 秒明显大于 1080p30 的
    expect(estimate.estimatedBytes).toBeGreaterThan(estimateExport(timeline()).estimatedBytes * 2)
  })

  it('describes common and unusual aspect ratios', () => {
    expect(describeAspect(1920, 1080)).toBe('16:9')
    expect(describeAspect(1080, 1920)).toBe('9:16')
    expect(describeAspect(1080, 1080)).toBe('1:1')
    expect(describeAspect(1080, 1440)).toBe('3:4')
    expect(describeAspect(1000, 1000)).toBe('1:1')
    expect(describeAspect(500, 250)).toBe('2:1')
    expect(estimateBitrateKbps(1920, 1080, 30)).toBeGreaterThan(7000)
  })

  it('formats bytes for humans', () => {
    expect(formatBytes(2_400_000_000)).toBe('2.24 GB')
    expect(formatBytes(900_000_000)).toBe('858 MB')
    expect(formatBytes(2048)).toBe('2 KB')
  })
})
