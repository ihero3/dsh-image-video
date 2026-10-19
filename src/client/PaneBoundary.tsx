/**
 * 面板错误边界（`B3`）：每个 pane 一个，单个面板崩掉只显示"该面板出错 + 重试"，
 * **不拖垮整个右栏**。
 *
 * 用法：把面板内容包进 `<PaneBoundary label={…} t={t}>…</PaneBoundary>`。
 * 健康时边界零 DOM 包裹（直接渲染 children），出错时换成一段自包含的
 * 空态（图标 + 面板名 + 简短错误 + 重试按钮）。重试 = 摘掉错误态并
 * 用递增的 key 重挂子树，让面板内的组件从头初始化。
 */
import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './icons.tsx'
import type { WorkbenchLocaleKey } from './locales.ts'

/** 错误边界属性。 */
export interface PaneBoundaryProps {
  /** 面板内容。 */
  readonly children: ReactNode
  /** 面板名（已本地化，出错文案里指明是哪个面板）。 */
  readonly label: string
  /** 文案函数（与 Workbench 同一个 `t`）。 */
  readonly t: (key: WorkbenchLocaleKey) => string
}

/** 边界内部状态。 */
interface PaneBoundaryState {
  /** 当前捕获到的错误；undefined = 健康。 */
  readonly error: Error | undefined
  /** 重试次数（同时用作子树 key：变了就整棵重挂）。 */
  readonly attempt: number
}

/** 捕获渲染期错误并换成面板级空态的边界。 */
export class PaneBoundary extends Component<PaneBoundaryProps, PaneBoundaryState> {
  state: PaneBoundaryState = { error: undefined, attempt: 0 }

  /** 渲染出错：切换到错误空态。 */
  static getDerivedStateFromError(error: Error): Partial<PaneBoundaryState> {
    return { error }
  }

  /** 控制台留全栈（现场排查用）；界面只显示简短文案。 */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[dsh-image-video] pane crashed:', error.message, info.componentStack ?? '')
  }

  /** 重试：清错误态 + key 递增重挂子树。 */
  private retry = (): void => {
    this.setState(current => ({ error: undefined, attempt: current.attempt + 1 }))
  }

  render(): ReactNode {
    const { error, attempt } = this.state
    if (error === undefined) {
      // key 随 attempt 变：重试后子树整棵重挂，组件内状态回到初始
      return <Fragment key={attempt}>{this.props.children}</Fragment>
    }
    const { t, label } = this.props
    return (
      <div className="iv-empty" data-pane-error="true" role="alert">
        <span className="iv-empty-tile"><Icon name="alert" size={17} /></span>
        <strong>{t('paneError')} · {label}</strong>
        <span className="iv-meta iv-ellipsis" style={{ maxWidth: '100%' }} title={error.message}>
          {error.message.slice(0, 120)}
        </span>
        <button
          type="button"
          className="iv-btn iv-btn--sm"
          data-pane-error-retry="true"
          onClick={this.retry}
        >
          {t('paneErrorRetry')}
        </button>
      </div>
    )
  }
}
