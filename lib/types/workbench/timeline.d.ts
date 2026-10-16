/**
 * 时间轴（阶段 5）的模型与校验：轨道（video/audio/subtitle）+ clip。
 *
 * 边界（`R-TML-1`）：模型**只存引用**——素材用宿主 `outputs/` 里的路径引用、字幕用文本，
 * 文档里**不允许内联字节**（base64/data URL 一律拒），这样时间轴记录可 diff、可携带、
 * 也能直接进阶段 8 的项目包。
 */
/** 轨道种类。 */
export type TrackKind = 'video' | 'audio' | 'subtitle';
/** 字幕样式（`T5-3` 用；先落在模型里，渲染时再解释）。 */
export interface SubtitleStyle {
    readonly fontSize?: number;
    readonly color?: string;
    readonly position?: 'top' | 'middle' | 'bottom';
}
/** 时间轴上的一个片段。 */
export interface TimelineClip {
    readonly id: string;
    /** 素材引用：宿主 outputs 里的文件路径（视频/音频轨必填）。 */
    readonly assetPath?: string;
    /** 字幕文本（字幕轨必填）。 */
    readonly text?: string;
    /** 时间轴上的起点（毫秒）。 */
    readonly startMs: number;
    /** 持续时长（毫秒）。 */
    readonly durationMs: number;
    /** 源内偏移（裁剪起点，毫秒）。 */
    readonly inMs?: number;
    readonly style?: SubtitleStyle;
}
/** 一条轨道。 */
export interface TimelineTrack {
    readonly id: string;
    readonly kind: TrackKind;
    readonly clips: readonly TimelineClip[];
    readonly muted?: boolean;
}
/** 时间轴文档。 */
export interface TimelineRecord {
    readonly schemaVersion: 1;
    readonly id: string;
    readonly projectId: string;
    readonly name: string;
    readonly frameRate: number;
    readonly tracks: readonly TimelineTrack[];
    /** 导出时是否把字幕烧进画面（`T5-3`）：关掉时字幕数据仍保留，只是不烧录。 */
    readonly burnSubtitles: boolean;
    readonly createdAt: string;
    readonly updatedAt: string;
}
/** 默认帧率（预览/导出对齐用）。 */
export declare const DEFAULT_FRAME_RATE = 30;
/** 一次时间轴最多多少 clip（挡住畸形载荷）。 */
export declare const MAX_TIMELINE_CLIPS = 400;
/** 单个 clip 最长 30 分钟。 */
export declare const MAX_CLIP_DURATION_MS: number;
/** 单条字幕文本上限。 */
export declare const MAX_SUBTITLE_LENGTH = 2000;
/** 判断一个引用是不是"内联字节"（data URL / base64 大块）。 */
export declare function looksInlinedBytes(value: string): boolean;
/**
 * 校验并归一化轨道。
 * @param raw - 待校验的轨道数组。
 * @returns 归一化后的轨道。
 * @throws {Error} 结构不合法、含内联字节、或超出规模上限时。
 */
export declare function normalizeTimelineTracks(raw: unknown): TimelineTrack[];
/** 字幕样式允许的取值范围（越界即拒绝，避免风格面板把畸值写进文档）。 */
export declare const SUBTITLE_FONT_SIZE_RANGE: {
    readonly min: 8;
    readonly max: 200;
};
/**
 * 校验并归一化字幕样式。
 * @param raw - 待校验的样式对象。
 * @param clipId - 出错时用于定位的 clip id。
 * @returns 归一化样式，未给字段时返回空对象。
 * @throws {Error} 取值越界或类型不对时。
 */
export declare function normalizeSubtitleStyle(raw: unknown, clipId: string): SubtitleStyle;
/** 时间轴总时长 = 所有 clip 结束点的最大值（预览与导出口径一致，`R-TML-3`）。 */
export declare function timelineDurationMs(tracks: readonly TimelineTrack[]): number;
