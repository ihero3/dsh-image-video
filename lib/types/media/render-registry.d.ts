/**
 * 导出任务的登记与取消（`T5-5` 的宿主半边）。
 *
 * 渲染是长任务，宿主没有推送通道，所以这里只维护**可轮询的任务快照**：
 * 客户端每隔一会儿来 `timelines/renders` 看进度，取消走 `timelines/render-cancel`。
 */
import { type RenderService } from './render.ts';
import type { TimelineRecord } from '../workbench/timeline.ts';
/** 一次导出任务的状态。 */
export interface RenderJob {
    readonly id: string;
    readonly timelineId: string;
    readonly projectId: string;
    readonly status: 'running' | 'succeeded' | 'failed' | 'cancelled';
    readonly percent: number;
    readonly startedAt: string;
    readonly finishedAt?: string;
    readonly outputPath?: string;
    readonly bytes?: number;
    readonly durationMs?: number;
    /** 失败时的机器码（`RenderError#code`）。 */
    readonly code?: string;
    readonly error?: string;
}
/** 导出任务表（内存态即可：进程重启后"运行中"的渲染按失败收尾）。 */
export declare class RenderRegistry {
    private readonly deps;
    private readonly jobs;
    private readonly controllers;
    constructor(deps: {
        readonly render: RenderService;
        /** 成功后把产物登记成素材（可选）。 */
        readonly registerAsset?: (job: RenderJob) => Promise<void>;
        readonly now?: () => Date;
        readonly onError?: (message: string) => void;
    });
    private stamp;
    private patch;
    /** 列出任务（最新在前），可按项目过滤。 */
    list(projectId?: string): RenderJob[];
    /** 取一个任务。 */
    get(id: string): RenderJob | undefined;
    /** 该任务是否还在跑。 */
    isRunning(id: string): boolean;
    /**
     * 取消一次导出（连带杀掉 ffmpeg）。
     * @param id - 任务 id。
     * @returns 是否确实取消了一个在跑的任务。
     */
    cancel(id: string): boolean;
    /**
     * 起一次导出（立即返回任务快照，渲染在后台推进）。
     * @param timeline - 要渲染的时间轴（内部由 {@link RenderService} 冻结成快照）。
     * @returns 刚建立的任务。
     */
    start(timeline: TimelineRecord): RenderJob;
    /** 进程重启时把遗留的"运行中"任务按失败收尾。 */
    failStale(reason: string): number;
}
