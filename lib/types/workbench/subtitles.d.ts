/**
 * 字幕批量生成（Track A / A14）：把一段台词/文案切成句子，再按字数把时间窗分配成多条字幕片段。
 *
 * 为什么放在域层：切句与时间分配是**业务规则**（中英标点、长度上限、最短显示时长、
 * 不重叠、不越界），客户端与 Agent 必须用同一套，否则两边生成的字幕节奏会不一样。
 */
import type { SubtitleStyle, TimelineClip } from './timeline.ts';
/** 切句选项。 */
export interface SplitOptions {
    /** 单条字幕最多多少字（默认 28；中文一行约 14–18 字，28 允许两行）。 */
    readonly maxChars?: number;
}
/** 分配选项。 */
export interface PlanOptions extends SplitOptions {
    /** 时间窗起点（毫秒）。 */
    readonly startMs: number;
    /** 时间窗终点（毫秒，不含）。 */
    readonly endMs: number;
    /** 单条字幕最少显示多久（默认 600ms）。 */
    readonly minDurationMs?: number;
    /** 统一套用的字幕样式。 */
    readonly style?: SubtitleStyle;
    /** id 生成器（测试可注入）。 */
    readonly newId?: () => string;
}
/**
 * 把文本切成适合做字幕的短句（保留原文顺序，丢弃空段）。
 * @param text - 原始文本（台词、旁白、文案均可）。
 * @param options - 切句选项。
 * @returns 非空短句数组。
 */
export declare function splitSubtitleSentences(text: string, options?: SplitOptions): string[];
/**
 * 把文本排成一组**连续、不重叠、不越界**的字幕片段。
 *
 * 时间分配按字数比例（长句显示更久），并保证每条不短于 `minDurationMs`；
 * 条数太多放不下时**截断文本**（而不是把每条压到看不见）。
 *
 * @param text - 文本。
 * @param options - 时间窗与样式。
 * @returns 字幕片段（`kind` 层面属于字幕轨，调用方负责放进轨道）。
 * @throws {Error} 时间窗非法时。
 */
export declare function planSubtitleClips(text: string, options: PlanOptions): TimelineClip[];
/**
 * 生成确定性的字幕 id 生成器（测试/可复现脚本用）。
 * @param prefix - id 前缀。
 * @returns 每次调用返回 `<prefix>-0`、`<prefix>-1`…
 */
export declare function makeSubtitleIds(prefix: string): () => string;
/**
 * 把字幕文本按**显示宽度**折成多行（`A25`）。
 *
 * 规则：尊重原文里的换行；每行不超过 `maxChars`；优先在标点处断行
 * （中文逗号顿号、英文空格），实在没有标点就硬断。
 *
 * @param text - 原始文本（可含换行）。
 * @param maxChars - 每行最多字符数（按等宽 CJK 估算，见 {@link estimateMaxCharsForWidth}）。
 * @returns 折好行的文本（行间用 `\n` 连接）。
 */
export declare function wrapSubtitleLines(text: string, maxChars: number): string;
/**
 * 按画面宽度与字号估算每行能放多少个 CJK 字符（`A25`）。
 * @param width - 画面宽（像素）。
 * @param fontSize - 字号（像素）。
 * @returns 每行建议字符数（至少 6）。
 */
export declare function estimateMaxCharsForWidth(width: number, fontSize: number): number;
