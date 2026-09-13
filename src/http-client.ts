/**
 * 统一 HTTP 请求客户端：封装 fetch，分类异常，可配置重试。
 * 鉴权失败、配额耗尽等不可重试错误立即抛出；超时、网络抖动按配置重试。
 * @module dsh-image-video/http-client
 */

/** 异常种类，区分可重试与不可重试。 */
export type ErrorKind = 'auth' | 'quota' | 'task' | 'timeout' | 'network'

/** 所有生成相关错误的基类，携带友好中文提示与分类标记。 */
export class GenerationError extends Error {
  readonly kind: ErrorKind
  /** 是否值得重试：仅超时与网络抖动重试，鉴权/配额/任务逻辑错误立即失败。 */
  readonly retryable: boolean
  /** 原始 HTTP 状态码，任务级错误可能为 undefined。 */
  readonly status?: number

  constructor(kind: ErrorKind, message: string, retryable: boolean, status?: number) {
    super(message)
    this.name = 'GenerationError'
    this.kind = kind
    this.retryable = retryable
    this.status = status
  }
}

/**
 * 判定错误是否为「模型不被该服务商接受」类，供工具层在候选服务商间回退。
 * 实测形态（2026-09）：
 * - threerouter：目录中无可用渠道的模型 → HTTP 503 capacity_error
 *   "No available media generation channels"（网关按模型找渠道，未知模型即无渠道）；
 * - threerouter：分组未开通生图 → HTTP 403 permission_error
 *   "Image generation is not enabled for this group"（文档语义：401=Key 无效，
 *   403=无该分组/模型权限或未开通生图 allow_image_generation——属于「该候选
 *   无法服务此请求」，应换下一候选，而非响亮终止）；
 * - 部分服务商：HTTP 400/404 + 模型不存在类消息（"model not found" / "模型不存在"）；
 * - 能力缺失：如「不支持图片生成」。
 * 注意区分语义相近的参数级 400——如 "model X does not support duration 1s"
 * （时长档位问题，模型本身可用），该类消息不命中本判定，不触发换家。
 * 其余 5xx（无 capacity_error 语义）、Key 无效（401）、配额（429）、超时一律不成立：
 * 响亮失败，避免用别家的 key 静默掩盖本服务商的配置问题。
 */
export function isModelNotAcceptedError(err: unknown): boolean {
  if (!(err instanceof GenerationError)) return false
  const message = err.message ?? ''
  const modelMissing = /not\s*found|not\s*exist|does\s*not\s*exist|unknown\s*model|invalid\s*model|不存在|未找到|未开通|无效的?模型/i.test(message)
  const capabilityMissing = message.includes('不支持')
  if (err.kind === 'task') return modelMissing || capabilityMissing
  // threerouter 网关的「无可用渠道」503 同样意味着无法为此模型服务，纳入回退；
  // 其余 network/timeout 错误（瞬时故障）不回退。
  if (err.kind === 'network') return /no available media generation channels|capacity_error/i.test(message)
  // 403 权限类：仅当消息明确为「分组/模型未开通该能力」时回退（试下一候选）；
  // 纯 Key 无效（401）或无任何权限语义的 403 仍响亮失败。
  if (err.kind === 'auth') {
    return /image generation is not enabled|not enabled for this group|allow_image_generation|未开通生图|无该分组|无该模型权限/i.test(message)
  }
  return false
}

/** 请求选项。 */
export interface RequestOptions {
  method: 'GET' | 'POST'
  url: string
  headers: Record<string, string>
  /** JSON 请求体；GET 请求忽略。 */
  body?: unknown
  /** 单次请求超时（毫秒）。 */
  timeoutMs: number
  /** 最大重试次数（仅对可重试错误生效）。 */
  retryTimes: number
  /** 取消信号，由调用方（任务管理器）传入。 */
  signal?: AbortSignal
}

/** 重试退避基数（毫秒），指数退避：base * 2^attempt。 */
const RETRY_BACKOFF_MS = 1_000

/** 请求结果。 */
export interface RequestResult {
  ok: true
  status: number
  data: unknown
}

/**
 * 执行单次 HTTP 请求，带超时控制。不处理重试。
 * @throws {GenerationError} 超时或网络错误（可重试）。
 */
async function singleRequest(opts: RequestOptions): Promise<RequestResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs)
  // 若调用方已取消，联动 abort。
  const onExternalAbort = (): void => controller.abort()
  opts.signal?.addEventListener('abort', onExternalAbort)
  try {
    const init: RequestInit = {
      method: opts.method,
      headers: opts.headers,
      signal: controller.signal,
    }
    if (opts.method === 'POST' && opts.body !== undefined) {
      init.body = JSON.stringify(opts.body)
    }
    const res = await fetch(opts.url, init)
    const data = await parseBody(res)
    return { ok: true, status: res.status, data }
  } catch (err) {
    if (controller.signal.aborted && !opts.signal?.aborted) {
      throw new GenerationError('timeout', `请求超时（${opts.timeoutMs}ms），URL: ${opts.url}`, true)
    }
    if (opts.signal?.aborted) {
      throw new GenerationError('timeout', '任务已被取消', false)
    }
    throw new GenerationError('network', `网络请求失败：${err instanceof Error ? err.message : String(err)}`, true)
  } finally {
    clearTimeout(timeoutId)
    opts.signal?.removeEventListener('abort', onExternalAbort)
  }
}

/** 解析响应体为 JSON，空体返回 null。 */
async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (text.length === 0) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * 分类 HTTP 响应错误，生成友好中文提示。
 * 内部实现，不在 execute 外部直接调用。通过 `classifyErrorForTest` 导出用于单元测试。
 */
function classifyHttpError(status: number, data: unknown, url: string): GenerationError {
  const errMsg = extractErrorMessage(data)
  if (status === 401 || status === 403) {
    return new GenerationError('auth', `鉴权失败（HTTP ${status}）：API Key 无效或无权限。${errMsg}`, false, status)
  }
  if (status === 429) {
    return new GenerationError('quota', `配额耗尽（HTTP 429）：请求频率或额度超限，请稍后重试或检查账户余额。${errMsg}`, false, status)
  }
  if (status >= 500) {
    return new GenerationError('network', `服务端错误（HTTP ${status}），将重试。${errMsg}`, true, status)
  }
  return new GenerationError('task', `任务报错（HTTP ${status}）：${errMsg || '服务端返回错误'}，URL: ${url}`, false, status)
}

/** 从服务商响应体提取错误消息，兼容常见结构。 */
function extractErrorMessage(data: unknown): string {
  if (data === null || typeof data !== 'object') return ''
  const obj = data as Record<string, unknown>
  // 阿里云 DashScope / 火山引擎 Ark 常见错误字段
  const message = obj.message ?? obj.error_message ?? obj.msg
  if (typeof message === 'string') return message
  const error = obj.error
  if (typeof error === 'string') return error
  if (error !== null && typeof error === 'object') {
    const errObj = error as Record<string, unknown>
    if (typeof errObj.message === 'string') return errObj.message
    if (typeof errObj.code === 'string') return `错误码: ${errObj.code}`
  }
  if (typeof obj.code === 'string') return `错误码: ${obj.code}`
  return ''
}

/**
 * 测试辅助：直接调用内部 `classifyHttpError`。
 * 仅用于单元测试验证异常分类逻辑，生产代码不要使用。
 */
export const classifyErrorForTest: (status: number, data: unknown, url: string) => GenerationError = classifyHttpError

/**
 * 统一 HTTP 请求入口：执行请求，分类异常，对可重试错误按指数退避重试。
 * 鉴权失败、配额耗尽、任务逻辑错误立即抛出不重试。
 * @returns 解析后的响应数据。
 * @throws {GenerationError} 分类后的生成错误。
 */
export async function request(opts: RequestOptions): Promise<unknown> {
  let lastError: GenerationError | undefined
  for (let attempt = 0; attempt <= opts.retryTimes; attempt++) {
    if (opts.signal?.aborted) {
      throw new GenerationError('timeout', '任务已被取消', false)
    }
    try {
      const result = await singleRequest(opts)
      if (result.status >= 200 && result.status < 300) {
        return result.data
      }
      throw classifyHttpError(result.status, result.data, opts.url)
    } catch (err) {
      if (err instanceof GenerationError) {
        // 不可重试错误立即抛出
        if (!err.retryable) throw err
        lastError = err
        // 还有重试机会则退避等待
        if (attempt < opts.retryTimes) {
          const backoff = RETRY_BACKOFF_MS * Math.pow(2, attempt)
          await sleep(backoff, opts.signal)
          continue
        }
      } else {
        // 非预期错误包装为网络错误
        lastError = new GenerationError('network', `未知错误：${err instanceof Error ? err.message : String(err)}`, true)
      }
    }
  }
  throw lastError ?? new GenerationError('network', '请求失败且未捕获具体错误', true)
}

/**
 * 下载二进制媒体到 Uint8Array。重试逻辑同 request。
 * @param url - 媒体下载地址。
 * @param opts - 超时、重试、取消信号。
 * @returns 媒体字节与 Content-Type。
 * @throws {GenerationError} 下载失败。
 */
export async function downloadMedia(url: string, opts: Pick<RequestOptions, 'timeoutMs' | 'retryTimes' | 'signal'>): Promise<{ data: Uint8Array; contentType: string }> {
  let lastError: GenerationError | undefined
  for (let attempt = 0; attempt <= opts.retryTimes; attempt++) {
    if (opts.signal?.aborted) {
      throw new GenerationError('timeout', '下载任务已被取消', false)
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs)
    const onExternalAbort = (): void => controller.abort()
    opts.signal?.addEventListener('abort', onExternalAbort)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) {
        const data = await parseBody(res)
        throw classifyHttpError(res.status, data, url)
      }
      const buffer = await res.arrayBuffer()
      return { data: new Uint8Array(buffer), contentType: res.headers.get('content-type') ?? 'application/octet-stream' }
    } catch (err) {
      if (err instanceof GenerationError) {
        if (!err.retryable) throw err
        lastError = err
      } else if (controller.signal.aborted && !opts.signal?.aborted) {
        lastError = new GenerationError('timeout', `下载超时（${opts.timeoutMs}ms）`, true)
      } else {
        lastError = new GenerationError('network', `下载失败：${err instanceof Error ? err.message : String(err)}`, true)
      }
      if (attempt < opts.retryTimes) {
        const backoff = RETRY_BACKOFF_MS * Math.pow(2, attempt)
        await sleep(backoff, opts.signal)
      }
    } finally {
      clearTimeout(timeoutId)
      opts.signal?.removeEventListener('abort', onExternalAbort)
    }
  }
  throw lastError ?? new GenerationError('network', '下载失败', true)
}

/** 可被取消的延时。 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new GenerationError('timeout', '任务已被取消', false))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new GenerationError('timeout', '任务已被取消', false))
    }, { once: true })
  })
}
