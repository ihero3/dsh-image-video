/**
 * Threerouter 适配器：基于 threerouter.com 统一媒体生成 API。
 * 文生图与视频统一走 POST /media/generations 创建 → GET /media/{id} 轮询 → GET /media/{id}/content 下载，
 * 请求显式携带 media_kind（image/video），不依赖模型名推断；图生图走
 * OpenAI Images 风格的专用端点 POST /images/edits（JSON images[].image_url，
 * 支持 data URL / 公网 URL，不支持 file_id）。鉴权统一 Bearer Token。
 * @module dsh-image-video/providers/threerouter
 */

import { request, downloadMedia } from '../http-client.ts'
import { VIDEO_DURATION_UNSUPPORTED, VIDEO_MODEL_DEFAULT_RESOLUTION } from '../runtime-defaults.ts'
import type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult, HttpOpts } from './types.ts'
import { toRequestOpts, normalizeImageSize } from './types.ts'

/** Threerouter 默认文生图模型。 */
const DEFAULT_IMAGE_MODEL = 'wan2.1-image'
/** Threerouter 图生图默认模型（/images/edits 端点，官方文档标注支持文生图 + 图生图的默认模型）。 */
const DEFAULT_IMAGE_EDIT_MODEL = 'gpt-image-2'
/** Threerouter 默认文生视频模型（MiniMax 系，支持 4-15 秒自定义时长）。账号可用模型见 threerouter.com 控制台。 */
const DEFAULT_VIDEO_MODEL = 'minimax-h3'

/** Threerouter /images/edits（OpenAI Images 风格）响应：url 或 b64_json 二选一。 */
interface ThreerouterImagesResponse {
  data?: Array<{ url?: string; b64_json?: string }>
}

/** Threerouter API 请求头。 */
function threerouterHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

/** 从失败响应中提取错误信息，兼容 string 与对象两种形态。 */
function extractTaskError(error: unknown): string {
  if (typeof error === 'string' && error.length > 0) return error
  if (error !== null && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
  }
  return 'Threerouter 任务执行失败'
}

/**
 * 提交图片任务：带参考图走 /images/edits（图生图/编辑），否则走 /media/generations（文生图，
 * media_kind=image 显式指定，不依赖模型名推断）。
 */
async function submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult> {
  if (params.image) return submitImageEdit(params, opts)
  const url = `${opts.baseURL}/media/generations`
  const effectiveModel = params.model ?? DEFAULT_IMAGE_MODEL
  const body: Record<string, unknown> = {
    model: effectiveModel,
    prompt: params.prompt,
    media_kind: 'image',
  }
  const data = await request(toRequestOpts('POST', url, threerouterHeaders(opts.apiKey), body, opts)) as ThreerouterTaskResponse
  if (!data?.id) throw new Error('Threerouter 文生图：未返回任务 ID')
  return { taskId: data.id, async: true, mediaType: 'image', model: effectiveModel }
}

/**
 * 提交图生图/编辑任务（OpenAI Images 风格 /images/edits，同步返回）。
 * 参考图经 images[].image_url 传入（data URL 或公网 URL）；尺寸分隔符归一化为
 * `宽x高`（配置默认值为百炼风格的 `*`）；响应 url / b64_json 双形态兼容。
 */
async function submitImageEdit(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/images/edits`
  const effectiveModel = params.model ?? DEFAULT_IMAGE_EDIT_MODEL
  const body: Record<string, unknown> = {
    model: effectiveModel,
    prompt: params.prompt,
    images: [{ image_url: params.image }],
    size: normalizeImageSize(params.size),
    response_format: 'url',
  }
  const data = await request(toRequestOpts('POST', url, threerouterHeaders(opts.apiKey), body, opts)) as ThreerouterImagesResponse
  const first = data?.data?.[0]
  const base = { taskId: '', async: false, mediaType: 'image' as const, model: effectiveModel }
  if (first?.url) return { ...base, mediaUrl: first.url }
  if (first?.b64_json) return { ...base, mediaBase64: { data: first.b64_json, mediaType: 'image/png' } }
  throw new Error('Threerouter 图生图：响应未包含图片数据')
}

/**
 * 提交视频任务（media_kind=video）。存在 image 时为首帧驱动的图生视频，
 * 请求携带 image 字段（服务端按此字段路由到图生视频通道），此时构图由首帧决定，不再传 ratio；
 * 纯文生时保持 ratio。resolution 为可选分辨率档位，MiniMax 系要求显式携带（缺失时上游 400），
 * 未指定时注入模型默认档位；wan 系模型不支持自定义时长，命中能力表时丢弃 duration
 * （SubmitResult.droppedDuration 标记，结果层在 notes 注明）。
 */
async function submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/media/generations`
  const effectiveModel = params.model ?? DEFAULT_VIDEO_MODEL
  const body: Record<string, unknown> = {
    model: effectiveModel,
    prompt: params.prompt,
    media_kind: 'video',
  }
  const droppedDuration = VIDEO_DURATION_UNSUPPORTED.has(effectiveModel)
  if (!droppedDuration) {
    body.duration = params.duration
  }
  if (params.image) {
    body.image = params.image
  } else if (params.aspectRatio) {
    body.ratio = params.aspectRatio
  }
  const resolution = params.resolution ?? VIDEO_MODEL_DEFAULT_RESOLUTION[effectiveModel]
  if (resolution) {
    body.resolution = resolution
  }
  const data = await request(toRequestOpts('POST', url, threerouterHeaders(opts.apiKey), body, opts)) as ThreerouterTaskResponse
  if (!data?.id) throw new Error('Threerouter 文生视频：未返回任务 ID')
  return { taskId: data.id, async: true, mediaType: 'video', model: effectiveModel, ...(droppedDuration ? { droppedDuration } : {}) }
}

/** 查询异步任务状态。完成后优先使用响应 url，缺失时回退 /content 302 端点。 */
async function queryTask(taskId: string, opts: HttpOpts): Promise<TaskQueryResult> {
  const url = `${opts.baseURL}/media/${taskId}`
  const data = await request(toRequestOpts('GET', url, threerouterHeaders(opts.apiKey), undefined, opts)) as ThreerouterQueryResponse
  switch (data?.status) {
    case 'processing':
      return { status: 'running' }
    case 'succeeded': {
      const mediaUrl = typeof data.url === 'string' && data.url.length > 0
        ? data.url
        : `${opts.baseURL}/media/${taskId}/content`
      return { status: 'succeeded', mediaUrl }
    }
    case 'failed':
      return { status: 'failed', error: extractTaskError(data.error) }
    case 'cancelled':
      return { status: 'failed', error: 'Threerouter 任务已取消' }
    default:
      return { status: 'failed', error: `Threerouter 未知任务状态: ${data?.status ?? '空'}` }
  }
}

/** Threerouter 任务提交响应。 */
interface ThreerouterTaskResponse {
  id?: string
  status?: string
  model?: string
  created_at?: string
}

/** Threerouter 任务查询响应。 */
interface ThreerouterQueryResponse {
  id?: string
  status?: string
  url?: string
  thumbnail_url?: string
  error?: unknown
}

/** Threerouter 适配器实例：统一入口同时支持文生图与文生视频。 */
export const threerouterAdapter: ProviderAdapter = {
  submitImage,
  submitVideo,
  queryTask,
}

/** 复用 downloadMedia。 */
export { downloadMedia }
