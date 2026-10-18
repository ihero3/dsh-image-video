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
    /** 轨道音量倍数（0–2；1 = 原音量，0 = 静音）。导出时按 `volume=` 应用。 */
    readonly volume?: number;
}
/** 轨道音量上限（`R-TML-4`：允许增益到 2 倍，超了就是削波，交给用户自己负责）。 */
export declare const MAX_TRACK_VOLUME = 2;
/** 时间轴文档。 */
/** 导出规格（`R-TML-5` / 总任务书 §7.3）：分辨率、帧率、码率。 */
export interface TimelineExportFormat {
    readonly width: number;
    readonly height: number;
    readonly frameRate: number;
    /** 视频码率（kbps，可选；缺省由编码器 CRF 决定）。 */
    readonly bitrateKbps?: number;
}
/** 默认导出规格：720p30（与 V1 的固定行为一致）。 */
export declare const DEFAULT_EXPORT_FORMAT: TimelineExportFormat;
/** 允许的帧率档位。 */
export declare const EXPORT_FRAME_RATES: readonly number[];
/** 分辨率范围（偶数、2 的倍数；下限 128，上限 4096）。 */
export declare const EXPORT_DIMENSION_RANGE: {
    readonly min: 128;
    readonly max: 4096;
};
/** 码率范围（kbps）。 */
export declare const EXPORT_BITRATE_RANGE: {
    readonly min: 500;
    readonly max: 50000;
};
/**
 * 校验并归一化导出规格。
 * @param raw - 原始取值；缺省即默认 720p30。
 * @returns 归一化规格。
 * @throws {Error} 尺寸/帧率/码率越界时（不静默截断）。
 */
export declare function normalizeExportFormat(raw: unknown): TimelineExportFormat;
export interface TimelineRecord {
    readonly schemaVersion: 1;
    readonly id: string;
    readonly projectId: string;
    readonly name: string;
    readonly frameRate: number;
    readonly tracks: readonly TimelineTrack[];
    /** 导出时是否把字幕烧进画面（`T5-3`）：关掉时字幕数据仍保留，只是不烧录。 */
    readonly burnSubtitles: boolean;
    /** 导出规格（分辨率/帧率/码率）；缺省 720p30。 */
    readonly exportFormat?: TimelineExportFormat;
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
/**
 * 取某个时间点上某类轨道的活动 clip。
 *
 * **预览与导出共用这一份边界判断**（`R-TML-3`）：预览显示哪一段、导出从哪一段切，
 * 都来自这里，所以"预览切换点"与"导出切换点"不会各算一套。
 * @param tracks - 轨道。
 * @param kind - 轨道种类。
 * @param timeMs - 播放头位置（毫秒）。
 * @returns 该时刻的活动 clip，没有则 `undefined`。
 */
export declare function activeClipAt(tracks: readonly TimelineTrack[], kind: TrackKind, timeMs: number): TimelineClip | undefined;
/** 时间轴总时长 = 所有 clip 结束点的最大值（预览与导出口径一致，`R-TML-3`）。 */
export declare function timelineDurationMs(tracks: readonly TimelineTrack[]): number;
