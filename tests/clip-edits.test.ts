/**
 * 片段拆分/复制（Track A / A24）：拆分要正确折算源内偏移，复制要保证落点与 id 唯一。
 */
import { describe, expect, it } from 'vitest'
import { duplicateClip, splitClipAt } from '../src/workbench/edits.ts'
import { effectiveDurationMs, type TimelineTrack } from '../src/workbench/timeline.ts'
import { makeClipIds } from './helpers/clip-ids.ts'

const tracks = (extra: Record<string, unknown> = {}): TimelineTrack[] => [{
  id: 'v1', kind: 'video',
  clips: [{ id: 'c1', assetPath: '/tmp/a.mp4', startMs: 1000, durationMs: 2000, ...extra }],
}]

describe('splitClipAt (A24)', () => {
  it('splits inside the clip and keeps the total duration', () => {
    const result = splitClipAt(tracks(), 'c1', 1800, makeClipIds('s'))
    const clips = result.tracks[0]!.clips
    expect(clips).toHaveLength(2)
    const [left, right] = clips
    expect(left).toMatchObject({ id: 'c1', startMs: 1000, durationMs: 800 })
    expect(right).toMatchObject({ id: 's-0', startMs: 1800, durationMs: 1200 })
    // 总时长不变
    const total = clips.reduce((sum, clip) => sum + effectiveDurationMs(clip), 0)
    expect(total).toBe(2000)
  })

  it('advances the right half inMs by the source time the left half consumed', () => {
    const result = splitClipAt(tracks({ inMs: 500 }), 'c1', 1800, makeClipIds('s'))
    const [left, right] = result.tracks[0]!.clips
    expect(left?.inMs).toBe(500)
    expect(right?.inMs).toBe(500 + 800) // 时间轴消耗 800ms × 速度 1
  })

  it('accounts for speed when splitting', () => {
    const result = splitClipAt(tracks({ speed: 2 }), 'c1', 1500, makeClipIds('s'))
    const [left, right] = result.tracks[0]!.clips
    // 时间轴 1000..2000 在 2 倍速下代表源 2000ms；在 1500 拆 → 左半源 1000ms、右半源 1000ms
    expect(left?.durationMs).toBe(1000)
    expect(right?.durationMs).toBe(1000)
    expect(right?.inMs).toBe(1000)
  })

  it('rejects split points outside the clip', () => {
    expect(() => splitClipAt(tracks(), 'c1', 1000, makeClipIds('s'))).toThrow(/必须在片段内部/)
    expect(() => splitClipAt(tracks(), 'c1', 3000, makeClipIds('s'))).toThrow(/必须在片段内部/)
    expect(() => splitClipAt(tracks(), 'nope', 1500, makeClipIds('s'))).toThrow(/找不到片段/)
  })
})

describe('duplicateClip (A24)', () => {
  it('places the copy right after the original by default', () => {
    const result = duplicateClip(tracks(), 'c1', makeClipIds('d'))
    const clips = result.tracks[0]!.clips
    expect(clips).toHaveLength(2)
    expect(clips[1]).toMatchObject({ id: 'd-0', startMs: 3000 })
    expect(clips[1]!.assetPath).toBe(clips[0]!.assetPath)
  })

  it('honours an explicit start and a target track', () => {
    const base: TimelineTrack[] = [
      ...tracks(),
      { id: 'a1', kind: 'audio', clips: [] },
    ]
    const result = duplicateClip(base, 'c1', makeClipIds('d'), { startMs: 0, trackKind: 'audio' })
    expect(result.tracks[1]!.clips).toHaveLength(1)
    expect(result.tracks[1]!.clips[0]).toMatchObject({ id: 'd-0', startMs: 0 })
  })
})
