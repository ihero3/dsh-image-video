/**
 * 客户端产物体积预算（`T7-1`）。
 *
 * 口径：**阈值 = 首次可发布构建值 + 20%**，并把基线记进 `CHANGELOG.md`。
 * 超了就要么瘦身、要么在 CHANGELOG 里说明为什么值得抬预算——不能悄悄漂。
 */

/** 首次基线（2026-10-16 于 `lib/client/plugin.js` 实测）与 +20% 预算。 */
export const BUNDLE_BASELINE = Object.freeze({ raw: 548_282, gzip: 121_161 })
export const BUNDLE_BUDGET = Object.freeze({
  raw: Math.round(BUNDLE_BASELINE.raw * 1.2),
  gzip: Math.round(BUNDLE_BASELINE.gzip * 1.2),
})

/**
 * 判断当前体积是否在预算内。
 * @param sizes - 实测体积。
 * @param budget - 预算（默认 {@link BUNDLE_BUDGET}）。
 * @returns 结论与超支明细。
 */
export function evaluateBundleSize(sizes, budget = BUNDLE_BUDGET) {
  const over = []
  if (sizes.raw > budget.raw) over.push(`raw ${sizes.raw} > ${budget.raw}（超 ${sizes.raw - budget.raw} B）`)
  if (sizes.gzip > budget.gzip) over.push(`gzip ${sizes.gzip} > ${budget.gzip}（超 ${sizes.gzip - budget.gzip} B）`)
  return {
    ok: over.length === 0,
    over,
    usedPercent: {
      raw: Math.round((sizes.raw / budget.raw) * 100),
      gzip: Math.round((sizes.gzip / budget.gzip) * 100),
    },
  }
}
