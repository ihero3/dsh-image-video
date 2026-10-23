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

---

## 已落地（2026-10-22，v1.0.0-workbench-78）

实测结果与本文的估算一致（体积确由画布依赖主导），但**落点与本文第 1 步的猜测不同**，记录实际做法：

| 项 | 本文原计划 | 实际落地 |
| --- | --- | --- |
| 宿主模块表位置 | `packages/client/modules/src/index.ts` | `packages/client/web/src/platform.ts`（`PLATFORM_MODULES`）+ `src/seed.ts`（静态 import 与表项）——**这才是**壳真正 seed 给加载器的表，client/modules 只负责解析与路由 |
| 外置粒度 | `@xyflow/react` + 逐个 `d3-*` | 只外置 `@xyflow/react` 一个词。插件代码只 import 它，`@xyflow/system` 与 `d3-*` 作为它的传递依赖**随宿主侧一起打包**，无需在插件侧逐个列 |
| 插件构建 | `external: [...]` | `tsdown.config.ts` 的 `neverBundle` 加 `@xyflow/react`；`package.json` 加 `dsh.client.external: ["@xyflow/react"]` + `peerDependencies` |
| 契约测试 | 允许这些模块 | 三条断言：产物必须 `require("@xyflow/react")`、不得内联 React Flow、入口硬天花板 500 KB |

**实测（A-7/A-8/A-11 之后的真实基线）**：

| 口径 | 外置前（A-8 实测基线） | 外置后 | 变化 |
| --- | --- | --- | --- |
| raw | 834,204 B | **427,503 B** | −406,701 B（−48.8%） |
| gzip | 180,161 B | **89,329 B** | −90,832 B（−50.4%） |
| 占**旧**预算（1,001,045 / 216,193） | 83% | **43% / 41%** | ≤80% 目标达成 |
| 新基线（本版起） | — | 427,503 / 89,329 | 预算 = +20% = 513,004 / 107,195 |

**被否掉的替代方案（懒加载 chunk）**：插件内 `import()` 画布确实能把入口打到 ~192 KB，但入口与
chunk 的共享模块（样式表、图标）会被 rolldown 提升成共享 chunk，而加载器交给工厂的 `require`
是**同步模块表查找**——同步 `require` 取不到包内 chunk，整包会在 materialize 时抛错。要让
"入口静态依赖为空集"才能拆多 chunk，属加载器级重构，不在本版范围。

**回滚点**（与本文一致）：去掉 `neverBundle` 的 `@xyflow/react` 与 `dsh.client.external` 两处、
移除宿主 `PLATFORM_MODULES`/`seed` 的表项，重建即可（会回到 83% 预算，功能不变）。

---

## 最终修订（2026-10-23）：改为「插件自包含 + 包内惰性 chunk」，宿主零改动

上一节落的"宿主平台模块表提供 `@xyflow/react`"**已被否决并回退**。原因不是技术不可行，而是分发前提不成立：

> 插件要能装到**任意** DSH（包括上游原版宿主）。要求宿主先有 `@xyflow/react` 平台词，
> 等于"第三方用户装了我们的插件却没有画布"——这是坏体验，也违背插件自包含的分发原则。

### 最终做法

1. **入口只做注册**（`src/client/WorkbenchSeat.tsx`）：`lazy(() => import('./Workbench.tsx'))`，
   入口静态依赖只剩宿主基线词（react / react-dom / jsx-runtime / cordis 服务）；
2. **界面成为一个包内 chunk**：`chunkFileNames: 'client/client.[name].js'`，构建期把
   `Promise.resolve().then(() => require('./client.Workbench.js'))` 改写成
   `require.async('./client.Workbench.js')`（`tsdown.config.ts` 的 `asyncChunkRequire` 插件，
   用 magic-string 保 sourcemap）；
3. **chunk 注册**：banner 带 `chunk: "<裸文件名>"`，宿主按 `<包名>/<fileName>` 记账并按
   `/plugins/<包名>/<fileName>?rev=…` 取文件（入口同目录）。

### 为什么这次能成、上一版懒加载却失败

上一版失败在"入口与 chunk **共享模块**（样式表、图标）被 rolldown 提升成中间 chunk，入口同步
`require` 取不到"。这次把**入口做成零界面依赖**——所有共享都发生在 chunk 内部，天然不存在中间
chunk。这是关键差异，不是运气。

### 实测

| 口径 | 改前 | 改后 | 变化 |
| --- | --- | --- | --- |
| 入口 | 834,204 B / 180,161 gz | **44,782 B / 15,013 gz** | −94.6% / −91.7% |
| chunk | — | 793,139 B / 166,771 gz | 按需 |
| 总计 | 834,204 B | 837,921 B | +0.4% |

### 沿用/新增的契约

- **沿用**：宿主的 `require.async` + 包内 chunk 路由（`packages/client/modules` 早已内置并有测试），
  本次**没有新增任何宿主契约**；
- **新增**：插件侧 `client-bundle.test.ts` 6 条断言 + `check:bundle` 双口径（入口 / 总产物）。

