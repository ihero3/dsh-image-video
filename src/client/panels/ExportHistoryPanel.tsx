/**
 * B-16 导出历史面板（`A-11` `exports/list|record|update`）。
 *
 * 只读呈现 + 失败重试入口：四种状态（queued/running/succeeded/failed）各一个徽标，
 * 产物路径可点开（`/outputs/<文件名>` 路由，宿主只在 loopback 时注册），
 * 失败原因与耗时原样展示；重试由工作台统一记账（先 `exports/record` 再重渲），
 * 面板不自己发明状态。端点缺失时如实展示宿主错误，不伪造空历史。
 */
import { useEffect, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { ExportRecord, ExportStatus, WorkbenchApi } from '../api.ts'
import type { ProjectRecord } from '../../workbench/records.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'

interface ExportHistoryPanelProps {
  readonly api: WorkbenchApi
  readonly projects: readonly ProjectRecord[]
  readonly formatBytes: (bytes: number) => string
  /** 父级在导出收尾时自增，触发面板刷新（运行中的记录要能看到终态）。 */
  readonly refreshTick: number
  /** 重试入口：交给工作台记账 + 重渲，面板不直接碰渲染端点。 */
  readonly onRetry: (record: ExportRecord, label: string) => void
  readonly t: (key: WorkbenchLocaleKey) => string
}

/** 路径只显示文件名；完整路径放进 `title`，面板宽度不足以展示绝对路径。 */
function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

/** ISO 时间戳 → 本地 HH:MM（跨天/时区差异对“刚才导出”的场景够用）。 */
function clockTime(stamp: string): string {
  const parsed = Date.parse(stamp)
  if (Number.isNaN(parsed)) return stamp
  const date = new Date(parsed)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 秒数 → 人类可读耗时（不足 1 分钟给秒，以上给分秒）。 */
function formatElapsed(seconds: number | undefined): string {
  if (seconds === undefined) return '—'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

/** 状态 → 徽标类（与任务卡同一套色板）。 */
function statusChipClass(status: ExportStatus): string {
  if (status === 'succeeded') return ' iv-chip--ok'
  if (status === 'failed') return ' iv-chip--err'
  if (status === 'running') return ' iv-chip--run'
  return ''
}

/** 状态 → 既有任务文案键（四种状态复用，不新造轮子）。 */
function statusLabelKey(status: ExportStatus): WorkbenchLocaleKey {
  if (status === 'succeeded') return 'statusSucceeded'
  if (status === 'failed') return 'statusFailed'
  if (status === 'running') return 'statusRunning'
  return 'statusQueued'
}

export function ExportHistoryPanel({ api, projects, formatBytes, refreshTick, onRetry, t }: ExportHistoryPanelProps) {
  const [records, setRecords] = useState<readonly ExportRecord[] | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [projectFilter, setProjectFilter] = useState<string>('all')
  /** 手动刷新计数（与父级 refreshTick 共同触发重拉）。 */
  const [manualTick, setManualTick] = useState(0)
  /** timelineId → 名称（记录里只有 id，面板自己补齐显示名）。 */
  const [timelineNames, setTimelineNames] = useState<Readonly<Record<string, string>>>({})

  // 时间轴显示名：挂载时按项目各拉一次（项目数是小位数，N+1 可接受）。
  // 依赖用 id 签名而不是数组本身——轮询会换数组引用，不该触发重拉。
  const projectsKey = projects.map(project => project.id).join(',')
  useEffect(() => {
    let stale = false
    void (async () => {
      const names: Record<string, string> = {}
      await Promise.all(projects.map(async project => {
        try {
          const rows = await api.listTimelines(project.id)
          for (const row of rows) names[row.id] = row.name
        } catch {
          // 单个项目读失败不影响其它项目的名称补齐
        }
      }))
      if (!stale) setTimelineNames(names)
    })()
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- projectsKey 是 projects 的稳定签名
  }, [api, projectsKey])

  // 记录列表：挂载 / 切项目筛选 / 父级导出收尾 / 手动刷新时重拉
  useEffect(() => {
    let stale = false
    void (async () => {
      setLoading(true); setError(undefined)
      try {
        const rows = await api.listExports(projectFilter === 'all' ? {} : { projectId: projectFilter })
        if (!stale) setRecords(rows)
      } catch (thrown) {
        if (!stale) setError(thrown instanceof Error ? thrown.message : String(thrown))
      } finally {
        if (!stale) setLoading(false)
      }
    })()
    return () => { stale = true }
  }, [api, projectFilter, refreshTick, manualTick])

  const projectName = (projectId: string): string =>
    projects.find(project => project.id === projectId)?.name ?? projectId

  return (
    <div className="iv-exports" data-exports-panel="true">
      <div className="iv-exports-filter">
        <select
          className="iv-select iv-select--sm"
          aria-label={t('exportsFilterProject')}
          data-exports-filter="true"
          value={projectFilter}
          onChange={event => setProjectFilter(event.target.value)}
        >
          <option value="all">{t('exportsFilterAll')}</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <span className="iv-meta" data-exports-count="true">
          {records === undefined ? '' : t('exportsCount').replace('{n}', String(records.length))}
        </span>
        <button
          type="button"
          className="iv-btn iv-btn--sm"
          data-exports-refresh="true"
          disabled={loading}
          onClick={() => { setManualTick(current => current + 1) }}
        >
          <Icon name="refresh" size={11} />{t('exportsRefresh')}
        </button>
      </div>
      <span className="iv-meta">{t('exportsHint')}</span>

      {error !== undefined && <div className="iv-notice iv-notice--error" role="alert">{error}</div>}

      <div className="iv-exports-list">
        {records === undefined || records.length === 0
          ? <div className="iv-empty" data-exports-empty="true">{t('exportsEmpty')}</div>
          : records.map(record => {
              const label = timelineNames[record.timelineId] ?? record.timelineId
              return (
                <div className="iv-exp-row" key={record.id} data-export-record={record.id} data-export-status={record.status}>
                  <div className="iv-exp-head">
                    <span className={`iv-chip${statusChipClass(record.status)}`}>
                      <i className="iv-dot" aria-hidden="true" />
                      {t(statusLabelKey(record.status))}
                    </span>
                    <span className="iv-ellipsis" title={label}>{label}</span>
                    <span className="iv-meta">{projectName(record.projectId)}</span>
                  </div>
                  <div className="iv-exp-facts">
                    <span>{t('exportsOutput')}: {record.outputPath === undefined
                      ? '—'
                      : (
                        <a href={`/outputs/${encodeURIComponent(fileName(record.outputPath))}`} target="_blank" rel="noreferrer" title={record.outputPath}>
                          {fileName(record.outputPath)}
                        </a>
                      )}</span>
                    {record.bytes === undefined ? null : <span>{formatBytes(record.bytes)}</span>}
                    <span>{t('exportsElapsed')}: {formatElapsed(record.elapsedSeconds)}</span>
                    <span>{clockTime(record.startedAt)}</span>
                  </div>
                  {record.error === undefined ? null : (
                    <div className="iv-exp-facts" data-export-error={record.id}>
                      <span>{t('exportsError')}: {record.error}</span>
                    </div>
                  )}
                  {record.status === 'failed'
                    ? (
                      <div className="iv-exp-actions">
                        <button
                          type="button"
                          className="iv-btn iv-btn--sm"
                          data-export-retry={record.id}
                          onClick={() => { onRetry(record, label) }}
                        >
                          <Icon name="refresh" size={11} />{t('exportsRetry')}
                        </button>
                      </div>
                    )
                    : null}
                </div>
              )
            })}
      </div>
    </div>
  )
}
