// @vitest-environment jsdom
/**
 * B4 历史栈（快照撤销/重做）的单元行为：合并窗口、重做栈清理、换文档重置。
 * 画布集成用例在 `workflow-canvas.client.test.tsx`。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { COALESCE_MS, useHistoryStack } from '../src/client/use-history-stack.ts'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('B4 history stack', () => {
  it('undoes and redoes committed states', () => {
    const { result } = renderHook(() => useHistoryStack({ value: 0 }))
    expect(result.current.undoDepth).toBe(0)
    expect(result.current.canUndo).toBe(false)

    act(() => { result.current.commit({ value: 1 }) })
    act(() => { result.current.commit({ value: 2 }) })
    expect(result.current.present).toEqual({ value: 2 })
    expect(result.current.undoDepth).toBe(2)

    let undone: { value: number } | undefined
    act(() => { undone = result.current.undo() })
    expect(undone).toEqual({ value: 1 })
    expect(result.current.present).toEqual({ value: 1 })
    expect(result.current.redoDepth).toBe(1)

    let redone: { value: number } | undefined
    act(() => { redone = result.current.redo() })
    expect(redone).toEqual({ value: 2 })
    expect(result.current.present).toEqual({ value: 2 })
    expect(result.current.redoDepth).toBe(0)
  })

  it('merges consecutive same-tag commits inside the coalesce window', () => {
    const { result } = renderHook(() => useHistoryStack({ value: 0 }))
    act(() => { result.current.commit({ value: 1 }, 'drag:n1') })
    // 同 tag、窗口内：只换当前态，不占历史位（拖拽每像素一个变化）
    act(() => { vi.advanceTimersByTime(COALESCE_MS - 100) })
    act(() => { result.current.commit({ value: 2 }, 'drag:n1') })
    expect(result.current.undoDepth).toBe(1)
    expect(result.current.present).toEqual({ value: 2 })

    // 窗口外：重新计一步
    act(() => { vi.advanceTimersByTime(COALESCE_MS + 100) })
    act(() => { result.current.commit({ value: 3 }, 'drag:n1') })
    expect(result.current.undoDepth).toBe(2)

    // 不同 tag 不合并
    act(() => { result.current.commit({ value: 4 }, 'add:n2') })
    expect(result.current.undoDepth).toBe(3)

    // 撤销依次回到 0
    act(() => { result.current.undo() })
    expect(result.current.present).toEqual({ value: 3 })
    act(() => { result.current.undo() })
    expect(result.current.present).toEqual({ value: 2 })
    act(() => { result.current.undo() })
    expect(result.current.present).toEqual({ value: 0 })
    expect(result.current.canUndo).toBe(false)
  })

  it('clears the redo stack once a new commit lands', () => {
    const { result } = renderHook(() => useHistoryStack({ value: 0 }))
    act(() => { result.current.commit({ value: 1 }) })
    act(() => { result.current.undo() })
    expect(result.current.redoDepth).toBe(1)
    act(() => { result.current.commit({ value: 9 }, 'other') })
    expect(result.current.redoDepth).toBe(0)
    expect(result.current.present).toEqual({ value: 9 })
  })

  it('resets the stack when the document changes', () => {
    const { result } = renderHook(() => useHistoryStack({ value: 0 }))
    act(() => { result.current.commit({ value: 1 }) })
    act(() => { result.current.commit({ value: 2 }) })
    act(() => { result.current.reset({ value: 100 }) })
    expect(result.current.present).toEqual({ value: 100 })
    expect(result.current.undoDepth).toBe(0)
    expect(result.current.redoDepth).toBe(0)
  })
})
