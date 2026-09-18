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
  /** 服务端 Retry-After 建议的等待时间（毫秒）。 */
  readonly retryAfterMs?: number
  /**
   * 服务端返回的机器可读错误码（形如 `{"error":{"code":"IDEMPOTENCY_IN_PROGRESS"}}`）。
   * 生图事务靠它区分「提交未落地（可回退候选）」与「提交状态未知（绝不重提）」，
   * 因此必须比 message 文本更可靠地保留下来。
   */
  readonly code?: string

  constructor(kind: ErrorKind, message: string, retryable: boolean, status?: number, retryAfterMs?: number, code?: string) {
    super(message)
    this.name = 'GenerationError'
    this.kind = kind
    this.retryable = retryable
    this.status = status
    if (retryAfterMs !== undefined) this.retryAfterMs = retryAfterMs
    if (code !== undefined && code !== '') this.code = code
  }
}

/** 服务端错误码：幂等键对应的首次提交仍在进行中（GateWay 异步图片契约）。 */
export const CODE_IDEMPOTENCY_IN_PROGRESS = 'IDEMPOTENCY_IN_PROGRESS'
/** 服务端错误码：同一幂等键被用于不同请求体（客户端事务 ID 复用错误）。 */
export const CODE_IDEMPOTENCY_KEY_CONFLICT = 'IDEMPOTENCY_KEY_CONFLICT'

/**
 * 判定错误是否为「异步图片端点在本环境不可用」：功能未开启（未配对象存储）或
 * 该分组平台不支持 Images API。两者都在创建任务前返回 404，因此降级到同步
 * 单次提交不会产生重复生成。
 */
export function isAsyncImageUnavailableError(err: unknown): boolean {
  if (!(err instanceof GenerationError) || err.status !== 404) return false
  return /async image tasks are not enabled|not supported for this platform/i.test(err.message)
}

/** 判定错误是否为「同一幂等键首次提交仍在进行中」：任务已存在，应凭 request_id 找回而非重提。 */
export function isIdempotencyInProgressError(err: unknown): boolean {
  return err instanceof GenerationError && err.code === CODE_IDEMPOTENCY_IN_PROGRESS
}

/** 判定错误是否为「同一幂等键被用于不同请求体」：客户端事务 ID 复用，必须响亮失败。 */
export function isIdempotencyConflictError(err: unknown): boolean {
  return err instanceof GenerationError && err.code === CODE_IDEMPOTENCY_KEY_CONFLICT
}

/**
 * 判定错误是否为「提交状态未知」——客户端无法确认请求是否已在服务端创建任务。
 * 超时、连接中断、502/503 都属于此类：**绝不允许自动重提或换模型**，只能凭
 * request_id 反查（见 image-transaction.ts）。
 */
export function isUnknownSubmitStateError(err: unknown): boolean {
  if (isCancelledError(err)) return false
  if (!(err instanceof GenerationError)) return true
  if (err.status !== undefined && err.status >= 500) return true
  return err.kind === 'timeout' || err.kind === 'network'
}

/**
 * 判定错误是否为「调用方主动取消」。取消同样可能发生在请求已抵达服务端之后，
 * 因此不视为「未提交」——只是不再做任何自动动作（找回/重提都不做）。
 */
export function isCancelledError(err: unknown): boolean {
  return err instanceof GenerationError && /已被取消/.test(err.message)
}

/**
 * 判定错误是否由服务端**在创建任务之前**返回——按 threerouter 的 HTTP 契约
 * （docs/ASYNC_IMAGE_TASKS.md「HTTP status code contract」），400/401/403/404/413/429
 * 都在落库之前拦截，因此这类错误可以安全地回退到下一候选服务商或降级传输；
 * 409 例外（IN_PROGRESS 时任务已存在），5xx/超时同样例外。
 */
export function isDefinitelyNoTaskError(err: unknown): boolean {
  if (!(err instanceof GenerationError)) return false
  if (err.status === undefined) return false
  return err.status >= 400 && err.status < 500 && err.status !== 409
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
  headers: Headers
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
    return { ok: true, status: res.status, data, headers: res.headers }
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
/**
 * 解析 Retry-After 响应头为毫秒（支持秒数与 HTTP 日期两种形态），上限 180s。
 * 导出供适配器读取 202/409 上的服务端建议轮询间隔。
 */
export function parseRetryAfterMs(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  const seconds = Number(value.trim())
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 180_000)
  const timestamp = Date.parse(value)
  if (!Number.isNaN(timestamp)) return Math.min(Math.max(0, timestamp - Date.now()), 180_000)
  return undefined
}

function classifyHttpError(status: number, data: unknown, url: string, retryAfterHeader?: string | null): GenerationError {
  const errMsg = extractErrorMessage(data)
  const code = extractErrorCode(data)
  if (status === 401) {
    return new GenerationError('auth', `鉴权失败（HTTP 401）：API Key 无效。${errMsg}`, false, status, undefined, code)
  }
  if (status === 403) {
    // threerouter 文档语义：403=分组未开通该能力（permission_error），401 才是 Key 无效
    return new GenerationError('auth', `权限失败（HTTP 403）：分组/模型未开通该能力，请联系服务方开通。${errMsg}`, false, status, undefined, code)
  }
  if (status === 429) {
    const retryAfterMs = parseRetryAfterMs(retryAfterHeader)
    return new GenerationError('quota', `配额耗尽（HTTP 429）：请求频率或额度超限，请稍后重试或检查账户余额。${errMsg}`, true, status, retryAfterMs, code)
  }
  if (status === 409) {
    // 幂等冲突：任务可能已创建（IN_PROGRESS），调用方必须先凭 request_id 反查。
    const retryAfterMs = parseRetryAfterMs(retryAfterHeader)
    return new GenerationError('task', `幂等冲突（HTTP 409）：${errMsg || '同一幂等键的请求已存在'}`, false, status, retryAfterMs, code)
  }
  if (status >= 500) {
    return new GenerationError('network', `服务端错误（HTTP ${status}），将重试。${errMsg}`, true, status, undefined, code)
  }
  return new GenerationError('task', `任务报错（HTTP ${status}）：${errMsg || '服务端返回错误'}，URL: ${url}`, false, status, undefined, code)
}

/**
 * 从响应体提取机器可读错误码，兼容 `{"error":{"code":…}}`、`{"error":{"type":…}}`
 * 与顶层 `code` / `type`。threerouter 网关的异步图片契约用的是
 * `{"error":{"type":code,"code":code,"message":msg}}`。
 */
function extractErrorCode(data: unknown): string | undefined {
  if (data === null || typeof data !== 'object') return undefined
  const obj = data as Record<string, unknown>
  const pick = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
  const error = obj.error
  if (error !== null && typeof error === 'object') {
    const errObj = error as Record<string, unknown>
    return pick(errObj.code) ?? pick(errObj.type)
  }
  return pick(obj.code) ?? pick(obj.type)
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
 * 鉴权失败与任务逻辑错误立即抛出；配额错误按 Retry-After 和 retryTimes 有限重试。
 * @returns 解析后的响应数据。
 * @throws {GenerationError} 分类后的生成错误。
 */
export async function request(opts: RequestOptions): Promise<unknown> {
  return (await requestFull(opts)).data
}

/**
 * 与 {@link request} 相同的重试/分类语义，但返回完整响应（含 status 与 headers）。
 *
 * 存在的唯一理由：生图事务必须读到 `X-Idempotency-Replayed`（本次是幂等回放、
 * 没有真正新建任务）与 `Retry-After`（409 进行中的锁窗口）——这两条信息只在
 * 响应头上，`request()` 会把它们丢掉。
 * @throws {GenerationError} 分类后的生成错误。
 */
export async function requestFull(opts: RequestOptions): Promise<RequestResult> {
  let lastError: GenerationError | undefined
  for (let attempt = 0; attempt <= opts.retryTimes; attempt++) {
    if (opts.signal?.aborted) {
      throw new GenerationError('timeout', '任务已被取消', false)
    }
    try {
      const result = await singleRequest(opts)
      if (result.status >= 200 && result.status < 300) {
        return result
      }
      throw classifyHttpError(result.status, result.data, opts.url, result.headers.get('retry-after'))
    } catch (err) {
      if (err instanceof GenerationError) {
        // 不可重试错误立即抛出
        if (!err.retryable) throw err
        lastError = err
        // 还有重试机会则退避等待
        if (attempt < opts.retryTimes) {
          const backoff = err.retryAfterMs ?? RETRY_BACKOFF_MS * Math.pow(2, attempt)
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
        throw classifyHttpError(res.status, data, url, res.headers.get('retry-after'))
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
