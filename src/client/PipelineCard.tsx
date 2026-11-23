/**
 * 一键成片卡片（`P0-2`）：把「剧本 → 分镜 → 生图 → 生视频」做成一次点击。
 *
 * 只做 UI + 调用编排端点（`pipelines/compose`）；拆解、编排、落库都在宿主侧
 * （`planPipeline` + 画布 runner），所以这里没有业务规则可漂。
 *
 * 四个出口（2026-11-05 口径 `B5`/`B5.1`/`B6`，2026-11-19 `B-21` 精简为两个生成按钮）：
 * - **生成分镜**：只排版、不生成，结果就地列成**可编辑分镜**（提示词 / 本镜时长），
 *   用户改完再用同一份表单重排（时长走 `shotDurations`）；
 * - **生成画布**：排版 + 落库 + 切到画布，但**不起跑**——用户在画布确认后才生成；
 * - **生成图片**：不跳画布，按分镜逐镜只调生图；
 * - **生成视频**：不跳画布，按分镜逐镜调生视频；这是本卡片的主动作。
 * 两者都串行推进并回显到第几镜、第几镜失败。
 *
 * 旧的「一键生成」（`pipelines/run`：起跑 + 跳画布）与上面两条口径冲突，2026-11-05 按产品决定删除；
 * 现在起跑只可能发生在「画布」或就地生成里，卡片自己不替用户烧钱。
 *
 * 为什么分镜细节由客户端算：编排结果只回分镜数/节点数/诊断，不回逐镜提示词，
 * 而「可编辑分镜」和就地生成都要按镜取提示词。这里调的是**宿主同一个纯函数**
 * `planPipeline`（同样的剧本/选项/资源 → 同样的分镜），所以不会出现两套口径。
 *
 * `B-20`（2026-11-19）：原「分镜工坊」折叠区已并入本卡片，按渐进披露分三层：
 * - 默认（L0）：剧本 → 一键「生成分镜」，默认 4 镜 / 6 秒 / 自动匹配资源；
 * - 入门（L1）：导演技能、分镜数、每镜秒数，以及「生成画布」「生成图片」「生成视频」；
 * - 专业（L2）：逐镜全字段（镜头描述/场景/角色/两条提示词/时长）、增删移、局部重拆、
 *   单镜生成图片/视频/送画布、剧本模型、剧本文件导入。
 *
 * 「指定物料」只在项目有资源时出现；「导出分镜表」「保存到本集分镜」只在有分镜时出现，
 * 都没有就不占位，也不靠折叠块藏功能。
 *
 * 切换剧集时表单按项目保存/恢复（见 `switchPipelineProject`），不会把上一部的剧本留在下一部。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ImportedScriptView, MediaGenerateResult, PipelineResult, PipelineRunInput, StoryboardEntityLibraryView,
  TextModelOption, WorkbenchApi,
} from './api.ts'
import type { ResourceKind, ResourceRecord } from '../workbench/records.ts'
import { newWorkbenchId } from '../workbench/records.ts'
import {
  MAX_SHOT_DURATION, MIN_SHOT_DURATION, planPipeline,
  type PipelineShot,
} from '../workbench/pipeline.ts'
import { splitScriptWindows } from '../workbench/script-window.ts'
import {
  defaultParams, WORKFLOW_SOURCE_HANDLE, WORKFLOW_TARGET_HANDLE, type WorkflowRecord,
} from '../workbench/workflow.ts'
import { MAX_SEGMENT_DURATION_SEC, MIN_SEGMENT_DURATION_SEC } from '../workbench/episodes.ts'
import type { EpisodeRecord } from '../workbench/episodes.ts'
import { MAX_PLAN_EPISODES, MAX_PLAN_SEGMENTS, MAX_PLAN_SHOTS } from '../workbench/episode-plan.ts'
import type { SkillRecord } from '../workbench/skills.ts'
import { Icon } from './icons.tsx'
import { getWorkbenchField, switchPipelineProject, useWorkbenchField } from './workbench-store.ts'
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
   * 当前剧集：给了才允许「保存到本集分镜」（`B-20`）。分镜必须挂在分段下，
   * 没有分段时会就地建一个——不替用户改动已有分段。
   */
  readonly episodeId?: string
  /**
   * 「生成剧本」落库后把受影响的集交回（`B-22`）：外层刷新集列表并选中最先新建的一集。
   * 缺省时不通知，只在卡片里给一条成功提示。
   */
  readonly onEpisodesGenerated?: (episodes: readonly EpisodeRecord[]) => void | Promise<void>
}

/** 表单默认值（分镜 4、图生视频、每镜 6 秒）由 `workbench-store` 持有，面板重挂载后沿用。 */
/** 剧本输入框行数（`B1`：产品要求 6 行，一整段剧本不用先滚）。 */
const SCRIPT_ROWS = 6
/** 分镜上限：与域侧 `planPipeline` 的 `MAX_SHOTS` 一致。 */
const MAX_SHOTS = 60
/** 视频画幅：与编排缺省口径一致（`PipelineOptions.ratio` 缺省 16:9）。 */
const DEFAULT_RATIO = '16:9'
/**
 * 编排模式：界面不再让用户选图生/文生——画布统一按「图 + 视频」两段铺，
 * 就地生成则由「生成图片」「生成视频」两个按钮分别决定实际调用。
 */
const MODE = 'image-to-video' as const
/** 就地生成等成片：每条任务账本的轮询间隔。 */
const TASK_POLL_INTERVAL_MS = 1000
/** 就地生成等成片：单条视频最多等 15 分钟，超时按失败停下，绝不静默跳下一镜。 */
const TASK_POLL_ATTEMPTS = 900

/**
 * 等一条异步视频任务落终态（`C5`）。
 *
 * `wait:false` 只代表提交成功；就地生成必须拿到成片路径才算这一镜跑完，
 * 否则串行推进与「第几镜失败」都会失真。任务账本按剧集过滤后按任务 id 找回。
 * @param api - 工作台 API。
 * @param taskId - `media/generate` 返回的任务 id。
 * @param projectId - 任务归属的剧集。
 * @param t - 词典（错误文案）。
 * @returns 成片路径。
 * @throws {Error} 任务失败、取消、没有产物路径或等待超时。
 */
async function awaitVideoTask(
  api: WorkbenchApi,
  taskId: string,
  projectId: string,
  t: (key: WorkbenchLocaleKey) => string,
): Promise<string> {
  for (let attempt = 0; attempt < TASK_POLL_ATTEMPTS; attempt += 1) {
    const tasks = await api.listTasks(50, projectId)
    const task = tasks.find(candidate => candidate.id === taskId)
    if (task?.status === 'succeeded') {
      if (task.outputPath === undefined || task.outputPath === '') throw new Error(t('pipelineInlineVideoNoOutput'))
      return task.outputPath
    }
    if (task?.status === 'failed') throw new Error(`${t('pipelineInlineVideoFailed')}：${task.error ?? ''}`)
    if (task?.status === 'cancelled') throw new Error(t('pipelineInlineVideoCancelled'))
    await new Promise(resolve => setTimeout(resolve, TASK_POLL_INTERVAL_MS))
  }
  throw new Error(t('pipelineInlineVideoTimeout'))
}

/**
 * 用户对某一镜的手工改动（`B5`）：画面提示词 / 视频提示词 / 本镜时长各自独立，
 * 没改的字段保持 `planPipeline` 算出来的值。
 */
interface ShotEdit {
  /** 镜头一句话描述（专业层可改）。 */
  readonly shot?: string
  readonly imagePrompt?: string
  readonly videoPrompt?: string
  readonly duration?: number
  /** 本镜角色名（逗号分隔编辑，存成数组）。 */
  readonly characters?: readonly string[]
  /** 本镜场景名。 */
  readonly scene?: string
}

/**
 * 界面上的一镜：`PipelineShot` 加上可编辑的角色/场景。
 * 拆解结果本身不带角色/场景（宿主只回提示词），这里给空数组兜底。
 */
type EditableShot = PipelineShot & {
  readonly characters: readonly string[]
  readonly scene?: string
}

/**
 * 把文本下载成文件（导出分镜表用；纯客户端，不经过宿主）。
 * @param fileName - 下载文件名。
 * @param text - 文件内容。
 */
function downloadText(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

/** 已选择/已导入的一份剧本文件（`B-20`）。 */
interface ImportedFile {
  readonly name: string
  /** `importing` 解析中 / `done` 已并入剧本 / `failed` 解析失败（保留在列表里说明原因）。 */
  readonly status: 'importing' | 'done' | 'failed'
  readonly error?: string
}

/**
 * 把浏览器拿到的文件字节转成 base64（浏览器没有 `Buffer`）。
 * @param bytes - 文件内容。
 * @returns base64 字符串。
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

/** 就地生成里一镜的运行状态（`B6`，串行推进的可视化）。 */
interface InlineRow {
  readonly index: number
  /** `pending` 未开始 / `image` 图已出 / `submitted` 视频已成片 / `failed` 失败。 */
  readonly status: 'pending' | 'image' | 'submitted' | 'failed'
  /** 产物路径（宿主同步返回，或 `C5` 等到任务成片后回填）。 */
  readonly path?: string
  /** 异步视频任务 id（等成片期间先展示，便于对账）。 */
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
  const [script, setScript] = useWorkbenchField(api, 'pipelineScript')
  // `T9`：外部注入的剧本变化时覆盖（空串不覆盖，避免把用户正在写的内容清掉）
  useEffect(() => {
    if (injectScript === undefined || injectScript.trim() === '') return
    setScript(injectScript)
  }, [injectScript])
  const [shots, setShots] = useWorkbenchField(api, 'pipelineShots')
  const [duration, setDuration] = useWorkbenchField(api, 'pipelineDuration')
  /** `B-22` 剧本结构的三级规模（集 / 每集段 / 每段镜）。 */
  const [planEpisodes, setPlanEpisodes] = useState(1)
  const [planSegments, setPlanSegments] = useState(3)
  const [planShots, setPlanShots] = useState(4)
  /** 「生成剧本」进行态：与普通编排互斥，避免结构生成时又起一轮。 */
  const [generatingScript, setGeneratingScript] = useState(false)
  /** `B-20`：增强分镜提示词的导演技能；默认取第一条启用中的。 */
  const [skillId, setSkillId] = useWorkbenchField(api, 'pipelineSkillId')
  const [skills, setSkills] = useState<readonly SkillRecord[]>([])
  /** 已选择/已导入的剧本文件：选中就立刻显示名字，解析失败也保留并标出原因。 */
  const [importedFiles, setImportedFiles] = useState<readonly ImportedFile[]>([])
  /** 浏览器文件选择器：点按钮再打开系统窗口，不要求用户手填路径。 */
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  /** 剧本输入框：导入成功后把它滚到末尾，明确"内容追加到了这里"。 */
  const scriptRef = useRef<HTMLTextAreaElement | null>(null)
  // 切换剧集：成片表单按项目保存/恢复，避免还显示上一部的剧本与分镜
  useEffect(() => {
    switchPipelineProject(api, projectId ?? '')
    // 切换项目后剧本已换成目标项目的，上一部的已引用文件不再对应
    setImportedFiles([])
  }, [api, projectId])
  // `B-18`：手动挑选物料——把指定资源 id 强制塞进流水线（留空则剧本自动匹配）。
  const [manualPick, setManualPick] = useWorkbenchField(api, 'pipelineManualPick')
  /** `B-20`：拆分镜用的文本模型（`provider::model`）；空串 = 只用规则拆解。 */
  const [textModelKey, setTextModelKey] = useWorkbenchField(api, 'pipelineTextModel')
  const [textModels, setTextModels] = useState<readonly TextModelOption[]>([])
  useEffect(() => {
    let stale = false
    void (async () => {
      try {
        const catalog = await api.listTextModels()
        if (!stale) setTextModels(catalog.models)
      } catch {
        // 拿不到模型目录就只剩规则拆解：界面上的"只用规则"始终可用
      }
    })()
    return () => { stale = true }
  }, [api])
  // `B-20`：导演技能列表；默认选中第一条启用中的技能（用户没选过时）
  useEffect(() => {
    let stale = false
    void (async () => {
      try {
        const rows = await api.listSkills('director', true)
        if (stale) return
        setSkills(rows)
        const first = rows[0]
        if (first !== undefined && getWorkbenchField(api, 'pipelineSkillId') === '') setSkillId(first.id)
      } catch {
        // 技能库拿不到时分镜照常生成，只是没有技能增强
      }
    })()
    return () => { stale = true }
  }, [api])
  /** 分镜来源与模型给出的提醒（`B-20`）：让用户知道这份分镜是谁拆的。 */
  const [planSource, setPlanSource] = useState<'model' | 'rules' | undefined>(undefined)
  const [planWarnings, setPlanWarnings] = useState<readonly string[]>([])
  /** `B-20`：模型拆出的实体库（角色/道具/场景），展示与局部重拆都用它。 */
  const [entities, setEntities] = useState<StoryboardEntityLibraryView | undefined>(undefined)
  /** 一次性操作反馈（导入 / 导出 / 落库）。 */
  const [notice, setNotice] = useState<string | undefined>(undefined)
  /** `B-20` 剧本文件导入的进行态。 */
  const [importing, setImporting] = useState(false)
  /** `B-20` 局部重拆：正在重拆的镜号。 */
  const [replanning, setReplanning] = useState<number | undefined>(undefined)
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
  /** `B5`：最近一次排出来的分镜（可编辑列表的底稿；含角色/场景这些宿主不回传的字段）。 */
  const [plan, setPlan] = useState<readonly EditableShot[]>([])
  /** `B5`：逐镜手工改动，键是 1-based 镜号。 */
  const [edits, setEdits] = useState<Readonly<Record<number, ShotEdit>>>({})
  /** `B6`：就地生成进度（每镜一行）与整体失败原因。 */
  const [inlineRows, setInlineRows] = useState<readonly InlineRow[]>([])
  const [inlineStage, setInlineStage] = useState<{ index: number; total: number; phase: 'image' | 'video' } | undefined>(undefined)
  const [inlineError, setInlineError] = useState<string | undefined>(undefined)
  /** 长剧本的段号（0 起）；导入整本小说后按段拆，避免一次几十万字送进模型。 */
  const [windowIndex, setWindowIndex] = useState(0)
  /** 超过单段上限才切段：短剧本保持原样，不多一层选择。 */
  const scriptWindows = useMemo(() => splitScriptWindows(script), [script])
  const activeWindow = scriptWindows.length === 0
    ? undefined
    : scriptWindows[Math.min(windowIndex, scriptWindows.length - 1)]
  /** 真正送进拆解/编排的正文：切过段就只取当前段。 */
  const planningScript = activeWindow?.text ?? script

  // 剧本/模式/分镜数一变，上一轮的分镜与逐镜改动就不再对应当前剧本——清掉，免得出"改了剧本却还在看旧分镜"
  useEffect(() => {
    setWindowIndex(0)
    setPlan([])
    setEdits({})
    setInlineRows([])
    setInlineStage(undefined)
    setInlineError(undefined)
    setPlanSource(undefined)
    setPlanWarnings([])
    setEntities(undefined)
  }, [script, shots])

  /**
   * 选中的文本模型：`provider::model` 拆开；没选或模型已不在目录里就是"只用规则"。
   * 模型目录晚于选择加载，所以这里不因"暂时没有目录"就清掉用户的选择。
   */
  const selectedModel = useMemo((): { provider: string; model: string } | undefined => {
    const separator = textModelKey.indexOf('::')
    if (separator <= 0) return undefined
    const provider = textModelKey.slice(0, separator)
    const model = textModelKey.slice(separator + 2)
    return provider === '' || model === '' ? undefined : { provider, model }
  }, [textModelKey])

  /** 每一镜都同时有画面提示词与视频提示词：生成图片、生成视频各自取一条。 */
  const hasImageStage = true
  /** 用户是否真的逐镜改过时长（没改就不下发 `shotDurations`，免得多余提醒）。 */
  const hasDurationEdits = Object.values(edits).some(edit => edit.duration !== undefined)

  /** `B5`：底稿 + 逐镜改动后的分镜（列表渲染与就地生成都用这一份）。 */
  const editableShots = useMemo<readonly EditableShot[]>(() => plan.map(shot => {
    const edit = edits[shot.index]
    if (edit === undefined) return shot
    return {
      ...shot,
      ...edit.shot === undefined ? {} : { shot: edit.shot },
      ...edit.imagePrompt === undefined ? {} : { imagePrompt: edit.imagePrompt },
      ...edit.videoPrompt === undefined ? {} : { videoPrompt: edit.videoPrompt },
      ...edit.duration === undefined ? {} : { duration: edit.duration },
      ...edit.characters === undefined ? {} : { characters: edit.characters },
      ...edit.scene === undefined ? {} : { scene: edit.scene },
    }
  }), [plan, edits])

  /** 把宿主/本地排出来的分镜转成可编辑底稿（宿主不回角色/场景，先给空）。 */
  const toEditable = (shots: readonly PipelineShot[]): EditableShot[] =>
    shots.map(shot => ({ ...shot, characters: [] }))

  /** 重排后统一收敛编号并清空逐镜改动（改动已经合并进底稿，留着会错位）。 */
  const applyShots = (shots: readonly EditableShot[]): void => {
    setPlan(shots.map((shot, position) => ({ ...shot, index: position + 1 })))
    setEdits({})
    setInlineRows([])
    setInlineStage(undefined)
    setInlineError(undefined)
  }

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
    return {
      projectId: projectId as string,
      script: planningScript,
      mode: MODE,
      shots,
      duration,
      ...shotDurations === undefined ? {} : { shotDurations },
      ...manualPick.length === 0 ? {} : { resourceIds: manualPick },
      // `B-20`：选了文本模型就由模型四步拆解；没选保持规则拆解
      ...selectedModel === undefined ? {} : { provider: selectedModel.provider, model: selectedModel.model },
      ...skillId === '' ? {} : { skillId },
    }
  }

  /**
   * 客户端本地排一遍分镜（与宿主 `pipelines/compose` 调的是**同一个纯函数**）。
   * 只为了拿到逐镜提示词与时长；拆不出分镜时如实抛错，由调用方决定怎么提示。
   * @returns 与宿主口径一致的分镜列表。
   */
  const planLocally = (): readonly PipelineShot[] => {
    const style = resources.find(resource => resource.kind === 'style' && (resource.note ?? '') !== '')
    const draft = planPipeline({
      script: planningScript,
      options: {
        mode: MODE,
        shots,
        duration,
        ...hasDurationEdits ? { shotDurations: editableShots.map(shot => shot.duration) } : {},
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
    // 选了模型却没拿到模型拆解结果时，明确说清楚是谁拆的，避免"以为调了模型"
    const warnings = [...(composed.warnings ?? [])]
    if (input.provider !== undefined && composed.source !== 'model' && !warnings.some(item => item.includes('回落'))) {
      warnings.push('宿主没有返回模型拆解结果：本次已按规则拆解')
    }
    setResult(composed)
    setComposeInput(input)
    setPlan(toEditable(composed.shotDetails ?? localShots))
    setPlanSource(composed.source)
    setPlanWarnings(warnings)
    setEntities(composed.entities)
    setInlineRows([])
    setInlineStage(undefined)
    setInlineError(undefined)
  }

  /** `B-20` 拆解可取消：正在进行的编排请求的取消句柄。 */
  const abortRef = useRef<AbortController | undefined>(undefined)
  const [canCancel, setCanCancel] = useState(false)

  /** 开一次可取消的编排：登记句柄并亮出取消按钮。 */
  const beginCompose = (): AbortController => {
    const controller = new AbortController()
    abortRef.current = controller
    setCanCancel(true)
    return controller
  }

  /** 收尾：只清自己那一次，晚到的旧请求不覆盖新句柄。 */
  const endCompose = (controller: AbortController): void => {
    if (abortRef.current === controller) abortRef.current = undefined
    setCanCancel(false)
  }

  /** 取消拆解：中断 RPC，宿主的模型流随之停止。 */
  const cancelCompose = (): void => { abortRef.current?.abort() }

  /** `B5` 生成分镜：只排版不生成，排完后就地列出可编辑分镜。 */
  const composeOnly = async (): Promise<void> => {
    if (!canRun) return
    setRunning(true); setError(undefined); setResult(undefined)
    const controller = beginCompose()
    try {
      const input = buildInput()
      const localShots = planLocallySafe()
      const composed = await api.composePipeline(input, controller.signal)
      acceptComposed(composed, input, localShots)
    } catch (cause) {
      if (controller.signal.aborted) setNotice(t('pipelineCancelled'))
      else setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      endCompose(controller)
      setRunning(false)
    }
  }

  /**
   * `B-22` 生成剧本：把剧本拆成集 → 分段 → 分镜并落库。
   *
   * 剧本框是唯一入口：写整段剧本，或只写一句话创意（选了文本模型时由模型补全）。
   * 与「生成分镜」的区别：这条会**写进集记录**，每一级都能在下面的本集工作区继续增删；
   * 「生成分镜」只就地排版，不落库。
   */
  const generateScript = async (): Promise<void> => {
    if (projectId === undefined || projectId === '') { setError(t('pipelineNeedsProject')); return }
    if (script.trim() === '') { setError(t('pipelineGenerateNeedsSource')); return }
    setRunning(true); setGeneratingScript(true); setError(undefined); setNotice(undefined)
    try {
      const result = await api.generateEpisodes({
        projectId,
        ...props.episodeId === undefined || props.episodeId === '' ? {} : { episodeId: props.episodeId },
        script: planningScript,
        ...selectedModel === undefined ? {} : { provider: selectedModel.provider, model: selectedModel.model },
        episodes: planEpisodes,
        segments: planSegments,
        shots: planShots,
        shotDurationSec: duration,
        ...skillId === '' ? {} : { skillId },
      })
      setNotice(t('pipelineGenerateDone').replace('{n}', String(result.episodes.length)))
      await props.onEpisodesGenerated?.(result.episodes)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setGeneratingScript(false)
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
    const controller = beginCompose()
    try {
      const input = buildInput()
      const localShots = planLocallySafe()
      const composed = await api.composePipeline(input, controller.signal)
      acceptComposed(composed, input, localShots)
      props.onStarted(composed.workflowId)
    } catch (cause) {
      if (controller.signal.aborted) setNotice(t('pipelineCancelled'))
      else setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      endCompose(controller)
      setRunning(false)
    }
  }

  /** 就地生成里改某一镜的状态（串行推进时逐行刷新）。 */
  const updateInlineRow = (index: number, patch: Partial<InlineRow>): void => {
    setInlineRows(current => current.map(row => row.index === index ? { ...row, ...patch } : row))
  }

  /**
   * `B6` 就地生成：不跳画布，按分镜逐镜调 `api.generateMedia`。
   * `kind === 'image'` 只出图；`kind === 'video'` 直接出视频（这一镜已经出过图就带上图）。
   * 串行 —— 一镜跑完再下一镜；失败立刻停，并在错误条里写明**第几镜**失败。
   */
  const inlineGenerate = async (kind: 'image' | 'video', only?: EditableShot): Promise<void> => {
    if (!canRun) return
    // 分镜来源：优先用「生成分镜」列出来的（可能逐条改过）；没排过就本地先排一遍。
    // 传了 `only` 就只跑这一镜（单镜重生成）。
    let shotsToRun: readonly EditableShot[] = only === undefined ? editableShots : [only]
    if (only === undefined && shotsToRun.length === 0) {
      try {
        shotsToRun = toEditable(planLocally())
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
        setInlineStage({ index: shot.index, total, phase: kind === 'image' ? 'image' : 'video' })
        if (kind === 'image') {
          const image: MediaGenerateResult = await api.generateMedia({
            mediaMode: 'image',
            prompt: shot.imagePrompt,
            projectId: projectId as string,
          })
          if (image.path === undefined) throw new Error(t('generateFailed'))
          updateInlineRow(shot.index, { status: 'image', path: image.path })
          continue
        }
        // 这一镜上一轮已经出过图就直接拿它当首帧，不再重复出图
        const previous = inlineRows.find(row => row.index === shot.index)
        const imagePath = previous?.status === 'image' ? previous.path : undefined
        const video: MediaGenerateResult = await api.generateMedia({
          mediaMode: 'video',
          prompt: shot.videoPrompt,
          projectId: projectId as string,
          // `B4`/`B5`：用**本镜自己的**秒数，不套全局值
          duration: shot.duration,
          aspectRatio: DEFAULT_RATIO,
          wait: false,
          ...imagePath === undefined ? {} : { image: imagePath },
        })
        if (video.path !== undefined) {
          updateInlineRow(shot.index, { status: 'submitted', path: video.path })
        } else if (video.taskId !== undefined) {
          updateInlineRow(shot.index, { status: 'submitted', taskId: video.taskId })
          // `C5`：提交成功不等于出片——等这条任务落成片再进下一镜
          const path = await awaitVideoTask(api, video.taskId, projectId as string, t)
          updateInlineRow(shot.index, { status: 'submitted', path })
        } else throw new Error(t('generateFailed'))
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
      setPlan(toEditable(recomposed.shotDetails ?? planLocallySafe()))
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

  /**
   * `B-20` 导入剧本文件：浏览器选中的**每个**文件都先列出来（多个用分号隔开），
   * 再逐个交给宿主解析（txt/md/docx/pdf）；成功的并入剧本正文，失败的原位标出原因，
   * 一份失败不影响其他文件。
   */
  const importScriptFiles = async (files: readonly File[]): Promise<void> => {
    if (files.length === 0) return
    const picked = files
    setImporting(true); setError(undefined); setNotice(undefined)
    // 选中就先挂出来，让用户看到"文件已经进来了"（同名文件只留一条）
    setImportedFiles(current => {
      const known = new Set(current.map(item => item.name))
      const added = picked
        .filter(file => !known.has(file.name))
        .map(file => ({ name: file.name, status: 'importing' as const }))
      return [...current, ...added]
    })
    const failures: string[] = []
    const done: string[] = []
    for (const file of picked) {
      try {
        const base64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()))
        const imported: ImportedScriptView = await api.importScript({ fileName: file.name, base64 })
        setScript(current => current.trim() === '' ? imported.text : `${current}\n\n${imported.text}`)
        done.push(`${file.name}（${imported.text.length} 字）`)
        setImportedFiles(current => current.map(item =>
          item.name === file.name ? { name: item.name, status: 'done' } : item))
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        failures.push(`${file.name}：${message}`)
        setImportedFiles(current => current.map(item =>
          item.name === file.name ? { name: item.name, status: 'failed', error: message } : item))
      }
    }
    if (failures.length === 0) {
      setNotice(t('pipelineImportDone').replace('{name}', done.join('；')))
      // 正文是追加在剧本末尾的：把剧本框滚到底，用户一眼能看到内容去了哪里
      const textarea = scriptRef.current
      if (textarea !== null) {
        // jsdom 没有 scrollIntoView，测试环境跳过即可（真实浏览器一定有时才有意义）
        if (typeof textarea.scrollIntoView === 'function') textarea.scrollIntoView({ block: 'nearest' })
        textarea.scrollTop = textarea.scrollHeight
      }
    } else {
      setError(`${t('pipelineImportFailed')}：${failures.join('；')}`)
    }
    setImporting(false)
  }

  /** 从已引用列表里移除一个文件名（只影响展示，正文里已并入的内容不动）。 */
  const removeImportedFile = (name: string): void => {
    setImportedFiles(current => current.filter(item => item.name !== name))
  }

  /** `B-20` 局部重拆：只让模型重写这一镜，其余镜头原样保留。 */
  const replanShot = async (index: number): Promise<void> => {
    if (selectedModel === undefined) { setError(t('pipelineReplanNoModel')); return }
    setReplanning(index); setError(undefined); setNotice(undefined)
    try {
      const next = await api.replanStoryboard({
        script,
        index,
        shots: editableShots.map(shot => ({
          index: shot.index,
          shot: shot.shot,
          characters: shot.characters,
          ...shot.scene === undefined ? {} : { scene: shot.scene },
          imagePrompt: shot.imagePrompt,
          videoPrompt: shot.videoPrompt,
        })),
        provider: selectedModel.provider,
        model: selectedModel.model,
        ...entities === undefined ? {} : { entities },
        ...skillId === '' ? {} : { skillId },
      })
      const previous = editableShots
      applyShots(next.shots.map((shot, position) => ({
        index: position + 1,
        shot: shot.shot,
        duration: previous[position]?.duration ?? duration,
        imagePrompt: shot.imagePrompt,
        videoPrompt: shot.videoPrompt,
        characters: shot.characters,
        ...shot.scene === undefined ? {} : { scene: shot.scene },
      })))
      setNotice(t('pipelineSourceModel'))
    } catch (cause) {
      setError(`${t('pipelineReplanShot')}：${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      setReplanning(undefined)
    }
  }

  /** 分镜排序：上移/下移一位（顺序就是生成顺序）。 */
  const moveShot = (position: number, delta: number): void => {
    const to = position + delta
    if (to < 0 || to >= editableShots.length) return
    const next = [...editableShots]
    const [moved] = next.splice(position, 1)
    if (moved === undefined) return
    next.splice(to, 0, moved)
    applyShots(next)
  }

  /** 删除一镜。 */
  const removeShot = (index: number): void => {
    applyShots(editableShots.filter(shot => shot.index !== index))
  }

  /** 手动加一镜：默认 6 秒、空提示词，由用户补。 */
  const addShot = (): void => {
    if (editableShots.length >= MAX_SHOTS) return
    applyShots([...editableShots, {
      index: editableShots.length + 1,
      shot: '',
      duration,
      imagePrompt: '',
      videoPrompt: '',
      characters: [],
    }])
  }

  /** 导出分镜表（Markdown）：逐镜描述 + 时长 + 两条提示词，方便交给外部工具或存档。 */
  const exportStoryboard = (): void => {
    const lines = [
      `# 分镜表（${editableShots.length} 镜）`,
      '',
      ...editableShots.flatMap(shot => [
        `## 第 ${shot.index} 镜 · ${shot.shot === '' ? '（未命名）' : shot.shot}`,
        '',
        `- 时长：${shot.duration} 秒`,
        ...shot.characters.length === 0 ? [] : [`- 角色：${shot.characters.join('、')}`],
        ...shot.scene === undefined || shot.scene === '' ? [] : [`- 场景：${shot.scene}`],
        ...hasImageStage ? ['', `**画面提示词**：${shot.imagePrompt}`] : [],
        '',
        `**视频提示词**：${shot.videoPrompt}`,
        '',
      ]),
    ]
    downloadText(`分镜表-${editableShots.length}镜.md`, lines.join('\n'))
    setNotice(t('pipelineExport'))
  }

  /**
   * `B-20` 落库到本集分镜：分镜必须挂在分段下，没有分段就按本表建一个，
   * 已有的分段原样不动；保存后本集模块里的分镜表立即可见。
   */
  const saveToEpisode = async (): Promise<void> => {
    const episodeId = props.episodeId
    if (episodeId === undefined || episodeId === '') { setError(t('pipelineSaveNeedsEpisode')); return }
    if (editableShots.length === 0) return
    setRunning(true); setError(undefined); setNotice(undefined)
    try {
      const segments = await api.listSegments(episodeId)
      const segmentId = segments[0]?.id ?? (await api.createSegment(episodeId, {
        promptText: editableShots[0]?.imagePrompt ?? '',
        durationSec: Math.max(
          MIN_SEGMENT_DURATION_SEC,
          Math.min(MAX_SEGMENT_DURATION_SEC, editableShots.reduce((total, shot) => total + shot.duration, 0)),
        ),
      })).id
      await api.saveStoryboard({
        episodeId,
        segmentId,
        shots: editableShots.map((shot, position) => ({
          id: newWorkbenchId('shot'),
          order: position + 1,
          durationSec: shot.duration,
          imagePrompt: shot.imagePrompt,
          videoPrompt: shot.videoPrompt,
          refs: [],
        })),
      })
      setNotice(t('pipelineSavedEpisode').replace('{n}', String(editableShots.length)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRunning(false)
    }
  }

  /** 把单独一镜铺成画布（图片节点 + 视频节点），方便只调这一镜。 */
  const sendShotToCanvas = async (shot: EditableShot): Promise<void> => {
    if (projectId === undefined || projectId === '') return
    setRunning(true); setError(undefined); setNotice(undefined)
    try {
      const imageId = newWorkbenchId('node')
      const videoId = newWorkbenchId('node')
      const nodes = [
        {
          id: imageId,
          kind: 'image-generate' as const,
          position: { x: 40, y: 40 },
          params: { ...defaultParams('image-generate'), prompt: shot.imagePrompt },
        },
        {
          id: videoId,
          kind: 'video-generate' as const,
          position: { x: 420, y: 40 },
          params: {
            ...defaultParams('video-generate'),
            prompt: shot.videoPrompt,
            duration: shot.duration,
            ratio: DEFAULT_RATIO,
            image: imageId,
          },
        },
      ]
      const edges = hasImageStage
        ? [{
          id: newWorkbenchId('edge'),
          source: imageId,
          target: videoId,
          sourceHandle: WORKFLOW_SOURCE_HANDLE,
          targetHandle: WORKFLOW_TARGET_HANDLE,
        }]
        : []
      const stored: WorkflowRecord = await api.saveWorkflow({
        projectId,
        name: `分镜 #${shot.index} · ${shot.shot.slice(0, 12)}`,
        nodes,
        edges,
      })
      props.onStarted(stored.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="iv-card" data-pipeline-card="true">
          <div className="iv-card-body" style={{ display: 'grid', gap: 'var(--iv-sp-4)' }}>
            <span className="iv-meta">{t('pipelineScriptLabel')}</span>
            {/* `B1`：6 行高——一整段剧本粘贴进来不用先滚才看得全 */}
            <textarea
              ref={scriptRef}
              className="iv-input"
              rows={SCRIPT_ROWS}
              value={script}
              placeholder={t('pipelineScriptPlaceholder')}
              data-pipeline-script="true"
              disabled={running}
              onChange={event => setScript(event.target.value)}
              style={{ resize: 'vertical', font: 'inherit', padding: '6px 8px', borderRadius: '6px' }}
            />
            {/* 长篇剧本：整本导入后按章节切段，一次只拆选中的那段 */}
            {scriptWindows.length === 0
              ? null
              : (
                <div
                  data-pipeline-windows="true"
                  style={{ display: 'flex', gap: 'var(--iv-sp-4)', flexWrap: 'wrap', alignItems: 'center' }}
                >
                  <span className="iv-meta">
                    {t('pipelineWindowsSummary')
                      .replace('{chars}', String(script.trim().length))
                      .replace('{count}', String(scriptWindows.length))}
                  </span>
                  <select
                    className="iv-input"
                    data-pipeline-window-select="true"
                    value={windowIndex}
                    disabled={running}
                    onChange={event => setWindowIndex(Number(event.target.value))}
                    style={{ padding: '4px 6px', borderRadius: '6px', font: 'inherit' }}
                  >
                    {scriptWindows.map((item, position) => (
                      <option key={item.index} value={position}>
                        {item.title}（{item.chars} 字）
                      </option>
                    ))}
                  </select>
                  <span className="iv-meta">{t('pipelineWindowHint')}</span>
                </div>
              )}
            {/* `B-20` 剧本文件导入：点一下开系统文件窗口，选中的文件交给宿主解析 */}
            <div style={{ display: 'flex', gap: 'var(--iv-sp-5)', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.docx,.pdf"
                multiple
                data-pipeline-import-file="true"
                style={{ display: 'none' }}
                onChange={event => {
                  // 先快照成数组再清空 value：清空后 FileList 可能被就地置空
                  const files = Array.from(event.target.files ?? [])
                  event.target.value = ''
                  void importScriptFiles(files)
                }}
              />
              <button
                type="button"
                className="iv-btn iv-btn--ghost iv-btn--sm"
                data-pipeline-import="true"
                disabled={running || importing}
                title={t('pipelineImportScriptHint')}
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="script" size={12} />
                {importing ? t('pipelineImporting') : t('pipelineImportScript')}
              </button>
              {importedFiles.length === 0
                ? null
                : (
                  <div
                    data-pipeline-imported="true"
                    style={{ display: 'flex', gap: 'var(--iv-sp-3)', flexWrap: 'wrap', alignItems: 'center' }}
                  >
                    <span className="iv-meta">{t('pipelineImportedLabel')}</span>
                    {importedFiles.map(file => (
                      <span
                        className="iv-chip"
                        key={file.name}
                        data-pipeline-imported-item={file.name}
                        data-pipeline-imported-status={file.status}
                        title={file.error ?? file.name}
                      >
                        <span style={{ marginRight: '2px' }}>
                          {file.name}
                          {file.status === 'importing' ? ` · ${t('pipelineImporting')}` : ''}
                          {file.status === 'failed' ? ` · ${t('pipelineImportFailedShort')}` : ''}
                        </span>
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          data-pipeline-imported-remove={file.name}
                          aria-label={t('pipelineImportRemove')}
                          title={t('pipelineImportRemove')}
                          onClick={() => removeImportedFile(file.name)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
            </div>
            {/* `B-22` 生成剧本：剧本框同时接收整段剧本与一句话创意；三级数量默认 1 集 / 3 段 / 4 镜 */}
            <div className="iv-sub" data-pipeline-generate="true">
              <div className="iv-sub-head">
                <span className="iv-sub-title">{t('pipelineGenerateTitle')}</span>
                <span className="iv-meta" data-pipeline-generate-hint="true">{t('pipelineGenerateHint')}</span>
              </div>
              <div className="iv-plan-row">
                <label className="iv-plan-field">
                  {t('pipelinePlanEpisodes')}
                  <input
                    className="iv-input"
                    data-pipeline-plan-episodes="true"
                    type="number"
                    min={1}
                    max={MAX_PLAN_EPISODES}
                    value={planEpisodes}
                    disabled={running}
                    onChange={event => setPlanEpisodes(Math.max(1, Math.min(MAX_PLAN_EPISODES, Number(event.target.value) || 1)))}
                  />
                </label>
                <label className="iv-plan-field">
                  {t('pipelinePlanSegments')}
                  <input
                    className="iv-input"
                    data-pipeline-plan-segments="true"
                    type="number"
                    min={1}
                    max={MAX_PLAN_SEGMENTS}
                    value={planSegments}
                    disabled={running}
                    onChange={event => setPlanSegments(Math.max(1, Math.min(MAX_PLAN_SEGMENTS, Number(event.target.value) || 1)))}
                  />
                </label>
                <label className="iv-plan-field">
                  {t('pipelinePlanShots')}
                  <input
                    className="iv-input"
                    data-pipeline-plan-shots="true"
                    type="number"
                    min={1}
                    max={MAX_PLAN_SHOTS}
                    value={planShots}
                    disabled={running}
                    onChange={event => setPlanShots(Math.max(1, Math.min(MAX_PLAN_SHOTS, Number(event.target.value) || 1)))}
                  />
                </label>
                <button
                  type="button"
                  className="iv-btn iv-btn--primary iv-btn--sm"
                  data-pipeline-script-generate="true"
                  disabled={running || script.trim() === ''}
                  onClick={() => { void generateScript() }}
                >
                  <Icon name="sparkles" size={12} />
                  {generatingScript ? t('pipelineGeneratingScript') : t('pipelineGenerate')}
                </button>
              </div>
            </div>
            {/* `B-20` 文本模型：默认"只用规则"，选了就四步拆解（角色→道具→场景→分镜） */}
            <div style={{ display: 'flex', gap: 'var(--iv-sp-5)', flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="iv-check" title={t('pipelineTextModelHint')}>
                {t('pipelineTextModel')}
                <select
                  className="iv-input"
                  data-pipeline-text-model="true"
                  value={textModelKey}
                  disabled={running}
                  onChange={event => setTextModelKey(event.target.value)}
                >
                  <option value="">{t('pipelineTextModelRules')}</option>
                  {textModels.map(model => (
                    <option key={`${model.provider}::${model.id}`} value={`${model.provider}::${model.id}`}>
                      {model.providerName} · {model.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className="iv-meta" data-pipeline-text-model-hint="true">
                {textModels.length === 0 ? t('pipelineTextModelMissing') : t('pipelineTextModelHint')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--iv-sp-5)', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* `B-20` 导演技能：叠加在分镜拆解上，用来增强图片/视频提示词 */}
              <label className="iv-check" title={t('pipelineSkillHint')}>
                {t('pipelineSkill')}
                <select
                  className="iv-input"
                  data-pipeline-skill="true"
                  value={skillId}
                  disabled={running}
                  onChange={event => setSkillId(event.target.value)}
                >
                  <option value="">{t('pipelineSkillNone')}</option>
                  {skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                </select>
              </label>
              <span className="iv-meta" data-pipeline-skill-hint="true">
                {skills.length === 0 ? t('pipelineSkillMissing') : t('pipelineSkillHint')}
              </span>
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
              {/* `B-20`：拆解（尤其用模型四步）可能要等，给一个就地取消 */}
              {canCancel
                ? (
                  <button
                    type="button"
                    className="iv-btn iv-btn--ghost iv-btn--sm"
                    data-pipeline-cancel="true"
                    onClick={cancelCompose}
                  >
                    {t('pipelineCancel')}
                  </button>
                )
                : null}
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
              {/* `B6`：不跳画布，就地逐镜出图 */}
              <button
                type="button"
                className="iv-btn iv-btn--ghost iv-btn--sm"
                data-pipeline-inline-image="true"
                aria-label={t('pipelineInlineImageAria')}
                title={t('pipelineInlineImageHint')}
                disabled={!canRun}
                onClick={() => { void inlineGenerate('image') }}
              >
                <Icon name="image" size={12} />
                {t('pipelineInlineImage')}
              </button>
              {/* `B6`：不跳画布，就地逐镜出片——本卡片的主动作 */}
              <button
                type="button"
                className="iv-btn iv-btn--primary iv-btn--sm"
                data-pipeline-inline-run="true"
                aria-label={t('pipelineInlineRunAria')}
                title={t('pipelineInlineRunHint')}
                disabled={!canRun}
                onClick={() => { void inlineGenerate('video') }}
              >
                <Icon name="film" size={12} />
                {running ? t('pipelineRunning') : t('pipelineInlineRun')}
              </button>
              {projectId === undefined || projectId === ''
                ? <span className="iv-meta">{t('pipelineNeedsProject')}</span>
                : null}
            </div>
            <span className="iv-meta" data-pipeline-button-hints="true">
              {t('pipelineToCanvasHint')} · {t('pipelineInlineImageHint')} · {t('pipelineInlineRunHint')}
            </span>

            {/* `B-18` 指定物料：项目里确实有资源时才出现（没有资源就不占位、不解释） */}
            {resources.length === 0
              ? null
              : (
                <div data-pipeline-pick="true">
                  <div style={{ display: 'flex', gap: 'var(--iv-sp-3)', flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span className="iv-meta">{t('pipelineManualPick')}</span>
                    <span className="iv-meta">{t('pipelineManualPickHint')}</span>
                  </div>
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
              )}

            {/* 分镜出口：有了分镜才出现导出 / 落库，不再藏进「高级设置」 */}
            {editableShots.length === 0
              ? null
              : (
                <div style={{ display: 'flex', gap: 'var(--iv-sp-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="iv-btn iv-btn--ghost iv-btn--sm"
                    data-pipeline-export="true"
                    onClick={exportStoryboard}
                  >
                    <Icon name="download" size={12} />
                    {t('pipelineExport')}
                  </button>
                  <button
                    type="button"
                    className="iv-btn iv-btn--ghost iv-btn--sm"
                    data-pipeline-save-episode="true"
                    disabled={running || props.episodeId === undefined || props.episodeId === ''}
                    title={props.episodeId === undefined ? t('pipelineSaveNeedsEpisode') : undefined}
                    onClick={() => { void saveToEpisode() }}
                  >
                    <Icon name="box" size={12} />
                    {t('pipelineSaveEpisode')}
                  </button>
                  {props.episodeId === undefined || props.episodeId === ''
                    ? <span className="iv-meta">{t('pipelineSaveNeedsEpisode')}</span>
                    : null}
                </div>
              )}

            {error === undefined ? null : <p className="iv-err" data-pipeline-error="true">{error}</p>}
            {notice === undefined ? null : <p className="iv-meta" data-pipeline-notice="true">{notice}</p>}

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
                    <span className="iv-sub-actions iv-meta">
                      {t('pipelineShotEditable')}
                      <button
                        type="button"
                        className="iv-btn iv-btn--ghost iv-btn--sm"
                        data-pipeline-shot-add="true"
                        disabled={running || editableShots.length >= MAX_SHOTS}
                        onClick={addShot}
                      >
                        <Icon name="plus" size={11} />
                        {t('pipelineAddShot')}
                      </button>
                    </span>
                  </div>
                  {/* `B-20` 这份分镜是谁拆的：模型 / 规则，以及模型的提醒 */}
                  {planSource === undefined
                    ? null
                    : (
                      <span className="iv-meta" data-pipeline-plan-source={planSource}>
                        {planSource === 'model' ? t('pipelineSourceModel') : t('pipelineSourceRules')}
                      </span>
                    )}
                  {planWarnings.length === 0
                    ? null
                    : (
                      <ul className="iv-meta" data-pipeline-plan-warnings="true" style={{ margin: 0, paddingLeft: '18px' }}>
                        {planWarnings.map(warning => <li key={warning}>{warning}</li>)}
                      </ul>
                    )}
                  {/* `B-20` 实体库：角色/道具/场景各自的独立提示词（防止分镜里重复描写导致穿帮） */}
                  {entities === undefined
                    ? null
                    : (
                      <details data-pipeline-entities="true">
                        <summary className="iv-meta">{t('pipelineEntitiesTitle')}</summary>
                        {[...entities.roles, ...entities.props, ...entities.scenes].length === 0
                          ? <span className="iv-meta">{t('pipelineEntitiesEmpty')}</span>
                          : (
                            <ul className="iv-meta" style={{ margin: 0, paddingLeft: '18px' }}>
                              {[...entities.roles, ...entities.props, ...entities.scenes].map(entity => (
                                <li key={`${entity.kind}:${entity.name}`} data-pipeline-entity={`${entity.kind}:${entity.name}`}>
                                  <strong>{entity.name}</strong>：{entity.prompt}
                                </li>
                              ))}
                            </ul>
                          )}
                      </details>
                    )}
                  {editableShots.map((shot, position) => (
                    <div
                      key={shot.index}
                      data-pipeline-shot={shot.index}
                      style={{ display: 'grid', gap: 'var(--iv-sp-2)', paddingBottom: 'var(--iv-sp-3)' }}
                    >
                      <div style={{ display: 'flex', gap: 'var(--iv-sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="iv-meta">#{shot.index}</span>
                        <input
                          className="iv-input"
                          data-pipeline-shot-label={shot.index}
                          type="text"
                          value={shot.shot}
                          placeholder={t('storyboardShotLabel')}
                          disabled={running}
                          onChange={event => { editShot(shot.index, { shot: event.target.value }) }}
                          style={{ flex: '1 1 220px', minWidth: '160px' }}
                        />
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          data-pipeline-shot-up={shot.index}
                          title={t('storyboardMoveUp')}
                          aria-label={t('storyboardMoveUp')}
                          disabled={running || position === 0}
                          onClick={() => { moveShot(position, -1) }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          data-pipeline-shot-down={shot.index}
                          title={t('storyboardMoveDown')}
                          aria-label={t('storyboardMoveDown')}
                          disabled={running || position === editableShots.length - 1}
                          onClick={() => { moveShot(position, 1) }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          data-pipeline-shot-remove={shot.index}
                          title={t('storyboardRemoveShot')}
                          aria-label={t('storyboardRemoveShot')}
                          disabled={running}
                          onClick={() => { removeShot(shot.index) }}
                        >
                          <Icon name="trash" size={11} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--iv-sp-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <label className="iv-check" style={{ flex: '1 1 180px' }}>
                          <span className="iv-meta" style={{ minWidth: '56px' }}>{t('storyboardSceneLabel')}</span>
                          <input
                            className="iv-input"
                            data-pipeline-shot-scene={shot.index}
                            type="text"
                            value={shot.scene ?? ''}
                            disabled={running}
                            onChange={event => { editShot(shot.index, { scene: event.target.value }) }}
                            style={{ flex: 1 }}
                          />
                        </label>
                        <label className="iv-check" style={{ flex: '1 1 180px' }}>
                          <span className="iv-meta" style={{ minWidth: '56px' }}>{t('storyboardCharactersLabel')}</span>
                          <input
                            className="iv-input"
                            data-pipeline-shot-characters={shot.index}
                            type="text"
                            value={shot.characters.join('、')}
                            disabled={running}
                            onChange={event => {
                              const names = event.target.value.split(/[、,，\s]+/u).map(name => name.trim()).filter(name => name !== '')
                              editShot(shot.index, { characters: names })
                            }}
                            style={{ flex: 1 }}
                          />
                        </label>
                      </div>
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
                      <div style={{ display: 'flex', gap: 'var(--iv-sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
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
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          data-pipeline-shot-replan={shot.index}
                          title={selectedModel === undefined ? t('pipelineReplanNoModel') : t('pipelineReplanShot')}
                          disabled={running || selectedModel === undefined || replanning !== undefined}
                          onClick={() => { void replanShot(shot.index) }}
                        >
                          <Icon name="refresh" size={11} />
                          {replanning === shot.index ? t('pipelineRunning') : t('pipelineReplanShot')}
                        </button>
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          data-pipeline-shot-image={shot.index}
                          disabled={!canRun}
                          onClick={() => { void inlineGenerate('image', shot) }}
                        >
                          <Icon name="image" size={11} />
                          {t('pipelineShotImage')}
                        </button>
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          data-pipeline-shot-run={shot.index}
                          disabled={!canRun}
                          onClick={() => { void inlineGenerate('video', shot) }}
                        >
                          <Icon name="film" size={11} />
                          {t('pipelineShotGenerate')}
                        </button>
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          data-pipeline-shot-canvas={shot.index}
                          disabled={!canRun}
                          onClick={() => { void sendShotToCanvas(shot) }}
                        >
                          <Icon name="flow" size={11} />
                          {t('pipelineShotToCanvas')}
                        </button>
                      </div>
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
                      {t('pipelineInlineProgress')}
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
    </div>
  )
}
