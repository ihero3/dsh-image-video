/**
 * `RenderService`（`T5-5`）：时间轴快照 → ffmpeg filter graph → 进度/取消/输出校验。
 *
 * 三条设计取舍：
 * - **快照冻结**：渲染一开始就把时间轴深拷贝成快照，之后用户继续编辑**不会**影响
 *   进行中的这次渲染（`R-TML-5`）。
 * - **进度靠 `-progress pipe:1`**：按 `out_time_ms` 报百分比，不猜、不假装。
 * - **失败要能照着修**：素材丢失 / 磁盘满 / 编码器不支持 / ffmpeg 缺失都给机器码 +
 *   一句话下一步（`R-TML-5`/`R-TML-6`）。
 */
import { spawn } from 'node:child_process'
import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { FFMPEG_PATH_ENV, probeFfmpeg, type FfmpegProbe } from './ffmpeg.ts'
import { estimateMaxCharsForWidth, wrapSubtitleLines } from '../workbench/subtitles.ts'
import type { TimelineRecord, TimelineTrack } from '../workbench/timeline.ts'
import {
  DEFAULT_EXPORT_FORMAT, MAX_TRACK_VOLUME, effectiveDurationMs, normalizeExportFormat, timelineDurationMs,
  transitionDurationMs, type TimelineExportFormat,
} from '../workbench/timeline.ts'

/** 渲染用的时间轴快照（冻结后与原文档再无关系）。 */
export interface TimelineSnapshot {
  readonly id: string
  readonly frameRate: number
  readonly burnSubtitles: boolean
  /** 导出规格（冻结后不受后续编辑影响）。 */
  readonly exportFormat: TimelineExportFormat
  /** 是否做响度归一化（`A20`）。 */
  readonly normalizeLoudness: boolean
  readonly durationMs: number
  readonly tracks: readonly TimelineTrack[]
}

/** 一段画面：要么是素材 clip，要么是补的黑场。 */
export type VideoSegment =
  | {
      readonly kind: 'clip'
      readonly clipId: string
      readonly assetPath: string
      readonly inMs: number
      readonly durationMs: number
      /** 变速倍数（缺省 1）。 */
      readonly speed?: number
      /** 淡入淡出时长（毫秒）。 */
      readonly fade?: number
      /** 画面裁剪（像素，相对源）。 */
      readonly crop?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
      /** 与上一个片段的转场（`A13b`）：类型 + 生效时长（毫秒）。 */
      readonly transition?: string
      readonly transitionMs?: number
    }
  | { readonly kind: 'filler'; readonly durationMs: number }

/** 一次渲染的进度。 */
export interface RenderProgress {
  readonly percent: number
  readonly outTimeMs: number
}

/** 渲染结果。 */
export interface RenderResult {
  readonly outputPath: string
  readonly bytes: number
  readonly durationMs: number
}

/** 渲染失败的机器码。 */
export type RenderErrorCode =
  | 'MEDIA_FFMPEG_UNAVAILABLE'
  | 'MEDIA_FFMPEG_ENCODER_MISSING'
  | 'MEDIA_ASSET_MISSING'
  | 'MEDIA_TIMELINE_OVERLAP'
  | 'MEDIA_TIMELINE_EMPTY'
  | 'MEDIA_DISK_FULL'
  | 'MEDIA_ENCODER_UNSUPPORTED'
  | 'MEDIA_RENDER_FAILED'
  | 'MEDIA_RENDER_CANCELLED'
  | 'MEDIA_OUTPUT_INVALID'

/** 带机器码与可操作文案的渲染错误。 */
export class RenderError extends Error {
  readonly code: RenderErrorCode

  constructor(code: RenderErrorCode, message: string) {
    super(message)
    this.name = 'RenderError'
    this.code = code
  }
}

/** 画布尺寸（一期固定 720p，避免不同尺寸素材拼不上）。 */
export const RENDER_WIDTH = 1280
export const RENDER_HEIGHT = 720
/** 时长容差：导出时长与时间轴时长允许差 ±1 帧。 */
export function frameToleranceMs(frameRate: number): number {
  return 1000 / Math.max(1, frameRate)
}

/** 深拷贝成快照：之后改原文档不影响本次渲染。 */
export function freezeTimeline(timeline: TimelineRecord): TimelineSnapshot {
  const tracks = timeline.tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => ({
      ...clip,
      ...clip.style === undefined ? {} : { style: { ...clip.style } },
    })),
  }))
  // 总时长必须走 timelineDurationMs（它按变速折算）——早先这里另算一遍原始 durationMs，
  // 导致 2 倍速片段后面被补了 0.5s 黑场，成片长度与时间轴不一致（`A13` 抓到的真 bug）。
  const durationMs = timelineDurationMs(tracks)
  return {
    id: timeline.id, frameRate: timeline.frameRate, burnSubtitles: timeline.burnSubtitles,
    exportFormat: normalizeExportFormat(timeline.exportFormat), normalizeLoudness: timeline.normalizeLoudness === true, durationMs, tracks,
  }
}

/**
 * 把视频轨排成"片段 + 黑场填充"的序列。
 * @param snapshot - 冻结快照。
 * @returns 顺序片段；同一轨道内重叠会抛 `MEDIA_TIMELINE_OVERLAP`。
 */
export function planVideoSegments(snapshot: TimelineSnapshot): VideoSegment[] {
  const track = snapshot.tracks.find(candidate => candidate.kind === 'video')
  if (track === undefined || track.clips.length === 0) {
    throw new RenderError('MEDIA_TIMELINE_EMPTY', '时间轴的视频轨还是空的：先从素材面板往视频轨加入片段再导出。')
  }
  const ordered = [...track.clips].sort((left, right) => left.startMs - right.startMs)
  const segments: VideoSegment[] = []
  let cursor = 0
  for (const clip of ordered) {
    if (clip.startMs < cursor) {
      throw new RenderError('MEDIA_TIMELINE_OVERLAP', `视频轨上片段 ${clip.id} 与前一片段重叠（${clip.startMs}ms < ${cursor}ms）：请把起点错开或缩短前一片段。`)
    }
    if (clip.startMs > cursor) segments.push({ kind: 'filler', durationMs: clip.startMs - cursor })
    const assetPath = clip.assetPath
    if (assetPath === undefined) {
      throw new RenderError('MEDIA_ASSET_MISSING', `片段 ${clip.id} 没有素材路径：重新从素材面板选一次。`)
    }
    segments.push({
      kind: 'clip', clipId: clip.id, assetPath, inMs: clip.inMs ?? 0, durationMs: clip.durationMs,
      ...clip.speed === undefined ? {} : { speed: clip.speed },
      ...clip.fade === undefined ? {} : { fade: clip.fade },
      ...clip.crop === undefined ? {} : { crop: clip.crop },
      ...clip.transition === undefined ? {} : { transition: clip.transition, transitionMs: transitionDurationMs(clip) },
    })
    // 时间轴占位按**变速折算后**的时长算（与 timelineDurationMs 保持一致）
    cursor = clip.startMs + effectiveDurationMs(clip)
  }
  // 视频轨比字幕轨短时，尾部补黑让总时长与快照一致
  if (snapshot.durationMs > cursor) segments.push({ kind: 'filler', durationMs: snapshot.durationMs - cursor })
  return segments
}

/** 转义 drawtext 的文本与字体路径。 */
function escapeDrawtext(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/%/g, '\\%')
}

/** 字幕烧录用的字体（macOS 常见中文字体，找不到就退回 ffmpeg 内置）。 */
export const SUBTITLE_FONT_CANDIDATES: readonly string[] = [
  '/System/Library/Fonts/PingFang.ttc',
  '/System/Library/Fonts/STHeiti Light.ttc',
  '/Library/Fonts/Arial Unicode.ttf',
]

/**
 * 拼出渲染用的 ffmpeg 参数（纯函数，便于断言）。
 * @param snapshot - 冻结快照。
 * @param options - 输出路径、字体、画布尺寸。
 * @returns `ffmpeg` 参数数组（不含可执行文件本身）。
 */
export function buildRenderArgs(snapshot: TimelineSnapshot, options: {
  outputPath: string
  fontFile?: string
  width?: number
  height?: number
  frameRate?: number
  format?: TimelineExportFormat
}): string[] {
  const segments = planVideoSegments(snapshot)
  const format = options.format ?? snapshot.exportFormat ?? DEFAULT_EXPORT_FORMAT
  const width = options.width ?? format.width ?? RENDER_WIDTH
  const height = options.height ?? format.height ?? RENDER_HEIGHT
  const fps = options.frameRate ?? format.frameRate ?? snapshot.frameRate
  const bitrateKbps = format.bitrateKbps
  const args: string[] = ['-y', '-hide_banner', '-nostdin', '-loglevel', 'error', '-progress', 'pipe:1']

  const audioTracks = planAudioTracks(snapshot)
  segments.forEach(segment => {
    if (segment.kind === 'filler') {
      args.push('-f', 'lavfi', '-t', (segment.durationMs / 1000).toFixed(3),
        '-i', `color=c=black:s=${width}x${height}:r=${fps}`)
      return
    }
    if (segment.inMs > 0) args.push('-ss', (segment.inMs / 1000).toFixed(3))
    args.push('-t', (segment.durationMs / 1000).toFixed(3), '-i', segment.assetPath)
  })
  // 音轨的输入排在画面输入之后：下面按 videoSegments.length + 偏移 计算输入下标
  audioTracks.forEach(track => {
    track.segments.forEach(segment => {
      if (segment.kind === 'filler') {
        args.push('-f', 'lavfi', '-t', (segment.durationMs / 1000).toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo')
        return
      }
      if (segment.inMs > 0) args.push('-ss', (segment.inMs / 1000).toFixed(3))
      args.push('-t', (segment.durationMs / 1000).toFixed(3), '-i', segment.assetPath)
    })
  })

  const chains: string[] = []
  const labels: string[] = []
  segments.forEach((segment, index) => {
    // 每个片段：裁剪 → 变速(setpts) → 淡入淡出 → 帧率 → 缩放补边（`A13`）
    const pre: string[] = []
    if (segment.kind === 'clip') {
      if (segment.crop !== undefined) {
        pre.push(`crop=${segment.crop.width}:${segment.crop.height}:${segment.crop.x}:${segment.crop.y}`)
      }
      if (segment.speed !== undefined && segment.speed !== 1) {
        pre.push(`setpts=${(1 / segment.speed).toFixed(4)}*PTS`)
      }
      if (segment.fade !== undefined && segment.fade > 0) {
        const effective = Math.max(1, Math.round(segment.durationMs / (segment.speed ?? 1)))
        const fadeMs = Math.min(segment.fade, Math.floor(effective / 2))
        if (fadeMs > 0) {
          const seconds = (fadeMs / 1000).toFixed(3)
          const outStart = ((effective - fadeMs) / 1000).toFixed(3)
          pre.push(`fade=t=in:st=0:d=${seconds}`, `fade=t=out:st=${outStart}:d=${seconds}`)
        }
      }
    }
    const prefix = pre.length === 0 ? '' : `${pre.join(',')},`
    chains.push(
      `[${index}:v]${prefix}scale=${width}:${height}:force_original_aspect_ratio=decrease,`
      + `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${index}]`,
    )
    labels.push(`[v${index}]`)
  })
  /**
   * 视频拼接（`A13b`）：段间有转场时改用 `xfade` 链（两段重叠 transitionMs），
   * 没有转场时沿用 `concat`（行为与之前完全一致，零回归）。
   */
  const segmentMs = (segment: (typeof segments)[number]): number => segment.kind === 'filler'
    ? segment.durationMs
    : Math.max(1, Math.round(segment.durationMs / (segment.speed ?? 1)))
  const overlaps = segments.map((segment, index) => {
    if (index === 0 || segment.kind !== 'clip') return 0
    const previous = segments[index - 1]
    if (previous === undefined || previous.kind !== 'clip') return 0
    return Math.min(segment.transitionMs ?? 0, Math.floor(Math.min(segmentMs(segment), segmentMs(previous)) / 2))
  })
  const hasTransition = overlaps.some(ms => ms > 0)
  if (!hasTransition) {
    const concat = `${labels.join('')}concat=n=${segments.length}:v=1:a=0`
    chains.push(`${concat}[vcat]`)
  } else {
    let accumulator = labels[0]!
    let accumulatorMs = segmentMs(segments[0]!)
    for (let index = 1; index < segments.length; index += 1) {
      const segment = segments[index]!
      const overlapMs = overlaps[index] ?? 0
      const output = `x${index}`
      if (overlapMs > 0) {
        const transition = segment.kind === 'clip' ? segment.transition ?? 'fade' : 'fade'
        const offset = Math.max(0, (accumulatorMs - overlapMs) / 1000).toFixed(3)
        chains.push(
          `${accumulator}[v${index}]xfade=transition=${transition}:duration=${(overlapMs / 1000).toFixed(3)}:offset=${offset}[${output}]`,
        )
        accumulatorMs = accumulatorMs + segmentMs(segment) - overlapMs
      } else {
        chains.push(`${accumulator}[v${index}]concat=n=2:v=1:a=0[${output}]`)
        accumulatorMs += segmentMs(segment)
      }
      accumulator = `[${output}]`
    }
    chains.push(`${accumulator}null[vcat]`)
  }

  // 字幕：只烧 subtitle 轨，按各自起止时间 show/hide；关掉烧录就整段不生成
  const drawFilters: string[] = []
  if (snapshot.burnSubtitles) {
    for (const clip of snapshot.tracks.find(track => track.kind === 'subtitle')?.clips ?? []) {
      const fontSize = clip.style?.fontSize ?? 32
      const color = (clip.style?.color ?? '#ffffff').replace('#', '0x')
      const y = clip.style?.position === 'top'
        ? 'h*0.08'
        : clip.style?.position === 'middle' ? '(h-text_h)/2' : 'h*0.85'
      const fontPart = options.fontFile === undefined ? '' : `fontfile='${escapeDrawtext(options.fontFile)}':`
      // 多行排版（`A25`）：按画面宽度折行；`\n` 用占位符穿过转义，最后还原成 drawtext 的换行
      const maxChars = estimateMaxCharsForWidth(width, fontSize)
      const wrapped = wrapSubtitleLines(clip.text ?? '', maxChars).replace(/\n/g, '\u0001')
      const escaped = escapeDrawtext(wrapped).split('\u0001').join('\\n')
      drawFilters.push(
        `drawtext=${fontPart}text='${escaped}':fontsize=${fontSize}:fontcolor=${color}:line_spacing=${Math.round(fontSize * 0.28)}:`
        + `x=(w-text_w)/2:y=${y}:enable='between(t,${(clip.startMs / 1000).toFixed(3)},${((clip.startMs + clip.durationMs) / 1000).toFixed(3)})'`,
      )
    }
  }
  if (drawFilters.length === 0) {
    chains.push(`[vcat]null[vout]`)
  } else {
    chains.push(`[vcat]${drawFilters.join(',')}[vout]`)
  }

  // 音轨：每段先 aresample+volume，轨内 concat，轨间再 amix（>1 轨时）
  const audioLabels: string[] = []
  let audioInput = segments.length
  audioTracks.forEach((track, trackIndex) => {
    const labels: string[] = []
    track.segments.forEach((_segment, segmentIndex) => {
      const label = `a${trackIndex}_${segmentIndex}`
      chains.push(
        `[${audioInput}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${track.volume.toFixed(2)}[${label}]`,
      )
      labels.push(`[${label}]`)
      audioInput += 1
    })
    const out = `at${trackIndex}`
    // `A30`：全部首尾相接且设了 crossfadeMs → 用 acrossfade 交叉淡化；否则普通拼接
    const allClips = track.segments.every(segment => segment.kind === 'clip')
    if (track.crossfadeMs > 0 && allClips && labels.length > 1) {
      const fade = (track.crossfadeMs / 1000).toFixed(3)
      let accumulator = labels[0]!
      for (let index = 1; index < labels.length; index += 1) {
        const next = `ac${trackIndex}_${index}`
        chains.push(`${accumulator}${labels[index]}acrossfade=d=${fade}:c1=tri:c2=tri[${next}]`)
        accumulator = `[${next}]`
      }
      chains.push(`${accumulator}anull[${out}]`)
    } else {
      chains.push(`${labels.join('')}concat=n=${labels.length}:v=0:a=1[${out}]`)
    }
    // 淡入淡出（`A20`）：轨内总长 = 快照时长（间隙已补静音），所以淡出从末尾往前推
    if (track.fadeMs > 0) {
      const fadeSeconds = (track.fadeMs / 1000).toFixed(3)
      const outStart = Math.max(0, (snapshot.durationMs - track.fadeMs) / 1000).toFixed(3)
      chains.push(`[${out}]afade=t=in:st=0:d=${fadeSeconds},afade=t=out:st=${outStart}:d=${fadeSeconds}[atf${trackIndex}]`)
      audioLabels.push(`[atf${trackIndex}]`)
    } else {
      audioLabels.push(`[${out}]`)
    }
  })
  // 侧链压缩（`A33`）：被压轨 × 触发轨 → sidechaincompress（ratio 由压低分贝数换算）
  audioTracks.forEach((track, trackIndex) => {
    if (track.duckUnderTrackId === undefined) return
    const trigger = audioTracks.findIndex(candidate => candidate.trackId === track.duckUnderTrackId)
    if (trigger < 0) return
    const label = audioLabels[trackIndex]
    const triggerLabel = audioLabels[trigger]
    if (label === undefined || triggerLabel === undefined) return
    const ratio = Math.max(2, Math.min(20, Math.abs(track.duckingDb ?? -12) / 1.5)).toFixed(1)
    const ducked = `duck${trackIndex}`
    // 触发轨的信号要被用两次（侧链输入 + 最终混音）→ 必须先 asplit，否则 ffmpeg 报标签已被消费
    const triggerBranch = `sct${trackIndex}`
    chains.push(`${triggerLabel}asplit=2[${triggerBranch}a][${triggerBranch}b]`)
    chains.push(`${label}[${triggerBranch}a]sidechaincompress=threshold=0.02:ratio=${ratio}:attack=10:release=300:makeup=1[${ducked}]`)
    audioLabels[trackIndex] = `[${ducked}]`
    audioLabels[trigger] = `[${triggerBranch}b]`
  })

  if (audioLabels.length === 1) {
    chains.push(`${audioLabels[0]}anull[aout]`)
  } else if (audioLabels.length > 1) {
    chains.push(`${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=longest:normalize=0[aout]`)
  }
  // 响度归一化（`A20`）：单遍 loudnorm，目标 -16 LUFS / 真峰 -1.5 dBTP
  const audioOut = snapshot.normalizeLoudness && audioLabels.length > 0 ? 'aoutn' : 'aout'
  if (audioOut === 'aoutn') {
    chains.push('[aout]loudnorm=I=-16:TP=-1.5:LRA=11[aoutn]')
  }

  args.push('-filter_complex', chains.join(';'))
  args.push('-map', '[vout]')
  if (audioLabels.length === 0) {
    args.push('-an')
  } else {
    args.push('-map', `[${audioOut}]`, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2')
  }
  args.push('-c:v', 'libx264', '-preset', 'veryfast',
    ...bitrateKbps === undefined ? ['-crf', '20'] : ['-b:v', `${bitrateKbps}k`],
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', options.outputPath)
  return args
}

/** 一条要参与混音的音轨（已排除静音/零音量轨）。 */
export interface PlannedAudioTrack {
  readonly trackId: string
  readonly volume: number
  /** 淡入淡出时长（毫秒，`A20`）。 */
  readonly fadeMs: number
  /** 相邻片段交叉淡化时长（毫秒，`A30`；0 = 普通拼接）。 */
  readonly crossfadeMs: number
  /** 侧链压缩（`A33`）：被哪条轨触发，以及压低多少分贝。 */
  readonly duckUnderTrackId?: string
  readonly duckingDb?: number
  readonly segments: readonly VideolessSegment[]
}

/** 音轨片段（结构与画面片段一致，只是来源是音频文件）。 */
export type VideolessSegment =
  | { readonly kind: 'clip'; readonly clipId: string; readonly assetPath: string; readonly inMs: number; readonly durationMs: number }
  | { readonly kind: 'filler'; readonly durationMs: number }

/**
 * 规划参与导出的音轨（`R-TML-4`）：静音轨与 0 音量轨直接不输出；轨内重叠报错；
 * 间隙与尾部补静音，保证与画面等长。
 * @param snapshot - 冻结快照。
 * @returns 需要混音的音轨（可能为空 = 输出无音轨）。
 */
export function planAudioTracks(snapshot: TimelineSnapshot): PlannedAudioTrack[] {
  const tracks: PlannedAudioTrack[] = []
  for (const track of snapshot.tracks.filter(candidate => candidate.kind === 'audio')) {
    if (track.muted === true || (track.volume ?? 1) <= 0) continue
    if (track.clips.length === 0) continue
    const volume = Math.min(MAX_TRACK_VOLUME, Math.max(0, track.volume ?? 1))
    const ordered = [...track.clips].sort((left, right) => left.startMs - right.startMs)
    const segments: VideolessSegment[] = []
    let cursor = 0
    for (const clip of ordered) {
      if (clip.startMs < cursor) {
        throw new RenderError('MEDIA_TIMELINE_OVERLAP', `音轨 ${track.id} 上片段 ${clip.id} 与前一片段重叠：请把起点错开或缩短前一片段。`)
      }
      if (clip.startMs > cursor) segments.push({ kind: 'filler', durationMs: clip.startMs - cursor })
      const assetPath = clip.assetPath
      if (assetPath === undefined) {
        throw new RenderError('MEDIA_ASSET_MISSING', `音轨片段 ${clip.id} 没有素材路径：重新选一次音频素材。`)
      }
      segments.push({ kind: 'clip', clipId: clip.id, assetPath, inMs: clip.inMs ?? 0, durationMs: clip.durationMs })
      cursor = clip.startMs + clip.durationMs
    }
    if (snapshot.durationMs > cursor) segments.push({ kind: 'filler', durationMs: snapshot.durationMs - cursor })
    tracks.push({
      trackId: track.id, volume,
      fadeMs: Math.max(0, Math.min(5000, Math.round(track.fadeMs ?? 0))),
      crossfadeMs: Math.max(0, Math.min(3000, Math.round(track.crossfadeMs ?? 0))),
      ...track.duckUnderTrackId === undefined ? {} : {
        duckUnderTrackId: track.duckUnderTrackId,
        duckingDb: Math.max(-30, Math.min(0, track.duckingDb ?? -12)),
      },
      segments,
    })
  }
  return tracks
}

/** 跑 ffmpeg 并解析 `-progress` 输出。 */
export interface RenderRunner {
  (args: {
    readonly ffmpegPath: string
    readonly args: readonly string[]
    readonly signal?: AbortSignal
    readonly onProgress?: (progress: RenderProgress) => void
    readonly durationMs: number
  }): Promise<void>
}

/** 默认 runner：spawn ffmpeg、解析 out_time_ms、abort 时杀进程。 */
export const defaultRenderRunner: RenderRunner = async ({ ffmpegPath, args, signal, onProgress, durationMs }) => {
  await new Promise<void>((resolve, reject) => {
    // Windows 上 shell spawn 能正确解析 PATH、.exe、以及 fake 脚本里的 .cmd；
    // Unix 上保持直接 spawn（更干净）。对生产 ffmpeg 路径，shell 只是多一层 cmd.exe/sh，无副作用。
    const child = spawn(ffmpegPath, [...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })
    let stderr = ''
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      if (error === undefined) resolve()
      else reject(error)
    }
    const onAbort = (): void => {
      child.kill('SIGKILL')
      finish(new RenderError('MEDIA_RENDER_CANCELLED', '渲染已取消：已停掉 ffmpeg 并清理半成品。'))
    }
    if (signal?.aborted === true) { onAbort(); return }
    signal?.addEventListener('abort', onAbort, { once: true })
    child.stdout?.on('data', chunk => {
      for (const line of String(chunk).split('\n')) {
        const match = /^out_time_ms=(\d+)/.exec(line.trim())
        if (match === null || onProgress === undefined) continue
        const outTimeMs = Number(match[1]) / 1000
        onProgress({ outTimeMs, percent: durationMs <= 0 ? 0 : Math.min(100, Math.round((outTimeMs / durationMs) * 100)) })
      }
    })
    child.stderr?.on('data', chunk => { stderr += String(chunk) })
    child.on('error', error => finish(new RenderError('MEDIA_FFMPEG_UNAVAILABLE', `ffmpeg 无法启动：${error.message}`)))
    child.on('close', code => {
      signal?.removeEventListener('abort', onAbort)
      if (settled) return
      if (code === 0) { finish(); return }
      const text = stderr.trim()
      if (/No space left on device|ENOSPC/i.test(text)) {
        finish(new RenderError('MEDIA_DISK_FULL', '磁盘空间不足：清出空间再导出。'))
        return
      }
      if (/Unknown encoder|not found|Unrecognized option/i.test(text)) {
        finish(new RenderError('MEDIA_ENCODER_UNSUPPORTED', `这份 ffmpeg 缺需要的编码器：${text.slice(0, 200)}`))
        return
      }
      if (/No such file or directory/i.test(text)) {
        finish(new RenderError('MEDIA_ASSET_MISSING', `素材读不到（可能已被移动或删除）：${text.slice(0, 200)}`))
        return
      }
      // Windows shell spawn：找不到可执行文件时 cmd.exe 在 stderr 打印而不是触发 Node 的 error 事件
      if (/not recognized as an internal or external command|The system cannot find the (path|file) specified/i.test(text)) {
        finish(new RenderError('MEDIA_FFMPEG_UNAVAILABLE', `ffmpeg 无法启动：${text.split('\n')[0]}`))
        return
      }
      finish(new RenderError('MEDIA_RENDER_FAILED', `ffmpeg 渲染失败（退出码 ${code}）：${text.slice(0, 300)}`))
    })
  })
}

/** 渲染服务。 */
export class RenderService {
  /** 输出目录统一解析成绝对路径：素材记录里存相对路径会让后续 ffmpeg/预览都找不到文件。 */
  private readonly outputsDir: string

  constructor(private readonly deps: {
    readonly outputsDir: string
    readonly now?: () => Date
    readonly run?: RenderRunner
    /** ffmpeg 探测（测试可注入；默认探测本机）。 */
    readonly probe?: () => Promise<FfmpegProbe>
  }) {
    this.outputsDir = isAbsolute(deps.outputsDir) ? deps.outputsDir : resolve(deps.outputsDir)
  }

  /**
   * 把一个时间轴渲染成 mp4。
   * @param timeline - 当前时间轴文档（内部会先冻结成快照）。
   * @param options - 输出文件名、取消信号、进度回调。
   * @returns 输出路径、字节数与实测时长。
   * @throws {RenderError} 见 {@link RenderErrorCode}。
   */
  async render(timeline: TimelineRecord, options: {
    signal?: AbortSignal
    onProgress?: (progress: RenderProgress) => void
    fileName?: string
  } = {}): Promise<RenderResult> {
    const snapshot = freezeTimeline(timeline)
    const probe = await (this.deps.probe ?? (() => probeFfmpeg()))()
    if (!probe.available) {
      throw new RenderError(
        probe.code === 'MEDIA_FFMPEG_ENCODER_MISSING' ? 'MEDIA_FFMPEG_ENCODER_MISSING' : 'MEDIA_FFMPEG_UNAVAILABLE',
        probe.message ?? `ffmpeg 不可用，无法导出；可设 ${FFMPEG_PATH_ENV} 指向可用副本后重试。`,
      )
    }
    const segments = planVideoSegments(snapshot)
    const missing = await Promise.all(segments
      .filter((segment): segment is Extract<VideoSegment, { kind: 'clip' }> => segment.kind === 'clip')
      .map(async segment => ({ segment, exists: await stat(segment.assetPath).then(() => true).catch(() => false) })))
    const gone = missing.find(entry => !entry.exists)
    if (gone !== undefined) {
      throw new RenderError('MEDIA_ASSET_MISSING', `素材不存在：${gone.segment.assetPath}（片段 ${gone.segment.clipId}）。重新登记素材或换一个片段。`)
    }

    const stamp = this.deps.now?.() ?? new Date()
    const fileName = options.fileName ?? `${stamp.getTime()}-${Math.random().toString(36).slice(2, 8)}.mp4`
    const outputPath = join(this.outputsDir, fileName)
    await mkdir(dirname(outputPath), { recursive: true })
    const fontFile = snapshot.burnSubtitles && (snapshot.tracks.find(track => track.kind === 'subtitle')?.clips.length ?? 0) > 0
      ? await firstExisting([...(process.env.DSH_SUBTITLE_FONT === undefined ? [] : [process.env.DSH_SUBTITLE_FONT]), ...SUBTITLE_FONT_CANDIDATES])
      : undefined
    const format = snapshot.exportFormat ?? DEFAULT_EXPORT_FORMAT
    const args = buildRenderArgs(snapshot, { outputPath, format, ...fontFile === undefined ? {} : { fontFile } })
    const run = this.deps.run ?? defaultRenderRunner

    try {
      await run({ ffmpegPath: probe.path ?? 'ffmpeg', args, ...options.signal === undefined ? {} : { signal: options.signal }, durationMs: snapshot.durationMs, ...options.onProgress === undefined ? {} : { onProgress: options.onProgress } })
    } catch (error) {
      // 取消或失败都不留半成品
      await rm(outputPath, { force: true }).catch(() => undefined)
      throw error
    }

    const info = await stat(outputPath).catch(() => undefined)
    if (info === undefined || info.size === 0) {
      throw new RenderError('MEDIA_OUTPUT_INVALID', `导出没有产生有效文件：${outputPath}`)
    }
    const measured = await measureDuration(probe.path ?? 'ffmpeg', outputPath)
    if (measured !== undefined) {
      const tolerance = frameToleranceMs(snapshot.frameRate)
      if (Math.abs(measured - snapshot.durationMs) > tolerance + 1) {
        throw new RenderError(
          'MEDIA_OUTPUT_INVALID',
          `导出时长 ${Math.round(measured)}ms 与时间轴 ${snapshot.durationMs}ms 相差超过 1 帧（${tolerance.toFixed(1)}ms）：检查素材是否可解码。`,
        )
      }
    }
    // 规格复核：导出参数可配之后，必须确认产物**真的是这个规格**（不能只信参数）
    const spec = await probeMediaSpec(probe.path ?? 'ffmpeg', outputPath)
    if (spec !== undefined && spec.width !== undefined && spec.height !== undefined) {
      if (spec.width !== format.width || spec.height !== format.height) {
        throw new RenderError(
          'MEDIA_OUTPUT_INVALID',
          `导出分辨率 ${spec.width}x${spec.height} 与请求的 ${format.width}x${format.height} 不一致：检查素材能否解码到该尺寸。`,
        )
      }
      if (spec.fps !== undefined && Math.abs(spec.fps - format.frameRate) > 1) {
        throw new RenderError(
          'MEDIA_OUTPUT_INVALID',
          `导出帧率 ${spec.fps} 与请求的 ${format.frameRate} 不一致：检查素材帧率与滤镜链。`,
        )
      }
    }
    return { outputPath, bytes: info.size, durationMs: measured ?? snapshot.durationMs }
  }
}

/** 找到第一个存在的文件。 */
async function firstExisting(paths: readonly string[]): Promise<string | undefined> {
  for (const path of paths) {
    if (await stat(path).then(() => true).catch(() => false)) return path
  }
  return undefined
}

/**
 * 用 `ffmpeg -i` 的输出探测产物规格（不依赖 ffprobe 单独安装）。
 * @param ffmpegPath - ffmpeg 可执行文件。
 * @param file - 待探测文件。
 * @returns 宽/高/帧率/是否含音轨；解析不出来时为 `undefined`。
 */
export async function probeMediaSpec(
  ffmpegPath: string,
  file: string,
): Promise<{ width?: number; height?: number; fps?: number; hasAudio: boolean } | undefined> {
  const stream = await new Promise<{ stderr: string; ok: boolean }>(resolve => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', chunk => { stderr += String(chunk) })
    child.on('error', () => resolve({ stderr: '', ok: false }))
    child.on('close', () => resolve({ stderr, ok: true }))
  })
  if (!stream.ok) return undefined
  const hasAudio = /Stream #\d+:\d+.*: Audio: /.test(stream.stderr)
  const video = /Stream #\d+:\d+.*: Video: .*?(\d{2,5})x(\d{2,5})/.exec(stream.stderr)
  if (video === null) return hasAudio ? { hasAudio } : undefined
  const fpsMatch = /(\d+(?:\.\d+)?) fps/.exec(stream.stderr)
  return {
    width: Number(video[1]), height: Number(video[2]), hasAudio,
    ...fpsMatch === null ? {} : { fps: Number(fpsMatch[1]) },
  }
}

/** 用 `ffmpeg -i` 的输出量一下真实时长（不依赖 ffprobe 是否单独安装）。 */
export async function measureDuration(ffmpegPath: string, file: string): Promise<number | undefined> {
  return new Promise(resolve => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', chunk => { stderr += String(chunk) })
    child.on('error', () => resolve(undefined))
    child.on('close', () => {
      const match = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(stderr)
      if (match === null) { resolve(undefined); return }
      const [, hours, minutes, seconds] = match
      resolve((Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000)
    })
  })
}
