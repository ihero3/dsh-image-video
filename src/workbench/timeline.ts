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
  /** 轨道音量倍数（0–2；1 = 原音量，0 = 静音）。导出时按 `volume=` 应用。 */
  readonly volume?: number
}

/** 轨道音量上限（`R-TML-4`：允许增益到 2 倍，超了就是削波，交给用户自己负责）。 */
export const MAX_TRACK_VOLUME = 2

/** 时间轴文档。 */
export interface TimelineRecord {
  readonly schemaVersion: 1
  readonly id: string
  readonly projectId: string
  readonly name: string
  readonly frameRate: number
  readonly tracks: readonly TimelineTrack[]
  /** 导出时是否把字幕烧进画面（`T5-3`）：关掉时字幕数据仍保留，只是不烧录。 */
  readonly burnSubtitles: boolean
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
        const style = normalizeSubtitleStyle(clip.style, id)
        return {
          id, text, startMs, durationMs,
          ...inMs === undefined ? {} : { inMs },
          ...Object.keys(style).length === 0 ? {} : { style },
        }
      }

      const assetPath = typeof clip.assetPath === 'string' ? clip.assetPath : ''
      if (assetPath.trim() === '') throw new Error(`${kind} clip ${id} needs an assetPath`)
      if (looksInlinedBytes(assetPath)) {
        throw new Error(`${kind} clip ${id} must reference a file path, not inlined bytes (R-TML-1)`)
      }
      return { id, assetPath, startMs, durationMs, ...inMs === undefined ? {} : { inMs } }
    })
    // 音量：缺省不写（= 1）；给非法值一律拒，不做静默截断
    let volume: number | undefined
    if (track.volume !== undefined) {
      if (typeof track.volume !== 'number' || !Number.isFinite(track.volume)) {
        throw new Error(`track ${trackIndex} volume must be a finite number`)
      }
      if (track.volume < 0 || track.volume > MAX_TRACK_VOLUME) {
        throw new Error(`track ${trackIndex} volume must be between 0 and ${MAX_TRACK_VOLUME}`)
      }
      volume = Math.round(track.volume * 100) / 100
    }
    return {
      id: typeof track.id === 'string' && track.id !== '' ? track.id : `track-${trackIndex + 1}`,
      kind: kind as TrackKind,
      clips: normalized,
      ...track.muted === true ? { muted: true } : {},
      ...volume === undefined ? {} : { volume },
    }
  })
  return tracks
}

/** 字幕样式允许的取值范围（越界即拒绝，避免风格面板把畸值写进文档）。 */
export const SUBTITLE_FONT_SIZE_RANGE = { min: 8, max: 200 } as const
const SUBTITLE_POSITIONS: readonly NonNullable<SubtitleStyle['position']>[] = ['top', 'middle', 'bottom']

/**
 * 校验并归一化字幕样式。
 * @param raw - 待校验的样式对象。
 * @param clipId - 出错时用于定位的 clip id。
 * @returns 归一化样式，未给字段时返回空对象。
 * @throws {Error} 取值越界或类型不对时。
 */
export function normalizeSubtitleStyle(raw: unknown, clipId: string): SubtitleStyle {
  if (raw === undefined || raw === null) return {}
  if (typeof raw !== 'object') throw new Error(`subtitle clip ${clipId} style must be an object`)
  const style = raw as Record<string, unknown>
  const normalized: { fontSize?: number; color?: string; position?: SubtitleStyle['position'] } = {}
  if (style.fontSize !== undefined) {
    if (typeof style.fontSize !== 'number' || !Number.isFinite(style.fontSize)) {
      throw new Error(`subtitle clip ${clipId} fontSize must be a number`)
    }
    if (style.fontSize < SUBTITLE_FONT_SIZE_RANGE.min || style.fontSize > SUBTITLE_FONT_SIZE_RANGE.max) {
      throw new Error(`subtitle clip ${clipId} fontSize must be between ${SUBTITLE_FONT_SIZE_RANGE.min} and ${SUBTITLE_FONT_SIZE_RANGE.max}`)
    }
    normalized.fontSize = Math.round(style.fontSize)
  }
  if (style.color !== undefined) {
    if (typeof style.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(style.color)) {
      throw new Error(`subtitle clip ${clipId} color must be a #rrggbb value`)
    }
    normalized.color = style.color
  }
  if (style.position !== undefined) {
    if (typeof style.position !== 'string' || !SUBTITLE_POSITIONS.includes(style.position as NonNullable<SubtitleStyle['position']>)) {
      throw new Error(`subtitle clip ${clipId} position must be one of top/middle/bottom`)
    }
    normalized.position = style.position as SubtitleStyle['position']
  }
  return normalized
}

/**
 * 取某个时间点上某类轨道的活动 clip。
 *
 * **预览与导出共用这一份边界判断**（`R-TML-3`）：预览显示哪一段、导出从哪一段切，
 * 都来自这里，所以"预览切换点"与"导出切换点"不会各算一套。
 * @param tracks - 轨道。
 * @param kind - 轨道种类。
 * @param timeMs - 播放头位置（毫秒）。
 * @returns 该时刻的活动 clip，没有则 `undefined`。
 */
export function activeClipAt(
  tracks: readonly TimelineTrack[],
  kind: TrackKind,
  timeMs: number,
): TimelineClip | undefined {
  return tracks
    .filter(track => track.kind === kind)
    .flatMap(track => track.clips)
    .find(clip => timeMs >= clip.startMs && timeMs < clip.startMs + clip.durationMs)
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
