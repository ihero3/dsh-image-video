/**
 * 工作台文档归档（Track A / A94）。
 *
 * 问题：workbench.json 同时装着项目/素材/时间轴/工作流/任务账本（上限 1000）/运行记录/缓存，
 * 只增不减（`docs/archive/2026-10-31/PERF.md` 里 10k 素材已 1.64MB），任务与运行记录是历史数据，应该搬走。
 *
 * 规则（保守）：
 * - 只归档**已结束**的记录（进行中/排队中的一律不动）
 * - 只归档超过 N 天（默认 30）的 —— 最近的历史仍留在主文档里，诊断照常能查
 * - 归档是**追加**到旁路文件，不丢历史
 */
import type { TaskRecord } from './records.ts'

/** 归档对象的结构化类型：有 status 字段、带 ISO 时间字段的记录都满足。 */
export type ArchiveRecord = { readonly status?: string } & Record<string, unknown>

/** 视为仍在进行、绝不能归档的状态。 */
const ACTIVE_STATUSES = new Set(['running', 'queued', 'pending', 'imported-idle'])

export interface ArchiveOptions {
  /** 当前时间（毫秒）。 */
  readonly nowMs: number
  /** 早于多少天的已结束记录才归档（默认 30）。 */
  readonly olderThanDays?: number
  /** 只统计不移动（默认 true —— 调用方必须显式传 false 才会真删）。 */
  readonly dryRun?: boolean
}

export interface ArchivePlan {
  readonly tasks: readonly TaskRecord[]
  readonly runs: readonly ArchiveRecord[]
  readonly dryRun: boolean
  readonly olderThanDays: number
  /** 这些记录占的字节（按 JSON 估算，给能瘦多少一个量）。 */
  readonly estimatedBytes: number
}

/** 记录是否够旧且已结束。 */
function isArchivable(record: ArchiveRecord, timeFields: readonly string[], cutoffMs: number): boolean {
  if (record.status !== undefined && ACTIVE_STATUSES.has(record.status)) return false
  for (const field of timeFields) {
    const value = record[field]
    if (typeof value !== 'string') continue
    const stamp = Date.parse(value)
    if (Number.isFinite(stamp)) return stamp <= cutoffMs
  }
  return false
}

/**
 * 选出可归档的任务与运行记录。
 * @param document - 文档片段（含 tasks/runs）。
 * @param options - 时间阈值与 dryRun。
 * @returns 计划（dryRun 时只是"如果执行会归档哪些"）。
 */
export function planArchive(
  document: { readonly tasks: readonly TaskRecord[]; readonly runs: readonly unknown[] },
  options: ArchiveOptions,
): ArchivePlan {
  const olderThanDays = Math.max(1, options.olderThanDays ?? 30)
  const cutoffMs = options.nowMs - olderThanDays * 24 * 60 * 60 * 1000
  const tasks = document.tasks.filter(task => isArchivable(task as unknown as ArchiveRecord, ['finishedAt', 'createdAt'], cutoffMs))
  const runs = document.runs
    .filter(run => isArchivable(run as ArchiveRecord, ['finishedAt', 'startedAt', 'createdAt'], cutoffMs)) as ArchiveRecord[]
  const estimatedBytes = Buffer.byteLength(JSON.stringify({ tasks, runs }), 'utf8')
  return { tasks, runs, dryRun: options.dryRun !== false, olderThanDays, estimatedBytes }
}
