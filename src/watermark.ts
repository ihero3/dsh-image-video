/**
 * 品牌水印后处理（正式实现，非临时脚本）。
 *
 * 位置：图片生成流程的**后处理阶段**——模型原始字节下载到内存后、写入 outputs/
 * 与 attachment 之前完成合成。因此：
 *   - 磁盘上只有一份文件（最终图），不存在「原图 + 水印图」两份产物；
 *   - 交互流展示的附件与文件是同一份字节，用户看到的就是最终结果；
 *   - 不依赖工作目录、不需要任何外部脚本或 Python 环境。
 *
 * 合成方式：sharp 把一段 SVG 合到原图上（librsvg 负责文字栅格化）。
 * 语义要点：
 *   - 尺寸全部按图片宽度/高度的**比例**表达，同一套配置对任意尺寸出图观感一致；
 *   - 右下角（默认）与四角位置均支持，左右用 text-anchor 对齐、上下用基线偏移；
 *   - 文字过宽（超窄图）时自动缩号，保证水印不会横向溢出画面；
 *   - 失败**开放**：水印是装饰性后处理，任何异常都不能让用户的付费结果丢失，
 *     因此失败时原样返回模型原图并回报原因。
 * @module dsh-image-video/watermark
 */

import sharp from 'sharp'
import type { WatermarkConfig } from './config.ts'

/** 水印处理结果。 */
export interface WatermarkResult {
  /** 最终图片字节（失败时为原始字节）。 */
  data: Uint8Array
  /** 最终图片 MIME 类型。 */
  contentType: string
  /** 是否真的合成了水印（enabled=false / 文本为空 / 出错时为 false）。 */
  applied: boolean
  /** 未合成时的原因说明（供结果层透明告知）；正常合成时缺省。 */
  note?: string
}

/** 默认等宽估算系数：无字体度量 API 时用于「水印是否横向溢出」的保守判断。 */
const AVERAGE_GLYPH_RATIO = 0.62

/**
 * 给图片加品牌水印。
 * @param data - 模型返回的原始图片字节。
 * @param contentType - 原始 MIME 类型（决定输出编码，保持与上游一致的格式）。
 * @param config - 水印配置（enabled=false 时直接原样返回）。
 * @returns 处理结果（含 applied / note，供结果层如实告知）。
 */
export async function applyImageWatermark(
  data: Uint8Array,
  contentType: string,
  config: WatermarkConfig,
): Promise<WatermarkResult> {
  if (!config.enabled) {
    return { data, contentType, applied: false, note: '品牌水印已在配置中关闭（watermark.enabled=false）' }
  }
  const text = config.text.trim()
  if (text === '') {
    return { data, contentType, applied: false, note: '品牌水印文本为空，已跳过水印后处理' }
  }
  try {
    const image = sharp(data).rotate()
    const meta = await image.metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (width <= 0 || height <= 0) {
      return { data, contentType, applied: false, note: '品牌水印未合成：无法读取图片尺寸（格式异常），已保留模型原图' }
    }
    const svg = buildWatermarkSvg(width, height, text, config)
    const composited = image.composite([{ input: Buffer.from(svg), blend: 'over' }])
    const normalized = contentType.toLowerCase()
    const output = normalized.includes('png')
      ? await composited.png().toBuffer()
      : normalized.includes('webp')
        ? await composited.webp({ quality: 95 }).toBuffer()
        : await composited.jpeg({ quality: 95 }).toBuffer()
    return {
      data: new Uint8Array(output),
      contentType: normalized.includes('png') ? 'image/png' : normalized.includes('webp') ? 'image/webp' : 'image/jpeg',
      applied: true,
    }
  } catch (err) {
    // 失败开放：宁可没有水印，也不能把用户的付费结果弄丢。
    return {
      data,
      contentType,
      applied: false,
      note: `品牌水印未合成（${err instanceof Error ? err.message : String(err)}），已保留模型原图`,
    }
  }
}

/**
 * 构造水印 SVG。导出供单测直接断言坐标/字号等几何决策，无需真的解码图片。
 * @param width - 图片宽度（像素）。
 * @param height - 图片高度（像素）。
 * @param text - 水印文字（已 trim，非空）。
 * @param config - 水印配置。
 */
export function buildWatermarkSvg(width: number, height: number, text: string, config: WatermarkConfig): string {
  const marginX = Math.max(4, Math.round(width * config.marginXRatio))
  const marginY = Math.max(4, Math.round(height * config.marginYRatio))
  const fontSize = fitFontSize(text, width, marginX, config.fontSizeRatio)
  const letterSpacing = Math.max(1, Math.round(fontSize * 0.08))
  const right = config.position.endsWith('right')
  const bottom = config.position.startsWith('bottom')
  const x = right ? width - marginX : marginX
  // SVG 的 y 是文字基线：底部位置要让基线上移一点，顶部位置要让基线落到首行内。
  const y = bottom
    ? Math.max(fontSize, height - marginY - Math.round(fontSize * 0.18))
    : marginY + fontSize
  const anchor = right ? 'end' : 'start'
  const escaped = escapeXml(text)
  const glowStd = Math.max(1, fontSize * config.glowBlurRatio)
  const filter = config.glowEnabled
    ? `<filter id="wm-glow" x="-50%" y="-150%" width="200%" height="400%">`
      + `<feGaussianBlur stdDeviation="${glowStd.toFixed(2)}"/></filter>`
    : ''
  const glowText = config.glowEnabled
    ? `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${config.glowColor}" `
      + `opacity="${clamp01(config.opacity * 0.72)}" filter="url(#wm-glow)" `
      + `font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="${fontSize}px" `
      + `font-weight="500" letter-spacing="${letterSpacing}px">${escaped}</text>`
    : ''
  const mainText = `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#ffffff" `
    + `opacity="${clamp01(config.opacity)}" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" `
    + `font-size="${fontSize}px" font-weight="500" letter-spacing="${letterSpacing}px">${escaped}</text>`
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`
    + `<defs>${filter}</defs>${glowText}${mainText}</svg>`
}

/**
 * 计算字号：基准为 `宽度 × fontSizeRatio`，并保证估算文字宽度不超过
 * 可用宽度（图片宽度减两侧留白）的 95%，避免窄图上水印横向溢出。
 * @param text - 水印文字。
 * @param width - 图片宽度。
 * @param marginX - 单侧水平留白。
 * @param fontSizeRatio - 字号占图片宽度的比例。
 * @returns 最终字号（像素，至少 10px）。
 */
export function fitFontSize(text: string, width: number, marginX: number, fontSizeRatio: number): number {
  const base = Math.max(10, Math.round(width * fontSizeRatio))
  const available = Math.max(1, width - marginX * 2)
  // 字距约 8%，故每个字约占 0.62 + 0.08 = 0.70 个字号宽度。
  const estimatedWidth = text.length * base * (AVERAGE_GLYPH_RATIO + 0.08)
  if (estimatedWidth <= available * 0.95) return base
  const scaled = Math.floor((available * 0.95) / (text.length * (AVERAGE_GLYPH_RATIO + 0.08)))
  return Math.max(10, scaled)
}

/** 把 [0,1] 之外的值收敛回区间（配置已由 schema 校验，此处防御脏值）。 */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.68
  return Math.min(1, Math.max(0, value))
}

/** XML 转义：水印文字来自配置，仍需防止破坏 SVG 结构。 */
function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) =>
    char === '<' ? '&lt;'
      : char === '>' ? '&gt;'
        : char === '&' ? '&amp;'
          : char === "'" ? '&apos;'
            : '&quot;')
}
