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
import type { TimelineRecord, TimelineTrack } from '../workbench/timeline.ts'

/** 渲染用的时间轴快照（冻结后与原文档再无关系）。 */
export interface TimelineSnapshot {
  readonly id: string
  readonly frameRate: number
  readonly burnSubtitles: boolean
  readonly durationMs: number
  readonly tracks: readonly TimelineTrack[]
}

/** 一段画面：要么是素材 clip，要么是补的黑场。 */
export type VideoSegment =
  | { readonly kind: 'clip'; readonly clipId: string; readonly assetPath: string; readonly inMs: number; readonly durationMs: number }
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
  const durationMs = tracks.reduce(
    (longest, track) => track.clips.reduce(
      (trackLongest, clip) => Math.max(trackLongest, clip.startMs + clip.durationMs),
      longest,
    ),
    0,
  )
  return { id: timeline.id, frameRate: timeline.frameRate, burnSubtitles: timeline.burnSubtitles, durationMs, tracks }
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
    segments.push({ kind: 'clip', clipId: clip.id, assetPath, inMs: clip.inMs ?? 0, durationMs: clip.durationMs })
    cursor = clip.startMs + clip.durationMs
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
}): string[] {
  const segments = planVideoSegments(snapshot)
  const width = options.width ?? RENDER_WIDTH
  const height = options.height ?? RENDER_HEIGHT
  const fps = snapshot.frameRate
  const args: string[] = ['-y', '-hide_banner', '-nostdin', '-loglevel', 'error', '-progress', 'pipe:1']

  segments.forEach(segment => {
    if (segment.kind === 'filler') {
      args.push('-f', 'lavfi', '-t', (segment.durationMs / 1000).toFixed(3),
        '-i', `color=c=black:s=${width}x${height}:r=${fps}`)
      return
    }
    if (segment.inMs > 0) args.push('-ss', (segment.inMs / 1000).toFixed(3))
    args.push('-t', (segment.durationMs / 1000).toFixed(3), '-i', segment.assetPath)
  })

  const chains: string[] = []
  const labels: string[] = []
  segments.forEach((_segment, index) => {
    chains.push(
      `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,`
      + `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${index}]`,
    )
    labels.push(`[v${index}]`)
  })
  const concat = `${labels.join('')}concat=n=${segments.length}:v=1:a=0`

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
      drawFilters.push(
        `drawtext=${fontPart}text='${escapeDrawtext(clip.text ?? '')}':fontsize=${fontSize}:fontcolor=${color}:`
        + `x=(w-text_w)/2:y=${y}:enable='between(t,${(clip.startMs / 1000).toFixed(3)},${((clip.startMs + clip.durationMs) / 1000).toFixed(3)})'`,
      )
    }
  }
  if (drawFilters.length === 0) {
    chains.push(`${concat}[vout]`)
  } else {
    chains.push(`${concat}[vcat]`)
    chains.push(`[vcat]${drawFilters.join(',')}[vout]`)
  }

  args.push('-filter_complex', chains.join(';'))
  args.push('-map', '[vout]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', options.outputPath)
  return args
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
    const child = spawn(ffmpegPath, [...args], { stdio: ['ignore', 'pipe', 'pipe'] })
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
      ? await firstExisting(SUBTITLE_FONT_CANDIDATES)
      : undefined
    const args = buildRenderArgs(snapshot, { outputPath, ...fontFile === undefined ? {} : { fontFile } })
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
