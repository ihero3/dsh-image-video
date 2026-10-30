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
 * 2026-10-25 **wave 3 抬基线**：B-15/B-16/B-17 界面（分镜工坊/导出历史/发布前收尾）与
 *   P0-1/P0-2 的客户端端点让入口 +7.9 KB、总量 +68 KB —— 属功能增长，不是打包失控；
 *   入口 44,780 → 54,600，总量 837,920 → 905,920。
 * 2026-10-23 **A-6 修订**：入口拆成注册壳、界面（含 React Flow）进包内 chunk →
 *   入口 44,780 / 15,010，总量 837,920 / 181,780。**总量没变**（同一个库，只是改成按需下载），
 *   但初始加载从 834 KB 降到 45 KB；且不再依赖宿主平台词（装到任何 DSH 都有画布）。
 */
/**
 * 入口基线（`T1`/`T2` 后从 54_600 抬到 55_000，+0.7%）。理由：
 * 入口必须注册**完整** i18n 字典——`ctx.locale.register(NS, {zh,en})` 把 `t` 绑在入口的
 * ctx 上，再通过 props 传给工作台；而 locale 服务对「同一 NS 同一 locale」重复注册是**抛错**的
 * （`already has locale`），所以无法"入口只注册 tab 标题、其余等 chunk 加载再补"。
 * 于是 T1/T2 新增的 5 个文案 key 会同时出现在入口与 chunk（~14.7 KB 中文文案已在入口，
 * 占 22%）。真正的解法是让 locale 服务支持增量注册或把 i18n 下沉，属后续专项；
 * 本次按约定抬基线并记账。实测入口 65,643 B / 预算 66,000 B。
 */
export const BUNDLE_BASELINE = Object.freeze({ raw: 55_000, gzip: 18_100 })
export const BUNDLE_TOTAL_BASELINE = Object.freeze({ raw: 905_920, gzip: 194_780 })
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
