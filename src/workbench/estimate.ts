/**
 * 导出预估（Track A / A80）。
 *
 * 场景：用户点"导出"前想知道这条成片**多大、多长、什么规格**——尤其 4K，
 * 8 分钟就是几个 GB。这里用时间轴时长 + 导出规格做保守估算（不求精确，求"不至于意外"）。
 */
import {
  DEFAULT_EXPORT_FORMAT, effectiveDurationMs, normalizeExportFormat, type TimelineRecord,
} from './timeline.ts'

/** 一次导出的预估结果。 */
export interface ExportEstimate {
  /** 成片时长（毫秒，已计入变速与转场重叠）。 */
  readonly durationMs: number
  readonly width: number
  readonly height: number
  readonly frameRate: number
  /** 使用的码率（`bitrateKbps`；未显式设置时按分辨率/帧率估算）。 */
  readonly bitrateKbps: number
  /** 预估文件大小（字节，含 ~2% 容器开销）。 */
  readonly estimatedBytes: number
  /** 画面比例，如 `16:9` / `9:16` / `1:1`。 */
  readonly aspect: string
  /** 是否使用了估算码率（true = 时间轴没设码率）。 */
  readonly bitrateEstimated: boolean
}

/** 常见比例的容差（避免 1918×1080 被算成奇怪的比例）。 */
const COMMON_ASPECTS: ReadonlyArray<{ label: string; ratio: number }> = [
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '21:9', ratio: 21 / 9 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '5:4', ratio: 5 / 4 },
]

/** 从宽高推断"人话比例"；非常规比例返回 `宽:高` 化简结果。 */
export function describeAspect(width: number, height: number): string {
  const ratio = width / height
  const common = COMMON_ASPECTS.find(candidate => Math.abs(candidate.ratio - ratio) < 0.01)
  if (common !== undefined) return common.label
  const divisor = greatestCommonDivisor(width, height)
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b !== 0) [a, b] = [b, a % b]
  return a === 0 ? 1 : a
}

/**
 * 未设码率时的保守估算：按"每像素每帧约 0.12 bit"折算（1080p30 ≈ 7.5 Mbps，4K30 ≈ 30 Mbps）。
 * 数值来自常见 H.264 中等质量档位，宁高勿低——预估偏大比偏小好。
 */
export function estimateBitrateKbps(width: number, height: number, frameRate: number): number {
  return Math.max(500, Math.round((width * height * frameRate * 0.12) / 1000))
}

/**
 * 预估一次导出。
 * @param timeline - 时间轴。
 * @param overrides - 临时覆盖的规格（例如"如果我改成 4K 呢"）；缺省用时间轴自己的设置。
 * @returns 预估结果。
 */
export function estimateExport(
  timeline: TimelineRecord,
  overrides: { width?: number; height?: number; frameRate?: number; bitrateKbps?: number } = {},
): ExportEstimate {
  // 覆盖了分辨率/帧率却沿用原码率会严重低估（4K 用 1080p 的 8Mbps）→ 未显式给码率时改为重估
  const changesPicture = overrides.width !== undefined || overrides.height !== undefined || overrides.frameRate !== undefined
  const kept = normalizeExportFormat(timeline.exportFormat)
  const format = normalizeExportFormat(
    changesPicture && overrides.bitrateKbps === undefined ? { ...kept, ...overrides, bitrateKbps: undefined } : { ...kept, ...overrides },
  )
  const width = format.width ?? DEFAULT_EXPORT_FORMAT.width
  const height = format.height ?? DEFAULT_EXPORT_FORMAT.height
  const frameRate = format.frameRate ?? DEFAULT_EXPORT_FORMAT.frameRate
  const bitrateEstimated = format.bitrateKbps === undefined
  const bitrateKbps = format.bitrateKbps ?? estimateBitrateKbps(width, height, frameRate)
  const durationMs = timeline.tracks.reduce((longest, track) => {
    const trackEnd = track.clips.reduce((end, clip) => Math.max(end, clip.startMs + effectiveDurationMs(clip)), 0)
    return Math.max(longest, trackEnd)
  }, 0)
  // 转场会让总时长略微缩短；校验/导出的精确值走 timelineDurationMs，这里保守用轨道末端
  const seconds = durationMs / 1000
  const estimatedBytes = Math.round((bitrateKbps * 1000 * seconds) / 8 * 1.02)
  return {
    durationMs, width, height, frameRate, bitrateKbps, estimatedBytes,
    aspect: describeAspect(width, height), bitrateEstimated,
  }
}

/** 人读的体积文案（`1.2 GB` / `840 MB`）。 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
