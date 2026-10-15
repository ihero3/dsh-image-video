# Changelog

本文件记录 dsh-image-video 的版本演进。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 工程
- **Agent 自重启的安全化 + 紧急停止**：`scripts/agent-restart.sh`（一次性 detached 进程、900 秒冷却、并发锁、`--check` 自检、不经 launchd）与 `scripts/agent-stop.sh`（紧急停止，不触碰 App）。2026-10-15 用 `launchctl submit` 托管一次性脚本造成 164 轮循环重启，根因与处置写入 `EXECUTION.md` 事故记录


### 新增
- **浏览器半边与右栏工作台骨架**：插件首次提供 `./client` 出口（`dsh.client = { platform: 'web', inject: […] }`），在 Harness 右侧工作区注册自有 tab 类型（`kind: dsh-image-video-workbench`、`id: dsh-image-video`）与 guide 入口，并渲染工作台骨架：项目名称 / 保存状态 / 三模式切换（快速创作·专业工作流·时间轴精剪）+ 当前模式工作区 + 素材·资源·预览·任务四格。骨架用 `useTabInfo()` 读座位事实（可见性、是否全屏）并以 `data-*` 暴露。客户端 bundle 是模块加载器的 CJS factory 包装，react/react-dom/cordis 与 `@deepseek-ai/dsh-client-*` 全部外置（由宿主模块表解析）
- **图校验（T4-3 的共享半边）**：`validateWorkflow()` 检查必填参数、端口类型兼容、自环、悬空连线、环（三色 DFS，消息给出回路）与 planned 节点不可运行；画布实时显示校验结果并给问题节点标红。宿主在运行前的同源拒绝随运行器（T4-4）接线
- **工作流文档持久化 + 台账本去重端点**。**现场验通（2026-10-15）**：进入工作流模式读回既有流程 → 加 2 节点 → 保存态 saved → 刷新页面重进读回同一张图；素材面板「整理重复记录」把历史重复 14 条合并为 4 条：`workflows/list|save|remove`（进入工作流模式读回该项目文档，画布改动 0.8s 去抖静默落库，保存四态暴露在 `data-workflow-save`；结构校验含种类、坐标有限性、连线两端存在、自环拒绝与规模上限）；`maintenance/compact` 把幂等上线前留下的重复素材记录合并（只删记录不动文件），素材面板加「整理重复记录」。jsdom 缺口（`ResizeObserver`）统一到 `tests/setup-dom.ts`
- **台账本整理工具**：`scripts/compact-workbench.mjs` 按（项目, 文件）去重（只删记录、不动文件，写回前备份）。注意宿主把台账本缓存在内存，运行中的宿主请勿外部改文件——宿主内去重端点列入下一批
- **工作流画布 v0（阶段 3/4 起步）**：接入 `@xyflow/react@12.12.0`（精确版本，内联进客户端产物；官方样式表由 `scripts/sync-canvas-style.mjs` 内嵌注入，因为客户端模块加载器只加载 JS）。节点目录为画布与宿主共用：12 个可运行节点 + 3 个 `planned`（口型同步/换脸/语音合成）在列表里可见、禁用并注明原因（阶段 3 的"预留能力边界"）；`video-generate` 按 `D7` 承载参考视频与 `compare`，模型名留空由宿主默认；画布顺序：节点库 → 画布 → 节点参数面板，支持加/选/拖/连/删与「适配窗口」。`WorkflowRecord` 是画布维度的唯一事实源，**瞬时选择不入库**（有测试锁住文档字段集合）；planned 节点按 `T3-2` **可放进图并保存**、卡片与参数面板如实标注「未提供」与原因（不做假装能跑的 UI）
- **项目改名自动保存**：停止输入约 0.9 秒后自动落盘（手动「保存」仍在，四态照旧）；新增守护测试确保**客户端产物里不含任何绝对路径、服务商或模型名**——默认模型/尺寸/时长/输出目录一律来自宿主配置
- **登记幂等与产出跳转**：`assets/attach` 对同一（项目, 路径）幂等——重复登记返回已有记录并透出 `created: false`，界面提示「该产物已登记过」而不是再建一条；任务面板的每一行都可直接点开产出（已登记则选中对应素材，未登记则按路径在预览面板临时查看）
- **真实的任务取消、运行中状态与重启恢复**；运行中的行会带上**请求里已知的模型与提示词**（不再是「运行中 · —」）：生成开始即写 `running` 记录（工作台立刻可见），结束写 `succeeded`/`failed`；`GenerationRegistry` 为每次生成注册可取消句柄，并把「取消信号」与「工具执行信号」取并集交给工具——UI 的「取消任务」因此真的会中止提交/轮询（而不是只改账本），账本落 `cancelled`；宿主启动时把上次进程遗留的 `running` 条目标为 `failed`（说明被重启中断），避免永远显示运行中。素材面板同时支持按媒体类型筛选（全部/只看图片/只看视频）
- **创作资源面板与项目改名**：资源记录支持角色/场景/道具/品牌/风格/音色六类（名称与备注校验、按项目列出、按种类过滤、删除二次确认、删除项目时级联记录），面板可直接新建与删除；项目支持**改名**并新增**保存状态四态**（已保存/保存中…/有未保存改动/保存失败，根节点 `data-workbench-save` 暴露）。右栏四个面板至此全部可用
- **任务账本与任务面板**：生成工具经 `withTaskLedger` 包装后**自动入账**（成功记 provider/model/产物路径/字节数，失败记错误原文；账本写失败只告警、绝不影响生成）。账本落在同一份 `workbench.json`，`tasks/list`（可按项目过滤）与 `tasks/assign` 端点对外；右栏任务面板显示状态/模型/大小/时间，并可一键把某次生成的产物**登记为当前项目素材**
- **工作台首个可用切片（阶段 2）**：右栏现在能真正操作——新建/选中/删除项目（二次确认）、把 `outputs/` 里最新未登记的产物登记为项目素材、点选素材在预览面板内联查看图片/视频（走只读 `/outputs` 路由）、删除素材记录（只删记录、不动文件）。宿主侧新增 `WorkbenchStore`（单 JSON 文档 + tmp+rename 原子写，`<outputsDir>/../image-video-workbench/workbench.json`）与 `/image-video` 通道端点 `projects/list|create|remove`、`assets/list|attach|remove`、`outputs/list`；客户端新增 `createWorkbenchApi` 封装。
- **工作台 RPC 健康检查**：宿主侧注册 `/image-video` 通道（`connection.rpc.handle`，随 fiber 卸载撤销）；端点 `health` 回报插件名、版本、通道名、生效服务商与已解析的输出目录；未知端点按连接的 envelope 结构化拒绝，不抛异常、不泄漏凭证
- **客户端 RPC 接线与健康状态展示**：`inject` 增加 `connection`；骨架挂载时调用 `/image-video` 通道的 `health`，头部显示「版本 · 服务商」（连接中/失败各有文案，原始报错只进 `title`），并以 `data-workbench-health` 暴露状态；通道名与健康结果类型抽到 `src/workbench-contract.ts`，两个半边共用，浏览器 bundle 不带宿主代码
- **`PLUGIN_VERSION` 与一致性守卫**：版本常量集中一处，`tests/version.test.ts` 与 `package.json` 对账

- **图片参考图体积守卫**：本地参考图解析出的 data URL 超过 4MB 时，先用 sharp 等比缩到长边 2560 并转 JPEG(q88) 再提交（媒体模式注入/图生图两组入口都走这条链）。手机原图直传时 data URL 比原文件还大约 1/3，此前会撞网关/上游的请求体上限或被拖到超时；压缩不可用时原样提交，交由服务端报错
- **凭证缝引用（`apiKeyEnv`）**：`ProviderCredentials` 新增 `apiKeyEnv`；`apiKey` 留空时按该引用经 `ctx.credentials` 解析（如桌面端登录后写入的 Key），配置里不必内联明文。取值优先级为「明文 `apiKey` > 引用解析值」，两者都取不到按未配置响亮报错；候选服务商过滤改用 `hasConfiguredCredentials`（明文或引用任一非空即已配置），只声明引用的部署不会再被跳过。`resolveProviderCredentials` / `resolveActiveProvider` 因此变为异步并接收 `ApiKeyResolver`
- **媒体模式注入（`mediaMode`）**：`/image-video/defaults` 协议新增 `mediaMode`（`text` / `image` / `video`）；composer 切到图片/视频 tab 后，插件在 `agent/pre-step` 追加一条指令消息（`source.kind = 'image-video.media-mode'`），要求模型直接调用 `generate_image` / `generate_video` 并带出当前生效参数。门控：只在 `next()` 成功且本步带来新的用户输入时注入（工具循环不重复），子代理（`origin === 'subagent'`）不继承主会话模式；`text` 与未设置不注入
- `generate_image` 输出 schema（`image` 与 `previewImage`）声明 `originalDimensions`，并在重建附件引用时透传
- `generate_video` 支持**参考视频（视频编辑）**：`media` 条目新增 `video` 字段，传 `{ video: … }` 即把参考视频交给 `wan3.0-video`（All-in-One 模型），配合提示词中的编辑意图（"替换 / 改成 / 去掉"等）保留原片构图与动作、只改写指定主体或元素。存在参考视频时缺省 `model=wan3.0-video`、`aspectRatio=adaptive`、`duration=-1`（保持原片时长）
- `media` 条目支持显式 `type`（`first_frame` / `last_frame` / `reference_image` / `reference_video`），不再只能靠 `position` 推断；条目既无 `image` 也无 `video` 时响亮报错
- `duration` 接受 `-1`：保持参考视频原时长 / 交由模型智能决定
- 新增 `resolveReferenceVideo`：本地参考视频提交前经 ffmpeg 裁到 ≤15 秒、长边 ≤1280、CRF 32 并转 data URL；压缩后仍超过 6MB 时响亮报错而不是提交巨型请求体（threerouter 无上传端点，2026-09-22 探测 `/v1/files`、`/v1/uploads`、`/v1/assets` 全 404）
- 新增 `REFERENCE_VIDEO_CAPABLE_MODELS` 能力表（`src/runtime-defaults.ts`）与真机契约测试 `tests/live-video-edit-contract.test.ts`（`DSH_IMAGE_VIDEO_LIVE=1` 显式开启，一次运行 = 一个视频任务）
- 新增**原片 / 复刻对比片**（`src/compare.ts`）：存在参考视频时缺省（`compare: true`）额外产出一条对比片并写回 `output.comparePath`。**方向按原片画幅自动选择**——竖屏（3:4、9:16，`height ≥ width`）左右并排，横屏（4:3、16:9，`width > height`）上下堆叠；两侧等比缩放、统一 30fps、按较短者截断，命中常见系统字体时叠加 `ORIGINAL` / `AI RECREATED` 角标。合成失败只写 `notes`，不影响复刻结果
- 新增分段复刻工作流与真机契约测试 `tests/live-video-edit-segments.test.ts`：单次视频编辑任务实测只产出约 5 秒（15 秒参考片同样只回 5 秒），长片必须切段（建议每段 ≈4.4 秒）并行提交后再拼接；该测试的轮询对瞬时网络错误容错——任务在服务端继续跑且结果保留 24 小时，此前一次 `fetch failed` 会丢掉整批已付费任务的结果

### 修复
- **`originalDimensions` 透传**：DSH 0.2.x 起附件服务缩放大图时会带上该字段，此前手写 schema 未声明，`generate_image` 会以 `returned invalid output` 失败，已生成的图被丢弃
- `generate_image` 结果行的**生成模式**改由预检查结论驱动：参考图经 `images` 数组或对话粘贴传入时，不再误报为「文生图」（此前结果行只判断单图入参 `image`）
- `generate_image` 结果行的**尺寸**改取始终提供的 `previewImage`：路由不支持图片输入（纯文本模型）时不再退化成「未知尺寸」
- `generate_image` 的**对话参考图**只取最新一条用户消息：不再把历史轮次里粘贴过的图片静默当作本次参考图（此前实现会扫描整段历史，与本文件与工具描述声明的「只取本轮」不符）

- **RPC 通道名不合规（现场抓出）**：原用 `/image-video/workbench`，而连接层的通道必须是单段路径（`/^\/[A-Za-z0-9._~-]+$/` 且不得占用 `/api`）——宿主 `rpc.handle` 在插件注册时即抛错、浏览器调用被 `invalid RPC target` 拒；改为 `/image-video` 并加守护测试。stub 版单测因替身 `handle` 不校验而漏掉，是桌面现场检查才暴露的

### 变更
- **决策 D1–D7 全部落定**：D1（命名一律 `dsh-image-video`，不另起产品名/不加第三个包）已落地——全仓 `grep dsh-media` 为 0；D2–D7 采纳文档建议值（硬删除+二次确认+引用守卫 / V1 检测+提示、发布前再评 sidecar / 锁 `@xyflow/react` 精确版本 / JSON 清单+素材目录 / 只做音色元数据 / `video-generate` 承载参考视频编辑），并在 `docs/REQUIREMENTS.md` §14 写明各自最晚复核点
- `peerDependencies` 的 DSH 范围由 `*` 收紧为 `^0.2.1-alpha.1`（`dsh-tools` / `dsh-llm` / `dsh-credentials`），`devDependencies` 同步升到 `^0.2.1-alpha.1` 并补 `@deepseek-ai/dsh-agent`：`originalDimensions` 与凭证缝 `resolve` 需要 0.2.x 运行时
- **依赖对齐（修掉一根红基线）**：`@deepseek-ai/schemastery` 由 `^3.18.1` 提到 `^3.18.5-alpha.1`——与 dsh-0.2.1 线 devDeps 传递来的那一份统一，消除"两份 schemastery 并存"导致的 `z<T>` 注解冲突与 `TS2742`；`pnpm-workspace.yaml` 的 `allowBuilds.esbuild` 从占位符改为 `true`（此前 esbuild postinstall 被静默跳过）。对齐后 `pnpm run typecheck` 由红转绿
- **构建改为双面**：`build = clean && tsdown（宿主角 + 客户端角）&& tsc -p tsconfig.client.json`；`bundle` 复用 `build`（Harness 根 `build:plugins` 直接可用）；`files` 纳入 `lib/client/**` 与 `lib/types/client/**`
- **README 与源码注释口径收敛**：视频时长上限统一为 1–30 秒（原注释/README 写 1–10）、`pollTimeoutMs` 默认 600000（原写 300000）、参考视频上限如实写为"上游文档声明 + 本地只强制 ≤15 秒 / 压缩后 ≤6MB"、`runtime-defaults` 的"六个字段"改回"七个字段"、`http-client.ts` 指向的契约文档名修正、`image-preflight` 去掉"threerouter 是唯一异步图片服务商"的过期断言、`media.ts` 陈旧注释改为与实现一致（是否注入模型可见 image 块由路由能力决定）
- **文档**：新增 `docs/REQUIREMENTS.md`（需求 + 验收 + 追踪矩阵 + 16 条实现前必须收敛的事实）、`docs/EXECUTION.md`（工作区/环境/执行流程/验证证据/回滚/发布/排错）、`docs/TASKS.md`（59 个原子任务的唯一进度账本）

## [0.3.1] - 2026-09-20

### 变更
- **构建产物随仓库提交**：`lib/index.js` 与 `lib/index.d.ts` 入库（`.gitignore` 移除 `lib/`），移除 `prepare` 脚本（保留 `build`，新增 `prepublishOnly`）。此前以 git 安装会因 pnpm 的 `allowBuilds` 拦截 `prepare` 而报 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`，需手动"允许并重试"；现在 `dsh plugin add github:ihero3/dsh-image-video` 一次装好
- **peerDependencies 改为 `*` 且标记 `optional`**：此前的 `^0.1.1-rc.2` 按 semver 预发布规则不匹配 harness 的 `0.1.6-alpha.2`；而 `optional: false` 会让 pnpm 到 registry 自动拉取 peer 链（实测因 `@deepseek-ai/dsh-type-meta` 未发布而 404，或在可解析时装出第二份 `dsh-tools`/`cordis` 与宿主并存）
- 类型声明路径由不存在的 `lib/types/index.d.ts` 修正为实际产物 `lib/index.d.ts`（`types` / `exports.types` / `files` 三处）；`tsdown.config.ts` 固定 dts 文件名，避免内容哈希导致路径漂移
- 文档同步：说明 `lib/` 已随仓库提交、消费方无需构建；`CONTRIBUTING` 增加"改 `src/` 后必须重新构建并提交 `lib/`"的约定

## [0.3.0] - 2026-08-21

### 变更
- `generate_image` 工具结果不再向模型返回 `image` 内容块，改为纯文本摘要（本地路径、服务商、尺寸、大小），修复纯文本模型生成图片后下一轮请求 400（`unknown variant 'image_url', expected 'text'`）的问题
- 图片字节仍通过 attachment 服务持久化，附件引用改经 `output.presentationMeta` 持久化为 UI-only 数据（`tool/result` 事件 `meta` 字段），对模型不可见，客户端可消费做内嵌渲染
- `media.ts` 拆分为 `saveImageAttachment`（持久化附件引用）与 `createImageSummaryText`（模型可见文本），原 `createImageContent` 移除
- 文档与工具描述同步更新：图片"内嵌渲染在对话中"→"模型只见文本摘要，附件走 UI-only 通道"

### 修复
- 修复：使用不支持图片输入的对话模型（如 pi-ai 的 threerouter 网关）时，`generate_image` 成功生成图片后，会话的后续请求因历史含 `image` 块而持续 400，会话无法继续

## [0.2.0] - 2026-08-20

### 变更
- 阿里系服务商统一使用 万象 wanx（阿里云百炼）：`provider` 取值 `'wanx'`，配置字段 `wanx:`，适配器 `wanxAdapter`（文件 `providers/wanx.ts`）
- `generate_video` 默认模型改为 `wan2.2-t2v-plus`（无需开通独立产品即可使用）
- 默认图片尺寸改为 `1024*1024`（百炼接口要求 `*` 分隔，`1024x1024` 会报 "size is not in the correct format"）
- 文档、工具描述、报错文案中的表述统一为 万象 wanx
- Seedance2.5 相关代码与配置保持不变

## [0.1.0] - 2026-08-20

首次发布。文生图与文生视频工具插件，支持 万象 wanx（阿里云百炼）与 Seedance2.5（火山引擎）服务商切换。

### 新增
- `generate_image` 工具：文生图，wanx / Seedance2.5 切换，结果内嵌对话并落地 `outputs/`
- `generate_video` 工具：文生短视频（上限 10s），后台异步轮询不阻塞对话，结果落地 `outputs/`
- 配置 Schema：`provider` 切换、API Key、自定义 baseURL、默认图片尺寸、默认视频时长、超时、重试次数、outputs 目录
- 统一 HTTP 客户端：异常分类（鉴权/配额/任务/超时/网络）+ 中文友好提示 + 可配置重试
- 异步任务管理器：基于 `ctx.effect` 托管轮询生命周期，卸载自动取消任务 + 清理定时器
- 媒体渲染模块：图片通过 attachment 服务内嵌，视频返回本地文件链接
- `cordis.patch.yml`：`- insert` 新增 `image-video` 行，不覆盖现有插件
- 双安装方式：本地文件夹 `dsh plugin add ./` + GitHub `dsh plugin add github:ihero3/dsh-image-video`

### 服务依赖声明
- `tools`（必需）：`inject = ['tools']` 顶部声明
- `attachments`（generate_image 必需）：`ctx.inject(['attachments'], cb)` 显式声明，服务撤销时自动注销工具
