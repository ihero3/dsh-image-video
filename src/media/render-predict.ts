/**
 * 导出耗时预测（Track A / A98）。
 *
 * 现状：导出开始后才有 ETA（A52/A92），用户点之前不知道要等多久。
 * 做法：把历史导出归纳成"**归一化成本**" = 渲染耗时 ÷ 输出时长 ÷ 像素率，
 * 再拿它预测新导出——同一台机器上这个比值相当稳定，比拍脑袋的固定倍数准。
 */
import { DEFAULT_EXPORT_FORMAT, normalizeExportFormat } from '../workbench/timeline.ts'

/** 一次历史导出的样本。 */
export interface RenderSample {
  /** 渲染耗时（毫秒）。 */
  readonly renderMs: number
  /** 成片时长（毫秒）。 */
  readonly durationMs: number
  readonly width: number
  readonly height: number
  readonly frameRate: number
}

/** 一次导出的规格（预测目标）。 */
export interface RenderTarget {
  readonly durationMs: number
  readonly width: number
  readonly height: number
  readonly frameRate: number
}

/** 每秒像素数（衡量"要编多少画面"）。 */
export function pixelsPerSecond(width: number, height: number, frameRate: number): number {
  return Math.max(1, width * height * frameRate)
}

/**
 * 单次样本的归一化成本：渲染 1 毫秒成片、每秒 1 像素需要多少毫秒。
 * @param sample - 历史样本。
 * @returns 归一化成本（毫秒 / (毫秒 × 像素/秒)）。
 */
export function normalizedCost(sample: RenderSample): number {
  const outputMs = Math.max(1, sample.durationMs)
  return sample.renderMs / (outputMs * pixelsPerSecond(sample.width, sample.height, sample.frameRate))
}

/**
 * 预测一次导出的渲染耗时。
 * @param target - 目标规格。
 * @param samples - 历史样本（无样本时退回保守默认）。
 * @param fallbackFactor - 无样本时的默认"渲染耗时 / 成片时长"倍数（1080p30 实测约 0.8）。
 * @returns 预计渲染耗时（毫秒）。刻意偏保守（取历史中位数 × 1.1 安全系数）。
 */
export function predictRenderMs(
  target: RenderTarget,
  samples: readonly RenderSample[],
  fallbackFactor = 0.8,
): number {
  const usable = samples.filter(sample => sample.renderMs > 0 && sample.durationMs > 0)
  const outputMs = Math.max(1, target.durationMs)
  if (usable.length === 0) {
    // 无历史：以 1080p30 为基准按像素率折算
    const baseline = pixelsPerSecond(1920, 1080, 30)
    const scale = pixelsPerSecond(target.width, target.height, target.frameRate) / baseline
    return Math.round(outputMs * fallbackFactor * Math.max(1, scale))
  }
  const costs = usable.map(normalizedCost).sort((left, right) => left - right)
  const median = costs[Math.floor(costs.length / 2)] ?? costs[0] ?? 0
  return Math.round(outputMs * pixelsPerSecond(target.width, target.height, target.frameRate) * median * 1.1)
}

/** 人话耗时文案（`2 分 15 秒` / `48 秒`）。 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(1, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes === 0 ? `${seconds} 秒` : `${minutes} 分 ${seconds} 秒`
}

/** 从时间轴导出规格构造预测目标（含默认值兜底）。 */
export function targetFromFormat(
  durationMs: number,
  format: { width?: number; height?: number; frameRate?: number } | undefined,
): RenderTarget {
  const normalized = normalizeExportFormat(format)
  return {
    durationMs,
    width: normalized.width ?? DEFAULT_EXPORT_FORMAT.width,
    height: normalized.height ?? DEFAULT_EXPORT_FORMAT.height,
    frameRate: normalized.frameRate ?? DEFAULT_EXPORT_FORMAT.frameRate,
  }
}
