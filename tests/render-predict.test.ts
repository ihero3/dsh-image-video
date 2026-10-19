/**
 * 导出耗时预测（Track A / A98）。
 */
import { describe, expect, it } from 'vitest'
import { formatDuration, normalizedCost, predictRenderMs } from '../src/media/render-predict.ts'

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
