/**
 * 本集工作区：剧本 → 分段 → 分镜（集重构 M2）。
 *
 * 数据全部经注入的 `api` 落库；本组件只做「编辑 → 保存」的编排，不复制宿主的校验：
 * 时长越界、空提示词等非法输入由宿主拒绝并原样展示，界面不静默修正。
 * 引用只存 `{kind,id}`，顺序号即正文 `[@n]`。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../icons.tsx'
import { useDialogFocus } from '../use-dialog-focus.ts'
import { SkillTokenSelect, activeSkillId, stripSkillTokens } from '../skill-tokens.tsx'
import { bytesToBase64 } from '../script-import-shared.ts'
import type { WorkbenchApi } from '../api.ts'
import type { TextModelOption } from '../api.ts'
import type { WorkbenchLocaleKey } from '../locales.ts'
import type { AssetRecord, ResourceRecord } from '../../workbench/records.ts'
import { newWorkbenchId } from '../../workbench/records.ts'
import {
  distributeDurationToShots, episodeDurationSec, shotsDurationSec,
  MAX_SEGMENT_DURATION_SEC, MIN_SEGMENT_DURATION_SEC, SEGMENT_DURATION_PRESETS,
} from '../../workbench/episodes.ts'
import { splitScriptIntoSegments } from '../../workbench/episode-plan.ts'
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
  /** 顶部集选择器：节点由父级渲染，切换逻辑仍留在父级。 */
  readonly episodePicker?: ReactNode
  readonly options: WorkbenchOptions | undefined
  /** 导演库里启用中的技能（分段的 Skill 选择器）。 */
  readonly skills: readonly SkillRecord[]
  /** 文本模型目录：默认规则 + 各文本模型共用同一个选择（`provider::model` 作为值）。 */
  readonly textModels: readonly TextModelOption[]
  /** 分段模型选择：`rules` = 内置默认规则，其余是 `provider::model`。 */
  readonly textModelKey: string
  /** 当前选中的文本模型（规则模式为 undefined）。 */
  readonly textModel: { readonly provider: string; readonly model: string } | undefined
  /** 新分段继承的默认值（仅保留导演 Skill；图像 / 视频模型由段级自己选）。 */
  readonly defaults: {
    readonly skillId?: string
  }
  readonly onTextModelChange: (key: string) => void
  readonly onSkillChange: (id: string) => void
  /** 集记录在宿主侧变化后刷新（剧本、分段、分镜都走这里）。 */
  readonly onEpisodeChanged: () => Promise<void>
  /** 导入本集成功后切到新导入的集（父级负责刷新列表并选中）。 */
  readonly onEpisodeImported?: (episode: EpisodeRecord) => Promise<void> | void
  /** 生成了新素材 / 新任务后刷新素材库与任务列表。 */
  readonly onMediaGenerated: () => Promise<void>
  /** 引用列表点选 → 右侧预览面板展示对应素材。 */
  readonly onPreviewAsset: (path: string, kind: 'image' | 'video') => void
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

/** 分段之间用空行分隔：总输入框一段一行，下面每段提示词就是一块。 */
const SEGMENT_TEXT_SEPARATOR = '\n\n'

/** 文件路径 → 文件名（素材引用没有名字，用文件名标识）。 */
function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

/** 把所有分段提示词拼成总输入框内容。 */
function segmentScriptText(segments: readonly SegmentRecord[]): string {
  return segments.map(segment => segment.promptText).join(SEGMENT_TEXT_SEPARATOR)
}

/** 有分段时总输入框展示所有分段；没有分段时展示原始剧本供「开始分段」使用。 */
function scriptSourceText(script: string, segments: readonly SegmentRecord[]): string {
  return segments.length === 0 ? script : segmentScriptText(segments)
}

/** 总输入框 → 分段提示词；末尾多余空行不算新段。 */
function splitSegmentText(text: string): string[] {
  const parts = text.split(/\n\s*\n/)
  while (parts.length > 1 && (parts[parts.length - 1] ?? '').trim() === '') parts.pop()
  return parts
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
    /** `[@n]` 与名称之间的可缩放缩略图。 */
    readonly thumb?: (ref: SegmentRef) => ReactNode
    /** 点击缩略图 / 名称 → 右侧预览面板；资源引用没有文件路径，不传。 */
    readonly onPreview?: (ref: SegmentRef) => void
  },
) {
  const { refs, owner, t, label, onChange, onInsert, thumb, onPreview } = props
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
          {thumb?.(ref)}
          {onPreview === undefined || ref.kind !== 'asset'
            ? <span className="iv-ellipsis" title={label(ref)}>{label(ref)}</span>
            : (
              <button
                type="button"
                className="iv-ref-name"
                data-ref-preview={`${ref.kind}:${ref.id}`}
                title={`${t('refPreview')} · ${label(ref)}`}
                onClick={() => { onPreview(ref) }}
              >
                <span className="iv-ellipsis" title={label(ref)}>{label(ref)}</span>
              </button>
            )}
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

/** 素材缩略图：产物文件由宿主挂在 `/outputs/<文件名>` 上，视频取第 0.1 秒的一帧。 */
function RefThumb(props: { readonly asset: AssetRecord }) {
  const src = `/outputs/${encodeURIComponent(fileName(props.asset.path))}`
  return props.asset.kind === 'video'
    ? <video className="iv-ref-picker-thumb" src={`${src}#t=0.1`} muted preload="metadata" playsInline aria-hidden />
    : <img className="iv-ref-picker-thumb" src={src} alt="" />
}

/** 引用 chip 里的缩略图：点一下把素材送到右侧预览面板（视频先出首帧，再点播放）。 */
function RefChipThumb(props: {
  readonly asset: AssetRecord
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly onPreview: () => void
}) {
  const name = fileName(props.asset.path)
  return (
    <button
      type="button"
      className="iv-ref-thumb-button"
      data-ref-thumb={props.asset.id}
      aria-label={`${props.t('refPreview')} ${name}`}
      title={`${props.t('refPreview')} ${name}`}
      onClick={props.onPreview}
    >
      <RefThumb asset={props.asset} />
    </button>
  )
}

interface RefPickerProps {
  /** 面板 / 搜索框 / 空态的定位值（分段或镜头的 id）。 */
  readonly id: string
  readonly label: string
  readonly assets: readonly AssetRecord[]
  readonly used: readonly SegmentRef[]
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly disabled: boolean
  /** 触发按钮上的定位属性，分段与镜头各一套。 */
  readonly trigger: Readonly<Record<string, string>>
  readonly onPick: (assetId: string) => void
  /** 选择器里的缩略图 / 眼睛按钮也能直接预览，不必先引用。 */
  readonly onPreview: (asset: AssetRecord) => void
}

/**
 * 引用选择面板：只列素材库里的图片与视频（自动命名的文件靠缩略图辨认），
 * 已引用的不再出现。分段与镜头共用同一份交互与搜索。
 */
function RefPicker(props: RefPickerProps) {
  const { id, label, assets, used, t, disabled, trigger, onPick, onPreview } = props
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])
  useDialogFocus(open, panelRef, close)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent): void => {
      if (event.target instanceof Node && wrapRef.current?.contains(event.target) === true) return
      close()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => { document.removeEventListener('mousedown', onMouseDown) }
  }, [open, close])

  const usedIds = new Set(used.map(ref => `${ref.kind}:${ref.id}`))
  const keyword = query.trim().toLowerCase()
  const candidates = assets.filter(asset => !usedIds.has(`asset:${asset.id}`)
    && (keyword === '' || fileName(asset.path).toLowerCase().includes(keyword)))
  const groups = [
    { kind: 'image', title: t('segmentRefImages'), items: candidates.filter(asset => asset.kind === 'image') },
    { kind: 'video', title: t('segmentRefVideos'), items: candidates.filter(asset => asset.kind === 'video') },
  ].filter(group => group.items.length > 0)
  const empty = groups.length === 0

  return (
    <div className="iv-ref-pop" ref={open ? wrapRef : undefined}>
      <button
        type="button"
        className="iv-btn iv-btn--ghost iv-btn--sm"
        {...trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => {
          if (open) close()
          else setOpen(true)
        }}
      >
        <Icon name="plus" size={11} />{label}
      </button>
      {open ? (
        <div
          className="iv-pop-panel"
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label={label}
          data-ref-picker={id}
        >
          <input
            className="iv-input iv-ref-picker-search"
            type="search"
            value={query}
            placeholder={t('segmentRefSearch')}
            aria-label={t('segmentRefSearch')}
            data-ref-picker-search={id}
            onChange={event => { setQuery(event.target.value) }}
          />
          {empty
            ? <span className="iv-ref-picker-empty" data-ref-picker-empty={id}>{t('segmentRefPickerEmpty')}</span>
            : groups.map(group => (
              <div className="iv-pop-group" key={group.kind}>
                <span className="iv-micro iv-pop-group-title">{group.title}</span>
                {group.items.map(asset => (
                  <div className="iv-ref-picker-row" key={asset.id}>
                    <button
                      type="button"
                      className="iv-ref-picker-item"
                      data-ref-option={`asset:${asset.id}`}
                      onClick={() => { onPick(asset.id) }}
                    >
                      <RefThumb asset={asset} />
                      <span className="iv-ellipsis" title={fileName(asset.path)}>{fileName(asset.path)}</span>
                      <span className="iv-ref-picker-meta">{asset.kind}</span>
                    </button>
                    <button
                      type="button"
                      className="iv-btn iv-btn--icon iv-btn--sm iv-ref-picker-preview"
                      data-ref-preview-option={`asset:${asset.id}`}
                      aria-label={`${t('refPreview')} ${fileName(asset.path)}`}
                      title={`${t('refPreview')} ${fileName(asset.path)}`}
                      onClick={() => { close(); onPreview(asset) }}
                    >
                      <Icon name="eye" size={11} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </div>
      ) : null}
    </div>
  )
}

export function EpisodeWorkspace(props: EpisodeWorkspaceProps) {
  const { api, t, projectId, episode, resources, assets, episodePicker, options, skills, textModels, textModelKey, textModel, defaults, onTextModelChange, onSkillChange, onEpisodeChanged, onEpisodeImported, onMediaGenerated, onPreviewAsset, onNotice } = props

  // 目录由宿主过滤成纯文本模型；旧持久化值不在目录里时一律按「默认规则」处理
  const activeTextModelKey = textModels.some(model => `${model.provider}::${model.id}` === textModelKey) ? textModelKey : 'rules'
  const activeTextModel = activeTextModelKey === 'rules' ? undefined : textModel
  const modelMode = activeTextModelKey !== 'rules'
  const validSegmentTextModel = (key: string | undefined): string =>
    key !== undefined && textModels.some(model => `${model.provider}::${model.id}` === key) ? key : ''

  const [scriptDraft, setScriptDraft] = useState(() => scriptSourceText(episode.script.text, episode.segments))
  const [scriptSavedText, setScriptSavedText] = useState(() => scriptSourceText(episode.script.text, episode.segments))
  const [scriptState, setScriptState] = useState<'saved' | 'dirty' | 'saving' | 'failed'>('saved')
  const [segments, setSegments] = useState<readonly SegmentRecord[]>(episode.segments)
  const [storyboards, setStoryboards] = useState<readonly StoryboardRecord[]>(episode.storyboards)
  const [busy, setBusy] = useState(false)
  /** 自动拆段进行中：与单段保存互斥，避免模型跑着时用户又新建分段。 */
  const [splitting, setSplitting] = useState(false)
  const [planningId, setPlanningId] = useState<string | undefined>(undefined)
  const [generatingShotId, setGeneratingShotId] = useState<string | undefined>(undefined)
  /** 一键生成进行中的分段与媒体类型（两个按钮互斥）。 */
  const [generatingAll, setGeneratingAll] = useState<{ segmentId: string; mode: 'image' | 'video' } | undefined>(undefined)
  /** 折叠的分段 id：收起后只留标题行 + 提示词预览。 */
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set())
  /** 切换一条分段的折叠态（整条标题行与折叠按钮共用）。 */
  const toggleCollapsed = (id: string): void => {
    setCollapsedIds(current => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }
  /** 镜头与分段共用一套折叠集合，加前缀避免 id 撞车。 */
  const shotKey = (id: string): string => `shot:${id}`
  /** 总输入框右侧的分段跳转（选中后光标落到对应段落）。 */
  const [jumpTarget, setJumpTarget] = useState('')
  /** 宿主最后确认过的分段；脚本/分段被父级刷新时用来避免覆盖正在输入的内容。 */
  const savedSegments = useRef(new Map<string, SegmentRecord>())
  const episodeIdRef = useRef(episode.id)
  const scriptStateRef = useRef(scriptState)
  const aggregateFocused = useRef(false)
  /** 总输入框里新增但尚未落库的分段：保存时走 createSegment 而不是 updateSegment。 */
  const pendingNewSegments = useRef(new Set<string>())
  const scriptRef = useRef<HTMLTextAreaElement | null>(null)
  const episodeImportRef = useRef<HTMLInputElement | null>(null)
  const handlersRef = useRef({ onEpisodeChanged, onNotice, t })

  useEffect(() => {
    handlersRef.current = { onEpisodeChanged, onNotice, t }
  }, [onEpisodeChanged, onNotice, t])

  useEffect(() => { scriptStateRef.current = scriptState }, [scriptState])

  /** 本地替换一条分段（保存成功后的回填）。 */
  const applySegment = (saved: SegmentRecord): void => {
    savedSegments.current.set(saved.id, saved)
    setSegments(current => current.map(segment => (segment.id === saved.id ? saved : segment)))
  }

  /** 本地改一条分段（未保存）。 */
  const patchSegment = (next: SegmentRecord): void => {
    setSegments(current => current.map(segment => (segment.id === next.id ? next : segment)))
  }

  /** 新分段继承的模块级选择：只有导演 Skill；图像 / 视频 / 文本模型由段级自己选。 */
  const inherited = (): { skillId?: string } => ({
    ...defaults.skillId === undefined || defaults.skillId === '' ? {} : { skillId: defaults.skillId },
  })

  /**
   * 保存总输入框：有分段时按空行拆回所有分段（多出来的行新建分段），
   * 没有分段时保持原来的整集剧本落库。Skill token 只留在界面文本里。
   */
  const persistScriptDraft = useCallback(async (text: string): Promise<void> => {
    const { onEpisodeChanged: refresh, onNotice: notify, t: translate } = handlersRef.current
    setScriptState('saving')
    try {
      if (segments.length === 0) {
        await api.updateEpisode(episode.id, { script: { text } })
      } else {
        const parts = splitSegmentText(text)
        const cleanParts = parts.map(part => stripSkillTokens(part, skills))
        for (const [index, segment] of segments.entries()) {
          // 本地已同步过 promptText，所以这里不能拿本地值做「没变」判断，否则不会落库。
          const promptText = cleanParts[index] ?? ''
          const skillId = activeSkillId(parts[index] ?? '', skills)
          if (pendingNewSegments.current.has(segment.id)) {
            if (promptText.trim() !== '') {
              const created = await api.createSegment(episode.id, {
                promptText,
                durationSec: segment.durationSec,
                ...skillId === '' ? {} : { skillId },
              })
              applySegment(created)
            }
            pendingNewSegments.current.delete(segment.id)
            continue
          }
          const saved = await api.updateSegment(segment.id, { promptText, skillId })
          applySegment(saved)
        }
        await api.updateEpisode(episode.id, { script: { text } })
      }
      setScriptSavedText(text)
      setScriptState('saved')
      await refresh()
    } catch (error) {
      setScriptState('failed')
      notify(`${translate('episodeScriptFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }, [api, defaults.skillId, episode.id, segments, skills])

  /** 宿主记录变化（保存成功后的刷新）→ 本地列表跟随；正在输入的剧本不被覆盖。 */
  useEffect(() => {
    const switched = episodeIdRef.current !== episode.id
    episodeIdRef.current = episode.id
    pendingNewSegments.current.clear()
    setSegments(episode.segments)
    setStoryboards(episode.storyboards)
    savedSegments.current = new Map(episode.segments.map(segment => [segment.id, segment]))
    if (switched || scriptStateRef.current === 'saved') {
      const text = scriptSourceText(episode.script.text, episode.segments)
      setScriptDraft(text)
      setScriptSavedText(text)
    }
  }, [episode])

  /** 段内提示词变动时，总输入框同步展示所有段；正在编辑总输入框时不反向覆盖。 */
  useEffect(() => {
    if (aggregateFocused.current) return
    setScriptDraft(segments.length === 0 ? scriptSavedText : segmentScriptText(segments))
  }, [segments, scriptSavedText])

  /** 总输入框自动保存；父级轮询引起的重渲染不会重启计时器。 */
  useEffect(() => {
    if (scriptDraft === scriptSavedText) return
    setScriptState('dirty')
    const timer = window.setTimeout(() => { void persistScriptDraft(scriptDraft) }, 900)
    return () => { window.clearTimeout(timer) }
  }, [scriptDraft, scriptSavedText, persistScriptDraft])

  /** 总输入框失焦立即保存，避免用户改完就离开时等不到防抖。 */
  const flushScript = (): void => {
    const text = scriptDraft
    if (text === scriptSavedText || scriptState === 'saving') return
    void persistScriptDraft(text)
  }

  /** 总输入框编辑：本地同步下方各段，并把 Skill token 状态回传给模块级默认值。 */
  const updateScriptDraft = (value: string): void => {
    setScriptDraft(value)
    onSkillChange(activeSkillId(value, skills))
    if (segments.length === 0) return
    const parts = splitSegmentText(value)
    setSegments(current => {
      const next = current.map((segment, index) => ({ ...segment, promptText: parts[index] ?? '' }))
      // 总输入框里多出来的空行就是新段：先建本地占位，失焦时统一落库。
      for (let index = next.length; index < parts.length; index += 1) {
        const id = newWorkbenchId('seg')
        pendingNewSegments.current.add(id)
        next.push({
          id,
          episodeId: episode.id,
          order: next.length + 1,
          durationSec: SEGMENT_DURATION_PRESETS[0]!,
          promptText: parts[index] ?? '',
          refs: [],
        })
      }
      return next
    })
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
   * 开始分段：规则模式按文本结构本地切段并逐段落库；模型模式交给所选文本模型。
   *
   * 重建语义（不是追加）：先把已有分段连同它们的分镜一起清掉，再按当前剧本整篇重建。
   * 否则「有分段时再点一次」会把总输入框里展示的分段文本又切一遍追加进去，
   * 造成同一段内容被复制、分段凭空多出来。失败时先刷新再报，避免界面与宿主脱节。
   */
  const autoSplit = async (): Promise<void> => {
    const cleanScript = stripSkillTokens(scriptDraft, skills)
    if (cleanScript.trim() === '') {
      onNotice(t('scriptSplitNeedsScript'), 'error')
      return
    }
    if (modelMode && activeTextModel === undefined) {
      onNotice(t('scriptSplitNeedsModel'), 'error')
      return
    }
    setSplitting(true)
    try {
      // 重建前先清掉旧分段（宿主级联删分镜），本地列表同步置空，避免中间态展示重复内容
      if (segments.length > 0) {
        for (const segment of segments) await api.removeSegment(segment.id)
        setSegments([])
        savedSegments.current = new Map()
        pendingNewSegments.current.clear()
      }
      if (!modelMode) {
        const drafts = splitScriptIntoSegments(cleanScript)
        if (drafts.length === 0) {
          onNotice(t('scriptSplitNeedsScript'), 'error')
          return
        }
        for (const draft of drafts) {
          await api.createSegment(episode.id, {
            promptText: draft.promptText,
            durationSec: draft.durationSec,
            ...inherited(),
          })
        }
        await onEpisodeChanged()
        onNotice(t('scriptSplitDone').replace('{n}', String(drafts.length)), 'info')
        return
      }
      const result = await api.splitEpisode({
        episodeId: episode.id,
        provider: (textModel as { provider: string }).provider,
        model: (textModel as { model: string }).model,
        script: cleanScript,
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

  /** 引用 chip 点选 → 右侧预览面板；资源引用没有可预览文件，静默忽略。 */
  const previewRef = (ref: SegmentRef): void => {
    if (ref.kind !== 'asset') return
    const asset = assets.find(candidate => candidate.id === ref.id)
    if (asset !== undefined) onPreviewAsset(asset.path, asset.kind)
  }

  /** 引用 chip 的缩略图：素材引用取 `/outputs` 里的图 / 视频首帧，资源引用暂无图。 */
  const thumbOf = (ref: SegmentRef): ReactNode => {
    if (ref.kind !== 'asset') return undefined
    const asset = assets.find(candidate => candidate.id === ref.id)
    return asset === undefined ? undefined : <RefChipThumb asset={asset} t={t} onPreview={() => { previewRef(ref) }} />
  }

  /** 把 `[@n]` 追加到分段提示词（已存在则不重复追加）。 */
  const insertToken = (segment: SegmentRecord, order: number): void => {
    const mark = `[@${order}]`
    if (segment.promptText.includes(mark)) return
    const next = { ...segment, promptText: `${segment.promptText}${segment.promptText === '' ? '' : ' '}${mark}` }
    patchSegment(next)
    void commitSegment(next)
  }

  /** 追加一条引用并保存；面板保持打开，选过的项随即从候选消失。 */
  const addRef = (segment: SegmentRecord, assetId: string): void => {
    const next = { ...segment, refs: [...segment.refs, { kind: 'asset' as const, id: assetId, order: segment.refs.length + 1 }] }
    patchSegment(next)
    void commitSegment(next)
  }

  /** 分镜生成：本段提示词 → 拆镜 → 落库（段选了文本模型就调它，否则走默认规则）。 */
  const planSegment = async (segment: SegmentRecord): Promise<void> => {
    const cleanPrompt = stripSkillTokens(segment.promptText, skills)
    if (cleanPrompt.trim() === '') {
      onNotice(t('storyboardNeedsScript'), 'error')
      return
    }
    setPlanningId(segment.id)
    try {
      const selectedTextModel = validSegmentTextModel(segment.textModel)
      const separator = selectedTextModel.indexOf('::')
      const provider = separator > 0 ? selectedTextModel.slice(0, separator) : ''
      const model = separator > 0 ? selectedTextModel.slice(separator + 2) : ''
      const plan = await api.planStoryboard({
        projectId,
        script: cleanPrompt,
        ...provider !== '' && model !== '' ? { provider, model } : {},
      })
      const existing = storyboards.find(storyboard => storyboard.segmentId === segment.id)
      // 精确平分：余数给靠前镜头，保证所有分镜之和 == 段时长
      const shotDurations = distributeDurationToShots(segment.durationSec, plan.shots.length)
      const shots: ShotRecord[] = plan.shots.map((shot, index) => ({
        id: newWorkbenchId('shot'),
        order: index + 1,
        durationSec: shotDurations[index]!,
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

  /** 时长夹到合法区间（分镜与段共用 1–180 秒）。 */
  const clampDuration = (value: number): number =>
    Math.min(MAX_SEGMENT_DURATION_SEC, Math.max(MIN_SEGMENT_DURATION_SEC, Math.round(Number.isFinite(value) ? value : MIN_SEGMENT_DURATION_SEC)))

  /**
   * 单个分镜可设的最大秒数：段时长 = 分镜之和且段落库上限 180，
   * 因此某镜不能超过「180 − 其余镜头之和」，否则段时长会越界被拒。
   */
  const shotDurationCap = (segmentId: string, shotId: string): number => {
    const storyboard = storyboards.find(candidate => candidate.segmentId === segmentId)
    if (storyboard === undefined) return MAX_SEGMENT_DURATION_SEC
    const others = storyboard.shots.reduce(
      (sum, candidate) => candidate.id === shotId ? sum : sum + candidate.durationSec, 0,
    )
    return Math.max(MIN_SEGMENT_DURATION_SEC, MAX_SEGMENT_DURATION_SEC - others)
  }

  /**
   * 段时长与分镜时长联动落库：保证「段时长 == 该段所有分镜时长之和」。
   * 先存分镜再存段，最后统一刷新集，避免中途刷新覆盖本地状态。
   * @param segment - 时长已同步好的分段。
   * @param shots - 有分镜时传入已同步好的整组镜头；无分镜时传 undefined。
   */
  const commitDurations = async (segment: SegmentRecord, shots: readonly ShotRecord[] | undefined): Promise<void> => {
    setBusy(true)
    try {
      if (shots !== undefined) {
        const storyboard = storyboards.find(candidate => candidate.segmentId === segment.id)
        if (storyboard !== undefined) {
          const saved = await api.saveStoryboard({
            id: storyboard.id,
            episodeId: episode.id,
            segmentId: segment.id,
            ...storyboard.skillId === undefined ? {} : { skillId: storyboard.skillId },
            shots: [...shots],
          })
          setStoryboards(list => list.map(candidate => (candidate.id === saved.id ? saved : candidate)))
        }
      }
      const savedSegment = await api.updateSegment(segment.id, {
        promptText: segment.promptText,
        durationSec: segment.durationSec,
        imageModel: segment.imageModel ?? '',
        videoModel: segment.videoModel ?? '',
        skillId: segment.skillId ?? '',
        refs: segment.refs.map((ref, position) => ({ ...ref, order: position + 1 })),
      })
      applySegment(savedSegment)
      await onEpisodeChanged()
    } catch (error) {
      onNotice(`${t('segmentSaveFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  /**
   * 改段时长：把新时长平分给该段所有分镜（余数给靠前镜头），使分镜之和恒等于段时长。
   * 没有分镜时只改段时长本身。
   */
  const changeSegmentDuration = (segment: SegmentRecord, seconds: number): void => {
    const storyboard = storyboards.find(candidate => candidate.segmentId === segment.id)
    if (storyboard === undefined || storyboard.shots.length === 0) {
      const next = { ...segment, durationSec: clampDuration(seconds) }
      patchSegment(next)
      void commitDurations(next, undefined)
      return
    }
    // 镜头数多于秒数时每镜至少 1 秒，段时长随之抬到「镜头数」，仍保持相等。
    const target = Math.max(storyboard.shots.length, clampDuration(seconds))
    const durations = distributeDurationToShots(target, storyboard.shots.length)
    const shots = storyboard.shots.map((shot, index) => ({ ...shot, durationSec: durations[index]! }))
    const next = { ...segment, durationSec: shotsDurationSec(shots) }
    patchSegment(next)
    setStoryboards(list => list.map(candidate => (candidate.id === storyboard.id ? { ...candidate, shots } : candidate)))
    void commitDurations(next, shots)
  }

  /**
   * 改单个分镜时长后：段时长自动等于该段所有分镜之和，并落库两端。
   * 分镜时长已在 onChange 里本地更新，这里从最新本地 storyboards 求和。
   */
  const syncSegmentToShots = (segmentId: string): void => {
    const storyboard = storyboards.find(candidate => candidate.segmentId === segmentId)
    const segment = segments.find(candidate => candidate.id === segmentId)
    if (storyboard === undefined || segment === undefined) return
    if (storyboard.shots.length === 0) return
    const next = { ...segment, durationSec: shotsDurationSec(storyboard.shots) }
    patchSegment(next)
    void commitDurations(next, storyboard.shots)
  }

  /**
   * 增删分镜后：按段时长把新的镜头列表重新均分，保持分镜之和 == 段时长，并同步落库。
   * 删到空镜头时保留段时长，只落库空分镜组。
   */
  const respreadShotsAndSync = (segment: SegmentRecord, shots: readonly ShotRecord[]): void => {
    if (shots.length === 0) {
      const storyboard = storyboards.find(candidate => candidate.segmentId === segment.id)
      if (storyboard !== undefined) {
        const cleared = { ...storyboard, shots: [] }
        setStoryboards(list => list.map(candidate => (candidate.id === cleared.id ? cleared : candidate)))
        void persistStoryboard(cleared)
      }
      return
    }
    const target = Math.max(shots.length, segment.durationSec)
    const durations = distributeDurationToShots(target, shots.length)
    const spread = shots.map((shot, index) => ({ ...shot, durationSec: durations[index]! }))
    const next = { ...segment, durationSec: shotsDurationSec(spread) }
    patchSegment(next)
    setStoryboards(list => list.map(candidate => (candidate.segmentId === segment.id ? { ...candidate, shots: spread } : candidate)))
    void commitDurations(next, spread)
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

  /**
   * 一键生成本段全部分镜：图片同步返回，视频逐条入队（`wait:false`）。
   *
   * 模型优先用镜头自己的选择（沿用分段设置），否则回到模块级默认；单镜失败只报
   * 该镜并继续，最后给一条「已完成 n/总数」的汇总。
   */
  const generateAllShots = async (segment: SegmentRecord, mode: 'image' | 'video'): Promise<void> => {
    if (mode === 'video' && segment.durationSec > 30) {
      onNotice(t('segmentVideoTooLong'), 'error')
      return
    }
    const storyboard = storyboards.find(candidate => candidate.segmentId === segment.id)
    if (storyboard === undefined || storyboard.shots.length === 0) {
      onNotice(t('segmentStoryboardNone'), 'error')
      return
    }
    setGeneratingAll({ segmentId: segment.id, mode })
    let done = 0
    try {
      for (const shot of storyboard.shots) {
        const prompt = (mode === 'image' ? shot.imagePrompt : shot.videoPrompt).trim()
        if (prompt === '') continue
        const model = mode === 'image'
          ? shot.imageModel ?? segment.imageModel
          : shot.videoModel ?? segment.videoModel
        try {
          await api.generateMedia({
            mediaMode: mode,
            prompt,
            projectId,
            episodeId: episode.id,
            segmentId: segment.id,
            shotId: shot.id,
            ...model === undefined || model === '' ? {} : { model },
            ...mode === 'video' ? { duration: shot.durationSec, wait: false } : {},
          })
          done += 1
        } catch (error) {
          onNotice(
            `${t('shotName').replace('{n}', String(shot.order))} · ${t('shotGenerateFailed')}：${error instanceof Error ? error.message : String(error)}`,
            'error',
          )
        }
      }
      await onMediaGenerated()
      onNotice(
        (mode === 'image' ? t('segmentGenerateAllImagesDone') : t('segmentGenerateAllVideosDone'))
          .replace('{done}', String(done))
          .replace('{total}', String(storyboard.shots.length)),
        'info',
      )
    } finally {
      setGeneratingAll(undefined)
    }
  }

  /** 一条分段的行内编辑区（折叠时只留标题行 + 提示词预览）。 */
  const segmentBody = (segment: SegmentRecord) => {
    const storyboard = storyboards.find(candidate => candidate.segmentId === segment.id)
    const collapsed = collapsedIds.has(segment.id)
    const segmentOwner = `segment:${segment.id}`
    const cleanPrompt = stripSkillTokens(segment.promptText, skills)
    return (
      <div className="iv-sb-shot-body">
        <div
          className="iv-sb-seg-head iv-sb-seg-head--clickable"
          data-segment-head={segment.id}
          title={collapsed ? t('segmentExpand') : t('segmentCollapse')}
          onClick={() => { toggleCollapsed(segment.id) }}
        >
          <span className="iv-micro" data-segment-name={segment.id}>
            {t('segmentName').replace('{n}', String(segment.order))}
          </span>
          <span className="iv-sb-seg-actions">
            <button
              type="button"
              className="iv-btn iv-btn--ghost iv-btn--sm"
              data-segment-up={segment.id}
              aria-label={t('moveUp')}
              disabled={busy || segment.order <= 1}
              onClick={event => { event.stopPropagation(); void moveSegment(segment, -1) }}
            >
              <Icon name="chevron" size={11} className="iv-ico--up" />
            </button>
            <button
              type="button"
              className="iv-btn iv-btn--ghost iv-btn--sm"
              data-segment-down={segment.id}
              aria-label={t('moveDown')}
              disabled={busy || segment.order >= segments.length}
              onClick={event => { event.stopPropagation(); void moveSegment(segment, 1) }}
            >
              <Icon name="chevron" size={11} className="iv-ico--down" />
            </button>
            <button
              type="button"
              className="iv-btn iv-btn--icon iv-btn--sm"
              data-segment-toggle={segment.id}
              aria-expanded={!collapsed}
              aria-label={collapsed ? t('segmentExpand') : t('segmentCollapse')}
              title={collapsed ? t('segmentExpand') : t('segmentCollapse')}
              onClick={event => { event.stopPropagation(); toggleCollapsed(segment.id) }}
            >
              <Icon name="chevron" size={11} className={collapsed ? undefined : 'iv-ico--down'} />
            </button>
            <button
              type="button"
              className="iv-btn iv-btn--icon iv-btn--sm"
              data-segment-remove={segment.id}
              aria-label={t('segmentRemove')}
              title={t('segmentRemove')}
              disabled={busy}
              onClick={event => { event.stopPropagation(); void removeSegment(segment) }}
            >
              <Icon name="trash" size={11} />
            </button>
          </span>
        </div>
        {collapsed
          ? <div className="iv-seg-peek" data-segment-preview={segment.id}>{segment.promptText || t('segmentPromptPlaceholder')}</div>
          : (
          <>
        <div className={`iv-seg-prompt-row${segment.refs.length > 0 ? ' iv-seg-prompt-row--with-refs' : ''}`}>
          <label className="iv-sb-field iv-seg-prompt-field">
            <span className="iv-meta">{t('segmentPromptLabel')}</span>
            <textarea
              className="iv-input"
              rows={4}
              value={segment.promptText}
              placeholder={t('segmentPromptPlaceholder')}
              data-segment-prompt={segment.id}
              disabled={busy}
              onChange={event => {
                const promptText = event.target.value
                patchSegment({ ...segment, promptText, skillId: activeSkillId(promptText, skills) })
              }}
              onBlur={() => { void commitSegment(segments.find(candidate => candidate.id === segment.id) ?? segment) }}
            />
          </label>
          <div className="iv-seg-ref-side">
            <RefPicker
              id={segment.id}
              label={t('segmentAddRef')}
              assets={assets}
              used={segment.refs}
              t={t}
              disabled={busy}
              trigger={{ 'data-segment-ref-add': segment.id }}
              onPick={assetId => { addRef(segment, assetId) }}
              onPreview={asset => { onPreviewAsset(asset.path, asset.kind) }}
            />
            {segment.refs.length > 0
              ? (
              <div className="iv-seg-refs-block" data-segment-refs={segment.id}>
                <span className="iv-meta">{t('segmentRefsLabel')}</span>
                <div className="iv-ref-row">
                  {refChips({
                    refs: segment.refs,
                    owner: segmentOwner,
                    t,
                    label: labelOf,
                    thumb: thumbOf,
                    onPreview: previewRef,
                    onChange: next => {
                      const updated = { ...segment, refs: next }
                      patchSegment(updated)
                      void commitSegment(updated)
                    },
                    onInsert: order => insertToken(segment, order),
                  })}
                </div>
              </div>
              )
              : null}
          </div>
        </div>
        <div className="iv-sb-row iv-sb-seg-meta">
          <label className="iv-sb-field">
            <span className="iv-meta">{t('segmentDurationLabel')}</span>
            <div className="iv-dur-row">
              {SEGMENT_DURATION_PRESETS.map(seconds => (
                <button
                  type="button"
                  className="iv-btn iv-btn--ghost iv-btn--sm"
                  key={seconds}
                  data-segment-duration={String(seconds)}
                  disabled={busy}
                  onClick={() => { changeSegmentDuration(segment, seconds) }}
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
                onBlur={() => { changeSegmentDuration(segment, segment.durationSec) }}
              />
            </div>
          </label>
          <label className="iv-sb-field">
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
          <label className="iv-sb-field">
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
          <label className="iv-sb-field">
            <span className="iv-meta">{t('segmentTextModel')}</span>
            <select
              className="iv-input"
              value={validSegmentTextModel(segment.textModel)}
              data-segment-text-model={segment.id}
              disabled={busy || planningId === segment.id}
              title={t('scriptSplitHint')}
              onChange={event => {
                const next = { ...segment, textModel: event.target.value === '' ? undefined : event.target.value }
                patchSegment(next)
                void commitSegment(next)
              }}
            >
              <option value="">{t('scriptSplitModeRule')}</option>
              {textModels.map(model => (
                <option key={`${model.provider}::${model.id}`} value={`${model.provider}::${model.id}`}>
                  {model.providerName} · {model.name}
                </option>
              ))}
            </select>
          </label>
          <label className="iv-sb-field">
            <span className="iv-meta">{t('segmentSkillLabel')}</span>
            <SkillTokenSelect
              skills={skills}
              text={segment.promptText}
              t={t}
              label={t('segmentSkillLabel')}
              disabled={busy}
              className="iv-input"
              selectAttrs={{ 'data-segment-skill': segment.id }}
              onTextChange={promptText => {
                const next = { ...segment, promptText, skillId: activeSkillId(promptText, skills) }
                patchSegment(next)
                void commitSegment(next)
              }}
            />
          </label>
        </div>
        <div className="iv-sb-actions">
          <button
            type="button"
            className={`iv-btn iv-btn--action iv-btn--action--primary${planningId === segment.id ? ' iv-btn--busy' : ''}`}
            data-segment-plan={segment.id}
            aria-busy={planningId === segment.id ? 'true' : undefined}
            disabled={planningId === segment.id || busy || cleanPrompt.trim() === ''}
            onClick={() => { void planSegment(segment) }}
          >
            <Icon name="sparkles" size={11} />
            {planningId === segment.id ? t('storyboardPlanning') : t('segmentStoryboardPlan')}
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--action iv-btn--action--soft"
            data-segment-generate-all-images={segment.id}
            disabled={busy || generatingAll !== undefined || storyboard === undefined || storyboard.shots.length === 0}
            onClick={() => { void generateAllShots(segment, 'image') }}
          >
            <Icon name="image" size={11} />
            {generatingAll?.segmentId === segment.id && generatingAll.mode === 'image'
              ? t('shotGenerating')
              : t('segmentGenerateAllImages')}
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--action iv-btn--action--soft"
            data-segment-generate-all-videos={segment.id}
            disabled={busy || generatingAll !== undefined || storyboard === undefined || storyboard.shots.length === 0 || segment.durationSec > 30}
            title={segment.durationSec > 30 ? t('segmentVideoTooLong') : undefined}
            onClick={() => { void generateAllShots(segment, 'video') }}
          >
            <Icon name="video" size={11} />
            {generatingAll?.segmentId === segment.id && generatingAll.mode === 'video'
              ? t('shotGenerating')
              : t('segmentGenerateAllVideos')}
          </button>
        </div>
        {storyboard === undefined
          ? <div className="iv-empty" data-segment-storyboard-empty={segment.id}>{t('segmentStoryboardNone')}</div>
          : (
            <div className="iv-sb-list" data-segment-storyboard={segment.id}>
              {storyboard.shots.map((shot, index) => {
                const shotCollapsed = collapsedIds.has(shotKey(shot.id))
                return (
                <div className="iv-sb-shot" key={shot.id} data-shot={shot.id}>
                  <div className="iv-sb-shot-body">
                    <div
                    className="iv-sb-row iv-shot-head iv-sb-seg-head--clickable"
                    data-shot-head={shot.id}
                    title={shotCollapsed ? t('segmentExpand') : t('segmentCollapse')}
                    onClick={() => { toggleCollapsed(shotKey(shot.id)) }}
                  >
                    <span className="iv-sb-shot-index">{shot.order}</span>
                    <span className="iv-micro">{t('shotName').replace('{n}', String(shot.order))}</span>
                    <span className="iv-shot-duration">
                      <input
                        className="iv-input"
                        type="number"
                        min={MIN_SEGMENT_DURATION_SEC}
                        max={shotDurationCap(segment.id, shot.id)}
                        value={shot.durationSec}
                        data-shot-duration={shot.id}
                        onClick={event => { event.stopPropagation() }}
                        onChange={event => {
                          const capped = Math.min(shotDurationCap(segment.id, shot.id), clampDuration(Number(event.target.value)))
                          patchShotLocal(segment.id, shot.id, { durationSec: capped })
                        }}
                        onBlur={() => { syncSegmentToShots(segment.id) }}
                        style={{ font: 'inherit', padding: '4px 6px', borderRadius: '6px' }}
                      />
                      <span className="iv-meta">{t('segmentDurationLabel')}</span>
                    </span>
                    {/* 编号、镜头名、秒数与操作按钮同处标题行 */}
                    <span className="iv-sb-seg-actions iv-shot-actions" data-shot-actions={shot.id}>
                      <button
                        type="button"
                        className="iv-btn iv-btn--icon iv-btn--sm"
                        aria-label={t('storyboardMoveUp')}
                        data-shot-up={shot.id}
                        disabled={index === 0}
                        onClick={event => {
                          event.stopPropagation()
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
                        onClick={event => {
                          event.stopPropagation()
                          updateStoryboard(segment.id, current => ({ ...current, shots: moveShot(current.shots, index, 1) }))
                        }}
                      >
                        <Icon name="chevron" size={11} className="iv-ico--down" />
                      </button>
                      <button
                        type="button"
                        className="iv-btn iv-btn--icon iv-btn--sm"
                        data-shot-toggle={shot.id}
                        aria-expanded={!shotCollapsed}
                        aria-label={shotCollapsed ? t('segmentExpand') : t('segmentCollapse')}
                        title={shotCollapsed ? t('segmentExpand') : t('segmentCollapse')}
                        onClick={event => { event.stopPropagation(); toggleCollapsed(shotKey(shot.id)) }}
                      >
                        <Icon name="chevron" size={11} className={shotCollapsed ? undefined : 'iv-ico--down'} />
                      </button>
                      <button
                        type="button"
                        className="iv-btn iv-btn--icon iv-btn--sm"
                        aria-label={t('storyboardRemoveShot')}
                        data-shot-remove={shot.id}
                        onClick={event => {
                          event.stopPropagation()
                          const remaining = storyboard.shots
                            .filter(candidate => candidate.id !== shot.id)
                            .map((candidate, position) => ({ ...candidate, order: position + 1 }))
                          respreadShotsAndSync(segment, remaining)
                        }}
                      >
                        <Icon name="trash" size={11} />
                      </button>
                    </span>
                  </div>
                    <div className={`iv-shot-prompt-row${shot.refs.length > 0 ? ' iv-shot-prompt-row--with-refs' : ''}`}>
                      <div className="iv-shot-prompt-main">
                      {shotCollapsed
                        ? <div className="iv-seg-peek" data-shot-preview={shot.id}>{shot.imagePrompt || shot.videoPrompt || t('segmentPromptPlaceholder')}</div>
                        : <>
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
                        {/* 模型标签、下拉、生成按钮同一行，紧贴提示词输入框，不再让标签独占一行 */}
                        <div className="iv-shot-tool-row">
                          <span className="iv-meta">{t('generateImageModel')}</span>
                          <select
                            className="iv-input"
                            value={shot.imageModel ?? ''}
                            data-shot-image-model={shot.id}
                            onChange={event => {
                              const value = event.target.value
                              updateStoryboard(segment.id, current => ({
                                ...current,
                                shots: current.shots.map(candidate => (candidate.id === shot.id
                                  ? { ...candidate, imageModel: value === '' ? undefined : value }
                                  : candidate)),
                              }))
                            }}
                          >
                            <option value="">{t('generateParamAuto')}</option>
                            {(options?.imageProviders ?? []).map(id => <option key={id} value={id}>{id}</option>)}
                          </select>
                          <button
                            type="button"
                            className="iv-btn iv-btn--action iv-btn--action--soft"
                            data-shot-generate-image={shot.id}
                            disabled={generatingShotId === shot.id}
                            onClick={() => { void generateShot(segment, shot, 'image') }}
                          >
                            <Icon name="image" size={11} />{t('shotGenerateImage')}
                          </button>
                        </div>
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
                        {/* 同上：视频模型标签、下拉、生成按钮压成一行 */}
                        <div className="iv-shot-tool-row">
                          <span className="iv-meta">{t('generateVideoModel')}</span>
                          <select
                            className="iv-input"
                            value={shot.videoModel ?? ''}
                            data-shot-video-model={shot.id}
                            onChange={event => {
                              const value = event.target.value
                              updateStoryboard(segment.id, current => ({
                                ...current,
                                shots: current.shots.map(candidate => (candidate.id === shot.id
                                  ? { ...candidate, videoModel: value === '' ? undefined : value }
                                  : candidate)),
                              }))
                            }}
                          >
                            <option value="">{t('generateParamAuto')}</option>
                            {(options?.videoProviders ?? []).map(id => <option key={id} value={id}>{id}</option>)}
                          </select>
                          <button
                            type="button"
                            className="iv-btn iv-btn--action iv-btn--action--soft"
                            data-shot-generate-video={shot.id}
                            disabled={generatingShotId === shot.id}
                            onClick={() => { void generateShot(segment, shot, 'video') }}
                          >
                            <Icon name="video" size={11} />{generatingShotId === shot.id ? t('shotGenerating') : t('shotGenerateVideo')}
                          </button>
                        </div>
                        </>}
                      </div>
                      <div className="iv-seg-ref-side iv-shot-ref-side">
                        <RefPicker
                          id={shot.id}
                          label={t('shotRefAdd')}
                          assets={assets}
                          used={shot.refs}
                          t={t}
                          disabled={busy}
                          trigger={{ 'data-shot-ref-add': shot.id }}
                          onPick={assetId => {
                            updateStoryboard(segment.id, current => ({
                              ...current,
                              shots: current.shots.map(candidate => (candidate.id === shot.id
                                ? { ...candidate, refs: [...candidate.refs, { kind: 'asset', id: assetId, order: candidate.refs.length + 1 }] }
                                : candidate)),
                            }))
                          }}
                          onPreview={asset => { onPreviewAsset(asset.path, asset.kind) }}
                        />
                        {shot.refs.length > 0
                          ? (
                          <div className="iv-seg-refs-block" data-shot-refs={shot.id}>
                            <span className="iv-meta">{t('segmentRefsLabel')}</span>
                            <div className="iv-ref-row">
                              {refChips({
                                refs: shot.refs,
                                owner: `shot:${shot.id}`,
                                t,
                                label: labelOf,
                                thumb: thumbOf,
                                onPreview: previewRef,
                                onChange: next => {
                                  updateStoryboard(segment.id, current => ({
                                    ...current,
                                    shots: current.shots.map(candidate => (candidate.id === shot.id ? { ...candidate, refs: next } : candidate)),
                                  }))
                                },
                                onInsert: undefined,
                              })}
                            </div>
                          </div>
                          )
                          : null}
                      </div>
                    </div>
                  </div>
                </div>
                )
              })}
              <div className="iv-sb-actions">
                <button
                  type="button"
                  className="iv-btn iv-btn--ghost iv-btn--sm"
                  data-shot-add={segment.id}
                  onClick={() => {
                    respreadShotsAndSync(segment, [...storyboard.shots, {
                      id: newWorkbenchId('shot'),
                      order: storyboard.shots.length + 1,
                      durationSec: MIN_SEGMENT_DURATION_SEC,
                      imagePrompt: '',
                      videoPrompt: '',
                      refs: [],
                    }])
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
          </>
          )}
      </div>
    )
  }

  const cleanScript = stripSkillTokens(scriptDraft, skills)
  const jumpParts = segments.length === 0 ? [] : segments.map(segment => segment.promptText)
  const jumpToSegment = (segmentId: string): void => {
    setJumpTarget('')
    const index = segments.findIndex(segment => segment.id === segmentId)
    if (index < 0) return
    const before = jumpParts.slice(0, index).join(SEGMENT_TEXT_SEPARATOR)
    const start = before === '' ? 0 : before.length + SEGMENT_TEXT_SEPARATOR.length
    const end = start + (jumpParts[index]?.length ?? 0)
    const textarea = scriptRef.current
    if (textarea === null) return
    textarea.focus()
    textarea.setSelectionRange(start, end)
  }

  return (
    <section className="iv-sb" data-episode-workspace={episode.id}>
      <div className="iv-sb-head" data-episode-status="true">
        {episodePicker}
        <span className="iv-meta" data-episode-duration="true" data-episode-total-seconds={episodeDurationSec(segments)}>
          {t('episodeTotalDuration').replace('{n}', String(episodeDurationSec(segments)))}
        </span>
        {/* 同步 / 导出 / 导入：从底栏搬到头部，按钮与块的样式保持原样 */}
        <div className="iv-row iv-sb-head-actions" data-episode-actions="true">
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
          <input
            ref={episodeImportRef}
            type="file"
            accept=".json,application/json"
            data-episode-import-file="true"
            style={{ display: 'none' }}
            onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file === undefined) return
              void (async () => {
                setBusy(true)
                try {
                  const base64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()))
                  const result = await api.importEpisode({ projectId, base64 })
                  const notice = t('episodeImportDone')
                    .replace('{no}', String(result.episode.no))
                    .replace('{title}', result.episode.title)
                  onNotice(result.warnings.length === 0
                    ? notice
                    : `${notice} · ${result.warnings.join('；')}`, 'info')
                  await onEpisodeImported?.(result.episode)
                  await onEpisodeChanged()
                } catch (error) {
                  onNotice(`${t('episodeImportFailed')}：${error instanceof Error ? error.message : String(error)}`, 'error')
                } finally {
                  setBusy(false)
                }
              })()
            }}
          />
          <button
            type="button"
            className="iv-btn iv-btn--ghost iv-btn--sm"
            data-episode-import="true"
            title={t('episodeImportHint')}
            disabled={busy}
            onClick={() => episodeImportRef.current?.click()}
          >
            <Icon name="upload" size={11} />{t('episodeImport')}
          </button>
        </div>
        <span className={`${saveChipClass(scriptState)} iv-sb-head-save`} data-episode-script-state={scriptState}>
          {t(scriptState === 'saved'
            ? 'episodeScriptSaved'
            : scriptState === 'saving'
              ? 'episodeScriptSaving'
              : scriptState === 'failed' ? 'episodeScriptFailed' : 'episodeScriptDirty')}
        </span>
      </div>
      <div className="iv-episode-script" data-episode-script-block="true">
        <div className="iv-episode-script-head">
          <span className="iv-meta">{t('episodeScriptJump')}</span>
          <select
            className="iv-select iv-select--sm"
            aria-label={t('episodeScriptJump')}
            data-episode-script-jump="true"
            value={jumpTarget}
            disabled={segments.length === 0}
            onChange={event => { jumpToSegment(event.target.value) }}
          >
            <option value="">{t('episodeScriptAll')}</option>
            {segments.map(segment => (
              <option key={segment.id} value={segment.id}>
                {t('segmentName').replace('{n}', String(segment.order))}
              </option>
            ))}
          </select>
        </div>
        <textarea
          ref={scriptRef}
          className="iv-input iv-episode-script-editor"
          rows={10}
          value={scriptDraft}
          placeholder={t('storyboardScriptPlaceholder')}
          aria-label={t('storyboardScriptPlaceholder')}
          data-episode-script="true"
          onFocus={() => { aggregateFocused.current = true }}
          onChange={event => { updateScriptDraft(event.target.value) }}
          onBlur={() => { aggregateFocused.current = false; flushScript() }}
        />
      </div>
      {/* 分段模型与 Skill 都是分段设置：默认规则不调 AI，其余值走对应文本模型。 */}
      <div className="iv-sb-row iv-sb-selector-row" data-script-selectors="true">
        <label className="iv-sb-field">
          <span className="iv-meta">{t('scriptTextModel')}</span>
          <select
            className="iv-select iv-select--sm"
            aria-label={t('scriptTextModel')}
            data-script-text-model="true"
            value={activeTextModelKey}
            disabled={busy || splitting}
            onChange={event => { onTextModelChange(event.target.value) }}
          >
            <option value="rules">{t('scriptSplitModeRule')}</option>
            {textModels.map(model => (
              <option key={`${model.provider}::${model.id}`} value={`${model.provider}::${model.id}`}>
                {model.providerName} · {model.name}
              </option>
            ))}
          </select>
        </label>
        <label className="iv-sb-field">
          <span className="iv-meta">{t('scriptDirectorSkill')}</span>
          <SkillTokenSelect
            skills={skills}
            text={scriptDraft}
            t={t}
            label={t('scriptDirectorSkill')}
            disabled={busy || splitting}
            className="iv-select iv-select--sm"
            selectAttrs={{ 'data-script-skill': 'true' }}
            onTextChange={updateScriptDraft}
          />
        </label>
        {/* 文本模型 / 选择分段技能 / 分段按钮同处一行，按钮贴最右 */}
        <span className="iv-sb-count iv-sb-selector-actions">
          <button
            type="button"
            className="iv-btn iv-btn--action iv-btn--action--primary"
            data-segment-auto="true"
            disabled={busy || splitting || cleanScript.trim() === '' || (modelMode && activeTextModel === undefined)}
            title={modelMode && activeTextModel === undefined ? t('scriptSplitNeedsModel') : t('scriptSplitHint')}
            onClick={() => { void autoSplit() }}
          >
            <Icon name="sparkles" size={12} />{splitting ? t('scriptSplitting') : t('scriptSplit')}
          </button>
          <button
            type="button"
            className="iv-btn iv-btn--action"
            data-segment-add="true"
            disabled={busy || splitting}
            onClick={() => { void addSegment() }}
          >
            <Icon name="plus" size={12} />{t('segmentAdd')}
          </button>
        </span>
      </div>
      <div className="iv-sb-head iv-sb-segment-head">
        <span className="iv-micro">{t('segmentTitle')}</span>
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
