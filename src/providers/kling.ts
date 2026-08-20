/**
 * Kling 适配器：基于阿里云百炼 DashScope 异步 API。
 * 文生图与文生视频均采用「提交任务 → 轮询查询 → 下载结果」异步模式。
 * 鉴权统一 Bearer Token，X-DashScope-Async: enable 标记异步调用。
 * @module dsh-image-video/providers/kling
 */

import { request, downloadMedia } from '../http-client.ts'
import type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult, HttpOpts } from './types.ts'
import { toRequestOpts } from './types.ts'

/** Kling 默认文生图模型（通义万相）。 */
const DEFAULT_IMAGE_MODEL = 'wanx2.1-t2i-turbo'
/** Kling 默认文生视频模型。 */
const DEFAULT_VIDEO_MODEL = 'kling/kling-v3-video-generation'

/** DashScope 请求头。 */
function dashscopeHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'X-DashScope-Async': 'enable',
  }
}

/** 查询任务公共头（无 Async 标记）。 */
function queryHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
  }
}

/** 提交文生图任务。 */
async function submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/services/aigc/text2image/image-synthesis`
  const body = {
    model: params.model ?? DEFAULT_IMAGE_MODEL,
    input: { prompt: params.prompt },
    parameters: { size: params.size, n: 1 },
  }
  const data = await request(toRequestOpts('POST', url, dashscopeHeaders(opts.apiKey), body, opts)) as KlingTaskResponse
  const taskId = data?.output?.task_id
  if (!taskId) throw new Error('Kling 文生图：未返回 task_id')
  return { taskId, async: true, mediaType: 'image' }
}

/** 提交文生视频任务。 */
async function submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/services/aigc/video-generation/video-synthesis`
  const body = {
    model: params.model ?? DEFAULT_VIDEO_MODEL,
    input: { prompt: params.prompt },
    parameters: {
      duration: params.duration,
      aspect_ratio: params.aspectRatio ?? '16:9',
      audio: false,
    },
  }
  const data = await request(toRequestOpts('POST', url, dashscopeHeaders(opts.apiKey), body, opts)) as KlingTaskResponse
  const taskId = data?.output?.task_id
  if (!taskId) throw new Error('Kling 文生视频：未返回 task_id')
  return { taskId, async: true, mediaType: 'video' }
}

/** 查询任务状态。 */
async function queryTask(taskId: string, opts: HttpOpts): Promise<TaskQueryResult> {
  const url = `${opts.baseURL}/tasks/${taskId}`
  const data = await request(toRequestOpts('GET', url, queryHeaders(opts.apiKey), undefined, opts)) as KlingQueryResponse
  const output = data?.output
  if (!output) return { status: 'failed', error: 'Kling 查询返回为空' }
  switch (output.task_status) {
    case 'PENDING':
    case 'RUNNING':
      return { status: output.task_status === 'PENDING' ? 'pending' : 'running' }
    case 'SUCCEEDED': {
      // 文生图返回 results 数组，文生视频返回 video_url
      const imageUrl = output.results?.[0]?.url
      const videoUrl = output.video_url
      const mediaUrl = videoUrl ?? imageUrl
      if (!mediaUrl) return { status: 'failed', error: 'Kling 任务成功但未返回媒体 URL' }
      return { status: 'succeeded', mediaUrl }
    }
    case 'FAILED':
      return { status: 'failed', error: output.message ?? 'Kling 任务执行失败' }
    case 'CANCELED':
      return { status: 'failed', error: 'Kling 任务已取消' }
    case 'UNKNOWN':
      return { status: 'failed', error: 'Kling 任务不存在或已过期' }
    default:
      return { status: 'failed', error: `Kling 未知任务状态: ${output.task_status}` }
  }
}

/** Kling 任务提交响应。 */
interface KlingTaskResponse {
  output?: { task_id?: string; task_status?: string }
  request_id?: string
}

/** Kling 任务查询响应。 */
interface KlingQueryResponse {
  output?: {
    task_status?: string
    video_url?: string
    results?: Array<{ url: string }>
    message?: string
  }
  request_id?: string
}

/** Kling 适配器实例。 */
export const klingAdapter: ProviderAdapter = {
  submitImage,
  submitVideo,
  queryTask,
}

/** 从配置解析 Kling HttpOpts（已由 config.resolveActiveProvider 解析凭证）。 */
export function klingHttpOpts(apiKey: string, baseURL: string, timeoutMs: number, retryTimes: number, signal?: AbortSignal): HttpOpts {
  return { apiKey, baseURL, timeoutMs, retryTimes, signal }
}

/** 复用 downloadMedia 供任务管理器下载 Kling 生成的媒体。 */
export { downloadMedia }
