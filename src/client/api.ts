/**
 * The browser half's typed face over the `/image-video` channel.
 *
 * Endpoint names and result shapes are mirrored by hand (the host half is a
 * different bundle), so this file is the single place the client names them —
 * `tests/client-rpc-transport.test.ts` pins the channel and the route form, and
 * the host handler's own tests pin the payloads.
 */
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { WORKBENCH_RPC_CHANNEL, type WorkbenchHealth } from '../workbench-contract.ts'
import type { AssetRecord, MediaKind, ProjectRecord, ResourceKind, ResourceRecord, TaskRecord } from '../workbench/records.ts'
import type { WorkflowRecord, WorkflowRunRecord } from '../workbench/workflow.ts'
import type { TimelineRecord } from '../workbench/timeline.ts'
import type { FfmpegProbe } from '../media/ffmpeg.ts'
import type { ResourceUsageRecord } from '../workbench/records.ts'
import type { RenderJob } from '../media/render-registry.ts'
import type { OutputFile } from '../workbench/outputs.ts'

/** Export parameters the export panel lets the user pick (B6). */
export interface TimelineExportOptions {
  /** Resolution preset id: `default` | `480` | `768` | `2k`. */
  resolution?: string
  /** Target frames per second. */
  fps?: number
  /** Aspect-ratio preset id: `landscape` | `portrait` | `square` | `vertical`. */
  aspect?: string
}

/** 诊断快照（`A9`）：出问题不用翻日志。结构与宿主 `diagnostics` 端点对齐。 */
export interface WorkbenchDiagnostics {
  readonly plugin: { readonly name: string; readonly version: string }
  readonly provider: string
  readonly outputsDir: string
  readonly data: Record<string, unknown>
  readonly renders: {
    readonly running: number
    readonly queued: number
    readonly recent: readonly { readonly id: string; readonly status: string; readonly percent: number; readonly queued: boolean }[]
    readonly stats?: { readonly finished: number; readonly failed: number; readonly cancelled: number; readonly durationMs?: { readonly p50: number; readonly p90: number } }
  }
  readonly runs: { readonly running: number }
  readonly cache: { readonly nodeResults?: number }
  readonly outputs: {
    readonly files: number
    readonly bytes: number
    readonly referenced: number
    readonly oldestAt?: string
    readonly newestAt?: string
  }
  readonly errors: { readonly errors: readonly { readonly source: string; readonly code?: string; readonly message: string; readonly at: string }[]; readonly errorCount: number }
}

/** `media/generate` 的返回（`A145`/`A147`）。 */
export interface MediaGenerateResult {
  readonly mediaMode?: 'image' | 'video'
  readonly path?: string
  readonly bytes?: number
  readonly asset?: AssetRecord
  readonly taskId?: string
  /** `wait:false` 时为 true：结果要自己轮询 `listTasks` 拿。 */
  readonly pending?: boolean
}

/**
 * `tasks/running` 的一条在飞生成（`F3`）：客户端据此算"已用时"。
 * 宿主注册表在生成**开始前**就落账，所以拿到 taskId 时这条一定在。
 */
export interface RunningGeneration {
  readonly id: string
  readonly kind: MediaKind
  /** 调用开始的 ISO 8601 时间戳。 */
  readonly startedAt: string
}

/** `media/generate` 的一条参考素材（`G4` 尾帧/参考视频）：与工具 `media[]` 同构。 */
export interface MediaReference {
  readonly image?: string
  readonly video?: string
  readonly type?: string
  readonly position?: string
}

/**
 * `G3` 融合生图的返回（`A-4` `media/compose`）：与 `media/generate` 同构。
 * 宿主解析选中资源的参考图、缺图降级为纯文生，并登记素材。
 */
export interface ComposeMediaResult {
  readonly mediaMode?: 'image' | 'video'
  readonly path?: string
  readonly bytes?: number
  readonly asset?: AssetRecord
  readonly taskId?: string
  /** 宿主实际使用的参考图（可选回显；未返回时客户端用本地预览值）。 */
  readonly referencePaths?: readonly string[]
}

/**
 * `G1` 从图片提取的结构化提示词（`A-5` `prompts/extract`）。
 * 字段名以宿主为准；客户端对缺失字段容错（拼接时跳过），不伪造内容。
 */
export interface ExtractedPrompt {
  readonly style?: string
  readonly subject?: string
  readonly material?: string
  readonly details?: string
  /** 宿主拼好的整段提示词（有则优先使用）。 */
  readonly text?: string
}

/** 提示词库记录（`A-5` `prompts/list|save|remove`）。 */
export interface PromptRecord {
  readonly id: string
  readonly name: string
  readonly text: string
  readonly tags?: readonly string[]
  readonly createdAt?: string
}

/** 分镜表的一个镜头（`A-7` `storyboard/plan` 返回的 `shots[]` 条目）。 */
export interface StoryboardShot {
  /** 1-based 镜头序号。 */
  readonly index: number
  /** 镜头描述（该镜头第一句，截断展示）。 */
  readonly shot: string
  /** 从创作资源里识别到的角色名。 */
  readonly characters: readonly string[]
  /** 识别到的场景名（可能没有）。 */
  readonly scene?: string
  /** 图片提示词。 */
  readonly imagePrompt: string
  /** 视频提示词。 */
  readonly videoPrompt: string
}

/** `storyboard/plan` 的返回（`A-7`）：镜头表 + 实际引用到的资源 id。 */
export interface StoryboardPlan {
  readonly shots: readonly StoryboardShot[]
  readonly referencedResourceIds: readonly string[]
}

/** 导出历史状态（`A-11`）：与宿主 `exports.json` 的记录同构。 */
export type ExportStatus = 'queued' | 'running' | 'succeeded' | 'failed'

/** 一条导出尝试（`A-11` `exports/list` 的条目；`exports/record|update` 的读写形状）。 */
export interface ExportRecord {
  readonly id: string
  readonly projectId: string
  readonly timelineId: string
  /** 成品文件路径（queued/running 时缺省）。 */
  readonly outputPath?: string
  readonly bytes?: number
  readonly status: ExportStatus
  /** 失败原因（宿主原样返回，界面如实展示）。 */
  readonly error?: string
  /** 实际耗时秒数（宿主知道时才给）。 */
  readonly elapsedSeconds?: number
  readonly startedAt: string
  readonly updatedAt: string
}

/** `assets/size-report` 返回的条目（`A116`/B-11）：`sizeReport` 的 Top 项。 */
export interface AssetSizeEntry {
  readonly path: string
  readonly bytes: number
  /** 从未被任何时间轴引用。 */
  readonly unused?: boolean
}

/** `assets/size-report` 返回（`A116`/B-11）。 */
export interface AssetSizeReport {
  readonly totalBytes: number
  readonly topBytes: number
  /** Top N 占总量的比例（0–1）。 */
  readonly topShare: number
  readonly medianBytes: number
  readonly count: number
  readonly top: readonly AssetSizeEntry[]
}

/** `assets/duplicates` 的一个重复组（`A112`/B-11）。 */
export interface AssetDuplicateGroup {
  /** 内容相同的素材路径；第一个是建议保留的。 */
  readonly paths: readonly string[]
  /** 单份字节数。 */
  readonly bytes: number
  /** 建议保留的路径。 */
  readonly keep: string
  readonly reclaimableBytes: number
}

/** `assets/duplicates` 返回（`A112`/B-11）。 */
export interface AssetDuplicatesReport {
  readonly groups: readonly AssetDuplicateGroup[]
  readonly reclaimableBytes: number
  readonly hashedFiles: number
  readonly skippedFiles: number
}

/** `assets/project-stats` 返回的一个项目（`A132`/B-11）。 */
export interface AssetProjectStat {
  readonly projectId: string
  readonly name: string
  readonly assets: number
  readonly bytes: number
  /** 被时间轴引用到的字节。 */
  readonly usedBytes: number
  readonly timelines: number
}

/** `assets/project-stats` 返回（`A132`/B-11）。 */
export interface AssetProjectStats {
  readonly totalBytes: number
  readonly projects: readonly AssetProjectStat[]
  readonly topShare: number
}

/** 音色（`P0-1`）：接口上线前来自配置，上线后来自服务商。 */
export interface VoiceProfile {
  readonly id: string
  readonly name: string
  readonly languages?: string[]
  readonly gender?: 'female' | 'male' | 'neutral'
}

/** 配音可用性（`voice/status`）。 */
export interface VoiceStatus {
  readonly available: boolean
  readonly provider: string
  readonly reason?: string
  readonly voices: readonly VoiceProfile[]
  readonly defaultVoice?: string
  readonly model?: string
}

/** 一条配音行（与字幕片段一一对应）。 */
export interface DubLineView {
  readonly clipId: string
  readonly text: string
  readonly chars: number
  readonly slotMs: number
  readonly estimatedMs: number
  readonly warning?: string
}

/** 配音计划（`voice/plan`，零花费）。 */
export interface DubPlanView {
  readonly lines: readonly DubLineView[]
  readonly totalChars: number
  readonly estimatedMs: number
  readonly warnings: readonly string[]
}

/** 一键流水线入参（`P0-2`）：剧本 + 可选编排参数。 */
export interface PipelineRunInput {
  readonly projectId: string
  readonly script: string
  readonly mode?: 'image-to-video' | 'text-to-video'
  readonly shots?: number
  readonly imageModel?: string
  readonly videoModel?: string
  readonly ratio?: string
  readonly duration?: number
  readonly strictResources?: boolean
  readonly styleNote?: string
}

/** 一键流水线编排结果（已落库的工作流 + 诊断）。 */
export interface PipelineResult {
  readonly workflowId: string
  readonly name: string
  readonly mode: string
  readonly shots: number
  readonly nodes: number
  readonly warnings: readonly string[]
  readonly missingResources: readonly string[]
}

export interface WorkbenchApi {
  /** Host facts (version, provider, output directory). */
  health: () => Promise<WorkbenchHealth>
  /** Every project, newest first. */
  listProjects: () => Promise<ProjectRecord[]>
  /** Create a project from a user-supplied name. */
  createProject: (name: string) => Promise<ProjectRecord>
  /** Remove a project (records only; media files stay on disk). */
  removeProject: (id: string) => Promise<boolean>
  /** One project's assets, newest first. */
  listAssets: (projectId: string) => Promise<AssetRecord[]>
  /** Register an existing output file as an asset of a project. */
  attachAsset: (input: {
    projectId: string
    path: string
    kind: MediaKind
    bytes?: number
    provider?: string
    model?: string
    prompt?: string
  }) => Promise<{ asset: AssetRecord; created: boolean }>
  /** Remove one asset record. */
  removeAsset: (id: string, force?: boolean) => Promise<boolean>
  /**
   * 批量删除素材（`A-2`）：一次调用删多条（宿主单次 ≤200）。
   * 不存在的 id 与被引用的素材进 `skipped` 并带原因，不中断整批。
   */
  removeAssets: (input: {
    readonly ids: readonly string[]
    readonly force?: boolean
  }) => Promise<{ readonly removed: number; readonly skipped: readonly { readonly id: string; readonly reason: string }[] }>
  /** Rename a project. */
  renameProject: (id: string, name: string) => Promise<ProjectRecord>
  /** One project's resources, newest first (optionally one kind). */
  listResources: (projectId: string, kind?: ResourceKind) => Promise<ResourceRecord[]>
  /** Create a resource inside a project. */
  createResource: (input: {
    projectId: string
    kind: ResourceKind
    name: string
    note?: string
    assetPath?: string
    /** 多张参考图（`A-3`）：首图视为底图；与 `assetPath` 同时给时以本字段为准。 */
    assetPaths?: readonly string[]
  }) => Promise<ResourceRecord>
  /** Remove one resource record. */
  removeResource: (id: string, force?: boolean) => Promise<boolean>
  /**
   * 改资源（`A153`/`A-3`）：改名 / 备注 / 参考图。
   * `assetPath: null` 清除单图；`assetPaths` 传数组=整组替换，`null`=清除；
   * 不传=保留。追加一张 = 读当前值 concat 后再传（客户端读写改写）。
   */
  updateResource: (input: {
    id: string
    name?: string
    note?: string
    assetPath?: string | null
    assetPaths?: readonly string[] | null
  }) => Promise<ResourceRecord>
  /** 批量登记素材（`A152`）：一次登记多条，避免 N 次往返。 */
  attachAssets: (input: {
    readonly projectId: string
    readonly items: readonly { readonly path: string; readonly kind?: string; readonly bytes?: number }[]
  }) => Promise<{ readonly created: number; readonly assets: readonly AssetRecord[] }>
  /** 从本地路径批量导入媒体并登记为项目素材（`A152`，文件会复制进 outputs）。 */
  importMedia: (input: {
    readonly projectId: string
    readonly paths: readonly string[]
  }) => Promise<{
    readonly imported: number
    readonly assets: readonly AssetRecord[]
    readonly skipped: readonly { readonly path: string; readonly reason: string }[]
  }>
  listTasks: (limit?: number) => Promise<TaskRecord[]>
  /**
   * 在飞生成快照（`F3`）：宿主取消表里还活着的生成，带 `startedAt`。
   * 生成进度条没有百分比时，用它算"已用时"（`生成中 · 12s`）。
   */
  listRunningTasks: () => Promise<RunningGeneration[]>
  /**
   * 工作台内直接生成（`A145`）：图片走同步；视频建议 `wait:false`，
   * 立刻拿 `taskId` 再轮询 `listTasks`，生成中可用 `cancelTask` 取消。
   *
   * `F2`：`images` 为**按序**多参考图（首图=底图，其余=风格/脸部参考）；
   * 传了 `images` 就**不要**再传 `image`（工具侧 `image` 优先，会盖掉整组）。
   * `G4`：`media` 为视频参考素材序列（尾帧/参考视频），`realPerson` 为真人勾选透传。
   */
  generateMedia: (input: {
    readonly mediaMode: 'image' | 'video'
    readonly prompt: string
    readonly projectId?: string
    readonly size?: string
    readonly model?: string
    readonly image?: string
    readonly images?: readonly string[]
    readonly media?: readonly MediaReference[]
    readonly realPerson?: boolean
    readonly duration?: number
    readonly aspectRatio?: string
    readonly resolution?: string
    readonly wait?: boolean
  }) => Promise<MediaGenerateResult>
  /**
   * 融合生图（`G3`/`A-4`）：把选中的角色/场景/物品**资源 id**连同提示词交宿主，
   * 由宿主解析各自参考图、缺图降级为纯文生、拼装后生成并登记素材。
   * 端点未落地时这里会抛错——界面如实展示，不伪造成功。
   */
  composeMedia: (input: {
    readonly projectId: string
    readonly prompt: string
    /** 选中创作资源的 id（角色/场景/物品混排，宿主按各自主键拼装参考图与描述）。 */
    readonly resourceIds: readonly string[]
    readonly size?: string
    readonly model?: string
  }) => Promise<ComposeMediaResult>
  /**
   * 提示词提取（`G1`/`A-5`）：图片路径 → 结构化提示词（风格/主体/材质/细节）。
   * 不可用（无视觉模型或端点未落地）时宿主返回清晰错误，界面如实展示。
   */
  extractPrompt: (input: { readonly path: string }) => Promise<ExtractedPrompt>
  /** 剧本 → 分镜表（`A-7`）。 */
  planStoryboard: (input: { projectId: string; script: string; shots?: number }) => Promise<StoryboardPlan>
  /** 提示词库列表（`A-5`）。 */
  listPrompts: () => Promise<PromptRecord[]>
  /** 存入/更新一条提示词（`A-5`）。 */
  savePrompt: (input: {
    readonly id?: string
    readonly name: string
    readonly text: string
    readonly tags?: readonly string[]
  }) => Promise<PromptRecord>
  /** 删除一条提示词（`A-5`）。 */
  removePrompt: (id: string) => Promise<boolean>
  /**
   * 导出历史（`A-11` `exports/list`）：按项目可查，新的在前。
   * 宿主单次最多 200 条、缺省 50 条；`projectId` 缺省查全部项目。
   */
  listExports: (input?: { readonly projectId?: string; readonly limit?: number }) => Promise<ExportRecord[]>
  /** 记录一次导出尝试（`A-11` `exports/record`）：初始状态 `queued`。 */
  recordExport: (input: { readonly projectId: string; readonly timelineId: string }) => Promise<ExportRecord>
  /** 更新导出尝试的状态/产物/失败原因/耗时（`A-11` `exports/update`）。 */
  updateExport: (input: {
    readonly id: string
    readonly status?: ExportStatus
    readonly outputPath?: string
    readonly bytes?: number
    readonly error?: string
    readonly elapsedSeconds?: number
  }) => Promise<ExportRecord>
  /** Probe ffmpeg (availability, version, encoders); `path` checks a specific copy. */
  probeFfmpeg: (path?: string) => Promise<FfmpegProbe>
  /** 写运行时默认值覆盖（`R-CFG-2`）：与 composer 的 settings 走同一条路（留空 = 清除覆盖）。 */
  saveDefaults: (patch: Record<string, string | number | null>) => Promise<void>
  /** 资源使用记录（`R-QCK-3`）：资源库据此显示「被哪些素材用过」。 */
  listResourceUsage: (options?: { resourceId?: string; projectId?: string }) => Promise<ResourceUsageRecord[]>
  /** Start rendering a timeline into an mp4 (returns the job to poll). */
  renderTimeline: (timelineId: string, projectId?: string, options?: TimelineExportOptions) => Promise<RenderJob>
  /** Export jobs, newest first. */
  listRenders: (projectId?: string) => Promise<RenderJob[]>
  /** Cancel a running export. */
  cancelRender: (renderId: string) => Promise<boolean>
  /** One project's timeline documents, newest first. */
  listTimelines: (projectId: string) => Promise<TimelineRecord[]>
  /** Create or update a timeline document. */
  saveTimeline: (input: {
    id?: string
    projectId: string
    name?: string
    tracks: unknown
    frameRate?: number
    burnSubtitles?: boolean
    exportFormat?: TimelineRecord['exportFormat']
    normalizeLoudness?: boolean
  }) => Promise<TimelineRecord>
  /** Remove one timeline document. */
  removeTimeline: (id: string) => Promise<boolean>
  /** One project's workflow documents, newest first. */
  listWorkflows: (projectId: string) => Promise<WorkflowRecord[]>
  /** Create or update a workflow document. */
  saveWorkflow: (input: {
    id?: string
    projectId: string
    name?: string
    nodes: unknown
    edges: unknown
  }) => Promise<WorkflowRecord>
  /** Remove one workflow document. */
  removeWorkflow: (id: string) => Promise<boolean>
  /** Merge duplicate asset records; returns how many were removed. */
  compactAssets: () => Promise<number>
  /** Start a run of the stored workflow. `only` limits the run to those nodes and their downstream (B4 single-node run). */
  runWorkflow: (workflowId: string, only?: readonly string[]) => Promise<WorkflowRunRecord>
  /** 一键流水线：把剧本编排成工作流（只落库、不起跑）。 */
  composePipeline: (input: PipelineRunInput) => Promise<PipelineResult>
  /** 一键流水线：编排并立刻起跑（剧本 → 分镜 → 生图 → 生视频）。 */
  /** 配音可用性：未接入 TTS 时 `available: false` + 可读原因。 */
  voiceStatus: () => Promise<VoiceStatus>
  /** 从时间轴字幕生成配音计划（零花费；只读）。 */
  voicePlan: (timelineId: string) => Promise<{ plan: DubPlanView; voice: VoiceStatus }>
  /** 合成一句配音（接口未接入时抛可操作错误）。 */
  voiceSynthesize: (input: { text: string; voiceId?: string }) => Promise<{ audio: { audioPath: string; bytes: number; durationMs: number } }>
  runPipeline: (input: PipelineRunInput) => Promise<{ pipeline: PipelineResult; run: WorkflowRunRecord }>
  /** Run records for a project (optionally one workflow), newest first. */
  listRuns: (projectId: string, workflowId?: string) => Promise<WorkflowRunRecord[]>
  /** Cancel a running workflow run. */
  cancelRun: (runId: string) => Promise<boolean>
  /** Retry only the failed nodes of a run. */
  retryRun: (runId: string) => Promise<WorkflowRunRecord>
  /** Cancel one running generation (aborts the provider call). */
  cancelTask: (id: string) => Promise<boolean>
  /** File a recorded generation into a project. */
  assignTask: (id: string, projectId: string) => Promise<TaskRecord>
  /** B-11 素材库体检：Top N/总量/中位数/占比，标注是否未使用（`assets/size-report`）。 */
  assetSizeReport: (topN?: number) => Promise<AssetSizeReport>
  /** B-11 内容去重：按大小分组 sha256，给建议保留项与可回收字节（`assets/duplicates`）。 */
  assetDuplicates: (maxHashFiles?: number) => Promise<AssetDuplicatesReport>
  /** B-11 项目统计：素材数/总字节/被引用字节/时间轴数，按占用降序（`assets/project-stats`）。 */
  assetProjectStats: () => Promise<AssetProjectStats>
  /** Newest media files under the output directory. */
  listOutputs: (limit?: number) => Promise<OutputFile[]>
  /** 诊断快照：版本、数据规模、渲染队列、输出占用、近错。 */
  getDiagnostics: () => Promise<WorkbenchDiagnostics>
}

/**
 * Build the API over a client connection.
 * @param connection - the client connection handle (`ctx.get('connection')`).
 * @returns the typed API.
 */
export function createWorkbenchApi(connection: ConnectionHandle): WorkbenchApi {
  /** Call one endpoint and unwrap the connection result envelope. */
  async function call<T>(endpoint: string, payload: unknown = {}): Promise<T> {
    const result = await connection.rpc.call(WORKBENCH_RPC_CHANNEL, endpoint, payload)
    if (!result.ok) throw new Error(result.error?.message ?? `workbench ${endpoint} failed`)
    return result.value as T
  }
  return {
    health: () => call<WorkbenchHealth>('health'),
    listProjects: async () => (await call<{ projects: ProjectRecord[] }>('projects/list')).projects,
    createProject: async name => (await call<{ project: ProjectRecord }>('projects/create', { name })).project,
    removeProject: async id => (await call<{ removed: boolean }>('projects/remove', { id })).removed,
    listAssets: async projectId => (await call<{ assets: AssetRecord[] }>('assets/list', { projectId })).assets,
    attachAsset: input => call<{ asset: AssetRecord; created: boolean }>('assets/attach', input),
    removeAsset: async (id, force) => (await call<{ removed: boolean }>('assets/remove', force === true ? { id, force: true } : { id })).removed,
    removeAssets: input => call<{ removed: number; skipped: Array<{ id: string; reason: string }> }>('assets/remove-many', input),
    renameProject: async (id, name) => (await call<{ project: ProjectRecord }>('projects/rename', { id, name })).project,
    listResources: async (projectId, kind) =>
      (await call<{ resources: ResourceRecord[] }>('resources/list', { projectId, kind })).resources,
    createResource: async input => (await call<{ resource: ResourceRecord }>('resources/create', input)).resource,
    removeResource: async (id, force) => (await call<{ removed: boolean }>('resources/remove', force === true ? { id, force: true } : { id })).removed,
    listTasks: async limit => (await call<{ tasks: TaskRecord[] }>('tasks/list', { limit })).tasks,
    listRunningTasks: async () => (await call<{ running: RunningGeneration[] }>('tasks/running')).running,
    probeFfmpeg: async path => (await call<{ ffmpeg: FfmpegProbe }>('media/ffmpeg', path === undefined ? {} : { path })).ffmpeg,
    saveDefaults: async patch => {
      const response = await fetch('/image-video/defaults', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`默认值没写进去（HTTP ${response.status}）：${text.slice(0, 200)}`)
      }
    },
    listResourceUsage: async options =>
      (await call<{ usage: ResourceUsageRecord[] }>('resources/usage', options ?? {})).usage,
    renderTimeline: async (timelineId, projectId, options) =>
      (await call<{ render: RenderJob }>('timelines/render', {
        timelineId,
        ...(projectId !== undefined ? { projectId } : {}),
        ...(options !== undefined ? { resolution: options.resolution, fps: options.fps, aspect: options.aspect } : {}),
      })).render,
    listRenders: async projectId =>
      (await call<{ renders: RenderJob[] }>('timelines/renders', projectId === undefined ? {} : { projectId })).renders,
    cancelRender: async renderId => (await call<{ cancelled: boolean }>('timelines/render-cancel', { renderId })).cancelled,
    listTimelines: async projectId =>
      (await call<{ timelines: TimelineRecord[] }>('timelines/list', { projectId })).timelines,
    saveTimeline: async input => (await call<{ timeline: TimelineRecord }>('timelines/save', input)).timeline,
    removeTimeline: async id => (await call<{ removed: boolean }>('timelines/remove', { id })).removed,
    listWorkflows: async projectId =>
      (await call<{ workflows: WorkflowRecord[] }>('workflows/list', { projectId })).workflows,
    saveWorkflow: async input => (await call<{ workflow: WorkflowRecord }>('workflows/save', input)).workflow,
    removeWorkflow: async id => (await call<{ removed: boolean }>('workflows/remove', { id })).removed,
    compactAssets: async () => (await call<{ removed: number }>('maintenance/compact', {})).removed,
    runWorkflow: async (workflowId, only) =>
      (await call<{ run: WorkflowRunRecord }>('workflows/run', {
        workflowId,
        ...only === undefined ? {} : { only },
      })).run,
    composePipeline: input =>
      call<{ pipeline: PipelineResult }>('pipelines/compose', input).then(result => result.pipeline),
    runPipeline: input => call<{ pipeline: PipelineResult; run: WorkflowRunRecord }>('pipelines/run', input),
    voiceStatus: async () => (await call<{ voice: VoiceStatus }>('voice/status', {})).voice,
    voicePlan: input => call<{ plan: DubPlanView; voice: VoiceStatus }>('voice/plan', { timelineId: input }),
    voiceSynthesize: input => call<{ audio: { audioPath: string; bytes: number; durationMs: number } }>('voice/synthesize', input),
    listRuns: async (projectId, workflowId) =>
      (await call<{ runs: WorkflowRunRecord[] }>('workflows/runs', { projectId, workflowId })).runs,
    cancelRun: async runId => (await call<{ cancelled: boolean }>('workflows/run-cancel', { runId })).cancelled,
    retryRun: async runId => (await call<{ run: WorkflowRunRecord }>('workflows/run-retry', { runId })).run,
    cancelTask: async id => (await call<{ cancelled: boolean }>('tasks/cancel', { id })).cancelled,
    attachAssets: input => call<{ created: number; assets: AssetRecord[] }>('assets/attach-many', input),
    updateResource: input => call<{ resource: ResourceRecord }>('resources/update', input).then(result => result.resource),
    importMedia: input => call<{ imported: number; assets: AssetRecord[]; skipped: Array<{ path: string; reason: string }> }>('media/import', input),
    generateMedia: input => call<MediaGenerateResult>('media/generate', input),
    composeMedia: input => call<ComposeMediaResult>('media/compose', input),
    extractPrompt: input => call<ExtractedPrompt>('prompts/extract', input),
    planStoryboard: input => call<StoryboardPlan>('storyboard/plan', input),
    listPrompts: async () => (await call<{ prompts: PromptRecord[] }>('prompts/list')).prompts,
    savePrompt: async input => (await call<{ prompt: PromptRecord }>('prompts/save', input)).prompt,
    removePrompt: async id => (await call<{ removed: boolean }>('prompts/remove', { id })).removed,
    listExports: async input => {
      const response = await call<{ exports: ExportRecord[] }>('exports/list', {
        ...input?.projectId === undefined ? {} : { projectId: input.projectId },
        ...input?.limit === undefined ? {} : { limit: input.limit },
      })
      return response.exports
    },
    recordExport: async input => (await call<{ export: ExportRecord }>('exports/record', input)).export,
    updateExport: async input => (await call<{ export: ExportRecord }>('exports/update', input)).export,
    assignTask: async (id, projectId) => (await call<{ task: TaskRecord }>('tasks/assign', { id, projectId })).task,
    assetSizeReport: async topN =>
      (await call<{ size: AssetSizeReport }>('assets/size-report', topN === undefined ? {} : { topN })).size,
    assetDuplicates: async maxHashFiles =>
      (await call<{ duplicates: AssetDuplicatesReport }>('assets/duplicates', maxHashFiles === undefined ? {} : { maxHashFiles })).duplicates,
    assetProjectStats: async () => (await call<{ stats: AssetProjectStats }>('assets/project-stats')).stats,
    listOutputs: async limit => (await call<{ outputs: OutputFile[] }>('outputs/list', { limit })).outputs,
    getDiagnostics: () => call<WorkbenchDiagnostics>('diagnostics'),
  }
}
