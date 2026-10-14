# dsh-image-video 执行手册：视频创作工作台

- 文档角色：**执行层**——在哪里改、按什么顺序改、怎么验证、怎么回滚、怎么发布。
- 配套：需求与验收见 [`REQUIREMENTS.md`](./REQUIREMENTS.md)；事实与分级见 [`DESIGN-AUDIT.md`](./DESIGN-AUDIT.md)；设计与阶段见 [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md)；原子任务与状态见 [`TASKS.md`](./TASKS.md)。
- 基线（2026-10-12）：插件 `3a5c1e6`（`v0.3.1`，`lib/` 仍是 `478832a` 的产物）；Harness `ee5114bb18`（子模块指针 → `3a5c1e6`，`0.2.1-alpha.2`）；本机 `ffmpeg 8.0` / `ffprobe 8.0` 可用。
- 本文不重复设计内容；凡涉及"改哪个模块"只引用计划章节。

## 1. 三个工作区：在哪里改、怎么串起来

| 工作区 | 路径 | 角色 | 提交规则 |
|---|---|---|---|
| **插件工作树（唯一改这里）** | `<Harness>/plugins/dsh-image-video`（git 子模块；remote = `github.com:ihero3/dsh-image-video`） | 桌面 dev **直接加载它**（dev 工程 `node_modules/dsh-image-video` 是指向它的软链），所以开发、构建与提交**都在这一份里做**，不存在跨目录同步 | 改 `src/` 必须 `pnpm run build`，并把 `lib/index.js`、`lib/index.d.ts`、`lib/client/**`、`lib/types/client/**` 一起提交（CONTRIBUTING）；提交后 Harness 侧 bump 子模块指针 |
| 插件的第二份检出（只读/备用） | `/Users/guxiongjian/Documents/code/dsh-image-video` | **同一个仓库**的另一份 clone（早期工作用过，`docs/` 首次落在这里） | 需要时 `git pull` 跟上；**不要两份同时改**（会成为"改了看不到"的来源） |
| Harness 仓库 | `/Users/guxiongjian/Documents/code/deepseek-harness` | 宿主、右栏扩展点、桌面装载 | 除子模块指针（以及确有必要、且已在 `FORK-FEATURES.md` 登记的极少数改动）外**不应有改动**（`R-NFR-2`） |

装载链事实（已核实）：

- `apps/desktop/src/project-manager.ts:36` → `LOCAL_PLUGIN_BUNDLES = ['dsh-image-video', 'dsh-plugin-threerouter']`：dev/profile 的 bundle 列表，本方案**不新增包名**。
- `apps/desktop/src/private-plugins.ts:16` → `PRIVATE_PLUGIN_NAMES` 同上；`:80` 起读取 `exports['./client'].default`，`:84` 在"声明了 client 出口但文件没构建出来"时**直接抛错**（`run the plugin bundle script first`）→ 新增 `./client` 出口与构建产物必须原子提交，否则桌面启动即失败。
- `apps/desktop/.desktop-build/development/project/node_modules/dsh-image-video →` 子模块目录（软链，改子模块里的 `lib/` 即被加载）。
- 新增客户端产物时必须**同时**改两处，否则桌面启动直接失败：`package.json` 的 `files` 白名单（现在只有 `lib/index.js`、`lib/index.d.ts`、`cordis.patch.yml`）要加入 `lib/client/**`；tsdown 配了 `clean: true`，构建会清空 `lib/`，所以 host+client 必须在**同一次构建**里产出并一起提交。
- 媒体通道前提：`/outputs`（只读，支持 Range）与 `/image-video/defaults` **只在 `webServer.host === '127.0.0.1'` 时注册**（`src/media-route.ts`、`src/runtime-defaults.ts`）。桌面端满足；工作台预览全部走这条通道（`R-NFR-6`）。
- 跨仓断言会被翻转：`apps/desktop/tests/private-plugins.spec.ts:61` 现在断言 `expect(imageVideo.clientEntry).toBeUndefined()`；本插件加上 client 半边后**这条断言必须改成"存在"**，否则桌面测试必红（Harness 侧 1 行 fork 改动，按 `FORK-FEATURES.md` 的规则登记一条）。
- 客户端测试先补 devDeps：插件仓库现在只有 node 环境的 `vitest.config.ts`（没有 jsdom 层）。要写右栏组件测试需新增 `@deepseek-ai/dsh-client-test-runtime`（`SlotTestRuntime`）、`@testing-library/react`、`@types/react`，并在测试文件首行写 `// @vitest-environment jsdom`。
- 宿主→客户端**没有通用推送通道**：`rpc.handle` 只处理"客户端发起的单次调用"（`/plugins/events` 是 HMR 专用）。工作台的进度与列表一致性走轮询/失效重查，或由插件自建一条宿主 HTTP 长连接（`webServer` 允许挂住 `text/event-stream`）；计划文本里的"事件推送"不能当成既有能力。

**基线实测（2026-10-14，执行 PR-1 之前先量过一遍）**

| 项 | 实测 |
|---|---|
| 插件 `node_modules` | 原为**空**（依赖未装）→ `pnpm install --no-frozen-lockfile` 装 228 包 |
| `pnpm run typecheck` | **exit 0**（此前红：`src/config.ts` 114/121 行的 `Volatile` 类型冲突；根因是 schemastery 两份并存，统一到 `^3.18.5-alpha.1` 后转绿） |
| `pnpm run test` | **250 passed / 5 skipped**（16 文件；跳过的 3 个是真机契约，需 `DSH_IMAGE_VIDEO_LIVE=1`） |
| `pnpm-workspace.yaml` | `allowBuilds.esbuild` 原为未填占位符 → 填 `true` 后 esbuild postinstall 才真正执行（不再报 `ERR_PNPM_IGNORED_BUILDS`） |
| `pnpm-lock.yaml` | 与 manifest 不同步（2 增 4 改）→ 只能用 `--no-frozen-lockfile` 安装并重新生成 |
| `--dump-config` | 拷贝 profile 改名的绕法可用：1327 行，`image-video` 行（`id`/`name`/`config`）解析正常 |

迭代循环（两种粒度的改动分开）：

| 改了什么 | 构建 | 生效方式 |
|---|---|---|
| 只有客户端半边（右栏 UI、状态、locale） | 子模块内 `pnpm run build`（或 Harness 根 `pnpm run build:plugins`） | 重载窗口（⌘R）即可，客户端 bundle 按需拉取 |
| 宿主半边（RPC、服务、工具、storage） | 同上 | 必须重启桌面 App（宿主进程在启动时加载插件） |
| Harness 侧（本项目**不应该**有） | — | 若真需要（如 profile 组合行），按计划的"零改动宿主"原则先评审 |

跨仓落地顺序：**插件仓库改 + 构建 + 提交 `lib/`** → push → 子模块对齐同一 commit → Harness `git add plugins/dsh-image-video`（bump 指针）+ commit。禁止只改子模块工作区而不提交（Harness 会显示 dirty 子模块，别人拉不到）。

## 2. 环境前置（一次装好）

```sh
# 1) 工具链
node -v && pnpm -v
ffmpeg -version | head -1 && ffprobe -version | head -1   # 期望：8.x 两行都打印

# 2) 插件仓库（首次务必用 --no-frozen-lockfile：仓库里的 lockfile 与 manifest 不同步，见 §1 基线实测）
cd /Users/guxiongjian/Documents/code/dsh-image-video
pnpm install --no-frozen-lockfile
pnpm run typecheck && pnpm run test && pnpm run build

# 3) 子模块与桌面 dev
cd /Users/guxiongjian/Documents/code/deepseek-harness
pnpm run build:plugins          # = 对 dsh-image-video / dsh-plugin-threerouter 跑 bundle
pnpm run dev:desktop            # 起桌面 dev（DSH_HOME=apps/desktop/.desktop-build/development/home）
```

- 凭证：沿用现有缝，不在仓库内联明文。桌面登录后写入 `refs.THREEROUTER_API_KEY`（`DSH_HOME/.credentials.yaml`），生成/渲染走同一个 Key（`R-CFG-1`）。
- 真机契约测试开关：`DSH_IMAGE_VIDEO_LIVE=1`（每个用例 = 一次真实付费任务，跑之前确认）、`DSH_BROWSER_EXECUTABLE` 等按需。
- 媒体输出目录：沿用插件 `outputsDir` 配置（默认 `./outputs`），工作台只登记引用，不复制字节（`R-TML-1`）。

## 3. 每个阶段的统一执行流程（六步）

1. **接需求**：从 `REQUIREMENTS.md` 取本阶段覆盖的 `R-*` 条目与验收标准；缺条目先补需求再写码。
2. **改代码**：按 `TASKS.md` 本阶段任务清单逐条做，一次只动一个任务的文件集（避免大杂烩提交）。
3. **本地验证**：`pnpm run typecheck && pnpm run test`，新增能力必须有对应单测（测试矩阵见计划 §10）。
4. **真机验证**：`pnpm run build` → 子模块对齐 → 右栏实机走一遍（含窄窗口、深浅主题）；涉及生成的用真实任务，记录任务 ID。
5. **文档与产物**：更新 `CHANGELOG.md`（Keep a Changelog）、必要时回填 `TASKS.md` 状态；`lib/` 一起提交。
6. **提交与打点**：commit message 用 `type(scope): 摘要`；在 `TASKS.md` 把任务勾上并注明 commit；确认回滚点（§6）。

## 4. 阶段执行要点（进入条件 → 主要动作 → 退出条件 → 回滚）

阶段目标/修改范围以计划 §9 为准，这里只写执行口径：

| 阶段 | 进入条件 | 主要动作（模块） | 退出条件（可判定） | 回滚 |
|---|---|---|---|---|
| 0 审计与方案 | — | 三份文档定稿；`R-*` 编号冻结；命名口径固定为 `dsh-image-video` | 本文档集可执行；决策项 D2–D7 有结论（D1 已定） | 文档删除，无代码影响 |
| 1 右栏工作台 | 阶段 0 定稿 | 新增 client 半边 + 右栏 tab + RPC 健康检查（计划 §15 最小切片） | 计划 §15 六条全过；插件禁用后无残留 | 删新增 client/host 文件 + 撤销 `exports['./client']` + 撤销构建产物 |
| 2 项目/素材/资源/任务 | 阶段 1 绿 | domain + services + storage + 现有生成链路登记适配 | `R-PRJ-1..4`、`R-MED-1..3`、`R-TSK-1..3`、`R-QCK-2..4` 验收通过 | 关掉登记适配层；项目存储目录可整体删除 |
| 3 预留能力边界 | 阶段 2 绿 | `availability: planned` 节点/资源位 + 不可运行提示 | `R-BND-4` 验收通过（不可伪造成功） | 移除 planned 节点条目 |
| 4 专业工作流 MVP | 阶段 3 绿 | 画布 + 图校验 + `WorkflowRunner` + 运行记录 | `R-FLW-1..8` 验收通过 | 隐藏模式 B 入口（画布代码保留但不可达） |
| 5 时间轴精剪 MVP | 阶段 4 绿 | 时间轴模型/预览/字幕/ffmpeg 导出 | `R-TML-1..6` 验收通过 | 隐藏模式 C 入口；导出实现保留 |
| 6 三模式联动 + Agent | 阶段 5 绿 | 素材互通、模式切换保状态、工具面 | `R-ENT-3`、`R-AGT-2..3`、`R-TML-4` 验收通过 | 移除新增工具注册（`ctx.effect` 内） |
| 7 稳定性与发布 | 阶段 6 绿 | 体积门禁、错误可操作性、真机导出证据 | `R-NFR-1..5` 验收通过 + 发布门禁（§7） | 版本回退到上一个已发布 tag |
| 8 项目包/资源包 | 阶段 7 绿 | 导出/导入 + 校验和 + 迁移 | `R-PRJ-5`、`R-COL-1` 验收通过 | 保留本地项目格式，包功能整块摘除 |

## 5. 验证命令与证据口径

产品仓库（插件）：

```sh
pnpm run typecheck
pnpm run test
pnpm run build          # 产物 lib/index.js + lib/client.js（新增）
```

Harness 开发工作区：

```sh
pnpm run build:plugins
# desktop 这个 profile 名被 CLI 独占（直接 dump 会报 "managed exclusively by the Electron application"），拷一份改名再 dump：
mkdir -p /tmp/dsh-dump/profiles
cp -R apps/desktop/.desktop-build/development/home/profiles/desktop /tmp/dsh-dump/profiles/workbenchcheck
DSH_HOME=/tmp/dsh-dump pnpm dsh --profile workbenchcheck --dump-config | grep -n -A3 "image-video"
pnpm --filter @deepseek-ai/dsh-desktop run dev
```

> CI 现状：产品仓库的 `.github/workflows/ci.yml` 只跑 `tsc --noEmit` + `pnpm run build`，**不跑 `pnpm run test`**。所以在 CI 补上测试步骤（T7-7）之前，`pnpm run test` 的绿灯只能由本地执行提供，不能当成 CI 证据。

右栏 UI 抽检（四态）：普通宽度 / 窄窗口自动 fullscreen / 深色 / 浅色 / 插件禁用后恢复。

现场检查脚本（默认只读，退出码 1 = 宿主未认到客户端半边，需重启宿主）：

```sh
node scripts/verify-workbench-tab.mjs            # 只读探测当前页面
node scripts/verify-workbench-tab.mjs --reload --shot /tmp/workbench.png
```

真实媒体流程抽检（8 步，计划 §11）：快速创作出图 → 快速创作出片 → 建角色/场景/道具/轨迹并绑素材 → 视频登记进项目 → 工作流里引用资源生成新视频 → 放入时间轴 → 导出 MP4 → 重开项目确认引用与导出结果仍在。

**证据口径**（计划 §10 末）：不以静态 UI、模拟进度条、成功弹窗作为完成证据；每个 `本方案实现` 的需求必须有可复现的验收（单测/契约测试/真机步骤 + 任务 ID）。

## 6. 回滚手册

| 层 | 回滚动作 | 验证回滚成功 |
|---|---|---|
| 客户端半边 | 删除 `src/client/**`、撤销 `package.json` 的 `./client` 出口与 `dsh.client` 声明、重建 `lib/` | 桌面启动无报错；右栏无本插件 tab |
| 宿主半边 | 删除 `src/host/**` 与新增服务注册；RPC/工具/store 全在 `ctx.effect()` 内则卸载即撤销 | 禁用插件后 RPC 调用失败、任务停止、事件不再推送 |
| 数据 | 项目格式带独立版本；迁移**只写新版本、不改写旧文件**；导入前校验和 | 回滚后仍能用旧版本读回原文件 |
| 桌面/profile | 不改 `LOCAL_PLUGIN_BUNDLES`；如需临时摘除，只动 profile 组合行 | `pnpm run dev:desktop` 能起、左中右布局正常 |
| 子模块指针 | `git checkout <上一 commit> -- plugins/dsh-image-video` 或 bump 回上一 SHA | Harness 工作区干净、能启动 |

回滚点约定：每个阶段结束打一个 tag（插件仓库 `v0.x.y-workbench-N`），阶段内每完成一个提交都是可回滚点。

## 7. 发布与回归门禁

1. 插件按自己的 semver 走（当前 `0.3.1`），`CHANGELOG.md` 记录；`lib/` 入库。
2. 发布前必过：`typecheck` / `test` / `build` 绿；client bundle 体积在上限内（阈值见 `TASKS.md` T7-1）；`private-plugins` 复制测试含 `clientEntry`。
3. 桌面真机：至少一台机器走完"真实媒体流程 8 步"，含一次导出 MP4；ffmpeg 口径按 `R-TML-7`（sidecar 或安装检测）给出结论。
4. 与 Harness 上游同步：只 bump 子模块指针；**不改 Harness core UI**；`peerDependencies` 区间跟随 Harness 预发布线（现 `^0.2.1-alpha.x`）。
5. 禁止为了让门禁变绿而放宽断言（沿用 fork 台账的口径）：红灯要么是真缺口，要么是需求变更，二者都要显式处理。

## 8. 排错速查

| 症状 | 首查 | 处理 |
|---|---|---|
| 桌面启动报 `client entry ... is not built` | `private-plugins.ts:84` | 先 `pnpm run build`（插件仓库）产出 `lib/client.js` 再提交；二者必须原子 |
| 右栏没有工作台 tab | ① 宿主是否在**启动后**扫过 `dsh.client`（实测：给已在跑的插件后加 `./client`，宿主不会重新扫描，重载渲染进程也没用）② `dsh.client` 声明与 `inject` ③ 注册是否在 `ctx.effect()` 内 | ① **重启宿主进程**（`pnpm run dev:desktop` / `start:desktop`）② 按审计 §4.1 两段式注册 ③ `--dump-config` 确认入口被解析；`__DSH_BOOT__.entries` 可确认宿主是否已在服务该客户端半边 |
| tab 出现但空白 | 组件抛错 / 主题变量缺失 / RPC 未就绪 | 先渲染骨架 + 健康检查，再挂业务；看宿主日志与 DevTools console |
| 生成任务卡在"运行中" | 轮询超时、进程被杀 | 任务状态机必须有 `中断`；刷新后按项目账本恢复（`R-PRJ-6`、`R-TSK-2`） |
| 工作台媒体预览 404 / 播放器空白 | `/outputs` 是否注册 | 该路由只在 `webServer.host === '127.0.0.1'` 注册；非本机宿主给"媒体预览不可用"提示（`R-NFR-6`），不要静默空白 |
| 导出失败 | ffmpeg 路径、磁盘、素材丢失 | 集中检测（`src/media/ffmpeg.ts` 目标位置），错误必须给"原因 + 下一步"（`R-NFR-4`） |
| 禁用插件后 tab / RPC 残留 | 返回的 disposer 没被释放 | `ctx.sidebarRightTabs.register()` 内部已经用 effect 托管：**调用放在插件 apply 顶层，不要再包一层 `ctx.effect`**——父包注释明确写着"从别的插件 apply 里在活动 effect 作用域内注册会无错卡住浏览器启动"；RPC 与监听器各自的 disposer 由本插件的 effect 释放 |
| 任务进度 / 项目列表不刷新 | 以为有宿主→客户端推送 | **`rpc.handle` 只有"客户端发起的单次调用"，没有通用推送通道**（`/plugins/events` 是 HMR 专用）。一致刷新走轮询/失效重查，或由插件自己开一条宿主 HTTP 长连接（`webServer` 允许挂住 `text/event-stream`） |

## 9. 文档与任务的维护规则

- 需求变更：改 `REQUIREMENTS.md` 的 `R-*`（编号不复用；废弃写原因），并同步 `TASKS.md` 的覆盖关系。
- 事实变化（代码/Harness 能力）：改 `DESIGN-AUDIT.md`，标注日期；审计结论变了要重估支持级别。
- 设计变化（数据模型/节点表/阶段边界）：改 `IMPLEMENTATION-PLAN.md`，并检查需求验收是否仍成立。
- 进度：只在 `TASKS.md` 勾状态，并附 commit/任务 ID；**不把进度散落到需求与设计文档里**。
- 完成定义（DoD）：任务验收全过 + 单测/契约测试绿 + 真机走过一遍 + `CHANGELOG.md` 有记录 + `TASKS.md` 已勾选。
