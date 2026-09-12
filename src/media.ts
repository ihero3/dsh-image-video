/**
 * 媒体渲染与输出模块：下载生成结果到 outputs/ 目录。
 * 图片字节经 attachment 服务持久化，附件引用走 presentationMeta（UI-only 通道），
 * 模型只接收文本摘要；视频返回本地文件链接。
 * @module dsh-image-video/media
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
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

/**
 * 保存服务商直接返回的 base64 图片字节（MiniMax image_generation 等同步接口
 * 无 URL 可下载，响应体即 base64）。文件命名与 downloadAndSave 对齐。
 * @param base64 - 裸 base64 字符串（不带 data: 前缀）。
 * @param mediaType - 图片 MIME 类型（image/png / image/jpeg 等）。
 * @param outputsDir - 配置的输出目录。
 * @returns 保存结果（sourceUrl 为空字符串——无下载来源）。
 */
export async function saveBase64Image(base64: string, mediaType: string, outputsDir: string): Promise<MediaSaveResult> {
  const data = Buffer.from(base64, 'base64')
  const dir = resolve(outputsDir)
  await mkdir(dir, { recursive: true })
  const ext = extFromContentType(mediaType, '.png')
  const filename = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`
  const localPath = resolve(dir, filename)
  await writeFile(localPath, data)
  return { localPath, sourceUrl: '', contentType: mediaType, bytes: data.byteLength, data }
}

/** 从扩展名推断图片 MIME 类型；未知扩展名回退 image/png，由服务商对无法识别的字节响亮报错。 */
export function imageMimeFromPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.gif': return 'image/gif'
    case '.bmp': return 'image/bmp'
    default: return 'image/png'
  }
}

/**
 * 解析 generate_video 的 image 入参为服务商可直接消费的图片引用。
 * http(s) URL 与 data URL 原样返回；其余按本地文件路径读取并编码为 data URL。
 * @param input - http(s) URL、data URL 或本地文件路径。
 * @returns 服务商可直接消费的图片引用。
 * @throws 本地路径不存在或不可读时原样抛出 Node fs 错误。
 */
export async function resolveImageReference(input: string): Promise<string> {
  const ref = input.trim()
  if (/^(https?|data):/.test(ref)) return ref
  const data = await readFile(ref)
  return `data:${imageMimeFromPath(ref)};base64,${data.toString('base64')}`
}

/** 从 Content-Type 推断图片媒体类型（attachment 服务要求精确类型）。 */
export function toImageMediaType(contentType: string): ImageMediaType {
  return toImageMediaTypeForTest(contentType)
}

/** 单元测试导出：实现与 toImageMediaType 相同，测试直接调用避免类型依赖循环。 */
export function toImageMediaTypeForTest(contentType: string): ImageMediaType {
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
 * 保存图片字节到 attachment 服务，返回可被 presentationMeta 引用的附件引用。
 * `attachments` 由调用方保证非 undefined（generate_image 工具经 `ctx.inject` 注入），
 * 此处不做运行时回退——依赖关系在调用栈上游即已明确。
 *
 * 图片不再作为模型可见的 image ContentBlock 注入工具结果：纯文本模型无法接收
 * image 块（llm 适配器会序列化成 image_url，网关不支持时 400）。附件引用改为
 * 经 `output.presentationMeta` 走 UI-only 通道持久化，对模型不可见。
 * @param attachments - attachment 服务实例。
 * @param data - 图片字节。
 * @param contentType - 图片 Content-Type。
 * @param name - 显示名称。
 * @returns 持久化后的图片附件引用。
 */
export async function saveImageAttachment(
  attachments: AttachmentStore,
  data: Uint8Array,
  contentType: string,
  name: string,
): Promise<ImageAttachmentRef> {
  const mediaType = toImageMediaType(contentType)
  return attachments.saveImage({ data, mediaType, name })
}

/** 模型可见的图片摘要文本所需的输出字段。 */
export interface ImageSummaryFields {
  provider: string
  localPath: string
  bytes: number
  width?: number
  height?: number
  /** 实际使用的提示词；标准输出的一部分，让结果自证「这张图是怎么来的」。 */
  prompt?: string
  /** 生成模式：text-to-image / image-to-image。 */
  mode?: string
  /** 实际使用的模型名（含适配器内置默认）；留空则显示「服务商内置默认」。 */
  model?: string
  /** 透明告知条目（路由回退等）；无则省略。 */
  notes?: string[]
}

/**
 * 构造模型可见的图片生成摘要文本（纯文本，不含图片字节）。
 * 标准输出固定包含：提示词、服务商、**实际使用的模型**、尺寸与透明告知——
 * 「这张图怎么来的、用了谁」直接看结果即可，无需查配置或服务商后台。
 * @param fields - 生成输出中的展示字段。
 * @returns 供工具结果 render 返回的文本块。
 */
export function createImageSummaryText(fields: ImageSummaryFields): ContentBlock[] {
  const size = fields.width !== undefined && fields.height !== undefined
    ? `${fields.width}×${fields.height}`
    : '未知尺寸'
  const model = fields.model && fields.model.length > 0 ? fields.model : '服务商内置默认'
  const mode = fields.mode ? `，模式：${fields.mode === 'image-to-image' ? '图生图' : '文生图'}` : ''
  const promptBlock = fields.prompt && fields.prompt.length > 0 ? `\n提示词：${fields.prompt}` : ''
  const notesBlock = fields.notes && fields.notes.length > 0
    ? `\n透明告知：\n${fields.notes.map((note) => `- ${note}`).join('\n')}`
    : ''
  return [{
    type: 'text',
    text: `图片已生成并保存到本地：${fields.localPath}（服务商：${fields.provider}，模型：${model}${mode}，尺寸：${size}，大小：${(fields.bytes / 1024).toFixed(1)} KB）${promptBlock}${notesBlock}`,
  }]
}

/** 视频摘要文本的展示字段（全部可选，缺省即省略对应行）。 */
export interface VideoSummaryDetails {
  /** 实际使用的提示词；标准输出的一部分，让结果自证「这条视频是怎么来的」。 */
  prompt?: string
  /** 实际命中并提交的服务商。 */
  provider?: string
  /** 实际发给上游的模型名（含适配器内置默认）。 */
  model?: string
  /** 生成模式：图生视频 / 文生视频。 */
  mode?: string
  /** 请求携带的时长参数（秒）。 */
  duration?: number
  /** 请求携带的分辨率档位。 */
  resolution?: string
  /** 透明告知条目（时长被丢弃、候选回退链等）。 */
  notes?: string[]
}

/**
 * 创建视频渲染块。DSH 无原生视频内容块，
 * 返回文本块含本地文件路径，供用户点击打开；同时把**提示词、服务商、实际模型、
 * 透明告知**写进可见文本，与客户端 keyed toolview 的内嵌播放器（消费
 * presentationMeta.localPath/prompt）共同构成固定标准输出：
 * 「提示词 + 播放器 + 结果块」，任何人安装插件即可见，无需任何配置。
 * @param localPath - 落地文件路径。
 * @param bytes - 文件字节数。
 * @param sourceUrl - 上游源地址。
 * @param details - 展示字段（提示词/服务商/模型/模式/时长/分辨率/透明告知）。
 */
export function createVideoContent(
  localPath: string,
  bytes: number,
  sourceUrl: string,
  details: VideoSummaryDetails = {},
): ContentBlock[] {
  const sizeKb = (bytes / 1024).toFixed(1)
  const model = details.model && details.model.length > 0 ? details.model : '服务商内置默认'
  const lines = [
    '视频已生成并保存到本地：',
    `- 文件路径：${localPath}`,
    `- 文件大小：${sizeKb} KB`,
    ...(details.prompt && details.prompt.length > 0 ? [`- 提示词：${details.prompt}`] : []),
    ...(details.provider ? [`- 服务商：${details.provider}`] : []),
    `- 模型：${model}`,
    ...(details.mode ? [`- 生成模式：${details.mode}`] : []),
    ...(details.duration !== undefined ? [`- 时长参数：${details.duration} 秒`] : []),
    ...(details.resolution ? [`- 分辨率：${details.resolution}`] : []),
    `- 源地址：${sourceUrl}`,
  ]
  const notesBlock = details.notes && details.notes.length > 0
    ? `\n\n透明告知：\n${details.notes.map((note) => `- ${note}`).join('\n')}`
    : ''
  return [{
    type: 'text',
    text: `${lines.join('\n')}${notesBlock}\n\n请用本地播放器打开上述文件路径查看视频。`,
  }]
}
