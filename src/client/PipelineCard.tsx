/**
 * 一键成片卡片（`P0-2`）：把「剧本 → 分镜 → 生图 → 生视频」做成一次点击。
 *
 * 只做 UI + 调用编排端点（`pipelines/compose`）；拆解、编排、落库都在宿主侧
 * （`planPipeline` + 画布 runner），所以这里没有业务规则可漂。
 *
 * 三条出口（2026-11-05 产品口径 `B5`/`B5.1`/`B6`）：
 * - **生成分镜**：只排版、不生成，结果就地列成**可编辑分镜**（提示词 / 本镜时长），
 *   用户改完再用同一份表单重排（时长走 `shotDurations`）；
 * - **生成画布**：排版 + 落库 + 切到画布，但**不起跑**——用户在画布确认后才生成；
 * - **就地生成**：不跳画布，按分镜逐镜调 `api.generateMedia`（图生视频先出图再出视频，
 *   视频生视频直接出视频），串行推进并回显到第几镜、第几镜失败。这是本卡片的主动作。
 *
 * 旧的「一键生成」（`pipelines/run`：起跑 + 跳画布）与上面两条口径冲突，2026-11-05 按产品决定删除；
 * 现在起跑只可能发生在「画布」或「就地生成」里，卡片自己不替用户烧钱。
 *
 * 为什么分镜细节由客户端算：编排结果只回分镜数/节点数/诊断，不回逐镜提示词，
 * 而「可编辑分镜」和「就地生成」都要按镜取提示词。这里调的是**宿主同一个纯函数**
 * `planPipeline`（同样的剧本/选项/资源 → 同样的分镜），所以不会出现两套口径。
 */
import { useEffect, useMemo, useState } from 'react'
import type { MediaGenerateResult, PipelineResult, PipelineRunInput, WorkbenchApi } from './api.ts'
import type { ResourceKind, ResourceRecord } from '../workbench/records.ts'
import {
  DEFAULT_SHOT_DURATION, MAX_SHOT_DURATION, MIN_SHOT_DURATION, planPipeline,
  type PipelineMode, type PipelineShot,
} from '../workbench/pipeline.ts'
import { Icon } from './icons.tsx'
import type { WorkbenchLocaleKey } from './locales.ts'

/** 卡片 props：注入 api / 词典 / 当前项目 / 起跑后的回调。 */
export interface PipelineCardProps {
  readonly api: WorkbenchApi
  readonly t: (key: WorkbenchLocaleKey) => string
  /** 当前项目；未选项目时按钮禁用并给提示。 */
  readonly projectId?: string
  /**
   * 编排落库后切到画布模式（由 Workbench 提供）。
   * `B5.1`：只切过去、**不**起跑——生成由用户在画布上确认后自己点。
   */
  readonly onStarted: (workflowId: string) => void
  /**
   * `T9` 外部注入的剧本（来自「剧本分镜」脚本，或"分镜 → 一键成片"直通）。
   * 变化时覆盖卡片内剧本（用户随后可继续编辑），实现"剧本只粘一遍"。
   */
  readonly injectScript?: string
  /**
   * 画布/素材区当前选中的素材（`B2`「用选中素材」的取数来源）。
   * 未注入时只留手填路径入口——不摆一个永远点不动的按钮。
   */
  readonly selectedAsset?: { readonly path: string; readonly kind: string }
}

/** 表单默认值：分镜 4、图生视频（可控性最好）；每镜时长取域口径（`B4`：6 秒）。 */
const DEFAULT_SHOTS = 4
/** 剧本输入框行数（`B1`：产品要求 6 行，一整段剧本不用先滚）。 */
const SCRIPT_ROWS = 6
/** 分镜上限：与域侧 `planPipeline` 的 `MAX_SHOTS` 一致。 */
const MAX_SHOTS = 60
/** 视频画幅：与编排缺省口径一致（`PipelineOptions.ratio` 缺省 16:9）。 */
const DEFAULT_RATIO = '16:9'

/**
 * 用户对某一镜的手工改动（`B5`）：画面提示词 / 视频提示词 / 本镜时长各自独立，
 * 没改的字段保持 `planPipeline` 算出来的值。
 */
interface ShotEdit {
  readonly imagePrompt?: string
  readonly videoPrompt?: string
  readonly duration?: number
}

/** 就地生成里一镜的运行状态（`B6`，串行推进的可视化）。 */
interface InlineRow {
  readonly index: number
  /** `pending` 未开始 / `image` 图已出 / `submitted` 视频已提交 / `failed` 失败。 */
  readonly status: 'pending' | 'image' | 'submitted' | 'failed'
  /** 产物路径（宿主同步返回时才有）。 */
  readonly path?: string
  /** 异步视频任务 id（宿主 `wait:false` 时返回）。 */
  readonly taskId?: string
  readonly error?: string
}

/**
 * 一键成片卡片。
 * @param props - 见 {@link PipelineCardProps}。
 * @returns 折叠式表单 + 可编辑分镜 + 就地生成进度 + 结果/提醒。
 */
export function PipelineCard(props: PipelineCardProps) {
  const { api, t, projectId, injectScript } = props
  const [open, setOpen] = useState(true)
  const [script, setScript] = useState('')
  // `T9`：外部注入的剧本变化时覆盖（空串不覆盖，避免把用户正在写的内容清掉）
  useEffect(() => {
    if (injectScript === undefined || injectScript.trim() === '') return
    setScript(injectScript)
  }, [injectScript])
  const [mode, setMode] = useState<PipelineMode>('image-to-video')
  const [shots, setShots] = useState(DEFAULT_SHOTS)
  const [duration, setDuration] = useState(DEFAULT_SHOT_DURATION)
  /** `B2`：视频生视频（复刻）的参考片；只有该模式会用。 */
  const [referenceVideo, setReferenceVideo] = useState('')
  // `B-18`：手动挑选物料——把指定资源 id 强制塞进流水线（留空则剧本自动匹配）。
  const [manualPick, setManualPick] = useState<readonly string[]>([])
  const [resources, setResources] = useState<readonly ResourceRecord[]>([])
  useEffect(() => {
    let stale = false
    if (projectId === undefined || projectId === '') { setResources([]); return }
    void (async () => {
      try {
        const rows = await api.listResources(projectId)
        if (!stale) setResources(rows)
      } catch {
        // 拉不到资源只是没法手动挑，不影响剧本自动匹配
      }
    })()
    return () => { stale = true }
  }, [api, projectId])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PipelineResult | undefined>(undefined)
  /** 上一次成功编排的入参——登记新物料后按同一入参重编，刷新自动匹配结果。 */
  const [composeInput, setComposeInput] = useState<PipelineRunInput | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  /** `B5`：最近一次排出来的分镜（可编辑列表的底稿）。 */
  const [plan, setPlan] = useState<readonly PipelineShot[]>([])
  /** `B5`：逐镜手工改动，键是 1-based 镜号。 */
  const [edits, setEdits] = useState<Readonly<Record<number, ShotEdit>>>({})
  /** `B6`：就地生成进度（每镜一行）与整体失败原因。 */
  const [inlineRows, setInlineRows] = useState<readonly InlineRow[]>([])
  const [inlineStage, setInlineStage] = useState<{ index: number; total: number; phase: 'image' | 'video' } | undefined>(undefined)
  const [inlineError, setInlineError] = useState<string | undefined>(undefined)

  // 剧本/模式/分镜数一变，上一轮的分镜与逐镜改动就不再对应当前剧本——清掉，免得出"改了剧本却还在看旧分镜"
  useEffect(() => {
    setPlan([])
    setEdits({})
    setInlineRows([])
    setInlineStage(undefined)
    setInlineError(undefined)
  }, [script, shots, mode])

  /** 只有图生视频有生图环节；`B2` 的视频生视频直接拿参考片复刻。 */
  const hasImageStage = mode === 'image-to-video'
  /** 用户是否真的逐镜改过时长（没改就不下发 `shotDurations`，免得多余提醒）。 */
  const hasDurationEdits = Object.values(edits).some(edit => edit.duration !== undefined)

  /** `B5`：底稿 + 逐镜改动后的分镜（列表渲染与就地生成都用这一份）。 */
  const editableShots = useMemo<readonly PipelineShot[]>(() => plan.map(shot => {
    const edit = edits[shot.index]
    if (edit === undefined) return shot
    return {
      ...shot,
      ...edit.imagePrompt === undefined ? {} : { imagePrompt: edit.imagePrompt },
      ...edit.videoPrompt === undefined ? {} : { videoPrompt: edit.videoPrompt },
      ...edit.duration === undefined ? {} : { duration: edit.duration },
    }
  }), [plan, edits])

  /** 资源 id → 名字（手动挑料的排序条要显示名字而不是 id）。 */
  const resourceNames = useMemo<ReadonlyMap<string, string>>(
    () => new Map(resources.map(resource => [resource.id, resource.name])),
    [resources],
  )

  const canRun = projectId !== undefined && projectId !== '' && script.trim() !== '' && !running

  /** 表单 + 逐镜改动 → 编排入参（`B2` 参考片 / `B5` 逐镜时长 / `B-18` 物料顺序都在这里定死）。 */
  const buildInput = (): PipelineRunInput => {
    const shotDurations = hasDurationEdits && editableShots.length > 0
      ? editableShots.map(shot => shot.duration)
      : undefined
    const reference = referenceVideo.trim()
    return {
      projectId: projectId as string,
      script,
      mode,
      shots,
      duration,
      ...shotDurations === undefined ? {} : { shotDurations },
      ...mode !== 'video-to-video' || reference === '' ? {} : { referenceVideo: reference },
      ...manualPick.length === 0 ? {} : { resourceIds: manualPick },
    }
  }

  /**
   * 客户端本地排一遍分镜（与宿主 `pipelines/compose` 调的是**同一个纯函数**）。
   * 只为了拿到逐镜提示词与时长；拆不出分镜时如实抛错，由调用方决定怎么提示。
   * @returns 与宿主口径一致的分镜列表。
   */
  const planLocally = (): readonly PipelineShot[] => {
    const style = resources.find(resource => resource.kind === 'style' && (resource.note ?? '') !== '')
    const reference = referenceVideo.trim()
    const draft = planPipeline({
      script,
      options: {
        mode,
        shots,
        duration,
        ...hasDurationEdits ? { shotDurations: editableShots.map(shot => shot.duration) } : {},
        ...mode !== 'video-to-video' || reference === '' ? {} : { referenceVideo: reference },
        ...style?.note === undefined ? {} : { styleNote: style.note },
        ...manualPick.length === 0 ? {} : { resourceIds: manualPick },
      },
      resources: resources.map(resource => ({
        id: resource.id,
        kind: resource.kind,
        name: resource.name,
        ...resource.note === undefined ? {} : { note: resource.note },
      })),
    })
    return draft.shots
  }

  /** 本地排版失败不算致命：宿主那边还会再验一次，界面回落到"没有可编辑分镜"。 */
  const planLocallySafe = (): readonly PipelineShot[] => {
    try {
      return planLocally()
    } catch {
      return []
    }
  }

  /**
   * 成功排版后的统一收尾：结果条 + 底稿分镜 + 清掉上一轮的运行态。
   * 分镜以**宿主返回的 `shotDetails` 为准**（它含宿主侧补的风格约束等），
   * 旧宿主没这个字段时才回落到本地排的那一份。
   */
  const acceptComposed = (composed: PipelineResult, input: PipelineRunInput, localShots: readonly PipelineShot[]): void => {
    setResult(composed)
    setComposeInput(input)
    setPlan(composed.shotDetails ?? localShots)
    setInlineRows([])
    setInlineStage(undefined)
    setInlineError(undefined)
  }

  /** `B5` 生成分镜：只排版不生成，排完后就地列出可编辑分镜。 */
  const composeOnly = async (): Promise<void> => {
    if (!canRun) return
    setRunning(true); setError(undefined); setResult(undefined)
    try {
      const input = buildInput()
      const localShots = planLocallySafe()
      const composed = await api.composePipeline(input)
      acceptComposed(composed, input, localShots)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRunning(false)
    }
  }

  /**
   * `B5.1` 生成画布：排版 + 落库 + 切到画布，**不** `workflows/run`。
   * 用户在画布上看清节点、确认参数后再自己点生成——不替他烧钱。
   */
  const buildCanvas = async (): Promise<void> => {
    if (!canRun) return
    setRunning(true); setError(undefined); setResult(undefined)
    try {
      const input = buildInput()
      const localShots = planLocallySafe()
      const composed = await api.composePipeline(input)
      acceptComposed(composed, input, localShots)
      props.onStarted(composed.workflowId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRunning(false)
    }
  }

  /** 就地生成里改某一镜的状态（串行推进时逐行刷新）。 */
  const updateInlineRow = (index: number, patch: Partial<InlineRow>): void => {
    setInlineRows(current => current.map(row => row.index === index ? { ...row, ...patch } : row))
  }

  /**
   * `B6` 就地生成：不跳画布，按分镜逐镜调 `api.generateMedia`。
   * 图生视频先出首帧图，再把图递给视频；视频生视频只出视频（带参考片）。
   * 串行 —— 一镜跑完再下一镜；失败立刻停，并在错误条里写明**第几镜**失败。
   */
  const inlineGenerate = async (): Promise<void> => {
    if (!canRun) return
    const reference = referenceVideo.trim()
    // `B2`：复刻模式没有参考片，先拦下来（不假装能"复刻"）
    if (mode === 'video-to-video' && reference === '') {
      setError(t('pipelineVideoToVideoNeedsRef'))
      return
    }
    // 分镜来源：优先用「生成分镜」列出来的（可能逐条改过）；没排过就本地先排一遍
    let shotsToRun = editableShots
    if (shotsToRun.length === 0) {
      try {
        shotsToRun = planLocally()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause))
        return
      }
      setPlan(shotsToRun)
    }
    if (shotsToRun.length === 0) {
      setError(t('generateFailed'))
      return
    }
    const total = shotsToRun.length
    setRunning(true); setError(undefined); setInlineError(undefined); setResult(undefined)
    setInlineRows(shotsToRun.map(shot => ({ index: shot.index, status: 'pending' })))
    let currentIndex = shotsToRun[0]?.index ?? 1
    try {
      for (const shot of shotsToRun) {
        currentIndex = shot.index
        setInlineStage({ index: shot.index, total, phase: hasImageStage ? 'image' : 'video' })
        let imagePath: string | undefined
        if (hasImageStage) {
          const image: MediaGenerateResult = await api.generateMedia({
            mediaMode: 'image',
            prompt: shot.imagePrompt,
            projectId: projectId as string,
          })
          if (image.path === undefined) throw new Error(t('generateFailed'))
          imagePath = image.path
          updateInlineRow(shot.index, { status: 'image', path: image.path })
          setInlineStage({ index: shot.index, total, phase: 'video' })
        }
        const video: MediaGenerateResult = await api.generateMedia({
          mediaMode: 'video',
          prompt: shot.videoPrompt,
          projectId: projectId as string,
          // `B4`/`B5`：用**本镜自己的**秒数，不套全局值
          duration: shot.duration,
          aspectRatio: DEFAULT_RATIO,
          wait: false,
          ...imagePath === undefined ? {} : { image: imagePath },
          // `B2`：复刻模式把参考片按既有 `media[]` 契约透传（不另立参数）
          ...mode === 'video-to-video' ? { media: [{ video: reference, type: 'reference_video' }] } : {},
        })
        if (video.path !== undefined) updateInlineRow(shot.index, { status: 'submitted', path: video.path })
        else if (video.taskId !== undefined) updateInlineRow(shot.index, { status: 'submitted', taskId: video.taskId })
        else throw new Error(t('generateFailed'))
      }
      setInlineStage(undefined)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      updateInlineRow(currentIndex, { status: 'failed', error: message })
      // 镜号放最前面：一次跑多镜时，"第几镜坏了"是这个错误条唯一的有效信息
      setInlineError(`#${currentIndex} · ${t('generateFailed')}：${message}`)
      setInlineStage(undefined)
    } finally {
      setRunning(false)
    }
  }

  /**
   * 把「物料缺失」清单里的一个名字登记进资源库，然后按上一次编排的同一入参重新 compose——
   * 自动匹配是宿主行为，重编一次即可刷新 missing/warnings，不需要新端点。
   * 登记失败如实报错，不伪造"已匹配"。
   */
  const registerMissing = async (name: string, kind: ResourceKind): Promise<void> => {
    const input = composeInput
    if (input === undefined) return
    setRunning(true)
    setError(undefined)
    try {
      await api.createResource({ projectId: input.projectId, kind, name })
      const recomposed = await api.composePipeline(input)
      setResult(recomposed)
      // 新登记的资源会改变分镜里的角色/场景命中，可编辑分镜也要跟着重排一次
      setPlan(recomposed.shotDetails ?? planLocallySafe())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRunning(false)
    }
  }

  /**
   * `B7` 手动挑料的顺序调整：上移/下移一位。
   * 顺序即语义（先拿哪份参考图生成、再拿哪份），所以调完直接写进 `resourceIds`。
   */
  const movePick = (from: number, delta: number): void => {
    setManualPick(current => {
      const to = from + delta
      const moved = current[from]
      if (moved === undefined || to < 0 || to >= current.length) return current
      const next = [...current]
      next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  /** `B5` 逐镜改动：只覆盖改过的字段（提示词与时长互不影响）。 */
  const editShot = (index: number, patch: ShotEdit): void => {
    setEdits(current => ({ ...current, [index]: { ...current[index], ...patch } }))
  }

  return (
    <div className="iv-card" data-pipeline-card="true">
      <button
        type="button"
        className="iv-card-head"
        data-pipeline-toggle="true"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <Icon name="bolt" size={13} />
        <strong>{t('pipelineCardTitle')}</strong>
        <span className="iv-meta" style={{ marginLeft: 'auto' }}>{open ? '−' : '+'}</span>
      </button>

      {open
        ? (
          <div className="iv-card-body" style={{ display: 'grid', gap: 'var(--iv-sp-4)' }}>
            <span className="iv-meta">{t('pipelineScriptLabel')}</span>
            {/* `B1`：6 行高——一整段剧本粘贴进来不用先滚才看得全 */}
            <textarea
              className="iv-input"
              rows={SCRIPT_ROWS}
              value={script}
              placeholder={t('pipelineScriptPlaceholder')}
              data-pipeline-script="true"
              disabled={running}
              onChange={event => setScript(event.target.value)}
              style={{ resize: 'vertical', font: 'inherit', padding: '6px 8px', borderRadius: '6px' }}
            />
            <div style={{ display: 'flex', gap: 'var(--iv-sp-5)', flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="iv-check">
                {/* `B2`：三种模式——图生视频 / 文生视频 / 视频生视频（复刻） */}
                <select
                  className="iv-input"
                  data-pipeline-mode="true"
                  value={mode}
                  disabled={running}
                  onChange={event => {
                    const next = event.target.value
                    setMode(next === 'text-to-video' ? 'text-to-video' : next === 'video-to-video' ? 'video-to-video' : 'image-to-video')
                  }}
                >
                  <option value="image-to-video">{t('pipelineModeImageToVideo')}</option>
                  <option value="text-to-video">{t('pipelineModeTextToVideo')}</option>
                  <option value="video-to-video">{t('pipelineModeVideoToVideo')}</option>
                </select>
              </label>
              <label className="iv-check">
                {t('pipelineShots')}
                <input
                  className="iv-input"
                  data-pipeline-shots="true"
                  type="number"
                  min={1}
                  max={MAX_SHOTS}
                  value={shots}
                  disabled={running}
                  onChange={event => setShots(Math.max(1, Math.min(MAX_SHOTS, Number(event.target.value) || 1)))}
                  style={{ width: '64px' }}
                />
              </label>
              <label className="iv-check" title={t('pipelineShotDuration')}>
                {t('pipelineDuration')}
                <input
                  className="iv-input"
                  data-pipeline-duration="true"
                  type="number"
                  min={MIN_SHOT_DURATION}
                  max={MAX_SHOT_DURATION}
                  value={duration}
                  disabled={running}
                  onChange={event => setDuration(Math.max(MIN_SHOT_DURATION, Math.min(MAX_SHOT_DURATION, Number(event.target.value) || MIN_SHOT_DURATION)))}
                  style={{ width: '64px' }}
                />
              </label>
              <button
                type="button"
                className="iv-btn iv-btn--ghost iv-btn--sm"
                data-pipeline-compose="true"
                disabled={!canRun}
                onClick={() => { void composeOnly() }}
              >
                {t('pipelineCompose')}
              </button>
              {/* `B5.1`：铺到画布但不生成——用户在画布确认后才烧钱 */}
              <button
                type="button"
                className="iv-btn iv-btn--ghost iv-btn--sm"
                data-pipeline-to-canvas="true"
                title={t('pipelineToCanvasHint')}
                disabled={!canRun}
                onClick={() => { void buildCanvas() }}
              >
                <Icon name="flow" size={12} />
                {t('pipelineToCanvas')}
              </button>
              {/* `B6`：不跳画布，就地逐镜出图出片——本卡片的主动作（一键成片） */}
              <button
                type="button"
                className="iv-btn iv-btn--primary iv-btn--sm"
                data-pipeline-inline-run="true"
                title={t('pipelineInlineRunHint')}
                disabled={!canRun}
                onClick={() => { void inlineGenerate() }}
              >
                <Icon name="film" size={12} />
                {running ? t('pipelineRunning') : t('pipelineInlineRun')}
              </button>
              {projectId === undefined || projectId === ''
                ? <span className="iv-meta">{t('pipelineNeedsProject')}</span>
                : null}
            </div>
            <span className="iv-meta" data-pipeline-button-hints="true">
              {t('pipelineToCanvasHint')} · {t('pipelineInlineRunHint')}
            </span>

            {/* `B2` 视频生视频（复刻）：参考片选择——手填路径，或（宿主注入时）用选中素材 */}
            {mode === 'video-to-video'
              ? (
                <div className="iv-sub" data-pipeline-ref-video="true">
                  <div className="iv-sub-head">
                    <span className="iv-sub-title">
                      <Icon name="video" size={12} />
                      {t('videoReferenceVideo')}
                    </span>
                    <span className="iv-sub-actions">
                      {props.selectedAsset !== undefined && props.selectedAsset.kind === 'video'
                        ? (
                          <button
                            type="button"
                            className="iv-btn iv-btn--ghost iv-btn--sm"
                            data-pipeline-ref-video-use="true"
                            disabled={running}
                            onClick={() => { setReferenceVideo(props.selectedAsset?.path ?? '') }}
                          >
                            {t('generateUseSelected')}
                          </button>
                        )
                        : null}
                    </span>
                  </div>
                  <input
                    className="iv-input"
                    data-pipeline-ref-video-input="true"
                    type="text"
                    value={referenceVideo}
                    placeholder={t('generateReferenceNone')}
                    aria-label={t('videoReferenceVideo')}
                    disabled={running}
                    onChange={event => setReferenceVideo(event.target.value)}
                  />
                  {referenceVideo.trim() === ''
                    ? <span className="iv-meta" data-pipeline-ref-video-missing="true">{t('pipelineVideoToVideoNeedsRef')}</span>
                    : null}
                </div>
              )
              : null}

            {/* `B-18` 手动挑选物料：把指定资源 id 强制塞进流水线 */}
            <div className="iv-pipeline-pick" data-pipeline-pick="true">
              <span className="iv-meta">{t('pipelineManualPick')}</span>
              <span className="iv-meta">{t('pipelineManualPickHint')}</span>
              {resources.length === 0
                ? <span className="iv-meta">{t('pipelineManualPickEmpty')}</span>
                : (
                  <div className="iv-pick-list" data-pipeline-pick-list="true">
                    {resources.map(resource => (
                      <label key={resource.id} className="iv-check">
                        <input
                          type="checkbox"
                          data-pipeline-pick-item={resource.id}
                          checked={manualPick.includes(resource.id)}
                          disabled={running}
                          onChange={event => {
                            const next = event.target.checked
                              ? [...manualPick, resource.id]
                              : manualPick.filter(id => id !== resource.id)
                            setManualPick(next)
                          }}
                        />
                        <span>{resource.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              {/* `B7`：挑选顺序就是生成顺序——上移/下移自己排，排完写进 resourceIds */}
              {manualPick.length === 0
                ? null
                : (
                  <div
                    data-pipeline-pick-order="true"
                    style={{ display: 'flex', gap: 'var(--iv-sp-3)', flexWrap: 'wrap', alignItems: 'center' }}
                  >
                    {manualPick.map((id, position) => (
                      <span className="iv-chip" key={id} data-pipeline-pick-selected={id}>
                        <span style={{ marginRight: '2px' }}>{position + 1}. {resourceNames.get(id) ?? id}</span>
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          data-pipeline-pick-up={id}
                          title={t('storyboardMoveUp')}
                          aria-label={t('storyboardMoveUp')}
                          disabled={running || position === 0}
                          onClick={() => { movePick(position, -1) }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          data-pipeline-pick-down={id}
                          title={t('storyboardMoveDown')}
                          aria-label={t('storyboardMoveDown')}
                          disabled={running || position === manualPick.length - 1}
                          onClick={() => { movePick(position, 1) }}
                        >
                          ↓
                        </button>
                      </span>
                    ))}
                    <span className="iv-meta" data-pipeline-pick-count="true">
                      {t('pipelineManualPickCount').replace('{n}', String(manualPick.length))}
                      <button
                        type="button"
                        className="iv-btn iv-btn--ghost iv-btn--sm"
                        data-pipeline-pick-clear="true"
                        disabled={running}
                        onClick={() => { setManualPick([]) }}
                      >
                        {t('pipelineManualPickClear')}
                      </button>
                    </span>
                  </div>
                )}
            </div>

            {error === undefined ? null : <p className="iv-err" data-pipeline-error="true">{error}</p>}

            {/* `B5` 可编辑分镜：提示词与「本镜时长」都能改，改完再点「生成分镜」按新时长重排 */}
            {editableShots.length === 0
              ? null
              : (
                <div className="iv-sub" data-pipeline-shots-panel="true">
                  <div className="iv-sub-head">
                    <span className="iv-sub-title">
                      <Icon name="storyboard" size={12} />
                      {t('pipelineShots')} {editableShots.length}
                    </span>
                    <span className="iv-sub-actions iv-meta">{t('pipelineShotEditable')}</span>
                  </div>
                  {editableShots.map(shot => (
                    <div
                      key={shot.index}
                      data-pipeline-shot={shot.index}
                      style={{ display: 'grid', gap: 'var(--iv-sp-2)', paddingBottom: 'var(--iv-sp-3)' }}
                    >
                      <span className="iv-meta">#{shot.index} · {shot.shot}</span>
                      <label className="iv-check" style={{ alignItems: 'flex-start' }}>
                        <span className="iv-meta" style={{ minWidth: '72px' }}>{t('storyboardVideoPromptLabel')}</span>
                        <textarea
                          className="iv-input"
                          rows={2}
                          data-pipeline-shot-video-prompt={shot.index}
                          value={shot.videoPrompt}
                          disabled={running}
                          onChange={event => { editShot(shot.index, { videoPrompt: event.target.value }) }}
                          style={{ flex: 1, resize: 'vertical', font: 'inherit', padding: '4px 6px', borderRadius: '6px' }}
                        />
                      </label>
                      {hasImageStage
                        ? (
                          <label className="iv-check" style={{ alignItems: 'flex-start' }}>
                            <span className="iv-meta" style={{ minWidth: '72px' }}>{t('storyboardImagePromptLabel')}</span>
                            <textarea
                              className="iv-input"
                              rows={2}
                              data-pipeline-shot-image-prompt={shot.index}
                              value={shot.imagePrompt}
                              disabled={running}
                              onChange={event => { editShot(shot.index, { imagePrompt: event.target.value }) }}
                              style={{ flex: 1, resize: 'vertical', font: 'inherit', padding: '4px 6px', borderRadius: '6px' }}
                            />
                          </label>
                        )
                        : null}
                      <label className="iv-check">
                        {t('pipelineShotDuration')}
                        <input
                          className="iv-input"
                          data-pipeline-shot-duration={shot.index}
                          type="number"
                          min={MIN_SHOT_DURATION}
                          max={MAX_SHOT_DURATION}
                          value={shot.duration}
                          disabled={running}
                          onChange={event => {
                            const next = Math.max(MIN_SHOT_DURATION, Math.min(MAX_SHOT_DURATION, Number(event.target.value) || MIN_SHOT_DURATION))
                            editShot(shot.index, { duration: next })
                          }}
                          style={{ width: '64px' }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}

            {/* `B6` 就地生成进度：逐镜一行，失败的行写明原因 */}
            {inlineRows.length === 0
              ? null
              : (
                <div className="iv-sub" data-pipeline-inline="true">
                  <div className="iv-sub-head">
                    <span className="iv-sub-title">
                      <Icon name="film" size={12} />
                      {t('pipelineInlineRun')}
                    </span>
                    <span className="iv-sub-actions iv-meta" data-pipeline-inline-progress="true">
                      {inlineStage === undefined
                        ? t('pipelineInlineRunHint')
                        : `${t('pipelineRunning')} #${inlineStage.index}/${inlineStage.total} · ${inlineStage.phase === 'image' ? t('storyboardImagePromptLabel') : t('storyboardVideoPromptLabel')}`}
                    </span>
                  </div>
                  {inlineRows.map(row => (
                    <span
                      className="iv-meta"
                      key={row.index}
                      data-pipeline-inline-row={row.index}
                      data-pipeline-inline-state={row.status}
                    >
                      #{row.index} · {row.status === 'failed'
                        ? `${t('generateFailed')}：${row.error ?? ''}`
                        : row.status === 'pending'
                          ? t('pipelineRunning')
                          : row.path ?? row.taskId ?? t('pipelineStarted')}
                    </span>
                  ))}
                  {inlineError === undefined
                    ? null
                    : <span className="iv-err" data-pipeline-inline-error="true">{inlineError}</span>}
                </div>
              )}

            {result === undefined
              ? null
              : (
                <div className="iv-card-note" data-pipeline-result="true" style={{ display: 'grid', gap: 'var(--iv-sp-2)' }}>
                  <span className="iv-chip iv-chip--ok">
                    <Icon name="check" size={11} />
                    {t('pipelineComposed')}：{result.name}
                  </span>
                  <span className="iv-meta">
                    {result.shots} {t('pipelineShotsCount')} · {result.nodes} nodes · {result.workflowId}
                  </span>
                  {(result.warnings ?? []).length === 0
                    ? null
                    : (
                      <ul className="iv-meta" style={{ margin: 0, paddingLeft: '18px' }}>
                        {(result.warnings ?? []).map(warning => <li key={warning}>{t('pipelineWarnings')}：{warning}</li>)}
                      </ul>
                    )}
                  {(result.missingResources ?? []).length === 0
                    ? <span className="iv-meta" data-pipeline-missing-none="true">{t('pipelineMissingNone')}</span>
                    : (
                      <div style={{ display: 'grid', gap: 'var(--iv-sp-2)' }} data-pipeline-missing="true">
                        <span className="iv-meta">
                          <Icon name="alert" size={11} /> {t('pipelineMissingTitle')}
                        </span>
                        <span className="iv-meta">{t('pipelineMissingHint')}</span>
                        <div style={{ display: 'flex', gap: 'var(--iv-sp-3)', flexWrap: 'wrap' }}>
                          {(result.missingResources ?? []).map(name => (
                            <span className="iv-chip iv-chip--warn" key={name} data-pipeline-missing-item={name}>
                              <span style={{ marginRight: '4px' }}>{name}</span>
                              {(['role', 'scene', 'prop'] as const).map(kind => (
                                <button
                                  key={kind}
                                  type="button"
                                  className="iv-btn iv-btn--ghost iv-btn--sm"
                                  data-pipeline-register={kind}
                                  disabled={running}
                                  onClick={() => { void registerMissing(name, kind) }}
                                >
                                  {t(kind === 'role' ? 'pipelineRegisterRole' : kind === 'scene' ? 'pipelineRegisterScene' : 'pipelineRegisterProp')}
                                </button>
                              ))}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  {/* `B-18` 匹配到的物料回显（手动挑的 + 剧本自动匹配的都在这） */}
                  {result.matchedResources === undefined || result.matchedResources.length === 0
                    ? null
                    : (
                      <div data-pipeline-matched="true" style={{ display: 'grid', gap: 'var(--iv-sp-2)' }}>
                        <span className="iv-meta"><Icon name="layers" size={11} /> {t('pipelineMatchedTitle')}</span>
                        <div style={{ display: 'flex', gap: 'var(--iv-sp-3)', flexWrap: 'wrap' }}>
                          {result.matchedResources.map(item => (
                            <span key={item.resourceId} className="iv-chip" data-pipeline-matched-item={item.resourceId}>
                              {t('pipelineMatchedItem').replace('{name}', item.name).replace('{kind}', item.kind)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
          </div>
        )
        : null}
    </div>
  )
}
