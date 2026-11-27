/**
 * 导出档位换算（`B2`）：界面上的 480P/2K、24–60fps、16:9/9:16/1:1/3:4
 * 必须能落到渲染器认的 `{width,height,frameRate}`，口径与多比例切片一致（短边不变）。
 */
import { describe, expect, it } from 'vitest'
import {
  EXPORT_ASPECT_PRESETS, EXPORT_RESOLUTION_SHORT_SIDES, hasExportSelection, resolveExportFormat, sameExportFormat,
} from '../src/workbench/export-selection.ts'
import { DEFAULT_EXPORT_FORMAT } from '../src/workbench/timeline.ts'

const BASE = { width: 1280, height: 720, frameRate: 30 }

describe('resolveExportFormat (B2)', () => {
  it('keeps the timeline format when no selection is given', () => {
    expect(resolveExportFormat(undefined, {})).toEqual(BASE)
    expect(resolveExportFormat(BASE, {})).toEqual(BASE)
    // "模型默认" = 不覆盖分辨率，仍应用其它档位
    expect(resolveExportFormat(BASE, { resolution: 'default' })).toEqual(BASE)
  })

  it('treats the resolution preset as the SHORT side (portrait 2K is 1440x2560, not 2560x1440)', () => {
    expect(EXPORT_RESOLUTION_SHORT_SIDES['2k']).toBe(1440)
    // 横屏 720p → 2K
    expect(resolveExportFormat(BASE, { resolution: '2k' })).toMatchObject({ width: 2560, height: 1440 })
    // 竖屏 1080x1920 → 2K：保持竖屏画幅，短边抬到 1440
    expect(resolveExportFormat({ width: 1080, height: 1920, frameRate: 30 }, { resolution: '2k' }))
      .toMatchObject({ width: 1440, height: 2560 })
  })

  it('scales down to 480P and keeps the aspect of the source', () => {
    // 1280x720 → 短边 480 = 854x480（偶数、等比）
    expect(resolveExportFormat(BASE, { resolution: '480' })).toMatchObject({ width: 854, height: 480 })
    expect(resolveExportFormat(BASE, { resolution: '768' })).toMatchObject({ width: 1366, height: 768 })
  })

  it('applies the aspect preset on top of the short side', () => {
    expect(resolveExportFormat(BASE, { aspect: 'vertical' })).toMatchObject({ width: 720, height: 1280 })
    expect(resolveExportFormat(BASE, { aspect: 'square' })).toMatchObject({ width: 720, height: 720 })
    expect(resolveExportFormat(BASE, { aspect: 'portrait' })).toMatchObject({ width: 720, height: 960 })
    // 横屏 16:9 本来就是 16:9 → 不变
    expect(resolveExportFormat(BASE, { aspect: 'landscape' })).toMatchObject({ width: 1280, height: 720 })
    // 组合：480P + 竖屏
    expect(resolveExportFormat(BASE, { resolution: '480', aspect: 'vertical' })).toMatchObject({ width: 480, height: 854 })
  })

  it('honours the frame rate preset and rejects unsupported values instead of silently keeping the old one', () => {
    expect(resolveExportFormat(BASE, { fps: 60 })).toMatchObject({ frameRate: 60 })
    expect(resolveExportFormat(BASE, { fps: 24 })).toMatchObject({ frameRate: 24 })
    expect(() => resolveExportFormat(BASE, { fps: 31 })).toThrow(/帧率/)
    expect(() => resolveExportFormat(BASE, { fps: 0 })).toThrow(/帧率/)
  })

  it('rejects unknown presets (no silent fallback)', () => {
    expect(() => resolveExportFormat(BASE, { resolution: '4k' })).toThrow(/分辨率档位/)
    expect(() => resolveExportFormat(BASE, { aspect: '21:9' })).toThrow(/画幅档位/)
  })

  it('drops the inherited bitrate once the picture changes, keeps it when it does not', () => {
    const withBitrate = { ...BASE, bitrateKbps: 8000 }
    // 只换帧率也算画面变了：8Mbps 是按 30fps 估的
    expect(resolveExportFormat(withBitrate, { fps: 60 })).not.toHaveProperty('bitrateKbps')
    expect(resolveExportFormat(withBitrate, { resolution: '2k' })).not.toHaveProperty('bitrateKbps')
    // 规格没变 → 保留用户/预设给的码率
    expect(resolveExportFormat(withBitrate, {})).toHaveProperty('bitrateKbps', 8000)
    expect(resolveExportFormat(withBitrate, { resolution: 'default' })).toHaveProperty('bitrateKbps', 8000)
  })

  it('produces even dimensions inside the legal range for every preset combination', () => {
    const resolutions = ['default', ...Object.keys(EXPORT_RESOLUTION_SHORT_SIDES)]
    for (const resolution of resolutions) {
      for (const aspect of ['landscape', 'portrait', 'square', 'vertical']) {
        const format = resolveExportFormat(BASE, { resolution, aspect })
        expect(format.width % 2, `${resolution}/${aspect} width`).toBe(0)
        expect(format.height % 2, `${resolution}/${aspect} height`).toBe(0)
        expect(format.width).toBeGreaterThanOrEqual(128)
        expect(format.height).toBeGreaterThanOrEqual(128)
        expect(format.width).toBeLessThanOrEqual(4096)
        expect(format.height).toBeLessThanOrEqual(4096)
      }
    }
  })

  it('exposes the presets the UI actually renders', () => {
    // 与 locales 的 16:9 / 3:4 / 1:1 / 9:16 一一对应
    expect(EXPORT_ASPECT_PRESETS).toEqual({ landscape: '16:9', portrait: '3:4', square: '1:1', vertical: '9:16' })
    expect(hasExportSelection({})).toBe(false)
    expect(hasExportSelection({ resolution: 'default' })).toBe(true)
  })

  it('compares formats including the bitrate', () => {
    expect(sameExportFormat(BASE, BASE)).toBe(true)
    // 没有 exportFormat 等价于默认规格
    expect(sameExportFormat(BASE, undefined)).toBe(true)
    expect(sameExportFormat(BASE, { width: 1920, height: 1080, frameRate: 30 })).toBe(false)
    expect(sameExportFormat({ ...BASE, bitrateKbps: 4000 }, BASE)).toBe(false)
    expect(sameExportFormat(BASE, DEFAULT_EXPORT_FORMAT)).toBe(true)
  })
})
