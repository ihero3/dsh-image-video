/**
 * 面板状态块（R6-3b）：加载中 / 空 / 错误 / 刷新中，四种形态只在这里渲染。
 *
 * 为什么不是 `PanelLoading` / `PanelEmpty` / `PanelError` 三个组件：调用方要在三个
 * 互不相干的 API 之间做选择，而且真实状态里还有"刷新中"（保留旧数据）和"出错但
 * 旧数据还在"——三个组件表达不了，最后一定是每个面板自己拼一遍。
 *
 * 这里只渲染**非内容态**；"ready" 由调用方直接渲染内容，"出错但保留旧数据"由调用方
 * 把本组件放在顶部、下面继续渲染旧数据（组件不接管 stale，避免耦合）。
 *
 * 文案一律由调用方传入并复用现有 locale key——`locales.ts` 在入口包里，
 * 入口体积只剩几百字节，这个批次不允许新增文案键。
 */
import type { ReactNode } from 'react'
import { Icon, type IconName } from '../icons.tsx'

/** 面板可渲染的四种状态（内容态由调用方负责）。 */
export type PanelView =
  | { readonly kind: 'loading'; readonly rows?: number }
  | {
    readonly kind: 'empty'
    readonly title: string
    readonly hint?: string
    readonly icon?: IconName
    readonly action?: ReactNode
  }
  | {
    readonly kind: 'error'
    readonly message: string
    readonly retryLabel: string
    readonly onRetry: () => void
    /** 原始错误（默认折叠，只在有值时显示一行小字）。 */
    readonly detail?: string
  }
  | { readonly kind: 'refreshing' }

/**
 * 渲染状态块。
 * @param view - 状态判别式。
 * @returns 对应形态的节点。
 */
export function PanelState({ view }: { readonly view: PanelView }): ReactNode {
  if (view.kind === 'loading') {
    const rows = Math.max(1, Math.min(6, view.rows ?? 3))
    return (
      <div className="iv-skel" data-panel-state="loading" role="status" aria-busy="true">
        {Array.from({ length: rows }, (_, index) => <i key={index} />)}
      </div>
    )
  }

  if (view.kind === 'refreshing') {
    return (
      <div className="iv-refreshing" data-panel-state="refreshing" role="status" aria-busy="true">
        <i />
      </div>
    )
  }

  if (view.kind === 'error') {
    return (
      <div className="iv-alert" data-panel-state="error" role="alert">
        <Icon name="alert" size={12} />
        <div className="iv-alert-body">
          <span>{view.message}</span>
          {view.detail === undefined
            ? null
            : <div className="iv-alert-detail" data-panel-error-detail="true">{view.detail}</div>}
        </div>
        <button type="button" className="iv-btn iv-btn--sm" data-panel-retry="true" onClick={view.onRetry}>
          {view.retryLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="iv-empty" data-panel-state="empty" role="status">
      <span className="iv-empty-tile"><Icon name={view.icon ?? 'film'} size={17} /></span>
      <strong>{view.title}</strong>
      {view.hint === undefined ? null : <span className="iv-meta">{view.hint}</span>}
      {view.action}
    </div>
  )
}
