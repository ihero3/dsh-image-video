> **已过时（2026-10-22）**：本文的 713,804 B / 87% 是 10-19 的快照；外置已落地，
> 实测口径与结论见 [`A6-BUNDLE-EXTERNALIZE.md`](./A6-BUNDLE-EXTERNALIZE.md)。本文保留作历史记录。

# Track A 交接说明 — B16 体积回收（≤80% 预算）根因与修复方案

> 由 Track B 编制，供 Track A（宿主 / 构建 / 加载器侧）决策与落地。
> 关联任务：`docs/TASKS-TRACK-B.md` 的 **B16**；根因与 `docs/TASKS-TRACK-B.md` 中 **B12** 的体积分析一致。

---

## 1. TL;DR

- **B16 目标**：客户端产物 `lib/client/plugin.js` ≤ **80% 预算**（raw ≤ 655,079 B / gzip ≤ 145,163 B）。
- **现状**：raw **713,804 B** / gzip **158,277 B** = **87% 预算**。体积门禁 `check:bundle` **PASS**（未超 100%），但**未达 ≤80% 软目标**。
- **纯 B 侧代码杠杆几乎无收益**：删未用 locale 仅 −0.4 KB；图标 0 个可删（39 个全部被引用）；样式表 0 安全收益（死选择器多为 React Flow 运行时类 `react-flow__*`）。
- **唯一真能达标的路径**：把 `@xyflow/react` 及其运行时依赖从「内联」改为「由宿主模块表在运行时提供」——这是 **A 侧的构建/加载器改造**，B 无权、且在单文件契约下不能做。
- **两个落点**：① A 侧外部化（真修复，见 §5）；② 接受现状并抬高 `BUNDLE_BASELINE` + 写 CHANGELOG 说明（工具已允许，见 §6）。

---

## 2. 体积构成（实测）

| 项 | raw | gzip | 占预算 |
|---|---|---|---|
| 当前产物 `lib/client/plugin.js` | 713,804 B | 158,277 B | **87% / 87%** |
| 预算（`BUNDLE_BASELINE` ×1.2） | 818,849 B | 181,454 B | 100% |
| 目标（≤80%） | ≤ 655,079 B | ≤ 145,163 B | 80% |
| 基线 `BUNDLE_BASELINE` | 682,374 B | 151,212 B | 83% |

**占比最大的单一来源**：`@xyflow/react` (12.12.0) + `@xyflow/system` + `d3-*` 传递闭包 ≈ **430 KB raw，已内联**进产物。剩余约 284 KB 为插件自有代码（Workbench + 画布逻辑 + 样式 + 本地化）。

---

## 3. 根因

`plugins/dsh-image-video/tsdown.config.ts` 客户端角的构建策略：

```ts
deps: {
  neverBundle: (id) => [          // 仅外置这些 → 变成 require()，由宿主模块表解析
    'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-connection/client',
    '@deepseek-ai/dsh-client-locale/client',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-sidebar-right/client',
  ].some(req => id === req || id.startsWith(`${req}/`)),
  alwaysBundle: (id) => !id.startsWith('node:'),  // 其余全部内联
}
```

- `@xyflow/react` 当前是 **devDependency**（仅客户端画布使用），被 `alwaysBundle` 内联进 `plugin.js`，成为产物主体。
- **基线本身已 83%（>80%）**：即便撤掉 B14/B15 的全部新增代码，也够不到 ≤80%。

---

## 4. 为什么 B 侧「按需加载 / 代码分割」走不通

B 实测过 `React.lazy(() => import('./WorkflowCanvas.tsx'))`：

- 入口确实从 714 KB 掉到 **192 KB（23%）**，达标。
- 但 `tests/client-bundle.test.ts` **强制 `plugin.js` 是自包含单文件**：
  - factory 只能 `require` 宿主模块表里存在的模块（`HOST_MODULES` 仅 `react` / `react-dom` / `react/jsx-runtime`）。
  - 任何其它 `require`（如拆出的画布 chunk）会抛 `模块表没有应答 require(...)`。
  - 真实桌面宿主 `window.__ModuleLoader__`（`packages/client/modules`）同样只认模块表条目，多 chunk 在运行时加载失败。
- **结论**：在该插件的单文件加载模型下，代码分割被契约拦截。B 已回退该改造，恢复单文件产物。

---

## 5. 给 Track A 的修复方案（推荐：真修复）

**目标**：把 `@xyflow/react` 及其运行时依赖从内联改为由宿主模块表提供，使 `plugin.js` 回落到约 284 KB（≈35%，≤80% 达成）。

### 5.1 `@xyflow/react` 运行时依赖闭包（必须随之外置或由宿主打包提供）

- `@xyflow/react` (12.12.0) → `classcat`、`zustand` (^4.4.0)、`@xyflow/system` (0.0.83)
- `@xyflow/system` (0.0.83) → `d3-drag`、`d3-interpolate`、`d3-selection`、`d3-zoom`
- 上述 `d3-*` 的传递闭包（本仓库已解析进树）：`d3-color`、`d3-dispatch`、`d3-ease`、`d3-timer`、`d3-transition`
- 注：`@xyflow/react` 内部仍会 `require('react')` / `require('react-dom')` / `require('react/jsx-runtime')`，这些已在模块表，无需重复。

### 5.2 改动清单

1. **`plugins/dsh-image-video/tsdown.config.ts`** — `neverBundle` 增加上述闭包 id。
   - **推荐做法（最稳）**：让宿主把 `@xyflow/react` 作为**单一预打包模块**提供（宿主侧把 xyflow + 其依赖打成一个模块）。这样插件只需外置 `@xyflow/react` 一项，避免逐个外置带来的版本/命名脆弱性。
   - 若改用逐个外置，则需在 `neverBundle` 列出 §5.1 全部闭包 id。

2. **宿主模块表** — `packages/client/modules/src/client/system.ts` 的 `staticModules` / 平台 seed 词表，注册 `@xyflow/react`（单一预打包方案则只注册这一个；逐个外置则注册整个闭包）。
   - 校验点：插件 `require('@xyflow/react')` 必须命中模块表，否则运行时抛 `client-modules: require("...") missed the module table`。

3. **`plugins/dsh-image-video/tests/client-bundle.test.ts`** 的 `HOST_MODULES` — 同步增加同样的 id（契约测试 `expect(requested.every(request => request in HOST_MODULES))`）。**这一项 B 可配合改，但前提是 A 先确定外置清单。**

4. **`plugins/dsh-image-video/package.json`** — `@xyflow/react` 从 `devDependencies` 提升为被宿主提供的依赖声明（加入 `peerDependencies` 或 `dsh.client.external` 标注），避免「未声明外部依赖」漂移。

### 5.3 验证（A 交付后）

```sh
pnpm --filter dsh-image-video run build
pnpm --filter dsh-image-video run check:bundle      # 期望 plugin.js ≈284KB raw（≈35%）→ ≤80% 达成
pnpm --filter dsh-image-video exec vitest run tests/client-bundle.test.ts   # 契约测试仍 PASS
pnpm --filter dsh-image-video exec vitest run tests/client-*                # 无回归
```

---

## 6. 备选落点（若 A 不打算外部化）

接受现状并抬高基线（工具 `check-bundle-size.mjs` 已明确允许）：

- 在 `scripts/bundle-budget.mjs` 把 `BUNDLE_BASELINE` 设为实测值（raw 713,804 / gzip 158,277），`BUNDLE_BUDGET = baseline × 1.2`。
- 在 CHANGELOG 写明：体积由画布必需的 `@xyflow/react` + `d3-*` 主导，单文件契约禁止代码分割，客户端侧无可行瘦身空间；≤80% 需宿主侧外部化（见 §5）。
- 注意：`bundle-budget.mjs` 位于 `scripts/`，按 Track B 权限矩阵 B 不能改；此项同样需 A（或协同）落地。

---

## 7. 当前 B 侧已交付 / 已锁定

- **B14（接新契约）✓**、**B15（新面板）✓**：已完成并通过测试（关键客户端测试 6 文件 57 项全绿）。
  - B14：`clip.transition/transitionDurationMs`、`speed/fade/crop`、`track.fadeMs`、`timeline.normalizeLoudness` 全部接通 + `saveTimeline` 持久化。
  - B15：字幕批量（复用域层 `planSubtitleClips`）、模板市场（合并 `WORKFLOW_TEMPLATES`+`DRAMA_TEMPLATES` 含 `drama-series`）、诊断面板（新增客户端 `getDiagnostics`）。
- **B16 纯代码杠杆已交付**：删 7 个未用 locale 键（−0.4 KB）；图标 / 样式无安全收益（已审计）。
- **单文件产物已恢复**，契约测试 PASS，`check-scope --track=b` 未越界；`lib/` 还原到提交态（B 规则：不提交 lib）。
- 本说明**不含**对 B 禁改文件（`src/host`、`src/workbench`、`lib`、`package.json`、`scripts`）的实质修改。

---

## 8. 待 A 决策

- [ ] 选 §5（外部化）还是 §6（抬基线）
- [ ] 若选 §5：确定「单一预打包模块」还是「逐个外置」
- [ ] 交付后通知 B 同步 `client-bundle.test.ts` 的 `HOST_MODULES` 并复跑门禁
