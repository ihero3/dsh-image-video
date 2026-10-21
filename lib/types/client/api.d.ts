/**
 * The browser half's typed face over the `/image-video` channel.
 *
 * Endpoint names and result shapes are mirrored by hand (the host half is a
 * different bundle), so this file is the single place the client names them —
 * `tests/client-rpc-transport.test.ts` pins the channel and the route form, and
 * the host handler's own tests pin the payloads.
 */
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
import { type WorkbenchHealth } from '../workbench-contract.ts';
import type { AssetRecord, MediaKind, ProjectRecord, ResourceKind, ResourceRecord, TaskRecord } from '../workbench/records.ts';
import type { WorkflowRecord, WorkflowRunRecord } from '../workbench/workflow.ts';
import type { TimelineRecord } from '../workbench/timeline.ts';
import type { FfmpegProbe } from '../media/ffmpeg.ts';
import type { ResourceUsageRecord } from '../workbench/records.ts';
import type { RenderJob } from '../media/render-registry.ts';
import type { OutputFile } from '../workbench/outputs.ts';
/** Export parameters the export panel lets the user pick (B6). */
export interface TimelineExportOptions {
    /** Resolution preset id: `default` | `480` | `768` | `2k`. */
    resolution?: string;
    /** Target frames per second. */
    fps?: number;
    /** Aspect-ratio preset id: `landscape` | `portrait` | `square` | `vertical`. */
    aspect?: string;
}
/** 诊断快照（`A9`）：出问题不用翻日志。结构与宿主 `diagnostics` 端点对齐。 */
export interface WorkbenchDiagnostics {
    readonly plugin: {
        readonly name: string;
        readonly version: string;
    };
    readonly provider: string;
    readonly outputsDir: string;
    readonly data: Record<string, unknown>;
    readonly renders: {
        readonly running: number;
        readonly queued: number;
        readonly recent: readonly {
            readonly id: string;
            readonly status: string;
            readonly percent: number;
            readonly queued: boolean;
        }[];
        readonly stats?: {
            readonly finished: number;
            readonly failed: number;
            readonly cancelled: number;
            readonly durationMs?: {
                readonly p50: number;
                readonly p90: number;
            };
        };
    };
    readonly runs: {
        readonly running: number;
    };
    readonly cache: {
        readonly nodeResults?: number;
    };
    readonly outputs: {
        readonly files: number;
        readonly bytes: number;
        readonly referenced: number;
        readonly oldestAt?: string;
        readonly newestAt?: string;
    };
    readonly errors: {
        readonly errors: readonly {
            readonly source: string;
            readonly code?: string;
            readonly message: string;
            readonly at: string;
        }[];
        readonly errorCount: number;
    };
}
/** What the workbench UI may ask the host (phase 2, first slice). */
/** `media/generate` 的返回（`A145`/`A147`）。 */
export interface MediaGenerateResult {
    readonly mediaMode?: 'image' | 'video';
    readonly path?: string;
    readonly bytes?: number;
    readonly asset?: AssetRecord;
    readonly taskId?: string;
    /** `wait:false` 时为 true：结果要自己轮询 `listTasks` 拿。 */
    readonly pending?: boolean;
}
export interface WorkbenchApi {
    /** Host facts (version, provider, output directory). */
    health: () => Promise<WorkbenchHealth>;
    /** Every project, newest first. */
    listProjects: () => Promise<ProjectRecord[]>;
    /** Create a project from a user-supplied name. */
    createProject: (name: string) => Promise<ProjectRecord>;
    /** Remove a project (records only; media files stay on disk). */
    removeProject: (id: string) => Promise<boolean>;
    /** One project's assets, newest first. */
    listAssets: (projectId: string) => Promise<AssetRecord[]>;
    /** Register an existing output file as an asset of a project. */
    attachAsset: (input: {
        projectId: string;
        path: string;
        kind: MediaKind;
        bytes?: number;
        provider?: string;
        model?: string;
        prompt?: string;
    }) => Promise<{
        asset: AssetRecord;
        created: boolean;
    }>;
    /** Remove one asset record. */
    removeAsset: (id: string, force?: boolean) => Promise<boolean>;
    /** Rename a project. */
    renameProject: (id: string, name: string) => Promise<ProjectRecord>;
    /** One project's resources, newest first (optionally one kind). */
    listResources: (projectId: string, kind?: ResourceKind) => Promise<ResourceRecord[]>;
    /** Create a resource inside a project. */
    createResource: (input: {
        projectId: string;
        kind: ResourceKind;
        name: string;
        note?: string;
    }) => Promise<ResourceRecord>;
    /** Remove one resource record. */
    removeResource: (id: string, force?: boolean) => Promise<boolean>;
    /** Recorded generations, newest first. */
    listTasks: (limit?: number) => Promise<TaskRecord[]>;
    /**
     * 工作台内直接生成（`A145`）：图片走同步；视频建议 `wait:false`，
     * 立刻拿 `taskId` 再轮询 `listTasks`，生成中可用 `cancelTask` 取消。
     */
    generateMedia: (input: {
        readonly mediaMode: 'image' | 'video';
        readonly prompt: string;
        readonly projectId?: string;
        readonly size?: string;
        readonly model?: string;
        readonly image?: string;
        readonly duration?: number;
        readonly aspectRatio?: string;
        readonly resolution?: string;
        readonly wait?: boolean;
    }) => Promise<MediaGenerateResult>;
    /** Probe ffmpeg (availability, version, encoders); `path` checks a specific copy. */
    probeFfmpeg: (path?: string) => Promise<FfmpegProbe>;
    /** 写运行时默认值覆盖（`R-CFG-2`）：与 composer 的 settings 走同一条路（留空 = 清除覆盖）。 */
    saveDefaults: (patch: Record<string, string | number | null>) => Promise<void>;
    /** 资源使用记录（`R-QCK-3`）：资源库据此显示「被哪些素材用过」。 */
    listResourceUsage: (options?: {
        resourceId?: string;
        projectId?: string;
    }) => Promise<ResourceUsageRecord[]>;
    /** Start rendering a timeline into an mp4 (returns the job to poll). */
    renderTimeline: (timelineId: string, projectId?: string, options?: TimelineExportOptions) => Promise<RenderJob>;
    /** Export jobs, newest first. */
    listRenders: (projectId?: string) => Promise<RenderJob[]>;
    /** Cancel a running export. */
    cancelRender: (renderId: string) => Promise<boolean>;
    /** One project's timeline documents, newest first. */
    listTimelines: (projectId: string) => Promise<TimelineRecord[]>;
    /** Create or update a timeline document. */
    saveTimeline: (input: {
        id?: string;
        projectId: string;
        name?: string;
        tracks: unknown;
        frameRate?: number;
        burnSubtitles?: boolean;
        exportFormat?: TimelineRecord['exportFormat'];
        normalizeLoudness?: boolean;
    }) => Promise<TimelineRecord>;
    /** Remove one timeline document. */
    removeTimeline: (id: string) => Promise<boolean>;
    /** One project's workflow documents, newest first. */
    listWorkflows: (projectId: string) => Promise<WorkflowRecord[]>;
    /** Create or update a workflow document. */
    saveWorkflow: (input: {
        id?: string;
        projectId: string;
        name?: string;
        nodes: unknown;
        edges: unknown;
    }) => Promise<WorkflowRecord>;
    /** Remove one workflow document. */
    removeWorkflow: (id: string) => Promise<boolean>;
    /** Merge duplicate asset records; returns how many were removed. */
    compactAssets: () => Promise<number>;
    /** Start a run of the stored workflow. `only` limits the run to those nodes and their downstream (B4 single-node run). */
    runWorkflow: (workflowId: string, only?: readonly string[]) => Promise<WorkflowRunRecord>;
    /** Run records for a project (optionally one workflow), newest first. */
    listRuns: (projectId: string, workflowId?: string) => Promise<WorkflowRunRecord[]>;
    /** Cancel a running workflow run. */
    cancelRun: (runId: string) => Promise<boolean>;
    /** Retry only the failed nodes of a run. */
    retryRun: (runId: string) => Promise<WorkflowRunRecord>;
    /** Cancel one running generation (aborts the provider call). */
    cancelTask: (id: string) => Promise<boolean>;
    /** File a recorded generation into a project. */
    assignTask: (id: string, projectId: string) => Promise<TaskRecord>;
    /** Newest media files under the output directory. */
    listOutputs: (limit?: number) => Promise<OutputFile[]>;
    /** 诊断快照：版本、数据规模、渲染队列、输出占用、近错。 */
    getDiagnostics: () => Promise<WorkbenchDiagnostics>;
}
/**
 * Build the API over a client connection.
 * @param connection - the client connection handle (`ctx.get('connection')`).
 * @returns the typed API.
 */
export declare function createWorkbenchApi(connection: ConnectionHandle): WorkbenchApi;
