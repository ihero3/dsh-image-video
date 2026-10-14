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
| 2 项目 / 媒体素材 / 创作资源 / 任务 | 11 | 0 | `R-PRJ-1..4`、`R-MED-1..3`、`R-TSK-1..3`、`R-QCK-2..4`（首切片 6 项进行中：项目/素材/产物清单**已现场验通**——建项目/登记产物/预览/二次确认删除） |
| 3 预留能力边界 | 3 | 0 | `R-BND-4`（不可运行、不可伪造成功） |
| 4 专业工作流 MVP | 7 | 0 | `R-FLW-1..8` |
| 5 时间轴精剪 MVP | 6 | 0 | `R-TML-1..7` |
| 6 三模式联动与 Agent | 5 | 0 | `R-ENT-3`、`R-QCK-4`、`R-AGT-2..4` |
| 7 稳定性与发布 | 7 | 0 | `R-NFR-1..5` + 发布门禁 |
| 8 本地项目包 / 资源包 | 4 | 0 | `R-PRJ-5`、`R-COL-2` |
| **合计** | **59** | **16** | — |

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
- [~] **T2-2** 持久化层｜插件｜**已实现（偏离计划，理由见下）**：`WorkbenchStore` 用**单个 JSON 文档**（`<outputsDir>/../image-video-workbench/workbench.json`）承载项目与素材，写入为 tmp+rename 原子、重启可重载、损坏文件不静默丢数据；`tests/workbench-store.test.ts` 覆盖。**偏离**：计划原写"元数据走 `ctx.storage` + `storageDomain` 的 KV domain"——项目需要可 diff、可携带、可手改的 JSON（与 D5 及阶段 8 的项目包格式一致），KV 更适合会话/窗口级易变元数据，故此处保留文件后端并在阶段 8 前复核｜**待做**：资源/任务记录接入同一文档｜R-PRJ-2、R-NFR-4｜T2-1
- [~] **T2-3** `ProjectService`：新建/打开/改名/自动保存 + 保存状态四态｜插件｜**已实现**：新建、列表、选中、删除（**二次确认**，符合 D2）；`tests/workbench-rpc-endpoints.test.ts` 走完整生命周期；客户端「新建/选中/删除」已可用。**待做**：改名、自动保存、保存状态四态（当前头部仍显示固定「已保存」）｜R-PRJ-3｜T2-2
- [~] **T2-4** `AssetService`：登记/筛选/引用检查/删除守卫 + 删除语义（后果说明、可选删文件、不可恢复提示）｜插件｜**已实现**：把 outputs 里的产物登记进项目（幂等去重：已登记的路径不会被重复登记）、按项目列出、删除记录（二次确认；**只删记录不动磁盘文件**）；**待做**：按类型/时间筛选、引用检查（时间轴/画布引用）、"同时删除文件"选项与不可恢复提示｜R-MED-2、R-MED-6｜T2-2
- [ ] **T2-5** `ResourceService`：角色/场景/道具/品牌/风格/音色 CRUD + 引用检查｜插件｜`test:` CRUD 单测；`scope` 只写 `project`｜回滚：资源库整块摘除（素材库不受影响）｜R-MED-3、R-COL-1｜T2-4
- [ ] **T2-6** 轨迹资源：关键帧校验 / 绑定 / 序列化 + 轨迹转约束文本｜插件｜`test:` 关键帧越界被拒；轨迹→约束文本可断言｜回滚：移除轨迹资源类型与绑定入口｜R-MED-4｜T2-5
- [ ] **T2-7** `TaskService`：状态机（排队/运行/成功/失败/取消/中断）+ 持久化 + 恢复；进程内执行可借 `ctx.jobs`（可声明自有 `JobKindMap` 种类），项目账本必须落盘｜插件｜`test:` 运行中杀进程后重开显示"中断（可重试）"｜回滚：任务只存内存（退回现状）｜R-TSK-1、R-TSK-2、R-PRJ-6｜T2-2
- [ ] **T2-8** 快速创作登记适配：生成结果 → 素材登记 + 资源使用记录（幂等）｜插件｜`test:` 同一任务重复登记不产生第二条素材｜回滚：关掉适配层（对话链路原样可用）｜R-QCK-2、R-QCK-3｜T2-4、T2-5
- [~] **T2-9** 工作台四个面板：素材 / 资源 / 预览 / 任务（含跳转产出）；预览走 `/outputs` 通道，非本机宿主给可操作提示｜插件｜**已实现**：素材面板（登记最新产物/点选/删除）、预览面板（`/outputs/<文件名>` 渲染图片与视频）、刷新、错误提示；`tests/workbench.client.test.tsx` 8 例覆盖。**待做**：资源面板、任务面板（含跳转产出）、非本机宿主的可操作提示｜R-ENT-2｜T2-2｜**现场验通（2026-10-14，宿主重启后，真实点击）**：建项目 → 下拉出现「现场验收项目」；「登记最新产物」→ 素材行出现 `预览 1791972775533-0b4f2a71.jpg`；点素材 → 预览面 `<img src="/outputs/…jpg">` `naturalWidth=1024 / complete=true`（真走只读媒体路由）；删除为两段式（首点只改文案、项目仍在，二点才删）；数据落在 `<outputsDir>/../image-video-workbench/workbench.json`
- [~] **T2-10** RPC 面与客户端 store：项目/素材/资源/任务 CRUD + 客户端一致性刷新（**轮询/失效重查**，无推送通道）｜插件｜**已实现**：`/image-video` 通道扩出 `projects/list|create|remove`、`assets/list|attach|remove`、`outputs/list`，客户端 `createWorkbenchApi` 封装 + 手动「刷新」重查；未见未知端点/载荷错误都走结构化 envelope（错误码 `unknown-endpoint`/`invalid-payload`/`failed`）。**待做**：资源/任务端点、自动失效重查（无推送通道，需轮询或手动刷新策略）｜R-AGT-1、R-NFR-2｜T2-2｜**现场验通（2026-10-14，宿主重启后，真实点击）**：建项目 → 下拉出现「现场验收项目」；「登记最新产物」→ 素材行出现 `预览 1791972775533-0b4f2a71.jpg`；点素材 → 预览面 `<img src="/outputs/…jpg">` `naturalWidth=1024 / complete=true`（真走只读媒体路由）；删除为两段式（首点只改文案、项目仍在，二点才删）；数据落在 `<outputsDir>/../image-video-workbench/workbench.json`
- [ ] **T2-11** 配置口径对齐：复用 `src/config.ts` 与凭证缝（`apiKeyEnv`）；默认模型/尺寸/时长/水印/输出目录一律读宿主配置，不写死前端、不新增第二套 Key 入口｜插件｜`manual:` 桌面登录后工作台可直接生成（同一 Key）；改一次默认模型后对话与工作台两处都变｜回滚：工作台参数面板改回只读展示｜R-CFG-1、R-CFG-2｜T2-10

## 5. 阶段 3：预留能力边界（计划 §6.2）

- [ ] **T3-1** `availability: 'runnable' | 'planned'` 机制 + UI 禁用态与原因文案｜插件｜`test:` 面板可见两种标记；planned 的运行按钮禁用且有原因｜回滚：删 `availability` 字段与禁用样式｜R-BND-4｜T2-10
- [ ] **T3-2** planned 节点/资源位：`lip-sync` / `face-swap` / `voice-synthesize`（音色只存元数据）｜插件｜`test:` 节点可放进图并保存，但不可运行｜回滚：从节点目录与模板里移除 planned 条目｜R-BND-4、R-MED-3｜T3-1
- [ ] **T3-3** 防伪造测试：planned 不执行、不跳过、不伪造成功｜插件｜`test:` `tests/planned-capability.test.ts`：全量运行遇到 planned 节点必须报错停下｜回滚：删测试与 planned 条目｜R-BND-4｜T3-2

## 6. 阶段 4：专业工作流 MVP（flow 节点流，计划 §6）

- [ ] **T4-1** 画布接入：`@xyflow/react` 精确版本 + `WorkflowRecord` 单一事实源 + 保存/重开｜插件｜`test:` 断网可编辑保存；UI 瞬时选择不入库｜回滚：隐藏工作流模式入口（记录保留、不再执行）｜R-FLW-1、R-FLW-8｜T3-3
- [ ] **T4-2** 节点实现：`creative-input`/`script`/`storyboard`/`asset-reference`/`resource-reference`/`motion-track`/`image-generate`/`video-generate`/`preview`/`publish-asset`｜插件｜`test:` 每个节点有参数面板与默认值｜回滚：节点目录缩回"仅展示"的只读集合｜R-FLW-2｜T4-1
- [ ] **T4-3** 图校验：必填 / 端口类型匹配 / 环检测｜插件｜`test:` 含环图被拒并指明回路｜回滚：只保留 schema 校验（去掉拓扑校验）｜R-FLW-3｜T4-2
- [ ] **T4-4** `WorkflowRunner`：拓扑执行 + 节点记录 + 成功结果缓存 / 重试 / 取消；重试只重跑失败节点及其下游｜插件｜`test:` 失败重试时前序成功节点不重新调外部 API（以日志/运行记录为证）｜回滚：运行只允许"单节点试跑"｜R-FLW-3、R-FLW-5｜T4-3
- [ ] **T4-5** `video-generate` 复用现有生成链（参数语义与对话一致，含参考视频/`compare`；节点如何承载参考视频按 D7 结论）｜插件｜`test:` 画布与对话产出的参数层面等价（同模型、同比例、同引用）｜回滚：节点退回只读展示｜R-FLW-4｜T4-4
- [ ] **T4-6** 运行记录与回看：`WorkflowRunRecord` 持久化 + 图快照｜插件｜`test:` 同一张图跑两次有两条独立记录与各自参数｜回滚：不写运行记录（只留日志）｜R-FLW-6｜T4-4
- [ ] **T4-7** 三个内置模板（文案→分镜→图→视频 / 图片→视频→字幕→渲染 / 参考视频复刻）｜插件｜`manual:` 只填提示词与素材即可跑完；模板内不含 planned 节点｜回滚：删模板目录｜R-FLW-7｜T4-6

## 7. 阶段 5：时间轴精剪 MVP（计划 §7）

- [ ] **T5-1** `TimelineRecord` 模型与轨道/clip 操作（video/audio/subtitle）｜插件｜`test:` 三轨 ≥3 clip 保存重开完整恢复；JSON 内无内联字节｜回滚：隐藏时间轴模式入口（记录保留）｜R-TML-1、R-TML-2｜T4-7
- [ ] **T5-2** 时间轴预览（不渲染的顺序预览 + 与导出口径差异说明）｜插件｜`test:` 预览切换点与导出切换点偏差在阈值内（阈值写进测试）｜回滚：只保留播放头与缩略图｜R-TML-3｜T5-1
- [ ] **T5-3** 字幕轨：编辑 + 样式 + 烧录开关｜插件｜`test:` 关闭烧录时导出无字幕但字幕数据不丢｜回滚：字幕轨改为只读导入｜R-TML-4｜T5-1
- [ ] **T5-4** ffmpeg 集中解析与特性检测（缺失/版本/权限失败给 `MEDIA_FFMPEG_UNAVAILABLE` 级可操作错误）｜插件｜`test:` 移走 ffmpeg 后 UI 报"未找到 ffmpeg"+下一步动作｜回滚：回到"假定 ffmpeg 存在"的旧行为（仅开发机）｜R-TML-6、R-TML-7｜T5-1
- [ ] **T5-5** `RenderService`：时间轴快照 → filter graph → 进度/取消/输出校验；快照冻结后编辑不影响进行中的渲染｜插件｜`test:` 导出可播放、时长 ±1 帧；取消不留半成品｜回滚：停止渲染任务并标记 `cancelled`｜R-TML-5｜T5-4
- [ ] **T5-6** 导出失败面覆盖（素材丢失 / 磁盘不足 / 编码不支持 / ffmpeg 缺失）｜插件｜`test:` 每类失败一条断言，文案含原因与建议动作｜回滚：删失败面测试（保留主流程）｜R-TML-5、R-TML-6｜T5-5

## 8. 阶段 6：三模式联动与 Agent

- [ ] **T6-1** 对话卡片入口："发送到工作台" / "放入时间轴"（不改卡片现有信息与播放）｜插件 + 相邻插件（threerouter 侧）｜`manual:` 点击后素材出现在项目/时间轴；卡片信息不变｜回滚：摘掉卡片入口（RPC 保留）｜R-QCK-4、R-PRJ-7｜T5-6
- [ ] **T6-2** 模式切换状态保真：A→C→B 往返不丢项目/素材/画布/时间轴｜插件｜`test:` 往返后节点位置与 clip 一致｜回滚：切模式时重置工作区视图（数据不动）｜R-ENT-3｜T6-1
- [ ] **T6-3** Agent 工具面：项目/素材/时间轴/工作流/任务（照计划 §8 逐条落地，含单次批量上限）｜插件｜`test:` 对话下达"拼成 10 秒片子并导出"能跑通，参数无幻觉｜回滚：注销新增工具（注册都在 effect 内）｜R-AGT-2｜T6-2
- [ ] **T6-4** 双向一致刷新：工具写 → 客户端轮询/失效重查（**没有推送通道**，必要时自建宿主 SSE 路由）；UI 写 → 工具读到最新｜插件｜`test:` 不手动刷新就能看到 Agent 新建的项目；刷新延迟有明确口径｜回滚：改为仅手动刷新按钮｜R-AGT-3｜T6-3
- [ ] **T6-5** 破坏性工具边界：删除素材/项目、覆盖项目包需显式参数与拒绝策略；默认配置下模型不能无确认删除被引用素材｜插件｜`test:` 拒绝路径有断言｜回滚：把破坏性工具从注册表移除｜R-AGT-4｜T6-3

## 9. 阶段 7：稳定性与发布

- [ ] **T7-1** client bundle 体积门禁（阈值 = 首次构建值 +20%，记入 CHANGELOG）｜插件｜`cmd:` 超限使 `pnpm run build`/CI 红｜回滚：删门禁脚本（体积仍记录在 CHANGELOG）｜R-NFR-1｜T1-2
- [ ] **T7-2** 错误可操作性覆盖：网络/服务商/ffmpeg/磁盘/迁移各一条断言｜插件｜`test:` 五类失败文案都含"原因 + 下一步"｜回滚：删该类断言（保留主流程）｜R-NFR-4｜T5-6
- [ ] **T7-3** 结构化日志：任务 ID / 节点 ID / 耗时 / 服务商可串联｜插件｜`test:` 一次完整流程能按任务 ID 串起日志｜回滚：退回现有 console 口径｜R-NFR-5｜T6-5
- [ ] **T7-4** 真机证据：媒体流程 8 步 + 一次 MP4 导出（附任务 ID）｜插件｜`manual:` 8 步全过，导出成片可播放｜回滚：无（只产证据）｜R-TML-5、R-NFR-2｜T6-5
- [ ] **T7-5** ffmpeg 交付口径结论（sidecar 打包 vs 安装检测）并回填需求 §14-D3｜插件·docs（+ 可能 Harness 打包）｜`manual:` 发布前有明确结论与真机证据，或明确列为已知限制｜回滚：维持"检测 + 提示"口径｜R-TML-7｜T7-4
- [ ] **T7-6** 发布门禁清单 + 打 tag（`v0.x.y-workbench-N`）｜插件｜`cmd:` 门禁全绿、tag 已推、回滚点可用｜回滚：删 tag，回退到上一发布点｜R-NFR-2｜T7-1..T7-5
- [ ] **T7-7** CI 补测试步骤：`.github/workflows/ci.yml` 增加 `pnpm run test`（当前只 typecheck+build），并接入体积门禁｜插件｜`cmd:` CI 上能看到测试与体积两项；缺产物/超限能拦住｜回滚：移除该 CI 步骤｜R-NFR-1、R-NFR-2｜T7-1

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
