/**
 * 配音卡片：把时间轴字幕轨变成**配音计划**，并直接合成为 outputs/ 下的音频。
 *
 * 三层信息，逐层加深，任何一层都不会假装成功：
 * 1. 计划（句数 / 字数 / 估算时长 / 逐句提醒）——零花费、只读；
 * 2. 合成（按行顺序调用语音服务，长句自动改走异步端点）——每句产出可试听的音频；
 * 3. 失败（凭证缺失、网关拒绝、超时）——显示可操作原因，已合成的行照样保留。
 *
 * @module dsh-image-video/client/VoiceCard
 */
import { useEffect, useState } from 'react'
import type { DubLineView, DubPlanView, SpeechAudioView, VoiceStatus, WorkbenchApi } from './api.ts'
import { Icon } from './icons.tsx'
import type { WorkbenchLocaleKey } from './locales.ts'

/** 卡片 props。 */
export interface VoiceCardProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  /** 当前时间轴 id；没有时间轴时只显示状态与提示。 */
  readonly timelineId?: string
  /** 合成结果/失败的提示出口；不传时卡片内就地显示错误与产物路径。 */
  readonly onNotice?: (text: string, tone: 'info' | 'error') => void
}

/** 一行合成结果。 */
interface SynthLine {
  readonly clipId: string
  readonly text: string
  readonly audio: SpeechAudioView
}

/** 计划里最多直接列出多少句（其余折叠成计数，避免顶掉时间轴）。 */
const MAX_PREVIEW_LINES = 6
/** 异步任务轮询间隔（与宿主默认一致）。 */
const ASYNC_POLL_MS = 2_000
/** 异步任务轮询整体超时。 */
const ASYNC_TIMEOUT_MS = 5 * 60 * 1000

/**
 * outputs 下的绝对路径 → 同源只读地址（`/outputs/<文件名>`，见 media-route.ts）。
 * @param path - 宿主返回的本地绝对路径。
 * @returns 浏览器可直接播放的地址。
 */
function audioSrc(path: string): string {
  const name = path.split(/[\\/]/u).pop() ?? path
  return `/outputs/${encodeURIComponent(name)}`
}

/**
 * 配音卡片。
 * @param props - 见 {@link VoiceCardProps}。
 * @returns 状态行 + 配音计划 + 合成结果。
 */
export function VoiceCard(props: VoiceCardProps) {
  const { api, t, timelineId, onNotice } = props
  const [status, setStatus] = useState<VoiceStatus | undefined>(undefined)
  const [plan, setPlan] = useState<DubPlanView | undefined>(undefined)
  const [voiceId, setVoiceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [synthing, setSynthing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [lines, setLines] = useState<readonly SynthLine[]>([])
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
      setError('当前宿主还不支持配音计划（voice/plan 未注册）：请升级宿主版本')
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

  /** 合成一句：超过异步阈值（且宿主支持）时提交任务并轮询到结束。 */
  async function synthesizeLine(line: DubLineView): Promise<SpeechAudioView> {
    const input = { text: line.text, ...voiceId.trim() === '' ? {} : { voiceId: voiceId.trim() } }
    const threshold = status?.asyncThresholdChars ?? 0
    const wantsAsync = threshold > 0 && [...line.text].length > threshold && typeof api.voiceSubmitAsync === 'function'
    if (!wantsAsync) {
      return (await api.voiceSynthesize(input)).audio
    }
    let task = (await api.voiceSubmitAsync(input)).task
    const deadline = Date.now() + ASYNC_TIMEOUT_MS
    while (task.status === 'submitted' || task.status === 'running') {
      if (Date.now() > deadline) {
        throw new Error(`长句异步合成超时（task ${task.taskId}）：稍后用同一 task_id 查询，不要重新提交`)
      }
      await new Promise<void>(resolve => { setTimeout(resolve, ASYNC_POLL_MS) })
      task = (await api.voiceAsyncStatus({ taskId: task.taskId, text: line.text })).task
    }
    if (task.status !== 'succeeded' || task.audio === undefined) {
      throw new Error(task.error ?? `语音任务状态：${task.status}`)
    }
    return task.audio
  }

  async function synthesizePlan(): Promise<void> {
    const planned = plan?.lines ?? []
    if (planned.length === 0) return
    setSynthing(true)
    setError(undefined)
    setLines([])
    const done: SynthLine[] = []
    try {
      setProgress({ done: 0, total: planned.length })
      for (const [index, line] of planned.entries()) {
        setProgress({ done: index, total: planned.length })
        const audio = await synthesizeLine(line)
        done.push({ clipId: line.clipId, text: line.text, audio })
        setLines([...done])
      }
      setProgress({ done: planned.length, total: planned.length })
      // 全部成功后才提示一次：逐句弹提示会盖住时间轴，且卡片里已有可试听列表
      if (done.length > 0) {
        onNotice?.(`${t('voiceCardSynthesized')} · ${done.length}/${planned.length} · ${done[done.length - 1]?.audio.audioPath ?? ''}`, 'info')
      }
    } catch (cause) {
      // 已合成的行保留：不要因为第 N 句失败就丢掉前面 N-1 条的成果
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
      onNotice?.(message, 'error')
    } finally {
      setSynthing(false)
    }
  }

  const available = status?.available === true
  const voices = status?.voices ?? []

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
          <label className="iv-sb-field">
            <span className="iv-meta">{t('voiceVoice')}</span>
            <select
              className="iv-select iv-select--sm"
              data-voice-select="true"
              value={voiceId}
              onChange={event => { setVoiceId(event.target.value) }}
            >
              <option value="">{t('voiceDefaultVoice')}</option>
              {voices.map(voice => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}{voice.kind === 'clone' ? ` · ${t('voiceCloneTag')}` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="iv-btn iv-btn--ghost iv-btn--sm"
            data-voice-plan="true"
            disabled={timelineId === undefined || timelineId === '' || busy || synthing}
            onClick={() => { void buildPlan() }}
          >
            {busy ? t('voicePlanning') : t('voicePlan')}
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--acc iv-btn--sm"
            data-voice-generate="true"
            disabled={!available || plan === undefined || plan.lines.length === 0 || synthing}
            title={available ? undefined : (status?.reason ?? t('voiceNotReady'))}
            onClick={() => { void synthesizePlan() }}
          >
            {synthing ? t('voiceSynthesizing') : t('voiceGenerate')}
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

        {synthing
          ? (
            <span className="iv-chip" data-voice-progress={String(progress.done)}>
              {t('voiceSynthesizePartial').replace('{done}', String(progress.done)).replace('{total}', String(progress.total))}
            </span>
          )
          : null}

        {lines.length === 0
          ? null
          : (
            <div data-voice-audio-list="true" style={{ display: 'grid', gap: 'var(--iv-sp-3)' }}>
              <span className="iv-chip iv-chip--ok">
                {t('voiceSynthesizePartial').replace('{done}', String(lines.length)).replace('{total}', String(plan?.lines.length ?? lines.length))}
              </span>
              {lines.map(entry => (
                <div key={entry.clipId} data-voice-audio={entry.clipId} style={{ display: 'grid', gap: '2px' }}>
                  <span className="iv-meta">{entry.text} · {entry.audio.model} · {entry.audio.voiceId}</span>
                  {/*
                    浏览器直接播放宿主落盘的音频：/outputs 只读路由（仅回环）暴露文件名，
                    这样「合成成功」不是一句文字，而是当场能听见。
                  */}
                  <audio controls preload="metadata" src={audioSrc(entry.audio.audioPath)} style={{ width: '100%' }} />
                  <span className="iv-meta" style={{ fontSize: '11px', opacity: 0.75 }}>
                    {entry.audio.audioPath} · {(entry.audio.durationMs / 1000).toFixed(2)}s
                    {entry.audio.durationEstimated ? '（估算）' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
