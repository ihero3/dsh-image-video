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
  /** 提取进度：串行跑多个素材时显示「2/5」，也让用户知道还能取消。 */
  const [progress, setProgress] = useState<{ readonly done: number, readonly total: number } | null>(null)
  /** 最近一次提取的分段结果：草稿里是一段合并文本，这里保留「哪段来自哪个素材」。 */
  const [segments, setSegments] = useState<readonly { readonly path: string, readonly text: string }[]>([])
  /** 被提取覆盖前的草稿，用来「恢复」。 */
  const [previousDraft, setPreviousDraft] = useState('')
  /** 刚删除的库提示词，用一行「撤销」兜住误删（确认弹窗会打断批量整理）。 */
  const [removedPrompt, setRemovedPrompt] = useState<PromptRecord | null>(null)
  const cancelRef = useRef(false)
  const sourceListRef = useRef<HTMLUListElement | null>(null)
  const addSourceRef = useRef<HTMLButtonElement | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const pickerAnchor = useRef<HTMLDivElement | null>(null)

  /** 图片与视频都能作为提取输入。 */
  const sources = assets.filter(asset => asset.kind === 'image' || asset.kind === 'video')
  const skillId = activeSkillId(rules, skills)
  /** 默认提示词名：进入本页就有名字，不必等到提取或保存才补。 */
  const defaultName = episode === undefined ? '' : `${episode.title} ${t('studioDraftNameSuffix')}`.trim()

  const closePicker = useCallback(() => {
    setPickerOpen(false)
    setQuery('')
  }, [])
  useDialogFocus(pickerOpen, pickerRef, closePicker)

  /** 换集或首次进入时补上默认名；用户自己填过就不覆盖。 */
  useEffect(() => {
    setDraftName(current => current.trim() === '' ? defaultName : current)
  }, [defaultName])

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

  /** 逐条调用提取适配器；单个素材失败不影响其余，结束后如实汇报成功与失败。 */
  const extract = async (): Promise<void> => {
    if (selected.length === 0 || busy) return
    const paths = [...selected]
    cancelRef.current = false
    setBusy(true)
    setProgress({ done: 0, total: paths.length })
    const separator = modelChoice.indexOf('::')
    const choice = separator <= 0
      ? undefined
      : { provider: modelChoice.slice(0, separator), model: modelChoice.slice(separator + 2) }
    const instructions = stripSkillTokens(rules, skills)
    const collected: { path: string, text: string }[] = []
    const failures: string[] = []
    let processed = 0
    for (const path of paths) {
      if (cancelRef.current) break
      try {
        const piece = promptText(await api.extractPrompt({
          path,
          ...skillId === '' ? {} : { skillId },
          ...instructions === '' ? {} : { instructions },
          ...choice === undefined ? {} : choice,
        })).trim()
        if (piece !== '') collected.push({ path, text: piece })
      } catch (thrown) {
        failures.push(`${fileName(path)}：${thrown instanceof Error ? thrown.message : String(thrown)}`)
      }
      processed += 1
      setProgress({ done: processed, total: paths.length })
    }
    setProgress(null)
    setBusy(false)
    if (cancelRef.current) {
      onNotice(t('studioExtractCancelled'), 'info')
      return
    }
    if (collected.length === 0) {
      // 空结果不能报成功：素材没内容或模型没返回时，用户需要知道下一步该改什么
      onNotice(
        failures.length === 0
          ? t('studioExtractEmpty')
          : `${t('studioExtractFailed')}：${failures.join('；')}`,
        'error',
      )
      return
    }
    const text = collected.map(piece => piece.text).join('\n\n')
    // 覆盖前留一版，草稿标题行给出「恢复」，避免辛苦改的措辞被一次重提取冲掉
    setPreviousDraft(text === draftText ? '' : draftText)
    setDraftText(text)
    setSegments(collected)
    setDraftName(current => current.trim() === '' ? defaultName : current)
    onNotice(
      failures.length === 0
        ? t('studioExtracted').replace('{n}', String(collected.length))
        : t('studioExtractPartial').replace('{ok}', String(collected.length)).replace('{failed}', String(failures.length)),
      failures.length === 0 ? 'info' : 'error',
    )
  }

  /** 取消提取：停止后续素材并保留原草稿（已拿到的结果不落盘，避免半成品）。 */
  const cancelExtract = (): void => { cancelRef.current = true }

  /** 恢复提取前的草稿。 */
  const restoreDraft = (): void => {
    setDraftText(previousDraft)
    setPreviousDraft('')
    setSegments([])
  }

  /** 分段结果里去掉一段，草稿同步重拼。 */
  const dropSegment = (index: number): void => {
    const next = segments.filter((_, at) => at !== index)
    setSegments(next)
    setDraftText(next.map(piece => piece.text).join('\n\n'))
  }

  /** 移除一条引用；焦点落到同位置的下一行，列表空了回到「添加引用」。 */
  const removeSource = (path: string): void => {
    const index = selected.indexOf(path)
    setSelected(selected.filter(candidate => candidate !== path))
    requestAnimationFrame(() => {
      const rows = sourceListRef.current?.querySelectorAll<HTMLButtonElement>('[data-studio-ref-preview]')
      const target = rows === undefined || rows.length === 0
        ? addSourceRef.current
        : rows[Math.min(index, rows.length - 1)]
      target?.focus()
    })
  }

  /** 清空引用是破坏性的，先确认。 */
  const clearSources = (): void => {
    if (selected.length === 0) return
    if (!window.confirm(t('studioClearConfirm'))) return
    setSelected([])
  }

  /** 存入本集提示词库。 */
  const save = async (): Promise<void> => {
    const text = draftText.trim()
    if (text === '' || episode === undefined) return
    setBusy(true)
    try {
      const saved = await api.savePrompt({
        name: draftName.trim() === '' ? defaultName : draftName.trim(),
        text,
        projectId,
        episodeId: episode.id,
      })
      onNotice(t('studioSaved').replace('{name}', saved.name), 'info')
      setPrompts(await api.listPrompts({ episodeId: episode.id }))
      setDraftName(defaultName)
    } catch (thrown) {
      onNotice(`${t('studioSaveFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  /** 删除本集提示词：先删掉，再用一行「撤销」兜住误删。 */
  const remove = async (prompt: PromptRecord): Promise<void> => {
    try {
      await api.removePrompt(prompt.id)
      setPrompts(current => current.filter(candidate => candidate.id !== prompt.id))
      setRemovedPrompt(prompt)
    } catch (thrown) {
      onNotice(`${t('studioSaveFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    }
  }

  /** 撤销删除：按原名称与正文写回本集。 */
  const undoRemove = async (): Promise<void> => {
    const prompt = removedPrompt
    if (prompt === null || episode === undefined) return
    setRemovedPrompt(null)
    try {
      await api.savePrompt({ name: prompt.name, text: prompt.text, projectId, episodeId: episode.id })
      setPrompts(await api.listPrompts({ episodeId: episode.id }))
      onNotice(t('studioRestored').replace('{name}', prompt.name), 'info')
    } catch (thrown) {
      onNotice(`${t('studioSaveFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    }
  }

  if (episode === undefined) {
    return <span className="iv-meta" data-studio-no-episode="true">{t('studioNoEpisode')}</span>
  }

  /** 复制草稿：库里的提示词经常要粘到别处复用。 */
  const copyDraft = async (): Promise<void> => {
    const text = draftText.trim()
    if (text === '') return
    try {
      await navigator.clipboard.writeText(text)
      onNotice(t('studioCopied'), 'info')
    } catch (thrown) {
      onNotice(`${t('studioCopyFailed')}：${thrown instanceof Error ? thrown.message : String(thrown)}`, 'error')
    }
  }

  /** 清空草稿；引用与提示词库不受影响。 */
  const clearDraft = (): void => {
    setDraftText('')
    setPreviousDraft('')
    setSegments([])
  }

  /** 从库里载入一条提示词到草稿，停留在本页继续改。 */
  const loadPrompt = (prompt: PromptRecord): void => {
    setDraftText(prompt.text)
    setDraftName(prompt.name)
    setPreviousDraft('')
    setSegments([])
  }

  const shotCount = episode.storyboards.reduce((total, storyboard) => total + storyboard.shots.length, 0)

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

      <section className="iv-studio-sources">
        <div className="iv-studio-sources-head">
          <span className="iv-chip"><Icon name="image" size={11} />{t('studioSources')}</span>
          <span className="iv-meta" data-studio-source-count="true">（{selected.length}/{MAX_STUDIO_SOURCES}）</span>
          <span className="iv-ref-hint iv-meta">{t('studioSourcesHint')}</span>
          <div className="iv-ref-pop" ref={pickerAnchor}>
            <button
              type="button"
              ref={addSourceRef}
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
                  id="studio-source-picker"
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
        </div>
        <ul className="iv-ref-list" data-studio-sources="true" ref={sourceListRef}>
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
                      onClick={() => { removeSource(path) }}
                    >
                      <Icon name="x" size={11} />
                    </button>
                  </li>
                )
              })}
        </ul>
      </section>

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

      <div className="iv-studio-actions">
        <button
          type="button"
          className="iv-btn iv-btn--sm"
          data-studio-extract="true"
          aria-busy={busy}
          disabled={busy || selected.length === 0}
          onClick={() => { void extract() }}
        >
          <Icon name="sparkles" size={11} />{busy ? t('studioExtracting') : t('studioExtractAction')}
        </button>
        {busy
          ? <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" data-studio-cancel="true" onClick={cancelExtract}>
              {t('studioExtractCancel')}
            </button>
          : null}
        {busy && progress !== null
          ? (
              <span className="iv-meta" data-studio-progress="true" aria-live="polite">
                {t('studioExtractingProgress')
                  .replace('{done}', String(progress.done))
                  .replace('{total}', String(progress.total))}
              </span>
            )
          : null}
        <button
          type="button"
          className="iv-btn iv-btn--ghost iv-btn--sm"
          data-studio-clear="true"
          disabled={busy || selected.length === 0}
          onClick={clearSources}
        >
          {t('studioClearSources')}
        </button>
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
      <div className="iv-sb-field">
        <div className="iv-studio-field-head">
          <label className="iv-meta" htmlFor="studio-prompt-draft">{t('studioDraftLabel')}</label>
          <span className="iv-meta" data-studio-draft-count="true">
            {t('studioDraftCount').replace('{n}', String(draftText.length))}
          </span>
          <div className="iv-studio-field-tools">
            {previousDraft === ''
              ? null
              : (
                  <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" data-studio-restore="true" onClick={restoreDraft}>
                    <Icon name="undo" size={11} />{t('studioRestoreDraft')}
                  </button>
                )}
            <button
              type="button"
              className="iv-btn iv-btn--ghost iv-btn--sm"
              data-studio-copy="true"
              disabled={draftText.trim() === ''}
              onClick={() => { void copyDraft() }}
            >
              <Icon name="copy" size={11} />{t('studioCopyDraft')}
            </button>
            <button
              type="button"
              className="iv-btn iv-btn--ghost iv-btn--sm"
              data-studio-clear-draft="true"
              disabled={draftText === ''}
              onClick={clearDraft}
            >
              {t('studioClearDraft')}
            </button>
          </div>
        </div>
        <textarea
          id="studio-prompt-draft"
          className="iv-input"
          rows={6}
          value={draftText}
          data-studio-draft="true"
          placeholder={t('studioDraftPlaceholder')}
          onChange={event => { setDraftText(event.target.value) }}
        />
        {segments.length === 0
          ? null
          : (
              <details className="iv-advanced" data-studio-segments="true">
                <summary className="iv-advanced-head">
                  <span className="iv-advanced-title">{t('studioSegments').replace('{n}', String(segments.length))}</span>
                  <Icon className="iv-advanced-caret" name="chevron" size={10} />
                </summary>
                <div className="iv-advanced-body">
                  {segments.map((piece, index) => (
                    <div className="iv-studio-seg-row" key={`${piece.path}:${index}`} data-studio-segment={piece.path}>
                      <span className="iv-ellipsis" title={piece.text}>{fileName(piece.path)}</span>
                      <button
                        type="button"
                        className="iv-btn iv-btn--icon iv-btn--sm"
                        data-studio-segment-drop={index}
                        aria-label={`${t('studioSegmentDrop')} ${fileName(piece.path)}`}
                        title={t('studioSegmentDrop')}
                        onClick={() => { dropSegment(index) }}
                      >
                        <Icon name="x" size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
      </div>
      <div className="iv-studio-actions">
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

      <details className="iv-advanced" open data-studio-library="true">
        <summary className="iv-advanced-head">
          <span className="iv-advanced-title">{t('studioPromptLibrary')}</span>
          <span className="iv-advanced-defaults">
            {prompts.length === 0 ? '' : t('studioPromptCount').replace('{n}', String(prompts.length))}
          </span>
          <Icon className="iv-advanced-caret" name="chevron" size={10} />
        </summary>
        <div className="iv-advanced-body">
          {prompts.length === 0
            ? <span className="iv-meta" data-studio-library-empty="true">{t('studioPromptEmpty')}</span>
            : prompts.map(prompt => (
                <div className="iv-prompt-row" key={prompt.id} data-studio-prompt={prompt.id}>
                  <button
                    type="button"
                    className="iv-studio-prompt-name"
                    data-studio-prompt-load={prompt.id}
                    aria-label={`${t('studioPromptLoad')} ${prompt.name}`}
                    title={`${t('studioPromptLoad')} · ${prompt.text}`}
                    onClick={() => { loadPrompt(prompt) }}
                  >
                    <span className="iv-ellipsis">{prompt.name}</span>
                  </button>
                  <button
                    type="button"
                    className="iv-btn iv-btn--ghost iv-btn--sm"
                    data-studio-prompt-apply={prompt.id}
                    onClick={() => {
                      loadPrompt(prompt)
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
          {removedPrompt === null
            ? null
            : (
                <div className="iv-studio-undo" data-studio-undo="true">
                  <span className="iv-meta">{t('studioRemoved').replace('{name}', removedPrompt.name)}</span>
                  <button
                    type="button"
                    className="iv-btn iv-btn--ghost iv-btn--sm"
                    data-studio-undo-remove="true"
                    onClick={() => { void undoRemove() }}
                  >
                    <Icon name="undo" size={11} />{t('studioUndoRemove')}
                  </button>
                </div>
              )}
        </div>
      </details>

      <details className="iv-advanced" data-studio-storyboards="true">
        <summary className="iv-advanced-head">
          <span className="iv-advanced-title">{t('studioStoryboard')}</span>
          <span className="iv-advanced-defaults">{shotCount === 0 ? '' : String(shotCount)}</span>
          <Icon className="iv-advanced-caret" name="chevron" size={10} />
        </summary>
        <div className="iv-advanced-body">
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
      </details>
    </div>
  )
}
