# Changelog

本文件记录 dsh-image-video 的版本演进。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增
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

### 变更
- `peerDependencies` 的 DSH 范围由 `*` 收紧为 `^0.2.1-alpha.1`（`dsh-tools` / `dsh-llm` / `dsh-credentials`），`devDependencies` 同步升到 `^0.2.1-alpha.1` 并补 `@deepseek-ai/dsh-agent`：`originalDimensions` 与凭证缝 `resolve` 需要 0.2.x 运行时

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
