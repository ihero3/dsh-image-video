/**
 * 成片多比例切片（`B-5`）：一条时间轴 → 一次导出多种画幅（竖屏/方图/横屏）。
 *
 * 为什么走"重新导出"而不是"生成时多出几版"：切片是对**已剪好的成片**做画幅重排，
 * 内容不变、只换容器/构图，成本是编码而不是模型调用（便宜且可重复）。
 *
 * 口径（与 `timeline.exportFormat` 校验保持一致）：
 * - **保持短边不变**：720p 的 16:9 = 1280×720 → 9:16 = 720×1280、1:1 = 720×720、4:3 = 960×720；
 * - 宽高必须是偶数且落在 `EXPORT_DIMENSION_RANGE` 内（不满足就取最近的合法值并在 warns 里说明）；
 * - 一条时间轴最多派生 4 种画幅（导出是 CPU 密集操作，不鼓励一次排一堆）。
 *
 * @module dsh-image-video/workbench/derive-ratios
 */
import { DEFAULT_EXPORT_FORMAT, EXPORT_DIMENSION_RANGE, type TimelineExportFormat, type TimelineRecord } from './timeline.ts'

/** 允许派生的画幅白名单（避免任意字符串算出畸形尺寸）。 */
export const DERIVABLE_RATIOS = ['16:9', '9:16', '1:1', '4:3'] as const

/** 一个可派生的画幅。 */
export type DerivableRatio = (typeof DERIVABLE_RATIOS)[number]

/** 单次最多派生的画幅数。 */
const MAX_SLICES = 4

/** 画幅 → 宽高比（宽/高）。 */
const RATIO_VALUE: Readonly<Record<DerivableRatio, number>> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:3': 4 / 3,
}

/** 把数字夹到导出允许范围并取偶。 */
function clampEven(value: number): number {
  const rounded = Math.round(value / 2) * 2
  return Math.max(EXPORT_DIMENSION_RANGE.min, Math.min(EXPORT_DIMENSION_RANGE.max, rounded))
}

/**
 * 按目标画幅推导尺寸（保持短边不变）。
 * @param base - 基础导出规格。
 * @param ratio - 目标画幅（必须在白名单内）。
 * @returns 目标宽高（均为偶数且在合法范围内）。
 * @throws {Error} 画幅不在白名单时。
 */
export function sizeForRatio(base: TimelineExportFormat, ratio: string): { width: number; height: number } {
  if (!(DERIVABLE_RATIOS as readonly string[]).includes(ratio)) {
    throw new Error(`不支持的画幅「${ratio}」：可选 ${DERIVABLE_RATIOS.join('、')}`)
  }
  const value = RATIO_VALUE[ratio as DerivableRatio]
  const shortSide = Math.min(base.width, base.height)
  if (value >= 1) return { width: clampEven(shortSide * value), height: clampEven(shortSide) }
  return { width: clampEven(shortSide), height: clampEven(shortSide / value) }
}

/** 切片计划里的一项。 */
export interface RatioSlice {
  readonly ratio: DerivableRatio
  readonly width: number
  readonly height: number
  /** 派生后的时间轴（只改了 `exportFormat` 与名字，轨道/字幕/效果原样保留）。 */
  readonly timeline: TimelineRecord
}

/**
 * 从一条时间轴派生多画幅切片计划（纯函数，不触发渲染）。
 * @param input - 时间轴、目标画幅列表、可选的显式基础规格。
 * @returns 切片计划 + 非阻断提醒（去重/裁边/跳过基础画幅）。
 * @throws {Error} 没有给画幅、超过上限、或画幅不在白名单时。
 */
export function planRatioSlices(input: {
  readonly timeline: TimelineRecord
  readonly ratios: readonly string[]
  readonly base?: TimelineExportFormat
}): { slices: readonly RatioSlice[]; warnings: readonly string[] } {
  if (input.ratios.length === 0) throw new Error('至少给一个目标画幅（如 ["9:16","1:1"]）')
  if (input.ratios.length > MAX_SLICES) throw new Error(`一次最多派生 ${MAX_SLICES} 种画幅（收到 ${input.ratios.length} 种）`)
  const unique = [...new Set(input.ratios)]
  const base = input.base ?? input.timeline.exportFormat ?? DEFAULT_EXPORT_FORMAT
  const warnings: string[] = []
  if (unique.length < input.ratios.length) warnings.push('目标画幅有重复项，已去重')

  const slices: RatioSlice[] = []
  for (const ratio of unique) {
    const size = sizeForRatio(base, ratio) // 未知画幅在这里响亮报错
    const ratioValue = RATIO_VALUE[ratio as DerivableRatio]
    const baseValue = base.width / base.height
    if (Math.abs(ratioValue - baseValue) < 0.01) {
      warnings.push(`「${ratio}」与原画幅一致：仍是独立导出（会重复编码一次），可只保留一个`)
    }
    slices.push({
      ratio: ratio as DerivableRatio,
      width: size.width,
      height: size.height,
      timeline: {
        ...input.timeline,
        name: `${input.timeline.name} · ${ratio}`,
        exportFormat: { ...base, width: size.width, height: size.height },
      },
    })
  }
  return { slices, warnings }
}
