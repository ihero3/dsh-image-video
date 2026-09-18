/**
 * 水印后处理测试：几何决策（位置/字号/留白）用 SVG 断言，真实合成用 sharp
 * 造图验证——既保证参数可推导，也保证真的能出图、且失败时不会丢原图。
 */

import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { applyImageWatermark, buildWatermarkSvg, fitFontSize } from '../src/watermark.ts'
import type { WatermarkConfig } from '../src/config.ts'

const baseConfig: WatermarkConfig = {
  enabled: true,
  text: 'Threerouter',
  opacity: 0.68,
  position: 'bottom-right',
  fontSizeRatio: 0.032,
  marginXRatio: 0.028,
  marginYRatio: 0.012,
  glowEnabled: true,
  glowColor: '#ffffff',
  glowBlurRatio: 0.18,
}

/** 造一张纯色测试图（默认 1000x750 PNG）。 */
async function makeImage(width = 1000, height = 750, format: 'png' | 'jpeg' = 'png'): Promise<Uint8Array> {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 60, b: 90 } },
  })
  const buffer = format === 'png' ? await image.png().toBuffer() : await image.jpeg().toBuffer()
  return new Uint8Array(buffer)
}

describe('水印几何：位置 / 字号 / 留白', () => {
  it('右下角：锚点在右侧、基线在底部留白之上', () => {
    const svg = buildWatermarkSvg(1000, 750, 'Threerouter', baseConfig)
    const marginX = Math.round(1000 * 0.028)
    const marginY = Math.round(750 * 0.012)
    const fontSize = Math.round(1000 * 0.032)
    expect(svg).toContain(`text-anchor="end"`)
    expect(svg).toContain(`x="${1000 - marginX}"`)
    expect(svg).toContain(`y="${Math.max(fontSize, 750 - marginY - Math.round(fontSize * 0.18))}"`)
    expect(svg).toContain(`font-size="${fontSize}px"`)
  })

  it('左下角：锚点在左侧、x 等于左留白', () => {
    const svg = buildWatermarkSvg(1000, 750, 'Threerouter', { ...baseConfig, position: 'bottom-left' })
    expect(svg).toContain('text-anchor="start"')
    expect(svg).toContain(`x="${Math.round(1000 * 0.028)}"`)
  })

  it('顶部位置：基线落在上留白之内（y = marginY + fontSize）', () => {
    const fontSize = Math.round(1000 * 0.032)
    const svg = buildWatermarkSvg(1000, 750, 'Threerouter', { ...baseConfig, position: 'top-right' })
    expect(svg).toContain(`y="${Math.round(750 * 0.012) + fontSize}"`)
  })

  it('文字过长时自动缩号，保证不横向溢出', () => {
    const long = 'Threerouter Powered By DeepSeek Harness Media Pipeline'
    const fontSize = fitFontSize(long, 600, 17, 0.032)
    const estimated = long.length * fontSize * 0.7
    expect(fontSize).toBeLessThan(Math.round(600 * 0.032))
    expect(estimated).toBeLessThanOrEqual((600 - 17 * 2) * 0.95 + 1)
    expect(fontSize).toBeGreaterThanOrEqual(10)
  })

  it('关闭发光时不注入 feGaussianBlur 滤镜', () => {
    const svg = buildWatermarkSvg(1000, 750, 'Threerouter', { ...baseConfig, glowEnabled: false })
    expect(svg).not.toContain('feGaussianBlur')
    expect(svg).toContain('fill="#ffffff"')
  })

  it('水印文字中的 XML 特殊字符被转义（不破坏 SVG 结构）', () => {
    const svg = buildWatermarkSvg(1000, 750, 'A&B<C>', baseConfig)
    expect(svg).toContain('A&amp;B&lt;C&gt;')
  })
})

describe('水印合成：真实出图', () => {
  it('合成后仍是合法图片、尺寸不变、字节已改变', async () => {
    const source = await makeImage()
    const result = await applyImageWatermark(source, 'image/png', baseConfig)
    expect(result.applied).toBe(true)
    expect(result.contentType).toBe('image/png')
    const meta = await sharp(Buffer.from(result.data)).metadata()
    expect(meta.width).toBe(1000)
    expect(meta.height).toBe(750)
    expect(Buffer.from(result.data).equals(Buffer.from(source))).toBe(false)
  })

  it('不同位置的合成结果互不相同（位置配置真的生效）', async () => {
    const source = await makeImage(800, 600)
    const right = await applyImageWatermark(source, 'image/png', baseConfig)
    const left = await applyImageWatermark(source, 'image/png', { ...baseConfig, position: 'top-left' })
    expect(right.applied && left.applied).toBe(true)
    expect(Buffer.from(right.data).equals(Buffer.from(left.data))).toBe(false)
  })

  it('JPEG 输入保持 JPEG 输出（格式不漂移）', async () => {
    const source = await makeImage(640, 480, 'jpeg')
    const result = await applyImageWatermark(source, 'image/jpeg', baseConfig)
    expect(result.applied).toBe(true)
    expect(result.contentType).toBe('image/jpeg')
    const meta = await sharp(Buffer.from(result.data)).metadata()
    expect(meta.format).toBe('jpeg')
  })

  it('极小尺寸图片不会崩（字号下限 10px）', async () => {
    const source = await makeImage(64, 48)
    const result = await applyImageWatermark(source, 'image/png', baseConfig)
    expect(result.applied).toBe(true)
    const meta = await sharp(Buffer.from(result.data)).metadata()
    expect(meta.width).toBe(64)
    expect(meta.height).toBe(48)
  })
})

describe('水印开关与失败开放', () => {
  it('enabled=false → 原样返回并给出原因', async () => {
    const source = await makeImage()
    const result = await applyImageWatermark(source, 'image/png', { ...baseConfig, enabled: false })
    expect(result.applied).toBe(false)
    expect(result.data).toBe(source)
    expect(result.note).toContain('watermark.enabled=false')
  })

  it('文本为空 → 跳过并给出原因', async () => {
    const source = await makeImage()
    const result = await applyImageWatermark(source, 'image/png', { ...baseConfig, text: '   ' })
    expect(result.applied).toBe(false)
    expect(result.note).toContain('文本为空')
  })

  it('非法图片字节 → 保留原图并回报原因（绝不丢用户的付费结果）', async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5])
    const result = await applyImageWatermark(garbage, 'image/png', baseConfig)
    expect(result.applied).toBe(false)
    expect(result.data).toBe(garbage)
    expect(result.note).toContain('已保留模型原图')
  })
})
