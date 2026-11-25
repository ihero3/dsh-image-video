/**
 * 角色卡片列表（角色提取分区的下半部分）。
 *
 * 每张卡是一个角色的定妆配置：默认值、可编辑提示词、生图模型、Skill、尺寸、风格。
 * 点「生成角色图」直接出图：图片随 `projectId` 自动登记到全局素材库，同时写入
 * 本剧资源库与本集资源引用；点缩略图送右侧预览面板。
 *
 * @module dsh-image-video/client/panels/RoleCardsPanel
 */
import { useState } from 'react'
import type { WorkbenchApi } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'
import type { WorkbenchOptions } from '../../workbench-contract.ts'
import type { ResourceRecord } from '../../workbench/records.ts'
import type { SkillRecord } from '../../workbench/skills.ts'
import type { RoleCard } from '../workbench-store.ts'
import { LENS_PRESETS, normalizeComposeCrop, POSE_PRESETS } from '../../workbench/compose.ts'
import { SkillTokenSelect, activeSkillId, stripSkillTokens } from '../skill-tokens.tsx'
import { ModelPicker } from './ModelPicker.tsx'

export interface RoleCardsPanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly projectId?: string
  readonly episodeId?: string
  readonly options: WorkbenchOptions | undefined
  readonly skills: readonly SkillRecord[]
  /** 同类资源：同名角色已有资源时只更新它的图片，不重复建条目。 */
  readonly existing: readonly ResourceRecord[]
  readonly cards: readonly RoleCard[]
  readonly onChange: (cards: readonly RoleCard[]) => void
  readonly onPreviewAsset: (path: string, kind: 'image' | 'video') => void
  /** 出图后刷新素材、资源与集记录。 */
  readonly onCreated: () => void | Promise<void>
  readonly onNotice: (text: string, tone: 'info' | 'error') => void
}

/** 场景裁剪的默认框：归一化 0..1。 */
const DEFAULT_CROP = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }

/** 产物路径 → 浏览器可访问的缩略图地址（宿主把 outputs 挂在 /outputs）。 */
function thumbSrc(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path
  return `/outputs/${encodeURIComponent(name)}`
}

/**
 * 一列角色卡：标题行整行可折叠，展开后是定妆参数与出图入口。
 * @param props - 见 {@link RoleCardsPanelProps}。
 */
export function RoleCardsPanel(props: RoleCardsPanelProps) {
  const { api, t, projectId, episodeId, options, skills, existing, cards, onChange,
    onPreviewAsset, onCreated, onNotice } = props
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [generating, setGenerating] = useState('')
  const canGenerate = projectId !== undefined && projectId !== '' && episodeId !== undefined && episodeId !== ''

  const toggle = (id: string): void => {
    setCollapsed(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const patch = (id: string, change: Partial<RoleCard>): void => {
    onChange(cards.map(card => card.id === id ? { ...card, ...change } : card))
  }

  const generate = async (card: RoleCard): Promise<void> => {
    if (!canGenerate) { onNotice(t('roleCardNeedsProject'), 'error'); return }
    setGenerating(card.id)
    try {
      const clean = stripSkillTokens(card.prompt, skills)
      const prompt = card.style.trim() === '' ? clean : `${clean}，风格：${card.style.trim()}`
      // 旧数据里可能把服务商 id 当成模型存着（threevideo 等）：那不是 images endpoint 认的模型，宁可不传
      const imageModel = card.imageModel !== '' && !(options?.imageProviders ?? []).includes(card.imageModel)
        ? card.imageModel
        : ''
      const modelPart = imageModel === '' ? {} : { model: imageModel }
      const sizePart = card.size === '' ? {} : { size: card.size }
      // 姿态 / 镜头 / 风格备注 / 场景裁剪是融合生图参数：只用其中任一项就走 compose 端点
      const useCompose = card.pose !== '' || card.lens !== ''
        || card.styleNote.trim() !== '' || card.cropEnabled
      let cropScene
      if (card.cropEnabled) {
        try {
          cropScene = normalizeComposeCrop(card.crop ?? { x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
        } catch (cause) {
          onNotice(`${t('fusionCropInvalid')}：${cause instanceof Error ? cause.message : String(cause)}`, 'error')
          return
        }
      }
      let known = existing.find(resource => resource.kind === 'role' && resource.name === card.name)
      // compose 按资源 id 解析参考图；角色还没入库就先建一条（定妆照随后补上）
      if (useCompose && known === undefined) {
        known = await api.createResource({
          projectId,
          kind: 'role',
          name: card.name,
          ...card.defaultPrompt.trim() === '' ? {} : { note: card.defaultPrompt.trim() },
        })
        await api.episodeResources(episodeId, 'add', { resourceId: known.id })
      }
      const result = useCompose
        ? await api.composeMedia({
          projectId,
          prompt,
          resourceIds: known === undefined ? [] : [known.id],
          ...card.pose === '' ? {} : { pose: card.pose },
          ...card.lens === '' ? {} : { lens: card.lens },
          ...card.styleNote.trim() === '' ? {} : { styleNote: card.styleNote.trim() },
          ...cropScene === undefined ? {} : { cropScene },
          ...modelPart,
          ...sizePart,
        })
        : await api.generateMedia({
          mediaMode: 'image',
          prompt,
          projectId,
          episodeId,
          ...modelPart,
          ...sizePart,
        })
      const path = result.asset?.path ?? result.path
      if (path === undefined) throw new Error('生成结果里没有图片路径')
      if (known === undefined) {
        const resource = await api.createResource({
          projectId,
          kind: 'role',
          name: card.name,
          ...card.defaultPrompt.trim() === '' ? {} : { note: card.defaultPrompt.trim() },
          assetPath: path,
        })
        await api.episodeResources(episodeId, 'add', { resourceId: resource.id })
      } else {
        await api.updateResource({ id: known.id, assetPath: path })
      }
      patch(card.id, { assetPath: path })
      await onCreated()
      onNotice(t('roleCardGenerated').replace('{name}', card.name), 'info')
    } catch (cause) {
      onNotice(cause instanceof Error ? cause.message : String(cause), 'error')
    } finally {
      setGenerating('')
    }
  }

  return (
    <div className="iv-sub" data-role-cards="true">
      <div className="iv-plan-row">
        <span className="iv-sub-title">{t('roleCardsTitle')}</span>
        <span className="iv-meta">{cards.length}</span>
      </div>
      {cards.length === 0
        ? <div className="iv-empty" data-role-cards-empty="true">{t('roleCardsEmpty')}</div>
        : (
          <div className="iv-sb-list" data-role-card-list="true">
            {cards.map((card, index) => {
              const isCollapsed = collapsed.has(card.id)
              return (
                <div className="iv-sb-seg" data-role-card={card.id} key={card.id}>
                  <div
                    className="iv-sb-row iv-sb-seg-head iv-sb-seg-head--clickable"
                    data-role-card-head={card.id}
                    aria-expanded={!isCollapsed}
                    onClick={() => { toggle(card.id) }}
                  >
                    <span className="iv-sb-shot-index">{index + 1}</span>
                    <strong>{card.name}</strong>
                    {card.assetPath === undefined ? null : (
                      <button
                        type="button"
                        className="iv-ref-thumb-button"
                        data-role-card-preview={card.id}
                        aria-label={t('roleCardPreview')}
                        title={t('roleCardPreview')}
                        onClick={event => {
                          event.stopPropagation()
                          onPreviewAsset(card.assetPath!, 'image')
                        }}
                      >
                        <img className="iv-ref-picker-thumb" src={thumbSrc(card.assetPath)} alt="" />
                      </button>
                    )}
                    <span className="iv-meta">{isCollapsed ? t('moduleExpand') : t('moduleCollapse')}</span>
                  </div>
                  {isCollapsed ? null : (
                    <div className="iv-sb-body" style={{ display: 'grid', gap: 'var(--iv-sp-3)' }}>
                      <label className="iv-sb-field">
                        <span className="iv-meta">{t('roleCardDefault')}</span>
                        <textarea
                          className="iv-input"
                          rows={2}
                          data-role-card-default={card.id}
                          value={card.defaultPrompt}
                          onChange={event => { patch(card.id, { defaultPrompt: event.target.value }) }}
                        />
                      </label>
                      <div className="iv-plan-row">
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          data-role-card-apply-default={card.id}
                          onClick={() => { patch(card.id, { prompt: card.defaultPrompt }) }}
                        >
                          {t('roleCardApplyDefault')}
                        </button>
                      </div>
                      <label className="iv-sb-field">
                        <span className="iv-meta">{t('generatePromptLabel')}</span>
                        <textarea
                          className="iv-input"
                          rows={3}
                          data-role-card-prompt={card.id}
                          value={card.prompt}
                          onChange={event => {
                            const prompt = event.target.value
                            patch(card.id, { prompt, skillId: activeSkillId(prompt, skills) })
                          }}
                        />
                      </label>
                      <div className="iv-plan-row">
                        <label className="iv-sb-field">
                          <span className="iv-meta">{t('generateImageModel')}</span>
                          <ModelPicker
                            api={api}
                            t={t}
                            mediaMode="image"
                            value={card.imageModel}
                            onChange={next => { patch(card.id, { imageModel: next }) }}
                            selectAttrs={{ 'data-role-card-image-model': card.id }}
                          />
                        </label>
                        <label className="iv-sb-field">
                          <span className="iv-meta">{t('skillInsert')}</span>
                          <SkillTokenSelect
                            skills={skills}
                            text={card.prompt}
                            t={t}
                            label={t('skillInsert')}
                            onTextChange={prompt => {
                              patch(card.id, { prompt, skillId: activeSkillId(prompt, skills) })
                            }}
                            selectAttrs={{ 'data-role-card-skill': card.id }}
                          />
                        </label>
                      </div>
                      {/* 与融合生图同一套参数：姿态 × 镜头 × 风格备注 × 场景裁剪，跟着每张角色卡走 */}
                      <div className="iv-compose-params" data-role-card-compose={card.id}>
                        <div className="iv-param-row" data-param="pose">
                          <span className="iv-meta">{t('fusionPoseLabel')}：</span>
                          <button
                            type="button"
                            className={`iv-chip iv-chip--toggle${card.pose === '' ? ' on' : ''}`}
                            data-role-card-pose={card.id}
                            data-pose="none"
                            onClick={() => { patch(card.id, { pose: '' }) }}
                          >{t('fusionPoseNone')}</button>
                          {POSE_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              type="button"
                              className={`iv-chip iv-chip--toggle${card.pose === preset.id ? ' on' : ''}`}
                              data-role-card-pose={card.id}
                              data-pose={preset.id}
                              onClick={() => { patch(card.id, { pose: card.pose === preset.id ? '' : preset.id }) }}
                            >{t(preset.labelKey as WorkbenchLocaleKey)}</button>
                          ))}
                        </div>
                        <div className="iv-param-row" data-param="lens">
                          <span className="iv-meta">{t('fusionLensLabel')}：</span>
                          <button
                            type="button"
                            className={`iv-chip iv-chip--toggle${card.lens === '' ? ' on' : ''}`}
                            data-role-card-lens={card.id}
                            data-lens="none"
                            onClick={() => { patch(card.id, { lens: '' }) }}
                          >{t('fusionLensNone')}</button>
                          {LENS_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              type="button"
                              className={`iv-chip iv-chip--toggle${card.lens === preset.id ? ' on' : ''}`}
                              data-role-card-lens={card.id}
                              data-lens={preset.id}
                              onClick={() => { patch(card.id, { lens: card.lens === preset.id ? '' : preset.id }) }}
                            >{t(preset.labelKey as WorkbenchLocaleKey)}</button>
                          ))}
                        </div>
                        <textarea
                          className="iv-input"
                          rows={2}
                          value={card.styleNote}
                          placeholder={t('fusionStyleNotePlaceholder')}
                          data-role-card-style-note={card.id}
                          onChange={event => { patch(card.id, { styleNote: event.target.value }) }}
                          style={{ resize: 'vertical', font: 'inherit', padding: '6px 8px' }}
                        />
                        <div className="iv-crop" data-crop="true">
                          <label className="iv-check">
                            <input
                              type="checkbox"
                              checked={card.cropEnabled}
                              data-role-card-crop-enable={card.id}
                              onChange={event => { patch(card.id, { cropEnabled: event.target.checked }) }}
                            />
                            <span>{t('fusionCropLabel')}</span>
                          </label>
                          {card.cropEnabled
                            ? (
                              <div className="iv-crop-fields" data-crop-fields="true">
                                {(['x', 'y', 'width', 'height'] as const).map(field => (
                                  <label key={field} className="iv-crop-field">
                                    <span>{t(`fusionCrop${field.charAt(0).toUpperCase()}${field.slice(1)}` as WorkbenchLocaleKey)}</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={1}
                                      step={0.01}
                                      className="iv-input"
                                      style={{ width: '64px' }}
                                      value={(card.crop ?? DEFAULT_CROP)[field]}
                                      data-role-card-crop-field={field}
                                      onChange={event => {
                                        const next = Number(event.target.value)
                                        patch(card.id, {
                                          crop: {
                                            ...(card.crop ?? DEFAULT_CROP),
                                            [field]: Number.isFinite(next) ? next : 0,
                                          },
                                        })
                                      }}
                                    />
                                  </label>
                                ))}
                                <span className="iv-meta">{t('fusionCropHint')}</span>
                              </div>
                            )
                            : <span className="iv-meta">{t('fusionCropHint')}</span>}
                        </div>
                      </div>
                      <div className="iv-plan-row">
                        <label className="iv-sb-field">
                          <span className="iv-meta">{t('defaultImageSize')}</span>
                          <select
                            className="iv-input"
                            data-role-card-size={card.id}
                            value={card.size}
                            onChange={event => { patch(card.id, { size: event.target.value }) }}
                          >
                            <option value="">{t('generateParamAuto')}</option>
                            {(options?.imageSizes ?? []).map(item => (
                              <option key={item.id} value={item.size}>{item.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="iv-sb-field">
                          <span className="iv-meta">{t('defaultImageStyle')}</span>
                          <select
                            className="iv-input"
                            data-role-card-style={card.id}
                            value={card.style}
                            onChange={event => { patch(card.id, { style: event.target.value }) }}
                          >
                            <option value="">{t('generateParamAuto')}</option>
                            {(options?.imageStyles ?? []).map(style => (
                              <option key={style} value={style}>{style}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="iv-plan-row">
                        <button
                          type="button"
                          className="iv-btn iv-btn--acc iv-btn--sm iv-btn--action iv-btn--action--primary"
                          data-role-card-generate={card.id}
                          disabled={generating === card.id || !canGenerate}
                          onClick={() => { void generate(card) }}
                        >
                          {generating === card.id ? t('roleCardGenerating') : t('roleCardGenerate')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}
