/**
 * B-11 素材库体检面板：体积排行 / 去重 / 项目统计。
 *
 * 三个端点都只报告不删除（宿主契约如此），所以这里只呈现可回收空间与建议保留项，
 * 不提供任何破坏性操作。`formatBytes` 由工作台注入，避免与主面板重复实现。
 */
import { useState } from 'react'
import { Icon } from '../icons.tsx'
import type { AssetSizeReport, AssetDuplicatesReport, AssetProjectStats, WorkbenchApi } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'

interface AssetHealthPanelProps {
  readonly api: WorkbenchApi
  readonly formatBytes: (bytes: number) => string
  readonly t: (key: WorkbenchLocaleKey) => string
}

type HealthTab = 'size' | 'dupes' | 'stats'

/** 路径只显示文件名；完整路径放进 `title`，面板宽度不足以展示绝对路径。 */
function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function AssetHealthPanel({ api, formatBytes, t }: AssetHealthPanelProps) {
  const [tab, setTab] = useState<HealthTab>('size')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [sizeData, setSizeData] = useState<AssetSizeReport | undefined>(undefined)
  const [dupesData, setDupesData] = useState<AssetDuplicatesReport | undefined>(undefined)
  const [statsData, setStatsData] = useState<AssetProjectStats | undefined>(undefined)

  const runReport = async () => {
    setLoading(true); setError(undefined)
    try {
      if (tab === 'size') setSizeData(await api.assetSizeReport(20))
      else if (tab === 'dupes') setDupesData(await api.assetDuplicates())
      else setStatsData(await api.assetProjectStats())
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="iv-health" data-health-panel="true">
      <div className="iv-tabs iv-health-tabs" role="tablist">
        {([
          ['size', t('healthSize')],
          ['dupes', t('healthDupes')],
          ['stats', t('healthStats')],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`iv-tab${tab === key ? ' on' : ''}`}
            data-health-tab={key}
            onClick={() => { setTab(key) }}
          >{label}</button>
        ))}
        <button
          type="button"
          className="iv-btn iv-btn--acc iv-btn--sm iv-health-run"
          data-health-run="true"
          disabled={loading}
          onClick={() => { void runReport() }}
        >
          <Icon name="refresh" size={11} />{loading ? t('healthRunning') : t('healthRun')}
        </button>
      </div>

      {error !== undefined && <div className="iv-notice iv-notice--error" role="alert">{error}</div>}

      {tab === 'size' && (
        <div className="iv-health-body" data-health-body="size">
          {sizeData === undefined
            ? <div className="iv-empty">{t('healthEmptyHint')}</div>
            : (
              <div className="iv-size-list">
                <div className="iv-size-summary iv-meta">
                  {t('healthSizeSummary')}: {formatBytes(sizeData.totalBytes)}
                  {' · '}{t('healthMedian')}: {formatBytes(sizeData.medianBytes)}
                  {' · '}{sizeData.top.length}/{sizeData.count} · {Math.round(sizeData.topShare * 100)}%
                </div>
                {sizeData.top.map(entry => (
                  <div key={entry.path} className="iv-size-row" data-size-path={entry.path}>
                    <span className="iv-size-name iv-ellipsis" title={entry.path}>{fileName(entry.path)}</span>
                    <span className="iv-size-bytes">{formatBytes(entry.bytes)}</span>
                    {entry.unused === true && <span className="iv-chip iv-chip--warn">{t('healthUnused')}</span>}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {tab === 'dupes' && (
        <div className="iv-health-body" data-health-body="dupes">
          {dupesData === undefined
            ? <div className="iv-empty">{t('healthEmptyHint')}</div>
            : dupesData.groups.length === 0
              ? <div className="iv-empty">{t('healthNoDupes')}</div>
              : (
                <div className="iv-dupes-list">
                  <div className="iv-size-summary iv-meta">
                    {t('healthReclaimable')}: {formatBytes(dupesData.reclaimableBytes)}
                    {' · '}{dupesData.hashedFiles + dupesData.skippedFiles} files
                  </div>
                  {dupesData.groups.map(group => (
                    <div key={group.keep} className="iv-dupes-group">
                      <div className="iv-dupes-group-head iv-meta">
                        {group.paths.length} × {formatBytes(group.bytes)} → {formatBytes(group.reclaimableBytes)}
                      </div>
                      {group.paths.map(path => (
                        <div
                          key={path}
                          className={`iv-dupes-item${path === group.keep ? ' keep' : ''}`}
                          data-dupe-path={path}
                        >
                          <span className="iv-ellipsis" title={path}>{fileName(path)}</span>
                          {path === group.keep && <span className="iv-chip iv-chip--ok">{t('healthSuggestedKeep')}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
        </div>
      )}

      {tab === 'stats' && (
        <div className="iv-health-body" data-health-body="stats">
          {statsData === undefined
            ? <div className="iv-empty">{t('healthEmptyHint')}</div>
            : statsData.projects.length === 0
              ? <div className="iv-empty">{t('healthNoProjects')}</div>
              : (
                <div className="iv-stats-list">
                  <div className="iv-size-summary iv-meta">
                    {t('healthSizeSummary')}: {formatBytes(statsData.totalBytes)}
                  </div>
                  {statsData.projects.map(project => (
                    <div key={project.projectId} className="iv-stats-row" data-stat-project={project.projectId}>
                      <div className="iv-stats-name iv-ellipsis" title={project.name}>{project.name}</div>
                      <div className="iv-stats-facts iv-meta">
                        {project.assets} {t('healthAssets')} · {formatBytes(project.bytes)}
                        {' · '}{t('healthReferenced')} {formatBytes(project.usedBytes)}
                        {' · '}{project.timelines} {t('healthTimelines')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </div>
      )}
    </div>
  )
}
