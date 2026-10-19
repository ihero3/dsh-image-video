/**
 * 时间轴一致性校验（Track A / A34）。
 *
 * 存在的意义：渲染器只在**导出时**才报"片段重叠/视频轨为空"这类错，用户已经点了导出；
 * 这个校验器让界面（拖拽/保存前）与 Agent 能**提前**拿到同一份问题清单。
 * 与渲染器共用域规则，避免"界面说没问题、导出却失败"。
 */
import {
  MAX_TIMELINE_CLIPS, effectiveDurationMs, transitionOverlapMs, type TimelineRecord, type TimelineTrack,
} from './timeline.ts'

/**
 * 未保存时间轴（inline document）的输入上限（`A40`）。
 *
 * 端点接受"未保存的文档"是为了让界面在拖拽/保存前预检——但也意味着输入不受存储层
 * 那些规模校验保护。这里补上与存储一致的边界，避免误传超大文档白跑、撑内存。
 */
export const INLINE_TIMELINE_LIMITS = {
  /** JSON 序列化后的体积上限（字节）。 */
  maxBytes: 2_000_000,
  /** 片段总数上限（**与存储层同一个常量**，避免两处数字漂移）。 */
  maxClips: MAX_TIMELINE_CLIPS,
  /** 轨道数上限。 */
  maxTracks: 50,
} as const

/**
 * 检查 inline 时间轴文档是否在边界内。
 * @param document - 待检查的原始输入。
 * @returns 超限时返回面向人的错误说明；正常返回 `undefined`。
 */
export function checkInlineTimelineBounds(document: unknown): string | undefined {
  if (typeof document !== 'object' || document === null) return 'document 必须是一个对象'
  let serialized: string
  try {
    serialized = JSON.stringify(document)
  } catch {
    return 'document 无法序列化（可能包含循环引用）'
  }
  if (serialized.length > INLINE_TIMELINE_LIMITS.maxBytes) {
    return `inline document 太大（${serialized.length} 字节 > 上限 ${INLINE_TIMELINE_LIMITS.maxBytes}）：先保存时间轴再校验，或拆小后再试`
  }
  const tracks = (document as { tracks?: unknown }).tracks
  if (!Array.isArray(tracks)) return 'document.tracks 必须是数组'
  if (tracks.length > INLINE_TIMELINE_LIMITS.maxTracks) {
    return `inline document 轨道太多（${tracks.length} > ${INLINE_TIMELINE_LIMITS.maxTracks}）`
  }
  let clips = 0
  for (const track of tracks) {
    const list = (track as { clips?: unknown }).clips
    if (!Array.isArray(list)) return '每个轨道都必须有 clips 数组'
    clips += list.length
    if (clips > INLINE_TIMELINE_LIMITS.maxClips) {
      return `inline document 片段太多（已超过 ${INLINE_TIMELINE_LIMITS.maxClips}）：先保存时间轴再校验`
    }
  }
  return undefined
}

/** 问题码。 */
export type TimelineIssueCode =
  | 'empty-video-track'
  | 'overlap'
  | 'dangling-ducking'
  | 'ducking-on-non-audio'
  | 'transition-not-adjacent'
  | 'empty-subtitle'
  | 'missing-asset'
  | 'self-ducking'
  | 'gapped-crossfade'
  | 'dangling-burn-language'
  | 'duplicate-subtitle-language'
  | 'subtitle-burn-overlap'
  | 'clip-longer-than-asset'

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
/**
 * 用**真实素材时长**找"片段比素材还长"的越界（`A45`）。
 *
 * 分成纯函数是为了可单测：探测由调用方做（`assets/probe` / RPC 端点），这里只做判定。
 * 越界片段在导出时会被截断或补黑，用户看到的是"后半段没画面"，很难自查。
 *
 * @param timeline - 时间轴。
 * @param durations - 素材路径 → 真实时长（毫秒）；缺的跳过。
 * @param toleranceMs - 容差（默认 120ms，覆盖编码器的时间基误差）。
 * @returns 问题清单。
 */
export function findClipOverruns(
  timeline: TimelineRecord,
  durations: ReadonlyMap<string, number>,
  toleranceMs = 120,
): TimelineIssue[] {
  const issues: TimelineIssue[] = []
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.assetPath === undefined) continue
      const available = durations.get(clip.assetPath)
      if (available === undefined) continue
      const needed = (clip.inMs ?? 0) + clip.durationMs
      if (needed > available + toleranceMs) {
        issues.push({
          code: 'clip-longer-than-asset',
          trackId: track.id,
          clipId: clip.id,
          message: `片段 ${clip.id} 需要 ${needed}ms（源内偏移 ${clip.inMs ?? 0}ms + 时长 ${clip.durationMs}ms），但素材只有 ${available}ms：缩短片段或降低速度，否则成片后半段没画面。`,
        })
      }
    }
  }
  return issues
}

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
          code: 'missing-asset', trackId: track.id, clipId: clip.id,
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
      if (track.duckUnderTrackId === track.id) {
        issues.push({
          code: 'self-ducking', trackId: track.id,
          message: `音轨 ${track.id} 的侧链指向了自己：自身压自身在导出时会造出非法滤镜链，指向另一条音轨（通常是旁白轨）。`,
        })
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
  // 字幕语言（`A42`）：悬空的 burnLanguage / 同语言重复 / 多条字幕叠在一起烧
  const subtitleTracks = tracks.filter(track => track.kind === 'subtitle' && track.clips.length > 0)
  if (timeline.burnLanguage !== undefined) {
    if (!subtitleTracks.some(track => track.language === timeline.burnLanguage)) {
      issues.push({
        code: 'dangling-burn-language',
        message: `导出指定只烧语言「${timeline.burnLanguage}」的字幕，但没有任何字幕轨带这个语言：改 burnLanguage 或给字幕轨加 language。`,
      })
    }
  }
  const seenLanguages = new Map<string, number>()
  for (const track of subtitleTracks) {
    if (track.language === undefined) continue
    const count = (seenLanguages.get(track.language) ?? 0) + 1
    seenLanguages.set(track.language, count)
    if (count === 2) {
      issues.push({
        code: 'duplicate-subtitle-language', trackId: track.id,
        message: `有多条字幕轨都标了语言「${track.language}」：烧录时会叠在一起，删掉多余的或改语言。`,
      })
    }
  }
  const burnedTracks = subtitleTracks.filter(track => timeline.burnLanguage === undefined || track.language === timeline.burnLanguage)
  if (burnedTracks.length > 1) {
    issues.push({
      code: 'subtitle-burn-overlap',
      message: `会有 ${burnedTracks.length} 条字幕轨同时烧进画面（会叠在一起看不清）：设置 burnLanguage 只烧其中一种语言。`,
    })
  }

  return issues
}
