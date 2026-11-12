/**
 * 提示词·分镜页：把本集素材（最多 8 张图）经逆向 Skill 提取为可编辑提示词，
 * 并存入本集提示词库；同屏还列出本集分镜的逐镜提示词，便于直接带入生成。
 *
 * 输入源是本集素材与全局素材的统一入口：素材库为全局，集里只存引用，
 * 因此这里直接按图片过滤全局素材，选中项按文件路径去重。
 */
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { WorkbenchApi, ExtractedPrompt, PromptRecord } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'
import type { AssetRecord } from '../../workbench/records.ts'
import type { EpisodeRecord } from '../../workbench/episodes.ts'
import type { SkillRecord } from '../../workbench/skills.ts'

/** 统一输入源上限（图）。 */
export const MAX_STUDIO_IMAGES = 8

export interface PromptStudioPanelProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly projectId: string
  readonly episode: EpisodeRecord | undefined
  /** 全局素材库（本集素材也在这里，集里只存 id）。 */
  readonly assets: readonly AssetRecord[]
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

export function PromptStudioPanel(props: PromptStudioPanelProps) {
  const { api, t, projectId, episode, assets, onNotice, onApplyPrompt } = props
  const [skills, setSkills] = useState<readonly SkillRecord[]>([])
  const [skillId, setSkillId] = useState('')
  const [selected, setSelected] = useState<readonly string[]>([])
  const [draftName, setDraftName] = useState('')
  const [draftText, setDraftText] = useState('')
  const [prompts, setPrompts] = useState<readonly PromptRecord[]>([])
  const [busy, setBusy] = useState(false)
  const episodeIdRef = useRef(episode?.id)
  episodeIdRef.current = episode?.id

  /** 只取图片素材；视频逆向留给后续适配器，避免把不支持的输入交给视觉模型。 */
  const images = assets.filter(asset => asset.kind === 'image')

  /** 读取启用的逆向 Skill 与本集提示词。 */
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

  /** 选择 / 取消一张输入图；超过上限时如实提示。 */
  const toggleImage = (path: string): void => {
    if (selected.includes(path)) {
      setSelected(selected.filter(candidate => candidate !== path))
      return
    }
    if (selected.length >= MAX_STUDIO_IMAGES) {
      onNotice(t('studioSourceLimit').replace('{n}', String(MAX_STUDIO_IMAGES)), 'error')
      return
    }
    setSelected([...selected, path])
  }

  /** 逐张调用视觉适配器，把结果拼成一段可编辑提示词。 */
  const extract = async (): Promise<void> => {
    if (selected.length === 0) return
    setBusy(true)
    try {
      const pieces: string[] = []
      for (const path of selected) {
        pieces.push(promptText(await api.extractPrompt({
          path,
          ...skillId === '' ? {} : { skillId },
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

  return (
    <div className="iv-prompt-studio" data-prompt-studio="true">
      <div className="iv-fusion-head">
        <span className="iv-chip"><Icon name="sparkles" size={11} />{t('studioTitle')}</span>
        <span className="iv-meta">{t('studioDesc')}</span>
      </div>

      <label className="iv-sb-field">
        <span className="iv-meta">{t('studioSkillLabel')}</span>
        <select
          className="iv-select"
          data-studio-skill="true"
          value={skillId}
          onChange={event => { setSkillId(event.target.value) }}
        >
          <option value="">{t('studioSkillDefault')}</option>
          {skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
        </select>
      </label>

      <div className="iv-studio-sources">
        <span className="iv-meta">
          {t('studioSources')}（{selected.length}/{MAX_STUDIO_IMAGES}）
        </span>
        <span className="iv-meta">{t('studioSourcesHint')}</span>
        <div className="iv-studio-grid" data-studio-sources="true">
          {images.length === 0
            ? <span className="iv-meta" data-studio-sources-empty="true">{t('studioSourcesEmpty')}</span>
            : images.map(asset => {
                const active = selected.includes(asset.path)
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={`iv-studio-thumb${active ? ' iv-studio-thumb--on' : ''}`}
                    data-studio-image={asset.id}
                    data-studio-active={active ? 'true' : 'false'}
                    title={fileName(asset.path)}
                    aria-pressed={active}
                    onClick={() => { toggleImage(asset.path) }}
                  >
                    <img src={`/outputs/${encodeURIComponent(fileName(asset.path))}`} alt={fileName(asset.path)} loading="lazy" />
                    <span className="iv-studio-order">{active ? selected.indexOf(asset.path) + 1 : ''}</span>
                  </button>
                )
              })}
        </div>
        <div className="iv-row">
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
