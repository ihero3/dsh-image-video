/**
 * 异步任务管理器：基于 ctx.effect 托管轮询生命周期。
 * 提交任务后按配置间隔轮询状态，成功后由调用方下载媒体。
 * 插件卸载时，ctx.effect 注册的清理函数自动取消所有排队任务、清理定时器，杜绝内存泄漏。
 *
 * 轮询的可靠性约定（与「绝不重复生成」配套）：
 *   - 轮询是**只读**操作，因此允许对瞬时故障（网络抖动 / 超时 / 5xx / 限流）
 *     继续重试到整体超时为止——任务已经创建，扔掉它才是真正的浪费；
 *   - 连续查询失败超过阈值才放弃，且错误信息里必须带出 task_id，让上层能
 *     告知用户「任务还在服务端，可用 request_id 找回」；
 *   - 任务本身报失败（服务端返回 failed）属于终态，立即抛出，不做无谓等待。
 * @module dsh-image-video/task-manager
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ProviderAdapter, HttpOpts, TaskQueryResult } from './providers/types.ts'
import { GenerationError } from './http-client.ts'
import type { Config } from './config.ts'

/** 单个轮询任务的可取消句柄。 */
interface ActiveTask {
  /** 该任务的取消控制器，卸载或外部取消时 abort。 */
  controller: AbortController
  /** 任务 ID，用于日志。 */
  taskId: string
  /** 任务标签（服务商/用途），用于日志。 */
  label: string
}

/** 轮询完成结果。 */
export interface PollResult {
  /** 媒体下载 URL。 */
  mediaUrl: string
  /** 任务耗时（毫秒）。 */
  elapsedMs: number
}

/**
 * 查询函数签名：可由适配器（视频/自带异步任务的服务商）或专门的图片任务查询
 * 实现（网关 `/images/tasks/{id}`）提供。
 */
export type TaskQueryFn = (taskId: string, opts: HttpOpts) => Promise<TaskQueryResult>

/** 连续查询失败阈值：超过即认为轮询链路已断，交回上层收口（任务仍在服务端）。 */
const MAX_CONSECUTIVE_QUERY_FAILURES = 5

/**
 * 任务管理器：管理所有进行中的生成任务轮询。
 * 在 apply() 中实例化，通过 ctx.effect 注册卸载清理。
 */
export class TaskManager {
  /** 进行中的任务，key 为 taskId。 */
  private readonly active = new Map<string, ActiveTask>()
  /** 配置引用。 */
  private readonly config: Config

  constructor(ctx: Context, config: Config) {
    this.config = config
    // 核心清理：插件卸载时取消所有排队中的任务，清理所有轮询定时器。
    // ctx.effect 返回的清理函数由框架在 fiber dispose 时调用。
    ctx.effect(() => (): void => {
      for (const task of this.active.values()) {
        task.controller.abort()
      }
      this.active.clear()
    })
  }

  /**
   * 轮询任务直到完成、失败或超时。
   * 使用 AbortSignal 支持外部取消（插件卸载或工具调用超时）。
   * 轮询过程中不产生中间输出，仅最终结果返回给模型，不阻塞对话上下文。
   * @param taskId - 服务商返回的任务 ID。
   * @param query - 查询实现：适配器实例（用其 queryTask）或直接的查询函数。
   * @param httpOpts - HTTP 请求选项（含凭证与超时）。
   * @param externalSignal - 外部取消信号（工具执行上下文的 exec.signal）。
   * @returns 媒体 URL 与耗时。
   * @throws {GenerationError} 任务失败、超时或被取消（超时错误带 task_id）。
   */
  async pollUntilDone(
    taskId: string,
    query: ProviderAdapter | TaskQueryFn,
    httpOpts: HttpOpts,
    externalSignal?: AbortSignal,
  ): Promise<PollResult> {
    const controller = new AbortController()
    const startTime = Date.now()
    const queryFn: TaskQueryFn = typeof query === 'function'
      ? query
      : (id, opts) => query.queryTask(id, opts)

    // 联动外部取消信号
    const onExternalAbort = (): void => controller.abort()
    externalSignal?.addEventListener('abort', onExternalAbort)

    const task: ActiveTask = { controller, taskId, label: `${httpOpts.baseURL}#${taskId}` }
    this.active.set(taskId, task)

    try {
      const deadline = startTime + this.config.pollTimeoutMs
      let consecutiveFailures = 0
      while (Date.now() < deadline) {
        if (controller.signal.aborted) {
          throw new GenerationError('timeout', '生成任务已被取消', false)
        }
        const httpOptsWithSignal: HttpOpts = {
          ...httpOpts,
          timeoutMs: Math.min(httpOpts.timeoutMs, 30_000),
          signal: controller.signal,
        }
        let result: TaskQueryResult
        try {
          result = await queryFn(taskId, httpOptsWithSignal)
          consecutiveFailures = 0
        } catch (err) {
          if (controller.signal.aborted) throw err
          // 只读查询的瞬时故障：继续等（任务已创建，放弃它才是真正的浪费）。
          if (!this.isTransientQueryError(err)) throw err
          consecutiveFailures += 1
          if (consecutiveFailures >= MAX_CONSECUTIVE_QUERY_FAILURES) {
            throw new GenerationError(
              'timeout',
              `查询图片/视频任务状态连续失败 ${consecutiveFailures} 次（task_id=${taskId}）：`
              + `${err instanceof Error ? err.message : String(err)}。任务未丢失，可用 request_id 稍后找回`,
              false,
            )
          }
          await this.sleep(this.config.pollIntervalMs, controller.signal)
          continue
        }
        if (result.status === 'succeeded') {
          return { mediaUrl: result.mediaUrl, elapsedMs: Date.now() - startTime }
        }
        if (result.status === 'failed') {
          throw new GenerationError('task', result.error, false)
        }
        // pending / running：等待轮询间隔后重试
        await this.sleep(this.config.pollIntervalMs, controller.signal)
      }
      throw new GenerationError(
        'timeout',
        `生成任务轮询超时（${this.config.pollTimeoutMs}ms）：task_id=${taskId} 仍在服务端执行/缓存，`
        + '本次不重新提交（避免重复扣费），可稍后用 request_id 找回',
        false,
      )
    } finally {
      this.active.delete(taskId)
      externalSignal?.removeEventListener('abort', onExternalAbort)
    }
  }

  /** 获取当前进行中的任务数，供状态展示。 */
  get activeCount(): number {
    return this.active.size
  }

  /**
   * 判定查询阶段的错误是否属于「瞬时故障、值得继续轮询」。
   * 可重试分类（网络/超时/5xx/限流）与不可重试的鉴权/参数错误区分开：
   * 后者继续轮询只会白等，立即抛出。
   */
  private isTransientQueryError(err: unknown): boolean {
    if (!(err instanceof GenerationError)) return true
    if (err.retryable) return true
    if (err.status !== undefined && err.status >= 500) return true
    return false
  }

  /** 可被取消的延时；信号触发时立即 reject。 */
  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new GenerationError('timeout', '生成任务已被取消', false))
        return
      }
      const timer = setTimeout(resolve, ms)
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new GenerationError('timeout', '生成任务已被取消', false))
      }, { once: true })
    })
  }
}
