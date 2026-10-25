# dsh-image-video Design Audit

阶段 0 审计日期：2026-10-12。

本文只记录从当前工作区和已读取的飞书参考文档中确认的事实，不修改产品代码。目标是在 `dsh-image-video` 插件内部增加视频创作工作台，同时保留当前快速创作链路。工作台不是新的产品包、运行时或前端，而是现有插件的宿主半边与客户端半边。

## 1. 审计范围和版本

| 对象 | 当前值 |
|---|---|
| 产品仓库 | `/Users/guxiongjian/Documents/code/dsh-image-video` |
| 产品仓库 HEAD | `478832a687ca55f3305eb07a70dd42462dc8872a` |
| 产品包版本 | `0.3.1` |
| Harness 仓库 | `/Users/guxiongjian/Documents/code/deepseek-harness` |
| Harness HEAD | `66b9ab79f78c8719a42782a2fd8a6ecd6c7caf8a` |
| Harness 包版本 | `0.2.1-alpha.2` |
| 参考文档 | 飞书「模力漫AI『使用指引』」`https://cqbuerdt.feishu.cn/wiki/CKDfwyKy8ikr23kMLEjcI7xcnPc` |
| 本机媒体工具 | `ffmpeg 8.0`、`ffprobe` 可用（`/opt/homebrew/bin`） |

工作区状态：

- `dsh-image-video` 当前工作区干净，`main...origin/main`。
- Harness 当前工作区干净，`master...origin/master`。
- Harness 中 `plugins/dsh-image-video` 是指向独立产品仓库的 Git 子模块，产品源码事实源仍是 `/Users/guxiongjian/Documents/code/dsh-image-video`。
- Harness 另有 `plugins/dsh-plugin-threevideo`，它承担当前桌面快速创作的输入框媒体 tab、参数传递和结果卡片，是 dsh-image-video 必须对接的相邻插件。

## 2. 参考文档提取出的视频能力

参考文档是产品使用指引，不是 Harness 架构文档。与本次视频工作台直接相关的功能如下：

| 能力组 | 文档中的功能 |
|---|---|
| 项目与媒体素材 | 项目、剧集、上传图片、生成图片、视频、音频、字幕、成片预览与下载 |
| 创作资源库 | 角色、场景、道具/物品、音色、品牌/产品、视觉风格、模型预设 |
| 角色动作与轨迹 | 角色动作、镜头运动、主体移动路径、主体切换、首尾帧过渡 |
| 图生视频 | 上传或选择图片，填写视频名称、模型、比例、时长、分辨率、生成数量，提交异步任务 |
| 首尾帧视频 | 指定首帧和尾帧，补充过渡描述，控制镜头运动、主体动作、场景变化 |
| 参考生视频 | 使用角色、场景或产品资源约束输出 |
| 文生视频 | 输入画面提示词，可选参考音频，设置模型、比例、时长、分辨率、数量 |
| 视频后处理 | 对口型、AI 换脸、命名、下载、删除、继续处理 |
| 成片能力 | 高光解说、高光混剪、导出、镜头编排、字幕、音频、多镜头一致性 |
| 资源范围 | 项目资源、团队资源、公共资源；同一模型适用于角色、场景和道具 |
| 模型选择 | 文档列出多档生视频模型，按速度、清晰度、动作、口型、一致性、镜头控制等能力分层 |

### 2.1 支持级别

方案使用四级状态，避免把“有入口”误写成“已实现”：

| 级别 | 含义 |
|---|---|
| `已有` | 当前 `dsh-image-video` 直接具备 |
| `本方案实现` | 本方案要求真实可用并有验收测试 |
| `预留接口` | 数据模型和 UI 位置保留，但没有真实执行器时不得运行 |
| `后置` | 不进入当前阶段，只记录依赖 |

飞书参考能力的决策如下：

| 能力 | 支持级别 | 决策 |
|---|---|---|
| 项目与媒体素材 | `本方案实现` | 项目、素材引用、保存恢复、跨模式复用 |
| 角色、场景、道具、品牌、风格资源 | `本方案实现` | 建立可复用资源库，资源引用媒体素材 |
| 音色资源 | `本方案实现` | 管理音色元数据和试听素材；语音合成取决于接入的 TTS 服务商 |
| 角色走动与镜头轨迹 | `本方案实现` | 管理可复用轨迹模板与镜头绑定；模型是否严格遵循轨迹由服务商能力决定 |
| 文生、图生、首尾帧、参考生视频 | `已有` | 直接复用现有 `generate_video` 协议 |
| 视频编辑与对比片 | `已有` | 直接复用现有 `media[].video` 与 `compare` 协议 |
| 字幕轨与烧录 | `本方案实现` | 时间轴字幕轨与 ffmpeg 导出 |
| 对口型 | `预留接口` | 节点和资源绑定预留，接入真实服务商前不可执行 |
| AI 换脸 | `预留接口` | 只保留资源类型与节点位置，不提供假执行 |
| 配音 | `预留接口` | 音色资源可管理，合成节点等待 TTS 服务商 |
| 高光解说、高光混剪 | `预留接口` | 预留模板位置，不进入首个可用闭环 |
| 团队与公共资源 | `后置` | 数据模型保留范围字段；第一版只做本地项目资源 |
| 角色训练和多镜头强一致性训练 | `后置` | 仅通过参考图和资源引用实现可达到的一致性 |

这些能力不能全部在第一版实现。阶段方案把“本地生成闭环、媒体素材复用、本地资源库、可保存项目、可导出成片”设为可用目标，把团队服务、角色训练和批量生产服务器等能力后置。

### 2.2 本地优先边界

`dsh-image-video` 是 DeepSeek Harness Desktop 的本地插件，第一版不建设产品自有云端，也不要求用户登录团队账号才能创作。

本地优先表示：

- 项目、媒体素材、创作资源、工作流、时间轴和任务记录保存在本机。
- API Key 继续通过 Harness 凭证缝保存在本机，不进入项目包、资源包或日志。
- 图片/视频模型请求属于服务商调用，不是产品云同步。
- 断网时仍可打开项目、编辑工作流、剪辑时间轴和查看已生成素材。
- 导出、复制和协作传递使用普通文件或可选网络目录，不依赖专有云服务。

这里不把“通过服务商生成媒体”误称为云端团队功能；它只是模型能力的外部依赖。

### 2.3 团队合作分层

团队合作不是当前实现目标。第一版只处理本地单人完整闭环，并为文件交接预留格式；局域网和团队协作只在未来讨论。

| 层级 | 典型方式 | 是否需要服务器 | 冲突风险 | 建议 |
|---|---|---|---|---|
| L0 本地单人 | 本机项目目录、本地资源库 | 否 | 无 | 第一版必须完整可用 |
| L1 文件交接 | 导出项目包、资源包、媒体包；复制到另一台电脑 | 否 | 覆盖、合并 | 第一版设计包格式，后续实现导入导出 |
| L2 平台化团队协作 | 复用 Threevideo 账号、项目/资源服务、权限、同步与任务能力 | 是，由 Threevideo 服务端承载 | 实时一致性、权限、审计、平台适配 | 以后再说；若启动，优先复用 Threevideo，不由插件自建云 |

推荐顺序：

1. 先把 L0 做扎实：项目、媒体素材、资源、任务、工作流、时间轴和导出全部本地可用。
2. 再做 L1：定义可移植的项目包、资源包和媒体包格式，保证两台电脑之间可以复制和导入。
3. L2 暂不排期。以后讨论团队能力时，只考虑复用 Threevideo 平台，不设计插件自建团队服务。

### 2.4 团队功能是否需要

当前判断是：

- 核心视频创作、媒体素材管理、资源库、工作流、时间轴和本地导出：**必须做**。
- 项目包和资源包的复制、导入、导出：**应预留并优先考虑**。
- 多人实时协作、云端媒体库、团队权限和账号体系：**后置，不进入第一版；若未来实现，优先由 Threevideo 平台承载**。

原因是当前产品边界是 DeepSeek Harness Desktop 的本地插件。若由插件自行建设云服务，会把项目存储、资源解析、任务队列、媒体访问和权限全部推倒重来，违背“最小化修改宿主、优先本地插件”的原则。Threevideo 已经有账号和模型服务入口，未来更适合承载团队身份、服务端资源和跨设备同步；本地插件只保留协议适配和本地缓存。

## 3. 现有产品代码的真实调用链

### 3.1 模型工具：生成能力的后端

`dsh-image-video` 当前实际注册两个模型可见工具：

| 工具 | 文件 | 已实现能力 |
|---|---|---|
| `generate_image` | `src/tools/generate-image.ts` | 文生图、图生图、参考图、异步找回、水印、附件渲染 |
| `generate_video` | `src/tools/generate-video.ts` | 文生视频、首帧图生视频、多关键帧、参考视频编辑、对比片 |

`generate_video` 的关键事实：

- 参数包含 `prompt`、`duration`、`model`、`aspectRatio`、`image`、`media`、`resolution`、`compare`。
- `media[]` 支持 `first_frame`、`last_frame`、`reference_image`、`reference_video`，足以承载首尾帧和参考生视频的基础协议。
- 提交后固定走 Threevideo；候选服务商逻辑在 `src/runtime-defaults.ts` 中固定为 `threevideo`。
- 任务通过 `TaskManager.pollUntilDone()` 异步轮询，完成后下载到 `outputsDir`。
- 产出是本地 `.mp4` 路径，参考视频编辑时还可额外生成一条对比片。
- 工具输出含 `provider`、`model`、`mode`、`duration`、`resolution`、`localPath`、`sourceUrl`、`bytes`、`elapsedMs`、`notes`、可选 `comparePath`。

因此，供应商接入、异步任务提交、轮询、下载、首尾帧素材转换和视频编辑提交已经存在，不应重写。

### 3.2 任务生命周期：现有轮询层

`src/task-manager.ts` 当前提供：

- 以 `ctx.effect()` 注册卸载清理。
- 以 `AbortSignal` 取消正在进行的生成任务。
- 只读轮询瞬时失败重试，超过阈值后把服务端 `task_id` 写入错误。
- 单任务完成后返回媒体 URL 和耗时。

它不等同于 Harness 的通用后台任务系统：`TaskManager` 只管理一次工具调用内部的轮询，不提供跨页面刷新恢复、可查询任务列表或项目级任务历史。

### 3.3 文件与媒体：现有落盘和预览

| 模块 | 事实 |
|---|---|
| `src/media.ts` | 统一下载与写入；本地参考图/视频经 ffmpeg 预处理；媒体文件名以内容或请求生成 |
| `src/media-route.ts` | 仅在 `webServer.host === 127.0.0.1` 时注册 `/outputs` 只读路由 |
| `src/runtime-defaults.ts` | 注册 `/image-video/defaults` 回环路由，保存内存态 provider、比例、尺寸、风格、时长、媒体模式 |
| `dsh-plugin-threevideo/src/client/media-toolview.tsx` | 通过 `/outputs/<basename>` 渲染本地图片和视频，并提供复制路径、打开所在目录、用系统应用打开 |
| `dsh-plugin-threevideo/src/client/composer-media-tabs.tsx` | 提供文本/图片/视频模式切换和参数下拉，向 `/image-video/defaults` 写入运行时值 |

这里已经有一条完整但窄的“输入框 → 模型 → 工具 → 本地文件 → 对话卡片 → 系统播放”链路。dsh-image-video 应把这条链路作为模式 A 保留，而不是替换。

### 3.4 现有代码没有提供的能力

以下能力在当前产品仓库中不存在或没有充分实现：

- 项目实体、项目列表、项目版本迁移和项目级锁。
- 稳定素材 ID、素材引用图、素材筛选和引用关系检查。
- 跨模式共享的统一任务列表和刷新后恢复语义。
- 专业工作流定义、节点执行器、运行 ID、节点执行 ID、依赖校验和运行记录。
- 多轨时间轴、片段入出点、播放头、字幕轨、音轨和撤销重做。
- 基于固定时间轴快照的 MP4 渲染任务和进度上报。
- 对口型、换脸、配音、背景音乐、字幕生成等后处理节点。
- 右侧工作台 UI 插件和宿主 RPC。
- Agent 查询项目、素材、工作流、时间轴和渲染任务的业务工具。

### 3.5 可确认的 FFmpeg 能力现状

当前产品仓库只在两条预处理路径直接使用 ffmpeg：

- 首帧图片过大时缩放并转 JPEG。
- 参考视频过大时截到 15 秒、缩放到 1280 长边并转码。

另有一条对比片合成路径：

- `src/compare.ts` 用 `ffprobe` 读取画幅，用 `ffmpeg` 做 `hstack` 或 `vstack`。

没有多片段拼接、音频混合、字幕烧录、导出进度或渲染队列。时间轴导出可以复用外部 `ffmpeg` 依赖和现有错误处理方式，但必须新增独立渲染模块，不能把逻辑塞进 `generate-video.ts`。

## 4. Harness 宿主能力审计

### 4.1 正式右侧工作区扩展点存在

当前 Harness 有正式右栏包：

- 包：`packages/client/ui-sidebar-right`
- 服务：`ctx.sidebarRight`
- tab 注册表：`ctx.sidebarRightTabs`
- tab body seat：`sidebar.right.pane.tab`
- tab title seat：`sidebar.right.pane.tab.title`

注册方式是两段式：

1. `ctx.sidebarRightTabs.register({ id, kind, ... })` 声明 tab 类型。
2. `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: definition.id }, Body)` 注册内容。

当前右栏已经承载文件树、文档预览、浏览器、终端、计划、子代理等 tab。dsh-image-video 可以注册一个新的 tab，不覆盖现有 tab，也不需要修改右栏核心布局。

限制：

- 右栏状态按 `sessionId` 存在浏览器 `localStorage`。
- 一个 kind 最多一个 builtin 和一个 extension 注册；实现必须使用唯一的 `id`。
- tab 注册必须放在 `ctx.effect()` 中，插件卸载后自动撤销。
- 右侧面板没有任意“宿主页面 iframe”扩展示例，直接嵌入外部站点不符合现有架构。工作台应以 React 客户端插件实现。

### 4.2 浏览器插件必须提供 client 半边

Harness 通过 `dsh.client` 扫描已启用 Loader 条目并提供 `/plugins` bundle。外部包的 `package.json` 需要声明：

```jsonc
{
  "exports": {
    ".": { "types": "./lib/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" }
  },
  "dsh": {
    "client": {
      "platform": "web",
      "inject": ["@deepseek-ai/dsh-client-ui-sidebar-right"]
    }
  }
}
```

构建产物必须是客户端模块系统能加载的 bundle。Harness 仓库内部的 `clientBundle` tsdown preset 可用于本仓库工作区包；发布到独立仓库的插件需要像 `dsh-plugin-threevideo` 一样自行声明 bundle 包装格式。

### 4.3 宿主业务能力通过 RPC 暴露

`dsh-plugin-threevideo` 已经提供可直接复用的范例：

- 宿主：`connection.rpc.handle('/threevideo-auth', handler)`。
- 客户端：`connection.rpc.call('/threevideo-auth', 'getProfile', {})`。
- 注册返回 disposer，并放在 `ctx.effect()` 中，插件卸载时撤销。

推荐的 dsh-image-video 结构：

```text
右栏 client 插件
  └─ connection.rpc.call('/image-video', method, payload)
       └─ host 半边 connection.rpc.handle('/image-video', handler)
            └─ dsh-image-video 业务服务
                 ├─ project store
                 ├─ asset store
                 ├─ task service
                 ├─ workflow engine
                 └─ render service
```

这样右栏 UI 不直接读写文件，不持有密钥，不复制生成逻辑。

### 4.4 持久化能力存在，但需要产品模型

Harness 提供 `ctx.storageDomain`：

- `storage` 是 hub。
- `storage-json` 和 `storage-sqlite` 是后端。
- `storage-domain` 提供 schema 校验的 KV domain。
- 当前 base 组合已挂载 `storage`、`storage-json`、`storage-domain`。

dsh-image-video 可以声明自己的 domain，如 `media_projects_v1`，保存项目、素材引用、工作流、时间轴和任务元数据。大媒体文件继续保存在 `outputs/` 或项目媒体目录，不应进入 JSON/KV 记录。

### 4.5 Harness jobs 不是项目任务历史的替代品

Harness 的 `ctx.jobs` 是进程内后台任务 registry：

- 支持状态、进度、输出 ring、取消和等待。
- 记录在进程退出后消失。
- 每次启动要求有 controller owner。

dsh-image-video 需要两条不同的任务语义：

| 层 | 用途 | 推荐实现 |
|---|---|---|
| 进程内执行 | 当前提交、轮询、导出进程 | 使用 `ctx.jobs` 或 dsh-image-video 自己的运行控制器 |
| 项目任务记录 | 刷新、重开项目、跨页面显示状态 | 持久化任务记录到项目 domain，记录 `taskId`、状态、输出素材 ID、错误 |

不能只保存 `ctx.jobs` 的瞬时视图，否则刷新或重启后项目无法恢复任务历史。

### 4.6 Workflow 包不是可视化工作流的替代品

Harness 的 `@deepseek-ai/dsh-workflow` 运行模型编写的 JavaScript orchestration script，主要用于多条子代理任务编排。它不提供可视化节点画布、节点 schema 或任意业务节点的持久化定义。

dsh-image-video 的专业工作流需要自己的：

- React Flow 画布。
- 节点定义注册表。
- 连线和数据类型校验。
- DAG 执行计划。
- 节点执行器接口。
- 运行记录和结果缓存。

可以借鉴 Harness 的生命周期和事件原则，但不应把 `dsh-workflow` 当成完整实现。

## 5. 版本和依赖兼容性

| 依赖 | 当前事实 | 结论 |
|---|---|---|
| React | Harness 客户端目前使用 React 18 | React Flow 12 的 peer 要求为 React `>=17`，兼容 |
| TypeScript | 仓库严格模式，ESM | React Flow 类型可作为纯客户端依赖使用 |
| 包管理器 | 产品仓库使用 pnpm | 继续使用 pnpm，不引入 npm/yarn 锁文件 |
| 外部 `ffmpeg` | 本机存在；产品代码已有调用点 | 第一版继续使用外部二进制，不把二进制随插件仓库提交 |
| 桌面打包 | Harness desktop 当前不声明 ffmpeg sidecar | 发布桌面版前必须补打包和路径解析，或明确把 ffmpeg 作为运行前置条件 |
| `@xyflow/react` | npm 当前版本 `12.12.0` | 可以选为主版本，但实现前要锁定精确版本并跑客户端构建 |

## 6. 推荐架构

采用“一个产品插件仓库、两个运行半边、一个业务核心”的结构：

```text
dsh-image-video/
  src/
    host/                 Harness 宿主半边：注册服务、RPC、工具、生命周期
      plugin.ts
      rpc.ts
      project-service.ts
      asset-service.ts
      resource-service.ts
      task-service.ts
      render-service.ts
    domain/               与宿主无关的纯业务模型和端口
      project.ts
      asset.ts
      resource.ts
      track.ts
      task.ts
      workflow.ts
      timeline.ts
    providers/            复用 dsh-image-video 的供应商适配器
    tools/                模型可见工具
    client/               右栏 React 工作台
      plugin.ts
      MediaWorkbench.tsx
      modes/quick/
      modes/workflow/
      modes/timeline/
      assets/
      resources/
      tasks/
      styles/
  tests/
```

职责边界：

- `host/` 只能在宿主进程运行，持有文件、ffmpeg、存储和供应商密钥。
- `client/` 只能通过 RPC 调宿主，不直接访问文件系统或密钥。
- `domain/` 不依赖 React、Cordis 或 Harness，便于单测和未来替换存储。
- `AssetService` 管理实际媒体文件；`ResourceService` 管理角色、场景、道具、音色、风格和轨迹模板。
- `providers/` 复用现有适配器，先抽出稳定的生成端口再接入工作流和时间轴。

### 6.1 媒体素材与资源库不是同一层

“素材”在本文中限定为可加载、播放、剪辑或提交给服务商的媒体文件。资源库是可被复用的创作实体，一个资源可以引用零个或多个媒体素材。

| 层 | 示例 | 是否含媒体字节 | 主要用途 |
|---|---|---|---|
| 媒体素材 `Asset` | 生成图片、生成视频、上传音频、字幕文件、导出成片 | 是，文件或 URI | 预览、时间轴剪辑、生成输入、导出输出 |
| 创作资源 `Resource` | 角色、场景、道具、品牌、产品、音色、视觉风格、模型预设 | 否；通过 `assetIds` 引用 | 跨镜头、跨工作流保持语义和参考一致性 |
| 轨迹资源 `TrackResource` | 角色走位、镜头推拉摇移、主体切换、动作节奏 | 否；保存结构化模板 | 绑定到镜头或时间轴片段 |

资源类型：

```ts
type ResourceKind =
  | 'character'
  | 'scene'
  | 'prop'
  | 'brand'
  | 'product'
  | 'voice'
  | 'style'
  | 'model-preset'
  | 'motion-track'
  | 'camera-track'
```

角色示例：

```ts
interface CharacterResource {
  id: ResourceId
  kind: 'character'
  name: string
  scope: 'project' | 'team' | 'public'
  assetIds: AssetId[]
  description: string
  appearance: string
  costume: string
  voiceResourceId?: ResourceId
  defaultMotionTrackId?: ResourceId
  tags: string[]
}
```

场景示例：

```ts
interface SceneResource {
  id: ResourceId
  kind: 'scene'
  name: string
  assetIds: AssetId[]
  description: string
  environment: string
  lighting: string
  weather: string
  timeOfDay: string
}
```

道具示例：

```ts
interface PropResource {
  id: ResourceId
  kind: 'prop'
  name: string
  assetIds: AssetId[]
  description: string
  material: string
  scaleHint: string
}
```

轨迹资源示例：

```ts
interface MotionTrackResource {
  id: ResourceId
  kind: 'motion-track'
  name: string
  subjectResourceId?: ResourceId
  keyframes: Array<{
    tMs: number
    x: number
    y: number
    scale?: number
    rotationDeg?: number
  }>
  notes: string
}
```

轨迹边界：

- `MotionTrackResource` 和 `CameraTrackResource` 是可复用模板，不直接修改视频文件。
- 时间轴片段通过 `trackResourceId` 和 `trackParams` 实例化模板，编辑镜头只产生新的时间轴 revision。
- 现有 `generate_video` 没有独立轨迹参数时，轨迹只能转换成自然语言提示词或作为首尾帧/参考视频约束，结果层必须注明实际传输方式。
- 后续接入支持深度、姿态、运镜控制的服务商时，轨迹可映射到其真实控制字段，不能提前承诺模型会严格遵循像素级路径。

## 7. 模式 A/B/C 的复用策略

### 模式 A：快速创作

保留现有链路：

```text
composer 图片/视频 tab
  → dsh-plugin-threevideo 写 /image-video/defaults
  → agent/pre-step 注入生成指令
  → 模型调用 generate_image / generate_video
  → dsh-image-video 轮询和下载
  → dsh-plugin-threevideo 对话卡片播放
```

新增适配层：

- 结果落地时同时登记项目媒体素材引用。
- 当快速创作引用了角色、场景、道具或音色时，登记资源使用记录。
- 生成结果可由用户在对话卡片上“发送到工作台”或“放入时间轴”。
- 快速创作项目继续在聊天中存在，不强制新建项目；首次进入工作台时才创建默认项目。

### 模式 B：专业工作流

React Flow 负责交互，节点执行器负责真实调用：

- UI 只发送图定义、节点参数和运行命令。
- 宿主校验图、排序节点、创建运行。
- 节点执行器调用同一 `AssetService`、`ResourceService`、`GenerationService`、`RenderService`。
- 每个节点运行产生持久化执行记录、资源引用和结果素材 ID。

### 模式 C：时间轴精剪

时间轴保存的是媒体素材引用、轨迹模板实例化和剪辑指令，不是视频字节：

```ts
{
  version: 1,
  tracks: [
    { id, kind: 'video', clips: [{ assetId, startMs, inMs, outMs, volume, trackResourceId, trackParams }] },
    { id, kind: 'audio', clips: [{ assetId, startMs, inMs, outMs, volume, voiceResourceId }] },
    { id, kind: 'subtitle', clips: [{ text, startMs, endMs, style }] },
  ],
}
```

导出时创建时间轴快照，调用 `RenderService`，由 ffmpeg 按快照渲染 MP4。

## 8. 核心数据模型

推荐以稳定 ID 为中心，不使用数组下标跨记录引用：

| 记录 | 关键字段 |
|---|---|
| `ProjectRecord` | `id`、`name`、`version`、`createdAt`、`updatedAt`、`settings`、`workflowId`、`timelineId` |
| `AssetRecord` | `id`、`projectId`、`kind`、`uri`、`name`、`mimeType`、`bytes`、`width`、`height`、`durationMs`、`sourceTaskId`、`tags` |
| `ResourceRecord` | `id`、`projectId`、`kind`、`name`、`scope`、`assetIds`、`description`、`attributes`、`tags` |
| `TrackResourceRecord` | `id`、`projectId`、`kind`、`name`、`subjectResourceId`、`keyframes`、`notes` |
| `TaskRecord` | `id`、`projectId`、`kind`、`status`、`progress`、`error`、`createdAt`、`startedAt`、`finishedAt`、`outputAssetIds` |
| `WorkflowRecord` | `id`、`projectId`、`version`、`nodes`、`edges`、`updatedAt` |
| `WorkflowRunRecord` | `runId`、`workflowId`、`status`、`nodeRuns`、`startedAt`、`finishedAt` |
| `TimelineRecord` | `id`、`projectId`、`version`、`tracks`、`resourceBindings`、`durationMs`、`updatedAt` |
| `RenderRecord` | `id`、`timelineId`、`snapshotRevision`、`status`、`progress`、`outputAssetId`、`error` |

版本策略：

- 每个记录有 `version`。
- 项目打开时先做迁移，再交给业务层。
- 媒体文件不可变，项目记录通过新版本引用新的素材 ID。
- 删除媒体素材前扫描资源、项目、工作流和时间轴引用。
- 删除资源前扫描工作流、时间轴和项目默认绑定；被引用时拒绝或要求先替换。

## 9. 右侧工作台实现结论

结论：**不需要修改 Harness 主布局，也不需要复制其前端。**

实施路径：

1. 产品插件增加 `dsh.client` 声明和 `./client` 构建出口。
2. 客户端注册 `dsh-image-video` 右栏 tab 类型和 guide entry。
3. tab body 实现完整工作台，使用 Harness CSS 变量和 primitives。
4. 工作台通过 `/image-video` RPC 调宿主业务服务。
5. 宿主在 `ctx.effect()` 中注册和撤销 RPC、工具、任务清理和文件协议。
6. 卸载插件时，右栏 tab、RPC 和运行中的任务全部通过 disposer 释放。

推荐最小改动宿主为：**零改动**。最多需要在 Harness 自身的开发工作区增加一个 bundle patch 行把插件加入桌面 profile；该 patch 是组合配置，不是修改 core UI。

## 10. 风险和未决点

| 风险 | 影响 | 处理 |
|---|---|---|
| ffmpeg 只在开发机存在 | 打包桌面版后导出失败 | MVP 阶段检测并把缺失作为可操作错误；发布前决定 sidecar 打包或安装检测 |
| 当前 `TaskManager` 只覆盖一次工具调用 | 刷新后无法恢复任务 | 项目任务记录和 `ctx.jobs` 分开设计 |
| 外部视频服务无上传端点 | 大素材只能 data URL，受体积限制 | 工作台优先保留本地 `outputs/` 引用，生成时才做必要压缩 |
| 飞书文档包含大量产品功能 | 范围膨胀 | MVP 只做真实生成、媒体素材与资源复用、保存恢复和 MP4 导出 |
| React Flow 会带来画布状态和宿主无关状态 | 可能出现两套状态源 | 画布状态只有一个 `WorkflowRecord`，UI 的瞬时选择不进入持久记录 |
| 右栏空间有限 | 工作台在窄窗口不可用 | 复用右栏 fullscreen presentation；工作台自身做窄宽度布局 |
| 插件跨仓构建 | 版本漂移可能导致 bundle 无法加载 | 锁定 Harness peer 版本，CI 增加 `dsh --dump-config` 与客户端 bundle 加载 smoke |

### 10.1 桌面本地插件装载链路

当前 Harness desktop 不是只通过 profile patch 加载这两个插件，而是有明确的私有插件复制名单：

- `apps/desktop/src/project-manager.ts` 的 `LOCAL_PLUGIN_BUNDLES` 包含 `dsh-image-video` 和 `dsh-plugin-threevideo`。
- `apps/desktop/src/private-plugins.ts` 的 `PRIVATE_PLUGIN_NAMES` 同样列出这两个包。
- `apps/desktop/tests/private-plugins.spec.ts` 已测试 host entry、`cordis.patch.yml` 和 client entry 的安装校验。
- 复制逻辑读取包自身的 `exports["."].default` 作为 host entry，并在 `exports["./client"].default` 存在时自动复制 client entry。当前 `dsh-image-video` 没有 client export，因此 desktop 当前只验证 host entry。

因此，方案延续现有 `dsh-image-video` 包名，桌面装载名单无需新增产品名；只要新增 `exports["./client"]` 并构建出对应文件，桌面准备流程会自动识别并复制 client 半边。工作台、资源库、任务和渲染能力都作为现有插件的内部模块生长，不新增第三个私有包。

## 11. 审计结论

1. Harness 当前版本已经有正式右栏 tab 扩展点，不需要改宿主核心。
2. `dsh-image-video` 当前已有真实视频生成能力，缺的是项目、媒体素材、创作资源、任务、工作流、时间轴和渲染业务层。
3. 现有快速创作必须保留在两个插件之间的现有链路上，并通过适配层把结果登记到项目媒体素材。
4. `dsh-image-video` 应在自身新增宿主业务服务和客户端右栏工作台，二者通过插件自己的 RPC 命名空间通信。
5. 第一版 FFmpeg 导出可复用外部 ffmpeg，但发布前必须解决桌面二进制交付。
6. React Flow 与当前 React 18 兼容；它只负责画布，不能承担业务执行。
7. 阶段 1 应只做右栏和最小业务闭环，验证插件安装、禁用、重载以及媒体素材与资源引用后再进入画布和时间轴。

