/**
 * WebVTT 字幕编解码（Track A / A122）。
 *
 * Web 平台（B 站/YouTube/网页播放器）普遍吃 VTT。与 SRT 的差别：
 * - 必须有 `WEBVTT` 头（真实文件偶尔缺失，这里容错但记录提示）
 * - 时间码用 `.` 分隔毫秒，且允许省略小时（`MM:SS.mmm`）
 * - 时间码后可跟渲染设置（`align:start position:10%`），解析时忽略
 * - 允许 `NOTE` / `STYLE` / `REGION` 等注释块，解析时跳过
 */
import type { SrtCue } from './srt.ts';
export interface VttParseResult {
    readonly cues: readonly SrtCue[];
    readonly skipped: readonly string[];
    /** 文件缺少 `WEBVTT` 头（仍尽量解析）。 */
    readonly missingHeader: boolean;
}
/** 毫秒 → VTT 时间码：`00:01:02.500`（VTT 用点）。 */
export declare function formatVttTimecode(ms: number): string;
/** VTT 时间码 → 毫秒（允许 `MM:SS.mmm` 与时间码后的设置）。 */
export declare function parseVttTimecode(raw: string): number | undefined;
/**
 * 解析 VTT 文本。
 * @param text - WebVTT 内容。
 * @returns 字幕数组、跳过的块、是否缺头。
 */
export declare function parseVtt(text: string): VttParseResult;
/**
 * 序列化为 VTT 文本。
 * @param cues - 字幕（按起始时间排序并重编号）。
 * @returns VTT 文本（带 WEBVTT 头）。
 */
export declare function serializeVtt(cues: readonly SrtCue[]): string;
