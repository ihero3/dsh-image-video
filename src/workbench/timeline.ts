/**
 * 时间轴（阶段 5）的模型与校验：轨道（video/audio/subtitle）+ clip。
 *
 * 边界（`R-TML-1`）：模型**只存引用**——素材用宿主 `outputs/` 里的路径引用、字幕用文本，
 * 文档里**不允许内联字节**（base64/data URL 一律拒），这样时间轴记录可 diff、可携带、
 * 也能直接进阶段 8 的项目包。
 */

/** 轨道种类。 */
export type TrackKind = 'video' | 'audio' | 'subtitle'

/** 字幕样式（`T5-3` 用；先落在模型里，渲染时再解释）。 */
export interface SubtitleStyle {
  readonly fontSize?: number
  readonly color?: string
  readonly position?: 'top' | 'middle' | 'bottom'
}

/** 时间轴上的一个片段。 */
export interface TimelineClip {
  readonly id: string
  /** 素材引用：宿主 outputs 里的文件路径（视频/音频轨必填）。 */
  readonly assetPath?: string
  /** 字幕文本（字幕轨必填）。 */
  readonly text?: string
  /** 时间轴上的起点（毫秒）。 */
  readonly startMs: number
  /** 持续时长（毫秒）。 */
  readonly durationMs: number
  /** 源内偏移（裁剪起点，毫秒）。 */
  readonly inMs?: number
  readonly style?: SubtitleStyle
}

/** 一条轨道。 */
export interface TimelineTrack {
  readonly id: string
  readonly kind: TrackKind
  readonly clips: readonly TimelineClip[]
  readonly muted?: boolean
}

/** 时间轴文档。 */
export interface TimelineRecord {
  readonly schemaVersion: 1
  readonly id: string
  readonly projectId: string
  readonly name: string
  readonly frameRate: number
  readonly tracks: readonly TimelineTrack[]
  readonly createdAt: string
  readonly updatedAt: string
}

/** 默认帧率（预览/导出对齐用）。 */
export const DEFAULT_FRAME_RATE = 30
/** 一次时间轴最多多少 clip（挡住畸形载荷）。 */
export const MAX_TIMELINE_CLIPS = 400
/** 单个 clip 最长 30 分钟。 */
export const MAX_CLIP_DURATION_MS = 30 * 60 * 1000
/** 单条字幕文本上限。 */
export const MAX_SUBTITLE_LENGTH = 2000
/** 素材引用路径上限（超过这个长度基本就是把字节塞进来了）。 */
const MAX_ASSET_PATH_LENGTH = 1024

const TRACK_KINDS: readonly TrackKind[] = ['video', 'audio', 'subtitle']

/** 判断一个引用是不是"内联字节"（data URL / base64 大块）。 */
export function looksInlinedBytes(value: string): boolean {
  if (value.startsWith('data:')) return true
  if (value.length > MAX_ASSET_PATH_LENGTH) return true
  // 长 base64 片段（>=512 连续 base64 字符）按内联字节处理
  return /[A-Za-z0-9+/]{512,}={0,2}/.test(value)
}

function numberField(value: unknown, what: string, options: { min: number; max: number }): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${what} must be a finite number`)
  if (value < options.min || value > options.max) {
    throw new Error(`${what} must be between ${options.min} and ${options.max}`)
  }
  return Math.round(value)
}

/**
 * 校验并归一化轨道。
 * @param raw - 待校验的轨道数组。
 * @returns 归一化后的轨道。
 * @throws {Error} 结构不合法、含内联字节、或超出规模上限时。
 */
export function normalizeTimelineTracks(raw: unknown): TimelineTrack[] {
  if (!Array.isArray(raw)) throw new Error('timeline tracks must be an array')
  const seenClipIds = new Set<string>()
  let clipCount = 0
  const tracks = raw.map((candidate, trackIndex) => {
    if (typeof candidate !== 'object' || candidate === null) throw new Error('timeline track must be an object')
    const track = candidate as Record<string, unknown>
    const kind = track.kind
    if (typeof kind !== 'string' || !TRACK_KINDS.includes(kind as TrackKind)) {
      throw new Error(`track ${trackIndex} kind must be one of video/audio/subtitle`)
    }
    const clips = track.clips
    if (!Array.isArray(clips)) throw new Error(`track ${trackIndex} clips must be an array`)
    const normalized = clips.map((rawClip, clipIndex) => {
      if (typeof rawClip !== 'object' || rawClip === null) throw new Error('timeline clip must be an object')
      const clip = rawClip as Record<string, unknown>
      const id = typeof clip.id === 'string' && clip.id !== '' ? clip.id : undefined
      if (id === undefined) throw new Error(`track ${trackIndex} clip ${clipIndex} needs a non-empty id`)
      if (seenClipIds.has(id)) throw new Error(`duplicate timeline clip id: ${id}`)
      seenClipIds.add(id)
      clipCount += 1
      if (clipCount > MAX_TIMELINE_CLIPS) throw new Error(`timeline has more than ${MAX_TIMELINE_CLIPS} clips`)

      const startMs = numberField(clip.startMs, `clip ${id} startMs`, { min: 0, max: MAX_CLIP_DURATION_MS })
      const durationMs = numberField(clip.durationMs, `clip ${id} durationMs`, { min: 1, max: MAX_CLIP_DURATION_MS })
      const inMs = clip.inMs === undefined
        ? undefined
        : numberField(clip.inMs, `clip ${id} inMs`, { min: 0, max: MAX_CLIP_DURATION_MS })

      if (kind === 'subtitle') {
        const text = typeof clip.text === 'string' ? clip.text : ''
        if (text.trim() === '') throw new Error(`subtitle clip ${id} needs text`)
        if (text.length > MAX_SUBTITLE_LENGTH) throw new Error(`subtitle clip ${id} text is too long`)
        return { id, text, startMs, durationMs, ...inMs === undefined ? {} : { inMs } }
      }

      const assetPath = typeof clip.assetPath === 'string' ? clip.assetPath : ''
      if (assetPath.trim() === '') throw new Error(`${kind} clip ${id} needs an assetPath`)
      if (looksInlinedBytes(assetPath)) {
        throw new Error(`${kind} clip ${id} must reference a file path, not inlined bytes (R-TML-1)`)
      }
      return { id, assetPath, startMs, durationMs, ...inMs === undefined ? {} : { inMs } }
    })
    return {
      id: typeof track.id === 'string' && track.id !== '' ? track.id : `track-${trackIndex + 1}`,
      kind: kind as TrackKind,
      clips: normalized,
      ...track.muted === true ? { muted: true } : {},
    }
  })
  return tracks
}

/** 时间轴总时长 = 所有 clip 结束点的最大值（预览与导出口径一致，`R-TML-3`）。 */
export function timelineDurationMs(tracks: readonly TimelineTrack[]): number {
  return tracks.reduce(
    (longest, track) => track.clips.reduce(
      (trackLongest, clip) => Math.max(trackLongest, clip.startMs + clip.durationMs),
      longest,
    ),
    0,
  )
}
