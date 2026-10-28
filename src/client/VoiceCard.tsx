/**
 * 配音卡片（`P0-1` 应用层）：把时间轴字幕轨变成**配音计划**，并提前把"生成配音"的位置占好。
 *
 * 这一版刻意只做应用层：
 * - 计划（句数 / 字数 / 估算时长 / 逐句提醒）**现在就能用，且零花费**；
 * - 「生成配音」在 TTS 接口联调通过前**禁用**并显示原因，绝不假装可用；
 * - 接口上线后这里一行都不用改：`status.available` 变 true 即可点（api 已就绪）。
 */
import { useEffect, useState } from 'react'
import type { DubPlanView, VoiceStatus, WorkbenchApi } from './api.ts'
import { Icon } from './icons.tsx'
import type { WorkbenchLocaleKey } from './locales.ts'

/** 卡片 props。 */
export interface VoiceCardProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  /** 当前时间轴 id；没有时间轴时只显示状态与提示。 */
  readonly timelineId?: string
}

/** 计划里最多直接列出多少句（其余折叠成计数，避免顶掉时间轴）。 */
const MAX_PREVIEW_LINES = 6

/**
 * 配音卡片。
 * @param props - 见 {@link VoiceCardProps}。
 * @returns 状态行 + 「生成配音计划」按钮 + 计划摘要。
 */
export function VoiceCard(props: VoiceCardProps) {
  const { api, t, timelineId } = props
  const [status, setStatus] = useState<VoiceStatus | undefined>(undefined)
  const [plan, setPlan] = useState<DubPlanView | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    // 旧宿主/测试替身可能没有这个端点：拿不到状态就不显示，绝不让整个时间轴面板崩
    if (typeof api.voiceStatus !== 'function') return
    let cancelled = false
    void api.voiceStatus()
      .then(value => { if (!cancelled) setStatus(value) })
      .catch(() => { /* 状态拉不到不影响计划按钮 */ })
    return () => { cancelled = true }
  }, [api])

  async function buildPlan(): Promise<void> {
    if (timelineId === undefined || timelineId === '') return
    if (typeof api.voicePlan !== 'function') {
      setError('当前宿主还不支持配音计划（voice/plan 未注册）：请升级到带 P0-1 的宿主')
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      const value = await api.voicePlan(timelineId)
      setPlan(value.plan)
      setStatus(value.voice)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const available = status?.available === true

  return (
    <div className="iv-card" data-voice-card="true">
      <div className="iv-card-head">
        <Icon name="music" size={13} />
        <strong>{t('voiceTitle')}</strong>
        <span className={`iv-chip${available ? ' iv-chip--ok' : ' iv-chip--err'}`} data-voice-status={available ? 'ready' : 'unavailable'}>
          {available ? (status?.provider ?? 'tts') : t('voiceNotReady')}
        </span>
      </div>
      <div className="iv-card-body" style={{ display: 'grid', gap: 'var(--iv-sp-4)' }}>
        <span className="iv-meta">{t('voiceHint')}</span>
        {available ? null : <span className="iv-meta" data-voice-reason={status?.reason ?? ''}>{status?.reason ?? ''}</span>}
        <div style={{ display: 'flex', gap: 'var(--iv-sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="iv-btn iv-btn--ghost iv-btn--sm"
            data-voice-plan="true"
            disabled={timelineId === undefined || timelineId === '' || busy}
            onClick={() => { void buildPlan() }}
          >
            {busy ? t('voicePlanning') : t('voicePlan')}
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--primary iv-btn--sm"
            data-voice-generate="true"
            disabled={!available || plan === undefined}
            title={available ? undefined : (status?.reason ?? t('voiceNotReady'))}
          >
            {t('voiceGenerate')}
          </button>
        </div>

        {error === undefined ? null : <p className="iv-err" data-voice-error="true">{error}</p>}

        {plan === undefined
          ? null
          : (
            <div data-voice-plan-result="true" style={{ display: 'grid', gap: 'var(--iv-sp-2)' }}>
              <span className="iv-chip">
                {plan.lines.length} {t('voiceLines')} · {plan.totalChars} {t('voiceChars')} · {t('voiceEstimate')} {(plan.estimatedMs / 1000).toFixed(1)}s
              </span>
              {plan.warnings.map(warning => <span className="iv-meta" key={warning}>· {warning}</span>)}
              <ul className="iv-meta" style={{ margin: 0, paddingLeft: '18px' }}>
                {plan.lines.slice(0, MAX_PREVIEW_LINES).map(line => (
                  <li key={line.clipId}>
                    {line.text}（{line.chars} {t('voiceChars')} · {(line.estimatedMs / 1000).toFixed(1)}s）
                    {line.warning === undefined ? null : <span style={{ opacity: 0.75 }}> — {line.warning}</span>}
                  </li>
                ))}
              </ul>
              {plan.lines.length > MAX_PREVIEW_LINES
                ? <span className="iv-meta">…（还有 {plan.lines.length - MAX_PREVIEW_LINES} 句未展开）</span>
                : null}
            </div>
          )}
      </div>
    </div>
  )
}
