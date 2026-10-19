/**
 * 导出任务的登记与取消（`T5-5` 的宿主半边）。
 *
 * 渲染是长任务，宿主没有推送通道，所以这里只维护**可轮询的任务快照**：
 * 客户端每隔一会儿来 `timelines/renders` 看进度，取消走 `timelines/render-cancel`。
 */
import { type RenderService } from './render.ts';
import type { TimelineRecord } from '../workbench/timeline.ts';
import { type RenderSummary } from './render-summary.ts';
/** 一次导出任务的状态。 */
/**
 * 把全局百分比换算成"第 N 段 / 共 M 段"（`A41`）。
 * @param bounds - 各段**累计结束**毫秒（升序）。
 * @param percent - 全局进度（0–100）。
 * @returns 段序号；边界为空时返回 `undefined`。
 */
/**
 * 估算剩余时间（`A52`）：按"已耗时 / 已完成比例"线性外推。
 *
 * 刻意**很早不给估计**（进度 < 5% 或已耗时 < 1s 时返回 `undefined`）：这时外推误差极大，
 * 给出一个乱跳的数字比不给更糟。
 *
 * @param percent - 当前进度（0–100）。
 * @param elapsedMs - 已耗时（毫秒）。
 * @returns 预计剩余秒数（四舍五入）；不该给估计时返回 `undefined`。
 */
export declare function estimateEtaSec(percent: number, elapsedMs: number): number | undefined;
export declare function segmentStepAt(bounds: readonly number[], percent: number): {
    readonly current: number;
    readonly total: number;
} | undefined;
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
    /**
     * 是否在**排队**等渲染槽位（`A4`）。注意这是加法字段：`status` 仍是 `running`，
     * 客户端不会因未知枚举而编译失败；等界面准备好后再用它显示"排队第 N 位"。
     */
    readonly queued?: boolean;
    /** 排队位置（1 = 下一个开跑）；不在排队时为 `undefined`。 */
    readonly queuePosition?: number;
    /** 导出完成摘要（`A37`，加法字段：产物/时长/规格/轨道概览）。 */
    readonly summary?: RenderSummary;
    /** 进度细分（`A41`）：当前在第几段（按视频段+补边段的累计时长换算）。 */
    readonly progressStep?: {
        readonly current: number;
        readonly total: number;
    };
    /** 预计剩余秒数（`A52`；过早/过短时不给，成功时为 0）。 */
    readonly progressEtaSec?: number;
}
/** 导出任务表（内存态即可：进程重启后"运行中"的渲染按失败收尾）。 */
export declare class RenderRegistry {
    private readonly deps;
    private readonly jobs;
    private readonly controllers;
    /** 最近完成任务的实际耗时（毫秒，`A21`；最多留 50 条）。 */
    private readonly durations;
    /** 等待槽位的任务（FIFO，`A4`）。 */
    private readonly pending;
    constructor(deps: {
        readonly render: RenderService;
        /** 成功后把产物登记成素材（可选）。 */
        readonly registerAsset?: (job: RenderJob) => Promise<void>;
        readonly now?: () => Date;
        readonly onError?: (message: string) => void;
        /** 结构化日志钩子（`T7-3`）。 */
        readonly log?: (entry: Record<string, unknown>) => void;
        /** 保留建议钩子的超时（毫秒，默认 2000）：钩子慢不能拖住"渲染成功"的状态流转。 */
        readonly retentionTimeoutMs?: number;
        /** 导出后的保留建议钩子（`A38`）：返回 `undefined` 表示没配上限、不用提示。 */
        readonly retention?: () => Promise<{
            files: number;
            bytes: number;
            removeCount: number;
            freedBytes: number;
            overQuota: boolean;
        } | undefined>;
        /** 同时最多跑几个渲染（`A4`，默认 1：ffmpeg 很吃 CPU，排队比挤爆好）。 */
        readonly maxConcurrent?: number;
    });
    /** 百分比 → 第 N 段（`A41`；边界为空时不带该字段）。 */
    private stepAt;
    /** 当前任务的 ETA（`A52`；拿不到开始时间就不给）。 */
    private etaAt;
    private stamp;
    private patch;
    /** 列出任务（最新在前），可按项目过滤。 */
    /** 记一次耗时（`A21`）：成功/失败/取消都算，最多留 50 条。 */
    private recordDuration;
    /**
     * 渲染统计（`A21` 诊断用）：各结局计数 + 耗时中位数/P90。
     * @returns 统计快照（没有样本时 `durationMs` 为 `undefined`）。
     */
    stats(): {
        finished: number;
        failed: number;
        cancelled: number;
        durationMs?: {
            p50: number;
            p90: number;
        };
    };
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
    /** 把"全局百分比"换算成"第 N 段"用的累计边界（`A41`；纯函数计划，失败就算了）。 */
    private segmentBounds;
    start(timeline: TimelineRecord, options?: {
        priority?: number;
    }): RenderJob;
    /** 真正开跑一个任务（内部：start 或出队时调用）。 */
    /**
     * 构建摘要并在需要时附上保留建议（`A38`）：钩子失败只记日志，绝不让渲染结果失败。
     */
    private summarise;
    private launch;
    /** 进程重启时把遗留的"运行中"任务按失败收尾。 */
    failStale(reason: string): number;
}
