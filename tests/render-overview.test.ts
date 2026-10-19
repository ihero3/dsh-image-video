/**
 * 导出队列全景（Track A / A90）。
 */
import { describe, expect, it } from 'vitest'
import { renderOverview, type RenderJob } from '../src/media/render-registry.ts'

const job = (overrides: Partial<RenderJob>): RenderJob => ({
  id: 'r', projectId: 'p', timelineId: 't', status: 'succeeded', percent: 100,
  startedAt: '2026-10-20T00:00:00.000Z', ...overrides,
} as RenderJob)

describe('renderOverview (A90)', () => {
  it('summarises running, queued, recent outcomes and throughput', () => {
    const now = Date.parse('2026-10-20T01:00:00.000Z')
    const overview = renderOverview([
      job({ id: 'run', status: 'running', percent: 42, progressEtaSec: 7, progressStep: { current: 2, total: 5 } }),
      job({ id: 'q2', status: 'running', queued: true, queuePosition: 2, priority: 1 }),
      job({ id: 'q1', status: 'running', queued: true, queuePosition: 1, priority: 5 }),
      job({ id: 'ok', status: 'succeeded', finishedAt: '2026-10-20T00:30:00.000Z' }),
      job({ id: 'bad', status: 'failed', finishedAt: '2026-10-20T00:45:00.000Z', diagnosis: { code: 'X', title: 't', hint: 'h', actions: [] } }),
      job({ id: 'old', status: 'succeeded', finishedAt: '2026-10-19T20:00:00.000Z' }), // 1 小时前以外
    ], { p50Ms: 1200, p90Ms: 3000, samples: 10 }, now)

    expect(overview.running.count).toBe(1)
    expect(overview.running.items[0]).toMatchObject({ id: 'run', percent: 42, etaSec: 7, step: '2/5' })
    expect(overview.queued.count).toBe(2)
    // 队列按位置排序
    expect(overview.queued.items.map(item => item.id)).toEqual(['q1', 'q2'])
    expect(overview.recent).toEqual({ succeeded: 1, failed: 1, cancelled: 0 })
    expect(overview.throughput).toEqual({ lastHour: 2, p50Ms: 1200, p90Ms: 3000, samples: 10 })
    expect(overview.failedWithDiagnosis).toBe(1)
  })

  it('handles an idle queue', () => {
    expect(renderOverview([], {}, 0)).toMatchObject({
      running: { count: 0, items: [] }, queued: { count: 0, items: [] },
      recent: { succeeded: 0, failed: 0, cancelled: 0 },
      throughput: { lastHour: 0, samples: 0 },
    })
  })
})
