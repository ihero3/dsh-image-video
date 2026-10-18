import { type FfmpegProbe } from './ffmpeg.ts';
import type { TimelineRecord, TimelineTrack } from '../workbench/timeline.ts';
import { type TimelineExportFormat } from '../workbench/timeline.ts';
/** 渲染用的时间轴快照（冻结后与原文档再无关系）。 */
export interface TimelineSnapshot {
    readonly id: string;
    readonly frameRate: number;
    readonly burnSubtitles: boolean;
    /** 导出规格（冻结后不受后续编辑影响）。 */
    readonly exportFormat: TimelineExportFormat;
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
    /** 变速倍数（缺省 1）。 */
    readonly speed?: number;
    /** 淡入淡出时长（毫秒）。 */
    readonly fade?: number;
    /** 画面裁剪（像素，相对源）。 */
    readonly crop?: {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
    };
    /** 与上一个片段的转场（`A13b`）：类型 + 生效时长（毫秒）。 */
    readonly transition?: string;
    readonly transitionMs?: number;
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
    frameRate?: number;
    format?: TimelineExportFormat;
}): string[];
/** 一条要参与混音的音轨（已排除静音/零音量轨）。 */
export interface PlannedAudioTrack {
    readonly trackId: string;
    readonly volume: number;
    readonly segments: readonly VideolessSegment[];
}
/** 音轨片段（结构与画面片段一致，只是来源是音频文件）。 */
export type VideolessSegment = {
    readonly kind: 'clip';
    readonly clipId: string;
    readonly assetPath: string;
    readonly inMs: number;
    readonly durationMs: number;
} | {
    readonly kind: 'filler';
    readonly durationMs: number;
};
/**
 * 规划参与导出的音轨（`R-TML-4`）：静音轨与 0 音量轨直接不输出；轨内重叠报错；
 * 间隙与尾部补静音，保证与画面等长。
 * @param snapshot - 冻结快照。
 * @returns 需要混音的音轨（可能为空 = 输出无音轨）。
 */
export declare function planAudioTracks(snapshot: TimelineSnapshot): PlannedAudioTrack[];
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
    /** 输出目录统一解析成绝对路径：素材记录里存相对路径会让后续 ffmpeg/预览都找不到文件。 */
    private readonly outputsDir;
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
/**
 * 用 `ffmpeg -i` 的输出探测产物规格（不依赖 ffprobe 单独安装）。
 * @param ffmpegPath - ffmpeg 可执行文件。
 * @param file - 待探测文件。
 * @returns 宽/高/帧率/是否含音轨；解析不出来时为 `undefined`。
 */
export declare function probeMediaSpec(ffmpegPath: string, file: string): Promise<{
    width?: number;
    height?: number;
    fps?: number;
    hasAudio: boolean;
} | undefined>;
/** 用 `ffmpeg -i` 的输出量一下真实时长（不依赖 ffprobe 是否单独安装）。 */
export declare function measureDuration(ffmpegPath: string, file: string): Promise<number | undefined>;
