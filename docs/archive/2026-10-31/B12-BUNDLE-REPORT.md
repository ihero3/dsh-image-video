# B12 客户端产物体积报告（T7-1）

> 地盘：Track B（界面）。本任务按任务书为 **report only**：只测量并汇报体积数值，**不提交 `lib/`**，瘦身决策交给 A。
> 测量时间：2026-10-19，构建命令：`node node_modules/tsdown/dist/run.mjs`（产物 `lib/client/plugin.js`）。

## 1. 实测量（本次构建）

| 口径 | 基线（首次可发布） | 预算（+20%） | **实测** | 占预算 |
|------|------------------|-------------|----------|--------|
| raw  | 548,282 B        | 657,938 B   | **682,873 B** | **104%** |
| gzip | 121,161 B        | 145,393 B   | **152,407 B** | **105%** |

- 相对预算：raw 超 **24,935 B**，gzip 超 **7,014 B**。
- 相对首次基线：raw +134,591 B（+24.6%）。
- 相对任务书目标 **≤85%**：raw 目标 ≤ 559,247 B（实测超 123,626 B），gzip 目标 ≤ 123,584 B（实测超 28,823 B）。

**结论：未达 ≤85% 目标，且当前已越过 +20% 预算红线（gate 第 4 步会因此变红）。**

> 备注：任务书写的「当前占预算 96%」与本次实测 104% 不一致——基线（548,282 B）是 2026-10-16 首次构建值，期间 B6 导出面板、B7 响应式等子任务新增了少量 UI/CSS，且原估计可能偏乐观。以本次实测 104% 为准。

## 2. 体积构成（构建器自报的依赖）

`tsdown` 构建日志列出的被内联依赖（即 `alwaysBundle` 的部分）：

```
classcat
d3-dispatch / d3-selection / d3-drag / d3-color / d3-interpolate
d3-timer / d3-transition / d3-ease / d3-zoom
@xyflow/system / @xyflow/react
use-sync-external-store / zustand
```

`@xyflow/react`（React Flow）是画布（B4/B5）的核心依赖，它本身拉入整套 `d3-*` 与 `zustand`。**这些是被内联体积的主体**，而非 Track B 新增的业务代码（导出面板 / 响应式样式只是几 KB 增量）。

## 3. 任务书三档瘦身杠杆的逐一评估

| 杠杆 | 适用性 | 评估 |
|------|--------|------|
| **图标按需** | **不适用** | 已扫描 `src/client`：无任何图标库（`lucide` / `@heroicons` / `react-icons` / `antd` / `iconify` 等）导入。包内无图标集，无从按需。零可省。 |
| **减少重复样式** | **无安全收益** | `workbench-style.ts` 503 行、202 个规则块、4 个 `@media`。表面上「重复」的选择器（如 `.iv-node-run` 出现 8 次）实为状态/后代**复合选择器**（`.iv-node-run:hover`、`.iv-node-run .iv-icon` 等），删除即破坏交互样式。去重几乎无收益（<1%）。 |
| **避免整包内联** | **越界** | 要砍掉主体体积，只能把 `@xyflow/react` + `d3-*` 从 `alwaysBundle` 移入 `neverBundle`，改由宿主经 `window.__ModuleLoader__.require` 提供。这等于改 `tsdown.config.ts` + 调整客户端模块加载契约 + 同步 `package.json` 的 `dsh.client.external`——属于 A 的「构建 / 加载策略 / 改 package.json」范畴，且任务书明确「你不能做：改 package.json/lock、提交 lib」。 |

## 4. 结论与给 A 的建议

- **在 Track B「report only」范围内，≤85% 无法实现。** 唯一能动主体的杠杆（外部化 React Flow/d3）越界到 A 的构建/加载策略。
- 因此 gate 第 4 步 `pnpm run check:bundle` 目前 **RED**（超预算），这是预期内信号，应如实上报，不要绕过。
- 建议 A 三选一（按推荐度）：
  1. **重定基线**：把 `scripts/bundle-budget.mjs` 的 `BUNDLE_BASELINE` 抬到本次实测值，并在 `CHANGELOG.md` 写明「画布引入 React Flow + d3 使体积上升，属功能必需」——`check-bundle` 的错误信息本身即给出此路径。
  2. **外部化 + 由宿主供给**：将 `@xyflow/react`、`d3-*` 移入 `neverBundle`，宿主在客户端模块加载器里按 `dsh.client.external` 提供；预计可砍掉 ~400–500 KB raw，能把初始包打到接近目标。代价是改加载契约，需回归验证。
  3. **懒加载画布**：初始包只含非画布 UI，React Flow 在首次进入画布时按需加载——同样需改加载策略，但风险更可控。

## 5. Track B 已交付（与体积无关）

- B1–B10、B13 全部实现并通过客户端测试（49 项通过，typecheck 干净，构建 `Build complete`）。
- 仅在本地 `lib/` 自测，**未提交 `lib/`**（已确认 `git` 暂存区不纳入 `lib/`）。
