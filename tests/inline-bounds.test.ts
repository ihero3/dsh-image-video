/**
 * inline 时间轴输入的边界（Track A / A40）：未保存文档不受存储层校验保护，必须自己设界。
 */
import { describe, expect, it } from 'vitest'
import { INLINE_TIMELINE_LIMITS, checkInlineTimelineBounds } from '../src/workbench/validate.ts'
import { MAX_TIMELINE_CLIPS } from '../src/workbench/timeline.ts'

const clip = (id: string) => ({ id, assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 })
const doc = (tracks: unknown[]) => ({ schemaVersion: 3, tracks })

describe('inline timeline bounds (A40)', () => {
  it('shares the storage clip limit instead of a second magic number', () => {
    expect(INLINE_TIMELINE_LIMITS.maxClips).toBe(MAX_TIMELINE_CLIPS)
  })

  it('accepts a normal document and rejects over-sized ones with actionable messages', () => {
    expect(checkInlineTimelineBounds(doc([{ id: 'v1', kind: 'video', clips: [clip('c')] }]))).toBeUndefined()

    const tooManyClips = doc([{ id: 'v1', kind: 'video', clips: Array.from({ length: MAX_TIMELINE_CLIPS + 1 }, (_, i) => clip(`c${i}`)) }])
    expect(checkInlineTimelineBounds(tooManyClips)).toMatch(/片段太多/)

    const tooManyTracks = doc(Array.from({ length: INLINE_TIMELINE_LIMITS.maxTracks + 1 }, (_, i) => ({ id: `t${i}`, kind: 'video', clips: [] })))
    expect(checkInlineTimelineBounds(tooManyTracks)).toMatch(/轨道太多/)

    const huge = doc([{ id: 'v1', kind: 'video', clips: [{ ...clip('big'), text: 'x'.repeat(INLINE_TIMELINE_LIMITS.maxBytes + 10) }] }])
    expect(checkInlineTimelineBounds(huge)).toMatch(/太大/)

    expect(checkInlineTimelineBounds(42)).toMatch(/必须是一个对象/)
    expect(checkInlineTimelineBounds({ tracks: 'nope' })).toMatch(/tracks 必须是数组/)
  })
})
