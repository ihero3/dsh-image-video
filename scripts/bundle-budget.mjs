/**
 * 客户端产物体积预算（`T7-1`）。
 *
 * 口径：**阈值 = 首次可发布构建值 + 20%**，并把基线记进 `CHANGELOG.md`。
 * 超了就要么瘦身、要么在 CHANGELOG 里说明为什么值得抬预算——不能悄悄漂。
 */

/**
 * 基线（于 `lib/client/plugin.js` 实测）与 +20% 预算。
 *
 * 2026-10-16 首次可发布：raw 548,282 / gzip 121,161。
 * 2026-10-19 抬基线：同事 B 的 B1–B13 界面工作（达芬奇风格样式表、图标集、统一轮询/虚拟列表/
 * 错误边界/导出面板/a11y）带来真实增量 → raw 682,374 / gzip 151,212（+24%）。
 * 2026-10-22 抬基线：Track B Round 2/3 的新面板（融合生图 / 提示词库 / 素材体检 / 生成结果卡片 /
 * 时间轴逐段预览 / 打磨）＋ Track A 的 A-1/A-2/A-3/A-4/A-5/A-9 客户端契约 →
 * raw 834,204 / gzip 180,161（+22%）。同样是**功能性增长**：A-6（React Flow/d3 外置到宿主模块表）
 * 未落地前，客户端必须自包含这些画布依赖，无法在本插件内部减肥（方案见 docs/A6-BUNDLE-EXTERNALIZE.md）。
 */
export const BUNDLE_BASELINE = Object.freeze({ raw: 834_204, gzip: 180_161 })
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
