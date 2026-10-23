/**
 * 客户端产物体积预算（`T7-1`）。
 *
 * 口径：**阈值 = 首次可发布构建值 + 20%**，并把基线记进 `CHANGELOG.md`。
 * 超了就要么瘦身、要么在 CHANGELOG 里说明为什么值得抬预算——不能悄悄漂。
 */

/**
 * 体积口径（A-6 修订版：自包含 + 包内惰性 chunk）。
 *
 * 两个都要守，缺一不可：
 * - **入口 `lib/client/plugin.js`**：用户打开工作台之前就要下载的那份（现在只做注册，~45 KB）；
 * - **总产物**（入口 + `lib/client/client.*.js` 全部 chunk）：首屏 + 首次打开工作台的完整代价。
 *
 * 历史基线：
 * 2026-10-16 首次可发布 raw 548,282 / gzip 121,161；
 * 2026-10-19 B1–B13 界面工作 → 682,374 / 151,212；
 * 2026-10-22 A-7/A-8 生产线与分镜 → 834,204 / 180,161（这是"把 React Flow 内联进入口"时的值）；
 * 2026-10-23 **A-6 修订**：入口拆成注册壳、界面（含 React Flow）进包内 chunk →
 *   入口 44,780 / 15,010，总量 837,920 / 181,780。**总量没变**（同一个库，只是改成按需下载），
 *   但初始加载从 834 KB 降到 45 KB；且不再依赖宿主平台词（装到任何 DSH 都有画布）。
 */
export const BUNDLE_BASELINE = Object.freeze({ raw: 44_780, gzip: 15_010 })
export const BUNDLE_TOTAL_BASELINE = Object.freeze({ raw: 837_920, gzip: 181_780 })
export const BUNDLE_BUDGET = Object.freeze({
  raw: Math.round(BUNDLE_BASELINE.raw * 1.2),
  gzip: Math.round(BUNDLE_BASELINE.gzip * 1.2),
})
export const BUNDLE_TOTAL_BUDGET = Object.freeze({
  raw: Math.round(BUNDLE_TOTAL_BASELINE.raw * 1.2),
  gzip: Math.round(BUNDLE_TOTAL_BASELINE.gzip * 1.2),
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
