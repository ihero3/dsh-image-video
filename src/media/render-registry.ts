/**
 * 导出任务的登记与取消（`T5-5` 的宿主半边）。
 *
 * 渲染是长任务，宿主没有推送通道，所以这里只维护**可轮询的任务快照**：
 * 客户端每隔一会儿来 `timelines/renders` 看进度，取消走 `timelines/render-cancel`。
 */
import { RenderError, type RenderResult, type RenderService } from './render.ts'
import type { TimelineRecord } from '../workbench/timeline.ts'

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
}

/** 导出任务表（内存态即可：进程重启后"运行中"的渲染按失败收尾）。 */
export class RenderRegistry {
  private readonly jobs = new Map<string, RenderJob>()
  private readonly controllers = new Map<string, AbortController>()

  constructor(private readonly deps: {
    readonly render: RenderService
    /** 成功后把产物登记成素材（可选）。 */
    readonly registerAsset?: (job: RenderJob) => Promise<void>
    readonly now?: () => Date
    readonly onError?: (message: string) => void
    /** 结构化日志钩子（`T7-3`）。 */
    readonly log?: (entry: Record<string, unknown>) => void
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
    if (controller === undefined) return false
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
    const job: RenderJob = {
      id, timelineId: timeline.id, projectId: timeline.projectId,
      status: 'running', percent: 0, startedAt: this.stamp(),
    }
    this.jobs.set(id, job)
    const controller = new AbortController()
    this.controllers.set(id, controller)

    void this.deps.render.render(timeline, {
      signal: controller.signal,
      onProgress: progress => { this.patch(id, { percent: progress.percent }) },
    }).then(async (result: RenderResult) => {
      this.patch(id, {
        status: 'succeeded', percent: 100, finishedAt: this.stamp(),
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
    }).finally(() => { this.controllers.delete(id) })

    return job
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
