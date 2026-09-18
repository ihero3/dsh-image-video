/**
 * 图片生成事务（image generation transaction）：把「一次用户请求 = 最多一次
 * 计费生图提交」这条硬约束落成可测试的代码。
 *
 * 为什么需要它：图片生成是**写操作 + 计费操作**，且客户端无法事后撤销。
 * 提交请求超时/断连/502 时，客户端手上没有任何信息能区分
 *   (a) 请求根本没到服务端、没有任务；还是
 *   (b) 请求已到服务端、任务已创建并正在计费，只是响应丢了。
 * 因此本模块的铁律是：
 *
 *   1. **提交预算**：一个事务最多一次物理提交；唯一例外是显式开启
 *      `resubmit-same-key` 策略后用**同一个幂等键**再提交（服务端按键去重，
 *      不会重复生成），绝不存在「换了个请求再试一次」的路径。
 *   2. **未知状态绝不重提、绝不换模型**：超时/网络/5xx 一律先凭 requestId
 *      反查原任务（`findByRequest`），查到就继续等它；查不到按策略处理
 *      （默认响亮失败，把决定权交回用户）。
 *   3. **换家只在「服务端明确没建任务」时发生**：400/401/403/404/413 类
 *      「模型/分组不被接受」才允许回退下一候选服务商。
 *   4. **同步传输没有找回通道**：因此同步路径遇到未知状态直接失败，
 *      永远不自动重提（这是 async 传输存在的根本理由）。
 *
 * 依据：threerouter 网关异步图片契约的 HTTP 状态码表
 * （见 docs/threerouter-async-image-contract.md）。
 * @module dsh-image-video/image-transaction
 */

import type { Provider } from './config.ts'
import {
  GenerationError,
  isAsyncImageUnavailableError,
  isCancelledError,
  isDefinitelyNoTaskError,
  isIdempotencyConflictError,
  isIdempotencyInProgressError,
  isModelNotAcceptedError,
  isUnknownSubmitStateError,
} from './http-client.ts'
import type { HttpOpts, ImageGenParams, ProviderAdapter, SubmitResult } from './providers/types.ts'

/** 图片提交传输方式：async = 网关异步任务（有幂等与找回），sync = 同步端点（无幂等）。 */
export type ImageTransport = 'async' | 'sync'

/**
 * 提交状态未知（超时/断连/5xx 且找回无果）后的策略。
 * - `fail`（默认）：不自动重提，响亮失败并给出 requestId，由用户决定是否重试。
 * - `resubmit-same-key`：用**同一个幂等键**再提交一次。服务端保证同一键只创建
 *   一个任务（回放原响应或返回 409 进行中），因此不会重复生成；仅 async 传输可用。
 */
export type UnknownStatePolicy = 'fail' | 'resubmit-same-key'

/** 事务状态机取值。 */
export type TransactionStatus =
  /** 已创建，尚未提交。 */
  | 'idle'
  /** 提交请求已发出。 */
  | 'submitting'
  /** 服务端已接受任务（有 taskId）。 */
  | 'accepted'
  /** 提交结果未知：可能已创建任务，也可能没有——只能反查，不能重提。 */
  | 'unknown'
  /** 成功拿到结果。 */
  | 'succeeded'
  /** 明确失败：服务端在创建任务之前拒绝，或任务本身执行失败。 */
  | 'failed'

/**
 * 事务账本：一次 `generate_image` 调用对应一个实例，记录提交/找回/结果的
 * 全部事实，作为结果元数据回给用户（「本次到底提交了几次」必须可核对）。
 */
export interface ImageTransaction {
  /** 幂等键（服务端按 `Idempotency-Key` 去重，找回也用它）。 */
  readonly requestId: string
  /** 实际路由到的服务商。 */
  readonly provider: Provider
  /** 用户配置/工具参数指定的模型（适配器默认值不在其中）。 */
  readonly model: string | undefined
  /** 传输方式；async 不可用降级时会改为 sync。 */
  transport: ImageTransport
  status: TransactionStatus
  /** 物理提交次数（计费风险计数）：正常恒为 1，仅同键重提时为 2。 */
  submitAttempts: number
  /** 凭 requestId 反查原任务的次数（只读查询，不计费）。 */
  recoveryLookups: number
  /** 服务端任务 ID（提交被接受后可得）。 */
  taskId?: string
  /** 提交开始/结束时间戳（毫秒）。 */
  submitStartedAt?: number
  submitFinishedAt?: number
  /** 服务端幂等回放标记：为 true 时本次没有新建任务。 */
  replayed?: boolean
  /** 是否发生过降级（async → sync）或同键重提，供结果层透明告知。 */
  degraded?: boolean
}

/** 创建事务账本。 */
export function createImageTransaction(input: {
  requestId: string
  provider: Provider
  model: string | undefined
  transport: ImageTransport
}): ImageTransaction {
  return {
    requestId: input.requestId,
    provider: input.provider,
    model: input.model,
    transport: input.transport,
    status: 'idle',
    submitAttempts: 0,
    recoveryLookups: 0,
  }
}

/** 提交预算上限：默认 1；同键重提策略下允许 2（第二次必须复用同一个幂等键）。 */
export function submitBudget(options?: { allowSameKeyRetry?: boolean }): number {
  return options?.allowSameKeyRetry === true ? 2 : 1
}

/**
 * 消费一次提交预算。达到上限后再次调用一律抛错——这是「一次请求只生成一张」
 * 的硬闸门：任何异常路径都不可能在同一个事务里再发一次新的计费请求。
 * @throws {GenerationError} 当本事务已用尽提交预算。
 */
export function consumeSubmitBudget(tx: ImageTransaction, options?: { allowSameKeyRetry?: boolean }): void {
  if (tx.submitAttempts >= submitBudget(options)) {
    throw new GenerationError(
      'task',
      'dsh-image-video：本次生成事务已提交过一次生图请求，拒绝重复提交（防止重复扣费）',
      false,
    )
  }
  tx.submitAttempts += 1
  tx.status = 'submitting'
  tx.submitStartedAt = Date.now()
}

/** 标记提交阶段结束（成功或失败都会调用，供结果元数据展示耗时）。 */
function finishSubmit(tx: ImageTransaction): void {
  tx.submitFinishedAt = Date.now()
}

/**
 * 判定当前失败是否允许回退到**下一个候选服务商**。
 *
 * 与 `isModelNotAcceptedError` 的区别在于多了一层事务状态门：
 * - 状态必须停在 `failed`——即服务端明确表示「没有创建任务」；
 *   状态为 `unknown` 时绝不换家（否则可能两家各生成一张、各扣一次费）。
 * - 提交次数必须恰好为 1（未被同键重提污染）。
 * - 5xx 只有实证的「无可用渠道」形态才允许换家：网关按模型查渠道发生在调用上游
 *   之前，无渠道即无任务；其余 5xx 一律视为未知状态。
 * @param err - 提交抛出的错误。
 * @param tx - 当前事务账本。
 * @returns 是否允许换下一个候选服务商。
 */
export function canFallbackToNextProvider(err: unknown, tx: ImageTransaction): boolean {
  if (tx.status !== 'failed') return false
  if (tx.submitAttempts !== 1) return false
  if (isCancelledError(err)) return false
  if (isIdempotencyConflictError(err)) return false
  if (!isModelNotAcceptedError(err)) return false
  if (err instanceof GenerationError && err.status !== undefined && err.status >= 500) {
    // 唯一例外：无可用渠道（渠道查找先于上游调用，无渠道 = 无任务）。
    return /no available media generation channels|capacity_error/i.test(err.message)
  }
  return true
}

/** 结果元数据里的事务摘要（写进工具输出，让用户能核对「提交了几次」）。 */
export interface TransactionReport {
  requestId: string
  transport: ImageTransport
  submitAttempts: number
  recoveryLookups: number
  status: TransactionStatus
  taskId?: string
  replayed?: boolean
  degraded?: boolean
}

/** 导出事务摘要（缺省字段不出现在结果里，避免噪音）。 */
export function reportTransaction(tx: ImageTransaction): TransactionReport {
  return {
    requestId: tx.requestId,
    transport: tx.transport,
    submitAttempts: tx.submitAttempts,
    recoveryLookups: tx.recoveryLookups,
    status: tx.status,
    ...(tx.taskId === undefined ? {} : { taskId: tx.taskId }),
    ...(tx.replayed === undefined ? {} : { replayed: tx.replayed }),
    ...(tx.degraded === undefined ? {} : { degraded: tx.degraded }),
  }
}

/**
 * 构造「提交状态未知」错误。文案必须做到三件事：说清事实（可能已在计费）、
 * 说清客户端已经做了什么（按幂等键查过了、没查到）、给可执行的下一步
 * （凭 requestId 找回，或用户明确要求后重试）。
 */
export function unknownStateError(tx: ImageTransaction, cause: unknown): GenerationError {
  const causeText = cause instanceof Error ? cause.message : String(cause)
  return new GenerationError(
    'timeout',
    '图片请求已提交但客户端未收到结果（提交状态未知）。为避免重复扣费，本次不会自动重新生成，'
    + `也不会自动换模型。已按幂等键反查 ${String(tx.recoveryLookups)} 次，未查到对应任务。`
    + `request_id=${tx.requestId}（服务端保留 24 小时，可用 generate_image 的 recoverRequestId 参数找回）。`
    + `原始错误：${causeText}`,
    false,
  )
}

/** 找回查询预算（次数与间隔）。 */
export interface RecoveryBudget {
  /** 最多查询次数（含首次）。 */
  attempts: number
  /** 相邻两次查询之间的等待（毫秒）；服务端给了 Retry-After 时首次等待优先用它。 */
  delayMs: number
}

/** 事务执行依赖。 */
export interface RunImageTransactionDeps {
  tx: ImageTransaction
  adapter: ProviderAdapter
  params: ImageGenParams
  /** 提交与查询共用的 HTTP 选项（提交路径内部强制 retryTimes: 0）。 */
  httpOpts: HttpOpts
  /** 提交后的轮询实现（由工具层注入 TaskManager，本模块不关心轮询细节）。 */
  poll: (taskId: string, signal?: AbortSignal) => Promise<{ mediaUrl: string }>
  /** 未知状态策略。 */
  unknownStatePolicy: UnknownStatePolicy
  /** 找回查询预算。 */
  recovery: RecoveryBudget
  /** 可注入的等待实现（测试用假时钟）。 */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  /** 过程日志（由工具层转成 notes，透明告知用户为什么走了这条路）。 */
  onNote?: (note: string) => void
}

/** 事务结果。 */
export interface RunImageTransactionResult {
  submit: SubmitResult
  transport: ImageTransport
}

/**
 * 执行图片生成事务：**最多一次提交**，提交后轮询结果；提交结果未知时凭幂等键
 * 找回原任务，而不是重新生成。
 *
 * 分支与依据（服务端 HTTP 契约表）：
 * - 202 接受 → 轮询 `task_id`；`X-Idempotency-Replayed` 为真表示本次未新建任务。
 * - 409 `IDEMPOTENCY_IN_PROGRESS` → 任务已存在 → 按 Retry-After 等一下再反查。
 * - 409 `IDEMPOTENCY_KEY_CONFLICT` → 幂等键被复用于不同请求体（客户端 bug）→ 响亮失败。
 * - 404 异步端点不可用 → 抛 {@link AsyncTransportUnavailableError}，由调用方降级同步
 *   （服务端在创建任务前返回，降级不会重复生成）。
 * - 4xx 其他（400/401/403/413/429）→ 明确没建任务 → 状态置 `failed`，允许换候选。
 * - 超时 / 断连 / 5xx → 状态置 `unknown` → 反查；查到就继续等，查不到按策略处理。
 *
 * @returns 提交结果与最终使用的传输方式。
 * @throws {AsyncTransportUnavailableError} 异步端点在本环境不可用（请降级同步）。
 * @throws {GenerationError} 其他分类错误；`tx.status` 反映是否允许换候选。
 */
export async function runImageTransaction(deps: RunImageTransactionDeps): Promise<RunImageTransactionResult> {
  const { tx, adapter, params, httpOpts } = deps
  const note = deps.onNote ?? (() => {})
  const api = adapter.imageAsync

  if (tx.transport === 'async' && api === undefined) {
    throw new GenerationError('task', `服务商 ${tx.provider} 不支持异步图片传输（缺少 imageAsync 能力）`, false)
  }
  if (tx.transport === 'sync' || api === undefined) {
    return await runSyncAttempt(deps)
  }

  // 提交与轮询的异常必须分流：提交失败可能「状态未知」（要反查），
  // 而一旦提交被接受，任务句柄就是确定事实——轮询失败只意味着「结果还没拿到」，
  // 绝不能退回「提交状态未知」再走一次反查/重提逻辑。
  let accepted: { taskId: string; model?: string } | undefined
  try {
    accepted = await submitAsyncOnce(tx, api, params, httpOpts, note)
  } catch (err) {
    return await handleSubmitFailure(deps, err)
  }
  if (accepted === undefined) {
    throw new GenerationError('task', '生图事务内部错误：提交结果缺失', false)
  }
  const mediaUrl = await awaitTask(deps, accepted.taskId)
  tx.status = 'succeeded'
  return {
    submit: {
      taskId: accepted.taskId,
      async: false,
      mediaUrl,
      mediaType: 'image',
      ...(accepted.model === undefined ? {} : { model: accepted.model }),
    },
    transport: 'async',
  }
}

/**
 * 提交失败后的分流：明确没建任务的错误直接抛出（允许换候选），
 * 状态未知的错误先凭幂等键反查原任务，绝不重提。
 * @returns 找回成功时的事务结果。
 * @throws {AsyncTransportUnavailableError} 异步端点不可用（调用方降级同步）。
 * @throws {GenerationError} 分类后的失败；`tx.status` 标明是否允许换候选。
 */
async function handleSubmitFailure(
  deps: RunImageTransactionDeps,
  err: unknown,
): Promise<RunImageTransactionResult> {
  const { tx } = deps
  const note = deps.onNote ?? (() => {})

  if (isCancelledError(err)) {
    // 取消发生在提交之后：请求可能已抵达服务端，状态未知，不再做任何自动动作。
    tx.status = 'unknown'
    throw err
  }
  if (isIdempotencyConflictError(err)) {
    tx.status = 'failed'
    throw new GenerationError(
      'task',
      `生图提交被服务端拒绝：幂等键被用于不同请求体（request_id=${tx.requestId}）。`
      + '这是客户端事务 ID 复用问题，请把该 request_id 提供给插件维护者排查',
      false,
      err instanceof GenerationError ? err.status : undefined,
      undefined,
      err instanceof GenerationError ? err.code : undefined,
    )
  }
  if (isAsyncImageUnavailableError(err)) {
    // 服务端在创建任务前返回 404：异步传输在本环境不可用，降级同步不会重复生成。
    tx.status = 'failed'
    tx.degraded = true
    throw new AsyncTransportUnavailableError(err instanceof Error ? err.message : String(err))
  }
  if (isIdempotencyInProgressError(err)) {
    // 任务确实已创建（首次提交仍在处理中）：只能等锁窗口过去再反查。
    tx.status = 'unknown'
    const retryAfterMs = err instanceof GenerationError ? err.retryAfterMs : undefined
    note('服务端报告同一幂等键的提交仍在进行中：任务已存在，改为凭 request_id 找回原任务（不重新生成）')
    return await recoverResult(deps, err, retryAfterMs)
  }
  if (isDefinitelyNoTaskError(err)) {
    // 4xx（除 409）：服务端在落库前拦截，明确没有任务 → 允许换候选。
    tx.status = 'failed'
    throw err
  }
  // 超时 / 断连 / 5xx / 非预期错误：状态未知，先反查。
  tx.status = 'unknown'
  note('提交结果未知（超时/断连/5xx）：不重新提交、不换模型，先凭 request_id 反查原任务')
  return await recoverResult(deps, err)
}

/**
 * 凭幂等键找回原任务：查到就继续轮询它（不产生新的生成请求），查不到按策略处理。
 *
 * 404 有两重含义（服务端契约）：该键无记录，**或**记录仍在进行中、响应体尚未落库——
 * 因此必须按预算重试若干次再下结论，不能一次 404 就断定任务不存在。
 * @throws {GenerationError} 找回无果且策略为 fail 时的「状态未知」错误。
 */
async function recoverResult(
  deps: RunImageTransactionDeps,
  cause: unknown,
  firstDelayMs?: number,
): Promise<RunImageTransactionResult> {
  const { tx, httpOpts } = deps
  const note = deps.onNote ?? (() => {})
  const sleep = deps.sleep ?? defaultSleep
  const api = deps.adapter.imageAsync
  if (api === undefined) throw unknownStateError(tx, cause)

  let delay = firstDelayMs ?? deps.recovery.delayMs
  for (let attempt = 0; attempt < deps.recovery.attempts; attempt++) {
    await sleep(delay, httpOpts.signal)
    tx.recoveryLookups += 1
    let found: { taskId: string } | undefined
    try {
      found = await api.findByRequest(tx.requestId, httpOpts)
    } catch (lookupErr) {
      // 查询本身失败（网络/5xx）：状态依旧未知，继续下一次尝试。
      note(`按 request_id 反查失败（第 ${String(tx.recoveryLookups)} 次）：${lookupErr instanceof Error ? lookupErr.message : String(lookupErr)}`)
      delay = deps.recovery.delayMs
      continue
    }
    if (found !== undefined) {
      tx.taskId = found.taskId
      tx.status = 'accepted'
      note(`已凭 request_id 找回原任务 ${found.taskId}：继续等待该任务结果，未产生新的生成请求`)
      const mediaUrl = await awaitTask(deps, found.taskId)
      tx.status = 'succeeded'
      return {
        submit: { taskId: found.taskId, async: false, mediaUrl, mediaType: 'image', ...(tx.model === undefined ? {} : { model: tx.model }) },
        transport: 'async',
      }
    }
    delay = deps.recovery.delayMs
  }

  if (deps.unknownStatePolicy === 'resubmit-same-key' && tx.submitAttempts < submitBudget({ allowSameKeyRetry: true })) {
    // 同一幂等键再提交：服务端按键去重（回放原响应或 409 进行中），不会重复生成；
    // 目的是把丢失的提交响应重新取回来。
    note('反查无果且策略允许：用同一个幂等键重新提交（服务端按键去重，不会重复生成）')
    let accepted: { taskId: string; model?: string }
    try {
      accepted = await submitAsyncOnce(tx, api, deps.params, httpOpts, note, { allowSameKeyRetry: true })
    } catch (resubmitErr) {
      tx.status = 'unknown'
      throw unknownStateError(tx, resubmitErr)
    }
    const mediaUrl = await awaitTask(deps, accepted.taskId)
    tx.status = 'succeeded'
    return {
      submit: { taskId: accepted.taskId, async: false, mediaUrl, mediaType: 'image', ...(accepted.model === undefined ? {} : { model: accepted.model }) },
      transport: 'async',
    }
  }

  throw unknownStateError(tx, cause)
}

/**
 * 轮询任务直到有结果。走到这里任务已确定存在（有 taskId），因此失败不再涉及
 * 「是否重复生成」：只需把任务句柄带进错误，供用户稍后找回或直接判定任务失败。
 */
async function awaitTask(deps: RunImageTransactionDeps, taskId: string): Promise<string> {
  try {
    return (await deps.poll(taskId, deps.httpOpts.signal)).mediaUrl
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    // 任务级失败（上游拒绝、内容审核等）是终态：如实报错，不需要找回。
    if (err instanceof GenerationError && err.kind === 'task') {
      deps.tx.status = 'failed'
      throw new GenerationError(
        'task',
        `图片任务执行失败：${detail}（task_id=${taskId}，request_id=${deps.tx.requestId}；`
        + '本次只提交过一次，不会自动重新生成）',
        false,
      )
    }
    // 超时/网络类：任务仍可能在服务端完成，把句柄交出去供找回。
    deps.tx.status = 'failed'
    throw new GenerationError(
      'timeout',
      `图片任务已创建（task_id=${taskId}，request_id=${deps.tx.requestId}）但客户端未等到结果：${detail}。`
      + '任务仍在服务端执行/缓存，可直接用 recoverRequestId 找回，无需重新生成',
      false,
    )
  }
}

/**
 * 消费提交预算并执行一次异步提交。服务端 202 即代表任务已落库，
 * 因此 `tx.taskId` 在此刻成为确定事实。
 */
async function submitAsyncOnce(
  tx: ImageTransaction,
  api: NonNullable<ProviderAdapter['imageAsync']>,
  params: ImageGenParams,
  httpOpts: HttpOpts,
  note: (note: string) => void,
  options?: { allowSameKeyRetry?: boolean },
): Promise<{ taskId: string; model?: string }> {
  consumeSubmitBudget(tx, options)
  try {
    const accepted = await api.submit(params, httpOpts)
    tx.taskId = accepted.taskId
    tx.status = 'accepted'
    if (accepted.replayed === true) {
      tx.replayed = true
      note(`服务端幂等回放：本次没有新建任务，直接复用原任务 ${accepted.taskId}`)
    }
    return { taskId: accepted.taskId, ...(accepted.model === undefined ? {} : { model: accepted.model }) }
  } finally {
    finishSubmit(tx)
  }
}

/**
 * 同步传输分支：调适配器的同步提交（内部强制 `retryTimes: 0`），拿到结果或任务句柄。
 * 同步端点没有幂等键记录，因此未知状态一律直接失败——**绝不重提**。
 */
async function runSyncAttempt(deps: RunImageTransactionDeps): Promise<RunImageTransactionResult> {
  const { tx, adapter, params, httpOpts } = deps
  const note = deps.onNote ?? (() => {})
  consumeSubmitBudget(tx)
  let submit: SubmitResult
  try {
    submit = await adapter.submitImage(params, { ...httpOpts, retryTimes: 0 })
    tx.status = 'accepted'
    if (submit.async && submit.taskId !== '') tx.taskId = submit.taskId
    finishSubmit(tx)
  } catch (err) {
    finishSubmit(tx)
    if (isCancelledError(err)) {
      tx.status = 'unknown'
      throw err
    }
    if (isDefinitelyNoTaskError(err)) {
      tx.status = 'failed'
      throw err
    }
    if (isModelNotAcceptedError(err) && !isUnknownSubmitStateError(err)) {
      tx.status = 'failed'
      throw err
    }
    if (isModelNotAcceptedError(err)) {
      // 「无可用渠道」类 5xx：渠道查找先于上游调用，可以安全换候选。
      tx.status = 'failed'
      throw err
    }
    tx.status = 'unknown'
    throw new GenerationError(
      'timeout',
      '同步图片请求已提交但客户端未收到结果（提交状态未知）。同步端点没有幂等键记录，'
      + '为避免重复扣费，本次不会自动重新生成，也不会自动换模型。'
      + `request_id=${tx.requestId}。原始错误：${err instanceof Error ? err.message : String(err)}`,
      false,
    )
  }
  // 同步端点也可能返回异步任务形态（统一入口的 processing 形态）：有 taskId 就轮询。
  if (submit.async && submit.taskId !== '') {
    note(`服务商同步端点返回了异步任务形态，改为轮询任务 ${submit.taskId}`)
    const mediaUrl = await awaitTask(deps, submit.taskId)
    tx.status = 'succeeded'
    return { submit: { ...submit, async: false, mediaUrl }, transport: 'sync' }
  }
  if (submit.mediaBase64 === undefined && (submit.mediaUrl === undefined || submit.mediaUrl === '')) {
    tx.status = 'failed'
    throw new GenerationError('task', '生成失败：服务端既未返回图片 URL 也未返回图片数据', false)
  }
  tx.status = 'succeeded'
  return { submit, transport: 'sync' }
}

/** 异步图片传输在本环境不可用（功能未开启 / 分组平台不支持）：调用方应降级同步。 */
export class AsyncTransportUnavailableError extends GenerationError {
  constructor(detail: string) {
    super(
      'task',
      `异步图片端点在本环境不可用（${detail}）。将降级为同步单次提交：同步路径没有幂等键记录，`
      + '因此客户端不会自动重试，也不会在提交超时后重新生成',
      false,
      404,
      undefined,
      CODE_ASYNC_UNAVAILABLE,
    )
    this.name = 'AsyncTransportUnavailableError'
  }
}

/** 异步端点不可用的错误码（工具层据此决定降级）。 */
export const CODE_ASYNC_UNAVAILABLE = 'ASYNC_IMAGE_UNAVAILABLE'

/** 可被取消的等待。 */
function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
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

/** 传输能力探测缓存：避免每次调用都为一个已知不可用的端点付一次 404 往返。 */
export interface TransportProbeCache {
  /** 已知不可用状态持续到该时间点（毫秒时间戳）。 */
  unavailableUntil: number
}

/** 传输能力探测缓存有效期：服务端上线/开启对象存储后自动恢复，无需重启客户端。 */
export const TRANSPORT_PROBE_TTL_MS = 10 * 60 * 1_000

/** 默认找回预算：5 次、间隔 5 秒（服务端提交响应通常秒级落库）。 */
export const DEFAULT_RECOVERY_BUDGET: RecoveryBudget = { attempts: 5, delayMs: 5_000 }

/**
 * 依据配置与探测缓存决定本次调用的传输方式。
 * - `sync`：强制同步（无幂等，仅单次提交保障）。
 * - `async`：强制异步；端点不可用时响亮失败（上线验收用这个口径）。
 * - `auto`：优先异步，服务商不支持或近期探测到不可用时降级同步。
 */
export function resolveImageTransport(
  configured: 'async' | 'sync' | 'auto',
  adapter: ProviderAdapter,
  probe: TransportProbeCache | undefined,
  now: number = Date.now(),
): ImageTransport {
  if (configured === 'sync') return 'sync'
  if (adapter.imageAsync === undefined) return 'sync'
  if (configured === 'async') return 'async'
  if (probe !== undefined && probe.unavailableUntil > now) return 'sync'
  return 'async'
}
