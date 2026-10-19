/**
 * 导出完成摘要（Track A / A37）。
 *
 * 一次导出结束后，用户/Agent 需要知道"到底产出了什么"：文件、大小、时长、规格、
 * 几条轨道各多少片段、有没有音轨/字幕。这些信息本来散落在产物与时间轴里，
 * 这里统一成一份**加法式**结构挂在渲染任务上（不改 `status` 语义，老客户端不会崩）。
 */
import { type TimelineRecord } from '../workbench/timeline.ts';
/** 一次导出的产物摘要。 */
export interface RenderSummary {
    readonly outputPath: string;
    readonly bytes: number;
    /** 实测成片时长（毫秒）。 */
    readonly durationMs: number;
    /** 导出规格（已按时间轴设置归一化）。 */
    readonly format: {
        readonly width: number;
        readonly height: number;
        readonly frameRate: number;
        readonly bitrateKbps?: number;
    };
    /** 各轨道片段数（video/audio/subtitle）。 */
    readonly tracks: {
        readonly video: number;
        readonly audio: number;
        readonly subtitle: number;
    };
    /** 时间轴总片段数。 */
    readonly totalClips: number;
    /** 是否有音轨输出（静音/空音轨为 false）。 */
    readonly hasAudio: boolean;
    /** 是否有字幕轨片段（是否烧录另见 burnSubtitles）。 */
    readonly hasSubtitles: boolean;
    /** 是否把字幕烧进了画面。 */
    readonly burnedSubtitles: boolean;
    readonly renderedAt: string;
}
/**
 * 从时间轴与渲染结果生成摘要。
 * @param timeline - 冻结前的时间轴（只用它的轨道与规格）。
 * @param result - 渲染结果（产物路径/字节/实测时长）。
 * @param now - 时间来源（测试可注入）。
 * @returns 摘要。
 */
export declare function buildRenderSummary(timeline: TimelineRecord, result: {
    readonly outputPath: string;
    readonly bytes: number;
    readonly durationMs: number;
}, now?: () => Date): RenderSummary;
/** 时间轴概览（供摘要之外的快速读取；不依赖渲染结果）。 */
export declare function describeTimeline(timeline: TimelineRecord): {
    readonly totalMs: number;
    readonly tracks: readonly {
        readonly id: string;
        readonly kind: string;
        readonly clips: number;
        readonly ms: number;
    }[];
};
