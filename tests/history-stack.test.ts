/**
 * 撤销/重做领域支撑（Track A / A3）：两个编辑面共用的历史语义。
 * 关键约定：相同状态不记历史、新编辑清空 redo、有上限、可看"下一步撤销什么"。
 */
import { describe, expect, it } from 'vitest'
import { HistoryStack } from '../src/workbench/history.ts'

interface Doc { readonly value: number; readonly note?: string }

const doc = (value: number): Doc => ({ value })
const fixedNow = () => new Date('2026-10-18T00:00:00.000Z')

describe('HistoryStack (A3)', () => {
  it('commits, undoes and redoes in order', () => {
    const history = new HistoryStack<Doc>(doc(1))
    expect(history.canUndo).toBe(false)
    expect(history.commit(doc(2), '加一', fixedNow)).toBe(true)
    expect(history.commit(doc(3), '再加一', fixedNow)).toBe(true)
    expect(history.undoSize).toBe(2)

    expect(history.undo()).toEqual(doc(2))
    expect(history.current).toEqual(doc(2))
    expect(history.canRedo).toBe(true)
    expect(history.redo()).toEqual(doc(3))
    expect(history.current).toEqual(doc(3))
    expect(history.redo()).toBeUndefined()
  })

  it('ignores no-op commits and clears redo on a new edit', () => {
    const history = new HistoryStack<Doc>(doc(1))
    expect(history.commit(doc(1), '没变化', fixedNow)).toBe(false)
    expect(history.undoSize).toBe(0)

    history.commit(doc(2), 'b', fixedNow)
    history.commit(doc(3), 'c', fixedNow)
    history.undo() // → 2，redo 里有 3
    expect(history.canRedo).toBe(true)
    history.commit(doc(9), 'd', fixedNow) // 新编辑 → redo 清空
    expect(history.canRedo).toBe(false)
    expect(history.current.value).toBe(9)
  })

  it('trims to the configured limit and reports what undo/redo would do', () => {
    const history = new HistoryStack<Doc>(doc(0), { limit: 3 })
    for (let value = 1; value <= 10; value += 1) history.commit(doc(value), `step-${value}`, fixedNow)
    expect(history.undoSize).toBe(3)
    expect(history.peekUndo()).toMatchObject({ label: 'step-10', at: '2026-10-18T00:00:00.000Z' })
    // 最多只能退回到第 7 步（前 7 步被裁掉）
    while (history.canUndo) history.undo()
    expect(history.current.value).toBe(7)
    expect(history.peekRedo()).toMatchObject({ label: 'step-8' })
  })

  it('supports commitWith and reset', () => {
    const history = new HistoryStack<Doc>(doc(1))
    history.commitWith(current => ({ ...current, value: current.value + 1, note: 'via updater' }), 'updater')
    expect(history.current).toEqual({ value: 2, note: 'via updater' })
    history.reset(doc(42))
    expect(history.current.value).toBe(42)
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })

  it('accepts a custom equality so big documents can be compared cheaply', () => {
    const history = new HistoryStack<Doc>(doc(1), { equals: (left, right) => left.value === right.value })
    expect(history.commit({ value: 1, note: '改备注也算相同' }, 'note')).toBe(false)
    expect(history.commit({ value: 2, note: '值变了' }, 'value')).toBe(true)
  })
})
