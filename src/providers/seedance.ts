/**
 * Seedance2.5 适配器：基于火山引擎方舟 Ark API。
 * 文生图/图生图走同步 /images/generations 接口（即时返回 URL，24h 有效需立即下载；
 * Seedream 4.0 起支持 image 参考图入参做图生图，3.0 不支持——带参考图时默认模型
 * 切换为 Seedream 4.0）；文生视频走异步 /contents/generations/tasks 接口
 * （提交 → 轮询 → 下载）。鉴权统一 Bearer Token。
 * @module dsh-image-video/providers/seedance
 */

import { request, downloadMedia } from '../http-client.ts'
import type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult, HttpOpts } from './types.ts'
import { toRequestOpts, normalizeImageSize } from './types.ts'

/** Seedance 默认文生图模型（即梦/Seedream）。 */
const DEFAULT_IMAGE_MODEL = 'doubao-seedream-3-0-t2i-250415'
/** Seedance 图生图默认模型（Seedream 3.0 不支持 image 入参，4.0 起支持单图生图）。 */
const DEFAULT_IMAGE_EDIT_MODEL = 'doubao-seedream-4-0-250828'
/** Seedance 默认文生视频模型。 */
const DEFAULT_VIDEO_MODEL = 'doubao-seedance-1-0-pro-250428'

/** Ark API 请求头。 */
function arkHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

/**
 * 提交图片任务（同步接口，直接返回图片 URL）。带参考图走图生图：Seedream 4.0+ 的
 * image 入参（URL 或 data URL），显式关闭组图与水印；尺寸分隔符归一化为方舟要求的
 * `宽x高`（配置默认值为百炼风格的 `*`）。不带参考图为文生图。
 */
async function submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/images/generations`
  const effectiveModel = params.model ?? (params.image ? DEFAULT_IMAGE_EDIT_MODEL : DEFAULT_IMAGE_MODEL)
  const body: Record<string, unknown> = {
    model: effectiveModel,
    prompt: params.prompt,
    ...(params.image ? { image: params.image, sequential_image_generation: 'disabled', watermark: false } : { watermark: false }),
    ...(params.size ? { size: normalizeImageSize(params.size) } : {}),
    n: 1,
    response_format: 'url',
  }
  const data = await request(toRequestOpts('POST', url, arkHeaders(opts.apiKey), body, opts)) as ArkImageResponse
  const mediaUrl = data?.data?.[0]?.url
  if (!mediaUrl) throw new Error('Seedance 图片生成：未返回图片 URL')
  return { taskId: '', async: false, mediaUrl, mediaType: 'image', model: effectiveModel }
}

/**
 * 提交视频任务（异步接口，返回任务 ID）。存在 image 时为首帧驱动的图生视频，
 * 按 Ark content 数组协议追加 image_url 块；resolution 为可选分辨率档位，按模型支持透传。
 */
async function submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/contents/generations/tasks`
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: params.prompt }]
  if (params.image) {
    content.push({ type: 'image_url', image_url: { url: params.image } })
  }
  const effectiveModel = params.model ?? DEFAULT_VIDEO_MODEL
  const body = {
    model: effectiveModel,
    content,
    // Seedance 视频参数通过可选字段传递
    ...(params.duration ? { duration: `${params.duration}s` } : {}),
    ...(params.resolution ? { resolution: params.resolution } : {}),
  }
  const data = await request(toRequestOpts('POST', url, arkHeaders(opts.apiKey), body, opts)) as ArkTaskResponse
  const taskId = data?.id
  if (!taskId) throw new Error('Seedance 文生视频：未返回 task_id')
  return { taskId, async: true, mediaType: 'video', model: effectiveModel }
}

/** 查询异步任务状态。 */
async function queryTask(taskId: string, opts: HttpOpts): Promise<TaskQueryResult> {
  const url = `${opts.baseURL}/contents/generations/tasks/${taskId}`
  const data = await request(toRequestOpts('GET', url, arkHeaders(opts.apiKey), undefined, opts)) as ArkQueryResponse
  switch (data?.status) {
    case 'queued':
      return { status: 'pending' }
    case 'running':
    case 'processing':
      return { status: 'running' }
    case 'succeeded': {
      const raw = data.content?.video_url
      const videoUrl = typeof raw === 'string' ? raw : raw?.url
      if (!videoUrl) {
        return { status: 'failed', error: 'Seedance 任务成功但未返回视频 URL' }
      }
      return { status: 'succeeded', mediaUrl: videoUrl }
    }
    case 'failed':
      return { status: 'failed', error: data.error?.message ?? 'Seedance 任务执行失败' }
    default:
      return { status: 'failed', error: `Seedance 未知任务状态: ${data?.status ?? '空'}` }
  }
}

/** Ark 图片生成响应。 */
interface ArkImageResponse {
  data?: Array<{ url?: string; b64_json?: string }>
}

/** Ark 视频任务提交响应。 */
interface ArkTaskResponse {
  id?: string
  status?: string
}

/** Ark 视频任务查询响应。 */
interface ArkQueryResponse {
  id?: string
  status?: string
  content?: {
    video_url?: string | { url?: string }
  }
  error?: { message?: string; code?: string }
}

/** Seedance 适配器实例。 */
export const seedanceAdapter: ProviderAdapter = {
  submitImage,
  submitVideo,
  queryTask,
}

/** 复用 downloadMedia。 */
export { downloadMedia }
