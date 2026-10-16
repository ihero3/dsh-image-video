/**
 * 体积门禁（`T7-1`）：预算 = 首次基线 +20%，超了必须报出超支明细。
 */
import { describe, expect, it } from 'vitest'
// 纯 ESM 小工具：直接引用构建时用的同一份实现，避免门禁与测试各算一套
import { BUNDLE_BASELINE, BUNDLE_BUDGET, evaluateBundleSize } from '../scripts/bundle-budget.mjs'

describe('bundle budget (T7-1)', () => {
  it('sets the budget to baseline + 20%', () => {
    expect(BUNDLE_BUDGET.raw).toBe(Math.round(BUNDLE_BASELINE.raw * 1.2))
    expect(BUNDLE_BUDGET.gzip).toBe(Math.round(BUNDLE_BASELINE.gzip * 1.2))
  })

  it('passes at baseline and fails with a breakdown once over budget', () => {
    const atBaseline = evaluateBundleSize({ ...BUNDLE_BASELINE })
    expect(atBaseline.ok).toBe(true)
    expect(atBaseline.usedPercent.raw).toBe(83)

    const over = evaluateBundleSize({ raw: BUNDLE_BUDGET.raw + 1, gzip: BUNDLE_BUDGET.gzip + 2 })
    expect(over.ok).toBe(false)
    expect(over.over.join(' ')).toMatch(/raw .*超 1 B/)
    expect(over.over.join(' ')).toMatch(/gzip .*超 2 B/)
  })
})
