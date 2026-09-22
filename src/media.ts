/**
 * 媒体渲染与输出模块：下载生成结果到 outputs/ 目录。
 * 图片字节经 attachment 服务持久化，附件引用走 presentationMeta（UI-only 通道），
 * 模型只接收文本摘要；视频返回本地文件链接。
 * @module dsh-image-video/media
 */

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ImageAttachmentRef, ImageMediaType, AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import { downloadMedia } from './http-client.ts'
import type { HttpOpts } from './providers/types.ts'

/** 媒体保存结果。 */
export interface MediaSaveResult {
  /** outputs/ 下的绝对文件路径。 */
  localPath: string
  /** 媒体下载 URL（服务商直回 base64 时为空串）。 */
  sourceUrl: string
  /** 媒体类型（image/png 等）。 */
  contentType: string
  /** 文件大小（字节）。 */
  bytes: number
  /** 落盘字节，供 attachment 服务复用。 */
  data: Uint8Array
}

/**
 * 把配置里的 outputsDir 解析为**绝对路径**。插件只在 apply() 里调用一次，
 * 之后所有落盘（生成、下载、水印后处理）与只读 media 路由都使用同一个解析结果，
 * 从根本上杜绝「模型结果在 A 目录、后处理结果在 B 目录」这类旁路产物。
 * @param outputsDir - 配置值（可为相对路径）。
 * @returns 绝对目录路径。
 */
export function resolveOutputsDir(outputsDir: string): string {
  return resolve(outputsDir)
}

/**
 * 把最终媒体字节写入 outputsDir（唯一落盘入口）。
 *
 * 「唯一入口」是刻意的设计约束：图片生成的后处理（水印）在内存里完成后再调用
 * 本函数，因此磁盘上只可能出现一份文件、且内容就是最终结果——交互流展示的
 * 附件与本地文件必然一致。
 * @param data - 最终字节。
 * @param contentType - 最终 MIME 类型。
 * @param outputsDir - 输出目录（绝对路径，见 resolveOutputsDir）。
 * @param fallbackExt - Content-Type 无法识别时的扩展名。
 * @param sourceUrl - 上游来源地址（base64 形态留空）。
 * @returns 保存结果。
 */
export async function writeOutputFile(
  data: Uint8Array,
  contentType: string,
  outputsDir: string,
  fallbackExt: string,
  sourceUrl = '',
): Promise<MediaSaveResult> {
  const dir = resolve(outputsDir)
  await mkdir(dir, { recursive: true })
  const ext = extFromContentType(contentType, fallbackExt)
  const filename = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`
  const localPath = resolve(dir, filename)
  await writeFile(localPath, data)
  return { localPath, sourceUrl, contentType, bytes: data.byteLength, data }
}

/** 下载媒体字节到内存（不落盘）。后处理链路的第一步。 */
export async function fetchMediaBytes(
  url: string,
  opts: Pick<HttpOpts, 'timeoutMs' | 'retryTimes' | 'signal'>,
): Promise<{ data: Uint8Array; contentType: string }> {
  return await downloadMedia(url, opts)
}

/** 解码服务商直接返回的 base64 图片为内存字节（不落盘）。 */
export function decodeBase64Media(base64: string, mediaType: string): { data: Uint8Array; contentType: string } {
  return { data: new Uint8Array(Buffer.from(base64, 'base64')), contentType: mediaType }
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
  return await writeOutputFile(data, contentType, outputsDir, fallbackExt, url)
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
  const { data, contentType } = decodeBase64Media(base64, mediaType)
  return await writeOutputFile(data, contentType, outputsDir, '.png')
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

const execFileAsync = promisify(execFile)
/** 首帧压缩阈值：data URL 解码后字节数超过该值才压缩（小图直接提交）。 */
const FIRST_FRAME_COMPRESS_THRESHOLD = 1_500_000
/** 压缩后长边上限：视频输出最高 768P~2K，长边 1600 绰绰有余。 */
const FIRST_FRAME_LONG_EDGE = 1600

/**
 * 视频首帧压缩：超大的本地图片 data URL 在提交前经 ffmpeg 缩放转 JPEG。
 * 实测（2026-09-14）：~3MB 原图转 data URL 提交会被网关长时间消化直至提交超时，
 * 压到 ~150KB 后秒收；视频输出本就 ≤768P/1080P，压图不损观感。
 * 仅处理 data:image/ 形态且解码后超过阈值的引用；ffmpeg 不可用或执行失败时
 * 原样返回（不阻塞提交，只是慢），http(s) URL 不处理。
 */
export async function compressVideoFirstFrame(ref: string): Promise<string> {
  if (!ref.startsWith('data:image/')) return ref
  const commaIdx = ref.indexOf(',')
  if (commaIdx < 0) return ref
  const header = ref.slice(0, commaIdx)
  const b64 = ref.slice(commaIdx + 1)
  if (Math.floor(b64.length * 3 / 4) <= FIRST_FRAME_COMPRESS_THRESHOLD) return ref
  const inExt = header.includes('jpeg') || header.includes('jpg') ? '.jpg'
    : header.includes('webp') ? '.webp' : '.png'
  const dir = tmpdir()
  const inPath = join(dir, `dsh-frame-${randomBytes(6).toString('hex')}${inExt}`)
  const outPath = join(dir, `dsh-frame-${randomBytes(6).toString('hex')}.jpg`)
  try {
    await writeFile(inPath, Buffer.from(b64, 'base64'))
    await execFileAsync('ffmpeg', [
      '-y', '-v', 'error', '-i', inPath,
      '-vf', `scale='min(${FIRST_FRAME_LONG_EDGE},iw)':-2`,
      '-q:v', '3', outPath,
    ])
    const out = await readFile(outPath)
    if (out.byteLength === 0) return ref
    return `data:image/jpeg;base64,${out.toString('base64')}`
  } catch {
    // ffmpeg 缺失或执行失败：原样返回，交由上层按原尺寸提交
    return ref
  } finally {
    await unlink(inPath).catch(() => {})
    await unlink(outPath).catch(() => {})
  }
}

/** 参考视频压缩阈值：本地视频超过该字节数时先经 ffmpeg 转码再编码为 data URL。 */
const REFERENCE_VIDEO_COMPRESS_THRESHOLD = 2_000_000
/** 参考视频原始字节上限：超出后不再提交（threerouter 无上传端点，巨型请求体会被网关拒绝）。 */
const REFERENCE_VIDEO_MAX_BYTES = 6_000_000
/** 参考视频长边上限：产出最高 1080P，参考段压到 720p 档足够表达动作与构图。 */
const REFERENCE_VIDEO_LONG_EDGE = 1280
/** 参考视频时长上限（秒）：wan3.0-video 的 reference_video 要求单段不超过 15 秒。 */
const REFERENCE_VIDEO_MAX_SECONDS = 15

/** 从扩展名推断视频 MIME；未知扩展名回退 video/mp4（wan3.0-video 只接受 mp4 参考段）。 */
export function videoMimeFromPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.webm': return 'video/webm'
    case '.mov': return 'video/quicktime'
    default: return 'video/mp4'
  }
}

/**
 * 参考视频 ffmpeg 转码：裁到 {@link REFERENCE_VIDEO_MAX_SECONDS} 秒内、长边压到
 * {@link REFERENCE_VIDEO_LONG_EDGE}、CRF 32。ffmpeg 缺失或执行失败返回原字节，
 * 由上游体积上限兜底拒绝（不静默提交巨型请求体）。
 */
async function compressReferenceVideo(bytes: Buffer, sourcePath: string): Promise<Buffer> {
  const dir = tmpdir()
  const inPath = join(dir, `dsh-refvid-${randomBytes(6).toString('hex')}${extname(sourcePath) || '.mp4'}`)
  const outPath = join(dir, `dsh-refvid-${randomBytes(6).toString('hex')}.mp4`)
  try {
    await writeFile(inPath, bytes)
    await execFileAsync('ffmpeg', [
      '-y', '-v', 'error', '-i', inPath,
      '-t', String(REFERENCE_VIDEO_MAX_SECONDS),
      '-vf', `scale='min(${REFERENCE_VIDEO_LONG_EDGE},iw)':-2`,
      '-c:v', 'libx264', '-crf', '32', '-preset', 'veryfast',
      '-c:a', 'aac', '-b:a', '96k',
      outPath,
    ])
    const out = await readFile(outPath)
    return out.byteLength > 0 ? out : bytes
  } catch {
    // ffmpeg 缺失或转码失败：保留原字节，交由体积上限判定
    return bytes
  } finally {
    await unlink(inPath).catch(() => {})
    await unlink(outPath).catch(() => {})
  }
}

/**
 * 解析参考视频为服务商可直接消费的引用：http(s) URL 原样透传；本地文件读取后按需
 * 转码并编码为 data URL。threerouter 没有上传端点（2026-09-22 探测 /v1/files 等全 404），
 * 本地视频只能以 data URL 提交，而网关对超大请求体会拒绝，因此在客户端完成压缩。
 * @param input - http(s) URL、data URL 或本地文件路径。
 * @returns 适配器可直接消费的参考视频引用。
 * @throws 本地文件超过 {@link REFERENCE_VIDEO_MAX_BYTES} 时抛错，避免提交必然失败的巨型请求体。
 */
export async function resolveReferenceVideo(input: string): Promise<string> {
  const ref = input.trim()
  if (/^(https?|data):/.test(ref)) return ref
  const original = await readFile(ref)
  const payload = original.byteLength > REFERENCE_VIDEO_COMPRESS_THRESHOLD
    ? await compressReferenceVideo(original, ref)
    : original
  if (payload.byteLength > REFERENCE_VIDEO_MAX_BYTES) {
    const mb = (payload.byteLength / 1024 / 1024).toFixed(1)
    throw new Error(
      `参考视频体积 ${mb}MB 超过 ${REFERENCE_VIDEO_MAX_BYTES / 1024 / 1024}MB 上限：`
      + 'threerouter 无上传端点，本地视频只能以 data URL 提交，过大的请求体会被网关拒绝。'
      + '请先裁短/压缩该视频（建议 ≤15 秒、720p 以内），或改传公网 http(s) URL。',
    )
  }
  return `data:${videoMimeFromPath(ref)};base64,${payload.toString('base64')}`
}

/** 参考素材条目：image（参考图）与 video（参考视频）二选一，type 显式指定时优先。 */
export interface VideoMediaInput {
  /** 参考图：本地路径 / http(s) URL / data URL。 */
  image?: string
  /** 参考视频：本地路径 / http(s) URL / data URL；对应上游 type=reference_video。 */
  video?: string
  /** 显式素材类型（first_frame / last_frame / reference_image / reference_video）；缺省按字段与 position 推断。 */
  type?: string
  /** 兼容旧入参的时间点写法（'0s' / 'first_frame' / 'last_frame'）。 */
  position?: string
}

/**
 * 视频参考素材解析：把工具参数数组解析为适配器可直接消费的 `{url, type}` 形态。
 * 图片先压缩再编码为 data URL（已有 data URL 跳过压缩），视频经
 * {@link resolveReferenceVideo} 处理；参考视频用于 wan3.0-video 的视频编辑
 * （原片动作 + 自然语言指令替换主体/元素）。
 * @param ms - 原始媒体数组。
 * @returns 适配器可直接消费的媒体数组。
 * @throws 条目既无 image 也无 video 时抛错，避免静默丢素材。
 */
export async function resolveVideoMedia(
  ms: VideoMediaInput[],
): Promise<Array<{ url: string; type: string }>> {
  return await Promise.all(ms.map(async (m) => {
    const video = typeof m.video === 'string' && m.video.trim() !== '' ? m.video : undefined
    if (video !== undefined) {
      return { url: await resolveReferenceVideo(video), type: m.type ?? 'reference_video' }
    }
    const image = typeof m.image === 'string' && m.image.trim() !== '' ? m.image : undefined
    if (image === undefined) {
      throw new Error('media 条目必须提供 image（参考图）或 video（参考视频）之一')
    }
    const position = m.position?.toLowerCase()
    const type = m.type ?? (position === 'first_frame' || position === '0s'
      ? 'first_frame'
      : position === 'last_frame' ? 'last_frame' : 'reference_image')
    return { url: await compressVideoFirstFrame(await resolveImageReference(image)), type }
  }))
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
  /** 透明告知条目（路由回退、传输降级、找回等）；无则省略。 */
  notes?: string[]
  /** 后处理链路（如 `品牌水印 Threerouter`）；无后处理时省略。 */
  postprocess?: string[]
  /** 本次生成事务的物理提交次数：正常恒为 1，是「没有重复生成」的自证字段。 */
  submitAttempts?: number
  /** 提交传输方式（async / sync）。 */
  transport?: string
  /** 生成事务幂等键（request_id），超时找回的唯一凭据。 */
  requestId?: string
}

/**
 * 构造模型可见的图片生成摘要文本（纯文本，不含图片字节）。
 * 标准输出固定包含：提示词、服务商、**实际使用的模型**、尺寸、提交次数、
 * 传输方式、后处理与透明告知——「这张图怎么来的、用了谁、提交了几次、
 * 有没有打水印」直接看结果即可，无需查配置或服务商后台。
 * @param fields - 生成输出中的展示字段。
 * @returns 供工具结果 render 返回的文本块。
 */
export function createImageSummaryText(fields: ImageSummaryFields): ContentBlock[] {
  const size = fields.width !== undefined && fields.height !== undefined
    ? `${fields.width}×${fields.height}`
    : '未知尺寸'
  const model = fields.model && fields.model.length > 0 ? fields.model : '服务商内置默认'
  const mode = fields.mode ? `，模式：${fields.mode === 'image-to-image' ? '图生图' : '文生图'}` : ''
  const submit = fields.submitAttempts === undefined ? '' : `，提交次数：${fields.submitAttempts}`
  const transport = fields.transport === undefined ? '' : `，传输：${fields.transport}`
  const postprocess = fields.postprocess && fields.postprocess.length > 0
    ? `，后处理：${fields.postprocess.join(' + ')}`
    : ''
  const promptBlock = fields.prompt && fields.prompt.length > 0 ? `\n提示词：${fields.prompt}` : ''
  const requestBlock = fields.requestId === undefined ? '' : `\nrequest_id：${fields.requestId}`
  const notesBlock = fields.notes && fields.notes.length > 0
    ? `\n透明告知：\n${fields.notes.map((note) => `- ${note}`).join('\n')}`
    : ''
  return [{
    type: 'text',
    text: `图片已生成并保存到本地：${fields.localPath}（服务商：${fields.provider}，模型：${model}${mode}，`
      + `尺寸：${size}，大小：${(fields.bytes / 1024).toFixed(1)} KB${submit}${transport}${postprocess}）`
      + `${promptBlock}${requestBlock}${notesBlock}`,
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
