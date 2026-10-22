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

/** What the workbench UI may ask the host (phase 2, first slice). */
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
  /** Recorded generations, newest first. */
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
    readonly roles?: readonly string[]
    readonly scenes?: readonly string[]
    readonly props?: readonly string[]
  }) => Promise<ComposeMediaResult>
  /**
   * 提示词提取（`G1`/`A-5`）：图片素材 → 结构化提示词（风格/主体/材质/细节）。
   * 不可用（无视觉模型或端点未落地）时宿主返回清晰错误，界面如实展示。
   */
  extractPrompt: (input: {
    readonly projectId?: string
    readonly assetId?: string
    readonly path?: string
  }) => Promise<ExtractedPrompt>
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
  /** 改资源（`A153`）：改名 / 备注 / 参考图（`assetPath: null` 清除）。 */
  updateResource: (input: {
    id: string
    name?: string
    note?: string
    assetPath?: string | null
  }) => Promise<ResourceRecord>
  /** 提示词库（`A-5`）。 */
  listPrompts: () => Promise<readonly { id: string; name: string; text: string; source: string }[]>
  savePrompt: (input: { id?: string; name: string; text: string }) =>
    Promise<{ id: string; name: string; text: string; source: string }>
  removePrompt: (id: string) => Promise<boolean>
  /** 图片 → 提示词（`A-5`）；宿主未注入视觉模型时会如实报错。 */
  extractPrompt: (path: string) => Promise<string>
  /** 融合生图（`A-4`）：按创作资源收集参考图与描述后一次生成。 */
  composeMedia: (input: {
    readonly projectId: string
    readonly prompt: string
    readonly resourceIds?: readonly string[]
    readonly size?: string
    readonly model?: string
  }) => Promise<{ readonly path: string; readonly asset: AssetRecord; readonly referencedImages: number }>
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
      // 走 HTTP 路由而不是 RPC：这条路由与 composer/settings 共用同一份校验（parseDefaultsPatch）
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
    listRuns: async (projectId, workflowId) =>
      (await call<{ runs: WorkflowRunRecord[] }>('workflows/runs', { projectId, workflowId })).runs,
    cancelRun: async runId => (await call<{ cancelled: boolean }>('workflows/run-cancel', { runId })).cancelled,
    retryRun: async runId => (await call<{ run: WorkflowRunRecord }>('workflows/run-retry', { runId })).run,
    cancelTask: async id => (await call<{ cancelled: boolean }>('tasks/cancel', { id })).cancelled,
    attachAssets: input => call<{ created: number; assets: AssetRecord[] }>('assets/attach-many', input),
    updateResource: input => call<{ resource: ResourceRecord }>('resources/update', input).then(result => result.resource),
    importMedia: input => call<{ imported: number; assets: AssetRecord[]; skipped: Array<{ path: string; reason: string }> }>('media/import', input),
    composeMedia: input => call<{ path: string; asset: AssetRecord; referencedImages: number }>('media/compose', input),
    listPrompts: async () => (await call<{ prompts: Array<{ id: string; name: string; text: string; source: string }> }>('prompts/list', {})).prompts,
    savePrompt: async input => (await call<{ prompt: { id: string; name: string; text: string; source: string } }>('prompts/save', input)).prompt,
    removePrompt: async id => (await call<{ removed: boolean }>('prompts/remove', { id })).removed,
    extractPrompt: async path => (await call<{ text: string }>('prompts/extract', { path })).text,
    generateMedia: input => call<MediaGenerateResult>('media/generate', input),
    composeMedia: input => call<ComposeMediaResult>('media/compose', input),
    extractPrompt: input => call<ExtractedPrompt>('prompts/extract', input),
    listPrompts: async () => (await call<{ prompts: PromptRecord[] }>('prompts/list')).prompts,
    savePrompt: async input => (await call<{ prompt: PromptRecord }>('prompts/save', input)).prompt,
    removePrompt: async id => (await call<{ removed: boolean }>('prompts/remove', { id })).removed,
    assignTask: async (id, projectId) => (await call<{ task: TaskRecord }>('tasks/assign', { id, projectId })).task,
    listOutputs: async limit => (await call<{ outputs: OutputFile[] }>('outputs/list', { limit })).outputs,
    getDiagnostics: () => call<WorkbenchDiagnostics>('diagnostics'),
  }
}
