# dsh-image-video Implementation Plan

本文是阶段 0 的实施计划，基于 `docs/DESIGN-AUDIT.md` 的真实代码审计。当前只定义方案，不开始功能开发。

计划目标：在现有 `dsh-image-video` 插件内部增加右栏视频创作工作台，用同一套项目、媒体素材、创作资源、任务和渲染能力完成“快速创作 → 专业工作流 → 时间轴精剪 → 成片导出”，并保持现有快速创作链路不变。插件名、包名、安装入口和运行时仍是 `dsh-image-video`，不新增独立产品包。

## 1. 总体原则

1. 保留现有 `generate_image` / `generate_video`、`/image-video/defaults` 和对话结果卡片。
2. 右栏工作台作为 Harness 客户端插件，不复制 Harness 前端，不嵌入独立网站。
3. 宿主业务能力放在 `dsh-image-video` 新增的宿主半边，右栏只通过插件自己的 RPC 命名空间调它。
4. 媒体素材、创作资源、任务、执行和持久化分开；React Flow 只做画布。
5. 长任务必须异步执行，刷新后由项目任务记录恢复状态。
6. 每个阶段都能单独构建、测试、回滚。
7. 第一版以本地单人使用为基线，不建设自有云端，也不把团队服务作为前置条件。
8. 团队协作先通过项目包、资源包和媒体包的文件交接实现；局域网共享和多人实时协作另行评估。

## 2. 建议的最终目录

第一版不追求一次性建成所有目录；以下目录是目标边界，按阶段逐步增加。

```text
src/
  index.ts                         # 现有兼容入口，继续导出当前公共 API
  host/
    plugin.ts                      # 新增宿主半边入口
    rpc.ts                         # /image-video RPC 路由
    context.ts                     # 业务服务装配
  domain/
    project.ts
    asset.ts
    resource.ts
    track.ts
    task.ts
    workflow.ts
    timeline.ts
    ids.ts
    ports.ts
  services/
    project-service.ts
    asset-service.ts
    resource-service.ts
    generation-service.ts
    task-service.ts
    workflow-runner.ts
    render-service.ts
  storage/
    media-domain.ts                # ctx.storageDomain 声明与迁移
    project-repository.ts
    asset-repository.ts
    resource-repository.ts
    track-repository.ts
    task-repository.ts
    workflow-repository.ts
    timeline-repository.ts
  media/
    ffmpeg.ts                      # 统一解析 ffmpeg / ffprobe，集中特性检测
    probe.ts
    render-timeline.ts
    subtitle.ts
  tools/
    media-tools.ts                 # 项目/素材/任务/工作流/时间轴工具
  client/
    plugin.ts
    MediaWorkbench.tsx
    rpc-client.ts
    state/
    components/
    modes/
      quick/
      workflow/
      timeline/
    locales.ts
    styles.ts
  providers/                       # 现有供应商适配器保留
  tools/
    generate-image.ts              # 现有工具保留
    generate-video.ts              # 现有工具保留
```

不移动现有 `src/providers/`、`src/media.ts` 和现有测试文件，除非后续阶段证明抽取端口可以删除真实重复代码。

## 3. 目标架构

```text
┌────────────────────────────────────────────────────────────┐
│ Harness browser client                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ dsh-image-video right-sidebar tab                          │  │
│  │  A 快速创作 | B 专业工作流 | C 时间轴精剪            │  │
│  │  媒体素材 | 创作资源 | 预览 | 任务 | 导出             │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │ connection.rpc.call('/image-video')│
└─────────────────────────┼──────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────┐
│ Harness host process                                       │
│  /image-video RPC                                             │
│    ProjectService                                           │
│    AssetService（媒体文件）                                 │
│    ResourceService（角色/场景/道具/音色/风格/轨迹）          │
│    TaskService                                              │
│    WorkflowRunner                                           │
│    RenderService                                            │
│      ├─ GenerationService → providers/                      │
│      ├─ storageDomain                                      │
│      └─ ffmpeg / ffprobe                                   │
└────────────────────────────────────────────────────────────┘
                          │
                  outputs/ + project media
```

## 4. 视频类型映射

飞书文档里的视频能力分成三类：现有工具已经支持的生成协议、本方案新增的工作台编排、以及需要外部服务商或后续阶段才能真实执行的能力。

| 参考功能 | 支持级别 | 处理方案 |
|---|---|---|
| 文生视频 | `已有` | 工作台直接调用 `GenerationService` |
| 图生视频 | `已有` | 从媒体素材选取首帧，提交 `first_frame` |
| 首尾帧视频 | `已有` | 选择两张媒体素材，生成 `first_frame` / `last_frame` |
| 参考生视频 | `已有` | 角色、场景、产品、风格资源解析为参考图或参考视频 |
| 参考视频编辑 | `已有` | 做“参考视频改写”节点 |
| 视频编辑对比片 | `已有` | 结果卡片和时间轴可选对比片 |
| 项目与媒体素材 | `本方案实现` | 项目、素材引用、保存恢复、跨模式复用 |
| 角色/场景/道具/品牌/风格资源 | `本方案实现` | 资源库记录引用媒体素材，供工作流和时间轴绑定 |
| 音色资源 | `本方案实现` | 资源管理和试听可用；语音合成取决于接入的 TTS 服务商 |
| 角色走动/镜头轨迹 | `本方案实现` | 轨迹模板可管理和绑定；当前生成阶段作为提示词约束 |
| 字幕轨与烧录 | `本方案实现` | 时间轴字幕轨与 ffmpeg 导出 |
| 对口型 | `预留接口` | 节点、输入输出和资源绑定预留，无真实执行器时显示不可用 |
| AI 换脸 | `预留接口` | 只保留资源类型与节点位置，不提供假执行 |
| 配音 | `预留接口` | 音色资源可管理，合成节点等待 TTS 服务商 |
| 高光解说 / 高光混剪 | `预留接口` | 预留模板位置，不进入首个可用闭环 |
| 多镜头一致性 | `本方案实现（受限）` | 通过角色资源、参考图和逐镜头生成实现；不承诺训练级一致性 |
| 团队与公共资源 | `后置` | 数据模型保留 `scope`，第一版只做项目内资源 |
| 角色训练与强一致性训练 | `后置` | 仅通过参考图和资源引用实现可达到的一致性 |

`预留接口` 的 UI 规则：

- 可以显示节点、资源卡片和连接点，用于表达未来能力边界。
- 必须显示“未接入执行器”状态。
- 不准出现可点击的成功按钮、模拟进度或假结果。
- 节点注册表只有在存在真实执行器时才标记为 `runnable`。
- 统一提示文案：`该能力已预留，尚未接入可执行服务商`。

## 5. 数据与任务设计

### 5.1 项目

`ProjectService` 负责：

- `createProject`
- `listProjects`
- `openProject`
- `renameProject`
- `saveProject`
- `deleteProject`
- `migrateProject`

项目记录只保存设置和引用，不内联媒体字节。

保存策略：

- 项目记录写操作使用完整记录替换，不把大对象塞进 session event。
- UI 不直接写文件，通过 RPC 提交 Operation。
- 保存失败时保留上一版记录，并返回可操作错误。
- 并发编辑使用 `updatedAt` 或递增 `revision` 做乐观锁。

### 5.2 媒体素材

`AssetService` 只负责媒体文件和生成结果的登记，不把角色、场景、道具等语义对象塞进同一张记录：

- 登记生成结果和手工上传结果。
- 以稳定 `assetId` 暴露图片、视频、音频、字幕和导出成片。
- 生成缩略图或 probe 元数据。
- 按项目、类型、标签筛选。
- 删除前检查资源、项目、工作流和时间轴引用。

素材记录保存 URI 与元数据；在工作台内展示时通过宿主安全媒体路由加载，不把本地绝对路径交给浏览器任意读取。

### 5.3 创作资源库

`ResourceService` 负责角色、场景、道具、品牌/产品、音色、风格、模型预设和轨迹模板。资源本身不是媒体文件，通过 `assetIds` 关联媒体素材。

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

第一版每个项目拥有自己的资源库。记录保留 `scope: 'project' | 'team' | 'public'`，为后续团队和公共资源预留；第一版不实现团队同步和平台公共资源。

资源职责：

- 创建、重命名、归档、复制和删除资源。
- 绑定基准图、参考图、参考视频、音色样音、风格图等媒体素材。
- 保存角色的外观、服装、体型和描述。
- 保存场景的环境、光线、天气和时代背景。
- 保存道具的外观、材质、比例和剧情用途。
- 保存音色的语种、性别、年龄、风格、试听素材和 TTS 服务商绑定。
- 保存品牌、产品、视觉风格和默认模型预设。
- 工作流和时间轴只引用 `resourceId`，不复制资源描述。

资源删除规则：

- 被项目默认绑定、工作流节点或时间轴片段引用时，不静默删除。
- 替换引用后才允许归档；第一版不做级联删除。
- 资源的 `assetIds` 删除同样受引用检查保护。

资源解析为现有生成协议：

| 资源 | 当前映射 |
|---|---|
| 角色 | 基准图/参考图 → `media[].type=reference_image`；需要首帧时 → `first_frame` |
| 场景 | 场景参考图 → `reference_image`；首尾帧工作中可直接作为边界画面 |
| 道具 | 道具参考图 → `reference_image`；与角色组合时作为多参考图之一 |
| 品牌/产品 | 品牌或产品参考图 → `reference_image`，提示词保留名称、材质和构图约束 |
| 视觉风格 | 风格参考图 → `reference_image`，或转换成提示词风格描述 |
| 音色 | 音色样音不是视频生成输入；等待配音节点接入后再映射到 TTS 请求 |
| 轨迹 | 转换成动作/运镜提示词，或作为参考视频；有真实控制字段后再映射为结构化参数 |

解析结果必须写入任务或节点运行记录，便于复现这次生成到底使用了哪些资源。

### 5.4 角色动作与轨迹资源

轨迹按“可复用模板”和“镜头内实例”两层处理：

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

interface TrackBinding {
  trackResourceId: ResourceId
  clipId: string
  offsetMs: number
  speed: number
  amplitude?: number
}
```

第一版支持：

- 创建、命名、复制和归档轨迹模板。
- 把轨迹绑定到工作流镜头或时间轴视频片段。
- 在画布上查看轨迹关键点和绑定关系。
- 把轨迹描述转换成生成提示词，并在结果 notes 中说明“作为提示词约束，不保证像素级遵循”。

暂不支持：

- 从任意视频自动提取骨骼、深度或运镜曲线。
- 服务商无对应控制字段时强制模型遵循轨迹。
- 轨迹驱动的逐帧渲染。

后续接入支持姿态、深度、相机参数或运动条件的服务商时，`TrackResource` 映射到真实字段；在那之前，UI 必须明确显示“模型约束”而不是“精确轨迹控制”。

### 5.5 任务

统一任务状态使用：

```ts
type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
```

任务分两层：

| 层 | 记录 | 生命周期 |
|---|---|---|
| 运行层 | `ctx.jobs` 或 `TaskService` 的内存 run | 当前进程，供取消和进度流 |
| 项目层 | `TaskRecord` | 持久化到项目，供刷新、重开和任务列表恢复 |

执行约定：

- 每次创建 `taskId`。
- 每个工作流运行额外有 `runId`。
- 每个节点执行额外有 `nodeExecutionId`。
- 提交网络请求前先持久化任务记录。
- 取消只对可取消阶段生效；生成提交返回 `task_id` 后不再盲目重提。
- 进程重启后，`running` 记录标记为 `unknown` 或 `interrupted`，不伪造成功。

### 5.6 本地持久化与协作边界

第一版本地存储布局：

```text
project-root/
  project.json                  # 项目、版本、设置、记录引用
  media/                        # 项目媒体素材文件
  resources/
    characters.json
    scenes.json
    props.json
    voices.json
    styles.json
    model-presets.json
    tracks/
  workflows/
  timelines/
  tasks/
  renders/
```

存储原则：

- 所有记录使用稳定 ID，不使用文件路径作为身份。
- 记录只引用媒体 URI 或相对路径；媒体字节不写入 JSON/KV。
- 项目根目录可以整体复制、备份或归档。
- 项目包带格式版本，导入时先校验版本和文件完整性。
- 资源包只包含资源元数据、引用清单和必要的小型预览；大型媒体按引用解析或显式打包。

团队协作分四层：

| 层级 | 方案 | 第一版决策 |
|---|---|---|
| L0 本地单人 | 项目根目录 + 本地资源库 | 必须实现 |
| L1 文件交接 | 项目包、资源包、媒体包复制 | 预留格式，后续实现 |
| L2 平台化团队协作 | 复用 Threerouter 账号、项目/资源服务、权限、实时同步 | 以后再说；未来优先复用 Threerouter 平台能力 |

L1 的推荐格式：

```text
exports/
  <project-name>.dshiv-project.zip
  <resource-pack>.dshiv-resources.zip
  <media-pack>.dshiv-media.zip
```

包内必须有：

- `manifest.json`：包类型、格式版本、创建时间、应用版本。
- `contents.json`：项目、资源、媒体素材和轨迹引用的清单。
- `checksums.json`：文件完整性校验。
- 可选 `media/`：显式打包的媒体文件。
- 可选 `task-history/`：已完成、失败或取消的任务历史；活动任务不随包继续执行。

协作规则：

- 项目包导入时生成新的本地项目 ID，避免覆盖已有项目。
- 同名资源默认不合并，提供“跳过 / 重命名 / 替换”选择。
- 媒体文件按内容摘要去重，不按文件名去重。
- 导入失败时回滚到导入前状态，不留下半成品项目。

L2 暂不纳入阶段计划。以后若讨论团队功能，前提是 Threerouter 服务端提供团队账号、项目/资源服务、权限模型和跨设备同步能力，本地插件只做客户端协议适配和本地缓存。

## 6. 专业工作流设计

### 6.1 React Flow 边界

依赖：`@xyflow/react`，实现时锁定精确版本。

React Flow 只负责：

- 节点位置和连线交互。
- 选择、多选、缩放、平移、适配窗口。
- 节点面板和画布事件。

不负责：

- 节点执行。
- 业务参数校验。
- 任务调度。
- 持久化。

### 6.2 节点定义

第一版节点：

| 节点 | 输入 | 输出 | 真实执行 |
|---|---|---|---|
| `creative-input` | 文本 | prompt | 无外部调用，进入运行上下文 |
| `script` | prompt | script | 调用模型或用户编辑结果 |
| `storyboard` | script | shots | 调用模型或用户编辑结果 |
| `asset-reference` | 项目媒体素材 | assets | 从 `AssetService` 引用 |
| `resource-reference` | 角色/场景/道具/品牌/风格/音色 | resources | 从 `ResourceService` 引用并解析为素材 |
| `motion-track` | 轨迹资源 + 镜头 | prompt/控制参数 | 绑定 `TrackResource`；当前生成阶段转为提示词约束 |
| `image-generate` | prompt + 参考图 | image asset | 调 `generate_image` 执行链 |
| `video-generate` | prompt + 首尾帧/参考素材/资源绑定 | video asset | 调 `generate_video` 执行链 |
| `preview` | asset | preview | 读取素材，不触发新生成 |
| `publish-asset` | asset | assetId | 登记到媒体素材库 |
| `lip-sync` | video + audio | video asset | `预留接口`，无真实服务商时不可运行 |
| `face-swap` | video + character | video asset | `预留接口`，无真实服务商时不可运行 |
| `voice-synthesize` | 音色资源 + 文本 | audio asset | `预留接口`，等待 TTS 服务商 |
| `subtitle` | timeline/video + text | subtitle asset | 本方案实现，输出字幕素材 |
| `render` | timeline snapshot | video asset | 本方案实现，调用 `RenderService` |

节点注册项必须声明 `availability: 'runnable' | 'planned'`。后续节点只有在节点注册表中存在真实执行器时才允许标记为 `runnable`。`planned` 节点可以出现在模板和画布中，但运行按钮禁用、不能伪造成功，也不能进入自动拓扑执行。

### 6.3 执行引擎

`WorkflowRunner` 必须与 UI 解耦，建议接口：

```ts
interface WorkflowRunner {
  validate(workflow: WorkflowRecord): WorkflowValidation
  run(request: WorkflowRunRequest, signal?: AbortSignal): Promise<WorkflowRunResult>
  cancel(runId: WorkflowRunId): void
  get(runId: WorkflowRunId): WorkflowRunRecord | undefined
}
```

职责：

- 校验节点 schema。
- 校验连线端口类型。
- 检测循环依赖。
- 计算拓扑序。
- 控制并发。
- 调度节点执行器。
- 写入运行记录。
- 处理失败、重试、取消。
- 缓存成功节点结果。

普通工作流禁止循环依赖。重试只重跑失败节点及其下游，不重跑成功且输入未变化的节点。

## 7. 时间轴与导出设计

### 7.1 时间轴模型

第一版轨道：

```ts
type TimelineTrack = VideoTrack | AudioTrack | SubtitleTrack
```

视频和音频片段允许绑定创作资源：

```ts
interface VideoClip {
  assetId: AssetId
  startMs: number
  inMs: number
  outMs: number
  resourceBindings?: ResourceBinding[]
  trackResourceId?: ResourceId
  trackParams?: { offsetMs?: number; speed?: number; amplitude?: number }
}

interface AudioClip {
  assetId: AssetId
  startMs: number
  inMs: number
  outMs: number
  voiceResourceId?: ResourceId
  volume: number
}
```

第一版操作：

- 从媒体素材库拖入片段。
- 为片段绑定角色、场景、道具、音色或轨迹资源。
- 调整角色/镜头轨迹模板的时间偏移、速度和幅度。
- 调整片段顺序和起始位置。
- 修改 `inMs` / `outMs`。
- 删除片段。
- 播放头、播放、暂停、跳转。
- 音轨音量、静音、启用。
- 字幕新增、编辑、起止时间和基础样式。
- 撤销、重做。
- 保存和恢复。

### 7.2 渲染流程

```text
TimelineRecord
  → freeze snapshot
  → RenderService.create(renderTask)
  → TaskRecord(status=running)
  → ffmpeg filter graph
  → output MP4
  → AssetService.register(exported video)
  → TaskRecord(outputAssetIds=[...])
```

第一版 ffmpeg 渲染能力：

- 多段视频拼接。
- 裁剪和覆盖片段。
- 基础转场或不做转场。
- 音轨混音。
- 字幕烧录。
- 固定输出分辨率、帧率、容器。

固定时间轴快照：

- 创建渲染任务时复制 `TimelineRecord` 的 revision。
- 编辑继续写入新 revision。
- 正在运行的 ffmpeg 只读快照。
- 快照包含资源绑定和轨迹实例，导出时资源只影响提示词或已生成片段，不在 ffmpeg 阶段重新训练角色或重算模型轨迹。

### 7.3 ffmpeg 运行时

MVP：

- 宿主启动或首次导出时执行 `ffmpeg -version` 和 `ffprobe -version`。
- 缺失、版本不兼容或权限失败时返回 `MEDIA_FFMPEG_UNAVAILABLE`。
- 不静默降到静态 UI 或假装成功。

发布前二选一：

- 把经审查的 ffmpeg/ffprobe sidecar 打进 Desktop 安装包。
- 或者把 ffmpeg 做成显式运行前置条件，并在安装/首次启用时给出可操作说明。

桌面 sidecar 决策必须单独 PR，不能混在时间轴 UI 改动里。

## 8. Agent 工具

工作流和时间轴闭环完成后再增加以下工具：

- `media_project_list`
- `media_project_get`
- `media_asset_list`
- `media_asset_get`
- `media_resource_list`
- `media_resource_get`
- `media_resource_create`
- `media_resource_update`
- `media_track_list`
- `media_track_bind`
- `media_workflow_get`
- `media_workflow_validate`
- `media_workflow_run`
- `media_task_get`
- `media_task_cancel`
- `media_timeline_get`
- `media_timeline_update`
- `media_render_start`
- `media_render_get`

工具不能直接接受任意文件系统路径。所有操作先通过项目 ID 和资产 ID 解析，再由业务层决定是否可以访问。昂贵批量生成需要设置单次调用上限。

## 9. 分阶段计划

### 阶段 0：审计与方案

交付：

- `docs/DESIGN-AUDIT.md`
- `docs/IMPLEMENTATION-PLAN.md`

验收：

- 所有结论都有当前仓库代码或 Harness 代码依据。
- 不修改产品代码。

回滚：

- 删除两份新增文档。

### 阶段 1：Harness 插件与右栏工作台

目标：证明 dsh-image-video 可以作为官方插件安装、启停、重载，并在右栏打开。

修改范围：

- `src/client/plugin.ts`
- `src/client/MediaWorkbench.tsx`
- `src/client/styles.ts`
- `src/client/locales.ts`
- `src/host/plugin.ts`
- `src/host/rpc.ts`
- `src/host/context.ts`
- `package.json`
- `tsdown.config.ts`
- `cordis.patch.yml`
- Harness 桌面端已有 `dsh-image-video` 私有插件名单；阶段 1 不新增包名，不修改该名单
- `tests/client-workbench.test.ts`
- `tests/plugin-lifecycle.test.ts`
- Harness 开发工作区的 bundle patch（如需把插件加入桌面 profile；不修改核心 UI）

交付：

- `dsh-image-video` 右栏 tab。
- guide entry。
- A/B/C 模式切换骨架。
- 项目名称、保存状态、媒体素材区、创作资源区、预览区、任务区、导出入口。
- `/image-video` RPC 健康检查。

验收：

- 插件可以安装、启用、禁用、重载。
- 禁用后右栏 tab、RPC、事件和后台任务都被撤销。
- 左侧导航和中间对话区不变。
- 现有右侧文件、浏览器、终端没有被覆盖。
- 使用 Harness 主题变量，窄窗口进入右栏 fullscreen。

回滚：

- 移除插件注册和 `dsh.client` 声明。
- 删除新增 client/host 文件。
- 从 profile bundle 删除对应行。

### 阶段 2：项目、媒体素材、创作资源与任务统一

目标：让现有快速创作结果成为工作台可引用的媒体素材，并让角色、场景、道具、音色、风格和轨迹成为可复用资源。

修改范围：

- `src/domain/project.ts`
- `src/domain/asset.ts`
- `src/domain/resource.ts`
- `src/domain/track.ts`
- `src/domain/task.ts`
- `src/services/project-service.ts`
- `src/services/asset-service.ts`
- `src/services/resource-service.ts`
- `src/services/task-service.ts`
- `src/storage/*`
- `src/tools/generate-image.ts`
- `src/tools/generate-video.ts`
- `src/client/modes/quick/*`
- `tests/project-domain.test.ts`
- `tests/asset-registration.test.ts`
- `tests/resource-library.test.ts`
- `tests/track-resource.test.ts`
- `tests/task-recovery.test.ts`

交付：

- 项目创建、打开、重命名、保存和恢复。
- 媒体素材稳定 ID、元数据和筛选。
- 角色、场景、道具、品牌、产品、音色、风格和模型预设资源。
- 角色走动、镜头运动、主体动作等轨迹模板与绑定。
- 生成工具成功后登记媒体素材和使用资源。
- 现有结果卡片增加“发送到工作台 / 放入时间轴”。
- 项目任务列表和刷新恢复。

验收：

- 模式 A 生成的图片和视频可以在 B、C 模式引用。
- 角色、场景、道具、音色和轨迹资源可以跨镜头复用。
- 重开项目后媒体素材、资源引用和轨迹绑定关系正确。
- 删除被引用媒体素材或资源会被拒绝并给出引用位置。
- 生成提交成功但下载失败时，任务保留服务端 `task_id`，不重复生成。

回滚：

- 关闭新增项目与媒体素材功能开关。
- 保留原有 `generate_*` 工具输出协议。
- 删除新增 storage domain 或保留其文件但不再打开读取。

### 阶段 3：预留能力边界

目标：把所有已确认但暂不能真实执行的飞书能力固定为不可误用的接口。

修改范围：

- `src/domain/resource.ts`
- `src/services/resource-service.ts`
- `src/client/modes/workflow/catalog.ts`
- `src/client/modes/timeline/catalog.ts`
- `tests/planned-capabilities.test.ts`

交付：

- 对口型节点。
- AI 换脸节点。
- 配音节点。
- 高光解说、高光混剪模板入口。
- 每个条目明确标记 `availability: 'planned'` 和所需服务商能力。

验收：

- `planned` 节点不能在画布自动执行。
- 不能生成模拟成功结果。
- 资源类型可以提前创建和绑定，但不能触发未接入的外部操作。

回滚：

- 从模板和节点目录移除 `planned` 条目。
- 保留已保存记录但不再渲染不可运行节点。

### 阶段 4：专业工作流 MVP

目标：完成一条真实可执行的广告视频工作流。

修改范围：

- `src/domain/workflow.ts`
- `src/services/workflow-runner.ts`
- `src/client/modes/workflow/*`
- `package.json` 增加 `@xyflow/react`
- `tests/workflow-validation.test.ts`
- `tests/workflow-runner.test.ts`
- `tests/workflow-client.test.tsx`

交付：

- React Flow 画布。
- 第一批真实节点，包括素材引用、资源引用和轨迹绑定。
- 节点 schema 和连线类型校验。
- 保存、加载、运行、取消、重试。
- 一个广告视频模板。
- 节点状态和错误展示。

验收：

- 工作流调用真实生成接口。
- 运行状态刷新后可以恢复。
- 失败节点显示错误并可重试。
- 成功结果登记到媒体素材库，并写入资源使用记录。
- 没有执行器的节点不能伪造成功。

回滚：

- 隐藏 workflow tab。
- 保留已保存 workflow 记录但不再执行。
- 删除 `@xyflow/react` 依赖。

### 阶段 5：时间轴精剪 MVP

目标：把已有素材剪成真实可播放的成片。

修改范围：

- `src/domain/timeline.ts`
- `src/media/ffmpeg.ts`
- `src/media/probe.ts`
- `src/media/render-timeline.ts`
- `src/media/subtitle.ts`
- `src/services/render-service.ts`
- `src/client/modes/timeline/*`
- `tests/timeline-model.test.ts`
- `tests/render-timeline.test.ts`
- `tests/render-service.test.ts`

交付：

- 视频、音频、字幕轨道。
- 拖入、排序、裁剪、删除。
- 角色、场景、道具、音色和轨迹绑定。
- 播放头和预览。
- 保存、恢复、撤销、重做。
- 异步导出 MP4。
- 导出进度、取消和失败原因。
- 导出结果登记到媒体素材库。

验收：

- 用 A 或 B 模式生成的媒体素材和创作资源可以剪辑和复用。
- 导出文件真实存在、可播放、时长正确。
- 时间轴编辑不会改变正在运行的渲染快照。
- 渲染失败不会生成“成功”记录。

回滚：

- 隐藏 timeline tab。
- 保留项目时间轴记录。
- 渲染任务停止并标记为 cancelled。

### 阶段 6：三模式联动与 Agent

修改范围：

- `src/tools/media-tools.ts`
- 工作台跨模式动作。
- 资源库检索、轨迹绑定和资源使用记录。
- 统一任务面板。
- 错误恢复。

验收：

- UI 和 Agent 修改同一项目数据后可以互相同步。
- 长任务返回 task ID。
- 昂贵批量生成有上限。
- Agent 不直接读写任意文件。

### 阶段 7：稳定性与发布

修改范围：

- 桌面 ffmpeg sidecar 或安装检测。
- 大画布和时间轴性能。
- 插件启停和 reload。
- 主题和响应式。
- 日志和错误提示。

验收：

- 冷启动、刷新、关闭、恢复都正常。
- 桌面打包安装后导出仍然可用。
- 卸载插件不留下失效 UI、监听器或后台任务。

### 阶段 8：本地项目包与资源包

目标：让本地创作结果可以跨电脑复制和交接，并保持不依赖产品云服务。

修改范围：

- `src/domain/exchange.ts`
- `src/services/project-package-service.ts`
- `src/services/resource-package-service.ts`
- `src/services/media-package-service.ts`
- `src/client/components/exchange/*`
- `tests/project-package.test.ts`
- `tests/resource-package.test.ts`
- `tests/media-package.test.ts`

交付：

- 导出项目包。
- 导入项目包。
- 导出资源包。
- 导入资源包。
- 媒体包去重、校验和缺失引用报告。

验收：

- 在电脑 A 导出的项目包可以在电脑 B 打开。
- 导入后媒体素材、资源引用、工作流、时间轴和任务记录关系正确。
- 导入的任务历史保留状态和产物引用，但所有活动任务转换为 `imported-idle`，不会自动续跑。
- 同名资源不静默覆盖。
- 包损坏或媒体缺失时给出可操作错误。
- 不要求登录任何产品云账号。

回滚：

- 隐藏导入导出入口。
- 保留项目本体和原有本地项目文件。

团队能力当前不排期。以后讨论时，不再评估插件自建服务或局域网方案，只考虑 Threerouter 平台是否提供可复用的团队接口。

## 10. 测试矩阵

| 面 | 测试 |
|---|---|
| 项目模型 | 创建、重命名、版本迁移、并发 revision、保存失败 |
| 媒体素材 | 登记、筛选、引用检查、删除拒绝、重启恢复 |
| 创作资源 | 角色、场景、道具、音色、风格、品牌、模型预设的 CRUD 与引用检查 |
| 轨迹资源 | 关键帧校验、绑定、偏移、速度、幅度、序列化与恢复 |
| 任务 | 排队、运行、成功、失败、取消、刷新恢复、未知状态 |
| 生成适配 | 文生、图生、首尾帧、参考图、参考视频、对比片 |
| 工作流 | schema、连线、循环、并发、缓存、重试、取消 |
| 时间轴 | 片段排序、入出点、轨道、字幕、撤销重做 |
| 渲染 | probe、filter graph、音频混合、字幕、进度、取消、输出校验 |
| 客户端 | 右栏注册、guide、模式切换、窄窗口、主题、卸载 |
| 宿主 | RPC、权限、生命周期、路径安全、密钥不落库 |
| 打包 | `dsh --dump-config`、client bundle 加载、桌面导出 smoke |
| 预留能力 | 不可运行节点、不可伪造成功、能力缺失提示 |
| 本地包交接 | 项目包、资源包、媒体包的导出、导入、去重、校验和回滚 |

不以静态 UI、模拟进度条或虚假成功弹窗作为完成证据。

## 11. 验证命令

产品仓库：

```sh
pnpm run typecheck
pnpm run test
pnpm run build
```

Harness 开发工作区：

```sh
pnpm run build:plugins
pnpm dsh --profile desktop --dump-config
```

右栏 UI 至少覆盖：

- 普通宽度右栏。
- 窄窗口自动 fullscreen。
- 深色和浅色主题。
- 插件禁用后右栏恢复。

真实媒体流程至少覆盖：

1. 快速创作生成一张图片。
2. 快速创作生成一段视频。
3. 创建角色、场景、道具和轨迹资源，并绑定现有媒体素材。
4. 把视频登记到项目媒体素材。
5. 在工作流中引用角色、场景、轨迹和该视频或首帧生成新视频。
6. 把结果放到时间轴。
7. 导出 MP4。
8. 重新打开项目确认媒体素材、资源引用、轨迹绑定和导出结果仍存在。

## 12. 桌面安装验证

当前 desktop 已把 `dsh-image-video` 和 `dsh-plugin-threerouter` 作为私有本地插件复制。阶段 1 继续使用 `dsh-image-video` 包名时，必须验证：

1. `pnpm run build:plugins` 同时生成宿主和客户端产物。
2. `package.json` 的 `exports["."].default` 指向已构建 host entry，`exports["./client"].default` 指向已构建 client entry。
3. `dsh --profile desktop --dump-config` 能解析到新增 host/client 入口。
4. desktop 的私有插件复制测试仍通过，并确认复制结果包含 `clientEntry`。
5. 卸载或禁用插件后，右栏 tab 和 RPC 消失。

本方案不新增独立包名，因此不需要修改桌面私有插件名单；需要改变的只是现有包自身的 exports、构建产物和 profile 组合配置。

## 13. 团队合作验证

第一版不验证云端团队协作，只验证本地可用性和可复制性：

1. 完全断网时可以打开本地项目、编辑资源和时间轴。
2. 项目根目录可以整体复制到另一台机器。
3. 项目包在另一台机器导入后引用关系正确。
4. 资源包导入不覆盖同名资源。
5. 共享目录只作为外部文件介质时，不要求产品服务器。

## 14. 风险控制

| 风险 | 控制 |
|---|---|
| 参考文档功能过多 | 每阶段只承诺已完成真实执行器的功能 |
| 生成任务长时间运行 | 任务持久化、取消、未知状态区分 |
| ffmpeg 不可用 | 集中检测，明确错误，发布前 sidecar 决策 |
| 宿主 API 漂移 | 锁定 Harness peer 版本，右栏接口使用公开注册表 |
| 插件卸载残留 | 所有注册、RPC、监听器和任务清理都放在 `ctx.effect()` |
| 大媒体内存压力 | 文件引用为主，避免把 MP4 放进 JSON/KV 或 data URL 持久化 |
| UI 与 Agent 冲突 | 项目 revision 和拒绝覆盖策略 |
| 团队协作过早复杂化 | 第一版冻结为本地单人闭环；共享与团队服务后置 |
| 自建团队服务成本失控 | 未来团队能力优先复用 Threerouter 平台，插件只做协议适配 |
| 项目包与当前本地格式漂移 | 包格式和项目格式都带独立版本，导入时先迁移校验 |

## 15. 阶段 1 的最小可验收切片

第一个实现 PR 只应包含：

1. 新右栏 tab 与 guide entry。
2. 工作台三模式骨架。
3. `/image-video` RPC 健康检查。
4. 插件生命周期测试。
5. “媒体素材 / 创作资源”两个入口的占位布局和不可运行提示。
6. 不接真实项目存储，不接生成调度，不改现有生成工具。

理由：先证明官方扩展点、构建、打包、启停和右栏体验成立，再在此之上接业务。这样可以最快发现跨仓构建或桌面加载问题，并把回滚范围限制在少量新增文件。

