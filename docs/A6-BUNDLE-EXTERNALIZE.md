# A-6 / B16：客户端束体积外置方案（2026-10-22 调研结论）

## 现状（实测）

| 指标 | 值 |
| --- | --- |
| `lib/client/plugin.js` | **746 KB（764,398 B）** |
| 基线（`BUNDLE_BASELINE` = 682,374 raw，允许 +20%）| 上限 818,849 B → 当前约 **93%** |
| 内联依赖（出现次数） | `d3-selection` 121 · `d3-transition` 54 · `xyflow` 40 · `d3-interpolate` 28 · `d3-zoom` 10 · `d3-drag` 10 · `d3-timer` 4 · `d3-color` 4 |

结论：体积由**画布必需的 React Flow + d3-\*** 主导 ✓（与 B 的审计一致）。`BUNDLE_BASELINE` 未出现在 `tests/client-bundle.test.ts` 里，需先定位真实来源。

## 为什么单靠客户端做不到 ≤80%

插件客户端契约要求 `lib/client/plugin.js` 是**自包含单文件**（`tests/client-bundle.test.ts` 限制 factory 只能 `require` 宿主模块表里的模块）。
代码分割/懒加载会被该契约拦下；因此**只有把大依赖变成"宿主提供的模块"**才能缩小本插件产物。

## 实施步骤（跨仓，需 Track A 做）

1. **定位宿主模块表**：`packages/client/modules/src/index.ts`（`MAX_COMBO_URL_BYTES` 所在文件）里维护的 `hostModules`/`require` 映射表。
2. **宿主侧提供**：把 `@xyflow/react` 与 `d3-*`（`d3-selection/drag/zoom/interpolate/transition/timer/ease/color`）加进宿主模块表，
   并确保宿主 bundle 里真的有一份（宿主已有 React，新增 React Flow 约 +150 KB 宿主束，但**一次**投入、所有插件共享）。
3. **插件构建外置**：给 `tsdown.config.ts` 的 client face 加 `external: ['@xyflow/react', /^d3-/]`，
   并在 `src/client/plugin.ts` 里按宿主模块表的名称 `require`（保持单文件契约）。
4. **更新契约测试**：`tests/client-bundle.test.ts` 允许上述模块；同步 `docs/API-SURFACE.md` / `FORK-FEATURES.md`。
5. **验收**：客户端束回落到 **≤ 80%** 基线（目标 ≤ 610 KB），五道门全绿；
   Harness 侧跑一次 `pnpm run build` + 真机确认画布可用（拖拽/缩放/连线）。
6. **回滚点**：外置只动构建与宿主模块表，回滚 = 去掉 `external` + 移除宿主模块表条目，两步。

## 风险

- 宿主模块表是**跨仓契约**：改错会让所有插件的 `require` 解析失败 → 必须先在 Harness 侧加模块、跑一次全量客户端构建再改插件。
- React Flow 在宿主里若被 tree-shake 掉，插件 `require` 会拿到空对象 → 宿主需显式 re-export 或标记 sideEffects。
