/**
 * Threerouter 适配器：基于 threerouter.com 统一媒体生成 API。
 * 生图（文生图 + 图生图）统一走 POST /images/generations（服务端 2026-09 更新：
 * /images/edits 已从端点表移除，参考图经 `image` 字段传入，同步返回 OpenAI 标准结构
 * data[0].url / b64_json，同时兼容统一入口的顶层 url / urls 形态）；
 * 视频走 POST /media/generations 创建 → GET /media/{id} 轮询 → GET /media/{id}/content 下载，
 * 请求显式携带 media_kind=video。鉴权统一 Bearer Token。
 * @module dsh-image-video/providers/threerouter
 */

import { request, downloadMedia } from '../http-client.ts'
import { VIDEO_DURATION_UNSUPPORTED, VIDEO_MODEL_DEFAULT_RESOLUTION } from '../runtime-defaults.ts'
import type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult, HttpOpts } from './types.ts'
import { toRequestOpts, normalizeImageSize, aliImageSize } from './types.ts'

/** Threerouter 默认文生图模型（千问图像 3.0，服务端模态注册表收录；旧默认 wan2.1-image 未收录会按文本派发）。 */
const DEFAULT_IMAGE_MODEL = 'qwen-image-3.0'
/** Threerouter 图生图默认模型（千问图像 3.0 Pro，支持 image 参考图入参，文档快速上手示例同款）。 */
const DEFAULT_IMAGE_EDIT_MODEL = 'qwen-image-3.0-pro'
/** Threerouter 默认文生视频模型（MiniMax 系，支持 4-15 秒自定义时长）。账号可用模型见 threerouter.com 控制台。 */
const DEFAULT_VIDEO_MODEL = 'minimax-h3'

/** Threerouter /images/generations 响应：OpenAI 标准结构（data[0]），兼容统一入口顶层 url / urls 形态。 */
interface ThreerouterImagesResponse {
  data?: Array<{ url?: string; b64_json?: string }>
  url?: string
  urls?: string[]
  id?: string
  status?: string
  error?: unknown
}

/**
 * 阿里系（千问/万相）模型判定：这些上游要求 `宽*高` 原生格式，比例写法需在
 * 客户端换算（共享 aliImageSize，见 types.ts）；其余模型保持 `*`→`x` 归一化。
 */
function isAliNativeImageModel(model: string): boolean {
  return /qwen|wan/i.test(model)
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
 * 提交图片任务（文生图 + 图生图统一端点 /images/generations，同步返回）。
 * 参考图经 `image` 字段传入（data URL 或公网 URL，服务端亦接受 image_url / image_urls
 * 数组形态，此处用最简的单字符串形态）；响应兼容 OpenAI 标准结构（data[0].url /
 * b64_json）、统一入口顶层 url / urls、失败形态（status:'failed' + error）与异步
 * 任务形态（status:'processing' + id，交由工具层轮询 GET /media/{id}）。
 * size：qwen 系按上游要求归一化为 `宽*高`（实测 `3:4` 原样透传会被 400），
 * 其余模型 `*`→`x`（配置默认值为百炼风格）；超时对齐官方建议抬到 ≥600s
 * （千问图像 prompt_extend + 思考模式实测约 5 分钟出图）。
 */
async function submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/images/generations`
  const effectiveModel = params.model ?? (params.image ? DEFAULT_IMAGE_EDIT_MODEL : DEFAULT_IMAGE_MODEL)
  const body: Record<string, unknown> = {
    model: effectiveModel,
    prompt: params.prompt,
    n: 1,
    response_format: 'url',
    ...(params.image ? { image: params.image } : {}),
    ...(params.size
      ? { size: isAliNativeImageModel(effectiveModel) ? aliImageSize(params.size) : normalizeImageSize(params.size) }
      : {}),
  }
  const reqOpts = toRequestOpts('POST', url, threerouterHeaders(opts.apiKey), body, opts)
  reqOpts.timeoutMs = Math.max(reqOpts.timeoutMs, 600_000)
  const data = await request(reqOpts) as ThreerouterImagesResponse
  const first = data?.data?.[0]
  const topLevelUrl = data?.url ?? (Array.isArray(data?.urls) ? data.urls[0] : undefined)
  const mediaUrl = first?.url ?? (typeof topLevelUrl === 'string' && topLevelUrl !== '' ? topLevelUrl : undefined)
  const base = { taskId: '', async: false, mediaType: 'image' as const, model: effectiveModel }
  if (mediaUrl) return { ...base, mediaUrl }
  if (first?.b64_json) return { ...base, mediaBase64: { data: first.b64_json, mediaType: 'image/png' } }
  const errMsg = typeof data?.error === 'string'
    ? data.error
    : data?.error !== null && typeof data?.error === 'object' && typeof (data.error as { message?: unknown }).message === 'string'
      ? (data.error as { message: string }).message
      : ''
  // 统一入口失败形态（2026-09-14 实测）：{id, status:'failed', error:'minimax 1026: input new_sensitive'}
  if (data?.status === 'failed') throw new Error(`Threerouter 生图：上游失败。${errMsg}`)
  // 异步任务形态：{id, status:'processing'} → 交由工具层轮询 GET /media/{id}
  if (data?.id && (!data.status || data.status === 'processing' || data.status === 'pending')) {
    return { taskId: data.id, async: true, mediaType: 'image', model: effectiveModel }
  }
  throw new Error(params.image ? 'Threerouter 图生图：响应未包含图片数据' : 'Threerouter 文生图：响应未包含图片数据')
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
  const reqOpts = toRequestOpts('POST', url, threerouterHeaders(opts.apiKey), body, opts)
  // 2026-09-14 实测：网关高峰期提交响应可超过 1 分钟（60s 超时连续两次），
  // 提交（非轮询）超时抬到 ≥300s，避免排队慢时误报失败。
  reqOpts.timeoutMs = Math.max(reqOpts.timeoutMs, 300_000)
  const data = await request(reqOpts) as ThreerouterTaskResponse
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
