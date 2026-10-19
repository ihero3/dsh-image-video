/**
 * 工作台文档归档（Track A / A94）：只归档"已结束且够旧"的记录，默认 dryRun。
 */
import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planArchive } from '../src/workbench/archive.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import type { TaskRecord } from '../src/workbench/records.ts'

const task = (id: string, status: string, createdAt: string): TaskRecord => ({
  schemaVersion: 4, id, kind: 'image', status, createdAt,
} as TaskRecord)
const run = (id: string, status: string, startedAt: string) => ({ id, status, startedAt, workflowId: 'w', nodeRuns: [] })
const nowMs = Date.parse('2026-10-20T00:00:00.000Z')

describe('planArchive (A94)', () => {
  it('selects only finished records older than the cutoff', () => {
    const plan = planArchive({
      tasks: [
        task('old-done', 'succeeded', '2026-09-01T00:00:00.000Z'),   // 归档
        task('old-failed', 'failed', '2026-09-01T00:00:00.000Z'),    // 归档（已结束）
        task('old-running', 'running', '2026-09-01T00:00:00.000Z'),  // 进行中 → 不动
        task('recent', 'succeeded', '2026-10-19T00:00:00.000Z'),     // 太新 → 不动
        task('old-imported', 'imported-idle', '2026-09-01T00:00:00.000Z'), // 导入未跑 → 不动
      ],
      runs: [
        run('run-old', 'succeeded', '2026-08-01T00:00:00.000Z'),
        run('run-live', 'running', '2026-08-01T00:00:00.000Z'),
        run('run-new', 'succeeded', '2026-10-18T00:00:00.000Z'),
      ],
    }, { nowMs })
    expect(plan.tasks.map(entry => entry.id)).toEqual(['old-done', 'old-failed'])
    expect(plan.runs.map(entry => entry.id)).toEqual(['run-old'])
    expect(plan.dryRun).toBe(true) // 默认只算不删
    expect(plan.olderThanDays).toBe(30)
    expect(plan.estimatedBytes).toBeGreaterThan(0)
  })

  it('honours a custom window and explicit dryRun=false', () => {
    const plan = planArchive({
      tasks: [task('a', 'succeeded', '2026-10-15T00:00:00.000Z')],
      runs: [],
    }, { nowMs, olderThanDays: 3, dryRun: false })
    expect(plan.tasks).toHaveLength(1)
    expect(plan.dryRun).toBe(false)
    // 窗口至少 1 天（防止误传 0 把今天的也归档）
    expect(planArchive({ tasks: [], runs: [] }, { nowMs, olderThanDays: 0 }).olderThanDays).toBe(1)
  })
})

describe('store.archiveOlderThan (A94)', () => {
  it('dry run reports without touching data; a real run moves records to the archive file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-archive-'))
    // 先用"旧时间"播种记录（recordTask 用 store 的 now() 填 createdAt）
    const seeding = new WorkbenchStore({ directory, now: () => new Date('2026-08-02T00:00:00.000Z') })
    await seeding.recordTask({ kind: 'image', status: 'succeeded', startedAt: '2026-08-01T00:00:00.000Z' })
    await seeding.recordTask({ kind: 'image', status: 'failed', startedAt: '2026-08-01T00:00:00.000Z' })
    // 再以"当前时间"打开同一个目录做归档
    const store = new WorkbenchStore({ directory, now: () => new Date('2026-10-20T00:00:00.000Z') })
    const before = await store.stats()

    const dry = await store.archiveOlderThan()
    expect(dry.dryRun).toBe(true)
    expect(dry.archivedTasks).toBe(2)
    expect((await store.stats()).tasks).toBe(before.tasks) // 数据没动

    const real = await store.archiveOlderThan({ dryRun: false })
    expect(real.dryRun).toBe(false)
    expect(real.archivedTasks).toBe(2)
    expect((await store.stats()).tasks).toBe(before.tasks - 2)
    const archive = JSON.parse(await readFile(join(directory, 'workbench.archive.json'), 'utf8')) as { tasks: unknown[] }
    expect(archive.tasks).toHaveLength(2)
    // 再跑一次：已经归档过，不该重复归档
    expect((await store.archiveOlderThan({ dryRun: false })).archivedTasks).toBe(0)
  })
})
