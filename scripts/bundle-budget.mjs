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
 * 入口基线（T0~T9 后从 54_600 抬到 58_000 / gzip 19_400）。理由：
 * 入口必须注册**完整** i18n 字典——`ctx.locale.register(NS, {zh,en})` 把 `t` 绑在入口的
 * ctx 上，再通过 props 传给工作台；而 locale 服务对「同一 NS 同一 locale」重复注册是**抛错**的
 * （`already has locale`），所以无法"入口只注册 tab 标题、其余等 chunk 加载再补"。
 * 于是每个新增文案 key 都会让入口长大（T0→T4：64,943 → 66,624 B，约 100 B/key）。
 * 入口现有 626 个 key、~15 KB 中文文案（22%），且**无一冗余**（全量扫描确认）。
 *
 * 抬到 58_000 是为覆盖 T5~T10 的剩余文案增长（每任务约 +0.5~1 KB），避免每步都改基线。
 * **2026-11-03 抬到 69_000 / 23_100**（快速创建页连续几轮加文案后顶到 100%），
 * 同日完成下面的根治方案（N5，「入口只注册壳文案、界面字典随 chunk 加载」）后**回落**到
 * **15_000 / 5_600**：入口实测 14,775 / 5,496（−79%），界面字典搬进 `client.Workbench.js`。
 * 从此入口不再随界面文案增长——新增界面文案只影响 chunk（总产物预算兜底）。
 *
 * **真正的解法（后续专项，`docs/快速创建.md` 四·L1 与 `docs/ROADMAP.md` §四 N5 有记录）**：
 * 入口只注册 tab 标题所需的 2 个 key（手写小对象），其余 key 用「延迟字典」占位，
 * 由 chunk 在加载时填充——时机上安全（Workbench 渲染前 chunk 必已加载）。
 * 这样入口能一次砍掉 ~15 KB（-23%）。因涉及 i18n 装配且要避开 locale 服务
 * `already has locale` 的限制，单独排期做，不混在布局重构里。
 *
 * **2026-11-11 抬基线（M0–M6 剧集重构 + 登录闭环）**：入口 15_000 → 23_000、gzip 5_600 → 7_800，
 * 总量 915_000 → 1_060_000、gzip 200_000 → 230_000。原因：
 * - 剧集/集/分段/分镜四层把本集工作区、提示词·分镜双 Tab、双 Skill 库带进 chunk（+约 150 KB）；
 * - `api.ts` 新增 30 余个端点（剧集、技能、提示词、导出），入口只多了方法名与参数转发（约 +1.2 KB），
 *   M0 之后入口已稳定在 22 KB 量级，15 KB 基线是 N5 刚落地时的值；
 * - 本轮登录闭环（`auth/*` 7 个端点 + 连接弹层）在入口只增加转发方法（约 +0.7 KB），弹层随 chunk 下载。
 * 实测 raw 1,245,041 / 270,640，按新基线占用 98.6% / 98.5%，与前一次抬基线的余量口径一致。
 */
export const BUNDLE_BASELINE = Object.freeze({ raw: 23_000, gzip: 7_800 })
// 2026-11-05 抬总产物基线（raw 905_920 → 915_000，gzip 194_780 → 200_000）：
// 这一轮按产品清单砍掉一批界面（三步引导 / 风控预检 / 花费提示 / 产出统计 / 严格模式），
// 但同时**新增**了「生成分镜可编辑」「生成画布」「就地生成」「视频生视频」「参考图缩略图预览」
// 这批功能，chunk 从 961 KB → 1,068 KB（+11%）。入口仍然稳定在 14.7 KB / 82%，
// 说明增长都在"首次打开工作台才下载"的 chunk 里；总产物实测 1,083,051 / 235,424，
// 按新基线占用 98.6% / 98.4%，留出约 1.5% 余量。
// 2026-11-11 随剧集重构一并抬到 1_060_000 / 230_000（理由见上）。
export const BUNDLE_TOTAL_BASELINE = Object.freeze({ raw: 1_060_000, gzip: 230_000 })
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
