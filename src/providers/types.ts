/**
 * 服务商适配器通用类型。万象（wanx）与 Seedance 均实现此接口，
 * 工具层按 provider 字段分发，无需感知具体 API 差异。
 * @module dsh-image-video/providers/types
 */

import type { RequestOptions } from '../http-client.ts'

/** 图片生成请求参数（不传 image 为文生图，传入 image 为图生图/参考图编辑）。 */
export interface ImageGenParams {
  /** 客户端生成事务唯一 ID；服务端必须按此字段幂等。 */
  requestId?: string
  /** 提示词。 */
  prompt: string
  /** 图片尺寸，如 "1024x1024"（分隔符可能为 `*`，适配器经 normalizeImageSize 归一化）。 */
  size: string
  /** 可选模型名，留空使用适配器默认模型。 */
  model?: string
  /**
   * 可选参考图，存在时走图生图：http(s) URL、data URL（本地路径已由调用方经
   * media.resolveImageReference 统一解析），适配器只负责放到各自协议字段。
   * 各家语义不同：threerouter /images/edits 按提示词编辑、方舟 Seedream 参考编辑、
   * MiniMax 主体一致性（保留主体换场景）。
   */
  image?: string
}

/** 视频生成请求参数（文生视频，带 image 时为首帧驱动的图生视频）。 */
export interface VideoGenParams {
  /** 提示词。 */
  prompt: string
  /** 视频时长（秒），上限 10。 */
  duration: number
  /** 可选宽高比，如 "16:9"。存在 image 时构图由首帧图片决定，适配器不传该字段。 */
  aspectRatio?: string
  /** 可选模型名，留空使用适配器默认模型。 */
  model?: string
  /**
   * 可选首帧图片，存在时走图生视频：http(s) URL、data URL 或本地文件路径。
   * 调用方经 media.resolveImageReference 统一解析后才传入，适配器只负责放到各自字段。
   */
  image?: string
  /**
   * wan3.0-video 多关键帧：按时间点排列的参考图序列（如 position '0s' / '1s'…）。
   * 调用方经 media.resolveVideoMedia 统一解析（压缩 + 转 data URL），
  * 适配器按文档转换为 type/url；存在时 image 字段忽略。
   */
  media?: Array<{ url: string; type?: string; position?: string }>
  /** 可选分辨率档位，取值由服务商与模型决定（如 MiniMax-H3 支持 480P/768P/2K）；留空用服务商默认。 */
  resolution?: string
}

/** 任务提交结果。 */
export interface SubmitResult {
  /** 任务 ID；同步接口返回空字符串。 */
  taskId: string
  /** true 表示需要轮询查询，false 表示同步已返回结果。 */
  async: boolean
  /** 同步接口直接返回的媒体 URL；async=false 时有值。 */
  mediaUrl?: string
  /** 媒体类型，用于区分图片/视频渲染。 */
  mediaType: 'image' | 'video'
  /** true 表示请求携带的 duration 因模型不支持自定义时长被丢弃（结果层据此在 notes 注明）。 */
  droppedDuration?: boolean
  /**
   * 实际发给上游的模型名（含适配器内置默认的兜底结果）。结果层据此向用户
   * 透明报告「这次到底用了哪个模型」，无需再靠配置推断。
   */
  model?: string
  /**
   * 同步接口直接返回的 base64 图片字节（MiniMax image_generation 等）。
   * 有值时结果层直接落盘，跳过 downloadAndSave 下载步骤。
   */
  mediaBase64?: { data: string; mediaType: string }
}

/** 任务查询结果。 */
export type TaskQueryResult =
  | { status: 'pending' | 'running' }
  | { status: 'succeeded'; mediaUrl: string }
  | { status: 'failed'; error: string }

/**
 * 异步图片提交结果（202 Accepted 形态）。
 * 与 {@link SubmitResult} 的区别：这里只有「任务已被接受」这一个事实，
 * 结果图 URL 必须经轮询端点取得，因此不存在同步返回的 mediaUrl。
 */
export interface AsyncImageSubmit {
  /** 网关任务 ID（`imgtask_…`），轮询与找回的唯一句柄。 */
  taskId: string
  /** 本次提交实际使用的模型名（服务商回报或本地推断）。 */
  model?: string
  /** 服务端回显的幂等键。 */
  requestId?: string
  /** true = 服务端幂等回放（`X-Idempotency-Replayed: true`），本次没有新建任务。 */
  replayed?: boolean
  /** 服务端建议的轮询间隔（`Retry-After` 秒）；缺省用配置的轮询间隔。 */
  retryAfterSec?: number
}

/**
 * 异步图片网关能力（可选）：提交立即返回任务句柄、结果经轮询取得，
 * 并支持「凭幂等键找回任务」——这是提交响应因超时/断连丢失后不重复
 * 生成的唯一自救通道。只有实现该能力的服务商才允许配置 async 传输。
 */
export interface ImageAsyncCapability {
  /** 提交一次图片生成任务，返回任务句柄（服务端保证同一幂等键只创建一次）。 */
  submit(params: ImageGenParams, opts: HttpOpts): Promise<AsyncImageSubmit>
  /** 查询任务状态；图片任务与视频任务的查询端点可能不同。 */
  query(taskId: string, opts: HttpOpts): Promise<TaskQueryResult>
  /** 凭幂等键找回原任务；未找到返回 undefined（不抛错，由上层按策略决定）。 */
  findByRequest(requestId: string, opts: HttpOpts): Promise<{ taskId: string } | undefined>
}

/** HTTP 请求选项子集，由工具层从 Config 解析后传入。 */
export interface HttpOpts {
  apiKey: string
  baseURL: string
  timeoutMs: number
  retryTimes: number
  signal?: AbortSignal
}

/** 将 HttpOpts 转换为 RequestOptions。 */
export function toRequestOpts(method: 'GET' | 'POST', url: string, headers: Record<string, string>, body: unknown, opts: HttpOpts): RequestOptions {
  return {
    method,
    url,
    headers,
    body,
    timeoutMs: opts.timeoutMs,
    retryTimes: opts.retryTimes,
    signal: opts.signal,
  }
}

/** 服务商适配器接口。 */
export interface ProviderAdapter {
  /** 提交文生图任务（同步语义：返回体即结果，或返回可轮询的异步任务句柄）。 */
  submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult>
  /** 提交文生视频任务（始终异步）。 */
  submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult>
  /** 查询异步任务状态。 */
  queryTask(taskId: string, opts: HttpOpts): Promise<TaskQueryResult>
  /**
   * 异步图片网关能力（可选能力声明）。实现它的服务商才能接受 `imageTransport: async`：
   * 提交即返回任务句柄、结果经 `query` 轮询、响应丢失时经 `findByRequest` 找回。
   * 未实现时工具层按同步单次提交处理（仍然只提交一次、超时不重提）。
   */
  imageAsync?: ImageAsyncCapability
}

/** 从 "1024x1024" 格式解析宽高。 */
export function parseSize(size: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/i.exec(size.trim())
  if (!match || match[1] === undefined || match[2] === undefined) {
    return { width: 1024, height: 1024 }
  }
  return { width: Number(match[1]), height: Number(match[2]) }
}

/**
 * 尺寸分隔符归一化：配置默认值沿用百炼风格 "1024*1024"（星号），
 * 而 threerouter（OpenAI 风格）与火山方舟均要求 "1024x1024"（字母 x）。
 * 非 `宽x高` 形态（如 "1K"/"2K"/"auto"）原样返回。
 */
export function normalizeImageSize(size: string): string {
  return /^\d+\*\d+$/.test(size.trim()) ? size.trim().replace(/\*/g, 'x') : size.trim()
}

/**
 * 阿里系（千问 qwen-image-* / 万相 wan*-image 等，DashScope 与经 threerouter 透传皆同）
 * 原生尺寸归一化：上游要求 `宽*高` 且不接受比例写法（2026-09-14 实测：`3:4` 原样
 * 透传被 400 "Expected format: '<width>*<height>'"）。比例写法按长边 1536、32 对齐
 * 换算（3:4 → 1152*1536；16:9 → 1536*864；1:1 → 1024*1024）；WxH / W*H 统一 `*` 分隔。
 */
export function aliImageSize(size: string): string {
  const ratio = /^(\d+):(\d+)$/.exec(size.trim())
  if (ratio) {
    const a = Number(ratio[1])
    const b = Number(ratio[2])
    if (a > 0 && b > 0) {
      if (a === b) return '1024*1024'
      const long = 1536
      const w = a > b ? long : Math.round((long * a) / b / 32) * 32
      const h = a > b ? Math.round((long * b) / a / 32) * 32 : long
      return `${w}*${h}`
    }
  }
  return size.trim().replace(/[xX]/g, '*')
}
