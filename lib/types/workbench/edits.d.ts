/**
 * 时间轴编辑操作（Track A / A24）：片段拆分与复制。
 *
 * 为什么放域层：拆分要算"源内偏移 + 变速折算"，复制要保证 id 唯一、不重叠、
 * 不越界——这些规则界面与 Agent 必须一致，否则同一次操作两条路径结果不同。
 */
import type { TimelineTrack } from './timeline.ts';
/** 拆分结果。 */
export interface SplitResult {
    readonly tracks: readonly TimelineTrack[];
    /** 拆出的左半（原片段，id 不变）。 */
    readonly leftId: string;
    /** 拆出的右半（新片段）。 */
    readonly rightId: string;
}
/** 复制结果。 */
export interface DuplicateResult {
    readonly tracks: readonly TimelineTrack[];
    readonly newClipId: string;
}
/**
 * 在给定时间点把片段一分为二。
 *
 * 规则：拆分点必须**严格落在片段内部**（不能等于首尾）；两半的时长之和等于原时长；
 * 右半的 `inMs` 要把左半消耗的**源内时长**补上（变速时按 `speed` 折算）。
 *
 * @param tracks - 轨道。
 * @param clipId - 要拆的片段。
 * @param atMs - 拆分点（时间轴毫秒，绝对时间）。
 * @param newId - 新片段 id 生成器。
 * @returns 新轨道与两半的 id。
 * @throws {Error} 片段不存在或拆分点不在片段内部时。
 */
export declare function splitClipAt(tracks: readonly TimelineTrack[], clipId: string, atMs: number, newId: () => string): SplitResult;
/**
 * 复制片段：默认放在同一轨、紧跟原片段之后；也可以指定新的起点或换到同类型轨道。
 *
 * @param tracks - 轨道。
 * @param clipId - 要复制的片段。
 * @param newId - 新片段 id 生成器。
 * @param options - 覆盖落点（`startMs`）或目标轨道（`trackKind`）。
 * @returns 新轨道与新片段 id。
 * @throws {Error} 片段不存在时。
 */
export declare function duplicateClip(tracks: readonly TimelineTrack[], clipId: string, newId: () => string, options?: {
    readonly startMs?: number;
    readonly trackKind?: TimelineTrack['kind'];
}): DuplicateResult;
