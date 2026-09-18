/**
 * 图片生成事务测试：核心断言只有一条——**一次调用最多一次计费提交**。
 * 覆盖：async 接受/超时找回/找回无果/同键重提/409 进行中/409 键冲突/异步不可用/
 * 明确拒绝模型可换家/未知状态禁止换家/提交预算/同步传输不重提/轮询超时保任务句柄。
 */

import { describe, it, expect, vi } from 'vitest'
import {
  AsyncTransportUnavailableError,
  DEFAULT_RECOVERY_BUDGET,
  canFallbackToNextProvider,
  consumeSubmitBudget,
  createImageTransaction,
  reportTransaction,
  resolveImageTransport,
  runImageTransaction,
} from '../src/image-transaction.ts'
import type { ImageTransaction, RecoveryBudget, UnknownStatePolicy } from '../src/image-transaction.ts'
import { GenerationError, CODE_IDEMPOTENCY_IN_PROGRESS } from '../src/http-client.ts'
import type { AsyncImageSubmit, HttpOpts, ImageAsyncCapability, ImageGenParams, ProviderAdapter, TaskQueryResult } from '../src/providers/types.ts'

const httpOpts: HttpOpts = {
  apiKey: 'sk-test',
  baseURL: 'https://gw.example.com/v1',
  timeoutMs: 10_000,
  retryTimes: 3,
  signal: new AbortController().signal,
}

const params: ImageGenParams = { prompt: '测试', size: '1024*1024', requestId: 'req-1' }

/** 测试用预算：极小间隔 + 注入的即时 sleep，保证测试不出真实等待。 */
const recovery: RecoveryBudget = { attempts: DEFAULT_RECOVERY_BUDGET.attempts, delayMs: 1 }

interface Harness {
  adapter: ProviderAdapter
  submit: ReturnType<typeof vi.fn>
  findByRequest: ReturnType<typeof vi.fn>
  query: ReturnType<typeof vi.fn>
  submitImage: ReturnType<typeof vi.fn>
  notes: string[]
  tx: ImageTransaction
  poll: ReturnType<typeof vi.fn>
  deps: Parameters<typeof runImageTransaction>[0]
}

/**
 * 组装一次事务调用所需的最小依赖。
 * @param opts - 各阶段行为注入：submit/findByRequest/query 的返回值或抛错函数。
 */
function harness(opts: {
  submit?: () => Promise<AsyncImageSubmit>
  findByRequest?: () => Promise<{ taskId: string } | undefined>
  query?: () => Promise<TaskQueryResult>
  submitImage?: () => Promise<{ taskId: string; async: boolean; mediaType: 'image'; mediaUrl?: string }>
  transport?: 'async' | 'sync'
  policy?: UnknownStatePolicy
  poll?: (taskId: string) => Promise<{ mediaUrl: string }>
  withAsync?: boolean
} = {}): Harness {
  const notes: string[] = []
  const submit = vi.fn(opts.submit ?? (async () => ({ taskId: 'imgtask_1' })))
  const findByRequest = vi.fn(opts.findByRequest ?? (async () => undefined))
  const query = vi.fn(opts.query ?? (async () => ({ status: 'succeeded', mediaUrl: 'https://cdn.example.com/a.png' })))
  const submitImage = vi.fn(opts.submitImage ?? (async () => ({
    taskId: '', async: false, mediaType: 'image' as const, mediaUrl: 'https://cdn.example.com/sync.png',
  })))
  const imageAsync: ImageAsyncCapability | undefined = opts.withAsync === false
    ? undefined
    : { submit, query, findByRequest }
  const adapter: ProviderAdapter = {
    submitImage,
    submitVideo: async () => ({ taskId: 'v', async: true, mediaType: 'video' }),
    queryTask: async () => ({ status: 'running' }),
    ...(imageAsync === undefined ? {} : { imageAsync }),
  }
  const poll = vi.fn(opts.poll ?? (async () => ({ mediaUrl: 'https://cdn.example.com/task.png' })))
  const tx = createImageTransaction({
    requestId: 'req-1',
    provider: 'threerouter',
    model: 'qwen-image-3.0',
    transport: opts.transport ?? 'async',
  })
  const deps: Parameters<typeof runImageTransaction>[0] = {
    tx,
    adapter,
    params,
    httpOpts,
    poll,
    unknownStatePolicy: opts.policy ?? 'fail',
    recovery,
    sleep: async () => {},
    onNote: (note) => { notes.push(note) },
  }
  return { adapter, submit, findByRequest, query, submitImage, notes, tx, poll, deps }
}

describe('图片生成事务：提交预算（绝不重复生成）', () => {
  it('异步接受 → 轮询成功：只提交一次', async () => {
    const h = harness()
    const result = await runImageTransaction(h.deps)
    expect(h.submit).toHaveBeenCalledTimes(1)
    expect(h.tx.submitAttempts).toBe(1)
    expect(h.tx.transport).toBe('async')
    expect(result.submit.mediaUrl).toBe('https://cdn.example.com/task.png')
    expect(result.submit.taskId).toBe('imgtask_1')
    expect(h.tx.status).toBe('succeeded')
  })

  it('同一事务内第二次提交被预算拒绝（硬闸门）', () => {
    const tx = createImageTransaction({ requestId: 'req', provider: 'threerouter', model: undefined, transport: 'async' })
    consumeSubmitBudget(tx)
    expect(() => { consumeSubmitBudget(tx) }).toThrow(/拒绝重复提交/)
    expect(tx.submitAttempts).toBe(1)
  })

  it('同键重提策略下预算放宽到 2，第三次仍拒绝', () => {
    const tx = createImageTransaction({ requestId: 'req', provider: 'threerouter', model: undefined, transport: 'async' })
    consumeSubmitBudget(tx)
    consumeSubmitBudget(tx, { allowSameKeyRetry: true })
    expect(tx.submitAttempts).toBe(2)
    expect(() => { consumeSubmitBudget(tx, { allowSameKeyRetry: true }) }).toThrow(/拒绝重复提交/)
  })
})

describe('图片生成事务：提交结果未知 → 找回原任务，不重提', () => {
  const timeout = (): Promise<never> => Promise.reject(new GenerationError('timeout', '请求超时（60000ms）', true))

  it('超时后凭 request_id 找回任务并继续等待（提交仍然只有一次）', async () => {
    const h = harness({
      submit: () => Promise.reject(new GenerationError('timeout', '请求超时', true)),
      findByRequest: async () => ({ taskId: 'imgtask_found' }),
    })
    const result = await runImageTransaction(h.deps)
    expect(h.submit).toHaveBeenCalledTimes(1)
    expect(h.findByRequest).toHaveBeenCalledTimes(1)
    expect(h.findByRequest).toHaveBeenCalledWith('req-1', httpOpts)
    expect(h.tx.recoveryLookups).toBe(1)
    expect(result.submit.taskId).toBe('imgtask_found')
    expect(h.tx.status).toBe('succeeded')
    expect(h.notes.join('\n')).toContain('未产生新的生成请求')
  })

  it('超时 + 反查无果 + 默认策略 → 响亮失败，绝不自动重提', async () => {
    const h = harness({
      submit: () => Promise.reject(new GenerationError('timeout', '请求超时', true)),
      findByRequest: async () => undefined,
    })
    await expect(runImageTransaction(h.deps)).rejects.toThrow(/不会自动重新生成/)
    expect(h.submit).toHaveBeenCalledTimes(1)
    expect(h.findByRequest).toHaveBeenCalledTimes(recovery.attempts)
    expect(h.tx.status).toBe('unknown')
    expect(h.tx.submitAttempts).toBe(1)
  })

  it('未知状态错误里必须带 request_id（用户找回的唯一凭据）', async () => {
    const h = harness({
      submit: () => Promise.reject(new GenerationError('network', '服务端错误（HTTP 502）', true, 502)),
      findByRequest: async () => undefined,
    })
    await expect(runImageTransaction(h.deps)).rejects.toThrow(/request_id=req-1/)
  })

  it('同键重提策略：反查无果后用**同一个幂等键**再提交一次（服务端按键去重）', async () => {
    const keys: Array<string | undefined> = []
    let attempt = 0
    const h = harness({
      policy: 'resubmit-same-key',
      findByRequest: async () => undefined,
    })
    // 用记录幂等键的 submit 覆盖适配器能力：第一次超时、第二次接受。
    h.deps.adapter.imageAsync = {
      submit: async (p: ImageGenParams): Promise<AsyncImageSubmit> => {
        keys.push(p.requestId)
        attempt += 1
        if (attempt === 1) throw new GenerationError('timeout', '请求超时', true)
        return { taskId: 'imgtask_retry' }
      },
      query: async () => ({ status: 'succeeded', mediaUrl: 'https://cdn.example.com/retry.png' }),
      findByRequest: async () => undefined,
    }
    const result = await runImageTransaction(h.deps)
    expect(keys).toEqual(['req-1', 'req-1'])
    expect(h.tx.submitAttempts).toBe(2)
    expect(h.tx.taskId).toBe('imgtask_retry')
    // 重提被接受后轮询的是**重提拿回的任务**，不是新造一个任务
    expect(h.poll).toHaveBeenCalledWith('imgtask_retry', expect.anything())
    expect(result.submit.mediaUrl).toBe('https://cdn.example.com/task.png')
    expect(h.notes.join('\n')).toContain('同一个幂等键重新提交')
  })

  it('取消提交 → 状态未知但不再做任何自动动作（不反查、不重提）', async () => {
    const h = harness({
      submit: () => Promise.reject(new GenerationError('timeout', '任务已被取消', false)),
    })
    await expect(runImageTransaction(h.deps)).rejects.toThrow(/已被取消/)
    expect(h.tx.status).toBe('unknown')
    expect(h.findByRequest).not.toHaveBeenCalled()
    expect(h.submit).toHaveBeenCalledTimes(1)
  })

  it('反查接口本身失败（网络）→ 继续重试到预算耗尽后按未知状态失败', async () => {
    const h = harness({
      submit: () => timeout(),
      findByRequest: async () => { throw new GenerationError('network', '反查网络失败', true) },
    })
    await expect(runImageTransaction(h.deps)).rejects.toThrow(/不会自动重新生成/)
    expect(h.findByRequest).toHaveBeenCalledTimes(recovery.attempts)
  })

  it('服务端幂等回放（X-Idempotency-Replayed）→ 记为回放并复用原任务', async () => {
    const h = harness({ submit: async () => ({ taskId: 'imgtask_old', replayed: true }) })
    const result = await runImageTransaction(h.deps)
    expect(h.tx.replayed).toBe(true)
    expect(result.submit.taskId).toBe('imgtask_old')
    expect(h.notes.join('\n')).toContain('幂等回放')
    expect(reportTransaction(h.tx).replayed).toBe(true)
  })
})

describe('图片生成事务：409 与端点能力的语义', () => {
  it('409 IDEMPOTENCY_IN_PROGRESS → 任务已存在，凭 request_id 找回而非重提', async () => {
    const inProgress = new GenerationError(
      'task',
      '幂等冲突（HTTP 409）：idempotency key is in progress',
      false,
      409,
      2_000,
      CODE_IDEMPOTENCY_IN_PROGRESS,
    )
    const h = harness({
      submit: () => Promise.reject(inProgress),
      findByRequest: async () => ({ taskId: 'imgtask_inflight' }),
    })
    const result = await runImageTransaction(h.deps)
    expect(h.submit).toHaveBeenCalledTimes(1)
    expect(result.submit.taskId).toBe('imgtask_inflight')
    expect(h.notes.join('\n')).toContain('凭 request_id 找回原任务')
    expect(h.tx.status).toBe('succeeded')
  })

  it('409 IDEMPOTENCY_KEY_CONFLICT → 响亮失败（客户端键复用 bug），且不允许换家', async () => {
    const conflict = new GenerationError('task', '幂等冲突：key reused with different payload', false, 409, undefined, 'IDEMPOTENCY_KEY_CONFLICT')
    const h = harness({ submit: () => Promise.reject(conflict) })
    await expect(runImageTransaction(h.deps)).rejects.toThrow(/同一个幂等键被用于不同请求体|幂等键被用于不同请求体/)
    expect(h.tx.status).toBe('failed')
    expect(canFallbackToNextProvider(conflict, h.tx)).toBe(false)
  })

  it('异步端点不可用（404 not enabled）→ 抛可识别错误供调用方降级同步', async () => {
    const unavailable = new GenerationError('task', '任务报错（HTTP 404）：async image tasks are not enabled', false, 404, undefined, 'not_found_error')
    const h = harness({ submit: () => Promise.reject(unavailable) })
    const err = await runImageTransaction(h.deps).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AsyncTransportUnavailableError)
    expect(h.tx.status).toBe('failed')
    expect(h.tx.degraded).toBe(true)
  })

  it('4xx 明确拒绝模型 → 状态 failed，允许换下一个候选服务商', async () => {
    const rejected = new GenerationError('task', '任务报错（HTTP 404）：model qwen-image-99 not found', false, 404)
    const h = harness({ submit: () => Promise.reject(rejected) })
    await expect(runImageTransaction(h.deps)).rejects.toThrow(/not found/)
    expect(h.tx.status).toBe('failed')
    expect(canFallbackToNextProvider(rejected, h.tx)).toBe(true)
  })

  it('未知状态（502）绝不允许换家', async () => {
    const boom = new GenerationError('network', '服务端错误（HTTP 502）', true, 502)
    const h = harness({
      submit: () => Promise.reject(boom),
      findByRequest: async () => undefined,
    })
    await expect(runImageTransaction(h.deps)).rejects.toThrow()
    expect(h.tx.status).toBe('unknown')
    expect(canFallbackToNextProvider(boom, h.tx)).toBe(false)
  })

  it('已提交过两次（同键重提）后不再允许换家', () => {
    const tx = createImageTransaction({ requestId: 'r', provider: 'threerouter', model: undefined, transport: 'async' })
    consumeSubmitBudget(tx)
    consumeSubmitBudget(tx, { allowSameKeyRetry: true })
    tx.status = 'failed'
    const rejected = new GenerationError('task', '模型不存在', false, 404)
    expect(canFallbackToNextProvider(rejected, tx)).toBe(false)
  })

  it('503 无可用渠道（capacity_error）→ 允许换家（渠道查找先于上游调用）', () => {
    const tx = createImageTransaction({ requestId: 'r', provider: 'threerouter', model: undefined, transport: 'sync' })
    consumeSubmitBudget(tx)
    tx.status = 'failed'
    const noChannel = new GenerationError('network', '服务端错误（HTTP 503），将重试。No available media generation channels', true, 503)
    expect(canFallbackToNextProvider(noChannel, tx)).toBe(true)
    const generic = new GenerationError('network', '服务端错误（HTTP 503），将重试。service unavailable', true, 503)
    expect(canFallbackToNextProvider(generic, tx)).toBe(false)
  })
})

describe('图片生成事务：同步传输', () => {
  it('同步直接返回结果 → 成功，只提交一次', async () => {
    const h = harness({ transport: 'sync' })
    const result = await runImageTransaction(h.deps)
    expect(h.submitImage).toHaveBeenCalledTimes(1)
    expect(h.submitImage).toHaveBeenCalledWith(params, expect.objectContaining({ retryTimes: 0 }))
    expect(result.submit.mediaUrl).toBe('https://cdn.example.com/sync.png')
    expect(h.tx.transport).toBe('sync')
  })

  it('同步提交超时 → 直接失败且绝不重提（同步端点没有幂等记录）', async () => {
    const h = harness({
      transport: 'sync',
      submitImage: () => Promise.reject(new GenerationError('timeout', '请求超时（600000ms）', true)),
    })
    await expect(runImageTransaction(h.deps)).rejects.toThrow(/同步端点没有幂等键记录/)
    expect(h.submitImage).toHaveBeenCalledTimes(1)
    expect(h.tx.status).toBe('unknown')
  })

  it('同步端点返回异步任务形态（processing + id）→ 轮询该任务', async () => {
    const h = harness({
      transport: 'sync',
      submitImage: async () => ({ taskId: 'media-88', async: true, mediaType: 'image' as const }),
      poll: async (taskId) => ({ mediaUrl: `https://cdn.example.com/${taskId}.png` }),
    })
    const result = await runImageTransaction(h.deps)
    expect(h.poll).toHaveBeenCalledWith('media-88', expect.anything())
    expect(result.submit.mediaUrl).toBe('https://cdn.example.com/media-88.png')
  })
})

describe('图片生成事务：轮询失败不丢失任务句柄', () => {
  it('已接受任务但轮询超时 → 错误里带 task_id 与 request_id，且没有重提', async () => {
    const h = harness({
      poll: async () => { throw new GenerationError('timeout', '生成任务轮询超时（300000ms）', false) },
    })
    const err = await runImageTransaction(h.deps).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GenerationError)
    expect((err as Error).message).toContain('imgtask_1')
    expect((err as Error).message).toContain('request_id=req-1')
    expect((err as Error).message).toContain('无需重新生成')
    expect(h.submit).toHaveBeenCalledTimes(1)
    expect(h.tx.status).toBe('failed')
  })

  it('任务本身失败（服务端 failed）→ 如实抛出，不重试', async () => {
    const h = harness({
      poll: async () => { throw new GenerationError('task', '上游 400：input new_sensitive', false) },
    })
    const err = await runImageTransaction(h.deps).catch((e: unknown) => e)
    expect((err as Error).message).toContain('图片任务执行失败')
    expect((err as Error).message).toContain('本次只提交过一次，不会自动重新生成')
    expect(h.submit).toHaveBeenCalledTimes(1)
  })
})

describe('传输方式解析', () => {
  const adapterWithAsync: ProviderAdapter = harness().adapter
  const adapterWithout: ProviderAdapter = harness({ withAsync: false }).adapter

  it('sync 配置强制同步；async 配置强制异步', () => {
    expect(resolveImageTransport('sync', adapterWithAsync, undefined)).toBe('sync')
    expect(resolveImageTransport('async', adapterWithAsync, undefined)).toBe('async')
  })

  it('auto：默认异步；服务商不支持异步时降级同步', () => {
    expect(resolveImageTransport('auto', adapterWithAsync, undefined)).toBe('async')
    expect(resolveImageTransport('auto', adapterWithout, undefined)).toBe('sync')
  })

  it('auto：探测缓存未过期时直接同步，过期后恢复异步', () => {
    const probe = { unavailableUntil: Date.now() + 60_000 }
    expect(resolveImageTransport('auto', adapterWithAsync, probe)).toBe('sync')
    expect(resolveImageTransport('auto', adapterWithAsync, { unavailableUntil: Date.now() - 1 })).toBe('async')
  })

  it('async 配置 + 服务商无异步能力 → 抛错（预检查会在提交前拦下）', async () => {
    const h = harness({ withAsync: false })
    await expect(runImageTransaction(h.deps)).rejects.toThrow(/不支持异步图片传输/)
  })
})
