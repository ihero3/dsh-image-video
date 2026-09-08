/**
 * Threerouter 适配器：基于 threerouter.com 统一媒体生成 API。
 * 图片与视频统一走 POST /media/generations 创建 → GET /media/{id} 轮询 → GET /media/{id}/content 下载，
 * 请求显式携带 media_kind（image/video），不依赖模型名推断。
 * 鉴权统一 Bearer Token。
 * @module dsh-image-video/providers/threerouter
 */

import { request, downloadMedia } from '../http-client.ts'
import type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult, HttpOpts } from './types.ts'
import { toRequestOpts } from './types.ts'

/** Threerouter 默认文生图模型。 */
const DEFAULT_IMAGE_MODEL = 'wan2.1-image'
/** Threerouter 默认文生视频模型。账号可用模型见 threerouter.com 控制台。 */
const DEFAULT_VIDEO_MODEL = 'wan2.2-t2v-plus'

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

/** 提交文生图任务（media_kind=image 显式指定，不依赖模型名推断）。 */
async function submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/media/generations`
  const body: Record<string, unknown> = {
    model: params.model ?? DEFAULT_IMAGE_MODEL,
    prompt: params.prompt,
    media_kind: 'image',
  }
  const data = await request(toRequestOpts('POST', url, threerouterHeaders(opts.apiKey), body, opts)) as ThreerouterTaskResponse
  if (!data?.id) throw new Error('Threerouter 文生图：未返回任务 ID')
  return { taskId: data.id, async: true, mediaType: 'image' }
}

/** 提交文生视频任务（media_kind=video，携带时长与宽高比）。 */
async function submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/media/generations`
  const body: Record<string, unknown> = {
    model: params.model ?? DEFAULT_VIDEO_MODEL,
    prompt: params.prompt,
    media_kind: 'video',
    duration: params.duration,
  }
  if (params.aspectRatio) {
    body.ratio = params.aspectRatio
  }
  const data = await request(toRequestOpts('POST', url, threerouterHeaders(opts.apiKey), body, opts)) as ThreerouterTaskResponse
  if (!data?.id) throw new Error('Threerouter 文生视频：未返回任务 ID')
  return { taskId: data.id, async: true, mediaType: 'video' }
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
