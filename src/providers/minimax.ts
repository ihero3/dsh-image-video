/**
 * MiniMax 官方平台适配器（仅视频）：基于 video-generation v2 API 实现。
 * 创建走 POST /video_generation（异步，返回 task_id），轮询走
 * GET /query/video_generation，完成后经 file.download_url（或 files/retrieve
 * 换取下载地址）落盘。鉴权统一 Bearer Token。
 * 注意：本适配器按官方文档实现（2026-09），尚无平台 key 实测——字段语义以
 * https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create 为准，
 * 取得 MINIMAX_API_KEY 后应在真实账号上验证一轮。
 * MiniMax 不提供图片生成能力，submitImage 明确报错（工具层据此回退到聚合器）。
 * @module dsh-image-video/providers/minimax
 */

import { request, downloadMedia, GenerationError } from '../http-client.ts'
import type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult, HttpOpts } from './types.ts'
import { toRequestOpts } from './types.ts'

/** MiniMax 官方默认文生视频模型（Hailuo 系）。 */
const DEFAULT_VIDEO_MODEL = 'MiniMax-Hailuo-02'
/** 未显式指定分辨率时的默认档位（Hailuo-02 支持 768P/1080P，768P 档时长兼容性最好）。 */
const DEFAULT_RESOLUTION = '768P'

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

/** 提交文生图任务：MiniMax 官方平台无图片生成能力，明确报错。 */
async function submitImage(_params: ImageGenParams, _opts: HttpOpts): Promise<SubmitResult> {
  throw new GenerationError('task', 'MiniMax 不支持图片生成，请改用 threerouter / wanx / seedance', false)
}

/**
 * 提交视频任务（异步）。存在 image 时为首帧驱动的图生视频（first_frame_image）；
 * resolution 缺省注入 768P；duration 透传（Hailuo 系支持自定义时长档位，
 * 不支持档位时上游报错，响亮失败不静默改写）。
 */
async function submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult> {
  const url = `${opts.baseURL}/video_generation`
  const body: Record<string, unknown> = {
    model: params.model ?? DEFAULT_VIDEO_MODEL,
    prompt: params.prompt,
    ...(params.image ? { first_frame_image: params.image } : {}),
    ...(params.duration ? { duration: params.duration } : {}),
    resolution: params.resolution ?? DEFAULT_RESOLUTION,
  }
  const data = await request(toRequestOpts('POST', url, minimaxHeaders(opts.apiKey), body, opts)) as MiniMaxTaskResponse
  assertBaseResp(data?.base_resp, 'video_generation')
  const taskId = data?.task_id
  if (!taskId) throw new Error('MiniMax 文生视频：未返回 task_id')
  return { taskId, async: true, mediaType: 'video' }
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
