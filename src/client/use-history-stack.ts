/**
 * 撤销/重做历史栈（`B4`）：画布编辑的快照栈。
 *
 * 口径与取舍：
 * - **客户端快照栈**：`A3`（宿主命令式变更 API）尚未落地，先用画布侧快照栈把
 *   撤销/重做接上；行为对用户等价（编辑→撤销→重做后文档逐字段一致），A3 落地后
 *   可原地切换（见 `docs/API-SURFACE.md`「B 申请」）。
 * - **合并窗口**：同一 `tag` 的连续改动在 {@link COALESCE_MS} 内算一步——
 *   拖拽（每像素一个 position 变化）和连续打字（每个字符一个 param 变化）
 *   不会把历史栈撑爆，一步撤销 = 一次拖拽 / 一轮输入。
 * - **上限**：{@link UNDO_LIMIT} 步，再老的丢弃（画布文档有去抖落库兜底）。
 */
import { useCallback, useRef, useState } from 'react'

/** 同 tag 连续改动的合并窗口（毫秒）。 */
export const COALESCE_MS = 800
/** 历史栈深度上限。 */
export const UNDO_LIMIT = 100

/** 历史栈的对外形态。 */
export interface HistoryStack<T> {
  /** 当前态。 */
  readonly present: T
  /** 还能撤几步。 */
  readonly undoDepth: number
  /** 还能重做几步。 */
  readonly redoDepth: number
  readonly canUndo: boolean
  readonly canRedo: boolean
  /**
   * 提交一个新状态。
   * @param next - 新状态。
   * @param tag - 合并标签：同 tag 且在合并窗口内则替换当前态（不推历史）。
   */
  readonly commit: (next: T, tag?: string) => void
  /** 撤销；返回新的当前态，无历史可撤时返回 undefined。 */
  readonly undo: () => T | undefined
  /** 重做；返回新的当前态，无可重做时返回 undefined。 */
  readonly redo: () => T | undefined
  /** 换文档（切项目/重新播种）时重置历史。 */
  readonly reset: (next: T) => void
}

/** 三段式历史状态。 */
interface HistoryState<T> {
  readonly past: readonly T[]
  readonly present: T
  readonly future: readonly T[]
}

/**
 * 建一个快照历史栈。
 * @param initial - 初始状态。
 * @returns 栈操作（见 {@link HistoryStack}）。
 */
export function useHistoryStack<T>(initial: T): HistoryStack<T> {
  const [state, setState] = useState<HistoryState<T>>({ past: [], present: initial, future: [] })
  // 回调里要读最新态：用 ref 镜像，避免把 state 塞进依赖导致回调身份抖动
  const stateRef = useRef(state)
  stateRef.current = state
  const lastTag = useRef<string | undefined>(undefined)
  const lastAt = useRef(0)

  const commit = useCallback((next: T, tag?: string) => {
    const current = stateRef.current
    if (current.present === next) return
    const now = Date.now()
    const coalesce = tag !== undefined && tag === lastTag.current && now - lastAt.current < COALESCE_MS
    lastTag.current = tag
    lastAt.current = now
    if (coalesce) {
      // 合并：替换当前态，历史与重做栈都不动
      setState(current_ => ({ ...current_, present: next }))
      return
    }
    setState({
      past: [...current.past, current.present].slice(-UNDO_LIMIT),
      present: next,
      future: [],
    })
  }, [])

  const undo = useCallback((): T | undefined => {
    const current = stateRef.current
    if (current.past.length === 0) return undefined
    const previous = current.past[current.past.length - 1]!
    lastTag.current = undefined
    setState({
      past: current.past.slice(0, -1),
      present: previous,
      future: [current.present, ...current.future],
    })
    return previous
  }, [])

  const redo = useCallback((): T | undefined => {
    const current = stateRef.current
    if (current.future.length === 0) return undefined
    const next = current.future[0]!
    lastTag.current = undefined
    setState({
      past: [...current.past, current.present],
      present: next,
      future: current.future.slice(1),
    })
    return next
  }, [])

  const reset = useCallback((next: T) => {
    lastTag.current = undefined
    lastAt.current = 0
    setState({ past: [], present: next, future: [] })
  }, [])

  return {
    present: state.present,
    undoDepth: state.past.length,
    redoDepth: state.future.length,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    commit, undo, redo, reset,
  }
}
