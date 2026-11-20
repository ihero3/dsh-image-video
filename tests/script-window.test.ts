import { describe, expect, it } from 'vitest'
import { splitScriptWindows } from '../src/workbench/script-window.ts'

describe('splitScriptWindows', () => {
  it('短剧本不切段', () => {
    expect(splitScriptWindows('第一幕：雨夜街头。', 100)).toEqual([])
  })

  it('按章节标题切，并带上章节名', () => {
    const script = ['第一章 起因', '甲'.repeat(60), '', '第二章 冲突', '乙'.repeat(60)].join('\n')
    const windows = splitScriptWindows(script, 100)
    expect(windows.length).toBe(2)
    expect(windows[0]?.title).toBe('第一章 起因')
    expect(windows[1]?.title).toBe('第二章 冲突')
    expect(windows.every(item => item.chars <= 100)).toBe(true)
  })

  it('没有章节标记时按空行段落切', () => {
    const script = [`段一${'甲'.repeat(60)}`, `段二${'乙'.repeat(60)}`, `段三${'丙'.repeat(60)}`].join('\n\n')
    const windows = splitScriptWindows(script, 100)
    expect(windows.length).toBeGreaterThan(1)
    expect(windows.every(item => item.chars <= 100)).toBe(true)
    expect(windows.every(item => item.title.startsWith('第 '))).toBe(true)
  })

  it('单个超长段落按字数硬切，内容不丢', () => {
    const body = '甲'.repeat(250)
    const windows = splitScriptWindows(`第一章 长段\n${body}`, 100)
    expect(windows.every(item => item.chars <= 100)).toBe(true)
    expect(windows.map(item => item.text).join('')).toContain(body)
  })

  it('整本长篇（约 100 万字）切出的每段都在上限内', () => {
    const script = Array.from({ length: 1_100 }, (_, index) => `第${index + 1}章 标题\n${'雨'.repeat(900)}\n`).join('\n')
    const windows = splitScriptWindows(script)
    expect(windows.length).toBeGreaterThan(100)
    expect(windows.every(item => item.chars <= 20_000)).toBe(true)
    expect(windows.reduce((sum, item) => sum + item.chars, 0)).toBeGreaterThan(900_000)
  })
})
