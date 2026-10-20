/**
 * 导出任务的登记与取消（`T5-5` 的宿主半边）。
 *
 * 渲染是长任务，宿主没有推送通道，所以这里只维护**可轮询的任务快照**：
 * 客户端每隔一会儿来 `timelines/renders` 看进度，取消走 `timelines/render-cancel`。
 */
import { MAX_AUTO_RETRIES, isTransientRenderFailure } from './retry-policy.ts'
import { RenderError, type RenderResult, type RenderService } from './render.ts'
import type { TimelineRecord } from '../workbench/timeline.ts'
import { normalizeExportFormat } from '../workbench/timeline.ts'
import { buildRenderSummary, type RenderSummary } from './render-summary.ts'
import { diagnoseRenderError, type Diagnosis } from './diagnose.ts'
import { freezeTimeline, planVideoSegments } from './render.ts'

/** 一次导出任务的状态。 */
/**
 * 把全局百分比换算成"第 N 段 / 共 M 段"（`A41`）。
 * @param bounds - 各段**累计结束**毫秒（升序）。
 * @param percent - 全局进度（0–100）。
 * @returns 段序号；边界为空时返回 `undefined`。
 */
/**
 * 估算剩余时间（`A52`）：按"已耗时 / 已完成比例"线性外推。
 *
 * 刻意**很早不给估计**（进度 < 5% 或已耗时 < 1s 时返回 `undefined`）：这时外推误差极大，
 * 给出一个乱跳的数字比不给更糟。
 *
 * @param percent - 当前进度（0–100）。
 * @param elapsedMs - 已耗时（毫秒）。
 * @returns 预计剩余秒数（四舍五入）；不该给估计时返回 `undefined`。
 */
/**
 * ETA 平滑器（`A92`）：用**指数滑动平均**估计"每 1% 进度要多久"。
 *
 * 为什么不直接线性外推：ffmpeg 各段耗时差异大（转场/滤镜段明显更慢），
 * 逐次外推的 ETA 会来回跳。丢几个抖动采样进 EMA 后就稳得多，且最终收敛到真实速率。
 */
export class EtaTracker {
  /** 平滑系数：越大越跟手、越小越稳（0.3 是经验值）。 */
  private readonly alpha: number
  private ratePerPercent?: number
  private lastPercent?: number
  private lastAtMs?: number

  constructor(options: { alpha?: number } = {}) {
    this.alpha = Math.min(0.9, Math.max(0.05, options.alpha ?? 0.3))
  }

  /**
   * 喂一个进度采样。
   * @param percent - 当前进度（0–100，应单调不减）。
   * @param atMs - 采样时刻。
   * @returns 平滑后的预计剩余秒数；过早（<5%）或首个采样时返回 `undefined`。
   */
  update(percent: number, atMs: number): number | undefined {
    if (!Number.isFinite(percent) || !Number.isFinite(atMs)) return undefined
    const previousPercent = this.lastPercent
    const previousAt = this.lastAtMs
    this.lastPercent = percent
    this.lastAtMs = atMs
    if (previousPercent === undefined || previousAt === undefined) return undefined
    const deltaPercent = percent - previousPercent
    const deltaMs = atMs - previousAt
    if (deltaPercent <= 0 || deltaMs <= 0) {
      // 进度没动（同一次回调重复/暂停）：沿用旧速率
      return this.currentEta(percent)
    }
    const instant = deltaMs / deltaPercent
    this.ratePerPercent = this.ratePerPercent === undefined ? instant : this.alpha * instant + (1 - this.alpha) * this.ratePerPercent
    return this.currentEta(percent)
  }

  /** 用当前平滑速率算剩余秒数（过早不给）。 */
  private currentEta(percent: number): number | undefined {
    if (percent < 5 || percent >= 100 || this.ratePerPercent === undefined) return undefined
    return Math.max(0, Math.round((this.ratePerPercent * (100 - percent)) / 1000))
  }
}

export function estimateEtaSec(percent: number, elapsedMs: number): number | undefined {
  if (!Number.isFinite(percent) || percent < 5 || percent >= 100) return undefined
  if (!Number.isFinite(elapsedMs) || elapsedMs < 1000) return undefined
  return Math.max(0, Math.round((elapsedMs * (100 - percent)) / percent / 1000))
}

/**
 * 把渲染任务归组成"成片集"（`A56`）：同一项目 + 同一时间轴的多次导出算一集。
 *
 * 只读聚合，不改任何数据：界面可以用它显示"这个时间轴导出过 5 个成片、共 120MB"，
 * Agent 也能据此回答"上次导出的那个呢"。
 *
 * @param jobs - 渲染任务（任意顺序）。
 * @returns 按最近导出时间倒序的成片集。
 */
/**
 * 把进度采样归因成各段耗时（`A57`）。
 *
 * 归因是近似：每个采样间隔的耗时记到该间隔起点所在的那一段。不追求毫秒级精确，
 * 目标是回答「哪一段慢得离谱」——足以指导优化（该段是否该预转码/降分辨率/剪短）。
 *
 * @param bounds - 各段累计结束毫秒（升序）。
 * @param samples - 进度采样（percent 与 atMs 均单调不减）。
 * @returns 各段耗时与最慢段；样本不足 2 条时返回空对象。
 */
export function computeSegmentTimings(
  bounds: readonly number[],
  samples: readonly { readonly percent: number; readonly atMs: number }[],
): { segmentTimingsMs?: number[]; slowestSegment?: { index: number; ms: number } } {
  const totalMs = bounds[bounds.length - 1]
  if (totalMs === undefined || totalMs <= 0 || samples.length < 2) return {}
  const timings = new Array<number>(bounds.length).fill(0)
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!
    const current = samples[index]!
    const delta = current.atMs - previous.atMs
    if (!Number.isFinite(delta) || delta <= 0) continue
    const atMs = (Math.max(0, Math.min(100, previous.percent)) / 100) * totalMs
    const found = bounds.findIndex(bound => atMs <= bound)
    const segment = Math.min(bounds.length - 1, Math.max(0, found))
    timings[segment]! += delta
  }
  const total = timings.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return {}
  let slowestIndex = 0
  for (let index = 1; index < timings.length; index += 1) {
    if (timings[index]! > timings[slowestIndex]!) slowestIndex = index
  }
  return {
    segmentTimingsMs: timings,
    slowestSegment: { index: slowestIndex + 1, ms: timings[slowestIndex]! },
  }
}

/**
 * 判断一个渲染任务能否"一键重试"（`A59`/`R7`）。
 *
 * 抽成纯函数是为了把三个分支都测到（运行中 / 排队中 / 可重试），
 * 而不是靠在端点里构造时序巧合。
 *
 * @param job - 目标任务。
 * @returns 不能重试时返回面向人的原因；可重试返回 `undefined`。
 */
/** 导出队列全景（`A90`）。 */
export interface RenderOverview {
  readonly running: { readonly count: number; readonly items: readonly { id: string; timelineId: string; percent: number; etaSec?: number; step?: string }[] }
  readonly queued: { readonly count: number; readonly items: readonly { id: string; timelineId: string; position: number; priority?: number }[] }
  readonly recent: { readonly succeeded: number; readonly failed: number; readonly cancelled: number }
  readonly throughput: { readonly lastHour: number; readonly p50Ms?: number; readonly p90Ms?: number; readonly samples: number }
  readonly failedWithDiagnosis: number
  /** 最近完成的成片（`A128`：带视频/封面/字幕路径，界面列表直接用）。 */
  readonly recentItems: readonly {
    readonly id: string
    readonly timelineId: string
    readonly outputPath: string
    readonly bytes?: number
    readonly durationMs?: number
    readonly thumbnailFile?: string
    readonly subtitleFile?: string
    readonly finishedAt?: string
  }[]
}

/**
 * 汇总导出队列全景（`A90`）：给界面/Agent 一个"一眼看懂"的视图。
 *
 * @param jobs - 所有渲染任务。
 * @param stats - `RenderRegistry.stats()` 的结果（耗时分位）。
 * @param nowMs - 当前时间（测试可注入）。
 * @returns 全景摘要。
 */
export function renderOverview(
  jobs: readonly RenderJob[],
  stats: { readonly p50Ms?: number; readonly p90Ms?: number; readonly samples?: number },
  nowMs: number = Date.now(),
): RenderOverview {
  const hourAgo = nowMs - 60 * 60 * 1000
  const running = jobs.filter(job => job.status === 'running' && job.queued !== true)
  const queued = jobs.filter(job => job.queued === true)
  const recent = jobs.filter(job => typeof job.finishedAt === 'string' && Date.parse(job.finishedAt) >= hourAgo)
  return {
    running: {
      count: running.length,
      items: running.map(job => ({
        id: job.id, timelineId: job.timelineId, percent: job.percent,
        ...job.progressEtaSec === undefined ? {} : { etaSec: job.progressEtaSec },
        ...job.progressStep === undefined ? {} : { step: `${job.progressStep.current}/${job.progressStep.total}` },
      })),
    },
    queued: {
      count: queued.length,
      items: queued
        .slice()
        .sort((left, right) => (left.queuePosition ?? 0) - (right.queuePosition ?? 0))
        .map(job => ({
          id: job.id, timelineId: job.timelineId, position: job.queuePosition ?? 0,
          ...job.priority === undefined ? {} : { priority: job.priority },
        })),
    },
    recent: {
      succeeded: recent.filter(job => job.status === 'succeeded').length,
      failed: recent.filter(job => job.status === 'failed').length,
      cancelled: recent.filter(job => job.status === 'cancelled').length,
    },
    throughput: {
      lastHour: recent.length,
      ...stats.p50Ms === undefined ? {} : { p50Ms: stats.p50Ms },
      ...stats.p90Ms === undefined ? {} : { p90Ms: stats.p90Ms },
      samples: stats.samples ?? 0,
    },
    failedWithDiagnosis: jobs.filter(job => job.status === 'failed' && job.diagnosis !== undefined).length,
    // `A128`：最近成功的成片清单（最新在前，最多 10 条），带视频/封面/字幕三件套路径
    recentItems: jobs
      .filter(job => job.status === 'succeeded' && job.outputPath !== undefined)
      .sort((left, right) => (right.finishedAt ?? '').localeCompare(left.finishedAt ?? ''))
      .slice(0, 10)
      .map(job => ({
        id: job.id,
        timelineId: job.timelineId,
        outputPath: job.outputPath as string,
        ...job.bytes === undefined ? {} : { bytes: job.bytes },
        ...job.summary?.durationMs === undefined ? {} : { durationMs: job.summary.durationMs },
        ...job.summary?.thumbnailFile === undefined ? {} : { thumbnailFile: job.summary.thumbnailFile },
        ...job.summary?.subtitleFile === undefined ? {} : { subtitleFile: job.summary.subtitleFile },
        ...job.finishedAt === undefined ? {} : { finishedAt: job.finishedAt },
      })),
  }
}

export function retryError(job: RenderJob): string | undefined {
  if (job.status === 'running' && job.queued !== true) {
    return '这个导出正在跑：等它结束，或先 render-cancel 再重试'
  }
  if (job.queued === true) {
    return '这个导出还在排队：等它开始，或先 render-cancel 再重试'
  }
  return undefined
}

export function groupRenderSets(jobs: readonly RenderJob[]): RenderSet[] {
  const groups = new Map<string, RenderJob[]>()
  for (const job of jobs) {
    const key = `${job.projectId}\u0000${job.timelineId}`
    const list = groups.get(key)
    if (list === undefined) groups.set(key, [job])
    else list.push(job)
  }
  const sets: RenderSet[] = []
  for (const list of groups.values()) {
    const succeeded = list.filter(job => job.status === 'succeeded')
    const timestamps = list.map(job => job.finishedAt ?? job.startedAt).filter((stamp): stamp is string => typeof stamp === 'string')
    sets.push({
      projectId: list[0]!.projectId,
      timelineId: list[0]!.timelineId,
      count: list.length,
      succeeded: succeeded.length,
      failed: list.filter(job => job.status === 'failed').length,
      totalBytes: succeeded.reduce((sum, job) => sum + (job.bytes ?? 0), 0),
      totalDurationMs: succeeded.reduce((sum, job) => sum + (job.summary?.durationMs ?? 0), 0),
      latestAt: timestamps.sort((left, right) => right.localeCompare(left))[0],
      jobIds: list.map(job => job.id),
    })
  }
  return sets.sort((left, right) => (right.latestAt ?? '').localeCompare(left.latestAt ?? ''))
}

/** 一个"成片集"（`A56`）：同一项目 + 同一时间轴的导出聚合。 */
export interface RenderSet {
  readonly projectId: string
  readonly timelineId: string
  /** 该时间轴的导出次数（含失败/取消）。 */
  readonly count: number
  readonly succeeded: number
  readonly failed: number
  /** 成功成片的总字节数。 */
  readonly totalBytes: number
  /** 成功成片的时长总和（毫秒）。 */
  readonly totalDurationMs: number
  /** 最近一次导出的时间。 */
  readonly latestAt?: string
  readonly jobIds: readonly string[]
}

export function segmentStepAt(
  bounds: readonly number[],
  percent: number,
): { readonly current: number; readonly total: number } | undefined {
  const totalMs = bounds[bounds.length - 1]
  if (totalMs === undefined || totalMs <= 0) return undefined
  const atMs = (Math.max(0, Math.min(100, percent)) / 100) * totalMs
  const index = bounds.findIndex(bound => atMs <= bound)
  return { current: index < 0 ? bounds.length : index + 1, total: bounds.length }
}

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
  /** 进度细分（`A41`）：当前在第几段（按视频段+补边段的累计时长换算）。 */
  readonly progressStep?: { readonly current: number; readonly total: number }
  /** 预计剩余秒数（`A52`；过早/过短时不给，成功时为 0）。 */
  readonly progressEtaSec?: number
  /** 入队优先级（`A50`；重试时复用，`A59`）。 */
  readonly priority?: number
  /** 失败诊断（`A88`：错误码 → 人话 + 可执行动作）。 */
  readonly diagnosis?: Diagnosis
  /** 第几次尝试（`A114`；自动重试会递增）。 */
  readonly attempt?: number
}

/** 导出任务表（内存态即可：进程重启后"运行中"的渲染按失败收尾）。 */
export class RenderRegistry {
  private readonly jobs = new Map<string, RenderJob>()
  private readonly controllers = new Map<string, AbortController>()
  /** 最近完成任务的实际耗时（毫秒，`A21`；最多留 50 条）。 */
  private readonly durations: number[] = []
  /** 每个任务的进度采样（`A57`；上限 200 条，防长任务吃内存）。 */
  private readonly samples = new Map<string, Array<{ percent: number; atMs: number }>>()
  /** 每个任务的 ETA 平滑器（`A92`）。 */
  private readonly etas = new Map<string, EtaTracker>()
  /** 最近成功导出的样本（`A98`：带输出规格，用于预测新导出耗时）。 */
  private readonly renderSamples: Array<{ renderMs: number; durationMs: number; width: number; height: number; frameRate: number }> = []

  /** 等待槽位的任务（FIFO，`A4`）。 */
  private readonly pending: Array<{ job: RenderJob; timeline: TimelineRecord; priority: number; seq: number }> = []
  /** 入队序号（`A108` 公平调度的稳定排序依据）。 */
  private pendingSeq = 0
  /** 每个任务是否允许瞬时失败自动重试（`A114`，opt-in）。 */
  private readonly retryFlags = new Map<string, boolean>()
  /** 每个任务的封面帧位置（`A126`）。 */
  private readonly thumbnailAt = new Map<string, number>()
  /** 每个任务的随片字幕格式（`A130`）。 */
  private readonly subtitleFormats = new Map<string, 'srt' | 'vtt'>()

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

  /** 百分比 → 第 N 段（`A41`；边界为空时不带该字段）。 */
  private stepAt(timeline: TimelineRecord, percent: number): { progressStep?: { current: number; total: number } } {
    const step = segmentStepAt(this.segmentBounds(timeline), percent)
    return step === undefined ? {} : { progressStep: step }
  }

  /**
   * 重排等待队列（`A108`）：优先级降序 → **项目内轮次**升序 → 入队序号。
   *
   * 为什么按项目内轮次：项目 A 连提 3 个、项目 B 提 1 个时，希望执行顺序是 A1、B1、A2、A3
   * —— 而不是 A1、A2、A3、B1（B 被饿死）。同项目内部仍严格 FIFO。
   */
  private reorderPending(): void {
    const depth = new Map<string, number>()
    // 先按入队顺序给每个项目内的条目编号（0 = 该项目最早的那个）
    const ranked = this.pending
      .slice()
      .sort((left, right) => left.seq - right.seq)
      .map(entry => {
        const rank = depth.get(entry.job.projectId) ?? 0
        depth.set(entry.job.projectId, rank + 1)
        return { entry, rank }
      })
    ranked.sort((left, right) =>
      right.entry.priority - left.entry.priority
      || left.rank - right.rank
      || left.entry.seq - right.entry.seq)
    this.pending.splice(0, this.pending.length, ...ranked.map(item => item.entry))
    this.pending.forEach((queued, index) => { this.patch(queued.job.id, { queued: true, queuePosition: index + 1 }) })
  }

  /** 当前任务的 ETA（`A52`；拿不到开始时间就不给）。 */
  private etaAt(id: string, percent: number): { progressEtaSec?: number } {
    if (!this.jobs.has(id)) return {}
    const tracker = this.etas.get(id) ?? new EtaTracker()
    this.etas.set(id, tracker)
    const eta = tracker.update(percent, Date.now())
    return eta === undefined ? {} : { progressEtaSec: eta }
  }

  /** 记一条预测样本（`A98`；最多保留 50 条，超出丢最旧的）。 */
  private recordSample(timeline: TimelineRecord, result: { readonly durationMs: number; readonly renderMs: number }): Record<string, never> {
    const format = normalizeExportFormat(timeline.exportFormat)
    this.renderSamples.push({
      renderMs: result.renderMs,
      durationMs: result.durationMs,
      width: format.width ?? 1920,
      height: format.height ?? 1080,
      frameRate: format.frameRate ?? 30,
    })
    while (this.renderSamples.length > 50) this.renderSamples.shift()
    return {}
  }

  /** 最近成功导出的样本（`A98`，给耗时预测用）。 */
  exportSamples(): readonly { renderMs: number; durationMs: number; width: number; height: number; frameRate: number }[] {
    return this.renderSamples
  }

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
  /** 把"全局百分比"换算成"第 N 段"用的累计边界（`A41`；纯函数计划，失败就算了）。 */
  private segmentBounds(timeline: TimelineRecord): number[] {
    try {
      const snapshot = freezeTimeline(timeline)
      const segments = planVideoSegments(snapshot)
      const bounds: number[] = []
      let accumulated = 0
      for (const segment of segments) {
        const ms = segment.kind === 'filler' ? segment.durationMs : Math.max(1, Math.round(segment.durationMs / (segment.speed ?? 1)))
        accumulated += ms
        bounds.push(accumulated)
      }
      return bounds
    } catch {
      return []
    }
  }

  start(timeline: TimelineRecord, options: { priority?: number; retryTransient?: boolean; thumbnailAtMs?: number; subtitleFormat?: 'srt' | 'vtt' } = {}): RenderJob {
    const id = `render-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const maxConcurrent = Math.max(1, this.deps.maxConcurrent ?? 1)
    const job: RenderJob = {
      id, timelineId: timeline.id, projectId: timeline.projectId,
      status: 'running', percent: 0, startedAt: this.stamp(),
    }
    const priority = Number.isFinite(options.priority) ? Math.round(options.priority as number) : 0
    this.jobs.set(id, job)
    if (options.retryTransient === true) this.retryFlags.set(id, true)
    if (options.thumbnailAtMs !== undefined) this.thumbnailAt.set(id, options.thumbnailAtMs)
    if (options.subtitleFormat !== undefined) this.subtitleFormats.set(id, options.subtitleFormat)
    // 优先级无条件记录（重试要复用它；早先只写在入队分支里 → 直接开跑的任务没有该字段）
    this.patch(id, { priority })
    if (this.controllers.size >= maxConcurrent) {
      // 槽位满了：按**优先级**有序插入（数值大的先跑；同优先级保持 FIFO，不插队到同伴前面）
      // `A108` 公平调度：先按优先级降序，同优先级内按「各项目自己的第几个」轮流
      this.pending.push({ job, timeline, priority, seq: this.pendingSeq++ })
      this.reorderPending()
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
    id: string,
    timeline: TimelineRecord,
    result: { readonly outputPath: string; readonly bytes: number; readonly durationMs: number },
  ): Promise<RenderSummary> {
    const timing = computeSegmentTimings(this.segmentBounds(timeline), this.samples.get(id) ?? [])
    const summary = timing.segmentTimingsMs === undefined
      ? buildRenderSummary(timeline, result)
      : { ...buildRenderSummary(timeline, result), ...timing }
    this.samples.delete(id)
    this.etas.delete(id)
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
      onProgress: progress => {
        const bucket = this.samples.get(id) ?? []
        if (bucket.length < 200) bucket.push({ percent: progress.percent, atMs: Date.now() })
        this.samples.set(id, bucket)
        this.patch(id, { percent: progress.percent, ...this.stepAt(timeline, progress.percent), ...this.etaAt(id, progress.percent) })
      },
    }).then(async (result: RenderResult) => {
      this.patch(id, {
        status: 'succeeded', percent: 100, finishedAt: this.stamp(), progressEtaSec: 0,
        ...this.stepAt(timeline, 100),
        summary: await this.summarise(id, timeline, result),
        ...this.recordSample(timeline, { durationMs: result.durationMs, renderMs: Date.now() - Date.parse(job.startedAt) }),
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
      // `A114`：opt-in + 瞬时失败 + 还没重试过 → 自动重试一次（本地渲染不计费）
      const current = this.jobs.get(id)
      const attempt = current?.attempt ?? 1
      if (!cancelled
        && this.retryFlags.get(id) === true
        && isTransientRenderFailure(error instanceof RenderError ? error.code : undefined)
        && attempt <= MAX_AUTO_RETRIES) {
        this.patch(id, { attempt: attempt + 1, percent: 0, status: 'running' })
        this.deps.log?.({ event: 'render-retry-transient', renderId: id, attempt: attempt + 1 })
        this.launch(id, timeline)
        return
      }
      this.patch(id, {
        status: cancelled ? 'cancelled' : 'failed',
        finishedAt: this.stamp(),
        ...error instanceof RenderError ? { code: error.code } : {},
        error: message,
        // `A88`：把错误码翻成"下一步该做什么"（取消不算失败，不给诊断）
        ...cancelled ? {} : { diagnosis: diagnoseRenderError(error instanceof RenderError ? error.code : undefined, message) },
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
      this.jobs.set(id, { ...job, status: 'failed', finishedAt: this.stamp(), error: reason, diagnosis: diagnoseRenderError(undefined, reason) })
      this.controllers.delete(id)
    }
    return closed
  }
}
