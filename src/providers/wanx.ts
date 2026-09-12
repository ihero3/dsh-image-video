/**
 * 万象（wanx）适配器：基于阿里云百炼 DashScope 异步 API。
 * 文生图与文生视频均采用「提交任务 → 轮询查询 → 下载结果」异步模式。
 * 鉴权统一 Bearer Token，X-DashScope-Async: enable 标记异步调用。
 * @module dsh-image-video/providers/wanx
 */

import { request, downloadMedia } from '../http-client.ts'
import { VIDEO_DURATION_UNSUPPORTED } from '../runtime-defaults.ts'
import type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult, HttpOpts } from './types.ts'
import { toRequestOpts } from './types.ts'

/** 万象默认文生图模型（通义万相）。 */
const DEFAULT_IMAGE_MODEL = 'wanx2.1-t2i-turbo'
/** 万象图生图默认模型（image2image 图编辑：按 prompt 描述编辑参考图）。 */
const DEFAULT_IMAGE_EDIT_MODEL = 'wanx2.1-imageedit'
/** 万象默认文生视频模型。 */
const DEFAULT_VIDEO_MODEL = 'wan2.2-t2v-plus'
/** 万象默认图生视频模型（首帧驱动）。 */
const DEFAULT_IMAGE_TO_VIDEO_MODEL = 'wan2.2-i2v-plus'

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

/**
 * 提交图片任务：带参考图走 image2image 图编辑（wanx2.1-imageedit，description_edit：
 * 按 prompt 描述编辑参考图，异步任务），否则走文生图（wanx2.1-t2i-turbo，异步任务）。
 * 两者同为「提交任务 → 轮询 → 下载」模式，复用同一 queryTask。
 */
async function submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const effectiveModel = params.model ?? (params.image ? DEFAULT_IMAGE_EDIT_MODEL : DEFAULT_IMAGE_MODEL)
  if (params.image) {
    const editUrl = `${opts.baseURL}/services/aigc/image2image/image-synthesis`
    const editBody = {
      model: effectiveModel,
      input: { function: 'description_edit', prompt: params.prompt, image_url: params.image },
    }
    const data = await request(toRequestOpts('POST', editUrl, dashscopeHeaders(opts.apiKey), editBody, opts)) as WanxTaskResponse
    const taskId = data?.output?.task_id
    if (!taskId) throw new Error('万象 图生图：未返回 task_id')
    return { taskId, async: true, mediaType: 'image', model: effectiveModel }
  }
  const url = `${opts.baseURL}/services/aigc/text2image/image-synthesis`
  const body = {
    model: effectiveModel,
    input: { prompt: params.prompt },
    parameters: { size: params.size, n: 1 },
  }
  const data = await request(toRequestOpts('POST', url, dashscopeHeaders(opts.apiKey), body, opts)) as WanxTaskResponse
  const taskId = data?.output?.task_id
  if (!taskId) throw new Error('万象 文生图：未返回 task_id')
  return { taskId, async: true, mediaType: 'image', model: effectiveModel }
}

/**
 * 提交视频任务。存在 image 时为首帧驱动的图生视频：img_url 携带首帧引用
 * （公网 URL 或 base64 data URL），模型默认取图生视频模型，构图由首帧决定，
 * 不传 aspect_ratio；纯文生保持原有参数。resolution 为可选分辨率档位，按模型支持透传。
 * wan 系模型（wan2.2-t2v-plus / wan2.7-t2v 等）不支持自定义时长：命中能力表时
 * 丢弃 duration（SubmitResult.droppedDuration 标记，结果层在 notes 注明）。
 */
async function submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/services/aigc/video-generation/video-synthesis`
  const input: Record<string, unknown> = { prompt: params.prompt }
  if (params.image) {
    input.img_url = params.image
  }
  const effectiveModel = params.model ?? (params.image ? DEFAULT_IMAGE_TO_VIDEO_MODEL : DEFAULT_VIDEO_MODEL)
  const droppedDuration = VIDEO_DURATION_UNSUPPORTED.has(effectiveModel)
  const parameters: Record<string, unknown> = {}
  if (!droppedDuration) {
    parameters.duration = params.duration
  }
  if (params.resolution) {
    parameters.resolution = params.resolution
  }
  if (!params.image) {
    parameters.aspect_ratio = params.aspectRatio ?? '16:9'
    parameters.audio = false
  }
  const body = {
    model: effectiveModel,
    input,
    parameters,
  }
  const data = await request(toRequestOpts('POST', url, dashscopeHeaders(opts.apiKey), body, opts)) as WanxTaskResponse
  const taskId = data?.output?.task_id
  if (!taskId) throw new Error('万象 文生视频：未返回 task_id')
  return { taskId, async: true, mediaType: 'video', model: effectiveModel, ...(droppedDuration ? { droppedDuration } : {}) }
}

/** 查询任务状态。 */
async function queryTask(taskId: string, opts: HttpOpts): Promise<TaskQueryResult> {
  const url = `${opts.baseURL}/tasks/${taskId}`
  const data = await request(toRequestOpts('GET', url, queryHeaders(opts.apiKey), undefined, opts)) as WanxQueryResponse
  const output = data?.output
  if (!output) return { status: 'failed', error: '万象 查询返回为空' }
  switch (output.task_status) {
    case 'PENDING':
    case 'RUNNING':
      return { status: output.task_status === 'PENDING' ? 'pending' : 'running' }
    case 'SUCCEEDED': {
      // 文生图/图生图返回 results 数组（图编辑兼容顶层 image_url），文生视频返回 video_url
      const imageUrl = output.results?.[0]?.url ?? output.image_url
      const videoUrl = output.video_url
      const mediaUrl = videoUrl ?? imageUrl
      if (!mediaUrl) return { status: 'failed', error: '万象 任务成功但未返回媒体 URL' }
      return { status: 'succeeded', mediaUrl }
    }
    case 'FAILED':
      return { status: 'failed', error: output.message ?? '万象 任务执行失败' }
    case 'CANCELED':
      return { status: 'failed', error: '万象 任务已取消' }
    case 'UNKNOWN':
      return { status: 'failed', error: '万象 任务不存在或已过期' }
    default:
      return { status: 'failed', error: `万象 未知任务状态: ${output.task_status}` }
  }
}

/** 万象任务提交响应。 */
interface WanxTaskResponse {
  output?: { task_id?: string; task_status?: string }
  request_id?: string
}

/** 万象任务查询响应。 */
interface WanxQueryResponse {
  output?: {
    task_status?: string
    video_url?: string
    image_url?: string
    results?: Array<{ url: string }>
    message?: string
  }
  request_id?: string
}

/** 万象适配器实例。 */
export const wanxAdapter: ProviderAdapter = {
  submitImage,
  submitVideo,
  queryTask,
}

/** 从配置解析万象 HttpOpts（已由 config.resolveActiveProvider 解析凭证）。 */
export function wanxHttpOpts(apiKey: string, baseURL: string, timeoutMs: number, retryTimes: number, signal?: AbortSignal): HttpOpts {
  return { apiKey, baseURL, timeoutMs, retryTimes, signal }
}

/** 复用 downloadMedia 供任务管理器下载万象生成的媒体。 */
export { downloadMedia }
