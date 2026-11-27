/**
 * 剧本生成页的「音色」分区：从剧本提取说话人，配成可复用的音色卡。
 *
 * 参考 ComfyUI 的 Zero-Shot Clone / CosyVoice 节点：一张音色卡 = 一个说话人 +
 * 可选参考音频 + 预设/复刻音色 + 语速/音调/情感。卡片填了就「合成试听」当前参数；
 * 没有音色但有样本时会**先复刻再试听**（复刻出的音色 id 写回卡片，后续复用之）。
 * 语音服务不可用时按钮禁用并展示原因，绝不假装合成成功。
 *
 * @module dsh-image-video/client/panels/VoicePanel
 */
import { useEffect, useState } from 'react'
import type { ResourceRecord } from '../../workbench/records.ts'
import { newWorkbenchId } from '../../workbench/records.ts'
import type { SkillRecord } from '../../workbench/skills.ts'
import type { VoiceStatus, TextModelOption, WorkbenchApi } from '../api.ts'
import { Icon } from '../icons.tsx'
import { useWorkbenchField } from '../workbench-store.ts'
import type { VoiceCard } from '../workbench-store.ts'
import { SkillTokenSelect, activeSkillId, stripSkillTokens } from '../skill-tokens.tsx'
import type { WorkbenchLocaleKey } from '../locales.ts'
import { SharedScriptInput } from './SharedScriptInput.tsx'

/** 语速 / 音调的编辑范围（与 ComfyUI GPT-SoVITS 常用区间一致）。 */
const SPEED_MIN = 0.5
const SPEED_MAX = 2
const PITCH_MIN = 0.7
const PITCH_MAX = 1.4

/** 常用情感标签（点选填入，也可手改）。 */
const EMOTIONS: readonly string[] = ['平静', '兴奋', '悲伤', '愤怒', '温柔', '紧张', '旁白']

/** 下拉值 `provider::model` → 请求入参；空值与未知值都当作没选。 */
function parseModelKey(key: string): { readonly provider: string, readonly model: string } | undefined {
  const separator = key.indexOf('::')
  if (separator <= 0) return undefined
  const provider = key.slice(0, separator)
  const model = key.slice(separator + 2)
  return provider === '' || model === '' ? undefined : { provider, model }
}

/** 音色名 → 网关 voice_id（只留安全字符；空串表示让宿主自动生成）。 */
function sanitizeVoiceId(name: string): string | undefined {
  const cleaned = name.trim().replace(/[^A-Za-z0-9_-]/gu, '')
  return cleaned === '' ? undefined : cleaned.slice(0, 64)
}

/** 浏览器文件 → base64（去掉 data URL 前缀），供宿主上传后克隆。 */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        resolve('')
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => { reject(reader.error ?? new Error('读取样本文件失败')) }
    reader.readAsDataURL(file)
  })
}

/** 一张音色卡入库时的备注：参数写成可读文本，宿主 resources 表可直接检索。 */
function voiceNote(card: VoiceCard, t: (key: WorkbenchLocaleKey) => string): string {
  const parts = [
    card.prompt.trim(),
    `${t('voiceCardVoice')}: ${card.voiceId === '' ? t('voiceCardDefaultVoice') : card.voiceId}`,
    `${t('voiceCardSpeed')}: ${card.speed.toFixed(2)}`,
    `${t('voiceCardPitch')}: ${card.pitch.toFixed(2)}`,
    ...card.emotion.trim() === '' ? [] : [`${t('voiceCardEmotion')}: ${card.emotion.trim()}`],
    ...card.refAudioPath === undefined || card.refAudioPath === ''
      ? [] : [`${t('voiceCardRefAudio')}: ${card.refAudioPath}`],
  ]
  return parts.filter(part => part !== '').join(' · ')
}

export interface VoicePanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly projectId?: string
  readonly episodeId?: string
  readonly script: string
  /** 回退用的分段文本模型。 */
  readonly model?: { readonly provider: string, readonly model: string }
  readonly textModels: readonly TextModelOption[]
  readonly skills: readonly SkillRecord[]
  readonly existing: readonly ResourceRecord[]
  readonly onCreated: () => void | Promise<void>
  readonly onNotice: (text: string, tone: 'info' | 'error') => void
}

/** 音色分区：共享输入 + 提取配置 + 音色卡列表。 */
export function VoicePanel(props: VoicePanelProps) {
  const { api, t, projectId, episodeId, script, model, textModels, skills, existing, onCreated, onNotice } = props
  const [cards, setCards] = useWorkbenchField(api, 'voiceCards')
  const [extractPrompt, setExtractPrompt] = useWorkbenchField(api, 'voiceExtractPrompt')
  const [extractModel, setExtractModel] = useWorkbenchField(api, 'voiceExtractModel')
  const [collapsed, setCollapsed] = useState<readonly string[]>([])
  const [items, setItems] = useState<readonly { readonly name: string, readonly note: string }[]>([])
  const [status, setStatus] = useState<VoiceStatus | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [synthesizing, setSynthesizing] = useState('')
  const [cloning, setCloning] = useState(false)
  const [cloneSample, setCloneSample] = useState<{ name: string; base64: string }>()
  const [cloneName, setCloneName] = useState('')
  const [error, setError] = useState<string>()
  const [importedFiles] = useWorkbenchField(api, 'pipelineImportedFiles')
  const [pipelineScript] = useWorkbenchField(api, 'pipelineScript')
  const available = status?.available === true

  useEffect(() => {
    if (typeof api.voiceStatus !== 'function') return
    let cancelled = false
    void api.voiceStatus()
      .then(value => { if (!cancelled) setStatus(value) })
      .catch(() => { /* 音色状态拉不到不影响配置与入库 */ })
    return () => { cancelled = true }
  }, [api])

  const importedText = importedFiles
    .filter(file => file.status === 'done' && file.text.trim() !== '')
    .map(file => file.text)
    .join('\n\n')
  const source = [...new Set([script, pipelineScript, importedText])]
    .filter(part => part.trim() !== '')
    .join('\n\n')
  const chosen = parseModelKey(extractModel) ?? model
  const ready = projectId !== undefined && source.trim() !== '' && chosen !== undefined

  const run = async (): Promise<void> => {
    if (!ready || chosen === undefined) return
    setBusy(true); setError(undefined)
    try {
      const instructions = stripSkillTokens(extractPrompt, skills)
      const skillId = activeSkillId(extractPrompt, skills)
      const result = await api.extractEntities({
        script: source,
        category: 'voice',
        provider: chosen.provider,
        model: chosen.model,
        ...instructions === '' ? {} : { instructions },
        ...skillId === '' ? {} : { skillId },
      })
      setItems(result.items)
      setCards(current => {
        const known = new Set(current.map(card => card.name))
        const created = result.items
          .filter(item => !known.has(item.name))
          .map(item => ({
            id: newWorkbenchId('voice-card'),
            name: item.name,
            prompt: item.note,
            voiceId: status?.defaultVoice ?? '',
            speed: 1,
            pitch: 1,
            emotion: '',
          }))
        return [...current, ...created]
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const patch = (id: string, change: Partial<VoiceCard>): void => {
    setCards(current => current.map(card => card.id === id ? { ...card, ...change } : card))
  }

  const addCard = (): void => {
    setCards(current => [...current, {
      id: newWorkbenchId('voice-card'),
      name: '',
      prompt: '',
      voiceId: status?.defaultVoice ?? '',
      speed: 1,
      pitch: 1,
      emotion: '',
    }])
  }

  const saveCard = async (card: VoiceCard): Promise<void> => {
    if (projectId === undefined || card.name.trim() === '') return
    setError(undefined)
    try {
      const note = voiceNote(card, t)
      const resource = card.resourceId === undefined
        ? await api.createResource({ projectId, kind: 'voice', name: card.name.trim(), note })
        : await api.updateResource({ id: card.resourceId, name: card.name.trim(), note })
      if (episodeId !== undefined) {
        await api.episodeResources(episodeId, 'add', { resourceId: resource.id })
      }
      patch(card.id, { resourceId: resource.id })
      onNotice(t('voiceCardSaved').replace('{name}', card.name), 'info')
      await onCreated()
    } catch (cause) {
      onNotice(cause instanceof Error ? cause.message : String(cause), 'error')
    }
  }

  /** 重新拉一次可用性（克隆出新音色后，下拉框要能立刻选到它）。 */
  const refreshStatus = async (): Promise<void> => {
    if (typeof api.voiceStatus !== 'function') return
    try {
      setStatus(await api.voiceStatus())
    } catch { /* 拉不到不影响已完成的合成 */ }
  }

  /** 选一份样本文件（浏览器读成 base64，宿主负责上传）。 */
  const pickSample = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    setError(undefined)
    try {
      const base64 = await readFileAsBase64(file)
      if (base64 === '') throw new Error(t('voiceClonePickFile'))
      setCloneSample({ name: file.name, base64 })
    } catch (cause) {
      onNotice(cause instanceof Error ? cause.message : String(cause), 'error')
    }
  }

  /** 独立复刻：用面板里选的样本文件建一个音色，成功后刷新下拉框。 */
  const cloneVoice = async (): Promise<void> => {
    if (cloneSample === undefined || typeof api.voiceClone !== 'function') return
    setCloning(true); setError(undefined)
    try {
      const result = await api.voiceClone({
        audioBase64: cloneSample.base64,
        filename: cloneSample.name,
        ...sanitizeVoiceId(cloneName) === undefined ? {} : { voiceId: sanitizeVoiceId(cloneName) },
        ...cloneName.trim() === '' ? {} : { name: cloneName.trim() },
      })
      onNotice(t('voiceCloneDone').replace('{id}', result.clone.voiceId), 'info')
      setCloneName('')
      setCloneSample(undefined)
      await refreshStatus()
      await onCreated()
    } catch (cause) {
      onNotice(cause instanceof Error ? cause.message : String(cause), 'error')
    } finally {
      setCloning(false)
    }
  }

  /**
   * 这张卡现在该用哪个音色：卡上已选则直接用；否则用参考音频（宿主路径或面板选的
   * 文件）**先复刻**，把得到的 id 写回卡片再合成——一次点击完成「零样本克隆 + 试听」。
   */
  const ensureVoiceId = async (card: VoiceCard): Promise<string | undefined> => {
    if (card.voiceId.trim() !== '') return card.voiceId.trim()
    if (typeof api.voiceClone !== 'function') return undefined
    const refPath = (card.refAudioPath ?? '').trim()
    if (refPath === '' && cloneSample === undefined) return undefined
    const cloneNameValue = card.name.trim() === '' ? undefined : card.name.trim()
    const result = await api.voiceClone({
      ...refPath !== '' ? { audioPath: refPath } : {},
      ...refPath === '' && cloneSample !== undefined
        ? { audioBase64: cloneSample.base64, filename: cloneSample.name }
        : {},
      ...sanitizeVoiceId(card.name) === undefined ? {} : { voiceId: sanitizeVoiceId(card.name) },
      ...cloneNameValue === undefined ? {} : { name: cloneNameValue },
      ...card.prompt.trim() === '' ? {} : { text: card.prompt.trim() },
    })
    patch(card.id, { voiceId: result.clone.voiceId })
    onNotice(t('voiceCloneDone').replace('{id}', result.clone.voiceId), 'info')
    await refreshStatus()
    return result.clone.voiceId
  }

  const synthesize = async (card: VoiceCard): Promise<void> => {
    if (!available || typeof api.voiceSynthesize !== 'function') return
    setSynthesizing(card.id); setError(undefined)
    try {
      const voiceId = await ensureVoiceId(card)
      const result = await api.voiceSynthesize({
        text: card.prompt.trim() === '' ? card.name : card.prompt.trim(),
        ...voiceId === undefined || voiceId === '' ? {} : { voiceId },
        speed: card.speed,
        pitch: card.pitch,
        ...card.emotion.trim() === '' ? {} : { instruction: card.emotion.trim() },
      })
      onNotice(`${t('voiceCardSynthesized')} · ${result.audio.audioPath}`, 'info')
    } catch (cause) {
      onNotice(cause instanceof Error ? cause.message : String(cause), 'error')
    } finally {
      setSynthesizing('')
    }
  }

  const toggle = (id: string): void => {
    setCollapsed(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  }

  return (
    <div className="iv-sub" data-voice-panel="true">
      <div className="iv-sub-head">
        <span className="iv-sub-title">{t('voicePanelTitle')}</span>
        <span className="iv-meta">{t('voicePanelDesc')}</span>
      </div>
      <div className="iv-plan-row">
        <span className="iv-meta" data-voice-source="true">
          {source.trim() === '' ? t('extractNeedsScript')
            : importedText === '' ? t('extractSource') : t('extractSourceWithFiles')}
        </span>
        <span className={`iv-chip${available ? ' iv-chip--ok' : ' iv-chip--err'}`} data-voice-status={available ? 'ready' : 'unavailable'}>
          {available ? (status?.provider ?? 'tts') : t('voiceNotReady')}
        </span>
      </div>
      {available ? null : (
        <div className="iv-meta" data-voice-reason="true">{status?.reason ?? t('voiceNotReady')}</div>
      )}

      <div className="iv-sub" data-script-shared="true">
        <div className="iv-plan-row">
          <span className="iv-sub-title">{t('scriptSharedInputTitle')}</span>
          <span className="iv-meta">{t('scriptSharedInputDesc')}</span>
        </div>
        <SharedScriptInput api={api} t={t} />
      </div>

      <div className="iv-sub" data-voice-extract-config="true">
        <div className="iv-plan-row">
          <label className="iv-sb-field">
            <span className="iv-meta">{t('extractModelLabel')}</span>
            <select
              className="iv-select iv-select--sm"
              data-voice-extract-model="true"
              value={extractModel}
              onChange={event => { setExtractModel(event.target.value) }}
            >
              <option value="">{t('generateParamAuto')}</option>
              {textModels.map(item => (
                <option key={`${item.provider}::${item.id}`} value={`${item.provider}::${item.id}`}>
                  {item.providerName} · {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="iv-sb-field">
            <span className="iv-meta">{t('skillInsert')}</span>
            <SkillTokenSelect
              skills={skills}
              text={extractPrompt}
              t={t}
              label={t('skillInsert')}
              onTextChange={setExtractPrompt}
              selectAttrs={{ 'data-voice-extract-skill': 'true' }}
            />
          </label>
        </div>
        <label className="iv-sb-field">
          <span className="iv-meta">{t('voiceExtractPromptLabel')}</span>
          <textarea
            className="iv-input"
            rows={2}
            data-voice-extract-prompt="true"
            placeholder={t('voiceExtractPromptPlaceholder')}
            value={extractPrompt}
            onChange={event => { setExtractPrompt(event.target.value) }}
          />
        </label>
        <div className="iv-plan-row">
          <button
            type="button"
            className="iv-btn iv-btn--acc iv-btn--sm"
            data-voice-extract-run="true"
            disabled={!ready || busy}
            onClick={() => { void run() }}
          >
            <Icon name={busy ? 'sparkles' : 'script'} size={12} />
            {busy ? t('extractRunning') : t('voiceExtractRun')}
          </button>
        </div>
      </div>

      {chosen === undefined ? <div className="iv-meta">{t('extractNeedsModel')}</div> : null}
      {projectId === undefined ? <div className="iv-meta">{t('extractNeedsProject')}</div> : null}
      {error === undefined ? null : <div className="iv-notice iv-notice--err" role="alert">{error}</div>}

      {items.length === 0 ? null : (
        <div className="iv-sub" data-voice-candidates="true">
          <span className="iv-sub-title">{t('extractCandidates')}</span>
          {items.map(item => (
            <div className="iv-plan-row" key={item.name} data-voice-candidate={item.name}>
              <span className="iv-meta"><strong>{item.name}</strong>{item.note === '' ? '' : ` · ${item.note}`}</span>
            </div>
          ))}
        </div>
      )}

      <div className="iv-sub" data-voice-clone="true">
        <div className="iv-plan-row">
          <span className="iv-sub-title">{t('voiceCloneTitle')}</span>
          <span className="iv-meta">{t('voiceCardsDesc')}</span>
        </div>
        <div className="iv-plan-row">
          <label className="iv-sb-field">
            <span className="iv-meta">{t('voiceCloneSampleLabel')}</span>
            <input
              className="iv-input"
              type="file"
              accept="audio/*"
              data-voice-clone-file="true"
              onChange={event => { void pickSample(event.target.files?.[0]) }}
            />
          </label>
          <label className="iv-sb-field">
            <span className="iv-meta">{t('voiceCloneNameLabel')}</span>
            <input
              className="iv-input"
              data-voice-clone-name="true"
              placeholder={t('voiceCloneNamePlaceholder')}
              value={cloneName}
              onChange={event => { setCloneName(event.target.value) }}
            />
          </label>
        </div>
        {cloneSample === undefined
          ? <span className="iv-meta">{t('voiceCloneSamplePlaceholder')}</span>
          : <span className="iv-meta" data-voice-clone-picked="true">{t('voiceCloneFilePicked').replace('{name}', cloneSample.name)}</span>}
        <div className="iv-plan-row">
          <button
            type="button"
            className="iv-btn iv-btn--sm"
            data-voice-clone-run="true"
            disabled={!available || cloning || cloneSample === undefined || typeof api.voiceClone !== 'function'}
            title={available ? undefined : (status?.reason ?? t('voiceNotReady'))}
            onClick={() => { void cloneVoice() }}
          >
            <Icon name="music" size={12} />
            {cloning ? t('voiceCloning') : t('voiceCloneRun')}
          </button>
        </div>
      </div>

      <div className="iv-sub" data-voice-cards="true">
        <div className="iv-plan-row">
          <span className="iv-sub-title">{t('voiceCardsTitle')}</span>
          <span className="iv-meta">{t('voiceCardsDesc')}</span>
          <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" data-voice-card-add="true" onClick={addCard}>
            <Icon name="plus" size={12} />{t('voiceCardAdd')}
          </button>
        </div>
        {cards.length === 0 ? <div className="iv-empty">{t('voiceCardsEmpty')}</div> : null}
        {cards.map(card => {
          const isCollapsed = collapsed.includes(card.id)
          const inLibrary = existing.some(resource => resource.id === card.resourceId)
          return (
            <div className="iv-card" key={card.id} data-voice-card-item={card.id}>
              <button type="button" className="iv-card-head iv-card-head--button" data-voice-card-toggle={card.id} onClick={() => { toggle(card.id) }}>
                <Icon name="music" size={13} />
                <strong>{card.name.trim() === '' ? t('voiceCardUntitled') : card.name}</strong>
                {inLibrary ? <span className="iv-chip iv-chip--ok">{t('extractExisting')}</span> : null}
                <span className="iv-module-toggle" aria-hidden="true"><Icon name="chevron" size={11} />{isCollapsed ? t('moduleExpand') : t('moduleCollapse')}</span>
              </button>
              {isCollapsed ? null : (
                <div className="iv-card-body" style={{ display: 'grid', gap: 'var(--iv-sp-3)' }}>
                  <label className="iv-sb-field">
                    <span className="iv-meta">{t('voiceCardName')}</span>
                    <input className="iv-input" data-voice-card-name={card.id} value={card.name}
                      onChange={event => { patch(card.id, { name: event.target.value }) }} />
                  </label>
                  <label className="iv-sb-field">
                    <span className="iv-meta">{t('voiceCardPrompt')}</span>
                    <textarea className="iv-input" rows={3} data-voice-card-prompt={card.id} value={card.prompt}
                      placeholder={t('voiceCardPromptPlaceholder')}
                      onChange={event => { patch(card.id, { prompt: event.target.value }) }} />
                  </label>
                  <div className="iv-plan-row">
                    <label className="iv-sb-field">
                      <span className="iv-meta">{t('voiceCardVoice')}</span>
                      <select className="iv-select iv-select--sm" data-voice-card-voice={card.id} value={card.voiceId}
                        onChange={event => { patch(card.id, { voiceId: event.target.value }) }}>
                        <option value="">{t('voiceCardDefaultVoice')}</option>
                        {(status?.voices ?? []).map(voice => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name}{voice.kind === 'clone' ? ` · ${t('voiceCloneTag')}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="iv-sb-field">
                      <span className="iv-meta">{t('voiceCardSpeed')}</span>
                      <input type="number" className="iv-input" data-voice-card-speed={card.id}
                        min={SPEED_MIN} max={SPEED_MAX} step="0.05" value={card.speed}
                        onChange={event => { patch(card.id, { speed: Number(event.target.value) }) }} />
                    </label>
                    <label className="iv-sb-field">
                      <span className="iv-meta">{t('voiceCardPitch')}</span>
                      <input type="number" className="iv-input" data-voice-card-pitch={card.id}
                        min={PITCH_MIN} max={PITCH_MAX} step="0.05" value={card.pitch}
                        onChange={event => { patch(card.id, { pitch: Number(event.target.value) }) }} />
                    </label>
                  </div>
                  <label className="iv-sb-field">
                    <span className="iv-meta">{t('voiceCardEmotion')}</span>
                    <input className="iv-input" data-voice-card-emotion={card.id} value={card.emotion}
                      placeholder={t('voiceCardEmotionPlaceholder')}
                      onChange={event => { patch(card.id, { emotion: event.target.value }) }} />
                  </label>
                  <div className="iv-plan-row" data-voice-card-emotions={card.id}>
                    {EMOTIONS.map(label => (
                      <button key={label} type="button" className="iv-btn iv-btn--ghost iv-btn--sm"
                        onClick={() => { patch(card.id, { emotion: label }) }}>{label}</button>
                    ))}
                  </div>
                  <label className="iv-sb-field">
                    <span className="iv-meta">{t('voiceCardRefAudio')}</span>
                    <input className="iv-input" data-voice-card-ref-audio={card.id}
                      placeholder={t('voiceCardRefAudioPlaceholder')}
                      value={card.refAudioPath ?? ''}
                      onChange={event => { patch(card.id, { refAudioPath: event.target.value }) }} />
                  </label>
                  <div className="iv-plan-row">
                    <button type="button" className="iv-btn iv-btn--sm" data-voice-card-save={card.id}
                      disabled={projectId === undefined || card.name.trim() === ''}
                      onClick={() => { void saveCard(card) }}>
                      <Icon name="layers" size={12} />{t('voiceCardSave')}
                    </button>
                    <button type="button" className="iv-btn iv-btn--primary iv-btn--sm" data-voice-card-synthesize={card.id}
                      disabled={!available || synthesizing === card.id}
                      title={available ? undefined : (status?.reason ?? t('voiceNotReady'))}
                      onClick={() => { void synthesize(card) }}>
                      <Icon name="sparkles" size={12} />
                      {synthesizing === card.id ? t('voiceCardSynthesizing') : t('voiceCardSynthesize')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
