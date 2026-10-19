/**
 * 列表虚拟化（`B2`）：超过 100 条只渲染可视区（+上下缓冲），小列表全量直出。
 *
 * 设计口径：
 * - **阈值以下零变化**：≤100 条时 DOM 与行为跟普通列表一模一样（连包裹节点都不加），
 *   现有键盘/aria 行为原样保留；超过阈值才切成"滚动容器 + 顶/底占位 li"结构。
 * - **HTML 合法**：占位用 `<li aria-hidden>` 而不是 `<div>`——li 始终是 ul 的直接子元素，
 *   列表语义（role=list/listitem）不被包裹层打断。
 * - **视口高度**：容器量到高度就用实测（`clientHeight`），量不到（jsdom、首帧前）
 *   退到 {@link FALLBACK_VIEWPORT}，保证窗口数学在任何环境下都确定。
 */
import { useCallback, useRef, useState, type ReactNode, type UIEvent } from 'react'

/** 超过这个条数才启用虚拟化。 */
export const VIRTUALIZE_THRESHOLD = 100
/** 单行估算高度（px），与 `.iv-row` 的实际行高对齐。 */
export const DEFAULT_ROW_HEIGHT = 28
/** 上下各多渲染的行数。 */
export const DEFAULT_OVERSCAN = 6
/** 量不到容器高度时的视口高度（px）。 */
export const FALLBACK_VIEWPORT = 240
/** 虚拟化时滚动容器的最大高度（px）。 */
export const VIRTUAL_LIST_MAX_HEIGHT = 240

/** 一次窗口计算的结果。 */
export interface VirtualWindow {
  /** 含在窗口里的首行下标。 */
  readonly start: number
  /** 窗口末行的**开区间**下标。 */
  readonly end: number
  /** 顶占位高度（px）。 */
  readonly topHeight: number
  /** 底占位高度（px）。 */
  readonly bottomHeight: number
  /** 撑开滚动条的总高度（px）。 */
  readonly totalHeight: number
}

/**
 * 算当前应该渲染哪些行（纯函数，方便单测）。
 * @param input - 滚动位置、视口高度、总条数与行高/缓冲参数。
 * @returns 窗口区间与顶/底占位高度。
 */
export function visibleWindow(input: {
  readonly scrollTop: number
  readonly viewportHeight: number
  readonly total: number
  readonly rowHeight?: number
  readonly overscan?: number
}): VirtualWindow {
  const rowHeight = input.rowHeight ?? DEFAULT_ROW_HEIGHT
  const overscan = input.overscan ?? DEFAULT_OVERSCAN
  const total = Math.max(0, Math.floor(input.total))
  const totalHeight = total * rowHeight
  if (total === 0) return { start: 0, end: 0, topHeight: 0, bottomHeight: 0, totalHeight: 0 }
  const viewport = input.viewportHeight > 0 ? input.viewportHeight : FALLBACK_VIEWPORT
  const first = Math.max(0, Math.floor(input.scrollTop / rowHeight))
  const visible = Math.max(1, Math.ceil(viewport / rowHeight))
  const start = Math.max(0, first - overscan)
  const end = Math.min(total, first + visible + overscan)
  return {
    start, end,
    topHeight: start * rowHeight,
    bottomHeight: Math.max(0, totalHeight - end * rowHeight),
    totalHeight,
  }
}

/** 虚拟列表的属性。 */
export interface VirtualListProps<T> {
  /** 全部条目（已按过滤条件收敛）。 */
  readonly items: readonly T[]
  /** 渲染一行（返回 `<li>`；调用方掌握 key 与 aria）。 */
  readonly renderRow: (item: T, index: number) => ReactNode
  /** 单行估算高度（px）。 */
  readonly rowHeight?: number
  /** 上下缓冲行数。 */
  readonly overscan?: number
  /** 附加类名（如 `iv-list`）。 */
  readonly className?: string
}

/**
 * 渲染一个列表：条数少时全量直出，条数多时只渲染可视区。
 * @param props - 见 {@link VirtualListProps}。
 * @returns `<ul>` 列表（虚拟化时内部带顶/底占位 li）。
 */
export function VirtualList<T>({
  items, renderRow, rowHeight = DEFAULT_ROW_HEIGHT, overscan = DEFAULT_OVERSCAN, className,
}: VirtualListProps<T>): ReactNode {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const scrollRaf = useRef<number | undefined>(undefined)

  const onScroll = useCallback((event: UIEvent<HTMLElement>) => {
    const element = event.currentTarget
    // 合并到一帧：滚动事件密度高，每次 setState 会连锁重渲整窗
    if (scrollRaf.current !== undefined) cancelAnimationFrame(scrollRaf.current)
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = undefined
      setScrollTop(element.scrollTop)
      setViewportHeight(element.clientHeight)
    })
  }, [])

  // ≤阈值：全量直出，DOM 与普通列表一致（小列表不值得虚拟化，且行为零变化）
  if (items.length <= VIRTUALIZE_THRESHOLD) {
    return <ul className={className}>{items.map((item, index) => renderRow(item, index))}</ul>
  }

  const window_ = visibleWindow({ scrollTop, viewportHeight, total: items.length, rowHeight, overscan })
  const rows: ReactNode[] = []
  for (let index = window_.start; index < window_.end; index += 1) {
    rows.push(renderRow(items[index] as T, index))
  }
  return (
    <ul
      className={className}
      onScroll={onScroll}
      style={{ maxHeight: VIRTUAL_LIST_MAX_HEIGHT, overflowY: 'auto' }}
    >
      {window_.topHeight > 0
        ? <li aria-hidden="true" style={{ height: window_.topHeight, padding: 0, border: 0, flex: 'none' }} />
        : null}
      {rows}
      {window_.bottomHeight > 0
        ? <li aria-hidden="true" style={{ height: window_.bottomHeight, padding: 0, border: 0, flex: 'none' }} />
        : null}
    </ul>
  )
}
