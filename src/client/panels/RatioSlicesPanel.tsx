/**
 * `B-5` 成片多比例切片面板：一条成片按多种画幅各导出一次。
 *
 * 只编码不重新生成（宿主 `timelines/render-ratios` 保证短边不变）。
 * 没有时间轴时如实提示，不假装能导出。
 */
import { useState } from 'react'
import { Icon } from '../icons.tsx'
import type { RenderRatioResult, WorkbenchApi } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'

interface RatioSlicesPanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  /** 当前选中的时间轴（来自时间轴模式）；缺省时提示先打开一条。 */
  readonly timelineId?: string
  readonly projectId?: string
}

/** 三种目标画幅（id 与宿主一致：保持短边不变）。 */
const RATIOS: ReadonlyArray<{ readonly id: string; readonly labelKey: WorkbenchLocaleKey }> = [
  { id: '9:16', labelKey: 'ratioPortrait9x16' },
  { id: '1:1', labelKey: 'ratioSquare1x1' },
  { id: '4:3', labelKey: 'ratioClassic4x3' },
]

export function RatioSlicesPanel({ api, t, timelineId, projectId }: RatioSlicesPanelProps) {
  const [picked, setPicked] = useState<readonly string[]>(['9:16'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [result, setResult] = useState<RenderRatioResult | undefined>(undefined)

  const run = async () => {
    if (timelineId === undefined) { setError(t('ratioSlicesNeedsTimeline')); return }
    if (picked.length === 0) { setError(t('ratioSlicesNone')); return }
    setBusy(true); setError(undefined)
    try {
      const next = await api.renderRatioSlices({ timelineId, ratios: picked, ...projectId === undefined ? {} : { priority: 5 } })
      setResult(next)
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string) => {
    setPicked(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]))
  }

  return (
    <div className="iv-ratio-slices" data-ratio-slices="true">
      <div className="iv-fusion-head">
        <span className="iv-chip"><Icon name="film" size={11} />{t('ratioSlicesTitle')}</span>
      </div>
      <span className="iv-meta">{t('ratioSlicesHint')}</span>
      {timelineId === undefined
        ? <span className="iv-meta iv-meta--warn" data-ratio-needs-timeline="true">{t('ratioSlicesNeedsTimeline')}</span>
        : (
          <div className="iv-ratio-picks" data-ratio-picks="true">
            {RATIOS.map(ratio => (
              <label key={ratio.id} className="iv-check">
                <input
                  type="checkbox"
                  checked={picked.includes(ratio.id)}
                  data-ratio-pick={ratio.id}
                  onChange={() => { toggle(ratio.id) }}
                />
                <span>{t(ratio.labelKey)}</span>
              </label>
            ))}
          </div>
        )}
      <button
        type="button"
        className="iv-btn iv-btn--acc iv-btn--sm"
        data-ratio-run="true"
        disabled={busy || timelineId === undefined || picked.length === 0}
        onClick={() => { void run() }}
      >
        {busy ? t('ratioSlicesBusy') : t('ratioSlicesRun')}
      </button>
      {error !== undefined
        ? <span className="iv-meta iv-meta--warn" data-ratio-error="true">{error}</span>
        : null}
      {result === undefined
        ? null
        : (
          <div className="iv-ratio-result" data-ratio-result="true">
            <span className="iv-meta">
              {result.slices.length === 0
                ? t('ratioSlicesFailed')
                : t('ratioSlicesDone').replace('{n}', String(result.slices.length))}
            </span>
            {result.slices.map(slice => (
              <span key={slice.ratio} className="iv-chip" data-ratio-slice={slice.ratio}>
                {slice.ratio} · {slice.width}×{slice.height}
              </span>
            ))}
            {result.warnings.length > 0
              ? <span className="iv-meta iv-meta--warn" data-ratio-warnings="true">{result.warnings.join('；')}</span>
              : null}
          </div>
        )}
    </div>
  )
}
