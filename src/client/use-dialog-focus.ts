/**
 * 浮层的焦点管理（R6-3）：打开时移入、Tab 循环、Esc 关闭、关闭后归还。
 *
 * 为什么是一个 hook 而不是给每个浮层各写一遍：`Workbench` 里有两处阻断式浮层
 * （默认值编辑器 / 帮助），它们的开合方式不同（一个是 `draft !== undefined`，
 * 一个是 `boolean`），但焦点行为必须完全一致——否则用户在不同浮层里会得到
 * 两种 Tab 手感。
 *
 * 用法：
 * ```tsx
 * const panelRef = useRef<HTMLDivElement>(null)
 * useDialogFocus(open, panelRef, () => { setOpen(false) })
 * return <div ref={panelRef} role="dialog" aria-modal="true">…</div>
 * ```
 * 调用方仍要自己给容器加 `tabIndex={-1}`（唯一没有可聚焦元素时焦点得有落点）
 * 与 `aria-modal`；hook 只负责行为，不替组件决定语义。
 */
import { useEffect, useRef, type RefObject } from 'react'

/** 可聚焦候选。刻意不覆盖 `contenteditable`：本项目没有富文本编辑面。 */
const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * 收集容器内可聚焦元素。
 *
 * 不用 `offsetParent` 判可见：jsdom 里它恒为 `null`，会把所有元素滤掉、让单测
 * 变成"永远空列表"。改为排除 `aria-hidden` 子树——这是本项目用来表达"隐藏"的唯一方式。
 */
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter(element => element.closest('[aria-hidden="true"]') === null)
}

/**
 * 给浮层挂上焦点管理。
 * @param open - 是否打开。
 * @param rootRef - 浮层根节点。
 * @param onClose - Esc 时调用（由调用方决定关哪个浮层）。
 */
export function useDialogFocus(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  // onClose 每次渲染都是新函数；用它做依赖会让 effect 反复重跑、焦点反复重置
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const container = rootRef.current
    if (container === null) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const items = focusables(container)
    const first = items[0] ?? container
    if (first === container && !container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1')
    first.focus()

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const current = focusables(container)
      if (current.length === 0) {
        // 没有任何可聚焦项：把焦点钉在容器上，别让它 Tab 到浮层背后的界面
        event.preventDefault()
        container.focus()
        return
      }
      const head = current[0]!
      const tail = current[current.length - 1]!
      const active = document.activeElement
      if (event.shiftKey && (active === head || active === container)) {
        event.preventDefault()
        tail.focus()
      } else if (!event.shiftKey && active === tail) {
        event.preventDefault()
        head.focus()
      }
    }

    // 捕获阶段：宿主若在冒泡阶段拦 Tab，这里仍然先拿到
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // 关闭后归还焦点：用户按 Esc 关闭时不该被丢回文档开头
      previous?.focus()
    }
  }, [open, rootRef])
}
