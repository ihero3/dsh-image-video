// @vitest-environment jsdom
/**
 * 面板状态块（R6-3b）。
 *
 * 只测四种形态的语义与关键交互：加载有 `aria-busy`、错误是 `role="alert"` 且能重试、
 * 空态是 `role="status"` 且能挂主动作。内容态的渲染不归这里管。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { PanelState } from '../src/client/panels/PanelState.tsx'

afterEach(cleanup)

describe('PanelState', () => {
  it('loading：骨架数量可调，带 aria-busy 与 role=status', () => {
    const view = render(<PanelState view={{ kind: 'loading', rows: 5 }} />)
    const node = view.container.querySelector('[data-panel-state="loading"]') as HTMLElement
    expect(node.getAttribute('role')).toBe('status')
    expect(node.getAttribute('aria-busy')).toBe('true')
    expect(node.querySelectorAll('i')).toHaveLength(5)
  })

  it('loading：默认 3 条，且数量被夹在 1..6（防止传错值画出 200 行骨架）', () => {
    const def = render(<PanelState view={{ kind: 'loading' }} />)
    expect(def.container.querySelectorAll('i')).toHaveLength(3)
    def.unmount()

    const tooMany = render(<PanelState view={{ kind: 'loading', rows: 99 }} />)
    expect(tooMany.container.querySelectorAll('i')).toHaveLength(6)
  })

  it('refreshing：细进度条 + aria-busy（保留旧数据时用）', () => {
    const view = render(<PanelState view={{ kind: 'refreshing' }} />)
    const node = view.container.querySelector('[data-panel-state="refreshing"]') as HTMLElement
    expect(node.getAttribute('role')).toBe('status')
    expect(node.getAttribute('aria-busy')).toBe('true')
  })

  it('error：role=alert、显示消息、重试按钮真的会回调', () => {
    const onRetry = vi.fn()
    const view = render(
      <PanelState view={{ kind: 'error', message: '加载失败', retryLabel: '重试', onRetry, detail: 'RPC timeout' }} />,
    )
    const node = view.container.querySelector('[data-panel-state="error"]') as HTMLElement
    expect(node.getAttribute('role')).toBe('alert')
    expect(node.textContent).toContain('加载失败')
    expect(node.querySelector('[data-panel-error-detail]')?.textContent).toBe('RPC timeout')

    fireEvent.click(node.querySelector('[data-panel-retry]') as HTMLElement)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('error：没有 detail 时不渲染详情行（不要留一条空白）', () => {
    const view = render(
      <PanelState view={{ kind: 'error', message: '失败', retryLabel: '重试', onRetry: () => {} }} />,
    )
    expect(view.container.querySelector('[data-panel-error-detail]')).toBeNull()
  })

  it('empty：role=status、标题 + 提示 + 主动作都在', () => {
    const view = render(
      <PanelState
        view={{ kind: 'empty', title: '还没有模型', hint: '先刷新一次', action: <button type="button">去生成</button> }}
      />,
    )
    const node = view.container.querySelector('[data-panel-state="empty"]') as HTMLElement
    expect(node.getAttribute('role')).toBe('status')
    expect(node.textContent).toContain('还没有模型')
    expect(node.textContent).toContain('先刷新一次')
    expect(node.querySelector('button')?.textContent).toBe('去生成')
  })
})
