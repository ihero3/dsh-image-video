/**
 * 异步任务管理器：基于 ctx.effect 托管轮询生命周期。
 * 提交任务后按配置间隔轮询状态，成功后下载媒体到 outputs/。
 * 插件卸载时，ctx.effect 注册的清理函数自动取消所有排队任务、清理定时器，杜绝内存泄漏。
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
  /** 服务商名称，用于日志。 */
  provider: string
}

/** 轮询完成结果。 */
export interface PollResult {
  /** 媒体下载 URL。 */
  mediaUrl: string
  /** 任务耗时（毫秒）。 */
  elapsedMs: number
}

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
   * @param adapter - 服务商适配器。
   * @param httpOpts - HTTP 请求选项（含凭证与超时）。
   * @param externalSignal - 外部取消信号（工具执行上下文的 exec.signal）。
   * @returns 媒体 URL 与耗时。
   * @throws {GenerationError} 任务失败、超时或被取消。
   */
  async pollUntilDone(
    taskId: string,
    adapter: ProviderAdapter,
    httpOpts: HttpOpts,
    externalSignal?: AbortSignal,
  ): Promise<PollResult> {
    const controller = new AbortController()
    const startTime = Date.now()

    // 联动外部取消信号
    const onExternalAbort = (): void => controller.abort()
    externalSignal?.addEventListener('abort', onExternalAbort)

    const task: ActiveTask = { controller, taskId, provider: httpOpts.apiKey.slice(0, 8) + '…' }
    this.active.set(taskId, task)

    try {
      const deadline = startTime + this.config.pollTimeoutMs
      while (Date.now() < deadline) {
        if (controller.signal.aborted) {
          throw new GenerationError('timeout', '生成任务已被取消', false)
        }
        const httpOptsWithSignal: HttpOpts = { ...httpOpts, signal: controller.signal }
        const result: TaskQueryResult = await adapter.queryTask(taskId, httpOptsWithSignal)
        if (result.status === 'succeeded') {
          return { mediaUrl: result.mediaUrl, elapsedMs: Date.now() - startTime }
        }
        if (result.status === 'failed') {
          throw new GenerationError('task', result.error, false)
        }
        // pending / running：等待轮询间隔后重试
        await this.sleep(this.config.pollIntervalMs, controller.signal)
      }
      throw new GenerationError('timeout', `生成任务轮询超时（${this.config.pollTimeoutMs}ms），任务可能仍在云端处理`, false)
    } finally {
      this.active.delete(taskId)
      externalSignal?.removeEventListener('abort', onExternalAbort)
    }
  }

  /** 获取当前进行中的任务数，供状态展示。 */
  get activeCount(): number {
    return this.active.size
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
