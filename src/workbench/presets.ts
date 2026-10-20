/**
 * 导出预设（Track A / A31）：把"平台常见的尺寸/帧率/码率"固化成一等公民。
 *
 * 为什么放域层：界面、Agent、CLI 都应该用同一套预设值，避免"抖音竖屏"
 * 在不同入口出现 720×1280 / 1080×1920 两种口径。
 */
import { EXPORT_FRAME_RATES, EXPORT_DIMENSION_RANGE, normalizeExportFormat, type TimelineExportFormat } from './timeline.ts'

/** 一个导出预设。 */
export interface ExportPreset {
  readonly id: string
  /** 中文名（界面文案由 B 决定，这里给缺省值）。 */
  readonly name: string
  readonly width: number
  readonly height: number
  readonly frameRate: number
  /** 视频码率（kbps，可选）。 */
  readonly bitrateKbps?: number
}

/** 内置预设（全部经过 `normalizeExportFormat` 校验，保证合法）。 */
export const EXPORT_PRESETS: readonly ExportPreset[] = [
  { id: 'douyin-vertical', name: '抖音竖屏', width: 1080, height: 1920, frameRate: 30, bitrateKbps: 8000 },
  { id: 'xiaohongshu-3x4', name: '小红书 3:4', width: 1080, height: 1440, frameRate: 30, bitrateKbps: 8000 },
  { id: 'square-1080', name: '方形 1080', width: 1080, height: 1080, frameRate: 30, bitrateKbps: 8000 },
  { id: 'youtube-1080p', name: 'YouTube 1080p', width: 1920, height: 1080, frameRate: 30, bitrateKbps: 12_000 },
  { id: 'youtube-4k', name: 'YouTube 4K', width: 3840, height: 2160, frameRate: 30, bitrateKbps: 40_000 },
  { id: 'default-720p', name: '默认 720p', width: 1280, height: 720, frameRate: 30 },
]

/** 所有预设 id。 */
export const EXPORT_PRESET_IDS: readonly string[] = EXPORT_PRESETS.map(preset => preset.id)

/**
 * 按 id 取预设。
 * @param id - 预设 id。
 * @returns 预设。
 * @throws {Error} 未知 id 时（列出可选值，别让调用方猜）。
 */
export function resolveExportPreset(id: string): ExportPreset {
  const preset = EXPORT_PRESETS.find(candidate => candidate.id === id)
  if (preset === undefined) {
    throw new Error(`没有导出预设 ${id}；可选：${EXPORT_PRESET_IDS.join(' / ')}`)
  }
  return preset
}

/**
 * 把预设转成导出规格（已过一遍校验，保证不会把非法值写进时间轴）。
 * @param id - 预设 id。
 * @returns 导出规格。
 */
export function presetToFormat(id: string): TimelineExportFormat {
  const preset = resolveExportPreset(id)
  return normalizeExportFormat({
    width: preset.width, height: preset.height, frameRate: preset.frameRate,
    ...preset.bitrateKbps === undefined ? {} : { bitrateKbps: preset.bitrateKbps },
  })
}

/** 自检：内置预设必须都在合法范围内（模块加载时不做 IO，只在这里暴露常量）。 */
export const PRESET_INVARIANTS = {
  dimensionRange: EXPORT_DIMENSION_RANGE,
  frameRates: EXPORT_FRAME_RATES,
} as const
