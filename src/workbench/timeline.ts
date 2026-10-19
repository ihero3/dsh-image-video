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

/** 画面裁剪（像素，相对源；宽高必须是偶数且 ≥2）。 */
export interface ClipCrop {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 跨段转场类型（对应 ffmpeg `xfade` 的 transition 名；`A13b`）。 */
export type ClipTransition = 'fade' | 'wipeleft' | 'circleopen'
/** 允许的转场类型（白名单）。 */
export const CLIP_TRANSITIONS: readonly ClipTransition[] = ['fade', 'wipeleft', 'circleopen']
/** 转场时长上限（毫秒）。 */
export const MAX_CLIP_TRANSITION_MS = 2000
/** 转场时长缺省值（毫秒）。 */
export const DEFAULT_CLIP_TRANSITION_MS = 400

/** 变速的允许范围。 */
export const CLIP_SPEED_RANGE = { min: 0.25, max: 4 } as const
/** 淡入淡出时长上限（毫秒）。 */
export const MAX_CLIP_FADE_MS = 2000
/** 音频轨淡入淡出时长上限（毫秒，`A20`）。 */
export const MAX_TRACK_FADE_MS = 5000
/** 音频轨交叉淡化时长上限（毫秒，`A30`）。 */
export const MAX_TRACK_CROSSFADE_MS = 3000
/** 语言标记的合法长度范围（`A42`）。 */
export const TRACK_LANGUAGE_RANGE = { min: 1, max: 16 } as const
/** 侧链压低范围（分贝，`A33`）。 */
export const DUCKING_DB_RANGE = { min: -30, max: 0 } as const
/** 侧链压低缺省值（分贝，`A33`）。 */
export const DEFAULT_DUCKING_DB = -12

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
  /**
   * 播放速度（0.25–4，缺省 1）：`2` = 两倍速，时间轴上占用的时长减半。
   * 所有占位计算（时长/播放头/导出排布）都按**折算后**时长算，见 {@link effectiveDurationMs}。
   */
  readonly speed?: number
  /** 淡入淡出时长（毫秒，0–2000；缺省无效果）。导出用 ffmpeg `fade` 实现（`A13`）。 */
  readonly fade?: number
  /** 画面裁剪（像素，相对源；导出时在缩放前应用）。 */
  readonly crop?: ClipCrop
  /**
   * 与**上一个片段**之间的转场（`A13b`）。用 ffmpeg `xfade` 实现：两段在成片里重叠
   * `transitionDurationMs`，因此时间轴总时长要把重叠扣掉（见 {@link timelineDurationMs}）。
   * 与空白（填充黑场）相邻时转场不生效。
   */
  readonly transition?: ClipTransition
  /** 转场时长（毫秒，0–2000；缺省 400）。 */
  readonly transitionDurationMs?: number
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
  /**
   * 语言标记（`A42`，主要给字幕轨用，如 `zh` / `en`）：配合 `timeline.burnLanguage`
   * 决定烧哪一条字幕轨，避免多语言字幕叠在一起。
   */
  readonly language?: string
  /** 音频轨淡入淡出时长（毫秒，0–5000；缺省无效果）。导出用 `afade` 实现（`A20`）。 */
  readonly fadeMs?: number
  /**
   * 相邻音频片段之间的**交叉淡化**时长（毫秒，0–3000；缺省 0 = 直接拼接）。
   * 导出用 `acrossfade` 实现（`A30`）：两段重叠该时长，因此音轨总长会相应变短。
   * 只对**首尾相接**的片段生效；中间有空档时回落到普通拼接。
   */
  readonly crossfadeMs?: number
  /**
   * 侧链压缩（`A33`）：本轨是"被压"的背景音乐，`duckUnderTrackId` 指向触发它的音轨
   * （通常是旁白轨），旁白一响就把本轨压低 `duckingDb` 分贝。缺省不启用。
   */
  readonly duckUnderTrackId?: string
  /** 侧链压低的分贝数（-30..0，缺省 -12；仅在 `duckUnderTrackId` 存在时生效）。 */
  readonly duckingDb?: number
}

/**
 * 片段在时间轴上**实际占用**的时长（变速折算后）。
 * @param clip - 片段。
 * @returns 毫秒（至少 1）。
 */
export function effectiveDurationMs(clip: TimelineClip): number {
  const speed = clip.speed ?? 1
  return Math.max(1, Math.round(clip.durationMs / speed))
}

/** 轨道音量上限（`R-TML-4`：允许增益到 2 倍，超了就是削波，交给用户自己负责）。 */
export const MAX_TRACK_VOLUME = 2

/** 时间轴文档。 */
/** 导出规格（`R-TML-5` / 总任务书 §7.3）：分辨率、帧率、码率。 */
export interface TimelineExportFormat {
  readonly width: number
  readonly height: number
  readonly frameRate: number
  /** 视频码率（kbps，可选；缺省由编码器 CRF 决定）。 */
  readonly bitrateKbps?: number
}

/** 默认导出规格：720p30（与 V1 的固定行为一致）。 */
export const DEFAULT_EXPORT_FORMAT: TimelineExportFormat = { width: 1280, height: 720, frameRate: 30 }
/** 允许的帧率档位。 */
export const EXPORT_FRAME_RATES: readonly number[] = [24, 25, 30, 60]
/** 分辨率范围（偶数、2 的倍数；下限 128，上限 4096）。 */
export const EXPORT_DIMENSION_RANGE = { min: 128, max: 4096 } as const
/** 码率范围（kbps）。 */
export const EXPORT_BITRATE_RANGE = { min: 500, max: 50_000 } as const

/**
 * 校验并归一化导出规格。
 * @param raw - 原始取值；缺省即默认 720p30。
 * @returns 归一化规格。
 * @throws {Error} 尺寸/帧率/码率越界时（不静默截断）。
 */
export function normalizeExportFormat(raw: unknown): TimelineExportFormat {
  if (raw === undefined || raw === null) return DEFAULT_EXPORT_FORMAT
  if (typeof raw !== 'object') throw new Error('timeline exportFormat must be an object')
  const value = raw as Record<string, unknown>
  const dimension = (key: 'width' | 'height'): number => {
    const candidate = value[key] ?? DEFAULT_EXPORT_FORMAT[key]
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      throw new Error(`exportFormat ${key} must be a finite number`)
    }
    const rounded = Math.round(candidate)
    if (rounded % 2 !== 0) throw new Error(`exportFormat ${key} must be an even number (got ${rounded})`)
    if (rounded < EXPORT_DIMENSION_RANGE.min || rounded > EXPORT_DIMENSION_RANGE.max) {
      throw new Error(`exportFormat ${key} must be between ${EXPORT_DIMENSION_RANGE.min} and ${EXPORT_DIMENSION_RANGE.max}`)
    }
    return rounded
  }
  const frameRate = value.frameRate ?? DEFAULT_EXPORT_FORMAT.frameRate
  if (typeof frameRate !== 'number' || !EXPORT_FRAME_RATES.includes(Math.round(frameRate))) {
    throw new Error(`exportFormat frameRate must be one of ${EXPORT_FRAME_RATES.join('/')}`)
  }
  let bitrateKbps: number | undefined
  if (value.bitrateKbps !== undefined) {
    const candidate = value.bitrateKbps
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      throw new Error('exportFormat bitrateKbps must be a finite number')
    }
    const rounded = Math.round(candidate)
    if (rounded < EXPORT_BITRATE_RANGE.min || rounded > EXPORT_BITRATE_RANGE.max) {
      throw new Error(`exportFormat bitrateKbps must be between ${EXPORT_BITRATE_RANGE.min} and ${EXPORT_BITRATE_RANGE.max}`)
    }
    bitrateKbps = rounded
  }
  return {
    width: dimension('width'), height: dimension('height'), frameRate: Math.round(frameRate),
    ...bitrateKbps === undefined ? {} : { bitrateKbps },
  }
}

export interface TimelineRecord {
  readonly schemaVersion: 1
  readonly id: string
  readonly projectId: string
  readonly name: string
  readonly frameRate: number
  readonly tracks: readonly TimelineTrack[]
  /** 导出时是否把字幕烧进画面（`T5-3`）：关掉时字幕数据仍保留，只是不烧录。 */
  readonly burnSubtitles: boolean
  /** 导出规格（分辨率/帧率/码率）；缺省 720p30。 */
  readonly exportFormat?: TimelineExportFormat
  /**
   * 只烧哪一条语言的字幕轨（`A42`）：缺省时沿用老行为（烧所有字幕轨）。
   * 设了但没有任何轨道匹配 → 校验器会报 `dangling-burn-language`。
   */
  readonly burnLanguage?: string
  /** 导出时做响度归一化（`loudnorm`，目标 -16 LUFS；`A20`）。缺省关。 */
  readonly normalizeLoudness?: boolean
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

function numberField(
  value: unknown,
  what: string,
  options: { min: number; max: number; integer?: boolean },
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${what} must be a finite number`)
  if (value < options.min || value > options.max) {
    throw new Error(`${what} must be between ${options.min} and ${options.max}`)
  }
  // 毫秒类字段取整；倍数类（如 speed）必须保留小数，否则 1.5 会被悄悄变成 2（`A29` 修的 bug）
  if (options.integer === false) return Math.round(value * 100) / 100
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

      // 变速 / 淡入淡出 / 裁剪（`A13`）：越界一律拒，不做静默截断
      const speed = clip.speed === undefined
        ? undefined
        : numberField(clip.speed, `clip ${id} speed`, { min: CLIP_SPEED_RANGE.min, max: CLIP_SPEED_RANGE.max, integer: false })
      const fade = clip.fade === undefined
        ? undefined
        : numberField(clip.fade, `clip ${id} fade`, { min: 0, max: MAX_CLIP_FADE_MS })
      let crop: ClipCrop | undefined
      if (clip.crop !== undefined) {
        if (typeof clip.crop !== 'object' || clip.crop === null) throw new Error(`clip ${id} crop must be an object`)
        const raw = clip.crop as Record<string, unknown>
        const even = (key: 'width' | 'height'): number => {
          const value = numberField(raw[key], `clip ${id} crop.${key}`, { min: 2, max: MAX_CLIP_DURATION_MS })
          const rounded = Math.round(value)
          if (rounded % 2 !== 0) throw new Error(`clip ${id} crop.${key} must be an even number`)
          return rounded
        }
        crop = {
          x: Math.round(numberField(raw.x, `clip ${id} crop.x`, { min: 0, max: MAX_CLIP_DURATION_MS })),
          y: Math.round(numberField(raw.y, `clip ${id} crop.y`, { min: 0, max: MAX_CLIP_DURATION_MS })),
          width: even('width'),
          height: even('height'),
        }
      }
      let transition: ClipTransition | undefined
      if (clip.transition !== undefined) {
        if (typeof clip.transition !== 'string' || !CLIP_TRANSITIONS.includes(clip.transition as ClipTransition)) {
          throw new Error(`clip ${id} transition must be one of ${CLIP_TRANSITIONS.join('/')}`)
        }
        transition = clip.transition as ClipTransition
      }
      const transitionDurationMs = clip.transitionDurationMs === undefined
        ? undefined
        : Math.round(numberField(clip.transitionDurationMs, `clip ${id} transitionDurationMs`, { min: 0, max: MAX_CLIP_TRANSITION_MS }))

      const extras = {
        ...transition === undefined ? {} : { transition },
        ...transitionDurationMs === undefined ? {} : { transitionDurationMs },
        ...speed === undefined ? {} : { speed },
        ...fade === undefined ? {} : { fade },
        ...crop === undefined ? {} : { crop },
      }

      if (kind === 'subtitle') {
        const text = typeof clip.text === 'string' ? clip.text : ''
        if (text.trim() === '') throw new Error(`subtitle clip ${id} needs text`)
        if (text.length > MAX_SUBTITLE_LENGTH) throw new Error(`subtitle clip ${id} text is too long`)
        const style = normalizeSubtitleStyle(clip.style, id)
        return {
          id, text, startMs, durationMs,
          ...inMs === undefined ? {} : { inMs },
          ...extras,
          ...Object.keys(style).length === 0 ? {} : { style },
        }
      }

      const assetPath = typeof clip.assetPath === 'string' ? clip.assetPath : ''
      if (assetPath.trim() === '') throw new Error(`${kind} clip ${id} needs an assetPath`)
      if (looksInlinedBytes(assetPath)) {
        throw new Error(`${kind} clip ${id} must reference a file path, not inlined bytes (R-TML-1)`)
      }
      return { id, assetPath, startMs, durationMs, ...inMs === undefined ? {} : { inMs }, ...extras }
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
    let fadeMs: number | undefined
    if (track.fadeMs !== undefined) {
      fadeMs = Math.round(numberField(track.fadeMs, `track ${trackIndex} fadeMs`, { min: 0, max: MAX_TRACK_FADE_MS }))
    }
    let crossfadeMs: number | undefined
    if (track.crossfadeMs !== undefined) {
      crossfadeMs = Math.round(numberField(track.crossfadeMs, `track ${trackIndex} crossfadeMs`, { min: 0, max: MAX_TRACK_CROSSFADE_MS }))
    }
    let language: string | undefined
    if (track.language !== undefined) {
      if (typeof track.language !== 'string' || track.language.trim() === '') {
        throw new Error(`track ${trackIndex} language must be a non-empty string`)
      }
      const trimmed = track.language.trim()
      if (trimmed.length > TRACK_LANGUAGE_RANGE.max) throw new Error(`track ${trackIndex} language is too long`)
      language = trimmed
    }

    let duckUnderTrackId: string | undefined
    if (track.duckUnderTrackId !== undefined) {
      if (typeof track.duckUnderTrackId !== 'string' || track.duckUnderTrackId === '') {
        throw new Error(`track ${trackIndex} duckUnderTrackId must be a non-empty track id`)
      }
      duckUnderTrackId = track.duckUnderTrackId
    }
    let duckingDb: number | undefined
    if (track.duckingDb !== undefined) {
      duckingDb = numberField(track.duckingDb, `track ${trackIndex} duckingDb`, { min: DUCKING_DB_RANGE.min, max: DUCKING_DB_RANGE.max, integer: false })
    }
    return {
      id: typeof track.id === 'string' && track.id !== '' ? track.id : `track-${trackIndex + 1}`,
      kind: kind as TrackKind,
      clips: normalized,
      ...track.muted === true ? { muted: true } : {},
      ...volume === undefined ? {} : { volume },
      ...fadeMs === undefined ? {} : { fadeMs },
      ...crossfadeMs === undefined ? {} : { crossfadeMs },
      ...language === undefined ? {} : { language },
      ...duckUnderTrackId === undefined ? {} : { duckUnderTrackId },
      ...duckingDb === undefined ? {} : { duckingDb },
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
    .find(clip => timeMs >= clip.startMs && timeMs < clip.startMs + effectiveDurationMs(clip))
}

/** 时间轴总时长 = 所有 clip 结束点的最大值（预览与导出口径一致，`R-TML-3`）。 */
export function timelineDurationMs(tracks: readonly TimelineTrack[]): number {
  return tracks.reduce(
    (longest, track) => {
      const ordered = [...track.clips].sort((left, right) => left.startMs - right.startMs)
      let end = 0
      for (let index = 0; index < ordered.length; index += 1) {
        const clip = ordered[index]!
        const start = clip.startMs
        const clipEnd = start + effectiveDurationMs(clip)
        // 转场让两段重叠：仅当两段首尾相接（无空档）且都在视频轨上时才扣
        const previous = ordered[index - 1]
        // 重叠只在视频轨、且两段首尾相接（无空档）时生效——复用 transitionOverlapMs 单一实现
        const adjacent = previous !== undefined && start <= previous.startMs + effectiveDurationMs(previous) + 1
        const overlap = track.kind === 'video' && adjacent ? transitionOverlapMs(clip, previous) : 0
        end = Math.max(end, clipEnd - overlap)
      }
      return Math.max(longest, end)
    },
    0,
  )
}

/**
 * 片段与其**上一个片段**之间实际生效的转场时长（毫秒）。
 * @param clip - 当前片段。
 * @param previous - 上一个片段（没有则不生效）。
 * @returns 0 表示不转场。
 */
export function transitionOverlapMs(clip: TimelineClip, previous: TimelineClip | undefined): number {
  if (previous === undefined || clip.transition === undefined) return 0
  return Math.min(
    transitionDurationMs(clip),
    Math.floor(Math.min(effectiveDurationMs(clip), effectiveDurationMs(previous)) / 2),
  )
}

/**
 * 转场时长（缺省 400ms，按 0–2000 夹取）。
 * @param clip - 片段。
 * @returns 毫秒。
 */
export function transitionDurationMs(clip: TimelineClip): number {
  const value = clip.transitionDurationMs ?? DEFAULT_CLIP_TRANSITION_MS
  return Math.max(0, Math.min(MAX_CLIP_TRANSITION_MS, Math.round(value)))
}
