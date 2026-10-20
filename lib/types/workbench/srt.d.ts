/**
 * SRT 字幕导入 / 导出（Track A / A118）。
 *
 * 创作者手上常有现成 SRT；剪完也可能要把字幕交给别人。这里只做**纯解析与序列化**
 * （便于单测），端点负责与时间轴互转。
 *
 * 容错：BOM、CRLF、多余空行、序号缺失/错乱、时间码小数用 `.` 而非 `,` —— 真实文件很脏。
 */
/** 一条字幕。 */
export interface SrtCue {
    /** 原文序号（1 起；缺失时为位置序）。 */
    readonly index: number;
    readonly startMs: number;
    readonly endMs: number;
    readonly text: string;
}
export interface ParseResult {
    readonly cues: readonly SrtCue[];
    /** 解析过程中被跳过的块（给用户可见的提示）。 */
    readonly skipped: readonly string[];
}
/** 时间码 → 毫秒：`00:01:02,500` 或 `00:01:02.500`。 */
export declare function parseTimecode(raw: string): number | undefined;
/** 毫秒 → 时间码：`00:01:02,500`。 */
export declare function formatTimecode(ms: number): string;
/**
 * 解析 SRT 文本。
 * @param text - SRT 内容（容忍 BOM/CRLF/多余空行）。
 * @returns 字幕数组与被跳过的块说明。
 */
export declare function parseSrt(text: string): ParseResult;
/**
 * 序列化为 SRT 文本。
 * @param cues - 字幕数组（会按起始时间排序并重排序号）。
 * @returns SRT 文本（以换行结尾）。
 */
export declare function serializeSrt(cues: readonly SrtCue[]): string;
