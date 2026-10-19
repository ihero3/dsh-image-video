/**
 * 成片集归组（Track A / A56）：同一项目 + 同一时间轴的多次导出算一集（只读聚合）。
 */
import { describe, expect, it } from 'vitest'
import { groupRenderSets, type RenderJob } from '../src/media/render-registry.ts'

const job = (id: string, overrides: Partial<RenderJob> = {}): RenderJob => ({
  id, projectId: 'prj-1', timelineId: 'tml-1', status: 'succeeded', percent: 100,
  startedAt: '2026-10-19T10:00:00.000Z', ...overrides,
}) as RenderJob

describe('groupRenderSets (A56)', () => {
  it('groups by project + timeline and aggregates successfully', () => {
    const sets = groupRenderSets([
      job('r1', { finishedAt: '2026-10-19T10:01:00.000Z', bytes: 1000, summary: { durationMs: 5000 } as never }),
      job('r2', { finishedAt: '2026-10-19T10:05:00.000Z', bytes: 2000, summary: { durationMs: 7000 } as never }),
      job('r3', { status: 'failed', finishedAt: '2026-10-19T10:06:00.000Z' }),
      job('r4', { timelineId: 'tml-2', finishedAt: '2026-10-19T10:02:00.000Z', bytes: 500 }),
    ])
    expect(sets).toHaveLength(2)
    const first = sets[0]!
    expect(first).toMatchObject({ projectId: 'prj-1', timelineId: 'tml-1', count: 3, succeeded: 2, failed: 1, totalBytes: 3000, totalDurationMs: 12_000 })
    expect(first.latestAt).toBe('2026-10-19T10:06:00.000Z')
    expect(first.jobIds).toEqual(['r1', 'r2', 'r3'])
    // 按最近导出时间倒序
    expect(sets[1]!.timelineId).toBe('tml-2')
  })

  it('returns an empty list for no renders', () => {
    expect(groupRenderSets([])).toEqual([])
  })
})
