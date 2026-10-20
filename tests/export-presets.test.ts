/**
 * 导出预设（Track A / A31）：平台尺寸口径统一、全部合法、端点与工具都能用。
 */
import { describe, expect, it } from 'vitest'
import { EXPORT_PRESETS, EXPORT_PRESET_IDS, presetToFormat, resolveExportPreset } from '../src/workbench/presets.ts'

describe('export presets (A31)', () => {
  it('ships unique ids and every preset is a legal export format', () => {
    expect(new Set(EXPORT_PRESET_IDS).size).toBe(EXPORT_PRESETS.length)
    for (const preset of EXPORT_PRESETS) {
      const format = presetToFormat(preset.id)
      expect(format).toMatchObject({ width: preset.width, height: preset.height, frameRate: preset.frameRate })
    }
    // 常用平台都在
    for (const id of ['douyin-vertical', 'xiaohongshu-3x4', 'youtube-1080p', 'square-1080']) {
      expect(EXPORT_PRESET_IDS).toContain(id)
    }
  })

  it('resolves by id and rejects unknown ids with the available list', () => {
    expect(resolveExportPreset('douyin-vertical')).toMatchObject({ width: 1080, height: 1920 })
    expect(() => resolveExportPreset('nope')).toThrow(/可选：/)
  })
})
