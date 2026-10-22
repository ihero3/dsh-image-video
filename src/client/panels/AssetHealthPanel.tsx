/**
 * B-11 素材库体检面板：去重 / 体积排行 / 项目统计。
 * 三端点全部只读（A 的契约也只报告不删除），界面对应三个 tab。
 */
import { useState } from 'react'
import { Icon } from '../icons.tsx'
import type { WorkbenchApi, AssetSizeReport, AssetDuplicatesReport, AssetProjectStats } from '../api.ts'

interface AssetHealthPanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: string) => string
}

type HealthTab = 'size' | 'dupes' | 'stats'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export function AssetHealthPanel({ api, t }: AssetHealthPanelProps) {
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
      <div className="iv-health-tabs" role="tablist">
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
            onClick={() => setTab(key)}
          >{label}</button>
        ))}
        <button
          type="button"
          className="iv-btn iv-btn--sm iv-health-run"
          disabled={loading}
          onClick={runReport}
        >
          <Icon name="refresh" />{loading ? t('healthRunning') : t('healthRun')}
        </button>
      </div>

      {error && <div className="iv-notice iv-notice--err" role="alert">{error}</div>}

      {/* 体积排行 */}
      {tab === 'size' && (
        <div className="iv-health-body">
          {!sizeData
            ? <div className="iv-empty">{t('healthEmptyHint')}</div>
            : (
              <div className="iv-size-list">
                <div className="iv-size-summary iv-meta">
                  {t('healthSizeSummary')}: {formatBytes(sizeData.totalBytes)} · {t('healthMedian')}: {formatBytes(sizeData.medianBytes)}
                </div>
                {sizeData.assets.map(a => (
                  <div key={a.id} className={`iv-size-row${a.unused ? ' unused' : ''}`}>
                    <span className="iv-size-name">{a.name}</span>
                    <span className="iv-size-bytes">{formatBytes(a.bytes)}</span>
                    {a.unused && <span className="iv-chip iv-chip--ghost">{t('healthUnused')}</span>}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* 去重 */}
      {tab === 'dupes' && (
        <div className="iv-health-body">
          {!dupesData
            ? <div className="iv-empty">{t('healthEmptyHint')}</div>
            : dupesData.groups.length === 0
              ? <div className="iv-empty">{t('healthNoDupes')}</div>
              : (
                <div className="iv-dupes-list">
                  <div className="iv-dupes-summary iv-meta">
                    {t('healthReclaimable')}: {formatBytes(dupesData.reclaimableBytes)}
                  </div>
                  {dupesData.groups.map((g, idx) => (
                    <div key={idx} className="iv-dupes-group">
                      <div className="iv-dupes-group-head iv-meta">{g.items.length} × {formatBytes(g.bytes)}</div>
                      {g.items.map(item => (
                        <div key={item.id} className={`iv-dupes-item${item.id === g.suggestedKeepId ? ' keep' : ''}`}>
                          <span>{item.name}</span>
                          {item.id === g.suggestedKeepId && <span className="iv-chip">{t('healthSuggestedKeep')}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
        </div>
      )}

      {/* 项目统计 */}
      {tab === 'stats' && (
        <div className="iv-health-body">
          {!statsData
            ? <div className="iv-empty">{t('healthEmptyHint')}</div>
            : statsData.projects.length === 0
              ? <div className="iv-empty">{t('healthNoProjects')}</div>
              : (
                <div className="iv-stats-list">
                  {statsData.projects.map(p => (
                    <div key={p.projectId} className="iv-stats-row">
                      <div className="iv-stats-name">{p.name}</div>
                      <div className="iv-stats-facts iv-meta">
                        {p.assetCount} {t('healthAssets')} · {formatBytes(p.totalBytes)} · {t('healthReferenced')} {formatBytes(p.referencedBytes)} · {p.timelineCount} {t('healthTimelines')}
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
