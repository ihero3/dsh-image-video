/**
 * 剧本生成页的「轨迹」分区：从剧本提取运镜需求，配成可复用的轨迹卡。
 *
 * 参考 ComfyUI 的 OmniCam / Camera H3 节点：预设一键生成关键帧（推/拉/摇/移/
 * 环绕/固定），也支持逐帧改时间、位置与缩放；实时编译成可读的运镜约束提示词，
 * 存为 `motion-track` 资源（宿主已有关键帧校验与序列化）。
 *
 * @module dsh-image-video/client/panels/MotionPanel
 */
import { useState } from 'react'
import type { MotionKeyframe, ResourceRecord } from '../../workbench/records.ts'
import { describeMotionTrack, newWorkbenchId, normalizeKeyframes } from '../../workbench/records.ts'
import type { SkillRecord } from '../../workbench/skills.ts'
import type { TextModelOption, WorkbenchApi } from '../api.ts'
import { Icon } from '../icons.tsx'
import { useWorkbenchField } from '../workbench-store.ts'
import type { MotionCard, MotionPreset } from '../workbench-store.ts'
import { SkillTokenSelect, activeSkillId, stripSkillTokens } from '../skill-tokens.tsx'
import type { WorkbenchLocaleKey } from '../locales.ts'
import { SharedScriptInput } from './SharedScriptInput.tsx'

/** 预设 → 一键生成的关键帧（x/y 归一化，tMs 毫秒）。 */
const PRESETS: ReadonlyArray<{ readonly key: MotionPreset, readonly label: WorkbenchLocaleKey, readonly frames: readonly MotionKeyframe[] }> = [
  { key: 'push', label: 'motionPresetPush', frames: [
    { tMs: 0, x: 0.5, y: 0.5, scale: 1 }, { tMs: 3000, x: 0.5, y: 0.5, scale: 1.35 },
  ] },
  { key: 'pull', label: 'motionPresetPull', frames: [
    { tMs: 0, x: 0.5, y: 0.5, scale: 1.35 }, { tMs: 3000, x: 0.5, y: 0.5, scale: 1 },
  ] },
  { key: 'panLeft', label: 'motionPresetPanLeft', frames: [
    { tMs: 0, x: 0.75, y: 0.5 }, { tMs: 3000, x: 0.25, y: 0.5 },
  ] },
  { key: 'panRight', label: 'motionPresetPanRight', frames: [
    { tMs: 0, x: 0.25, y: 0.5 }, { tMs: 3000, x: 0.75, y: 0.5 },
  ] },
  { key: 'tiltUp', label: 'motionPresetTiltUp', frames: [
    { tMs: 0, x: 0.5, y: 0.75 }, { tMs: 3000, x: 0.5, y: 0.25 },
  ] },
  { key: 'tiltDown', label: 'motionPresetTiltDown', frames: [
    { tMs: 0, x: 0.5, y: 0.25 }, { tMs: 3000, x: 0.5, y: 0.75 },
  ] },
  { key: 'orbit', label: 'motionPresetOrbit', frames: [
    { tMs: 0, x: 0.25, y: 0.5 }, { tMs: 1500, x: 0.5, y: 0.35 },
    { tMs: 3000, x: 0.75, y: 0.5 }, { tMs: 4500, x: 0.5, y: 0.65 },
  ] },
  { key: 'hold', label: 'motionPresetHold', frames: [
    { tMs: 0, x: 0.5, y: 0.5, scale: 1 }, { tMs: 3000, x: 0.5, y: 0.5, scale: 1 },
  ] },
]

/** 下拉值 `provider::model` → 请求入参。 */
function parseModelKey(key: string): { readonly provider: string, readonly model: string } | undefined {
  const separator = key.indexOf('::')
  if (separator <= 0) return undefined
  const provider = key.slice(0, separator)
  const model = key.slice(separator + 2)
  return provider === '' || model === '' ? undefined : { provider, model }
}

export interface MotionPanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly projectId?: string
  readonly episodeId?: string
  readonly script: string
  readonly model?: { readonly provider: string, readonly model: string }
  readonly textModels: readonly TextModelOption[]
  readonly skills: readonly SkillRecord[]
  readonly existing: readonly ResourceRecord[]
  readonly onCreated: () => void | Promise<void>
  readonly onNotice: (text: string, tone: 'info' | 'error') => void
}

/** 轨迹分区：共享输入 + 提取配置 + 轨迹卡列表。 */
export function MotionPanel(props: MotionPanelProps) {
  const { api, t, projectId, episodeId, script, model, textModels, skills, existing, onCreated, onNotice } = props
  const [cards, setCards] = useWorkbenchField(api, 'motionCards')
  const [extractPrompt, setExtractPrompt] = useWorkbenchField(api, 'motionExtractPrompt')
  const [extractModel, setExtractModel] = useWorkbenchField(api, 'motionExtractModel')
  const [collapsed, setCollapsed] = useState<readonly string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [importedFiles] = useWorkbenchField(api, 'pipelineImportedFiles')
  const [pipelineScript] = useWorkbenchField(api, 'pipelineScript')

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
        category: 'motion',
        provider: chosen.provider,
        model: chosen.model,
        ...instructions === '' ? {} : { instructions },
        ...skillId === '' ? {} : { skillId },
      })
      setCards(current => {
        const known = new Set(current.map(card => card.name))
        const created = result.items
          .filter(item => !known.has(item.name))
          .map(item => ({
            id: newWorkbenchId('motion-card'),
            name: item.name,
            note: item.note,
            preset: 'custom' as const,
            keyframes: [
              { tMs: 0, x: 0.5, y: 0.5, scale: 1 },
              { tMs: 3000, x: 0.5, y: 0.5, scale: 1.2 },
            ] as readonly MotionKeyframe[],
          }))
        return [...current, ...created]
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const patch = (id: string, change: Partial<MotionCard>): void => {
    setCards(current => current.map(card => card.id === id ? { ...card, ...change } : card))
  }

  const addCard = (): void => {
    setCards(current => [...current, {
      id: newWorkbenchId('motion-card'),
      name: '', note: '', preset: 'hold',
      keyframes: PRESETS.find(preset => preset.key === 'hold')!.frames,
    }])
  }

  const applyPreset = (card: MotionCard, preset: typeof PRESETS[number]): void => {
    patch(card.id, { preset: preset.key, keyframes: preset.frames })
  }

  const patchFrame = (card: MotionCard, index: number, change: Partial<MotionKeyframe>): void => {
    const next = card.keyframes.map((frame, at) => at === index ? { ...frame, ...change } : frame)
    patch(card.id, { preset: 'custom', keyframes: next })
  }

  const addFrame = (card: MotionCard): void => {
    const last = card.keyframes[card.keyframes.length - 1]
    const tMs = last === undefined ? 0 : Math.min(last.tMs + 1000, 600_000)
    patch(card.id, {
      preset: 'custom',
      keyframes: [...card.keyframes, { tMs, x: 0.5, y: 0.5, scale: 1 }],
    })
  }

  const removeFrame = (card: MotionCard, index: number): void => {
    patch(card.id, { preset: 'custom', keyframes: card.keyframes.filter((_, at) => at !== index) })
  }

  const saveCard = async (card: MotionCard): Promise<void> => {
    if (projectId === undefined || card.name.trim() === '') return
    setError(undefined)
    try {
      // 走宿主同一套校验：坐标越界 / 时间倒流 / 空关键帧在这里就被挡下
      const keyframes = normalizeKeyframes(card.keyframes)
      const note = card.note.trim()
      const resource = card.resourceId === undefined
        ? await api.createResource({ projectId, kind: 'motion-track', name: card.name.trim(), keyframes, ...note === '' ? {} : { note } })
        : await api.updateResource({ id: card.resourceId, keyframes, ...note === '' ? {} : { note } })
      if (episodeId !== undefined) {
        await api.episodeResources(episodeId, 'add', { resourceId: resource.id })
      }
      patch(card.id, { resourceId: resource.id })
      onNotice(t('motionCardSaved').replace('{name}', card.name), 'info')
      await onCreated()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
      onNotice(message, 'error')
    }
  }

  const toggle = (id: string): void => {
    setCollapsed(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  }

  return (
    <div className="iv-sub" data-motion-panel="true">
      <div className="iv-sub-head">
        <span className="iv-sub-title">{t('motionPanelTitle')}</span>
        <span className="iv-meta">{t('motionPanelDesc')}</span>
      </div>
      <div className="iv-plan-row">
        <span className="iv-meta" data-motion-source="true">
          {source.trim() === '' ? t('extractNeedsScript')
            : importedText === '' ? t('extractSource') : t('extractSourceWithFiles')}
        </span>
      </div>

      <div className="iv-sub" data-script-shared="true">
        <div className="iv-plan-row">
          <span className="iv-sub-title">{t('scriptSharedInputTitle')}</span>
          <span className="iv-meta">{t('scriptSharedInputDesc')}</span>
        </div>
        <SharedScriptInput api={api} t={t} />
      </div>

      <div className="iv-sub" data-motion-extract-config="true">
        <div className="iv-plan-row">
          <label className="iv-sb-field">
            <span className="iv-meta">{t('extractModelLabel')}</span>
            <select className="iv-select iv-select--sm" data-motion-extract-model="true" value={extractModel}
              onChange={event => { setExtractModel(event.target.value) }}>
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
              skills={skills} text={extractPrompt} t={t} label={t('skillInsert')}
              onTextChange={setExtractPrompt}
              selectAttrs={{ 'data-motion-extract-skill': 'true' }}
            />
          </label>
        </div>
        <label className="iv-sb-field">
          <span className="iv-meta">{t('motionExtractPromptLabel')}</span>
          <textarea className="iv-input" rows={2} data-motion-extract-prompt="true"
            placeholder={t('motionExtractPromptPlaceholder')} value={extractPrompt}
            onChange={event => { setExtractPrompt(event.target.value) }} />
        </label>
        <div className="iv-plan-row">
          <button type="button" className="iv-btn iv-btn--acc iv-btn--sm" data-motion-extract-run="true"
            disabled={!ready || busy} onClick={() => { void run() }}>
            <Icon name={busy ? 'sparkles' : 'script'} size={12} />
            {busy ? t('extractRunning') : t('motionExtractRun')}
          </button>
        </div>
      </div>

      {chosen === undefined ? <div className="iv-meta">{t('extractNeedsModel')}</div> : null}
      {projectId === undefined ? <div className="iv-meta">{t('extractNeedsProject')}</div> : null}
      {error === undefined ? null : <div className="iv-notice iv-notice--err" role="alert">{error}</div>}

      <div className="iv-sub" data-motion-cards="true">
        <div className="iv-plan-row">
          <span className="iv-sub-title">{t('motionCardsTitle')}</span>
          <span className="iv-meta">{t('motionCardsDesc')}</span>
          <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" data-motion-card-add="true" onClick={addCard}>
            <Icon name="plus" size={12} />{t('motionCardAdd')}
          </button>
        </div>
        {cards.length === 0 ? <div className="iv-empty">{t('motionCardsEmpty')}</div> : null}
        {cards.map(card => {
          const isCollapsed = collapsed.includes(card.id)
          const inLibrary = existing.some(resource => resource.id === card.resourceId)
          const compiled = describeMotionTrack(card.keyframes)
          return (
            <div className="iv-card" key={card.id} data-motion-card-item={card.id}>
              <button type="button" className="iv-card-head iv-card-head--button" data-motion-card-toggle={card.id} onClick={() => { toggle(card.id) }}>
                <Icon name="motion" size={13} />
                <strong>{card.name.trim() === '' ? t('motionCardUntitled') : card.name}</strong>
                {inLibrary ? <span className="iv-chip iv-chip--ok">{t('extractExisting')}</span> : null}
                <span className="iv-module-toggle" aria-hidden="true"><Icon name="chevron" size={11} />{isCollapsed ? t('moduleExpand') : t('moduleCollapse')}</span>
              </button>
              {isCollapsed ? null : (
                <div className="iv-card-body" style={{ display: 'grid', gap: 'var(--iv-sp-3)' }}>
                  <div className="iv-plan-row">
                    <label className="iv-sb-field">
                      <span className="iv-meta">{t('motionCardName')}</span>
                      <input className="iv-input" data-motion-card-name={card.id} value={card.name}
                        onChange={event => { patch(card.id, { name: event.target.value }) }} />
                    </label>
                    <label className="iv-sb-field">
                      <span className="iv-meta">{t('motionCardPreset')}</span>
                      <span className="iv-meta" data-motion-card-preset={card.id}>
                        {card.preset === 'custom' ? t('motionPresetCustom') : t(PRESETS.find(preset => preset.key === card.preset)?.label ?? 'motionPresetCustom')}
                      </span>
                    </label>
                  </div>
                  <div className="iv-plan-row" data-motion-presets={card.id}>
                    {PRESETS.map(preset => (
                      <button key={preset.key} type="button" className="iv-btn iv-btn--ghost iv-btn--sm"
                        data-motion-preset={preset.key} onClick={() => { applyPreset(card, preset) }}>
                        {t(preset.label)}
                      </button>
                    ))}
                  </div>
                  <label className="iv-sb-field">
                    <span className="iv-meta">{t('motionCardNote')}</span>
                    <textarea className="iv-input" rows={2} data-motion-card-note={card.id} value={card.note}
                      placeholder={t('motionCardNotePlaceholder')}
                      onChange={event => { patch(card.id, { note: event.target.value }) }} />
                  </label>

                  <div className="iv-sub" data-motion-frames={card.id}>
                    <div className="iv-plan-row">
                      <span className="iv-sub-title">{t('motionFramesTitle')}</span>
                      <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" data-motion-frame-add={card.id}
                        onClick={() => { addFrame(card) }}>
                        <Icon name="plus" size={12} />{t('motionFrameAdd')}
                      </button>
                    </div>
                    {card.keyframes.length === 0
                      ? <div className="iv-meta">{t('motionFramesEmpty')}</div>
                      : (
                        <div className="iv-motion-frames">
                          {card.keyframes.map((frame, index) => (
                            <div className="iv-plan-row iv-motion-frame" key={index} data-motion-frame={index}>
                              <span className="iv-meta">#{index + 1}</span>
                              <label className="iv-sb-field"><span className="iv-meta">{t('motionFrameTime')}</span>
                                <input type="number" className="iv-input" data-motion-frame-time={index} min={0} max={600000} step={100}
                                  value={frame.tMs} onChange={event => { patchFrame(card, index, { tMs: Number(event.target.value) }) }} />
                              </label>
                              <label className="iv-sb-field"><span className="iv-meta">X</span>
                                <input type="number" className="iv-input" data-motion-frame-x={index} min={0} max={1} step={0.05}
                                  value={frame.x} onChange={event => { patchFrame(card, index, { x: Number(event.target.value) }) }} />
                              </label>
                              <label className="iv-sb-field"><span className="iv-meta">Y</span>
                                <input type="number" className="iv-input" data-motion-frame-y={index} min={0} max={1} step={0.05}
                                  value={frame.y} onChange={event => { patchFrame(card, index, { y: Number(event.target.value) }) }} />
                              </label>
                              <label className="iv-sb-field"><span className="iv-meta">{t('motionFrameScale')}</span>
                                <input type="number" className="iv-input" data-motion-frame-scale={index} min={0.1} max={10} step={0.05}
                                  value={frame.scale ?? 1} onChange={event => { patchFrame(card, index, { scale: Number(event.target.value) }) }} />
                              </label>
                              <button type="button" className="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm" data-motion-frame-remove={index}
                                aria-label={t('remove')} onClick={() => { removeFrame(card, index) }}>
                                <Icon name="x" size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>

                  <label className="iv-sb-field">
                    <span className="iv-meta">{t('motionCompiledPrompt')}</span>
                    <textarea className="iv-input" rows={2} readOnly data-motion-compiled={card.id} value={compiled} />
                  </label>
                  <div className="iv-plan-row">
                    <button type="button" className="iv-btn iv-btn--sm" data-motion-card-save={card.id}
                      disabled={projectId === undefined || card.name.trim() === '' || card.keyframes.length === 0}
                      onClick={() => { void saveCard(card) }}>
                      <Icon name="layers" size={12} />{t('motionCardSave')}
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
