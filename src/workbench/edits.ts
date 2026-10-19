/**
 * 时间轴编辑操作（Track A / A24）：片段拆分与复制。
 *
 * 为什么放域层：拆分要算"源内偏移 + 变速折算"，复制要保证 id 唯一、不重叠、
 * 不越界——这些规则界面与 Agent 必须一致，否则同一次操作两条路径结果不同。
 */
import type { TimelineClip, TimelineTrack } from './timeline.ts'
import { effectiveDurationMs } from './timeline.ts'

/** 拆分结果。 */
export interface SplitResult {
  readonly tracks: readonly TimelineTrack[]
  /** 拆出的左半（原片段，id 不变）。 */
  readonly leftId: string
  /** 拆出的右半（新片段）。 */
  readonly rightId: string
}

/** 复制结果。 */
export interface DuplicateResult {
  readonly tracks: readonly TimelineTrack[]
  readonly newClipId: string
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
export function splitClipAt(
  tracks: readonly TimelineTrack[],
  clipId: string,
  atMs: number,
  newId: () => string,
): SplitResult {
  const owner = tracks.find(track => track.clips.some(clip => clip.id === clipId))
  const clip = owner?.clips.find(candidate => candidate.id === clipId)
  if (owner === undefined || clip === undefined) throw new Error(`找不到片段 ${clipId}`)
  const start = clip.startMs
  const length = effectiveDurationMs(clip)
  const at = Math.round(atMs)
  if (at <= start || at >= start + length) {
    throw new Error(`拆分点 ${at}ms 必须在片段内部（${start}..${start + length}ms，不含首尾）`)
  }
  const leftMs = at - start
  const rightMs = length - leftMs
  const speed = clip.speed ?? 1
  // 左半消耗的源内时长（毫秒）= 时间轴时长 × 速度
  const consumedSourceMs = Math.round(leftMs * speed)
  const rightId = newId()

  const left: TimelineClip = { ...clip, durationMs: Math.max(1, Math.round(leftMs * speed)) }
  const right: TimelineClip = {
    ...clip,
    id: rightId,
    startMs: at,
    durationMs: Math.max(1, Math.round(rightMs * speed)),
    inMs: (clip.inMs ?? 0) + consumedSourceMs,
    // 右侧保留原有转场（转场是"与上一段之间"的语义，拆开后仍属于右半）
  }
  const tracksNext = tracks.map(track => track.id !== owner.id
    ? track
    : { ...track, clips: track.clips.flatMap(candidate => candidate.id !== clipId ? [candidate] : [left, right]) })
  return { tracks: tracksNext, leftId: clipId, rightId }
}

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
export function duplicateClip(
  tracks: readonly TimelineTrack[],
  clipId: string,
  newId: () => string,
  options: { readonly startMs?: number; readonly trackKind?: TimelineTrack['kind'] } = {},
): DuplicateResult {
  const owner = tracks.find(track => track.clips.some(clip => clip.id === clipId))
  const clip = owner?.clips.find(candidate => candidate.id === clipId)
  if (owner === undefined || clip === undefined) throw new Error(`找不到片段 ${clipId}`)
  const target = options.trackKind === undefined
    ? owner
    : tracks.find(track => track.kind === options.trackKind) ?? owner
  const copyId = newId()
  const copy: TimelineClip = {
    ...clip,
    id: copyId,
    startMs: options.startMs === undefined ? clip.startMs + effectiveDurationMs(clip) : Math.max(0, Math.round(options.startMs)),
  }
  const tracksNext = tracks.map(track => track.id !== target.id
    ? track
    : { ...track, clips: [...track.clips, copy] })
  return { tracks: tracksNext, newClipId: copyId }
}
