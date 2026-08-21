/**
 * bxinle 适配器：基于 bxinle.com 统一视频生成 API。
 * 文生视频走异步 POST /v1/videos → GET /v1/videos/{id} 轮询 → GET /v1/videos/{id}/content 下载。
 * 不支持文生图，仅实现视频生成。
 * 鉴权统一 Bearer Token。
 * @module dsh-image-video/providers/bxinle
 */

import { request, downloadMedia } from '../http-client.ts'
import type { ProviderAdapter, VideoGenParams, SubmitResult, TaskQueryResult, HttpOpts } from './types.ts'
import { toRequestOpts } from './types.ts'

/** bxinle 默认文生视频模型。 */
const DEFAULT_VIDEO_MODEL = 'doubao-seedance-2.0'

/** bxinle API 请求头。 */
function bxinleHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

/** 提交文生视频任务。 */
async function submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/videos`
  const body: Record<string, unknown> = {
    model: params.model ?? DEFAULT_VIDEO_MODEL,
    prompt: params.prompt,
    duration: params.duration,
  }
  if (params.aspectRatio) {
    body.aspect_ratio = params.aspectRatio
  }
  const data = await request(toRequestOpts('POST', url, bxinleHeaders(opts.apiKey), body, opts)) as BxinleTaskResponse
  const taskId = data?.id
  if (!taskId) throw new Error('bxinle 文生视频：未返回任务 ID')
  return { taskId, async: true, mediaType: 'video' }
}

/** 查询异步任务状态。 */
async function queryTask(taskId: string, opts: HttpOpts): Promise<TaskQueryResult> {
  const url = `${opts.baseURL}/videos/${taskId}`
  const data = await request(toRequestOpts('GET', url, bxinleHeaders(opts.apiKey), undefined, opts)) as BxinleQueryResponse
  switch (data?.status) {
    case 'queued':
      return { status: 'pending' }
    case 'in_progress':
      return { status: 'running' }
    case 'completed': {
      // metadata.url 为兼容扩展字段；优先使用 content 端点下载
      const mediaUrl = data.metadata?.url
      if (!mediaUrl) {
        // 任务完成但没有直接 URL，使用 content 端点
        return { status: 'succeeded', mediaUrl: `${opts.baseURL}/videos/${taskId}/content` }
      }
      return { status: 'succeeded', mediaUrl }
    }
    case 'failed':
      return { status: 'failed', error: data.error?.message ?? 'bxinle 任务执行失败' }
    default:
      return { status: 'failed', error: `bxinle 未知任务状态: ${data?.status ?? '空'}` }
  }
}

/** bxinle 任务提交响应。 */
interface BxinleTaskResponse {
  id?: string
  object?: string
  status?: string
  progress?: number
  seconds?: string
  size?: string
}

/** bxinle 任务查询响应。 */
interface BxinleQueryResponse {
  id?: string
  status?: string
  progress?: number
  metadata?: { url?: string }
  error?: { message?: string; code?: string }
}

/** bxinle 适配器实例。不支持文生图，submitImage 抛出明确错误。 */
export const bxinleAdapter: ProviderAdapter = {
  submitImage: async () => {
    throw new Error('bxinle 服务商不支持文生图，请将 provider 切换为 wanx 或 seedance')
  },
  submitVideo,
  queryTask,
}

/** 复用 downloadMedia。 */
export { downloadMedia }
