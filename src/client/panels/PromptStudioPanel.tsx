/**
 * 提取提示词页：把引用的图片或视频经逆向 Skill / 文本模型提取为可编辑提示词，
 * 并存入本集提示词库；同屏还列出本集分镜的逐镜提示词，便于直接带入生成。
 *
 * 引用交互与分镜（分段 / 镜头）一致：从素材库挑图片或视频，引用列表里同时给出
 * 缩略图与文件名——自动命名的文件只看名字分不出来。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../icons.tsx'
import { SkillTokenSelect, activeSkillId, stripSkillTokens } from '../skill-tokens.tsx'
import { useDialogFocus } from '../use-dialog-focus.ts'
import type { WorkbenchApi, ExtractedPrompt, PromptRecord, TextModelOption } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'
import type { AssetRecord } from '../../workbench/records.ts'
import type { EpisodeRecord } from '../../workbench/episodes.ts'
import type { SkillRecord } from '../../workbench/skills.ts'

/** 引用素材上限（图片 + 视频）。 */
export const MAX_STUDIO_SOURCES = 8

export interface PromptStudioPanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly projectId: string
  readonly episode: EpisodeRecord | undefined
  /** 全局素材库（本集素材也在这里，集里只存引用）。 */
  readonly assets: readonly AssetRecord[]
  /** 引用列表点选 → 右侧预览面板展示对应素材。 */
  readonly onPreviewAsset: (path: string, kind: 'image' | 'video') => void
  readonly onNotice: (text: string, tone: 'info' | 'error') => void
  /** 把提示词带进内容生产页的输入框。 */
  readonly onApplyPrompt: (text: string) => void
}

/** 文件路径 → 文件名。 */
function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

/** 提取结果 → 一段提示词文本（宿主拼好的 `text` 优先）。 */
function promptText(result: ExtractedPrompt): string {
  if (result.text !== undefined && result.text.trim() !== '') return result.text
  return [result.style, result.subject, result.material, result.details].filter(Boolean).join('，')
}

/** 素材缩略图：图片直接加载，视频取第 0.1 秒的一帧。 */
function SourceThumb(props: { readonly kind: AssetRecord['kind'] | undefined, readonly path: string }) {
  const src = `/outputs/${encodeURIComponent(fileName(props.path))}`
  return props.kind === 'video'
    ? <video className="iv-ref-picker-thumb" src={`${src}#t=0.1`} muted preload="metadata" playsInline aria-hidden />
    : <img className="iv-ref-picker-thumb" src={src} alt="" />
}

export function PromptStudioPanel(props: PromptStudioPanelProps) {
  const { api, t, projectId, episode, assets, onPreviewAsset, onNotice, onApplyPrompt } = props
  const [skills, setSkills] = useState<readonly SkillRecord[]>([])
  const [models, setModels] = useState<readonly TextModelOption[]>([])
  const [modelChoice, setModelChoice] = useState('')
  const [rules, setRules] = useState('')
  const [selected, setSelected] = useState<readonly string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftText, setDraftText] = useState('')
  const [prompts, setPrompts] = useState<readonly PromptRecord[]>([])
  const [busy, setBusy] = useState(false)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const pickerAnchor = useRef<HTMLDivElement | null>(null)

  /** 图片与视频都能作为提取输入。 */
  const sources = assets.filter(asset => asset.kind === 'image' || asset.kind === 'video')
  const skillId = activeSkillId(rules, skills)

  const closePicker = useCallback(() => {
    setPickerOpen(false)
    setQuery('')
  }, [])
  useDialogFocus(pickerOpen, pickerRef, closePicker)

  /** 读取启用的逆向 Skill、本集提示词与文本模型目录。 */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [loadedSkills, loadedPrompts] = await Promise.all([
          api.listSkills('reverse', true),
          api.listPrompts({ episodeId: episode?.id }),
        ])
        if (!cancelled) {
          setSkills(loadedSkills)
          setPrompts(loadedPrompts)
        }
      } catch (thrown) {
        if (!cancelled) onNotice(`${t('studioLoadFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
      }
    })()
    return () => { cancelled = true }
  }, [api, episode?.id, projectId])

  /** 文本模型目录（不含图片 / 视频生成模型）；失败时保留"默认"选项。 */
  useEffect(() => {
    let cancelled = false
    void api.listTextModels()
      .then(catalog => { if (!cancelled) setModels(catalog.models) })
      .catch((thrown: unknown) => {
        if (!cancelled) {
          onNotice(`${t('scriptModelsFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
        }
      })
    return () => { cancelled = true }
  }, [api])

  /** 点在选择器外面时收起。 */
  useEffect(() => {
    if (!pickerOpen) return
    const onMouseDown = (event: MouseEvent): void => {
      if (event.target instanceof Node && pickerAnchor.current?.contains(event.target) === true) return
      closePicker()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => { document.removeEventListener('mousedown', onMouseDown) }
  }, [pickerOpen, closePicker])

  /** 追加一条引用；超过上限时如实提示。 */
  const addSource = (path: string): void => {
    if (selected.includes(path)) return
    if (selected.length >= MAX_STUDIO_SOURCES) {
      onNotice(t('studioSourceLimit').replace('{n}', String(MAX_STUDIO_SOURCES)), 'error')
      return
    }
    setSelected([...selected, path])
    closePicker()
  }

  /** 逐条调用提取适配器，把结果拼成一段可编辑提示词。 */
  const extract = async (): Promise<void> => {
    if (selected.length === 0) return
    setBusy(true)
    try {
      const separator = modelChoice.indexOf('::')
      const choice = separator <= 0
        ? undefined
        : { provider: modelChoice.slice(0, separator), model: modelChoice.slice(separator + 2) }
      const instructions = stripSkillTokens(rules, skills)
      const pieces: string[] = []
      for (const path of selected) {
        pieces.push(promptText(await api.extractPrompt({
          path,
          ...skillId === '' ? {} : { skillId },
          ...instructions === '' ? {} : { instructions },
          ...choice === undefined ? {} : choice,
        })))
      }
      const text = pieces.filter(piece => piece.trim() !== '').join('\n\n')
      setDraftText(text)
      if (draftName === '') {
        setDraftName(`${episode?.title ?? ''} ${t('studioDraftNameSuffix')}`.trim())
      }
      onNotice(t('studioExtracted').replace('{n}', String(pieces.length)), 'info')
    } catch (thrown) {
      onNotice(`${t('studioExtractFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  /** 存入本集提示词库。 */
  const save = async (): Promise<void> => {
    const text = draftText.trim()
    if (text === '' || episode === undefined) return
    setBusy(true)
    try {
      const saved = await api.savePrompt({
        name: draftName.trim() === '' ? `${episode.title} ${t('studioDraftNameSuffix')}` : draftName.trim(),
        text,
        projectId,
        episodeId: episode.id,
      })
      onNotice(t('studioSaved').replace('{name}', saved.name), 'info')
      setPrompts(await api.listPrompts({ episodeId: episode.id }))
      setDraftName('')
    } catch (thrown) {
      onNotice(`${t('studioSaveFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  /** 删除本集提示词。 */
  const remove = async (prompt: PromptRecord): Promise<void> => {
    try {
      await api.removePrompt(prompt.id)
      setPrompts(current => current.filter(candidate => candidate.id !== prompt.id))
    } catch (thrown) {
      onNotice(`${t('studioSaveFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    }
  }

  if (episode === undefined) {
    return <span className="iv-meta" data-studio-no-episode="true">{t('studioNoEpisode')}</span>
  }

  const keyword = query.trim().toLowerCase()
  const candidates = sources.filter(asset => !selected.includes(asset.path)
    && (keyword === '' || fileName(asset.path).toLowerCase().includes(keyword)))
  const groups = [
    { kind: 'image', title: t('segmentRefImages'), items: candidates.filter(asset => asset.kind === 'image') },
    { kind: 'video', title: t('segmentRefVideos'), items: candidates.filter(asset => asset.kind === 'video') },
  ].filter(group => group.items.length > 0)

  return (
    <div className="iv-prompt-studio" data-prompt-studio="true">
      <div className="iv-fusion-head">
        <span className="iv-chip"><Icon name="sparkles" size={11} />{t('studioTitle')}</span>
        <span className="iv-meta">{t('studioDesc')}</span>
      </div>

      <div className="iv-sb-row">
        <label className="iv-sb-field">
          <span className="iv-meta">{t('studioSkillLabel')}</span>
          <SkillTokenSelect
            skills={skills}
            text={rules}
            t={t}
            label={t('studioSkillLabel')}
            className="iv-select"
            selectAttrs={{ 'data-studio-skill': 'true' }}
            onTextChange={setRules}
          />
        </label>
        <label className="iv-sb-field">
          <span className="iv-meta">{t('studioModelLabel')}</span>
          <select
            className="iv-select"
            data-studio-model="true"
            value={modelChoice}
            onChange={event => { setModelChoice(event.target.value) }}
          >
            <option value="">{t('studioModelEmpty')}</option>
            {models.map(model => (
              <option key={`${model.provider}::${model.id}`} value={`${model.provider}::${model.id}`}>
                {model.providerName} · {model.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="iv-sb-field">
        <span className="iv-meta">{t('studioRulesLabel')}</span>
        <textarea
          className="iv-input"
          rows={3}
          value={rules}
          data-studio-rules="true"
          placeholder={t('studioRulesPlaceholder')}
          onChange={event => { setRules(event.target.value) }}
        />
      </label>

      <div className="iv-studio-sources">
        <span className="iv-meta">
          {t('studioSources')}（{selected.length}/{MAX_STUDIO_SOURCES}）
        </span>
        <span className="iv-meta">{t('studioSourcesHint')}</span>
        <ul className="iv-ref-list" data-studio-sources="true">
          {selected.length === 0
            ? <li className="iv-meta" data-studio-sources-empty="true">{t('studioSourcesEmpty')}</li>
            : selected.map(path => {
                const asset = sources.find(candidate => candidate.path === path)
                return (
                  <li className="iv-studio-ref-row" key={path} data-studio-ref={path}>
                    <button
                      type="button"
                      className="iv-studio-ref-preview"
                      data-studio-ref-preview={path}
                      aria-label={`${t('refPreview')} ${fileName(path)}`}
                      title={`${t('refPreview')} ${fileName(path)}`}
                      onClick={() => { onPreviewAsset(path, asset?.kind === 'video' ? 'video' : 'image') }}
                    >
                      <SourceThumb kind={asset?.kind} path={path} />
                      <span className="iv-ellipsis" title={fileName(path)}>{fileName(path)}</span>
                    </button>
                    <button
                      type="button"
                      className="iv-btn iv-btn--icon iv-btn--sm"
                      data-studio-ref-remove={path}
                      aria-label={`${t('remove')} ${fileName(path)}`}
                      title={t('remove')}
                      onClick={() => { setSelected(selected.filter(candidate => candidate !== path)) }}
                    >
                      <Icon name="x" size={11} />
                    </button>
                  </li>
                )
              })}
        </ul>
        <div className="iv-row">
          <div className="iv-ref-pop" ref={pickerAnchor}>
            <button
              type="button"
              className="iv-btn iv-btn--ghost iv-btn--sm"
              data-studio-add-source="true"
              disabled={busy || candidates.length === 0}
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              onClick={() => { if (pickerOpen) closePicker(); else setPickerOpen(true) }}
            >
              <Icon name="plus" size={11} />{t('studioAddSource')}
            </button>
            {pickerOpen
              ? (
                <div
                  className="iv-pop-panel"
                  ref={pickerRef}
                  tabIndex={-1}
                  role="dialog"
                  aria-label={t('studioAddSource')}
                >
                  <input
                    className="iv-input iv-ref-picker-search"
                    type="search"
                    value={query}
                    placeholder={t('segmentRefSearch')}
                    aria-label={t('segmentRefSearch')}
                    data-studio-source-search="true"
                    onChange={event => { setQuery(event.target.value) }}
                  />
                  {groups.length === 0
                    ? <span className="iv-ref-picker-empty" data-studio-sources-none="true">{t('segmentRefPickerEmpty')}</span>
                    : groups.map(group => (
                        <div className="iv-pop-group" key={group.kind}>
                          <span className="iv-micro iv-pop-group-title">{group.title}</span>
                          {group.items.map(asset => (
                            <div className="iv-ref-picker-row" key={asset.id}>
                              <button
                                type="button"
                                className="iv-ref-picker-item"
                                data-studio-option={asset.id}
                                onClick={() => { addSource(asset.path) }}
                              >
                                <SourceThumb kind={asset.kind} path={asset.path} />
                                <span className="iv-ellipsis" title={fileName(asset.path)}>{fileName(asset.path)}</span>
                                <span className="iv-ref-picker-meta">
                                  {asset.kind === 'video' ? t('segmentRefVideos') : t('segmentRefImages')}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="iv-btn iv-btn--icon iv-btn--sm iv-ref-picker-preview"
                                data-studio-preview={asset.id}
                                aria-label={`${t('refPreview')} ${fileName(asset.path)}`}
                                title={`${t('refPreview')} ${fileName(asset.path)}`}
                                onClick={() => { closePicker(); onPreviewAsset(asset.path, asset.kind) }}
                              >
                                <Icon name="eye" size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                </div>
              )
              : null}
          </div>
          <button
            type="button"
            className="iv-btn iv-btn--sm"
            data-studio-extract="true"
            disabled={busy || selected.length === 0}
            onClick={() => { void extract() }}
          >
            {busy ? t('studioExtracting') : t('studioExtractAction')}
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--ghost iv-btn--sm"
            data-studio-clear="true"
            disabled={selected.length === 0}
            onClick={() => { setSelected([]) }}
          >
            {t('studioClearSources')}
          </button>
        </div>
      </div>

      <label className="iv-sb-field">
        <span className="iv-meta">{t('studioNameLabel')}</span>
        <input
          className="iv-input"
          value={draftName}
          data-studio-name="true"
          placeholder={t('studioNamePlaceholder')}
          onChange={event => { setDraftName(event.target.value) }}
        />
      </label>
      <label className="iv-sb-field">
        <span className="iv-meta">{t('studioDraftLabel')}</span>
        <textarea
          className="iv-input"
          rows={6}
          value={draftText}
          data-studio-draft="true"
          placeholder={t('studioDraftPlaceholder')}
          onChange={event => { setDraftText(event.target.value) }}
        />
      </label>
      <div className="iv-row">
        <button
          type="button"
          className="iv-btn iv-btn--acc iv-btn--sm"
          data-studio-save="true"
          disabled={busy || draftText.trim() === ''}
          onClick={() => { void save() }}
        >
          {t('studioSaveAction')}
        </button>
        <button
          type="button"
          className="iv-btn iv-btn--ghost iv-btn--sm"
          data-studio-apply="true"
          disabled={draftText.trim() === ''}
          onClick={() => { onApplyPrompt(draftText.trim()) }}
        >
          {t('studioApply')}
        </button>
      </div>

      <div className="iv-studio-library">
        <span className="iv-chip">{t('studioPromptLibrary')}</span>
        {prompts.length === 0
          ? <span className="iv-meta" data-studio-library-empty="true">{t('studioPromptEmpty')}</span>
          : prompts.map(prompt => (
              <div className="iv-prompt-row" key={prompt.id} data-studio-prompt={prompt.id}>
                <span className="iv-ellipsis" title={prompt.text}>{prompt.name}</span>
                <button
                  type="button"
                  className="iv-btn iv-btn--ghost iv-btn--sm"
                  data-studio-prompt-apply={prompt.id}
                  onClick={() => {
                    setDraftText(prompt.text)
                    setDraftName(prompt.name)
                    onApplyPrompt(prompt.text)
                  }}
                >
                  {t('studioApply')}
                </button>
                <button
                  type="button"
                  className="iv-btn iv-btn--icon iv-btn--sm"
                  data-studio-prompt-remove={prompt.id}
                  aria-label={`${t('studioRemovePrompt')} ${prompt.name}`}
                  onClick={() => { void remove(prompt) }}
                >
                  <Icon name="trash" size={11} />
                </button>
              </div>
            ))}
      </div>

      <div className="iv-studio-storyboards">
        <span className="iv-chip">{t('studioStoryboard')}</span>
        {episode.storyboards.length === 0
          ? <span className="iv-meta" data-studio-storyboard-empty="true">{t('studioStoryboardEmpty')}</span>
          : episode.storyboards.flatMap(storyboard => storyboard.shots.map(shot => (
              <div className="iv-prompt-row" key={`${storyboard.id}:${shot.id}`} data-studio-shot={shot.id}>
                <span className="iv-ellipsis" title={shot.imagePrompt}>
                  {`#${shot.order} · ${shot.durationSec}s · ${shot.imagePrompt}`}
                </span>
                <button
                  type="button"
                  className="iv-btn iv-btn--ghost iv-btn--sm"
                  data-studio-shot-apply={shot.id}
                  onClick={() => {
                    const text = [shot.imagePrompt, shot.videoPrompt].filter(part => part.trim() !== '').join('\n')
                    setDraftText(text)
                    onApplyPrompt(text)
                  }}
                >
                  {t('studioShotApply')}
                </button>
              </div>
            )))}
      </div>
    </div>
  )
}
