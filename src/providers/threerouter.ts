/**
 * Threerouter 适配器：基于 threerouter.com 统一媒体生成 API。
 * 生图（文生图 + 图生图）两条传输：
 *   1. 异步（推荐，`imageTransport: async`）——POST /images/generations/async 返回
 *      202 + task_id，GET /images/tasks/{task_id} 轮询，响应丢失时
 *      GET /images/generations/by-request/{request_id} 凭幂等键找回原任务。
 *      提交携带 `Idempotency-Key`，服务端保证同一键只创建一次任务。
 *   2. 同步（`imageTransport: sync` / 异步端点在本环境不可用时降级）——
 *      POST /images/generations 直接返回 OpenAI 标准结构 data[0].url / b64_json，
 *      兼容统一入口顶层 url / urls 形态。同步路径无幂等保证，因此**永不自动重提**。
 * 视频走 POST /media/generations 创建 → GET /media/{id} 轮询 → GET /media/{id}/content 下载，
 * 请求显式携带 media_kind=video。鉴权统一 Bearer Token。
 * 服务端契约见 docs/threerouter-async-image-contract.md。
 * @module dsh-image-video/providers/threerouter
 */

import { request, requestFull, parseRetryAfterMs, GenerationError, downloadMedia } from '../http-client.ts'
import type { RequestResult } from '../http-client.ts'
import { VIDEO_DURATION_UNSUPPORTED, VIDEO_MODEL_DEFAULT_RESOLUTION } from '../runtime-defaults.ts'
import type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult, HttpOpts, AsyncImageSubmit } from './types.ts'
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

/**
 * 幂等键请求头。服务端契约：`Idempotency-Key` 头优先于 body 的 `request_id`。
 * 客户端只发头、不发 body 字段——同步端点的请求体会原样转发上游，而 OpenAI 系
 * 上游对未知顶层参数是严格拒绝的（`Unrecognized request argument`），
 * 只有异步端点会在下发前摘掉 `request_id`。
 */
function threerouterHeaders(apiKey: string, requestId?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...(requestId ? { 'Idempotency-Key': requestId } : {}),
  }
}

/**
 * 生图请求体：同步 `/images/generations` 与异步 `/images/generations/async`
 * 使用完全相同的 payload（服务端契约：异步端点接受与同步端点同样的请求体）。
 */
function imageRequestBody(params: ImageGenParams, effectiveModel: string): Record<string, unknown> {
  return {
    model: effectiveModel,
    prompt: params.prompt,
    n: 1,
    response_format: 'url',
    ...(params.image ? { image: params.image } : {}),
    ...(params.size
      ? { size: isAliNativeImageModel(effectiveModel) ? aliImageSize(params.size) : normalizeImageSize(params.size) }
      : {}),
  }
}

/** 生图实际使用的模型：显式 model > 参考图默认（Pro）> 文生图默认。 */
function effectiveImageModel(params: ImageGenParams): string {
  return params.model ?? (params.image ? DEFAULT_IMAGE_EDIT_MODEL : DEFAULT_IMAGE_MODEL)
}

/** Threerouter 异步图片任务响应（提交 202 与查询共用字段）。 */
interface ThreerouterImageTaskResponse {
  id?: string
  task_id?: string
  object?: string
  status?: string
  legacy_status?: string
  http_status?: number
  image_url?: string
  request_id?: string
  result?: ThreerouterImagesResponse
  error?: unknown
  created_at?: number
  expires_at?: number
}

/** 从任务响应里取图片 URL：优先顶层 image_url，再回退 result.data[0].url。 */
function imageTaskMediaUrl(data: ThreerouterImageTaskResponse | undefined): string | undefined {
  const top = typeof data?.image_url === 'string' && data.image_url !== '' ? data.image_url : undefined
  if (top !== undefined) return top
  const first = data?.result?.data?.[0]?.url
  return typeof first === 'string' && first !== '' ? first : undefined
}

/**
 * 把网关返回的失败对象拼成可读错误：`{type, code, message}` 三件套按有的拼，
 * 并带上 http_status（异步任务失败时上游状态码在这里，不在任务状态里）。
 */
function extractImageTaskError(data: ThreerouterImageTaskResponse | undefined): string {
  const error = data?.error
  let detail = ''
  if (typeof error === 'string') {
    detail = error
  } else if (error !== null && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    const code = typeof obj.code === 'string' ? obj.code : typeof obj.type === 'string' ? obj.type : ''
    const message = typeof obj.message === 'string' ? obj.message : ''
    detail = [code, message].filter((part) => part !== '').join(': ')
  }
  if (detail === '') detail = 'Threerouter 图片任务执行失败'
  return data?.http_status ? `${detail}（上游 HTTP ${data.http_status}）` : detail
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
 *
 * 重试策略：**同步生图请求永不自动重试**（`retryTimes: 0`）。此端点一旦提交，
 * 上游可能已开始生成并计费；客户端超时/断连时无法确认结果，重提就是重复扣费。
 * 需要幂等与超时找回时请走 `imageTransport: async`。
 */
async function submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/images/generations`
  const effectiveModel = effectiveImageModel(params)
  const reqOpts = toRequestOpts('POST', url, threerouterHeaders(opts.apiKey, params.requestId), imageRequestBody(params, effectiveModel), { ...opts, retryTimes: 0 })
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
 * 异步提交图片任务：`POST /images/generations/async` → 202 + task_id。
 *
 * 与同步提交的本质区别：**服务端在返回 202 时就已落库任务**，生成脱离客户端
 * 连接继续执行，因此提交响应丢失（超时/断连/502）时任务仍然存在，可凭
 * `Idempotency-Key` 反查找回（见 findByRequestImageTask）——这正是「绝不重复生成」
 * 的落点。请求本身携带幂等键，重复提交也只会返回同一个 task_id。
 *
 * `retryTimes: 0`：提交是「可能创建任务」的写操作，任何自动重试都由事务层
 * 在确认状态后显式决定，不能藏在 HTTP 层。
 */
async function submitImageAsync(params: ImageGenParams, opts: HttpOpts): Promise<AsyncImageSubmit> {
  const url = `${opts.baseURL}/images/generations/async`
  const effectiveModel = effectiveImageModel(params)
  // 异步提交只做「接受任务」一件事，网关立即返回 202，不需要抬到同步路径的 600s。
  const reqOpts = toRequestOpts('POST', url, threerouterHeaders(opts.apiKey, params.requestId), imageRequestBody(params, effectiveModel), { ...opts, retryTimes: 0 })
  const res: RequestResult = await requestFull(reqOpts)
  const data = res.data as ThreerouterImageTaskResponse | null
  const taskId = typeof data?.task_id === 'string' && data.task_id !== ''
    ? data.task_id
    : typeof data?.id === 'string' ? data.id : ''
  if (taskId === '') {
    throw new GenerationError('task', 'Threerouter 异步生图：202 响应未包含 task_id，无法轮询（服务端契约异常）', false, res.status)
  }
  const retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'))
  return {
    taskId,
    model: effectiveModel,
    ...(typeof data?.request_id === 'string' && data.request_id !== '' ? { requestId: data.request_id } : {}),
    ...(res.headers.get('x-idempotency-replayed') === 'true' ? { replayed: true } : {}),
    ...(retryAfterMs !== undefined ? { retryAfterSec: Math.max(1, Math.round(retryAfterMs / 1000)) } : {}),
  }
}

/**
 * 查询异步图片任务：`GET /images/tasks/{task_id}`。
 * 状态口径以服务端契约为准：`processing` → 继续轮询；`succeeded`（旧值
 * `completed`，同时出现在 legacy_status）→ 取 image_url / result.data[0].url；
 * `failed` → 带出 error 与 http_status。`accepted`/`queued`/`cancelled` 服务端
 * 不会产生，出现时按运行中/失败保守处理而不是空等。
 */
async function queryImageTask(taskId: string, opts: HttpOpts): Promise<TaskQueryResult> {
  const url = `${opts.baseURL}/images/tasks/${encodeURIComponent(taskId)}`
  const data = await request(toRequestOpts('GET', url, threerouterHeaders(opts.apiKey), undefined, opts)) as ThreerouterImageTaskResponse
  switch (data?.status) {
    case 'processing':
    case 'pending':
      return { status: 'running' }
    case 'succeeded':
    case 'completed': {
      const mediaUrl = imageTaskMediaUrl(data)
      if (mediaUrl === undefined) {
        return { status: 'failed', error: `Threerouter 图片任务已完成但未返回图片 URL（task ${taskId}）` }
      }
      return { status: 'succeeded', mediaUrl }
    }
    case 'failed':
    case 'cancelled':
      return { status: 'failed', error: extractImageTaskError(data) }
    default:
      return { status: 'failed', error: `Threerouter 未知图片任务状态: ${data?.status ?? '空'}（task ${taskId}）` }
  }
}

/**
 * 凭幂等键找回原任务：`GET /images/generations/by-request/{request_id}`。
 *
 * 提交响应因超时/断连/502 丢失时，客户端手里只剩幂等键——这是唯一能在
 * **不重新生成**的前提下确认任务是否存在并继续等待的通道。服务端契约：
 * 200 返回与轮询端点相同的任务对象（含 request_id）；404 表示该键无记录
 * （从未成功提交，或记录已过期）。404 返回 undefined 而不是抛错，由上层
 * 的事务策略决定下一步（默认响亮失败并要求用户确认，而不是自动重提）。
 */
async function findByRequestImageTask(requestId: string, opts: HttpOpts): Promise<{ taskId: string } | undefined> {
  const url = `${opts.baseURL}/images/generations/by-request/${encodeURIComponent(requestId)}`
  try {
    const data = await request(toRequestOpts('GET', url, threerouterHeaders(opts.apiKey), undefined, opts)) as ThreerouterImageTaskResponse
    const taskId = typeof data?.task_id === 'string' && data.task_id !== ''
      ? data.task_id
      : typeof data?.id === 'string' ? data.id : ''
    return taskId === '' ? undefined : { taskId }
  } catch (err) {
    // 404 = 该幂等键无记录：不是异常，是「没有可找回的任务」这一事实。
    if (err instanceof GenerationError && err.status === 404) return undefined
    // 其余错误（网络/超时/5xx）属于「查不到状态」，向上抛出让事务层按未知状态处理：
    // 绝不因为一次查询失败就断定任务不存在。
    throw err
  }
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
  if (params.media) {
    // wan 全能系列使用文档协议：每个条目含 type + url。兼容工具层旧 position 输入。
    body.media = params.media.map(({ url: mediaUrl, type, position }) => ({
      type: type ?? (position?.toLowerCase() === 'first_frame' || position === '0s'
        ? 'first_frame'
        : position?.toLowerCase() === 'last_frame' ? 'last_frame' : 'reference_image'),
      url: mediaUrl,
    }))
  } else if (params.image) {
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

/** 查询异步视频任务状态。完成后优先使用响应 url，缺失时回退 /content 302 端点。 */
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
      return { status: 'failed', error: extractVideoTaskError(data.error) }
    case 'cancelled':
      return { status: 'failed', error: 'Threerouter 任务已取消' }
    default:
      return { status: 'failed', error: `Threerouter 未知任务状态: ${data?.status ?? '空'}` }
  }
}

/** 从视频任务失败响应中提取错误信息，兼容 string 与对象两种形态。 */
function extractVideoTaskError(error: unknown): string {
  if (typeof error === 'string' && error.length > 0) return error
  if (error !== null && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
  }
  return 'Threerouter 任务执行失败'
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
  // 异步图片网关能力：202 + task_id 提交、任务轮询、凭幂等键找回。
  // 工具层据此启用「单次提交 + 超时找回」的图片生成事务。
  imageAsync: {
    submit: submitImageAsync,
    query: queryImageTask,
    findByRequest: findByRequestImageTask,
  },
}

/** 复用 downloadMedia。 */
export { downloadMedia }
