/**
 * `B-6` 模型能力卡面板：把 `models/catalog` 下发的卡片渲染成"选型参考"。
 *
 * 只展示、不强制——卡片字段不参与生成逻辑（生成仍由宿主/表单决定）。
 * `consistencyIssues` 非空说明卡片与运行时能力漂移，照实提示，不粉饰。
 *
 * `R6-3b`：加载 / 空 / 错误 / 刷新中四种非内容态统一交给 `PanelState`；
 * 出错时**保留已有卡片**（只在顶部挂告警），不再把内容整块顶掉。
 */
import { useEffect, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { ModelCardView, ModelLiveStatusView, ModelRegistryProbeView, TextModelOption, VoiceStatus, WorkbenchApi } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'
import { PanelState } from './PanelState.tsx'

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
  const [live, setLive] = useState<{ probe: ModelRegistryProbeView; targets: Readonly<Record<string, ModelLiveStatusView>> } | undefined>(undefined)
  const [textModels, setTextModels] = useState<readonly TextModelOption[] | undefined>(undefined)
  const [textFailures, setTextFailures] = useState<readonly string[]>([])
  // 语音模型（合成 / 克隆）也在这里展示：此前只有图/视频卡片与文本模型，语音能力像是"没有"
  const [voice, setVoice] = useState<VoiceStatus | undefined>(undefined)
  const [voiceFailure, setVoiceFailure] = useState<string | undefined>(undefined)

  // `refresh` = 用户点了刷新：要求宿主**现场重探**服务商模型目录，而不是再读一遍静态清单
  const load = async (refresh = false) => {
    setLoading(true); setError(undefined)
    await Promise.all([
      api.modelsCatalog(refresh ? { refresh: true } : undefined)
        .then(result => {
          setCards(result.cards)
          setDrift(result.consistencyIssues)
          setLive(result.live)
        })
        .catch(thrown => { setError(thrown instanceof Error ? thrown.message : String(thrown)) }),
      // 文本模型目录与生成能力卡一起展示：某一路失败不影响另一路
      api.listTextModels()
        .then(catalog => {
          setTextModels(catalog.models)
          setTextFailures(catalog.failures.map(failure => `${failure.provider}：${failure.message}`))
        })
        .catch(thrown => {
          setTextModels([])
          setTextFailures([thrown instanceof Error ? thrown.message : String(thrown)])
        }),
      // 语音模型与实际可用性一起取：旧宿主没有该端点时整条不渲染，不假装"没有语音模型"
      typeof api.voiceStatus !== 'function'
        ? Promise.resolve()
        : api.voiceStatus()
          .then(value => { setVoice(value); setVoiceFailure(undefined) })
          .catch(thrown => { setVoice(undefined); setVoiceFailure(thrown instanceof Error ? thrown.message : String(thrown)) }),
    ])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const retry = () => { void load(true) }
  const errorView = (
    <PanelState
      view={{
        kind: 'error',
        message: t('modelCardsLoadFailed'),
        detail: error,
        retryLabel: t('paneErrorRetry'),
        onRetry: retry,
      }}
    />
  )

  // 文本模型按服务商分组展示，服务商名与模型名全部来自宿主目录，客户端不内置部署事实
  const textGroups = new Map<string, TextModelOption[]>()
  for (const model of textModels ?? []) {
    const name = model.providerName === '' ? model.provider : model.providerName
    const group = textGroups.get(name) ?? []
    group.push(model)
    textGroups.set(name, group)
  }

  return (
    <div className="iv-sub" data-model-cards="true">
      <div className="iv-sub-head">
        <span className="iv-sub-title"><Icon name="sparkles" size={11} />{t('modelCardsTitle')}</span>
        <div className="iv-sub-actions">
          <button
            type="button"
            className="iv-btn iv-btn--ghost iv-btn--sm"
            data-model-cards-reload="true"
            disabled={loading}
            onClick={retry}
          >
            {/* 加载中显示省略号：此前这里误用了「加载失败」文案，看起来像刚失败过 */}
            {loading ? '…' : '↻'}
          </button>
        </div>
      </div>
      <span className="iv-meta">{t('modelCardsHint')}</span>
      {live === undefined
        ? null
        : (
          <span className="iv-meta" data-model-live-probe={live.probe.ok ? 'ok' : 'failed'}>
            {live.probe.ok ? `${t('modelLiveProbeOk')} · ${new Date(live.probe.attemptedAt).toLocaleTimeString()}` : `${t('modelLiveProbeFailed')}：${live.probe.reason ?? ''}`}
          </span>
        )}

      {/* 可用文本模型：与生成能力卡同屏，避免"只有图/视频模型"的错觉 */}
      <div className="iv-text-models" data-model-text-models="true">
        <span className="iv-micro">{t('modelCardsTextModels')}</span>
        {textModels === undefined
          ? <span className="iv-meta">{t('defaultsOptionsLoading')}</span>
          : textModels.length === 0
            ? <span className="iv-meta" data-model-text-models-empty="true">{t('modelCardsTextModelsEmpty')}</span>
            : (
              <div className="iv-text-model-groups">
                {Array.from(textGroups, ([providerName, models]) => (
                  <div className="iv-text-model-group" key={providerName} data-model-text-group={providerName}>
                    <span className="iv-meta">{providerName}</span>
                    <div className="iv-text-model-chips">
                      {models.map(model => (
                        <span
                          className="iv-chip iv-text-model-chip"
                          key={`${model.provider}::${model.id}`}
                          title={`${model.provider} · ${model.id}`}
                        >
                          {model.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
        {textFailures.length === 0
          ? null
          : <span className="iv-meta iv-meta--warn" data-model-text-failures="true">{t('modelCardsTextFailures')} {textFailures.join('；')}</span>}
      </div>

      {/* 可用语音模型：合成与克隆各标一回，可用性如实（未配置凭证时说明原因） */}
      {voice !== undefined
        ? (
          <div
            className="iv-text-models"
            data-model-voice-models="true"
            data-model-voice-ready={voice.available ? 'true' : 'false'}
          >
            <div className="iv-text-model-group">
              <span className="iv-micro">{t('modelCardsVoiceModels')}</span>
              <span
                className={`iv-chip iv-chip--${voice.available ? 'ok' : 'warn'}`}
                data-model-voice-availability={voice.available ? 'ready' : 'unavailable'}
                title={voice.reason}
              >
                {voice.available ? t('modelCardsVoiceReady') : t('voiceNotReady')}
              </span>
              <span className="iv-meta">
                {voice.provider} · {t('modelCardsVoiceCount').replace('{n}', String(voice.voices.length))}
              </span>
            </div>
            <div className="iv-text-model-chips">
              {voice.model === undefined || voice.model === ''
                ? null
                : (
                  <span className="iv-chip iv-text-model-chip" title={`${voice.provider} · ${voice.model}`} data-model-voice-synth={voice.model}>
                    {voice.model}
                    <span className="iv-meta"> · {t('modelCardsVoiceSynth')}</span>
                  </span>
                )}
              {voice.cloneModel === undefined || voice.cloneModel === ''
                ? null
                : (
                  <span className="iv-chip iv-text-model-chip" title={`${voice.provider} · ${voice.cloneModel}`} data-model-voice-clone={voice.cloneModel}>
                    {voice.cloneModel}
                    <span className="iv-meta"> · {t('modelCardsVoiceClone')}</span>
                  </span>
                )}
            </div>
            {voice.available || voice.reason === undefined
              ? null
              : <span className="iv-meta iv-meta--warn" data-model-voice-reason="true">{voice.reason}</span>}
          </div>
        )
        : voiceFailure === undefined
          ? null
          : (
            <div className="iv-text-models" data-model-voice-models="true">
              <span className="iv-micro">{t('modelCardsVoiceModels')}</span>
              <span className="iv-meta iv-meta--warn" data-model-voice-failure="true">{t('modelCardsVoiceFailed')}：{voiceFailure}</span>
            </div>
          )}

      {/* 刷新中：保留旧卡片，只在顶部给一条细进度 */}
      {loading && cards !== undefined ? <PanelState view={{ kind: 'refreshing' }} /> : null}

      {/* 出错但有旧数据：告警挂在顶部，卡片不消失 */}
      {error !== undefined && cards !== undefined ? errorView : null}

      {drift.length > 0
        ? <span className="iv-meta iv-meta--warn" data-model-cards-drift="true">{t('modelCardsDrift')}：{drift.join('；')}</span>
        : null}

      {/* 空数组与"还没加载"都要给空态：此前返回 [] 时会渲染一个空白网格，看着像坏了 */}
      {cards === undefined || cards.length === 0
        ? (loading
            ? <PanelState view={{ kind: 'loading' }} />
            : error !== undefined
              ? errorView
              : <PanelState view={{ kind: 'empty', icon: 'sparkles', title: t('modelCardsEmpty'), hint: t('modelCardsHint') }} />)
        : (
          <div className="iv-card-grid" data-model-cards-grid="true">
            {cards.map(card => (
              <div key={card.id} className="iv-model-card" data-model-card={card.id}>
                <div className="iv-model-card-head">
                  <span className="iv-model-card-name">{card.name}</span>
                  {(() => {
                    const status = live?.targets[card.id]
                    // 有实时结论就以实时为准（服务商会随时关模型）；没探测能力才退回静态自述
                    if (status === undefined) {
                      return (
                        <span className={`iv-chip iv-chip--${card.verified ? 'ok' : 'warn'}`}>
                          {card.verified ? t('modelCardVerified') : t('modelCardUnverified')}
                        </span>
                      )
                    }
                    const kind = status.status === 'available' ? 'ok' : 'warn'
                    const label = status.status === 'available'
                      ? t('modelLiveAvailable')
                      : status.status === 'missing' ? t('modelLiveMissing') : t('modelLiveUnknown')
                    return (
                      <span
                        className={`iv-chip iv-chip--${kind}`}
                        data-model-live={status.status}
                        title={status.detail}
                      >
                        {label}
                      </span>
                    )
                  })()}
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
