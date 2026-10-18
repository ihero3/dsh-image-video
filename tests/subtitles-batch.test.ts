/**
 * 字幕批量生成（Track A / A14）：按句切分 + 按字数分配时间 + 工具面一键写入。
 * 硬约束：连续、不重叠、不越界、每条不短于最短显示时长。
 */
import { describe, expect, it } from 'vitest'
import { planSubtitleClips, splitSubtitleSentences } from '../src/workbench/subtitles.ts'
import { makeSubtitleIds } from '../src/workbench/subtitles.ts'

describe('splitSubtitleSentences (A14)', () => {
  it('splits on sentence punctuation and keeps order', () => {
    expect(splitSubtitleSentences('第一句。第二句！第三句？')).toEqual(['第一句', '第二句', '第三句'])
    expect(splitSubtitleSentences('   \n \n ')).toEqual([])
  })

  it('splits long sentences on commas and hard-wraps what is still too long', () => {
    const text = '这是一句很长很长的话，需要按逗号切成几条字幕，而且还有一个超长的词需要硬切处理才可以'
    const pieces = splitSubtitleSentences(text, { maxChars: 10 })
    expect(pieces.length).toBeGreaterThan(2)
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(10)
    expect(pieces.join('')).toContain('这是一句')
  })
})

describe('planSubtitleClips (A14)', () => {
  it('lays clips end to end inside the window without overlap', () => {
    const clips = planSubtitleClips('第一句。第二句。第三句。', {
      startMs: 1000, endMs: 7000, newId: makeSubtitleIds('t'),
    })
    expect(clips).toHaveLength(3)
    expect(clips[0]!.startMs).toBe(1000)
    for (let index = 1; index < clips.length; index += 1) {
      const previous = clips[index - 1]!
      expect(clips[index]!.startMs).toBe(previous.startMs + previous.durationMs)
    }
    const last = clips[clips.length - 1]!
    expect(last.startMs + last.durationMs).toBeLessThanOrEqual(7000)
    expect(clips.map(clip => clip.text)).toEqual(['第一句', '第二句', '第三句'])
  })

  it('gives longer sentences more time and enforces the minimum duration', () => {
    const clips = planSubtitleClips('短。这是一条明显更长的字幕内容需要更多时间。', {
      startMs: 0, endMs: 6000, minDurationMs: 800, newId: makeSubtitleIds('d'),
    })
    expect(clips).toHaveLength(2)
    expect(clips[0]!.durationMs).toBeGreaterThanOrEqual(800)
    expect(clips[1]!.durationMs).toBeGreaterThan(clips[0]!.durationMs)
    expect(clips[0]!.startMs + clips[0]!.durationMs + clips[1]!.durationMs).toBeLessThanOrEqual(6000)
  })

  it('truncates instead of squeezing when the window cannot fit every sentence', () => {
    const text = Array.from({ length: 50 }, (_, index) => `第${index}句。`).join('')
    const clips = planSubtitleClips(text, { startMs: 0, endMs: 5000, minDurationMs: 1000, newId: makeSubtitleIds('x') })
    expect(clips).toHaveLength(5) // 5000 / 1000
    for (const clip of clips) expect(clip.durationMs).toBeGreaterThanOrEqual(1000)
  })

  it('rejects an invalid window and applies a shared style', () => {
    expect(() => planSubtitleClips('文本', { startMs: 100, endMs: 100 })).toThrow(/时间窗非法/)
    const [clip] = planSubtitleClips('字幕', {
      startMs: 0, endMs: 2000, style: { fontSize: 40, color: '#ffcc00', position: 'bottom' }, newId: makeSubtitleIds('s'),
    })
    expect(clip?.style).toEqual({ fontSize: 40, color: '#ffcc00', position: 'bottom' })
  })
})
