import type { TimelineTrack } from '../workbench/timeline.ts';
/** 轨道 lane 的左右内边距（px），与 CSS `.iv-t-lane` 对齐。 */
export declare const LANE_PADDING_PX = 8;
/** 时间轴最小可导航尺度（ms）：空轨也要有长度，否则落点换算全塌到 0。 */
export declare const MIN_TIMELINE_MS = 3000;
/** 片段最短时长（毫秒）：手柄拖到多短都不许消失。 */
export declare const MIN_CLIP_MS = 200;
/**
 * 把鼠标 x 换算成时间轴上的毫秒位置（按 lane 宽度比例映射，夹在 [0, total]）。
 * @param clientX - 鼠标视口 x。
 * @param lane - lane 的 `{left, width}`（调用方量好的 rect）。
 * @param totalMs - 时间轴总时长。
 * @returns 毫秒位置。
 */
export declare function laneTimeFromClientX(clientX: number, lane: {
    readonly left: number;
    readonly width: number;
}, totalMs: number): number;
/**
 * 左手柄拖动：改起点（起点只能后移到距右边界一个最短时长处）。
 * @param clip - 原片段的 `{startMs, durationMs}`。
 * @param deltaMs - 鼠标移动换算出的毫秒增量。
 * @returns 新的 `{startMs, durationMs}`。
 */
export declare function resizeClipLeft(clip: {
    readonly startMs: number;
    readonly durationMs: number;
}, deltaMs: number): {
    startMs: number;
    durationMs: number;
};
/**
 * 右手柄拖动：改时长（夹在最短时长与模型上限之间）。
 * @param clip - 原片段。
 * @param deltaMs - 毫秒增量。
 * @returns 新的 `{startMs, durationMs}`。
 */
export declare function resizeClipRight(clip: {
    readonly startMs: number;
    readonly durationMs: number;
}, deltaMs: number): {
    startMs: number;
    durationMs: number;
};
/**
 * 顺序播放：某一时刻之后的下一个视频片段起点（跳过空隙）。
 * @param tracks - 轨道。
 * @param afterMs - 从这一刻之后找。
 * @returns 下一个视频片段的起点；没有则 `undefined`（该结束了）。
 */
export declare function nextVideoClipStart(tracks: readonly TimelineTrack[], afterMs: number): number | undefined;
