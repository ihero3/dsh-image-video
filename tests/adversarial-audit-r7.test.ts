/**
 * 对抗性扫荡 R7：补齐 A59 重试与 A56 归组的测试缺口。
 * 重点：A59 的主用例是"失败任务重试"，R6 时只测了"成功任务重试"。
 */
import { describe, expect, it, vi } from 'vitest'
import { groupRenderSets, retryError, type RenderJob } from '../src/media/render-registry.ts'
import type { ProjectRecord } from '../src/host/rpc.ts'

const job = (overrides: Partial<RenderJob> = {}): RenderJob => ({
  id: 'render-1', projectId: 'prj-1', timelineId: 'tml-1', status: 'succeeded', percent: 100,
  startedAt: '2026-10-19T10:00:00.000Z', ...overrides,
}) as RenderJob

describe('retryError branches (R7)', () => {
  it('refuses running and queued jobs, allows finished ones', () => {
    expect(retryError(job({ status: 'running' }))).toMatch(/正在跑/)
    expect(retryError(job({ status: 'running', queued: true }))).toMatch(/排队/)
    expect(retryError(job({ status: 'succeeded' }))).toBeUndefined()
    expect(retryError(job({ status: 'failed' }))).toBeUndefined()
    expect(retryError(job({ status: 'cancelled' }))).toBeUndefined()
  })
})

describe('groupRenderSets edges (R7)', () => {
  it('falls back to startedAt when finishedAt is missing, and survives equal timestamps', () => {
    const sets = groupRenderSets([
      job({ id: 'a', startedAt: '2026-10-19T09:00:00.000Z' }), // 没有 finishedAt
      job({ id: 'b', startedAt: '2026-10-19T09:00:00.000Z', finishedAt: '2026-10-19T09:00:00.000Z' }),
    ])
    expect(sets).toHaveLength(1)
    expect(sets[0]?.latestAt).toBe('2026-10-19T09:00:00.000Z')
    expect(sets[0]?.jobIds).toEqual(['a', 'b'])
  })
})
