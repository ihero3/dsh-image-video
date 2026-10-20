/**
 * "片段比素材还长"检测（Track A / A45）：导出时后半段会没画面，用户很难自查。
 * 判定放在纯函数里（可单测），真实时长由端点探测后传入。
 */
import { describe, expect, it } from 'vitest'
import { findClipOverruns } from '../src/workbench/validate.ts'
import type { TimelineClip, TimelineRecord } from '../src/workbench/timeline.ts'

const clip = (id: string, extra: Partial<TimelineClip> = {}): TimelineClip =>
  ({ id, assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000, ...extra })
const timeline = (clips: TimelineClip[]): TimelineRecord => ({
  schemaVersion: 3, id: 'tml-overrun', projectId: 'prj-1', name: '越界', frameRate: 30, burnSubtitles: false,
  tracks: [{ id: 'v1', kind: 'video', clips }], createdAt: '', updatedAt: '',
})

describe('findClipOverruns (A45)', () => {
  it('flags clips longer than the asset and respects the tolerance', () => {
    const durations = new Map([['/tmp/a.mp4', 1000]])
    expect(findClipOverruns(timeline([clip('ok')]), durations)).toEqual([])
    // 1000ms 素材 + 1100ms 需求 → 在 120ms 容差内，不报
    expect(findClipOverruns(timeline([clip('near', { durationMs: 1100 })]), durations)).toEqual([])

    const issues = findClipOverruns(timeline([clip('too-long', { durationMs: 3000 })]), durations)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('clip-longer-than-asset')
    expect(issues[0]?.message).toContain('素材只有 1000ms')
    expect(issues[0]?.message).toContain('3000ms')
  })

  it('counts the source offset toward the needed duration', () => {
    const durations = new Map([['/tmp/a.mp4', 1000]])
    // 偏移 500 + 时长 700 = 1200 > 1000 + 120
    expect(findClipOverruns(timeline([clip('offset', { inMs: 500, durationMs: 700 })]), durations)).toHaveLength(1)
  })

  it('skips clips whose asset duration is unknown', () => {
    expect(findClipOverruns(timeline([clip('unknown', { assetPath: '/tmp/ghost.mp4', durationMs: 99_999 })]), new Map())).toEqual([])
  })
})
