/**
 * 媒体渲染与输出模块：下载生成结果到 outputs/ 目录，
 * 图片通过 attachment 服务内嵌渲染在对话中，视频返回本地文件链接。
 * @module dsh-image-video/media
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { ImageAttachmentRef, ImageMediaType, AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import { downloadMedia } from './http-client.ts'
import type { HttpOpts } from './providers/types.ts'

/** 媒体保存结果。 */
export interface MediaSaveResult {
  /** outputs/ 下的绝对文件路径。 */
  localPath: string
  /** 媒体下载 URL。 */
  sourceUrl: string
  /** 媒体类型（image/png 等）。 */
  contentType: string
  /** 文件大小（字节）。 */
  bytes: number
  /** 下载的原始字节，供 attachment 服务复用。 */
  data: Uint8Array
}

/**
 * 下载媒体并保存到 outputs/ 目录。
 * @param url - 服务商返回的媒体下载 URL。
 * @param outputsDir - 配置的输出目录。
 * @param ext - 文件扩展名（如 .png、.mp4）。
 * @param opts - HTTP 下载选项。
 * @returns 保存结果。
 */
export async function downloadAndSave(
  url: string,
  outputsDir: string,
  fallbackExt: string,
  opts: Pick<HttpOpts, 'timeoutMs' | 'retryTimes' | 'signal'>,
): Promise<MediaSaveResult> {
  const { data, contentType } = await downloadMedia(url, opts)
  const dir = resolve(outputsDir)
  await mkdir(dir, { recursive: true })
  const ext = extFromContentType(contentType, fallbackExt)
  const filename = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`
  const localPath = resolve(dir, filename)
  await writeFile(localPath, data)
  return { localPath, sourceUrl: url, contentType, bytes: data.byteLength, data }
}

/** 从 Content-Type 推断图片媒体类型（attachment 服务要求精确类型）。 */
export function toImageMediaType(contentType: string): ImageMediaType {
  const ct = contentType.toLowerCase().split(';')[0]?.trim() ?? ''
  if (ct.includes('png')) return 'image/png'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'image/jpeg'
  if (ct.includes('webp')) return 'image/webp'
  if (ct.includes('gif')) return 'image/gif'
  return 'image/png'
}

/** 从 Content-Type 推断文件扩展名。 */
export function extFromContentType(contentType: string, fallback: string): string {
  const ct = contentType.toLowerCase().split(';')[0]?.trim() ?? ''
  if (ct.includes('png')) return '.png'
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg'
  if (ct.includes('webp')) return '.webp'
  if (ct.includes('gif')) return '.gif'
  if (ct.includes('mp4')) return '.mp4'
  if (ct.includes('quicktime') || ct.includes('mov')) return '.mov'
  return fallback
}

/**
 * 创建内嵌图片渲染块：通过 attachment 服务持久化字节，返回对话内嵌预览块。
 * `attachments` 由调用方保证非 undefined（generate_image 工具经 `ctx.inject` 注入），
 * 此处不做运行时回退——依赖关系在调用栈上游即已明确。
 * @param attachments - attachment 服务实例。
 * @param data - 图片字节。
 * @param contentType - 图片 Content-Type。
 * @param name - 显示名称。
 * @returns 模型可见的 ContentBlock 数组。
 */
export async function createImageContent(
  attachments: AttachmentStore,
  data: Uint8Array,
  contentType: string,
  name: string,
): Promise<ContentBlock[]> {
  const mediaType = toImageMediaType(contentType)
  const ref: ImageAttachmentRef = await attachments.saveImage({ data, mediaType, name })
  return [{ type: 'image', attachment: ref }]
}

/**
 * 创建视频渲染块。DSH 无原生视频内容块，
 * 返回文本块含本地文件路径，供用户点击打开。
 */
export function createVideoContent(localPath: string, bytes: number, sourceUrl: string): ContentBlock[] {
  const sizeKb = (bytes / 1024).toFixed(1)
  return [{
    type: 'text',
    text: `视频已生成并保存到本地：\n- 文件路径：${localPath}\n- 文件大小：${sizeKb} KB\n- 源地址：${sourceUrl}\n\n请用本地播放器打开上述文件路径查看视频。`,
  }]
}
