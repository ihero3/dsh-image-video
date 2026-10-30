/**
 * B-12 生成结果卡片：任务列表的一行，带缩略图与产物操作。
 *
 * 状态文案/圆点/摘要由调用方算好传入，避免与 Workbench 里的同名辅助函数重复。
 */
import { useState } from 'react'
import { Icon } from '../icons.tsx'
import type { WorkbenchApi } from '../api.ts'
import type { MediaKind, TaskRecord } from '../../workbench/records.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'

export interface TaskCardProps {
  readonly api: WorkbenchApi
  readonly task: TaskRecord
  /** 当前项目；无项目时禁用「登记素材」。 */
  readonly projectId: string | undefined
  /** 已本地化的任务状态。 */
  readonly statusLabel: string
  /** 状态圆点类名。 */
  readonly dotClass: string
  /** `模型 · 大小 · 时间` 摘要。 */
  readonly metaText: string
  readonly onPreview: (path: string, kind: MediaKind) => void
  /** 把产物路径塞回快速生成的参考图选择器。 */
  readonly onUseAsReference: (path: string, kind: MediaKind) => void
  /** 追加到当前项目时间轴；无项目/时间轴不可用时为 `undefined`。 */
  readonly onAddToTimeline: ((path: string) => void) | undefined
  readonly onTasksChanged: () => Promise<void>
  readonly onAssetsChanged: () => Promise<void>
  readonly onNotice: (text: string, tone: 'info' | 'error') => void
  /** 宿主动作包装：统一 busy 与失败通知。 */
  readonly run: (action: () => Promise<void>) => void
  readonly t: (key: WorkbenchLocaleKey) => string
}

/** `/outputs/<文件名>`：宿主把 outputs 目录按文件名暴露给界面。 */
function outputUrl(path: string): string {
  return `/outputs/${encodeURIComponent(path.split(/[\\/]/).pop() ?? '')}`
}

export function TaskCard(props: TaskCardProps) {
  // `T10`：失败原因默认折叠——卡片很密，展开会挤掉其他行；但必须能一键看到原文
  const [errorOpen, setErrorOpen] = useState(false)
  const {
    api, task, projectId, statusLabel, dotClass, metaText, onPreview, onUseAsReference,
    onAddToTimeline, onTasksChanged, onAssetsChanged, onNotice, run, t,
  } = props
  const path = task.outputPath
  const canOperate = path !== undefined && task.status !== 'running' && task.status !== 'queued'

  /** 用原参数重跑一次。 */
  const regenerate = () => {
    const prompt = task.prompt?.trim() ?? ''
    if (prompt === '') { onNotice(t('regenerateNoPrompt'), 'error'); return }
    void run(async () => {
      await api.generateMedia({ mediaMode: task.kind, prompt, projectId, model: task.model })
      await onTasksChanged()
      await onAssetsChanged()
    })
  }

  /** 把这条产物登记成项目素材。 */
  const register = () => {
    if (path === undefined || projectId === undefined) return
    void run(async () => {
      const attached = await api.attachAsset({
        projectId, path, kind: task.kind,
        bytes: task.bytes, provider: task.provider, model: task.model, prompt: task.prompt,
      })
      if (!attached.created) onNotice(t('alreadyRegistered'), 'info')
      await api.assignTask(task.id, projectId)
      await onAssetsChanged()
      await onTasksChanged()
    })
  }

  const cancel = () => {
    void run(async () => {
      await api.cancelTask(task.id)
      await onTasksChanged()
    })
  }

  return (
    <li className="iv-row" data-task-card={task.id}>
      <span className={dotClass} aria-hidden="true" />
      {path === undefined
        ? <span className="iv-tile"><Icon name={task.kind === 'video' ? 'video' : 'image'} size={13} /></span>
        : task.kind === 'video'
          ? <video className="iv-thumb" src={outputUrl(path)} preload="metadata" muted playsInline aria-hidden="true" />
          : <img className="iv-thumb" src={outputUrl(path)} alt="" />}
      <button
        type="button"
        className="iv-row-btn"
        aria-label={`${t('previewOutput')} ${task.id}`}
        disabled={path === undefined}
        onClick={() => { if (path !== undefined) onPreview(path, task.kind) }}
        title={task.error ?? task.prompt ?? path ?? ''}
      >
        {statusLabel}{' · '}{metaText}
      </button>
      <div className="iv-row-actions">
        {task.status === 'running' && (
          <button type="button" className="iv-btn iv-btn--sm" aria-label={`${t('cancelTask')} ${task.id}`} onClick={cancel}>
            {t('cancelTask')}
          </button>
        )}
        {path !== undefined && (
          <button
            type="button"
            className="iv-btn iv-btn--sm"
            aria-label={`${t('registerAsAsset')} ${task.id}`}
            title={t('registerAsAsset')}
            disabled={projectId === undefined}
            onClick={register}
          >
            {t('registerAsAsset')}
          </button>
        )}
        {task.status === 'failed' && task.error !== undefined
          ? (
            <button
              type="button"
              className="iv-btn iv-btn--sm"
              data-task-error-toggle={task.id}
              aria-expanded={errorOpen}
              title={t('taskErrorHint')}
              onClick={() => { setErrorOpen(open => !open) }}
            >
              <Icon name="alert" size={11} />{errorOpen ? t('taskErrorHide') : t('taskErrorShow')}
            </button>
          )
          : null}
        <button
          type="button"
          className="iv-btn iv-btn--sm"
          title={task.prompt === undefined ? t('regenerateNoPrompt') : t('regenerateHint')}
          disabled={!canOperate}
          onClick={regenerate}
        >
          <Icon name="refresh" size={11} />{t('regenerate')}
        </button>
        <button
          type="button"
          className="iv-btn iv-btn--sm"
          title={t('useAsRefHint')}
          disabled={!canOperate}
          onClick={() => { if (path !== undefined) onUseAsReference(path, task.kind) }}
        >
          <Icon name="link" size={11} />{t('useAsReference')}
        </button>
        {task.kind === 'video' && (
          <button
            type="button"
            className="iv-btn iv-btn--sm"
            title={onAddToTimeline === undefined ? t('noTimelinesHint') : t('addToTimelineHint')}
            disabled={!canOperate || onAddToTimeline === undefined}
            onClick={() => { if (path !== undefined) onAddToTimeline?.(path) }}
          >
            <Icon name="film" size={11} />{t('addToTimeline')}
          </button>
        )}
      </div>
      {/* `T10` 失败原文：默认折叠（卡片很密），展开后完整显示上游返回，便于自救或报障 */}
      {task.status === 'failed' && task.error !== undefined && errorOpen
        ? (
          <pre className="iv-task-error" data-task-error={task.id}>{task.error}</pre>
        )
        : null}
    </li>
  )
}
