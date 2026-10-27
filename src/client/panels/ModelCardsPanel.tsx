/**
 * `B-6` 模型能力卡面板：把 `models/catalog` 下发的卡片渲染成"选型参考"。
 *
 * 只展示、不强制——卡片字段不参与生成逻辑（生成仍由宿主/表单决定）。
 * `consistencyIssues` 非空说明卡片与运行时能力漂移，照实提示，不粉饰。
 */
import { useEffect, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { ModelCardView, WorkbenchApi } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'

interface ModelCardsPanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
}

type CostTier = ModelCardView['costTier']

const COST_KEY: Record<CostTier, WorkbenchLocaleKey> = {
  low: 'modelCardCostLow',
  medium: 'modelCardCostMedium',
  high: 'modelCardCostHigh',
}

/** 能力矩阵里的一行（图标 + 标签 + 支持/不支持）。 */
function FeatureRow({ on, label, t }: { readonly on: boolean; readonly label: string; readonly t: (key: WorkbenchLocaleKey) => string }) {
  return (
    <span className={`iv-feature${on ? ' on' : ''}`} title={on ? t('modelFeatureOn') : t('modelFeatureOff')}>
      <Icon name={on ? 'check' : 'x'} size={11} />
      {label}
    </span>
  )
}

export function ModelCardsPanel({ api, t }: ModelCardsPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [cards, setCards] = useState<readonly ModelCardView[] | undefined>(undefined)
  const [drift, setDrift] = useState<readonly string[]>([])

  const load = async () => {
    setLoading(true); setError(undefined)
    try {
      const result = await api.modelsCatalog()
      setCards(result.cards)
      setDrift(result.consistencyIssues)
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <div className="iv-model-cards" data-model-cards="true">
      <div className="iv-fusion-head">
        <span className="iv-chip"><Icon name="sparkles" size={11} />{t('modelCardsTitle')}</span>
        <button
          type="button"
          className="iv-btn iv-btn--ghost iv-btn--sm"
          data-model-cards-reload="true"
          disabled={loading}
          onClick={() => { void load() }}
        >
          {loading ? t('modelCardsLoadFailed') : '↻'}
        </button>
      </div>
      <span className="iv-meta">{t('modelCardsHint')}</span>
      {error !== undefined
        ? <span className="iv-meta iv-meta--warn" data-model-cards-error="true">{t('modelCardsLoadFailed')}：{error}</span>
        : null}
      {drift.length > 0
        ? <span className="iv-meta iv-meta--warn" data-model-cards-drift="true">{t('modelCardsDrift')}：{drift.join('；')}</span>
        : null}
      {cards === undefined
        ? <span className="iv-meta">{t('modelCardsEmpty')}</span>
        : (
          <div className="iv-card-grid" data-model-cards-grid="true">
            {cards.map(card => (
              <div key={card.id} className="iv-model-card" data-model-card={card.id}>
                <div className="iv-model-card-head">
                  <span className="iv-model-card-name">{card.name}</span>
                  <span className={`iv-chip iv-chip--${card.verified ? 'ok' : 'warn'}`}>
                    {card.verified ? t('modelCardVerified') : t('modelCardUnverified')}
                  </span>
                </div>
                <div className="iv-model-card-kinds">
                  {card.kinds.includes('image') ? <span className="iv-chip">{t('modelCardKindsImage')}</span> : null}
                  {card.kinds.includes('video') ? <span className="iv-chip">{t('modelCardKindsVideo')}</span> : null}
                  <span className="iv-chip">{t(COST_KEY[card.costTier])}</span>
                </div>
                <div className="iv-model-card-row">
                  <span className="iv-meta">{t('modelCardDuration')}：</span>
                  <span>
                    {card.duration === undefined
                      ? '—'
                      : `${card.duration.minSec}–${card.duration.maxSec}s${card.duration.customizable ? `（${t('modelCardDurationCustom')}）` : `（${t('modelCardDurationFixed')}）`}`}
                  </span>
                </div>
                <div className="iv-model-card-row">
                  <span className="iv-meta">{t('modelCardRatios')}：</span>
                  <span>{card.aspectRatios.join('、') || '—'}</span>
                </div>
                <div className="iv-model-card-features">
                  <FeatureRow on={card.features.imageToVideo} label={t('modelCardImageToVideo')} t={t} />
                  <FeatureRow on={card.features.firstLastFrame.supported} label={t('modelCardFirstLastFrame')} t={t} />
                  <FeatureRow on={card.features.multiFrame.supported} label={t('modelCardMultiFrame')} t={t} />
                  <FeatureRow on={card.features.referenceVideo.supported} label={t('modelCardReferenceVideo')} t={t} />
                  <FeatureRow on={card.features.audio.supported} label={t('modelCardAudio')} t={t} />
                </div>
                {card.promptTips.length > 0
                  ? (
                    <div className="iv-model-card-tips">
                      <span className="iv-meta">{t('modelCardTips')}：</span>
                      <ul>
                        {card.promptTips.map((tip, index) => <li key={index}>{tip}</li>)}
                      </ul>
                    </div>
                  )
                  : null}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
