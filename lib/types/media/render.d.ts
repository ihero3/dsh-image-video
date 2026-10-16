import { type FfmpegProbe } from './ffmpeg.ts';
import type { TimelineRecord, TimelineTrack } from '../workbench/timeline.ts';
/** 渲染用的时间轴快照（冻结后与原文档再无关系）。 */
export interface TimelineSnapshot {
    readonly id: string;
    readonly frameRate: number;
    readonly burnSubtitles: boolean;
    readonly durationMs: number;
    readonly tracks: readonly TimelineTrack[];
}
/** 一段画面：要么是素材 clip，要么是补的黑场。 */
export type VideoSegment = {
    readonly kind: 'clip';
    readonly clipId: string;
    readonly assetPath: string;
    readonly inMs: number;
    readonly durationMs: number;
} | {
    readonly kind: 'filler';
    readonly durationMs: number;
};
/** 一次渲染的进度。 */
export interface RenderProgress {
    readonly percent: number;
    readonly outTimeMs: number;
}
/** 渲染结果。 */
export interface RenderResult {
    readonly outputPath: string;
    readonly bytes: number;
    readonly durationMs: number;
}
/** 渲染失败的机器码。 */
export type RenderErrorCode = 'MEDIA_FFMPEG_UNAVAILABLE' | 'MEDIA_FFMPEG_ENCODER_MISSING' | 'MEDIA_ASSET_MISSING' | 'MEDIA_TIMELINE_OVERLAP' | 'MEDIA_TIMELINE_EMPTY' | 'MEDIA_DISK_FULL' | 'MEDIA_ENCODER_UNSUPPORTED' | 'MEDIA_RENDER_FAILED' | 'MEDIA_RENDER_CANCELLED' | 'MEDIA_OUTPUT_INVALID';
/** 带机器码与可操作文案的渲染错误。 */
export declare class RenderError extends Error {
    readonly code: RenderErrorCode;
    constructor(code: RenderErrorCode, message: string);
}
/** 画布尺寸（一期固定 720p，避免不同尺寸素材拼不上）。 */
export declare const RENDER_WIDTH = 1280;
export declare const RENDER_HEIGHT = 720;
/** 时长容差：导出时长与时间轴时长允许差 ±1 帧。 */
export declare function frameToleranceMs(frameRate: number): number;
/** 深拷贝成快照：之后改原文档不影响本次渲染。 */
export declare function freezeTimeline(timeline: TimelineRecord): TimelineSnapshot;
/**
 * 把视频轨排成"片段 + 黑场填充"的序列。
 * @param snapshot - 冻结快照。
 * @returns 顺序片段；同一轨道内重叠会抛 `MEDIA_TIMELINE_OVERLAP`。
 */
export declare function planVideoSegments(snapshot: TimelineSnapshot): VideoSegment[];
/** 字幕烧录用的字体（macOS 常见中文字体，找不到就退回 ffmpeg 内置）。 */
export declare const SUBTITLE_FONT_CANDIDATES: readonly string[];
/**
 * 拼出渲染用的 ffmpeg 参数（纯函数，便于断言）。
 * @param snapshot - 冻结快照。
 * @param options - 输出路径、字体、画布尺寸。
 * @returns `ffmpeg` 参数数组（不含可执行文件本身）。
 */
export declare function buildRenderArgs(snapshot: TimelineSnapshot, options: {
    outputPath: string;
    fontFile?: string;
    width?: number;
    height?: number;
}): string[];
/** 跑 ffmpeg 并解析 `-progress` 输出。 */
export interface RenderRunner {
    (args: {
        readonly ffmpegPath: string;
        readonly args: readonly string[];
        readonly signal?: AbortSignal;
        readonly onProgress?: (progress: RenderProgress) => void;
        readonly durationMs: number;
    }): Promise<void>;
}
/** 默认 runner：spawn ffmpeg、解析 out_time_ms、abort 时杀进程。 */
export declare const defaultRenderRunner: RenderRunner;
/** 渲染服务。 */
export declare class RenderService {
    private readonly deps;
    constructor(deps: {
        readonly outputsDir: string;
        readonly now?: () => Date;
        readonly run?: RenderRunner;
        /** ffmpeg 探测（测试可注入；默认探测本机）。 */
        readonly probe?: () => Promise<FfmpegProbe>;
    });
    /**
     * 把一个时间轴渲染成 mp4。
     * @param timeline - 当前时间轴文档（内部会先冻结成快照）。
     * @param options - 输出文件名、取消信号、进度回调。
     * @returns 输出路径、字节数与实测时长。
     * @throws {RenderError} 见 {@link RenderErrorCode}。
     */
    render(timeline: TimelineRecord, options?: {
        signal?: AbortSignal;
        onProgress?: (progress: RenderProgress) => void;
        fileName?: string;
    }): Promise<RenderResult>;
}
/** 用 `ffmpeg -i` 的输出量一下真实时长（不依赖 ffprobe 是否单独安装）。 */
export declare function measureDuration(ffmpegPath: string, file: string): Promise<number | undefined>;
