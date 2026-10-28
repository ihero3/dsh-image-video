/**
 * 时间轴交互的纯几何（`B5`）：鼠标位置 ↔ 毫秒、手柄改时长、顺序播放的下一片段。
 *
 * 单独成模块是为了可单测：拖拽落点、手柄伸缩都是"像素比例 ↔ 时间"的换算，


 * 在 jsdom 里量不到真实布局（`getBoundingClientRect` 全 0），集成测试用 stub 的
 * rect 喂同样的函数，行为与线上一致。
 */
import { MAX_CLIP_DURATION_MS } from '../workbench/timeline.ts'
import type { TimelineTrack } from '../workbench/timeline.ts'

/** 轨道 lane 的左右内边距（px），与 CSS `.iv-t-lane` 对齐。 */
export const LANE_PADDING_PX = 8
/** 时间轴最小可导航尺度（ms）：空轨也要有长度，否则落点换算全塌到 0。 */
export const MIN_TIMELINE_MS = 3000
/** 片段最短时长（毫秒）：手柄拖到多短都不许消失。 */
export const MIN_CLIP_MS = 200

/**
 * 把鼠标 x 换算成时间轴上的毫秒位置（按 lane 宽度比例映射，夹在 [0, total]）。
 * @param clientX - 鼠标视口 x。
 * @param lane - lane 的 `{left, width}`（调用方量好的 rect）。
 * @param totalMs - 时间轴总时长。
 * @returns 毫秒位置。
 */
export function laneTimeFromClientX(
  clientX: number,
  lane: { readonly left: number; readonly width: number },
  totalMs: number,
): number {
  const usable = lane.width - LANE_PADDING_PX * 2
  if (usable <= 0 || totalMs <= 0) return 0
  const ratio = (clientX - lane.left - LANE_PADDING_PX) / usable
  return Math.round(Math.min(1, Math.max(0, ratio)) * totalMs)
}

/**
 * 左手柄拖动：改起点（起点只能后移到距右边界一个最短时长处）。
 * @param clip - 原片段的 `{startMs, durationMs}`。
 * @param deltaMs - 鼠标移动换算出的毫秒增量。
 * @returns 新的 `{startMs, durationMs}`。
 */
export function resizeClipLeft(
  clip: { readonly startMs: number; readonly durationMs: number },
  deltaMs: number,
): { startMs: number; durationMs: number } {
  const latestStart = clip.startMs + clip.durationMs - MIN_CLIP_MS
  const startMs = Math.round(Math.min(latestStart, Math.max(0, clip.startMs + deltaMs)))
  return { startMs, durationMs: clip.durationMs - (startMs - clip.startMs) }
}

/**
 * 右手柄拖动：改时长（夹在最短时长与模型上限之间）。
 * @param clip - 原片段。
 * @param deltaMs - 毫秒增量。
 * @returns 新的 `{startMs, durationMs}`。
 */
export function resizeClipRight(
  clip: { readonly startMs: number; readonly durationMs: number },
  deltaMs: number,
): { startMs: number; durationMs: number } {
  const durationMs = Math.round(Math.min(MAX_CLIP_DURATION_MS, Math.max(MIN_CLIP_MS, clip.durationMs + deltaMs)))
  return { startMs: clip.startMs, durationMs }
}

/**
 * 顺序播放：某一时刻之后的下一个视频片段起点（跳过空隙）。
 * @param tracks - 轨道。
 * @param afterMs - 从这一刻之后找。
 * @returns 下一个视频片段的起点；没有则 `undefined`（该结束了）。
 */
export function nextVideoClipStart(
  tracks: readonly TimelineTrack[],
  afterMs: number,
): number | undefined {
  return tracks
    .filter(track => track.kind === 'video')
    .flatMap(track => track.clips)
    .sort((left, right) => left.startMs - right.startMs)
    .find(clip => clip.startMs >= afterMs)?.startMs
}

/** 键盘微调步长（ms）：方向键。 */
export const KEYBOARD_NUDGE_MS = 100
/** 键盘微调步长（ms）：按住 Shift（整秒，时间轴上更常用）。 */
export const KEYBOARD_NUDGE_MS_FAST = 1000

/**
 * 毫秒 → `m:ss.d` 时间码。
 *
 * 专门给 `aria-valuetext` 用：读屏念"1:05.4"比念"65432 毫秒"有用得多，
 * 而画面上的时间码走 `.iv-mono` 显示，两者不该互相替代。
 * @param ms - 毫秒（负数按 0 处理）。
 * @returns 形如 `0:01.2` 的字符串。
 */
export function formatTimecode(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms)) / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}

/**
 * 把一次按键换算成手柄的毫秒增量（键盘与拖拽共用同一套边界规则）。
 *
 * 为什么用毫秒而不是"帧"：时间轴内部只以毫秒为单位，**没有帧率基准**
 * （导出 fps 是导出设置，与编辑粒度不是一回事）。凭空假设 25fps 会让
 * "1 帧"变成一个说不出依据的数字；等时间轴真引入帧率再切。
 *
 * @param key - `KeyboardEvent.key`。
 * @param fast - 是否按住 Shift。
 * @param clip - 手柄所属片段的 `{startMs, durationMs}`。
 * @param totalMs - 时间轴总时长（右手柄的 End 不能拖出这条轨）。
 * @param side - 哪一侧手柄。
 * @returns 增量毫秒；按键不归这里管时返回 `undefined`（调用方不要 `preventDefault`）。
 */
export function nudgeDeltaForKey(
  key: string,
  fast: boolean,
  clip: { readonly startMs: number; readonly durationMs: number },
  totalMs: number,
  side: 'left' | 'right',
): number | undefined {
  const step = fast ? KEYBOARD_NUDGE_MS_FAST : KEYBOARD_NUDGE_MS
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return -step
    case 'ArrowRight':
    case 'ArrowUp':
      return step
    case 'Home':
      // 左：回到 0；右：收到最短时长
      return side === 'left' ? -clip.startMs : MIN_CLIP_MS - clip.durationMs
    case 'End':
      // 左：推到"再推就短于最短时长"的位置；右：拉到上限或轨道末端
      return side === 'left'
        ? clip.durationMs - MIN_CLIP_MS
        : Math.max(MIN_CLIP_MS, Math.min(MAX_CLIP_DURATION_MS, totalMs - clip.startMs)) - clip.durationMs
    default:
      return undefined
  }
}
