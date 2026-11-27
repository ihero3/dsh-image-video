/**
 * 导出规格覆盖（`B2`）：渲染器只认 `timeline.exportFormat`，
 * 导出条的三档参数必须以**副本**形式传进去——不能改写存储里的时间轴，
 * 也要保证排队、完成摘要、重试三条路径都拿到同一份规格。
 */
import { describe, expect, it, vi } from 'vitest'
import { RenderRegistry } from '../src/media/render-registry.ts'
import type { RenderResult, RenderService } from '../src/media/render.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

/** 记录每次渲染收到的 timeline；用闸门控制何时完成，便于观察排队。 */
function capturingService() {
  const seen: TimelineRecord[] = []
  const gates: Array<(result: RenderResult) => void> = []
  const service = {
    render: (timeline: TimelineRecord) => {
      seen.push(timeline)
      return new Promise<RenderResult>(resolve => { gates.push(resolve) })
    },
  } as unknown as RenderService
  return { service, seen, gates }
}

const DONE: RenderResult = { outputPath: '/tmp/out.mp4', bytes: 2048, durationMs: 1000 }

function timeline(id: string): TimelineRecord {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', name: id, frameRate: 30, burnSubtitles: false,
    tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }] }],
    createdAt: '', updatedAt: '',
  }
}

const FORMAT = { width: 1440, height: 2560, frameRate: 60 } as const

describe('render export format override (B2)', () => {
  it('renders at the requested format, reports it in the summary, and leaves the stored timeline alone', async () => {
    const { service, seen, gates } = capturingService()
    const registry = new RenderRegistry({ render: service })
    const record = timeline('tml-1')

    const job = registry.start(record, { exportFormat: FORMAT })
    expect(seen[0]?.exportFormat).toEqual(FORMAT)
    // 覆盖只作用于副本：存储里的时间轴仍是"未设置"
    expect(record.exportFormat).toBeUndefined()

    gates[0]?.(DONE)
    await vi.waitFor(() => { expect(registry.get(job.id)?.status).toBe('succeeded') })
    expect(registry.get(job.id)?.summary?.format).toMatchObject({ width: 1440, height: 2560, frameRate: 60 })
  })

  it('keeps the timeline format when no override is given (regression guard)', async () => {
    const { service, seen, gates } = capturingService()
    const registry = new RenderRegistry({ render: service })
    const stored = { ...timeline('tml-2'), exportFormat: { width: 1920, height: 1080, frameRate: 24 } }

    const job = registry.start(stored)
    expect(seen[0]?.exportFormat).toEqual({ width: 1920, height: 1080, frameRate: 24 })
    gates[0]?.(DONE)
    await vi.waitFor(() => { expect(registry.get(job.id)?.status).toBe('succeeded') })
    expect(registry.get(job.id)?.summary?.format).toMatchObject({ width: 1920, height: 1080, frameRate: 24 })
  })

  it('remembers the format so a retry re-runs at the same spec instead of falling back', async () => {
    const { service, seen, gates } = capturingService()
    const registry = new RenderRegistry({ render: service })
    const record = timeline('tml-3')

    const first = registry.start(record, { exportFormat: FORMAT, priority: 2 })
    gates[0]?.(DONE)
    await vi.waitFor(() => { expect(registry.get(first.id)?.status).toBe('succeeded') })

    // 模拟 `timelines/render-retry`：从原任务取回规格再 start
    const recorded = registry.exportFormatOf(first.id)
    expect(recorded).toEqual(FORMAT)
    registry.start(record, { ...recorded === undefined ? {} : { exportFormat: recorded } })
    expect(seen[1]?.exportFormat).toEqual(FORMAT)
  })

  it('carries the format through the queue as well', async () => {
    const { service, seen, gates } = capturingService()
    const registry = new RenderRegistry({ render: service, maxConcurrent: 1 })
    const record = timeline('tml-4')

    registry.start(record) // 占住唯一槽位
    const queued = registry.start(record, { exportFormat: FORMAT })
    expect(registry.get(queued.id)?.queued).toBe(true)
    expect(seen).toHaveLength(1) // 第二个还没开跑

    gates[0]?.(DONE)
    await vi.waitFor(() => { expect(seen).toHaveLength(2) })
    expect(seen[1]?.exportFormat).toEqual(FORMAT)
  })
})
