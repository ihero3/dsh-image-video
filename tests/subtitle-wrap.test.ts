/**
 * 字幕多行排版（Track A / A25）：按宽度折行、尊重原文换行、drawtext 行距与换行串。
 */
import { describe, expect, it } from 'vitest'
import { estimateMaxCharsForWidth, wrapSubtitleLines } from '../src/workbench/subtitles.ts'
import { buildRenderArgs, freezeTimeline } from '../src/media/render.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const timeline = (text: string, fontSize = 32): TimelineRecord => ({
  schemaVersion: 3, id: 'tml-wrap', projectId: 'prj-1', name: '折行', frameRate: 30, burnSubtitles: true,
  tracks: [{
    id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: '/tmp/v.mp4', startMs: 0, durationMs: 3000 }],
  }, {
    id: 's1', kind: 'subtitle',
    clips: [{ id: 'c1', text, startMs: 0, durationMs: 3000, style: { fontSize, color: '#ffffff', position: 'bottom' } }],
  }],
  createdAt: '', updatedAt: '',
})

describe('wrapSubtitleLines (A25)', () => {
  it('keeps short lines untouched and respects existing newlines', () => {
    expect(wrapSubtitleLines('短句', 20)).toBe('短句')
    expect(wrapSubtitleLines('第一行\n第二行', 20)).toBe('第一行\n第二行')
    expect(wrapSubtitleLines('   \n  ', 20)).toBe('')
  })

  it('wraps long lines at punctuation and never exceeds the limit', () => {
    const text = '这是一句非常长的字幕，需要在合适的位置折行显示，否则会超出画面宽度'
    const wrapped = wrapSubtitleLines(text, 12)
    const lines = wrapped.split('\n')
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(12)
    expect(lines.join('')).toContain('这是一句')
  })

  it('estimates chars per line from width and font size', () => {
    expect(estimateMaxCharsForWidth(1280, 32)).toBeGreaterThan(30)
    expect(estimateMaxCharsForWidth(720, 48)).toBeLessThan(estimateMaxCharsForWidth(1280, 48))
    expect(estimateMaxCharsForWidth(200, 40)).toBeGreaterThanOrEqual(6)
  })
})

describe('multi-line drawtext (A25)', () => {
  it('emits line_spacing and an escaped newline for long subtitles', () => {
    // 字号 48 时 1280 宽每行只放约 22 字 → 这句一定会折行
    const args = buildRenderArgs(freezeTimeline(timeline('这是一句非常长的字幕，需要在合适的位置折行显示，否则会超出画面宽度', 48)), { outputPath: '/tmp/out.mp4' })
    const filter = args[args.indexOf('-filter_complex') + 1] ?? ''
    expect(filter).toContain('line_spacing=')
    expect(filter).toContain('\\n') // drawtext 的换行序列
  })
})
