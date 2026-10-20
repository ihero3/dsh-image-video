/**
 * 覆盖率缓冲加固（Track A / A134）。
 *
 * 目标不是"为覆盖率而覆盖率"，而是补齐**已知薄弱点**的边界断言：
 * - WebVTT 的极端输入
 * - 比例描述的非常规值
 * - 重启遗留任务的收尾（failStale —— 一直没测）
 * - 诊断建议的 6 类错误码全覆盖
 * - 时间轴复制的空骨架
 */
import { describe, expect, it } from 'vitest'
import { describeAspect } from '../src/workbench/estimate.ts'
import { duplicateTimeline } from '../src/workbench/timeline.ts'
import { diagnoseRenderError } from '../src/media/diagnose.ts'
import { RenderRegistry } from '../src/media/render-registry.ts'
import { parseVtt, serializeVtt } from '../src/workbench/vtt.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'
import type { RenderService } from '../src/media/render.ts'

describe('WebVTT edges (A134)', () => {
  it('handles empty input, header-only and out-of-order cues', () => {
    expect(parseVtt('').cues).toEqual([])
    expect(parseVtt('WEBVTT\n').cues).toEqual([])
    const outOfOrder = serializeVtt([
      { index: 0, startMs: 9000, endMs: 9500, text: 'later' },
      { index: 0, startMs: 1000, endMs: 1500, text: 'earlier' },
    ])
    const parsed = parseVtt(outOfOrder)
    expect(parsed.cues.map(cue => cue.text)).toEqual(['earlier', 'later'])
  })

  it('skips blocks with non-increasing timecodes', () => {
    const parsed = parseVtt('WEBVTT\n\n00:00:05.000 --> 00:00:04.000\nbad\n\n00:00:01.000 --> 00:00:02.000\nok\n')
    expect(parsed.cues).toHaveLength(1)
    expect(parsed.skipped.length).toBe(1)
  })
})

describe('aspect helper edges (A134)', () => {
  it('recognises wide and tall ratios and simplifies odd ones', () => {
    expect(describeAspect(2560, 1080)).toBe('21:9')
    expect(describeAspect(1080, 1350)).toBe('4:5')
    expect(describeAspect(1440, 1080)).toBe('4:3')
    expect(describeAspect(1000, 400)).toBe('5:2')
  })
})

describe('duplicating an empty skeleton (A134)', () => {
  it('survives empty tracks and empty subtitle tracks', () => {
    const empty: TimelineRecord = {
      schemaVersion: 4, id: 't', projectId: 'p', name: 'n', frameRate: 30, burnSubtitles: false,
      tracks: [], createdAt: '', updatedAt: '',
    }
    const copy = duplicateTimeline(empty, { newId: 'c', newName: 'c2', newClipId: prefix => `${prefix}-x` })
    expect(copy.tracks).toEqual([])
    expect(copy.id).toBe('c')

    const withEmptySubtitle: TimelineRecord = {
      ...empty, tracks: [{ id: 's', kind: 'subtitle', clips: [] }],
    }
    expect(duplicateTimeline(withEmptySubtitle, { newId: 'd', newName: 'd2', newClipId: p => p }).tracks[0]?.clips).toEqual([])
  })
})

describe('diagnosis covers every known error code (A134)', () => {
  it('maps all six codes to non-empty titles and actions', () => {
    for (const code of [
      'MEDIA_TIMELINE_EMPTY', 'MEDIA_TIMELINE_OVERLAP', 'MEDIA_ASSET_MISSING',
      'MEDIA_FFMPEG_UNAVAILABLE', 'MEDIA_FFMPEG_ENCODER_MISSING', 'MEDIA_OUTPUT_INVALID',
    ]) {
      const diagnosis = diagnoseRenderError(code)
      expect(diagnosis.code).toBe(code)
      expect(diagnosis.title.length).toBeGreaterThan(0)
      expect(diagnosis.actions.length).toBeGreaterThan(0)
      expect(diagnosis.hint.length).toBeGreaterThan(0)
    }
  })
})

describe('failStale closes restart leftovers (A134)', () => {
  it('marks running jobs failed with a diagnosis and clears controllers', () => {
    // 用一个永不 resolve 的渲染器制造"运行中"任务
    const hanging = { render: () => new Promise(() => undefined) } as unknown as RenderService
    const registry = new RenderRegistry({ render: hanging })
    const job = registry.start({
      schemaVersion: 4, id: 'tml-stale', projectId: 'p', name: 'n', frameRate: 30, burnSubtitles: false,
      tracks: [{ id: 'v', kind: 'video', clips: [{ id: 'c', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1 }] }],
      createdAt: '', updatedAt: '',
    })
    expect(registry.get(job.id)?.status).toBe('running')
    expect(registry.failStale('宿主重启中断')).toBe(1)
    const closed = registry.get(job.id)!
    expect(closed.status).toBe('failed')
    expect(closed.error).toContain('宿主重启中断')
    expect(closed.diagnosis?.title.length).toBeGreaterThan(0)
    // 再调一次不应重复计数
    expect(registry.failStale('again')).toBe(0)
  })
})
