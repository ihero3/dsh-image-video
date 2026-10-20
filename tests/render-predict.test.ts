/**
 * 导出耗时预测（Track A / A98）。
 */
import { describe, expect, it } from 'vitest'
import { bucketKey, formatDuration, normalizedCost, pixelsPerSecond, predictRenderMs, targetFromFormat } from '../src/media/render-predict.ts'

const sample = (renderMs: number, durationMs: number, width: number, height: number, frameRate: number) =>
  ({ renderMs, durationMs, width, height, frameRate })

describe('render time prediction (A98)', () => {
  it('scales the prediction with output duration and pixel rate', () => {
    const target1080 = { durationMs: 60_000, width: 1920, height: 1080, frameRate: 30 }
    const target4k = { durationMs: 60_000, width: 3840, height: 2160, frameRate: 60 }
    const samples = [sample(60_000, 60_000, 1920, 1080, 30)] // 1080p30 实时
    const short = predictRenderMs({ ...target1080, durationMs: 30_000 }, samples)
    const long = predictRenderMs(target1080, samples)
    const big = predictRenderMs(target4k, samples)
    expect(long).toBeGreaterThan(short)
    expect(big).toBeGreaterThan(long * 3) // 4 倍像素率
    // 10% 安全系数：实时样本 → 预测略大于成片时长
    expect(long).toBeGreaterThan(60_000)
  })

  it('falls back to a conservative factor without history', () => {
    const predicted = predictRenderMs({ durationMs: 60_000, width: 1920, height: 1080, frameRate: 30 }, [])
    expect(predicted).toBeGreaterThanOrEqual(48_000) // 0.8 倍
    expect(predicted).toBeLessThanOrEqual(60_000)
    // 4K 无历史时也按像素折算
    const big = predictRenderMs({ durationMs: 60_000, width: 3840, height: 2160, frameRate: 30 }, [])
    expect(big).toBeGreaterThan(predicted * 3)
  })

  it('normalises cost per pixel-second and formats durations', () => {
    const cost = normalizedCost(sample(60_000, 60_000, 1920, 1080, 30))
    expect(cost).toBeCloseTo(1 / (1920 * 1080 * 30), 12)
    expect(formatDuration(135_000)).toBe('2 分 15 秒')
    expect(formatDuration(48_000)).toBe('48 秒')
  })
})

describe('render sample bucketing (A102)', () => {
  it('keys buckets by resolution and frame-rate tiers', () => {
    expect(bucketKey(1920, 1080, 30)).toBe('1080@30')
    expect(bucketKey(1080, 1920, 30)).toBe('1080@30') // 竖屏同档
    expect(bucketKey(3840, 2160, 60)).toBe('2160+@60')
    expect(bucketKey(1280, 720, 24)).toBe('720@24')
    expect(bucketKey(1080, 1080, 25)).toBe('1080@24')
  })

  it('prefers same-bucket samples so 4K slowness does not inflate 1080p predictions', () => {
    // 1080p 样本：实时（0.5×）；4K 样本：慢 4 倍
    const samples = [
      sample(30_000, 60_000, 1920, 1080, 30),
      sample(20_000, 60_000, 1920, 1080, 30),
      sample(240_000, 60_000, 3840, 2160, 30),
      sample(200_000, 60_000, 3840, 2160, 30),
    ]
    const small = predictRenderMs({ durationMs: 60_000, width: 1920, height: 1080, frameRate: 30 }, samples)
    const big = predictRenderMs({ durationMs: 60_000, width: 3840, height: 2160, frameRate: 30 }, samples)
    // 1080p 预测应接近它自己的样本（约 20-30s），不被 4K 的 200s+ 拉高
    expect(small).toBeLessThan(60_000)
    // 4K 预测应反映它自己的慢样本
    expect(big).toBeGreaterThan(150_000)
  })
})

describe('targetFromFormat (A98 helper)', () => {
  it('fills defaults and normalizes a partial format', () => {
    expect(targetFromFormat(5000, undefined)).toEqual({ durationMs: 5000, width: 1280, height: 720, frameRate: 30 })
    expect(targetFromFormat(5000, { width: 1080, height: 1920 })).toMatchObject({ width: 1080, height: 1920, frameRate: 30 })
  })
})

describe('pixelsPerSecond (A98 helper)', () => {
  it('never returns zero (guards divide-by-zero in cost maths)', () => {
    expect(pixelsPerSecond(1920, 1080, 30)).toBe(1920 * 1080 * 30)
    expect(pixelsPerSecond(0, 0, 0)).toBe(1)
  })
})
