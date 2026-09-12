/**
 * MiniMax 官方平台适配器：视频基于 video-generation v2 API，图片基于
 * image_generation API（同步返回 base64，无下载 URL）。
 * 创建走 POST /video_generation（异步，返回 task_id），轮询走
 * GET /query/video_generation，完成后经 file.download_url（或 files/retrieve
 * 换取下载地址）落盘。鉴权统一 Bearer Token。
 * 注意：本适配器按官方文档实现（2026-09），尚无平台 key 实测——字段语义以
 * https://platform.minimaxi.com/docs/api-reference 为准，
 * 取得 MINIMAX_API_KEY 后应在真实账号上验证一轮。
 * 图片：文生图 + subject_reference 主体一致性图生图（当前每次仅支持 1 张参考图），
 * 响应为 data.image_base64（裸 base64，无 URL 模式），结果层直接落盘。
 * @module dsh-image-video/providers/minimax
 */

import { request, downloadMedia, GenerationError } from '../http-client.ts'
import type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult, HttpOpts } from './types.ts'
import { toRequestOpts } from './types.ts'

/** MiniMax 官方默认文生视频模型（Hailuo 系）。 */
const DEFAULT_VIDEO_MODEL = 'MiniMax-Hailuo-02'
/** MiniMax 官方默认图片模型（image_generation）。 */
const DEFAULT_IMAGE_MODEL = 'image-01'
/** 未显式指定分辨率时的默认档位（Hailuo-02 支持 768P/1080P，768P 档时长兼容性最好）。 */
const DEFAULT_RESOLUTION = '768P'

/** 从 "宽*高"/"宽x高" 尺寸推导 MiniMax 的 aspect_ratio（约分），无法解析回落 "1:1"。 */
function deriveAspectRatio(size: string): string {
  const match = /^(\d+)[*x](\d+)$/i.exec(size.trim())
  if (!match || match[1] === undefined || match[2] === undefined) return '1:1'
  const width = Number(match[1])
  const height = Number(match[2])
  if (!width || !height) return '1:1'
  let a = width
  let b = height
  while (b !== 0) {
    const t = b
    b = a % b
    a = t
  }
  return `${width / a}:${height / a}`
}

/** MiniMax 图片生成响应：data.image_base64 为裸 base64 数组；业务错误经 base_resp 返回。 */
interface MiniMaxImageResponse {
  data?: { image_base64?: string[] }
  base_resp?: { status_code?: number; status_msg?: string }
}

/** MiniMax API 请求头。 */
function minimaxHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

/** MiniMax 通用响应包装：业务错误经 base_resp 返回（HTTP 可能仍是 200）。 */
interface MiniMaxBaseResp {
  status_code?: number
  status_msg?: string
}

/** 校验 base_resp，非零状态码按 task 级错误抛出（消息保留原始 status_msg 供分类器判定）。 */
function assertBaseResp(baseResp: MiniMaxBaseResp | undefined, api: string): void {
  const code = baseResp?.status_code
  if (code !== undefined && code !== 0) {
    throw new GenerationError(
      'task',
      `MiniMax ${api} 业务错误（${code}）：${baseResp?.status_msg ?? '未提供错误说明'}`,
      false,
    )
  }
}

/**
 * 提交图片任务（同步接口，直接返回 base64）。带参考图走 subject_reference
 * 主体一致性图生图（type: character，当前每次仅支持 1 张参考图，保留主体特征
 * 按 prompt 换场景）；aspect_ratio 由尺寸约分推导（MiniMax 无像素尺寸概念）。
 * 注意：官方示例 image_file 仅展示网络 URL，本地图片转 data URL 传入待实测。
 */
async function submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/image_generation`
  const effectiveModel = params.model ?? DEFAULT_IMAGE_MODEL
  const body: Record<string, unknown> = {
    model: effectiveModel,
    prompt: params.prompt,
    aspect_ratio: deriveAspectRatio(params.size),
    response_format: 'base64',
    ...(params.image ? { subject_reference: [{ type: 'character', image_file: params.image }] } : {}),
  }
  const data = await request(toRequestOpts('POST', url, minimaxHeaders(opts.apiKey), body, opts)) as MiniMaxImageResponse
  assertBaseResp(data?.base_resp, 'image_generation')
  const base64 = data?.data?.image_base64?.[0]
  if (!base64) throw new Error('MiniMax 图片生成：未返回图片数据')
  return { taskId: '', async: false, mediaType: 'image', model: effectiveModel, mediaBase64: { data: base64, mediaType: 'image/jpeg' } }
}

/**
 * 提交视频任务（异步）。存在 image 时为首帧驱动的图生视频（first_frame_image）；
 * resolution 缺省注入 768P；duration 透传（Hailuo 系支持自定义时长档位，
 * 不支持档位时上游报错，响亮失败不静默改写）。
 */
async function submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/video_generation`
  const effectiveModel = params.model ?? DEFAULT_VIDEO_MODEL
  const body: Record<string, unknown> = {
    model: effectiveModel,
    prompt: params.prompt,
    ...(params.image ? { first_frame_image: params.image } : {}),
    ...(params.duration ? { duration: params.duration } : {}),
    resolution: params.resolution ?? DEFAULT_RESOLUTION,
  }
  const data = await request(toRequestOpts('POST', url, minimaxHeaders(opts.apiKey), body, opts)) as MiniMaxTaskResponse
  assertBaseResp(data?.base_resp, 'video_generation')
  const taskId = data?.task_id
  if (!taskId) throw new Error('MiniMax 文生视频：未返回 task_id')
  return { taskId, async: true, mediaType: 'video', model: effectiveModel }
}

/** 查询异步任务状态；Success 时解析下载地址，必要时经 files/retrieve 二次换取。 */
async function queryTask(taskId: string, opts: HttpOpts): Promise<TaskQueryResult> {
  const url = `${opts.baseURL}/query/video_generation?task_id=${encodeURIComponent(taskId)}`
  const data = await request(toRequestOpts('GET', url, minimaxHeaders(opts.apiKey), undefined, opts)) as MiniMaxQueryResponse
  switch (data?.status) {
    case 'Queueing':
      return { status: 'pending' }
    case 'Processing':
      return { status: 'running' }
    case 'Success': {
      let downloadUrl = data.file?.download_url
      if (!downloadUrl && data.file_id !== undefined) {
        // 旧协议只返回 file_id：经 files/retrieve 换取下载地址。
        const retrieveUrl = `${opts.baseURL}/files/retrieve?file_id=${encodeURIComponent(String(data.file_id))}`
        const fileData = await request(toRequestOpts('GET', retrieveUrl, minimaxHeaders(opts.apiKey), undefined, opts)) as MiniMaxFileResponse
        downloadUrl = fileData?.file?.download_url
      }
      if (!downloadUrl) {
        return { status: 'failed', error: 'MiniMax 任务成功但未返回视频下载地址' }
      }
      return { status: 'succeeded', mediaUrl: downloadUrl }
    }
    case 'Fail':
      return { status: 'failed', error: data.base_resp?.status_msg ?? data.fail_reason ?? 'MiniMax 任务执行失败' }
    default:
      return { status: 'failed', error: `MiniMax 未知任务状态: ${data?.status ?? '空'}` }
  }
}

/** MiniMax 视频任务提交响应。 */
interface MiniMaxTaskResponse {
  task_id?: string
  base_resp?: MiniMaxBaseResp
}

/** MiniMax 视频任务查询响应。 */
interface MiniMaxQueryResponse {
  status?: string
  fail_reason?: string
  file?: { download_url?: string }
  file_id?: number | string
  base_resp?: MiniMaxBaseResp
}

/** MiniMax 文件检索响应。 */
interface MiniMaxFileResponse {
  file?: { download_url?: string }
  base_resp?: MiniMaxBaseResp
}

/** MiniMax 适配器实例。 */
export const minimaxAdapter: ProviderAdapter = {
  submitImage,
  submitVideo,
  queryTask,
}

/** 复用 downloadMedia。 */
export { downloadMedia }
