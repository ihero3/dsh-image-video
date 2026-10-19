/**
 * 导出任务的登记与取消（`T5-5` 的宿主半边）。
 *
 * 渲染是长任务，宿主没有推送通道，所以这里只维护**可轮询的任务快照**：
 * 客户端每隔一会儿来 `timelines/renders` 看进度，取消走 `timelines/render-cancel`。
 */
import { RenderError, type RenderResult, type RenderService } from './render.ts'
import type { TimelineRecord } from '../workbench/timeline.ts'
import { buildRenderSummary, type RenderSummary } from './render-summary.ts'

/** 一次导出任务的状态。 */
export interface RenderJob {
  readonly id: string
  readonly timelineId: string
  readonly projectId: string
  readonly status: 'running' | 'succeeded' | 'failed' | 'cancelled'
  readonly percent: number
  readonly startedAt: string
  readonly finishedAt?: string
  readonly outputPath?: string
  readonly bytes?: number
  readonly durationMs?: number
  /** 失败时的机器码（`RenderError#code`）。 */
  readonly code?: string
  readonly error?: string
  /**
   * 是否在**排队**等渲染槽位（`A4`）。注意这是加法字段：`status` 仍是 `running`，
   * 客户端不会因未知枚举而编译失败；等界面准备好后再用它显示"排队第 N 位"。
   */
  readonly queued?: boolean
  /** 排队位置（1 = 下一个开跑）；不在排队时为 `undefined`。 */
  readonly queuePosition?: number
  /** 导出完成摘要（`A37`，加法字段：产物/时长/规格/轨道概览）。 */
  readonly summary?: RenderSummary
}

/** 导出任务表（内存态即可：进程重启后"运行中"的渲染按失败收尾）。 */
export class RenderRegistry {
  private readonly jobs = new Map<string, RenderJob>()
  private readonly controllers = new Map<string, AbortController>()
  /** 最近完成任务的实际耗时（毫秒，`A21`；最多留 50 条）。 */
  private readonly durations: number[] = []

  /** 等待槽位的任务（FIFO，`A4`）。 */
  private readonly pending: Array<{ job: RenderJob; timeline: TimelineRecord }> = []

  constructor(private readonly deps: {
    readonly render: RenderService
    /** 成功后把产物登记成素材（可选）。 */
    readonly registerAsset?: (job: RenderJob) => Promise<void>
    readonly now?: () => Date
    readonly onError?: (message: string) => void
    /** 结构化日志钩子（`T7-3`）。 */
    readonly log?: (entry: Record<string, unknown>) => void
    /** 保留建议钩子的超时（毫秒，默认 2000）：钩子慢不能拖住"渲染成功"的状态流转。 */
    readonly retentionTimeoutMs?: number
    /** 导出后的保留建议钩子（`A38`）：返回 `undefined` 表示没配上限、不用提示。 */
    readonly retention?: () => Promise<{ files: number; bytes: number; removeCount: number; freedBytes: number; overQuota: boolean } | undefined>
    /** 同时最多跑几个渲染（`A4`，默认 1：ffmpeg 很吃 CPU，排队比挤爆好）。 */
    readonly maxConcurrent?: number
  }) {}

  private stamp(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }

  private patch(id: string, update: Partial<RenderJob>): void {
    const current = this.jobs.get(id)
    if (current === undefined) return
    this.jobs.set(id, { ...current, ...update })
  }

  /** 列出任务（最新在前），可按项目过滤。 */
  /** 记一次耗时（`A21`）：成功/失败/取消都算，最多留 50 条。 */
  private recordDuration(id: string): void {
    const job = this.jobs.get(id)
    if (job === undefined) return
    const started = Date.parse(job.startedAt)
    if (!Number.isFinite(started)) return
    this.durations.push(Math.max(0, Date.now() - started))
    if (this.durations.length > 50) this.durations.shift()
    const finished = this.jobs.get(id)
    this.deps.log?.({
      event: 'render-finished', renderId: id, status: finished?.status ?? 'unknown',
      durationMs: this.durations[this.durations.length - 1],
    })
  }

  /**
   * 渲染统计（`A21` 诊断用）：各结局计数 + 耗时中位数/P90。
   * @returns 统计快照（没有样本时 `durationMs` 为 `undefined`）。
   */
  stats(): {
    finished: number; failed: number; cancelled: number
    durationMs?: { p50: number; p90: number }
  } {
    const jobs = [...this.jobs.values()]
    const sortedDurations = [...this.durations].sort((left, right) => left - right)
    const percentile = (ratio: number): number => {
      if (sortedDurations.length === 0) return 0
      const index = Math.min(sortedDurations.length - 1, Math.floor(sortedDurations.length * ratio))
      return Math.round(sortedDurations[index] as number)
    }
    return {
      finished: jobs.filter(job => job.status === 'succeeded').length,
      failed: jobs.filter(job => job.status === 'failed').length,
      cancelled: jobs.filter(job => job.status === 'cancelled').length,
      ...sortedDurations.length === 0 ? {} : { durationMs: { p50: percentile(0.5), p90: percentile(0.9) } },
    }
  }

  list(projectId?: string): RenderJob[] {
    return [...this.jobs.values()]
      .filter(job => projectId === undefined || job.projectId === projectId)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
  }

  /** 取一个任务。 */
  get(id: string): RenderJob | undefined {
    return this.jobs.get(id)
  }

  /** 该任务是否还在跑。 */
  isRunning(id: string): boolean {
    return this.controllers.has(id)
  }

  /**
   * 取消一次导出（连带杀掉 ffmpeg）。
   * @param id - 任务 id。
   * @returns 是否确实取消了一个在跑的任务。
   */
  cancel(id: string): boolean {
    const controller = this.controllers.get(id)
    if (controller === undefined) {
      // 排队中的任务：直接从队列摘掉并标记取消（`A4`）
      const index = this.pending.findIndex(entry => entry.job.id === id)
      if (index < 0) return false
      this.pending.splice(index, 1)
      this.pending.forEach((entry, position) => { this.patch(entry.job.id, { queuePosition: position + 1 }) })
      this.patch(id, { status: 'cancelled', queued: false, queuePosition: undefined, finishedAt: this.stamp(), error: '排队时已取消' })
      return true
    }
    controller.abort()
    return true
  }

  /**
   * 起一次导出（立即返回任务快照，渲染在后台推进）。
   * @param timeline - 要渲染的时间轴（内部由 {@link RenderService} 冻结成快照）。
   * @returns 刚建立的任务。
   */
  start(timeline: TimelineRecord): RenderJob {
    const id = `render-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const maxConcurrent = Math.max(1, this.deps.maxConcurrent ?? 1)
    const job: RenderJob = {
      id, timelineId: timeline.id, projectId: timeline.projectId,
      status: 'running', percent: 0, startedAt: this.stamp(),
    }
    this.jobs.set(id, job)
    if (this.controllers.size >= maxConcurrent) {
      // 槽位满了：进队列（status 仍是 running，额外标记 queued + 位置）
      this.pending.push({ job, timeline })
      this.patch(id, { queued: true, queuePosition: this.pending.length })
      this.deps.log?.({ event: 'render-queued', renderId: id, timelineId: timeline.id, position: this.pending.length })
      return this.jobs.get(id) ?? job
    }
    this.launch(job.id, timeline)
    return this.jobs.get(id) ?? job
  }

  /** 真正开跑一个任务（内部：start 或出队时调用）。 */
  /**
   * 构建摘要并在需要时附上保留建议（`A38`）：钩子失败只记日志，绝不让渲染结果失败。
   */
  private async summarise(
    timeline: TimelineRecord,
    result: { readonly outputPath: string; readonly bytes: number; readonly durationMs: number },
  ): Promise<RenderSummary> {
    const summary = buildRenderSummary(timeline, result)
    if (this.deps.retention === undefined) return summary
    const timeoutMs = Math.max(200, this.deps.retentionTimeoutMs ?? 2000)
    let timedOut = false
    try {
      // 钩子（扫输出目录算建议）**不允许拖慢渲染完成**：超时就放弃建议，只记日志
      const retention = await Promise.race([
        this.deps.retention(),
        new Promise<undefined>(resolve => {
          const timer = setTimeout(() => { timedOut = true; resolve(undefined) }, timeoutMs)
          timer.unref?.()
        }),
      ])
      if (timedOut) {
        this.deps.log?.({ event: 'render-retention-timeout', timeoutMs })
        return summary
      }
      return retention === undefined ? summary : { ...summary, retention }
    } catch (error) {
      this.deps.log?.({ event: 'render-retention-failed', message: error instanceof Error ? error.message : String(error) })
      return summary
    }
  }

  private launch(id: string, timeline: TimelineRecord): void {
    const job = this.jobs.get(id)
    if (job === undefined) return
    this.patch(id, { queued: false, queuePosition: undefined })
    const controller = new AbortController()
    this.controllers.set(id, controller)

    void this.deps.render.render(timeline, {
      signal: controller.signal,
      onProgress: progress => { this.patch(id, { percent: progress.percent }) },
    }).then(async (result: RenderResult) => {
      this.patch(id, {
        status: 'succeeded', percent: 100, finishedAt: this.stamp(),
        summary: await this.summarise(timeline, result),
        outputPath: result.outputPath, bytes: result.bytes, durationMs: result.durationMs,
      })
      this.deps.log?.({
        event: 'render', renderId: id, timelineId: job.timelineId, status: 'succeeded',
        durationMs: Date.now() - Date.parse(job.startedAt), bytes: result.bytes, outputPath: result.outputPath,
      })
      const finished = this.jobs.get(id)
      if (finished !== undefined && this.deps.registerAsset !== undefined) {
        await this.deps.registerAsset(finished).catch(error => {
          this.deps.onError?.(`could not register render ${id}: ${error instanceof Error ? error.message : String(error)}`)
        })
      }
    }).catch((error: unknown) => {
      const cancelled = error instanceof RenderError && error.code === 'MEDIA_RENDER_CANCELLED'
      const message = error instanceof Error ? error.message : String(error)
      this.patch(id, {
        status: cancelled ? 'cancelled' : 'failed',
        finishedAt: this.stamp(),
        ...error instanceof RenderError ? { code: error.code } : {},
        error: message,
      })
      this.deps.log?.({
        event: 'render', renderId: id, timelineId: job.timelineId,
        status: cancelled ? 'cancelled' : 'failed', durationMs: Date.now() - Date.parse(job.startedAt),
        ...error instanceof RenderError ? { code: error.code } : {}, error: message,
      })
    }).finally(() => {
      this.recordDuration(id)
      this.controllers.delete(id)
      // 腾出槽位 → 按 FIFO 拉起下一个排队任务（`A4`）
      const next = this.pending.shift()
      if (next !== undefined) {
        this.pending.forEach((entry, index) => { this.patch(entry.job.id, { queuePosition: index + 1 }) })
        this.launch(next.job.id, next.timeline)
      }
    })
  }

  /** 进程重启时把遗留的"运行中"任务按失败收尾。 */
  failStale(reason: string): number {
    let closed = 0
    for (const [id, job] of this.jobs) {
      if (job.status !== 'running') continue
      closed += 1
      this.jobs.set(id, { ...job, status: 'failed', finishedAt: this.stamp(), error: reason })
      this.controllers.delete(id)
    }
    return closed
  }
}
