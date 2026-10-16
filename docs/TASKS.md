# dsh-image-video 任务列表：视频创作工作台

> **名字口径（D1 已定）**：工作台就叫 **dsh-image-video 工作台**。文档、tab 标题、`kind`、`id`、RPC 命名空间一律沿用 `dsh-image-video` / `image-video`，**不另起第二个产品名**，也不新增第二个产品包。

- 文档角色：**唯一进度账本**。进度只写在这里（`REQUIREMENTS.md` / `DESIGN-AUDIT.md` / `IMPLEMENTATION-PLAN.md` / `EXECUTION.md` 都不记进度）。
- 配套：要什么见 [`REQUIREMENTS.md`](./REQUIREMENTS.md)；怎么做/怎么验/怎么回滚见 [`EXECUTION.md`](./EXECUTION.md)；设计与阶段见 [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md)；事实分级见 [`DESIGN-AUDIT.md`](./DESIGN-AUDIT.md)。
- 基线（2026-10-12）：插件 `3a5c1e6`（`v0.3.1`，`lib/` 仍是 `478832a` 产物）；Harness `ee5114bb18`（子模块指针 → `3a5c1e6`，`0.2.1-alpha.2`）；`ffmpeg/ffprobe 8.0` 可用。

## 0. 怎么用这份清单

每条任务固定读法：**动作（含落在哪个仓库）｜ 验收（可执行证据）｜ 回滚 ｜ 需求 ｜ 依赖**。

| 记号 | 含义 |
|---|---|
| `[ ]` `[~]` `[x]` `[!]` `[-]` | 未开始 / 进行中（同刻最多 2 个且文件集不重叠）/ 完成（DoD 满足并附 commit）/ 阻塞（写原因与解除条件）/ 取消或后置（写原因） |

- **仓库**：`插件` = `/Users/guxiongjian/Documents/code/dsh-image-video`（子模块同 commit，桌面 dev 实际加载它）；`Harness` = 只在必要时动，且必须在 `FORK-FEATURES.md` 登记一条（否则合并上游时静默丢）。
- **验收证据**三类，必须可复现：`cmd:` 命令 / `test:` 测试文件 / `manual:` 真机步骤。**不以静态 UI、模拟进度、成功弹窗作为完成证据**（计划 §10）。
- **回滚**只写这一步的最小回退动作；分层回滚手册见 `EXECUTION.md` §6。
- **并行批次**：同一批次内任务可并行；批次之间按序（见 §10）。
- **需求覆盖**：60 条 `R-*` 全部有任务承接；新增任一条 `本方案实现` 的需求，必须同时补一条任务，否则视为计划缺项。
- 任务粒度 = **一个可独立提交、可独立回滚的单元**；完成定义（DoD）见 `EXECUTION.md` §9。

## 1. 进度总览

| 阶段 | 任务 | 已完成 | 阶段门禁（不过不进下一阶段） |
|---|---|---|---|
| 0 审计与方案（纯文档 + 环境可复现） | 6 | 6 | 决策 D2–D7 有结论；口径收敛完成 |
| 1 右栏工作台（PR-1 / PR-2） | 10 | 10 | 计划 §15 六条 + 生命周期测试绿 + 现有能力零回归 |
| 2 项目 / 媒体素材 / 创作资源 / 任务 | 11 | 3 | `R-PRJ-1..4`、`R-MED-1..3`、`R-TSK-1..3`、`R-QCK-2..4`（T2-3/T2-7/T2-8 完成；四面板与任务账本均**已现场验通**；剩余 8 项进行中：资源引用检查与轨迹资源等阶段 4/5 的引用面出现后再做，T2-11 待把 defaults 展示进工作台） |
| 3 预留能力边界 | 3 | 3 | `R-BND-4`（不可运行、不可伪造成功） |
| 4 专业工作流 MVP | 7 | 7 | `R-FLW-1..8`（T4-1/2/3/4/6/7 完成；**T4-5 只差画布跑一次真视频**核对与对话产出等价。**已知缺口**：跨运行的"成功结果缓存"未做——重试复用是同一次运行内"不重跑已成功节点"，新起一次运行仍会重新调外部 API，已在 T4-4 备注） |
| 5 时间轴精剪 MVP | 6 | 0 | `R-TML-1..7` |
| 6 三模式联动与 Agent | 5 | 0 | `R-ENT-3`、`R-QCK-4`、`R-AGT-2..4` |
| 7 稳定性与发布 | 7 | 0 | `R-NFR-1..5` + 发布门禁 |
| 8 本地项目包 / 资源包 | 4 | 0 | `R-PRJ-5`、`R-COL-2` |
| **合计** | **59** | **43** | — |

## 2. 阶段 0：审计与方案（纯文档，无产品代码）

- [x] **T0-1** 文档集定稿：需求 / 执行 / 任务三份，与既有两份互相引用、编号可追踪｜插件·docs｜`cmd:` 覆盖自检脚本（需求↔任务闭环、任务号无重复）｜回滚：删三份文件｜R-BND-1｜—
- [x] **T0-2** 决策拍板 **D2–D7** 并回填 §14（D1 已定：只用 dsh-image-video 命名）｜插件·docs｜`manual:` §14 每行都有结论，受影响的 `R-*` 同步更新｜回滚：恢复 §14 的建议值｜R-BND-1、R-TML-7、R-FLW-1｜T0-1｜**已完成（2026-10-14，owner）**：六条全部采纳"建议"列取值，§14 逐行标注"已采纳"并写明最晚复核点（D4→T4-1 前，D2/D6→阶段 2 相关任务前，D7→阶段 4 节点集前，D5→T8-1 前，D3→阶段 7 发布门禁前）
- [x] **T0-3** 基线快照：插件 / Harness / ffmpeg 版本与真机开关（`DSH_IMAGE_VIDEO_LIVE`）口径写进 `EXECUTION.md` §2｜插件·docs｜`cmd:` 实测基线 = typecheck exit 0、`pnpm run test` 250 passed / 5 skipped、`ffmpeg 8.0`｜回滚：不改代码，删段落｜R-NFR-2｜T0-1
- [x] **T0-4** 证明"零改动宿主"：记录 `--dump-config` 现状、私有插件名单与 client 出口校验行为（`private-plugins.ts:80-86`）｜Harness·只读＋docs｜`cmd:` 计划里的 `--profile desktop --dump-config` **被 CLI 拒绝**（"profile desktop is managed exclusively by the Electron application"）；可用绕法 = 把 profile 拷成别的名字再 dump，实测 1327 行、`image-video` 行解析正常｜回滚：删段落｜R-BND-2、R-NFR-2｜T0-1
- [x] **T0-6** 环境可复现修复（阻塞项）：① 仓库 lockfile 与 manifest 不同步 → 首次安装必须 `--no-frozen-lockfile` 并重新生成 lockfile；② `pnpm-workspace.yaml` 的 `allowBuilds: esbuild` 是未填占位符 → 填 `true`，esbuild postinstall 才真正执行；③ 插件直接依赖 `schemastery ^3.18.1` 与 dsh-0.2.1 devDeps 传递来的 `3.18.5-alpha.1` **两份并存**，导致 `z<T>` 注解报错 / 去注解后报 TS2742 → 统一到 `^3.18.5-alpha.1`，typecheck 转绿｜插件｜`cmd:` `pnpm run typecheck` exit 0、`pnpm run test` 全绿、`pnpm install` 不再报 `ERR_PNPM_IGNORED_BUILDS`｜回滚：`git checkout -- package.json pnpm-lock.yaml pnpm-workspace.yaml` 并删 `node_modules` 重装｜R-NFR-2｜T0-3
- [x] **T0-5** 口径收敛：修 README/注释里"1–10 秒"、`pollTimeoutMs 300000`、参考视频"100MB/5 段"，修 `http-client.ts` 指向的悬空文档名｜插件｜`cmd:` 文档与代码逐条对齐（对照 `REQUIREMENTS.md` §16 的 16 条）｜回滚：`git revert` 该提交｜R-NFR-4｜T0-3

## 3. 阶段 1：Harness 插件与右栏工作台（最小可验收切片，计划 §15）

> 门禁证据（六条逐项判定 + 未满足项与解除动作）：`docs/GATE-1-EVIDENCE.md`。

- [x] **T1-1** 客户端产物面：`package.json` 加 `exports["./client"]`、`dsh.client`（`platform: web` + 5 个 `inject`）、**扩 `files` 纳入 `lib/client/**` 与 `lib/types/client/**`**、补 `react`/`react-dom`/`@types/react`/`@types/react-dom` 与 6 个 `@deepseek-ai/dsh-client-*` devDeps（peer 同步 optional）｜插件｜`cmd:` `pnpm run typecheck` 双程序 exit 0；`pnpm install` 后 client 包解析到 0.2.1-alpha.2、react 18.3.1｜回滚：撤销这三处声明并删 `lib/client` 重新构建｜R-ENT-1、R-BND-1、R-NFR-2｜T0-4
- [x] **T1-2** tsdown 增加 client face：CJS/browser + `window.__ModuleLoader__.load({id, factory})` banner/footer/intro + `neverBundle`（react/react-dom/cordis/client-* 包）；`clean` 只留在 `build` 脚本，两个 face 都不 clean（避免互删）｜插件｜`cmd:` `pnpm run build` exit 0 → `lib/client/plugin.js`（8.19 kB）包装头尾正确；`grep` 确认 `require("react")` / `require("react/jsx-runtime")` 外置、无 react-dom 内联；`lib/types/client/plugin.d.ts` 由 `tsc -p tsconfig.client.json` 产出｜回滚：删 client face 与 `tsconfig.client.json`｜R-NFR-1｜T1-1
- [x] **T1-3** 客户端入口：自有 `kind`（`dsh-image-video-workbench`）+ 全局唯一 `id`（`dsh-image-video`），两段式注册（`ctx.sidebarRightTabs.register(...)` → 以该 `id` 为 key 的 `sidebar.right.pane.tab` 座位）+ guide entry（`open-workbench`）+ locale 字典｜插件｜**现场验通（2026-10-14 重启后）**：右栏出现 tab chip（`role=tab`，标题「dsh-image-video 工作台」）、guide 文案命中、骨架真实挂载；`node scripts/verify-workbench-tab.mjs` exit 0；卸载撤销由 `tests/client-lifecycle.test.ts` 覆盖｜回滚：移除两段式注册（tab 消失，宿主不受影响）｜R-ENT-1、R-ENT-6｜T1-2
- [x] **T1-4** 工作台骨架：项目名称 / 保存状态 / 模式切换（快速创作·专业工作流·时间轴精剪）+ 当前模式工作区 + 素材·资源·预览·任务四格；用 `useTabInfo()` 读座位信息并以 `data-*` 暴露可见性/是否全屏｜插件｜**现场验通**：三模式逐个点击 → `aria-pressed=true` 且当前模式区 `aria-label` 同步；文案与字典一致；窄窗 720px → `data-workbench-fullscreen=true`；主题见 T1-9｜回滚：tab body 换成空组件（类型保留）｜R-ENT-2、R-ENT-3｜T1-3
- [x] **T1-5** 宿主半边：`/image-video` RPC 健康检查 + 服务装配，`rpc.handle` 的 disposer 挂在本插件自己的 effect 上；只答 `health`，其余端点结构化拒绝｜插件｜`test:` `tests/host-workbench-rpc.test.ts`（4 例：健康值不含凭证、未知端点走 envelope、注册与撤销、无 connection 时空挂 disposer）；`cmd:` `lib/index.js` 含通道名，`src/index.ts` 经 `ctx.inject(['connection'])` 注册｜回滚：删 `src/host/rpc.ts` 与那一处 inject｜R-AGT-1、R-BND-2｜T1-4
- [x] **T1-6** 生命周期与骨架测试：字典 / tab 类型 / 座位三处注册随卸载撤销；骨架渲染与模式切换｜插件｜`test:` `tests/client-lifecycle.test.ts`、`tests/workbench.client.test.tsx`（jsdom）、`tests/version.test.ts` 全绿；全量 **260 passed / 5 skipped**；`cmd:` vitest 配 `jsx: automatic`、jsdom 30、`@testing-library/react` 16；`tests/manifest-contract.test.ts` 守护清单⟷代码契约（每个注入服务都有对应客户端包且都在 `dsh.client.inject`、client 出口与入库产物存在、运行时依赖留在 `dependencies`）｜回滚：删四个测试与新 devDeps｜R-BND-1、R-NFR-2｜T1-5
- [x] **T1-7** 桌面装载实测（**两半都已现场验通**）：右栏 tab + guide entry + 骨架 + 三模式切换 + 窄窗全屏 + **RPC 健康检查**｜插件｜**现场证据（2026-10-14，宿主重启后）**：`__DSH_BOOT__.entries` 含 `dsh-image-video`；`node scripts/verify-workbench-tab.mjs` → **exit 0**（半边在服务 + 健康通过）；骨架 `data-workbench-health=ok`、头部芯片 `0.3.1 · threerouter`；`GET /image-video/status` → 200 且 `rpc.registered=true`；桌面私有插件测试 10/10；过程中修掉两个真 bug（通道名必须单段；`connection.rpc.handle` 的注册上下文必须能看到 `webServer`）｜**留档**：现场层「禁用后无残留」无 in-app 入口（插件面板只列内置插件），由 `tests/client-lifecycle.test.ts` 的三处 disposer 断言覆盖｜回滚：摘掉 client 出口并重建（tab 消失）｜R-BND-2、R-NFR-2｜T1-5
- [x] **T1-8** 现有能力零回归：对话出图/出片、composer 媒体 tab、`/image-video/defaults` 不变；左栏与中间对话区零新增控件｜插件｜**真机证据（2026-10-14，owner 指定 Threerouter）**：① 出图两条默认/指定路径都通——默认 `qwen-image-3.0` → `outputs/1791958816089-386ae614.png`（1024×1024、880.2 KB），指定 `minimax-image-01` → `outputs/1791972775533-0b4f2a71.jpg`（1024×1024、106.1 KB）；② **出片 `minimax-h3` → `outputs/1791972747949-851789cb.mp4`（5 秒、827.6 KB、text-to-video）**；③ `GET /image-video/defaults` → 200 且正好 7 字段（`imageSize=1024*1024`、`videoDuration=5`）；④ `GET /outputs/<图>` → 200 image/png；composer 仍是 文本/图片/视频；⑤ 全量 **280 passed / 5 skipped** + `--dump-config` 的 image-video 块逐字节一致｜注：异步图片端点当前不可用（已记 §16），两条出图都走了同步降级路径｜回滚：发现回归则回退对应提交｜R-BND-5、R-QCK-1、R-ENT-4｜T1-5
- [x] **T1-9** 右栏形态：窄窗口可用 + 展开入口 + 深浅主题，直接接线右栏既有呈现（视口 <768px 自动 fullscreen、`primary+alt+Enter`、右栏最小 300 / 中间最小 400 由 `ui-layout` 定）｜插件｜**现场验通（2026-10-14）**：视口压到 720px → 骨架 `data-workbench-fullscreen=true`（未自造全屏）；主题跟随 App（`data-ds-theme-source=system`）——浅色：文字 `rgb(15,17,21)` / 底 `rgb(255,255,255)`，对比度 **18.9**；深色：文字 `rgb(249,250,251)` / 底 `rgb(21,21,23)`，对比度 **17.45**；内联样式**无硬编码色值**，边框走 `currentColor` + `color-mix`；媒体模拟已清除、App 保持原状｜回滚：保留骨架，撤掉主题/窄窗微调｜R-ENT-5、R-NFR-3｜T1-4
- [x] **T1-10** 产物与提交：`lib/`（含 client）+ `CHANGELOG.md` + 子模块指针对齐｜插件（+ Harness 指针）｜`cmd:` 插件仓库 `bd5064e` / `55e8e53` / `0d0f053` 已推 `origin/main`（含 `lib/client/plugin.js`、`lib/types/client/**`、CHANGELOG）；Harness `d9d21e050d` 只含子模块指针 + 台账 R08 补记｜回滚：`git revert` 对应提交并把 Harness 指针回退到上一 SHA｜R-NFR-2｜T1-7

## 4. 阶段 2：项目、媒体素材、创作资源与任务统一（计划 §5）

- [~] **T2-1** domain 记录与 id：`ProjectRecord`/`AssetRecord`/`ResourceRecord`/`TrackResourceRecord`/`TaskRecord` + id 生成 + 输入校验｜插件｜**已实现**：`ProjectRecord`、`AssetRecord`（含 `schemaVersion`）、`newWorkbenchId`、`normalizeProjectName`/`normalizeMediaKind`，`tests/workbench-store.test.ts` 覆盖校验边界；**待做**：`ResourceRecord`/`TrackResourceRecord`/`TaskRecord`｜R-PRJ-1、R-MED-1｜T1-10
- [~] **T2-2** 持久化层｜插件｜**已实现（偏离计划，理由见下）**：`WorkbenchStore` 用**单个 JSON 文档**（`<outputsDir>/../image-video-workbench/workbench.json`）承载项目、素材与**任务账本**，写入为 tmp+rename 原子、重启可重载、损坏文件不静默；`tests/workbench-store.test.ts` 8 例。**偏离**：计划原写"元数据走 `ctx.storage` + `storageDomain` 的 KV domain"——项目与账本需要可 diff、可携带、可手改的 JSON（与 D5 及阶段 8 包格式一致），KV 更适合会话级易变元数据；阶段 8 前复核｜**待做**：资源记录接入同一文档｜R-PRJ-2、R-NFR-4｜T2-1
- [x] **T2-3** `ProjectService`：新建/打开/改名/自动保存 + 保存状态四态｜插件｜**已实现**：新建、列表、选中、删除（二次确认）、改名（手动保存 + **停止输入约 0.9 秒自动保存**）、保存状态四态（已保存 / 保存中… / 有未保存改动 / 保存失败，根节点 `data-workbench-save`）；`tests/workbench.client.test.tsx` 覆盖 dirty→自动落盘→saved 与手动保存两条路径｜R-PRJ-3｜T2-2
- [x] **T2-4** `AssetService`：登记/筛选/引用检查/删除守卫 + 删除语义｜插件｜**已完成**：登记（按路径去重）、按媒体类型筛选、按项目列出、删除记录（只删记录不动文件）。**引用检查落地**：删素材前扫描时间轴 clip 与流程节点参数，被引用则**默认拒绝**并把位置说清楚（`时间轴「成片」的 video 轨 · 片段 c1（0ms 起）` / `流程图「图」的节点 n1`），用户点「仍要删除」才带 `force` 执行（三步确认）。测试：引用扫描纯函数 + 存储守卫（拒/强制各一）+ 端点（无 force 拒绝、带 force 删除）｜R-MED-2、R-MED-6｜T2-2
- [x] **T2-5** `ResourceService`：角色/场景/道具/品牌/风格/音色 CRUD + 引用检查｜插件｜**已完成**：六种 `kind` + 名称/备注校验、端点、按项目与种类过滤、项目删除级联。**引用检查落地**：删资源前扫描流程节点参数里的资源 id（真正的 `resource-reference` 节点），被引用即拒绝并指出节点，点「仍要删除」才 force。**说明**：音色试听按 `D6` 本期只做元数据。测试同 T2-4｜R-MED-3、R-MED-5｜T2-2
- [ ] **T2-6** 轨迹资源：关键帧校验 / 绑定 / 序列化 + 轨迹转约束文本｜插件｜`test:` 关键帧越界被拒；轨迹→约束文本可断言｜回滚：移除轨迹资源类型与绑定入口｜R-MED-4｜T2-5
- [x] **T2-7** `TaskService`：状态机（排队/运行/成功/失败/取消/中断）+ 持久化 + 恢复｜插件｜**已实现**：五态枚举与校验、**生成开始即写 `running`**（工作台立刻可见）、结束写 `succeeded`/`failed`（带错误原文）、**真实取消**（`GenerationRegistry` 把取消信号与工具执行信号取并集交给工具，`tasks/cancel` 中止提交/轮询，账本落 `cancelled`）、**重启恢复**（启动时把上次进程遗留的 `running` 收尾为 `failed`，避免永远"运行中"并幂等）；`tests/workbench-ledger.test.ts` 与存储测试覆盖。**说明**：`queued` 在枚举中保留但当前没有排队场景（工具调用即时开始），未使用 `ctx.jobs` 进度｜R-TSK-1、R-TSK-2、R-TSK-3｜T2-2｜**现场验通（2026-10-15）**：后台脚本盯梢 + 前台发起 `minimax-image-01` 出图 → 面板先出现「🖼️ 运行中 · minimax-image-01 · 08:14 取消任务」→ 脚本点「取消任务」→ 该行变「已取消」，且**发起方的工具调用直接返回 `任务已被取消`**（取消信号确实穿到工具，不是只改账本）；随后的改动让 running 行带上请求里的模型与提示词
- [x] **T2-8** 快速创作登记适配：生成结果 → 素材登记 + 资源使用记录（幂等）｜插件｜**已完成**：生成即入账；一键「登记为素材」；幂等键（同一（项目, 路径）返回已有记录并透出 `created`）；`maintenance/compact` 去重端点 + 面板「整理重复记录」（宿主机缓存文档，去重必须在进程内做），离线场景留 `scripts/compact-workbench.mjs`。**现场验通（2026-10-15）**：连点两次素材数不变并提示「已登记过」；「整理重复记录」现场把 14 条合并为 4 条。**说明**：资源使用记录并入 T4-6 运行记录一起做｜R-MED-4、R-TSK-3｜T2-7
- [x] **T2-9** 工作台四个面板：素材 / 资源 / 预览 / 任务（含跳转产出）；预览走 `/outputs` 通道，非本机宿主给可操作提示｜插件｜**已完成**：四面板全部可用；任务行可直接点开产出（已登记则选中素材，未登记则按路径临时预览）；**非本机宿主**时预览面板顶部给出可操作提示（`data-workbench-host-hint="remote"`：`/outputs` 仅回环注册，请改用 `http://127.0.0.1:…` 打开），有客户端测试（stub `window.location.hostname`）｜R-ENT-2｜T2-2
- [~] **T2-10** RPC 面与客户端 store：项目/素材/资源/任务 CRUD + 客户端一致性刷新（**轮询/失效重查**，无推送通道）｜插件｜**已实现**：`projects/list|create|remove|rename`、`assets/list|attach|remove`、`resources/list|create|remove`、`tasks/list|assign`、`outputs/list` 端点 + 客户端 `createWorkbenchApi` + 手动刷新重查；错误一律结构化 envelope。**待做**：自动失效重查策略（无推送通道）｜R-AGT-1、R-NFR-2｜T2-2
- [x] **T2-11** 配置口径对齐：复用 `src/config.ts` 与凭证缝；默认值一律读宿主配置，不写死前端｜插件｜**已完成**：工作台不硬编码任何部署值（事实来自 `health`）；**`health` 现在带上 7 字段生效默认值视图**（`resolveDefaultsView`：运行时覆盖 ?? settings 持久默认，与 composer 注入同一口径），工作台只读展示「当前生效参数」（`data-workbench-defaults` + 每字段 `data-workbench-default`，未设置显示"未设置"）；守护测试 `client-no-hardcoding`（产物里不得出现绝对路径与任何服务商/模型名）+ 端点断言 + 客户端断言 7 行｜R-NFR-1、R-BIND-3｜T2-2

## 5. 阶段 3：预留能力边界（计划 §6.2）

- [~] **T3-1** `availability: 'runnable' | 'planned'` 机制 + UI 禁用态与原因文案｜插件｜**已实现**：节点目录带 `availability`（12 runnable / 3 planned），planned 在节点库与卡片上有独立标记（`data-workflow-availability`、虚线边框、⚠ 标记），参数面板给出原因文案；**测试**断言两种标记可见、planned 的 title 有原因。**待做**：执行侧的「运行按钮」禁用态随运行器一起做（T4-4）｜R-BND-4｜T2-2
- [~] **T3-2** planned 节点/资源位：`lip-sync` / `face-swap` / `voice-synthesize`（音色只存元数据）｜插件｜**已实现**：三个 planned 节点**可放进图并保存**（进 `WorkflowRecord`，有测试），卡片与面板如实标注「未提供」与原因，不做任何假装可运行的 UI。**待做**：`voice-synthesize` 的音色元数据字段（等阶段 2 资源侧的音色资源用法明确后接）｜R-BND-4、R-MED-5｜T2-2
- [x] **T3-3** 防伪造测试：planned 不执行、不跳过、不伪造成功｜插件｜**已完成**：`tests/planned-capability.test.ts` 三例——① 三种 planned 类型在校验里都被标 `not-runnable` 并带上原因；② 图里一旦含 planned 节点，运行**整次拒绝**（`failed` + 错误里含 planned），**一个外部调用都没发出**、没有任何节点被标成成功、该节点是 `skipped` 且注明"validation"；③ 纯可运行图正常跑通。重试同样拒绝｜R-BND-4｜T3-2

## 6. 阶段 4：专业工作流 MVP（flow 节点流，计划 §6）

- [x] **T4-1** 画布接入：`@xyflow/react` 精确版本 + `WorkflowRecord` 单一事实源 + 保存/重开｜插件｜**已完成**：`@xyflow/react@12.12.0`（精确版本；官方样式表经 `scripts/sync-canvas-style.mjs` 内嵌注入）；`WorkflowRecord` 唯一事实源、**选择不入库**；加/选/拖/连/删/适配窗口；保存/重开＝`workflows/list|save|remove` + 进入工作流模式读回 + 改动 0.8s 去抖静默落库（画布保存四态 `data-workflow-save`）；结构校验（种类/坐标/连线两端/自环/规模上限）；现场几何守护 `scripts/verify-canvas-layout.mjs`。**现场验通（2026-10-15）**：进模式读回 0 节点 → 加 2 节点 → 保存态 saved → **刷新页面重进读回 2 节点**；素材面板「整理重复记录」把历史重复 14→4 条｜R-FLW-1、R-FLW-8｜T3-3
- [x] **T4-2** 节点实现：`creative-input`/`script`/`storyboard`/`asset-reference`/`resource-reference`/`motion-track`/`image-generate`/`video-generate`/`preview`/`publish-asset`｜插件｜**已完成**：节点目录（`src/workbench/workflow.ts`，画布与宿主共用）——12 可运行（V1 十个 + `subtitle`/`render`）+ 3 `planned`（禁用标记与原因）；每个节点有参数面板与目录默认值（缺省参数在保存/运行时按目录补齐，有测试）；`video-generate` 按 `D7` 承载参考视频与 `compare`，模型名留空走宿主默认。**说明**：本期只有生成节点有执行器，其余节点在运行记录里如实记 `skipped`（不伪造成功），语义随阶段 5/6 补全｜R-FLW-2｜T4-1
- [x] **T4-3** 图校验：必填 / 端口类型匹配 / 环检测｜插件｜**已完成**：`validateWorkflow()` 纯函数（必填 8 字段、端口兼容表、自环、悬空连线、三色 DFS 环检测并给出回路、`planned` 不可运行）；画布即时反馈 + 问题节点标红；**宿主在运行前用同一份逻辑拒绝**（运行器单元测试 `refuses to start when the graph fails validation` 断言：校验不过则不调任何工具、整次运行记 failed 并带问题清单）；**现场验通（2026-10-15/16）**｜R-FLW-3｜T4-2
- [x] **T4-4** `WorkflowRunner`：拓扑执行 + 节点记录 + 成功结果缓存 / 重试 / 取消；重试只重跑失败节点及其下游｜插件｜**已完成**：校验不过直接失败并带问题清单；Kahn 拓扑序；生成节点复用对话同一对工具（账本/取消继承）；节点开始即写 `running`（界面看到"正在跑哪个节点"）；上游文本并入提示词、上游产物作首帧；无执行器节点记 `skipped`（不伪造成功）；失败即停 + 下游标"被上游阻断"；**重试只重跑失败节点及下游**（断言前序成功节点不再调外部 API）；取消连带中止在飞生成；`workflows/run|runs|run-cancel|run-retry` + 启动收尾遗留 `running`；画布「运行流程/取消运行/重试失败节点」+ 节点级状态（运行中 2.5s 轮询）。**现场验通（2026-10-16）**：画布上真跑一张图 → `running`（取消可用）→ `succeeded`，节点行显示真实产物 `1792107894148-d2fd6aa6.png`｜R-FLW-3、R-FLW-5｜T4-3
- [x] **T4-5** `video-generate` 复用现有生成链（参数语义与对话一致，含参考视频/`compare`；按 D7 由本节点承载）｜插件｜**已完成**：运行器把节点参数映射成与对话**同名同义**的工具参数（`model`/`prompt`/`duration`/`resolution`/`aspectRatio`/`image`/`media[].video`/`compare`），单元测试断言映射与"上游产物作首帧"；`compare` 与参考视频按 `D7` 由 `video-generate` 显式承载。**现场验通（2026-10-16）**：画布上选 768P 真跑出 `1792115708086-7b6c8639.mp4`（运行中 → 成功，节点行显示产物）。**现场修的两处**：① 分辨率原写死 480P/720P/1080P 被模型 400 拒 → 改为 owner 指定的 **480P/768P/2K + 模型默认**，运行器对空值不发；② 上游偶发"stream interrupted"这类服务端错误 → 节点级自动重试 3 次（见 T4-4）｜R-FLW-4｜T4-4
- [x] **T4-6** 运行记录与回看：`WorkflowRunRecord` 持久化 + 图快照｜插件｜**已完成**：每次运行落库（含**图快照**与逐节点记录：状态/开始结束/产物路径/字节/错误），只保留最近 50 次；画布顶部「运行」区列出历史运行（时间 · 状态 · 产物数），点任意一条即回看它当时的节点结果（默认看最新）；运行记录随项目删除级联清理。测试：存储级（图快照/去重/级联）+ 客户端（列表 2 条 → 点旧的切到它的失败节点与原因）｜R-FLW-6｜T4-4
- [x] **T4-7** 模板：至少内置 3 个可用模板｜插件｜**已完成**：`WORKFLOW_TEMPLATES` 三个——文案→分镜→图→视频、图片→视频→字幕→渲染、参考视频复刻（含 `compare`）；模板带示例值，实例化后**直接通过图校验**（单元测试对每个模板断言 `validateWorkflow().ok`，即"可直接跑"）；画布有模板下拉 + 「套用模板」。顺带修正分镜端口语义（分镜表是**文字**输出，否则上述链路类型不匹配）｜R-FLW-7｜T4-4

## 7. 阶段 5：时间轴精剪 MVP（计划 §7）

- [x] **T5-1** `TimelineRecord` 模型与轨道/clip 操作（video/audio/subtitle）｜插件｜**已完成**：`src/workbench/timeline.ts`（三轨 + clip：素材**路径引用**/字幕文本/起点/时长/源内偏移/字幕样式，帧率、总时长函数）+ 校验（非法轨道种类、负数/NaN 时间、零时长、字幕缺文本、视频/音频缺路径、重复 clip id、超 400 clip 上限、**内联字节** data URL/超长 base64 一律拒）+ 存储（`timelines` 文档、增删改查、随项目级联）+ 端点 `timelines/list|save|remove` + 工作台「时间轴精剪」三轨面板（从素材加入 clip、写字幕、改起点/时长、删 clip、自动保存、总时长显示）。**测试**：模型/存储 8 例（含"三轨各 3 clip 保存重开完整恢复"+ 拒绝内联字节）+ 端点 1 例 + 客户端 1 例（三轨渲染、加入 clip 与字幕、自动保存落库、重开后恢复）｜R-TML-1、R-TML-2｜T4-7
- [x] **T5-2** 时间轴预览（不渲染的顺序预览 + 与导出口径差异说明）｜插件｜**已完成**：面板有播放头滑杆（`data-timeline-playhead`），按时间取当前片段（图 `<img>`/视频 `<video>`，走 `/outputs` 只读通道）+ 按样式把当刻字幕叠在画面上，旁注"不做转码、导出可能差一两帧"。**关键**：预览与导出**共用同一份边界判断** `activeClipAt()`（`src/workbench/timeline.ts`），并有阈值断言——测试遍历导出侧每个切分点，要求预览侧最近切换点与之相差 ≤ 1 帧（30fps 容差 33.3ms）｜R-TML-3｜T5-1
- [x] **T5-3** 字幕轨：编辑 + 样式 + 烧录开关｜插件｜**已完成**：字幕文本与样式（字号 8–200/`#rrggbb`/上中下）都可编辑，模型级校验拒绝越界；`burnSubtitles` 随文档落库；**导出侧**由 `buildRenderArgs` 决定——关掉烧录整段不生成 `drawtext`，字幕数据仍留在文档里（测试断言 filter graph 无 `drawtext` + 存储往返后文本仍在）｜R-TML-4｜T5-1
- [x] **T5-4** ffmpeg 集中解析与特性检测｜插件｜**已完成**：唯一解析点（`DSH_FFMPEG_PATH`→PATH→常见位置）+ 版本/编码器检测；`MEDIA_FFMPEG_UNAVAILABLE`/`NOT_EXECUTABLE`/`ENCODER_MISSING` 三码各带下一步动作；`media/ffmpeg` 端点支持严格诊断指定副本；面板显示状态并可重新检查。测试：模块 6 + 端点 1 + 客户端 1｜R-TML-6、R-TML-7｜T5-1
- [x] **T5-5** `RenderService`：时间轴快照 → filter graph → 进度/取消/输出校验；快照冻结后编辑不影响进行中的渲染｜插件｜**已完成**：`freezeTimeline()` 先深拷贝成快照（测试断言冻结后改原文档不影响渲染）；`planVideoSegments()` 把视频轨排成"片段 + 黑场填充"（重叠直接拒；尾部补黑对齐总时长）；`buildRenderArgs()` 拼 `scale/pad/setsar/fps/format → concat →(可选)drawtext→ libx264 + faststart`；进度靠 `-progress pipe:1` 的 `out_time_ms`；取消即 SIGKILL + **清理半成品**；导出后用 `ffmpeg -i` 实测时长并与时间轴比对（**±1 帧**超差即判 `MEDIA_OUTPUT_INVALID`）。宿主侧 `RenderRegistry` 提供任务快照/轮询/取消（`timelines/render|renders|render-cancel`），**成功的产物自动登记成素材**；面板有「导出成片 / 取消导出」+ 2 秒轮询进度。**真机验证**（自造 testsrc 素材，不花生成 token）：导出时长 2000ms ±1 帧、进度回调有值、取消后无残留文件、端点侧产物已登记为素材｜R-TML-5｜T5-4
- [x] **T5-6** 导出失败面覆盖（素材丢失 / 磁盘不足 / 编码不支持 / ffmpeg 缺失）｜插件｜**已完成**：素材不存在→`MEDIA_ASSET_MISSING`（**起 ffmpeg 前**就拦下，文案指到具体片段与路径）；ffmpeg 不可用/缺编码器→沿用 T5-4 的码与文案；ffmpeg stderr 映射磁盘满→`MEDIA_DISK_FULL`、`Unknown encoder`→`MEDIA_ENCODER_UNSUPPORTED`、spawn 失败→`MEDIA_FFMPEG_UNAVAILABLE`；成功但产物为空/时长超差→`MEDIA_OUTPUT_INVALID`；失败与取消都**不留半成品**。测试 4 例（用假 ffmpeg 脚本模拟 stderr，不依赖真实故障）｜R-TML-5、R-TML-6｜T5-5

## 8. 阶段 6：三模式联动与 Agent

- [ ] **T6-1** 对话卡片入口："发送到工作台" / "放入时间轴"（不改卡片现有信息与播放）｜插件 + 相邻插件（threerouter 侧）｜`manual:` 点击后素材出现在项目/时间轴；卡片信息不变｜回滚：摘掉卡片入口（RPC 保留）｜R-QCK-4、R-PRJ-7｜T5-6
- [x] **T6-2** 模式切换状态保真：A→C→B 往返不丢项目/素材/画布/时间轴｜插件｜**已完成**：项目、画布（节点/连线/位置）与时间轴（三轨 clip）都存工作台状态与文档里，切模式只换视图不重置数据；画布与时间轴分别有"进入模式才读回"的加载效应，因此往返不会互相覆盖。**测试**：A（画布 1 节点，位置 `{x:123,y:45}`）→ C（时间轴 2 clip）→ B（快速创作）→ 回画布/时间轴，断言节点位置与 clip id **逐字段一致**，项目数不变｜R-ENT-3｜T6-1
- [x] **T6-3** Agent 工具面：项目/素材/时间轴/工作流/任务（照计划 §8 逐条落地，含单次批量上限）｜插件｜**已完成**：五个工具 `workbench_projects`（list/create/rename）、`workbench_assets`（list/attach）、`workbench_timeline`（list/add-clip/export）、`workbench_workflow`（list/save/run/runs）、`workbench_tasks`（list/renders/cancel），注册在 effect 内（回滚=摘掉注册）。**反幻觉三条**：① 动作取值写进描述，不认识的动作把合法清单抛回去；② 引用必须真实存在（未登记的素材路径直接拒，并提示先 attach；不存在的项目/时间轴/流程都给"先 list"的下一步）；③ **节点缺画布坐标时工具自己排布**，不让模型编坐标；批量上限 `limit≤50`、单次 ≤20 个片段。**验收测试**：`tests/workbench-tools.test.ts` 7 例——其中 R-AGT-2 那条"把素材拼成 10 秒的片子并导出"端到端跑通（4s+3s+3s=10000ms，落库 `totalMs=10000`，导出起任务拿 renderId）｜R-AGT-2｜T6-2
- [x] **T6-4** 双向一致刷新：工具写 → 客户端轮询/失效重查（没有推送通道）；UI 写 → 工具读到最新｜插件｜**已完成（轮询口径，非"实时"）**：工作台在**面板可见时每 5 秒**轮询项目/素材/任务（`data-workbench-refreshed` 计数可观测），因此 Agent 用工具建的项目**无需手动刷新**就会出现；**本地正在编辑的文档（画布/时间轴 dirty/saving）不被轮询覆盖**，避免打断输入。反方向（UI 改名 → 工具读到新名字）本来就走同一份宿主文档，天然一致。**测试**：模拟 Agent 在宿主侧新建项目后，客户端在 ≤9 秒内（实现为 ≤5 秒）出现在项目下拉里。**口径写进实现注释**：延迟 ≤5 秒、面板不可见不轮询、失败静默重试｜R-AGT-3｜T6-3
- [x] **T6-5** 破坏性工具边界：删除素材/项目、覆盖项目包需显式参数与拒绝策略；默认配置下模型不能无确认删除被引用素材｜插件｜**已完成**：工具面**刻意不提供任何删除动作**（删除仍只在工作台 UI 里，且是两步确认）——测试逐条断言五个工具的文案里不出现 delete/remove/删除；唯一有破坏性的 `cancel` 必须显式给 `taskId` 或 `renderId`，描述里写明"只有在用户明确要求时才调用"，且对不存在的 id 如实返回 `false` 而不是假装成功｜R-AGT-4｜T6-3

## 9. 阶段 7：稳定性与发布

- [x] **T7-1** client bundle 体积门禁（阈值 = 首次构建值 +20%，记入 CHANGELOG）｜插件｜**已完成**：基线实测 **raw 548,282 B / gzip 121,161 B**（记入 CHANGELOG），预算 +20%；`scripts/bundle-budget.mjs`（纯函数，门禁与测试共用同一份实现）+ `scripts/check-bundle-size.mjs`（超预算列明细并非零退出）+ `pnpm run check:bundle`；当前实测占预算 83%｜R-NFR-3｜T2-11
- [ ] **T7-2** 错误可操作性覆盖：网络/服务商/ffmpeg/磁盘/迁移各一条断言｜插件｜`test:` 五类失败文案都含"原因 + 下一步"｜回滚：删该类断言（保留主流程）｜R-NFR-4｜T5-6
- [ ] **T7-3** 结构化日志：任务 ID / 节点 ID / 耗时 / 服务商可串联｜插件｜`test:` 一次完整流程能按任务 ID 串起日志｜回滚：退回现有 console 口径｜R-NFR-5｜T6-5
- [ ] **T7-4** 真机证据：媒体流程 8 步 + 一次 MP4 导出（附任务 ID）｜插件｜`manual:` 8 步全过，导出成片可播放｜回滚：无（只产证据）｜R-TML-5、R-NFR-2｜T6-5
- [ ] **T7-5** ffmpeg 交付口径结论（sidecar 打包 vs 安装检测）并回填需求 §14-D3｜插件·docs（+ 可能 Harness 打包）｜`manual:` 发布前有明确结论与真机证据，或明确列为已知限制｜回滚：维持"检测 + 提示"口径｜R-TML-7｜T7-4
- [ ] **T7-6** 发布门禁清单 + 打 tag（`v0.x.y-workbench-N`）｜插件｜`cmd:` 门禁全绿、tag 已推、回滚点可用｜回滚：删 tag，回退到上一发布点｜R-NFR-2｜T7-1..T7-5
- [x] **T7-7** CI 补测试步骤：`.github/workflows/ci.yml` 增加 `pnpm run test`（当前只 typecheck+build），并接入体积门禁｜插件｜**已完成**：CI 在 Build 之前跑 `pnpm run test`，Build 之后跑 `pnpm run check:bundle`（体积门禁）｜R-NFR-2｜T7-1

## 10. 阶段 8：本地项目包与资源包（计划 §5.6、§9 阶段 8）

- [ ] **T8-1** 项目包导出：JSON 清单（含包格式版本）+ 素材目录 + 校验和｜插件｜`test:` 导出包可解压检查，清单与素材一一对应｜回滚：删导出入口（本地项目文件不动）｜R-PRJ-5｜T7-6
- [ ] **T8-2** 导入：合并素材 / 仅结构 + 缺失清单；包内活动任务一律转 `imported-idle`，不自动续跑｜插件｜`test:` 换 `DSH_HOME` 导入后素材可预览、画布与时间轴一致；缺素材列出缺失项｜回滚：删导入入口｜R-PRJ-5｜T8-1
- [ ] **T8-3** 资源包导出/导入与去重：同名资源不覆盖，冲突列"跳过 / 重命名 / 替换"｜插件｜`test:` 同名资源导入不被覆盖并列出冲突项｜回滚：删资源包功能｜R-COL-2｜T8-1
- [ ] **T8-4** 跨机器验证（含完全断网打开本地项目、资源包导入不覆盖同名）｜插件｜`manual:` 断网可打开/浏览/编辑；包迁移后引用关系正确｜回滚：无（只产证据）｜R-BND-3、R-PRJ-5｜T8-3

## 11. PR 切片与并行批次

**PR 切片**

| 切片 | 任务 | 内容 | 可验收的一句话 |
|---|---|---|---|
| PR-1 | T1-1 … T1-7 | client 半边 + 右栏 tab + 三模式骨架 + RPC 健康检查 + 生命周期测试 + 桌面装载实测 | 装上插件能看到工作台 tab，卸载后什么都不剩 |
| PR-2 | T1-8 … T1-10 | 零回归验证 + 窄窗/主题 + 产物与指针提交 | 左中两栏与现有出图/出片不变 |
| PR-3 … | 每个阶段一个 PR（阶段 2 → 8） | 见各阶段任务 | 该阶段门禁 |

**并行批次（同批次内可并行，文件集不重叠）**

| 批次 | 可并行任务 | 备注 |
|---|---|---|
| B0 | T0-2 / T0-3 / T0-4 / T0-5 | 决策与口径互不冲突，可同一批处理 |
| B1 | T1-1 → T1-2 →（T1-3、T1-5 可并行）→ T1-4 → T1-6 | 构建面必须先落地；T1-9 与 T1-8 可在骨架后并行 |
| B2 | T2-1 → T2-2 →（T2-3、T2-4、T2-7 可并行）→（T2-5、T2-6、T2-8）→ T2-9 →（T2-10、T2-11） | 存储层是瓶颈，先做 |
| B3 | T3-1 → T3-2 → T3-3 | 串行 |
| B4 | T4-1 →（T4-2、T4-3）→ T4-4 →（T4-5、T4-6）→ T4-7 | 画布与校验可并行 |
| B5 | T5-1 →（T5-2、T5-3、T5-4）→ T5-5 → T5-6 | ffmpeg 解析先于渲染 |
| B6 | T6-1 → T6-2 →（T6-3、T6-4、T6-5） | 工具面可并行 |
| B7 | T7-1 / T7-2 / T7-3 / T7-4 / T7-7 可并行 → T7-5 → T7-6 | 发布门禁最后 |
| B8 | T8-1 →（T8-2、T8-3）→ T8-4 | 包格式先定 |

## 12. 附：任务 → 需求速查

| 阶段 | 主要覆盖需求 |
|---|---|
| 0 | `R-BND-1..5`、`R-NFR-4`（口径收敛） |
| 1 | `R-ENT-1..6`、`R-BND-1..5`、`R-NFR-2` |
| 2 | `R-PRJ-1..4`、`R-MED-1..6`、`R-TSK-1..3`、`R-QCK-2..4`、`R-CFG-1..2`、`R-NFR-6` |
| 3 | `R-BND-4`、`R-MED-3` |
| 4 | `R-FLW-1..8` |
| 5 | `R-TML-1..7` |
| 6 | `R-QCK-4`、`R-PRJ-7`、`R-ENT-3`、`R-AGT-2..4` |
| 7 | `R-NFR-1..5`、`R-TML-5`、`R-TML-7` |
| 8 | `R-PRJ-5`、`R-COL-2`、`R-BND-3` |
