/**
 * 参考图裁剪（`B-3` 融合生图的「场景裁剪」）。
 *
 * 为什么真的裁：模型看到整张场景图时，会把无关区域也当主体；只给它要用的那一块，
 * 构图命中率明显更高。裁剪走 sharp（插件已依赖），输出 PNG 保透明，落在 outputs 下。
 *
 * @module dsh-image-video/media/image-crop
 */
import { randomUUID } from 'node:crypto'
import { mkdir, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import sharp from 'sharp'
import type { ComposeCrop } from '../workbench/compose.ts'

/** 裁剪结果。 */
export interface CropResult {
  readonly path: string
  readonly bytes: number
  readonly width: number
  readonly height: number
}

/**
 * 按归一化坐标裁剪一张图片，写出新的 PNG。
 * @param input - 源图绝对/相对路径、归一化裁剪框、输出目录。
 * @returns 新文件路径与尺寸。
 * @throws {Error} 源图不可读/不是图片，或裁剪后小于 1px 时给出可操作错误。
 */
export async function cropImage(input: {
  readonly sourcePath: string
  readonly crop: ComposeCrop
  readonly outputsDir: string
}): Promise<CropResult> {
  const source = isAbsolute(input.sourcePath) ? input.sourcePath : resolve(input.sourcePath)
  const meta = await sharp(source).metadata().catch((cause: unknown) => {
    throw new Error(`场景图无法读取或不是图片：${input.sourcePath}（${cause instanceof Error ? cause.message : String(cause)}）`)
  })
  const sourceWidth = meta.width ?? 0
  const sourceHeight = meta.height ?? 0
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error(`场景图尺寸未知：${input.sourcePath}`)

  const left = Math.max(0, Math.min(sourceWidth - 1, Math.round(input.crop.x * sourceWidth)))
  const top = Math.max(0, Math.min(sourceHeight - 1, Math.round(input.crop.y * sourceHeight)))
  const width = Math.max(1, Math.min(sourceWidth - left, Math.round(input.crop.width * sourceWidth)))
  const height = Math.max(1, Math.min(sourceHeight - top, Math.round(input.crop.height * sourceHeight)))
  if (width < 8 || height < 8) {
    throw new Error(`裁剪结果太小（${width}×${height}px）：请框出更大的区域`)
  }

  const outputs = isAbsolute(input.outputsDir) ? input.outputsDir : resolve(input.outputsDir)
  const target = join(outputs, `compose-crop-${Date.now()}-${randomUUID().slice(0, 8)}.png`)
  await mkdir(dirname(target), { recursive: true })
  await sharp(source).extract({ left, top, width, height }).png().toFile(target)
  const info = await stat(target)
  return { path: target, bytes: info.size, width, height }
}
