/**
 * 本集工作区：剧本 → 分段 → 分镜（集重构 M2）。
 *
 * 数据全部经注入的 `api` 落库；本组件只做「编辑 → 保存」的编排，不复制宿主的校验：
 * 时长越界、空提示词等非法输入由宿主拒绝并原样展示，界面不静默修正。
 * 引用只存 `{kind,id}`，顺序号即正文 `[@n]`。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../icons.tsx'
import type { WorkbenchApi } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'
import type { AssetRecord, ResourceRecord } from '../../workbench/records.ts'
import { newWorkbenchId } from '../../workbench/records.ts'
import {
  episodeDurationSec, MAX_SEGMENT_DURATION_SEC, MIN_SEGMENT_DURATION_SEC, SEGMENT_DURATION_PRESETS,
} from '../../workbench/episodes.ts'
import type {
  EpisodeRecord, SegmentPatch, SegmentRecord, SegmentRef, ShotRecord, StoryboardRecord,
} from '../../workbench/episodes.ts'
import type { SkillRecord } from '../../workbench/skills.ts'
import type { WorkbenchOptions } from '../../workbench-contract.ts'

export interface EpisodeWorkspaceProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly projectId: string
  readonly episode: EpisodeRecord
  /** 剧集资源库（引用选择器的来源）。 */
  readonly resources: readonly ResourceRecord[]
  /** 全局素材库（引用选择器的来源）。 */
  readonly assets: readonly AssetRecord[]
  readonly options: WorkbenchOptions | undefined
  /** 导演库里启用中的技能（分段的 Skill 选择器）。 */
  readonly skills: readonly SkillRecord[]
  /** 模块级选中的文本模型（自动拆段用）；`undefined` 表示宿主没有可用模型。 */
  readonly textModel: { readonly provider: string; readonly model: string } | undefined
  /** 新分段继承的默认值（模块级的图像模型 / 视频模型 / 导演 Skill）。 */
  readonly defaults: {
    readonly imageModel?: string
    readonly videoModel?: string
    readonly skillId?: string
  }
  /** 集记录在宿主侧变化后刷新（剧本、分段、分镜都走这里）。 */
  readonly onEpisodeChanged: () => Promise<void>
  /** 生成了新素材 / 新任务后刷新素材库与任务列表。 */
  readonly onMediaGenerated: () => Promise<void>
  readonly onNotice: (text: string, tone: 'info' | 'error') => void
}

/** 保存状态 → chip 样式。 */
function saveChipClass(state: 'saved' | 'dirty' | 'saving' | 'failed'): string {
  switch (state) {
    case 'saved': return 'iv-chip iv-chip--ok'
    case 'saving': return 'iv-chip iv-chip--run'
    case 'dirty': return 'iv-chip iv-chip--warn'
    case 'failed': return 'iv-chip iv-chip--err'
  }
}

/** 文件路径 → 文件名（素材引用没有名字，用文件名标识）。 */
function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

/** 引用项重排：移动一项并重编号 1..n。 */
function moveRef(refs: readonly SegmentRef[], index: number, delta: number): SegmentRef[] {
  const target = index + delta
  if (target < 0 || target >= refs.length) return [...refs]
  const next = [...refs]
  const [moved] = next.splice(index, 1)
  if (moved === undefined) return [...refs]
  next.splice(target, 0, moved)
  return next.map((ref, position) => ({ ...ref, order: position + 1 }))
}

/** 镜头重排：移动一项并重编号 1..n。 */
function moveShot(shots: readonly ShotRecord[], index: number, delta: number): ShotRecord[] {
  const target = index + delta
  if (target < 0 || target >= shots.length) return [...shots]
  const next = [...shots]
  const [moved] = next.splice(index, 1)
  if (moved === undefined) return [...shots]
  next.splice(target, 0, moved)
  return next.map((shot, position) => ({ ...shot, order: position + 1 }))
}

/** 一排引用 chips：顺序号 + `[@n]` 插入按钮 + 上移/下移/移除。 */
function refChips(
  props: {
    readonly refs: readonly SegmentRef[]
    readonly owner: string
    readonly t: (key: WorkbenchLocaleKey) => string
    readonly label: (ref: SegmentRef) => string
    readonly onChange: (next: SegmentRef[]) => void
    readonly onInsert: ((order: number) => void) | undefined
  },
) {
  const { refs, owner, t, label, onChange, onInsert } = props
  if (refs.length === 0) return <span className="iv-meta">{t('segmentRefsEmpty')}</span>
  return (
    <ul className="iv-ref-list">
      {refs.map((ref, index) => (
        <li className="iv-ref-chip" key={`${ref.kind}:${ref.id}`} data-ref-chip={ref.id} data-ref-owner={owner}>
          <span className="iv-ref-order">{index + 1}</span>
          {onInsert === undefined ? null : (
            <button
              type="button"
              className="iv-ref-open"
              data-ref-token={index + 1}
              title={t('refInsertToken').replace('{n}', String(index + 1))}
              onClick={() => { onInsert(index + 1) }}
            >
              [@{index + 1}]
            </button>
          )}
          <span className="iv-ellipsis" title={label(ref)}>{label(ref)}</span>
          <button
            type="button"
            className="iv-btn iv-btn--icon iv-btn--sm iv-ref-move iv-ref-move--up"
            aria-label={t('moveUp')}
            data-ref-up={index}
            disabled={index === 0}
            onClick={() => { onChange(moveRef(refs, index, -1)) }}
          >
            <Icon name="chevron" size={11} />
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--icon iv-btn--sm iv-ref-move iv-ref-move--down"
            aria-label={t('moveDown')}
            data-ref-down={index}
            disabled={index === refs.length - 1}
            onClick={() => { onChange(moveRef(refs, index, 1)) }}
          >
            <Icon name="chevron" size={11} />
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--icon iv-btn--sm"
            aria-label={`${t('segmentRemove')} ${label(ref)}`}
            data-ref-remove={index}
            onClick={() => { onChange(refs.filter((_, position) => position !== index)) }}
          >
            <Icon name="trash" size={11} />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function EpisodeWorkspace(props: EpisodeWorkspaceProps) {
  const { api, t, projectId, episode, resources, assets, options, skills, textModel, defaults, onEpisodeChanged, onMediaGenerated, onNotice } = props

  const [scriptDraft, setScriptDraft] = useState(episode.script.text)
  const [scriptSavedText, setScriptSavedText] = useState(episode.script.text)
  const [scriptState, setScriptState] = useState<'saved' | 'dirty' | 'saving' | 'failed'>('saved')
  const [segments, setSegments] = useState<readonly SegmentRecord[]>(episode.segments)
  const [storyboards, setStoryboards] = useState<readonly StoryboardRecord[]>(episode.storyboards)
  const [busy, setBusy] = useState(false)
  /** 自动拆段进行中：与单段保存互斥，避免模型跑着时用户又新建分段。 */
  const [splitting, setSplitting] = useState(false)
  const [planningId, setPlanningId] = useState<string | undefined>(undefined)
  const [generatingShotId, setGeneratingShotId] = useState<string | undefined>(undefined)
  /** 宿主最后确认过的分段；脚本/分段被父级刷新时用来避免覆盖正在输入的内容。 */
  const savedSegments = useRef(new Map<string, SegmentRecord>())
  const episodeIdRef = useRef(episode.id)
  const scriptStateRef = useRef(scriptState)
  const handlersRef = useRef({ onEpisodeChanged, onNotice, t })

  useEffect(() => {
    handlersRef.current = { onEpisodeChanged, onNotice, t }
  }, [onEpisodeChanged, onNotice, t])

  useEffect(() => { scriptStateRef.current = scriptState }, [scriptState])

  /** 宿主记录变化（保存成功后的刷新）→ 本地列表跟随；正在输入的剧本不被覆盖。 */
  useEffect(() => {
    const switched = episodeIdRef.current !== episode.id
    episodeIdRef.current = episode.id
    setSegments(episode.segments)
    setStoryboards(episode.storyboards)
    savedSegments.current = new Map(episode.segments.map(segment => [segment.id, segment]))
    if (switched || scriptStateRef.current === 'saved') {
      setScriptDraft(episode.script.text)
      setScriptSavedText(episode.script.text)
    }
  }, [episode])

  /** 剧本自动保存；父级轮询引起的重渲染不会重启计时器（依赖只含正文本体）。 */
  const saveScript = useCallback(async (text: string): Promise<void> => {
    const { onEpisodeChanged: refresh, onNotice: notify, t: translate } = handlersRef.current
    setScriptState('saving')
    try {
      await api.updateEpisode(episode.id, { script: { text } })
      setScriptSavedText(text)
      setScriptState('saved')
      await refresh()
    } catch (error) {
      setScriptState('failed')
      notify(`${translate('episodeScriptFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }, [api, episode.id])

  useEffect(() => {
    if (scriptDraft === scriptSavedText) return
    setScriptState('dirty')
    const timer = window.setTimeout(() => { void saveScript(scriptDraft) }, 900)
    return () => { window.clearTimeout(timer) }
  }, [scriptDraft, scriptSavedText, saveScript])

  /** 剧本失焦立即保存，避免用户改完就离开时等不到防抖。 */
  const flushScript = (): void => {
    const text = scriptDraft
    if (text === scriptSavedText || scriptState === 'saving') return
    void saveScript(text)
  }

  /** 本地替换一条分段（保存成功后的回填）。 */
  const applySegment = (saved: SegmentRecord): void => {
    savedSegments.current.set(saved.id, saved)
    setSegments(current => current.map(segment => (segment.id === saved.id ? saved : segment)))
  }

  /** 本地改一条分段（未保存）。 */
  const patchSegment = (next: SegmentRecord): void => {
    setSegments(current => current.map(segment => (segment.id === next.id ? next : segment)))
  }

  /**
   * 保存一条分段：整条回写（宿主负责校验），成功后刷新集记录。
   * @param next - 本地编辑后的分段。
   * @param extra - 需要一并提交的额外字段（如移动后的顺序号）。
   */
  const commitSegment = async (next: SegmentRecord, extra: SegmentPatch = {}): Promise<void> => {
    setBusy(true)
    try {
      const saved = await api.updateSegment(next.id, {
        promptText: next.promptText,
        durationSec: next.durationSec,
        imageModel: next.imageModel ?? '',
        videoModel: next.videoModel ?? '',
        skillId: next.skillId ?? '',
        refs: next.refs.map((ref, position) => ({ ...ref, order: position + 1 })),
        ...extra,
      })
      applySegment(saved)
      await onEpisodeChanged()
    } catch (error) {
      onNotice(`${t('segmentSaveFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  /** 新分段继承的模块级选择；空串表示"不指定"，交给宿主默认值。 */
  const inherited = (): { imageModel?: string; videoModel?: string; skillId?: string } => ({
    ...defaults.imageModel === undefined || defaults.imageModel === '' ? {} : { imageModel: defaults.imageModel },
    ...defaults.videoModel === undefined || defaults.videoModel === '' ? {} : { videoModel: defaults.videoModel },
    ...defaults.skillId === undefined || defaults.skillId === '' ? {} : { skillId: defaults.skillId },
  })

  /** 新建分段：追加到集末尾，并默认选中它。 */
  const addSegment = async (): Promise<void> => {
    setBusy(true)
    try {
      await api.createSegment(episode.id, inherited())
      await onEpisodeChanged()
    } catch (error) {
      onNotice(`${t('segmentAddFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  /**
   * 自动拆段：把当前剧本（含未保存的输入）交给所选文本模型，按剧情拆成若干分段。
   *
   * 拆段与落库都在宿主侧一次完成；失败时已新建的分段仍然存在，因此先尽力刷新再报错。
   */
  const autoSplit = async (): Promise<void> => {
    if (textModel === undefined) {
      onNotice(t('scriptSplitNeedsModel'), 'error')
      return
    }
    if (scriptDraft.trim() === '') {
      onNotice(t('scriptSplitNeedsScript'), 'error')
      return
    }
    setSplitting(true)
    try {
      const result = await api.splitEpisode({
        episodeId: episode.id,
        provider: textModel.provider,
        model: textModel.model,
        script: scriptDraft,
        ...inherited(),
      })
      await onEpisodeChanged()
      onNotice(t('scriptSplitDone').replace('{n}', String(result.created.length)), 'info')
    } catch (error) {
      // 拆段可能已经落了部分分段：刷新让界面与宿主一致，刷新自身失败不覆盖原始错误
      await onEpisodeChanged().catch(() => { /* 下一次轮询会补上 */ })
      onNotice(`${t('scriptSplitFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setSplitting(false)
    }
  }

  /** 按上下移一格：提交整组顺序，宿主重编号。 */
  const moveSegment = async (segment: SegmentRecord, delta: number): Promise<void> => {
    const index = segments.findIndex(candidate => candidate.id === segment.id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= segments.length) return
    const order = [...segments]
    const [moved] = order.splice(index, 1)
    if (moved === undefined) return
    order.splice(target, 0, moved)
    setBusy(true)
    try {
      await api.reorderSegments(episode.id, order.map(candidate => candidate.id))
      await onEpisodeChanged()
    } catch (error) {
      onNotice(`${t('segmentSaveFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  /** 删除分段（宿主会级联删掉它的分镜）。 */
  const removeSegment = async (segment: SegmentRecord): Promise<void> => {
    setBusy(true)
    try {
      await api.removeSegment(segment.id)
      await onEpisodeChanged()
    } catch (error) {
      onNotice(`${t('segmentRemoveFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  /** 剧集资源 / 全局素材的可用引用（名称用于 chip 展示）。 */
  const labelOf = (ref: SegmentRef): string => {
    if (ref.kind === 'resource') {
      return resources.find(resource => resource.id === ref.id)?.name ?? `${t('episodeRefMissing')} · ${ref.id}`
    }
    const asset = assets.find(candidate => candidate.id === ref.id)
    return asset === undefined ? `${t('episodeRefMissing')} · ${ref.id}` : fileName(asset.path)
  }

  /** 按镜引用选择器：剧集资源 + 全局素材（图片/视频），排除本镜已引用的。 */
  const shotRefOptions = (used: readonly SegmentRef[]): ReadonlyArray<{ kind: SegmentRef['kind']; id: string; label: string }> => {
    const usedIds = new Set(used.map(ref => `${ref.kind}:${ref.id}`))
    return [
      ...episode.resourceRefs
        .filter(ref => !usedIds.has(`resource:${ref.resourceId}`))
        .map(ref => ({ kind: 'resource' as const, id: ref.resourceId, label: labelOf({ kind: 'resource', id: ref.resourceId, order: 1 }) })),
      ...assets
        .filter(asset => !usedIds.has(`asset:${asset.id}`))
        .map(asset => ({ kind: 'asset' as const, id: asset.id, label: `${fileName(asset.path)} · ${asset.kind}` })),
    ]
  }

  /** 集里已选的两类引用 → 分段引用选择器（排除已经引用的）。 */
  const refOptions = (used: readonly SegmentRef[]): ReadonlyArray<{ kind: SegmentRef['kind']; id: string; label: string }> => {
    const usedIds = new Set(used.map(ref => `${ref.kind}:${ref.id}`))
    const resourceOptions = episode.resourceRefs
      .filter(ref => !usedIds.has(`resource:${ref.resourceId}`))
      .map(ref => ({ kind: 'resource' as const, id: ref.resourceId, label: labelOf({ kind: 'resource', id: ref.resourceId, order: 1 }) }))
    const assetOptions = episode.assetRefs
      .filter(ref => !usedIds.has(`asset:${ref.assetId}`))
      .map(ref => ({ kind: 'asset' as const, id: ref.assetId, label: labelOf({ kind: 'asset', id: ref.assetId, order: 1 }) }))
    return [...resourceOptions, ...assetOptions]
  }

  /** 把 `[@n]` 追加到分段提示词（已存在则不重复追加）。 */
  const insertToken = (segment: SegmentRecord, order: number): void => {
    const mark = `[@${order}]`
    if (segment.promptText.includes(mark)) return
    const next = { ...segment, promptText: `${segment.promptText}${segment.promptText === '' ? '' : ' '}${mark}` }
    patchSegment(next)
    void commitSegment(next)
  }

  /** 分镜生成：本段提示词 → 宿主拆镜 → 落库（每镜时长按段时长均分）。 */
  const planSegment = async (segment: SegmentRecord): Promise<void> => {
    if (segment.promptText.trim() === '') {
      onNotice(t('storyboardNeedsScript'), 'error')
      return
    }
    setPlanningId(segment.id)
    try {
      const plan = await api.planStoryboard({ projectId, script: segment.promptText })
      const existing = storyboards.find(storyboard => storyboard.segmentId === segment.id)
      const shotDuration = Math.max(
        MIN_SEGMENT_DURATION_SEC,
        Math.round(segment.durationSec / Math.max(1, plan.shots.length)),
      )
      const shots: ShotRecord[] = plan.shots.map((shot, index) => ({
        id: newWorkbenchId('shot'),
        order: index + 1,
        durationSec: shotDuration,
        imagePrompt: shot.imagePrompt,
        videoPrompt: shot.videoPrompt,
        ...segment.imageModel === undefined ? {} : { imageModel: segment.imageModel },
        ...segment.videoModel === undefined ? {} : { videoModel: segment.videoModel },
        refs: segment.refs.map((ref, position) => ({ ...ref, order: position + 1 })),
      }))
      const saved = await api.saveStoryboard({
        ...existing === undefined ? {} : { id: existing.id },
        episodeId: episode.id,
        segmentId: segment.id,
        ...segment.skillId === undefined ? {} : { skillId: segment.skillId },
        shots,
      })
      setStoryboards(current => (existing === undefined
        ? [...current, saved]
        : current.map(storyboard => (storyboard.id === saved.id ? saved : storyboard))))
      await onEpisodeChanged()
      onNotice(t('storyboardPlanDone').replace('{n}', String(shots.length)), 'info')
    } catch (error) {
      onNotice(`${t('storyboardPlanFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setPlanningId(undefined)
    }
  }

  /** 写入一整组分镜（逐镜编辑的持久化）。 */
  const persistStoryboard = async (storyboard: StoryboardRecord): Promise<void> => {
    try {
      const saved = await api.saveStoryboard({
        id: storyboard.id,
        episodeId: episode.id,
        segmentId: storyboard.segmentId,
        ...storyboard.skillId === undefined ? {} : { skillId: storyboard.skillId },
        shots: storyboard.shots,
      })
      setStoryboards(current => current.map(candidate => (candidate.id === saved.id ? saved : candidate)))
      await onEpisodeChanged()
    } catch (error) {
      onNotice(`${t('segmentSaveFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  /** 本地改一镜（不落库；文本字段在失焦时统一保存）。 */
  const patchShotLocal = (segmentId: string, shotId: string, patch: Partial<ShotRecord>): void => {
    setStoryboards(current => current.map(storyboard => (storyboard.segmentId === segmentId
      ? { ...storyboard, shots: storyboard.shots.map(shot => (shot.id === shotId ? { ...shot, ...patch } : shot)) }
      : storyboard)))
  }

  /** 本地改一组分镜后立即落库（镜头的增删移、引用调整）。 */
  const updateStoryboard = (segmentId: string, updater: (storyboard: StoryboardRecord) => StoryboardRecord): void => {
    const current = storyboards.find(storyboard => storyboard.segmentId === segmentId)
    if (current === undefined) return
    const next = updater(current)
    setStoryboards(list => list.map(candidate => (candidate.id === current.id ? next : candidate)))
    void persistStoryboard(next)
  }

  /** 失焦时把本段分镜的本地编辑整组保存。 */
  const flushStoryboard = (segmentId: string): void => {
    const current = storyboards.find(storyboard => storyboard.segmentId === segmentId)
    if (current !== undefined) void persistStoryboard(current)
  }

  /** 就地生成一镜：图片同步返回，视频进任务列表（`wait:false`）。 */
  const generateShot = async (segment: SegmentRecord, shot: ShotRecord, mode: 'image' | 'video'): Promise<void> => {
    const prompt = (mode === 'image' ? shot.imagePrompt : shot.videoPrompt).trim()
    if (prompt === '') { onNotice(t('storyboardEmptyPrompt'), 'error'); return }
    setGeneratingShotId(shot.id)
    try {
      const result = await api.generateMedia({
        mediaMode: mode,
        prompt,
        projectId,
        episodeId: episode.id,
        segmentId: segment.id,
        shotId: shot.id,
        ...shot.imageModel === undefined || mode !== 'image' ? {} : { model: shot.imageModel },
        ...mode === 'video'
          ? { duration: shot.durationSec, wait: false, ...shot.videoModel === undefined ? {} : { model: shot.videoModel } }
          : {},
      })
      await onMediaGenerated()
      if (result.pending === true) {
        onNotice(t('shotVideoQueued').replace('{n}', String(shot.order)), 'info')
      } else {
        onNotice(t('shotImageDone').replace('{n}', String(shot.order)), 'info')
      }
    } catch (error) {
      onNotice(`${t('shotGenerateFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setGeneratingShotId(undefined)
    }
  }

  /** 一条分段的行内编辑区。 */
  const segmentBody = (segment: SegmentRecord) => {
    const storyboard = storyboards.find(candidate => candidate.segmentId === segment.id)
    const available = refOptions(segment.refs)
    const segmentOwner = `segment:${segment.id}`
    return (
      <div className="iv-sb-shot-body">
        <div className="iv-sb-row">
          <span className="iv-micro" data-segment-name={segment.id}>
            {t('segmentName').replace('{n}', String(segment.order))}
          </span>
          <button
            type="button"
            className="iv-btn iv-btn--ghost iv-btn--sm"
            data-segment-up={segment.id}
            aria-label={t('moveUp')}
            disabled={busy || segment.order <= 1}
            onClick={() => { void moveSegment(segment, -1) }}
          >
            <Icon name="chevron" size={11} className="iv-ico--up" />
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--ghost iv-btn--sm"
            data-segment-down={segment.id}
            aria-label={t('moveDown')}
            disabled={busy || segment.order >= segments.length}
            onClick={() => { void moveSegment(segment, 1) }}
          >
            <Icon name="chevron" size={11} />
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--icon iv-btn--sm"
            data-segment-remove={segment.id}
            aria-label={t('segmentRemove')}
            title={t('segmentRemove')}
            disabled={busy}
            onClick={() => { void removeSegment(segment) }}
          >
            <Icon name="trash" size={11} />
          </button>
        </div>
        <label className="iv-sb-field">
          <span className="iv-meta">{t('segmentPromptLabel')}</span>
          <textarea
            className="iv-input"
            rows={3}
            value={segment.promptText}
            placeholder={t('segmentPromptPlaceholder')}
            data-segment-prompt={segment.id}
            disabled={busy}
            onChange={event => { patchSegment({ ...segment, promptText: event.target.value }) }}
            onBlur={() => { void commitSegment(segment) }}
            style={{ resize: 'vertical', font: 'inherit', padding: '6px 8px', borderRadius: '6px' }}
          />
        </label>
        <div className="iv-sb-row">
          <span className="iv-meta">{t('segmentDurationLabel')}</span>
          {SEGMENT_DURATION_PRESETS.map(seconds => (
            <button
              type="button"
              className="iv-btn iv-btn--ghost iv-btn--sm"
              key={seconds}
              data-segment-duration={String(seconds)}
              disabled={busy}
              onClick={() => {
                const next = { ...segment, durationSec: seconds }
                patchSegment(next)
                void commitSegment(next, { durationSec: seconds })
              }}
            >
              {seconds}s
            </button>
          ))}
          <input
            className="iv-input"
            type="number"
            min={MIN_SEGMENT_DURATION_SEC}
            max={MAX_SEGMENT_DURATION_SEC}
            value={segment.durationSec}
            data-segment-duration-input={segment.id}
            disabled={busy}
            onChange={event => { patchSegment({ ...segment, durationSec: Number(event.target.value) }) }}
            onBlur={() => {
              const clamped = Math.min(MAX_SEGMENT_DURATION_SEC, Math.max(MIN_SEGMENT_DURATION_SEC, Math.round(segment.durationSec)))
              const next = { ...segment, durationSec: clamped }
              patchSegment(next)
              void commitSegment(next, { durationSec: clamped })
            }}
            style={{ width: '72px', font: 'inherit', padding: '4px 6px', borderRadius: '6px' }}
          />
          <label className="iv-sb-field" style={{ flex: '0 1 130px' }}>
            <span className="iv-meta">{t('generateImageModel')}</span>
            <select
              className="iv-input"
              value={segment.imageModel ?? ''}
              data-segment-image-model={segment.id}
              disabled={busy}
              onChange={event => {
                const next = { ...segment, imageModel: event.target.value === '' ? undefined : event.target.value }
                patchSegment(next)
                void commitSegment(next)
              }}
            >
              <option value="">{t('generateParamAuto')}</option>
              {(options?.imageProviders ?? []).map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <label className="iv-sb-field" style={{ flex: '0 1 130px' }}>
            <span className="iv-meta">{t('generateVideoModel')}</span>
            <select
              className="iv-input"
              value={segment.videoModel ?? ''}
              data-segment-video-model={segment.id}
              disabled={busy}
              onChange={event => {
                const next = { ...segment, videoModel: event.target.value === '' ? undefined : event.target.value }
                patchSegment(next)
                void commitSegment(next)
              }}
            >
              <option value="">{t('generateParamAuto')}</option>
              {(options?.videoProviders ?? []).map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <label className="iv-sb-field" style={{ flex: '0 1 130px' }}>
            <span className="iv-meta">{t('segmentSkillLabel')}</span>
            <select
              className="iv-input"
              value={segment.skillId ?? ''}
              data-segment-skill={segment.id}
              disabled={busy}
              title={t('segmentSkillHint')}
              onChange={event => {
                const next = { ...segment, skillId: event.target.value === '' ? undefined : event.target.value }
                patchSegment(next)
                void commitSegment(next)
              }}
            >
              <option value="">{t('segmentSkillDefault')}</option>
              {skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
              {segment.skillId === undefined || skills.some(skill => skill.id === segment.skillId)
                ? null
                : <option value={segment.skillId}>{`${segment.skillId} · ${t('segmentSkillMissing')}`}</option>}
            </select>
          </label>
        </div>
        <div className="iv-sb-field">
          <span className="iv-meta">{t('segmentRefsLabel')}</span>
          {refChips({
            refs: segment.refs,
            owner: segmentOwner,
            t,
            label: labelOf,
            onChange: next => {
              const updated = { ...segment, refs: next }
              patchSegment(updated)
              void commitSegment(updated)
            },
            onInsert: order => insertToken(segment, order),
          })}
          {available.length === 0 ? null : (
            <select
              className="iv-input"
              value=""
              data-segment-ref-add={segment.id}
              disabled={busy}
              onChange={event => {
                const picked = available.find(option => `${option.kind}:${option.id}` === event.target.value)
                if (picked === undefined) return
                const next = [...segment.refs, { kind: picked.kind, id: picked.id, order: segment.refs.length + 1 }]
                const updated = { ...segment, refs: next }
                patchSegment(updated)
                void commitSegment(updated)
              }}
              style={{ maxWidth: '220px' }}
            >
              <option value="">{t('segmentAddRef')}</option>
              <optgroup label={t('segmentRefResources')}>
                {available.filter(option => option.kind === 'resource').map(option => (
                  <option key={`resource:${option.id}`} value={`resource:${option.id}`}>{option.label}</option>
                ))}
              </optgroup>
              <optgroup label={t('segmentRefAssets')}>
                {available.filter(option => option.kind === 'asset').map(option => (
                  <option key={`asset:${option.id}`} value={`asset:${option.id}`}>{option.label}</option>
                ))}
              </optgroup>
            </select>
          )}
        </div>
        <div className="iv-sb-actions">
          <button
            type="button"
            className={`iv-btn iv-btn--acc${planningId === segment.id ? ' iv-btn--busy' : ''}`}
            data-segment-plan={segment.id}
            aria-busy={planningId === segment.id ? 'true' : undefined}
            disabled={planningId === segment.id || busy || segment.promptText.trim() === ''}
            onClick={() => { void planSegment(segment) }}
          >
            <Icon name="sparkles" size={11} />
            {planningId === segment.id ? t('storyboardPlanning') : t('segmentStoryboardPlan')}
          </button>
        </div>
        {storyboard === undefined
          ? <div className="iv-empty" data-segment-storyboard-empty={segment.id}>{t('segmentStoryboardNone')}</div>
          : (
            <div className="iv-sb-list" data-segment-storyboard={segment.id}>
              {storyboard.shots.map((shot, index) => (
                <div className="iv-sb-shot" key={shot.id} data-shot={shot.id}>
                  <span className="iv-sb-shot-index">{shot.order}</span>
                  <div className="iv-sb-shot-body">
                    <div className="iv-sb-row">
                      <span className="iv-micro">{t('shotName').replace('{n}', String(shot.order))}</span>
                      <label className="iv-sb-field" style={{ flex: '0 0 90px' }}>
                        <span className="iv-meta">{t('segmentDurationLabel')}</span>
                        <input
                          className="iv-input"
                          type="number"
                          min={MIN_SEGMENT_DURATION_SEC}
                          max={MAX_SEGMENT_DURATION_SEC}
                          value={shot.durationSec}
                          data-shot-duration={shot.id}
                          onChange={event => { patchShotLocal(segment.id, shot.id, { durationSec: Number(event.target.value) }) }}
                          onBlur={() => { flushStoryboard(segment.id) }}
                          style={{ font: 'inherit', padding: '4px 6px', borderRadius: '6px' }}
                        />
                      </label>
                      <button
                        type="button"
                        className="iv-btn iv-btn--sm"
                        data-shot-generate-image={shot.id}
                        disabled={generatingShotId === shot.id}
                        onClick={() => { void generateShot(segment, shot, 'image') }}
                      >
                        <Icon name="image" size={11} />{t('shotGenerateImage')}
                      </button>
                      <button
                        type="button"
                        className="iv-btn iv-btn--sm"
                        data-shot-generate-video={shot.id}
                        disabled={generatingShotId === shot.id}
                        onClick={() => { void generateShot(segment, shot, 'video') }}
                      >
                        <Icon name="video" size={11} />{generatingShotId === shot.id ? t('shotGenerating') : t('shotGenerateVideo')}
                      </button>
                      <button
                        type="button"
                        className="iv-btn iv-btn--icon iv-btn--sm"
                        aria-label={t('storyboardMoveUp')}
                        data-shot-up={shot.id}
                        disabled={index === 0}
                        onClick={() => {
                          updateStoryboard(segment.id, current => ({ ...current, shots: moveShot(current.shots, index, -1) }))
                        }}
                      >
                        <Icon name="chevron" size={11} className="iv-ico--up" />
                      </button>
                      <button
                        type="button"
                        className="iv-btn iv-btn--icon iv-btn--sm"
                        aria-label={t('storyboardMoveDown')}
                        data-shot-down={shot.id}
                        disabled={index === storyboard.shots.length - 1}
                        onClick={() => {
                          updateStoryboard(segment.id, current => ({ ...current, shots: moveShot(current.shots, index, 1) }))
                        }}
                      >
                        <Icon name="chevron" size={11} />
                      </button>
                      <button
                        type="button"
                        className="iv-btn iv-btn--icon iv-btn--sm"
                        aria-label={t('storyboardRemoveShot')}
                        data-shot-remove={shot.id}
                        onClick={() => {
                          updateStoryboard(segment.id, current => ({
                            ...current,
                            shots: current.shots
                              .filter(candidate => candidate.id !== shot.id)
                              .map((candidate, position) => ({ ...candidate, order: position + 1 })),
                          }))
                        }}
                      >
                        <Icon name="trash" size={11} />
                      </button>
                    </div>
                    <label className="iv-sb-field">
                      <span className="iv-meta">{t('storyboardImagePromptLabel')}</span>
                      <textarea
                        className="iv-input"
                        rows={2}
                        value={shot.imagePrompt}
                        data-shot-image-prompt={shot.id}
                        onChange={event => { patchShotLocal(segment.id, shot.id, { imagePrompt: event.target.value }) }}
                        onBlur={() => { flushStoryboard(segment.id) }}
                        style={{ resize: 'vertical', font: 'inherit', padding: '4px 6px', borderRadius: '6px' }}
                      />
                    </label>
                    <label className="iv-sb-field">
                      <span className="iv-meta">{t('storyboardVideoPromptLabel')}</span>
                      <textarea
                        className="iv-input"
                        rows={2}
                        value={shot.videoPrompt}
                        data-shot-video-prompt={shot.id}
                        onChange={event => { patchShotLocal(segment.id, shot.id, { videoPrompt: event.target.value }) }}
                        onBlur={() => { flushStoryboard(segment.id) }}
                        style={{ resize: 'vertical', font: 'inherit', padding: '4px 6px', borderRadius: '6px' }}
                      />
                    </label>
                    {refChips({
                      refs: shot.refs,
                      owner: `shot:${shot.id}`,
                      t,
                      label: labelOf,
                      onChange: next => {
                        updateStoryboard(segment.id, current => ({
                          ...current,
                          shots: current.shots.map(candidate => (candidate.id === shot.id ? { ...candidate, refs: next } : candidate)),
                        }))
                      },
                      onInsert: undefined,
                    })}
                    <select
                      className="iv-input"
                      value=""
                      data-shot-ref-add={shot.id}
                      aria-label={t('shotRefAdd')}
                      onChange={event => {
                        const options = shotRefOptions(shot.refs)
                        const picked = options.find(option => `${option.kind}:${option.id}` === event.target.value)
                        if (picked === undefined) return
                        const next = [...shot.refs, { kind: picked.kind, id: picked.id, order: shot.refs.length + 1 }]
                        updateStoryboard(segment.id, current => ({
                          ...current,
                          shots: current.shots.map(candidate => (candidate.id === shot.id ? { ...candidate, refs: next } : candidate)),
                        }))
                      }}
                      style={{ maxWidth: '240px' }}
                    >
                      <option value="">{t('shotRefAdd')}</option>
                      {shotRefOptions(shot.refs).map(option => (
                        <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <div className="iv-sb-actions">
                <button
                  type="button"
                  className="iv-btn iv-btn--ghost iv-btn--sm"
                  data-shot-add={segment.id}
                  onClick={() => {
                    updateStoryboard(segment.id, current => ({
                      ...current,
                      shots: [...current.shots, {
                        id: newWorkbenchId('shot'),
                        order: current.shots.length + 1,
                        durationSec: segment.durationSec,
                        imagePrompt: '',
                        videoPrompt: '',
                        refs: [],
                      }],
                    }))
                  }}
                >
                  <Icon name="plus" size={11} />{t('storyboardAddShot')}
                </button>
                <button
                  type="button"
                  className="iv-btn iv-btn--ghost iv-btn--sm"
                  data-storyboard-save={segment.id}
                  onClick={() => { void persistStoryboard(storyboard) }}
                >
                  <Icon name="check" size={11} />{t('storyboardSave')}
                </button>
              </div>
            </div>
          )}
      </div>
    )
  }

  return (
    <section className="iv-sb" data-episode-workspace={episode.id}>
      <div className="iv-sb-head">
        <span className="iv-chip"><Icon name="storyboard" size={11} />{t('episodeWorkspaceTitle')}</span>
        <span className="iv-meta" data-episode-duration="true">
          {t('episodeTotalDuration').replace('{n}', String(episodeDurationSec(segments)))}
        </span>
        <span className={saveChipClass(scriptState)} data-episode-script-state={scriptState}>
          {t(scriptState === 'saved'
            ? 'episodeScriptSaved'
            : scriptState === 'saving'
              ? 'episodeScriptSaving'
              : scriptState === 'failed' ? 'episodeScriptFailed' : 'episodeScriptDirty')}
        </span>
      </div>
      <label className="iv-sb-field">
        <span className="iv-meta">{t('storyboardScriptLabel')}</span>
        <textarea
          className="iv-input"
          rows={4}
          value={scriptDraft}
          placeholder={t('storyboardScriptPlaceholder')}
          data-episode-script="true"
          onChange={event => { setScriptDraft(event.target.value) }}
          onBlur={flushScript}
          style={{ resize: 'vertical', font: 'inherit', padding: '6px 8px', borderRadius: '6px' }}
        />
      </label>
      <div className="iv-sb-head">
        <span className="iv-micro">{t('segmentTitle')}</span>
        <span className="iv-sb-count">
          <button
            type="button"
            className="iv-btn iv-btn--ghost iv-btn--sm"
            data-segment-auto="true"
            disabled={busy || splitting || textModel === undefined || scriptDraft.trim() === ''}
            title={textModel === undefined ? t('scriptSplitNeedsModel') : t('scriptSplitHint')}
            onClick={() => { void autoSplit() }}
          >
            <Icon name="sparkles" size={11} />{splitting ? t('scriptSplitting') : t('scriptSplit')}
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--ghost iv-btn--sm"
            data-segment-add="true"
            disabled={busy || splitting}
            onClick={() => { void addSegment() }}
          >
            <Icon name="plus" size={11} />{t('segmentAdd')}
          </button>
        </span>
      </div>
      <div className="iv-row" data-episode-actions="true">
        <button
          type="button"
          className="iv-btn iv-btn--ghost iv-btn--sm"
          data-episode-sync-workflow="true"
          disabled={busy || storyboards.length === 0}
          onClick={() => {
            void (async () => {
              setBusy(true)
              try {
                const workflow = await api.syncEpisodeWorkflow(episode.id)
                onNotice(t('episodeSyncWorkflowDone').replace('{name}', workflow.name), 'info')
              } catch (error) {
                onNotice(`${t('episodeSyncWorkflowFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          <Icon name="flow" size={11} />{t('episodeSyncWorkflow')}
        </button>
        <button
          type="button"
          className="iv-btn iv-btn--ghost iv-btn--sm"
          data-episode-export="true"
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true)
              try {
                const result = await api.exportEpisode(episode.id)
                onNotice(t('episodeExportDone').replace('{path}', result.manifestPath), 'info')
              } catch (error) {
                onNotice(`${t('episodeExportFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          <Icon name="download" size={11} />{t('episodeExport')}
        </button>
      </div>
      {segments.length === 0
        ? <div className="iv-empty" data-segment-empty="true">{t('segmentEmpty')}</div>
        : (
          <div className="iv-sb-list" data-segment-list="true">
            {segments.map(segment => (
              <div className="iv-sb-shot" key={segment.id} data-segment={segment.id}>
                <span className="iv-sb-shot-index">{segment.order}</span>
                {segmentBody(segment)}
              </div>
            ))}
          </div>
        )}
    </section>
  )
}
