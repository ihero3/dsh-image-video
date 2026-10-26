/**
 * 多比例切片（`B-5`）：一条成片 → 竖屏/方图/横屏各自导出。
 *
 * 断言三件事：
 * 1. **尺寸推导**：保持短边不变（720p → 9:16 = 720×1280），偶数且落在导出范围内；
 * 2. **不改内容**：派生时间轴只换 exportFormat 与名字，轨道/字幕原样保留；
 * 3. **端点装配**：每种画幅各起一个导出任务；未知画幅/空列表响亮报错。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { planRatioSlices, sizeForRatio } from '../src/workbench/derive-ratios.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

const BASE = { width: 1280, height: 720, frameRate: 30 } as const

function timeline(overrides: Partial<TimelineRecord> = {}): TimelineRecord {
  return {
    schemaVersion: 4, id: 'tml-1', projectId: 'prj-1', name: '成片',
    tracks: [
      { id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 3000 }] },
      { id: 's1', kind: 'subtitle', clips: [{ id: 'c2', startMs: 0, durationMs: 2000, text: '你好' }] },
    ],
    exportFormat: { ...BASE },
    createdAt: '2026-10-26T00:00:00.000Z', updatedAt: '2026-10-26T00:00:00.000Z',
    ...overrides,
  }
}

describe('sizeForRatio', () => {
  it('保持短边不变：16:9 基准 → 9:16 / 1:1 / 4:3', () => {
    expect(sizeForRatio(BASE, '9:16')).toEqual({ width: 720, height: 1280 })
    expect(sizeForRatio(BASE, '1:1')).toEqual({ width: 720, height: 720 })
    expect(sizeForRatio(BASE, '4:3')).toEqual({ width: 960, height: 720 })
    expect(sizeForRatio(BASE, '16:9')).toEqual({ width: 1280, height: 720 })
  })

  it('宽高都是偶数；未知画幅报错', () => {
    for (const ratio of ['16:9', '9:16', '1:1', '4:3']) {
      const size = sizeForRatio({ width: 1920, height: 1080, frameRate: 30 }, ratio)
      expect(size.width % 2).toBe(0)
      expect(size.height % 2).toBe(0)
    }
    expect(() => sizeForRatio(BASE, '21:9')).toThrowError(/不支持的画幅/)
  })
})

describe('planRatioSlices', () => {
  it('派生时间轴只改 exportFormat 与名字，轨道原样保留', () => {
    const { slices, warnings } = planRatioSlices({ timeline: timeline(), ratios: ['9:16', '1:1'] })
    expect(slices).toHaveLength(2)
    expect(slices[0]!.timeline.name).toContain('9:16')
    expect(slices[0]!.timeline.exportFormat).toMatchObject({ width: 720, height: 1280, frameRate: 30 })
    expect(slices[0]!.timeline.tracks).toHaveLength(2)
    expect(slices[0]!.timeline.tracks[1]!.clips[0]!.text).toBe('你好')
    // 原时间轴不被改写
    expect(timeline().exportFormat).toEqual(BASE)
    expect(warnings).toEqual([])
  })

  it('重复画幅去重并提醒；空列表/超过上限报错', () => {
    const { slices, warnings } = planRatioSlices({ timeline: timeline(), ratios: ['9:16', '9:16'] })
    expect(slices).toHaveLength(1)
    expect(warnings.join('\n')).toContain('去重')
    expect(() => planRatioSlices({ timeline: timeline(), ratios: [] })).toThrowError(/至少给一个目标画幅/)
    expect(() => planRatioSlices({ timeline: timeline(), ratios: ['16:9', '9:16', '1:1', '4:3', '16:9'] })).toThrowError(/最多派生/)
  })

  it('目标画幅与基础画幅一致时提醒会重复编码', () => {
    const { warnings } = planRatioSlices({ timeline: timeline(), ratios: ['16:9'] })
    expect(warnings.join('\n')).toContain('与原画幅一致')
  })
})

describe('timelines/render-ratios（端点）', () => {
  async function harness() {
    const store = new WorkbenchStore({ directory: await temp('dsh-ratio-store-') })
    const outputsDir = await temp('dsh-ratio-out-')
    const started: Array<{ name: string; format: { width: number; height: number } }> = []
    const renders = {
      start(timelineRecord: TimelineRecord) {
        started.push({ name: timelineRecord.name, format: timelineRecord.exportFormat as { width: number; height: number } })
        return { id: `render-${started.length}`, timelineId: timelineRecord.id, projectId: timelineRecord.projectId, status: 'running', percent: 0, startedAt: '2026-10-26T00:00:00.000Z' }
      },
    }
    const call = createWorkbenchHandler({
      provider: 'threevideo', outputsDir, store,
      registry: {} as never, runner: {} as never, renders: renders as never,
    })
    const project = await store.createProject('切片')
    const saved = await store.saveTimeline({
      projectId: project.id, name: '成片',
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 3000 }] }],
      exportFormat: { ...BASE },
    })
    return { call, saved, started }
  }

  it('每种画幅各起一个导出任务，返回尺寸清单', async () => {
    const { call, saved, started } = await harness()
    const result = await call('timelines/render-ratios', {
      timelineId: saved.id, ratios: ['9:16', '1:1'],
    }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const value = result.value as { slices: Array<{ ratio: string; width: number; height: number }>; jobs: unknown[] }
    expect(value.slices.map(slice => slice.ratio)).toEqual(['9:16', '1:1'])
    expect(value.jobs).toHaveLength(2)
    expect(started.map(entry => entry.format)).toMatchObject([
      { width: 720, height: 1280, frameRate: 30 },
      { width: 720, height: 720, frameRate: 30 },
    ])
  })

  it('未知画幅/未知时间轴都响亮报错', async () => {
    const { call, saved } = await harness()
    const badRatio = await call('timelines/render-ratios', { timelineId: saved.id, ratios: ['21:9'] }, new AbortController().signal, {} as never)
    expect(badRatio.ok).toBe(false)
    if (!badRatio.ok) expect(badRatio.error.message).toContain('不支持的画幅')
    const missing = await call('timelines/render-ratios', { timelineId: 'tml-x', ratios: ['9:16'] }, new AbortController().signal, {} as never)
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error.message).toContain('unknown timeline')
  })
})
