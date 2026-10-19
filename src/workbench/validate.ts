/**
 * 时间轴一致性校验（Track A / A34）。
 *
 * 存在的意义：渲染器只在**导出时**才报"片段重叠/视频轨为空"这类错，用户已经点了导出；
 * 这个校验器让界面（拖拽/保存前）与 Agent 能**提前**拿到同一份问题清单。
 * 与渲染器共用域规则，避免"界面说没问题、导出却失败"。
 */
import { effectiveDurationMs, transitionOverlapMs, type TimelineRecord, type TimelineTrack } from './timeline.ts'

/** 问题码。 */
export type TimelineIssueCode =
  | 'empty-video-track'
  | 'overlap'
  | 'dangling-ducking'
  | 'ducking-on-non-audio'
  | 'transition-not-adjacent'
  | 'empty-subtitle'
  | 'gapped-crossfade'

/** 一条问题。 */
export interface TimelineIssue {
  readonly code: TimelineIssueCode
  /** 面向人（也是面向模型）的一句话，讲清"哪里不对 + 怎么改"。 */
  readonly message: string
  readonly trackId?: string
  readonly clipId?: string
}

/** 校验选项。 */
export interface ValidateTimelineOptions {
  /** 已知素材路径（给了就检查引用是否悬空；不给就跳过该项）。 */
  readonly knownAssetPaths?: ReadonlySet<string>
}

/**
 * 校验一条时间轴。
 * @param timeline - 时间轴文档。
 * @param options - 校验选项。
 * @returns 问题清单（空数组 = 可以导出）。
 */
export function validateTimeline(
  timeline: TimelineRecord,
  options: ValidateTimelineOptions = {},
): TimelineIssue[] {
  const issues: TimelineIssue[] = []
  const tracks = timeline.tracks as readonly TimelineTrack[]
  const videoTrack = tracks.find(track => track.kind === 'video')
  if (videoTrack === undefined || videoTrack.clips.length === 0) {
    issues.push({ code: 'empty-video-track', message: '视频轨是空的：导出会失败，先从素材面板往视频轨加片段。' })
  }

  for (const track of tracks) {
    // 同轨重叠（渲染器同样会拒，这里提前说）
    const ordered = [...track.clips].sort((left, right) => left.startMs - right.startMs)
    let cursor = -1
    let previous: (typeof ordered)[number] | undefined
    for (const clip of ordered) {
      if (clip.startMs < cursor) {
        issues.push({
          code: 'overlap', trackId: track.id, clipId: clip.id,
          message: `${track.kind} 轨片段 ${clip.id} 与前一片段重叠（起点 ${clip.startMs}ms < 前一段结束 ${cursor}ms）：错开起点或缩短前一片段。`,
        })
      }
      // 转场只在"首尾相接"时生效，否则会被静默忽略 → 提前提示
      if (clip.transition !== undefined && track.kind === 'video' && previous !== undefined) {
        const previousEnd = previous.startMs + effectiveDurationMs(previous)
        if (Math.abs(clip.startMs - previousEnd) > 1) {
          issues.push({
            code: 'transition-not-adjacent', trackId: track.id, clipId: clip.id,
            message: `片段 ${clip.id} 设了转场，但与上一片段之间有 ${clip.startMs - previousEnd}ms 空档：转场不会生效，把两段接上或取消转场。`,
          })
        }
      }
      // 侧链只在音频轨上有意义
      if (clip.text !== undefined && clip.text.trim() === '') {
        issues.push({ code: 'empty-subtitle', trackId: track.id, clipId: clip.id, message: `字幕片段 ${clip.id} 文本为空。` })
      }
      if (options.knownAssetPaths !== undefined && clip.assetPath !== undefined && !options.knownAssetPaths.has(clip.assetPath)) {
        issues.push({
          code: 'empty-subtitle', trackId: track.id, clipId: clip.id,
          message: `片段 ${clip.id} 引用的素材 ${clip.assetPath} 不在素材库里：先登记素材或换成已有素材。`,
        })
      }
      cursor = Math.max(cursor, clip.startMs + effectiveDurationMs(clip))
      previous = clip
    }

    if (track.duckUnderTrackId !== undefined) {
      if (track.kind !== 'audio') {
        issues.push({ code: 'ducking-on-non-audio', trackId: track.id, message: `${track.kind} 轨 ${track.id} 设了侧链压缩：只有音频轨支持。` })
      }
      const trigger = tracks.find(candidate => candidate.id === track.duckUnderTrackId)
      if (trigger === undefined) {
        issues.push({
          code: 'dangling-ducking', trackId: track.id,
          message: `音轨 ${track.id} 的侧链触发轨 ${track.duckUnderTrackId} 不存在：指向一条实际存在的音轨（通常是旁白轨）。`,
        })
      } else if (trigger.clips.length === 0) {
        issues.push({ code: 'dangling-ducking', trackId: track.id, message: `侧链触发轨 ${trigger.id} 是空的：旁白轨没有片段，背景音乐不会被压低。` })
      }
    }

    // 交叉淡化只在全程首尾相接时生效
    if (track.kind === 'audio' && (track.crossfadeMs ?? 0) > 0 && ordered.length > 1) {
      for (let index = 1; index < ordered.length; index += 1) {
        const previousClip = ordered[index - 1]!
        const clip = ordered[index]!
        const previousEnd = previousClip.startMs + effectiveDurationMs(previousClip)
        if (Math.abs(clip.startMs - previousEnd) > 1) {
          issues.push({
            code: 'gapped-crossfade', trackId: track.id, clipId: clip.id,
            message: `音轨 ${track.id} 设了交叉淡化，但片段 ${previousClip.id} 与 ${clip.id} 之间有 ${clip.startMs - previousEnd}ms 空档：会回落成普通拼接，接上或调小 crossfadeMs。`,
          })
          break
        }
      }
    }

    // 转场重叠不能超过任一侧时长的一半（与时间轴时长折算一致）
    for (let index = 1; index < ordered.length; index += 1) {
      const clip = ordered[index]!
      const previousClip = ordered[index - 1]!
      if (clip.transition === undefined || track.kind !== 'video') continue
      const declared = clip.transitionDurationMs
      const applied = transitionOverlapMs(clip, previousClip)
      if (declared !== undefined && declared > applied) {
        issues.push({
          code: 'transition-not-adjacent', trackId: track.id, clipId: clip.id,
          message: `片段 ${clip.id} 的转场时长 ${declared}ms 超过生效上限 ${applied}ms（不能超过任一侧片段时长的一半）：会被夹到 ${applied}ms。`,
        })
      }
    }
  }
  return issues
}
