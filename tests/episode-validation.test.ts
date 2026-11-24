/**
 * 集 / 分段 / 分镜的字段校验：每个 `normalize*` 的合法与拒绝路径。
 *
 * 这些函数是宿主写库前的唯一收口，界面不重复校验；这里逐条锁定错误信息里
 * 的关键词，避免以后把「拒绝」改成「静默截断」。
 */
import { describe, expect, it } from 'vitest'
import {
  MAX_EPISODE_NO, MAX_EPISODE_REMARK_LENGTH, MAX_EPISODE_TITLE_LENGTH, MAX_SCRIPT_LENGTH,
  MAX_SEGMENT_DURATION_SEC, MAX_SEGMENT_PROMPT_LENGTH, applyReorder, distributeDurationToShots, nextOrder,
  normalizeEpisodeNo, normalizeEpisodeRefCategory, normalizeEpisodeTitle, normalizeOptionalId, normalizePromptText,
  normalizeRemark, normalizeScriptText, normalizeSegmentDuration, normalizeSegmentRefs, normalizeShots, shotsDurationSec,
} from '../src/workbench/episodes.ts'

describe('episode field validation', () => {
  it('derives the default title from the episode number', () => {
    expect(normalizeEpisodeTitle(undefined, 0)).toBe('第0集')
    expect(normalizeEpisodeTitle(null, 3)).toBe('第3集')
    expect(normalizeEpisodeTitle('   ', 2)).toBe('第2集')
    expect(normalizeEpisodeTitle('  雨夜  ', 0)).toBe('雨夜')
    expect(() => normalizeEpisodeTitle(42, 0)).toThrow(/必须是字符串/)
    expect(() => normalizeEpisodeTitle('字'.repeat(MAX_EPISODE_TITLE_LENGTH + 1), 0)).toThrow(/最多/)
  })

  it('accepts numbers from 0 and rejects out-of-range or non-integer ones', () => {
    expect(normalizeEpisodeNo(undefined, 4)).toBe(4)
    expect(normalizeEpisodeNo(0, 9)).toBe(0)
    expect(normalizeEpisodeNo(MAX_EPISODE_NO, 0)).toBe(MAX_EPISODE_NO)
    expect(() => normalizeEpisodeNo(-1, 0)).toThrow(/必须是 0/)
    expect(() => normalizeEpisodeNo(1.5, 0)).toThrow(/整数/)
    expect(() => normalizeEpisodeNo('1', 0)).toThrow(/整数/)
    expect(() => normalizeEpisodeNo(MAX_EPISODE_NO + 1, 0)).toThrow(/最大/)
  })

  it('validates segment duration without silent clamping', () => {
    expect(normalizeSegmentDuration(undefined)).toBe(30)
    expect(normalizeSegmentDuration(9.6)).toBe(10)
    expect(normalizeSegmentDuration(MAX_SEGMENT_DURATION_SEC)).toBe(MAX_SEGMENT_DURATION_SEC)
    expect(() => normalizeSegmentDuration(Number.NaN)).toThrow(/必须是数字/)
    expect(() => normalizeSegmentDuration('9')).toThrow(/必须是数字/)
    expect(() => normalizeSegmentDuration(0)).toThrow(/秒之间/)
    expect(() => normalizeSegmentDuration(MAX_SEGMENT_DURATION_SEC + 1)).toThrow(/秒之间/)
  })

  it('validates script text, remark, optional ids and prompt text', () => {
    expect(normalizeScriptText('正文')).toBe('正文')
    expect(() => normalizeScriptText(1)).toThrow(/必须是字符串/)
    expect(() => normalizeScriptText('x'.repeat(MAX_SCRIPT_LENGTH + 1))).toThrow(/最多/)

    expect(normalizeRemark(undefined)).toBeUndefined()
    expect(normalizeRemark('   ')).toBeUndefined()
    expect(normalizeRemark(' 备注 ')).toBe('备注')
    expect(() => normalizeRemark(false)).toThrow(/必须是字符串/)
    expect(() => normalizeRemark('x'.repeat(MAX_EPISODE_REMARK_LENGTH + 1))).toThrow(/最多/)

    expect(normalizeOptionalId(undefined, '模型')).toBeUndefined()
    expect(normalizeOptionalId('  ', '模型')).toBeUndefined()
    expect(normalizeOptionalId('  abc ', '模型')).toBe('abc')
    expect(() => normalizeOptionalId(1, '镜头图片模型')).toThrow(/镜头图片模型必须是字符串/)

    expect(normalizePromptText(undefined)).toBe('')
    expect(normalizePromptText('画面')).toBe('画面')
    expect(() => normalizePromptText(0)).toThrow(/必须是字符串/)
    expect(() => normalizePromptText('x'.repeat(MAX_SEGMENT_PROMPT_LENGTH + 1))).toThrow(/最多/)
  })

  it('keeps reference categories inside the whitelist', () => {
    expect(normalizeEpisodeRefCategory(undefined)).toBe('ungrouped')
    expect(normalizeEpisodeRefCategory('')).toBe('ungrouped')
    expect(normalizeEpisodeRefCategory('role')).toBe('role')
    expect(() => normalizeEpisodeRefCategory(1)).toThrow(/必须是字符串/)
    expect(() => normalizeEpisodeRefCategory('nope')).toThrow(/引用分类必须是/)
  })

  it('rewrites reference and shot orders to 1..n', () => {
    expect(normalizeSegmentRefs(undefined)).toEqual([])
    expect(normalizeSegmentRefs([
      { kind: 'asset', id: ' a2 ', order: 9 },
      { kind: 'resource', id: 'r1', order: 0 },
    ])).toEqual([
      { kind: 'resource', id: 'r1', order: 1 },
      { kind: 'asset', id: 'a2', order: 2 },
    ])
    expect(() => normalizeSegmentRefs('x')).toThrow(/必须是数组/)
    expect(() => normalizeSegmentRefs([null])).toThrow(/必须是对象/)
    expect(() => normalizeSegmentRefs([{ kind: 'other', id: 'x' }])).toThrow(/kind/)
    expect(() => normalizeSegmentRefs([{ kind: 'asset', id: '  ' }])).toThrow(/id/)

    const shots = normalizeShots([
      { id: ' b ', order: 5, durationSec: 3, imagePrompt: 'img', videoPrompt: 'vid', imageModel: 'm1', videoModel: '' },
      { order: 1 },
    ])
    expect(shots.map(shot => shot.order)).toEqual([1, 2])
    expect(shots[1]!.id).toBe('b')
    expect(shots[1]!.imageModel).toBe('m1')
    expect(shots[1]!.videoModel).toBeUndefined()
    // 缺 id 时自动生成，缺时长落到默认 30 秒
    expect(shots[0]!.id).not.toBe('')
    expect(shots[0]!.durationSec).toBe(30)
    expect(() => normalizeShots(undefined)).toThrow(/必须是数组/)
    expect(() => normalizeShots([1])).toThrow(/必须是对象/)
  })

  it('rejects incomplete or unknown reorder lists and counts the next order', () => {
    const items = [{ id: 'a', order: 1 }, { id: 'b', order: 2 }]
    expect(applyReorder(items, ['b', 'a'], '分段').map(item => item.id)).toEqual(['b', 'a'])
    expect(() => applyReorder(items, ['a'], '分段')).toThrow(/必须包含全部/)
    expect(() => applyReorder(items, ['a', 'c'], '分段')).toThrow(/未知 id/)
    expect(nextOrder([])).toBe(1)
    expect(nextOrder(items)).toBe(3)
  })

  it('distributes a segment duration across shots with the sum exactly preserved', () => {
    expect(distributeDurationToShots(5, 2)).toEqual([3, 2])
    expect(distributeDurationToShots(60, 3)).toEqual([20, 20, 20])
    expect(distributeDurationToShots(10, 3)).toEqual([4, 3, 3])
    for (let total = 1; total <= 180; total += 1) {
      for (let count = 1; count <= 20; count += 1) {
        const durations = distributeDurationToShots(total, count)
        expect(durations).toHaveLength(count)
        expect(Math.min(...durations)).toBeGreaterThanOrEqual(1)
        expect(durations.reduce((sum, value) => sum + value, 0))
          .toBe(Math.max(total, count)) // 镜头多于秒数时每镜保底 1 秒
      }
    }
    expect(shotsDurationSec([
      { id: 's1', order: 1, durationSec: 3, imagePrompt: '', videoPrompt: '', refs: [] },
      { id: 's2', order: 2, durationSec: 2, imagePrompt: '', videoPrompt: '', refs: [] },
    ])).toBe(5)
  })
})
