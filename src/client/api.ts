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

/** What the workbench UI may ask the host (phase 2, first slice). */
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
  }) => Promise<ResourceRecord>
  /** Remove one resource record. */
  removeResource: (id: string, force?: boolean) => Promise<boolean>
  /** Recorded generations, newest first. */
  listTasks: (limit?: number) => Promise<TaskRecord[]>
  /** Probe ffmpeg (availability, version, encoders); `path` checks a specific copy. */
  probeFfmpeg: (path?: string) => Promise<FfmpegProbe>
  /** 写运行时默认值覆盖（`R-CFG-2`）：与 composer 的 settings 走同一条路（留空 = 清除覆盖）。 */
  saveDefaults: (patch: Record<string, string | number | null>) => Promise<void>
  /** 资源使用记录（`R-QCK-3`）：资源库据此显示「被哪些素材用过」。 */
  listResourceUsage: (options?: { resourceId?: string; projectId?: string }) => Promise<ResourceUsageRecord[]>
  /** Export parameters the export panel lets the user pick (B6). */
  export interface TimelineExportOptions {
    /** Resolution preset id: `default` | `480` | `768` | `2k`. */
    resolution?: string
    /** Target frames per second. */
    fps?: number
    /** Aspect-ratio preset id: `landscape` | `portrait` | `square` | `vertical`. */
    aspect?: string
  }
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
  /** Newest media files under the output directory. */
  listOutputs: (limit?: number) => Promise<OutputFile[]>
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
    renameProject: async (id, name) => (await call<{ project: ProjectRecord }>('projects/rename', { id, name })).project,
    listResources: async (projectId, kind) =>
      (await call<{ resources: ResourceRecord[] }>('resources/list', { projectId, kind })).resources,
    createResource: async input => (await call<{ resource: ResourceRecord }>('resources/create', input)).resource,
    removeResource: async (id, force) => (await call<{ removed: boolean }>('resources/remove', force === true ? { id, force: true } : { id })).removed,
    listTasks: async limit => (await call<{ tasks: TaskRecord[] }>('tasks/list', { limit })).tasks,
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
    assignTask: async (id, projectId) => (await call<{ task: TaskRecord }>('tasks/assign', { id, projectId })).task,
    listOutputs: async limit => (await call<{ outputs: OutputFile[] }>('outputs/list', { limit })).outputs,
  }
}
