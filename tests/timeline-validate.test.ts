/**
 * 时间轴一致性校验（Track A / A34）：与渲染器共用域规则，把"导出时才报的错"提前。
 */
import { describe, expect, it } from 'vitest'
import { validateTimeline } from '../src/workbench/validate.ts'
import type { TimelineClip, TimelineRecord, TimelineTrack } from '../src/workbench/timeline.ts'

const clip = (id: string, extra: Partial<TimelineClip> = {}): TimelineClip =>
  ({ id, assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000, ...extra })

function timeline(tracks: TimelineTrack[]): TimelineRecord {
  return { schemaVersion: 3, id: 'tml-v', projectId: 'prj-1', name: '校验', frameRate: 30, burnSubtitles: false, tracks, createdAt: '', updatedAt: '' }
}
const video = (clips: TimelineClip[]): TimelineTrack => ({ id: 'v1', kind: 'video', clips })
const codes = (document: TimelineRecord): string[] => validateTimeline(document).map(issue => issue.code)

describe('validateTimeline (A34)', () => {
  it('flags an empty video track and accepts a clean timeline', () => {
    expect(codes(timeline([{ id: 'v1', kind: 'video', clips: [] }]))).toContain('empty-video-track')
    expect(codes(timeline([video([clip('c1')])]))).toEqual([])
  })

  it('flags overlaps on the same track with the exact numbers', () => {
    const issues = validateTimeline(timeline([video([clip('c1', { durationMs: 2000 }), clip('c2', { startMs: 1000 })])]))
    const overlap = issues.find(issue => issue.code === 'overlap')
    expect(overlap?.clipId).toBe('c2')
    expect(overlap?.message).toContain('1000ms < 前一段结束 2000ms')
  })

  it('flags a transition that has a gap before it (would be silently ignored)', () => {
    const issues = validateTimeline(timeline([video([
      clip('c1', { durationMs: 1000 }),
      clip('c2', { startMs: 1500, transition: 'fade' }),
    ])]))
    expect(issues.some(issue => issue.code === 'transition-not-adjacent' && issue.message.includes('空档'))).toBe(true)
  })

  it('flags dangling ducking and ducking on a non-audio track', () => {
    expect(codes(timeline([
      video([clip('c1')]),
      { id: 'music', kind: 'audio', duckUnderTrackId: 'ghost', clips: [clip('m', { assetPath: '/tmp/m.aac' })] },
    ]))).toContain('dangling-ducking')

    expect(codes(timeline([
      video([clip('c1')]),
      { id: 's1', kind: 'subtitle', duckUnderTrackId: 'v1', clips: [{ id: 's', text: '字幕', startMs: 0, durationMs: 500 }] },
    ]))).toContain('ducking-on-non-audio')
  })

  it('flags an empty subtitle and a gapped audio crossfade', () => {
    expect(codes(timeline([
      video([clip('c1')]),
      { id: 's1', kind: 'subtitle', clips: [{ id: 's', text: '   ', startMs: 0, durationMs: 500 }] },
      { id: 'a1', kind: 'audio', crossfadeMs: 300, clips: [
        { id: 'a', assetPath: '/tmp/a.aac', startMs: 0, durationMs: 1000 },
        { id: 'b', assetPath: '/tmp/b.aac', startMs: 1500, durationMs: 1000 },
      ] },
    ]))).toEqual(expect.arrayContaining(['empty-subtitle', 'gapped-crossfade']))
  })
})
