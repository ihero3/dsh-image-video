/**
 * 工作台的跨挂载状态（模块级 store）。
 *
 * 主面板是 keyed slot：切到「会话」或别的面板时 `Workbench` 会整体卸载，组件里的
 * `useState` 随之清零——用户回来看到的是空剧集、空提示词、空任务列表。这里把
 * **必须跨卸载存活**的少量状态移出 React，放到按宿主 API 实例分桶的模块级 store：
 *
 * - 桶的键是 `api` 实例。生产里它由插件注册时创建一次，面板重挂载仍是同一个对象；
 *   测试里每条用例都新建假宿主，因此天然互相隔离，不会串状态。
 * - 每个字段单独订阅（`useWorkbenchField`），写法与 `useState` 一致；弹窗、hover、
 *   输入焦点这类瞬态仍留在组件内。
 * - 任务进度由宿主推进；重新挂载时轮询会立刻拉一次最新快照，所以「切走再回来，
 *   进度比离开时更靠前」由宿主账本 + 首次刷新共同保证，不需要在 store 里跑定时器。
 *
 * @module dsh-image-video/client/workbench-store
 */
import { useCallback, useEffect, useState } from 'react'
import type { MotionKeyframe, TaskRecord } from '../workbench/records.ts'

/** 工作台的四种模式。 */
export type WorkbenchModeName = 'quick' | 'script' | 'workflow' | 'timeline'

/** 主区标签页：内容生产 / 提取提示词。 */
export type WorkbenchQuickTab = 'produce' | 'prompt'

/** 内容生产页的生成方式：生图（参考图可选）/ 生视频。 */
export type WorkbenchCreateTab = 'image' | 'video'

/** 剧本生成页的分区标签页：剧本分镜 / 素材提取 / 音色 / 轨迹。 */
export type WorkbenchScriptTab = 'split' | 'extract' | 'voice' | 'motion'

/**
 * 一份导入的剧本文件：文件名与解析出的原文都长期保留。
 *
 * 原文单独存一份，不依赖剧本输入框（用户可以改框里的字），角色 / 场景 / 道具分区
 * 也拿它当提取来源；`status` 只描述最近一次导入结果，失败也留着文件名说明原因。
 */
export interface PipelineImportedFile {
  readonly name: string
  readonly text: string
  readonly status: 'importing' | 'done' | 'failed'
  readonly error?: string
}

/** 角色提取列表里的一张角色卡（按剧集保存在共享 store）。 */
export interface RoleCard {
  readonly id: string
  readonly name: string
  /** 生成角色图用的提示词（用户可改，Skill token 也放在这里）。 */
  readonly prompt: string
  /** 角色的默认值：提取时的定妆说明，可一键回填到提示词。 */
  readonly defaultPrompt: string
  readonly imageModel: string
  readonly skillId: string
  readonly size: string
  readonly style: string
  /** 融合生图参数：姿态 / 镜头预设 id（空 = 自由）。 */
  readonly pose: string
  readonly lens: string
  /** 风格备注（融合生图的补充约束）。 */
  readonly styleNote: string
  /** 场景裁剪：勾选后把归一化坐标交给宿主的裁剪流程。 */
  readonly cropEnabled: boolean
  readonly crop?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly assetPath?: string
}

/**
 * 音色卡：一个说话人的配音设定（参考 ComfyUI 的 Zero-Shot Clone / CosyVoice 节点）。
 * `refAudioPath` 是可选参考音频（outputs 内路径）；`voiceId` 是服务商预设音色 id。
 * 合成入口在 TTS 未接入时禁用，卡本身与参数照常保存、可入资源库。
 */
export interface VoiceCard {
  readonly id: string
  /** 说话人 / 音色名称。 */
  readonly name: string
  /** 音色设定说明（提取时给出，可编辑）。 */
  readonly prompt: string
  /** 预设音色 id（来自 `voice/status` 的音色清单，可为空）。 */
  readonly voiceId: string
  /** 参考音频路径（可选，克隆音色用）。 */
  readonly refAudioPath?: string
  /** 语速倍率 0.5–2.0（1 = 原速）。 */
  readonly speed: number
  /** 音调倍率 0.7–1.4（1 = 原调）。 */
  readonly pitch: number
  /** 情感标签（如「平静 / 兴奋 / 悲伤」）。 */
  readonly emotion: string
  /** 已入库的资源 id（同一张卡重复入库时走更新）。 */
  readonly resourceId?: string
}

/** 运镜预设 id：一键生成一条轨迹的关键帧。 */
export type MotionPreset = 'push' | 'pull' | 'panLeft' | 'panRight' | 'tiltUp' | 'tiltDown' | 'orbit' | 'hold'

/**
 * 轨迹卡：一条运镜的关键帧（参考 ComfyUI 的 OmniCam / Camera H3 节点）。
 * 关键帧用归一化坐标，和宿主 `ResourceRecord.keyframes` 完全同构，可直接入库。
 */
export interface MotionCard {
  readonly id: string
  readonly name: string
  /** 运镜说明（提取时给出或被预设覆盖，可编辑）。 */
  readonly note: string
  /** 运镜预设；`custom` 表示手改过关键帧。 */
  readonly preset: MotionPreset | 'custom'
  readonly keyframes: readonly MotionKeyframe[]
  /** 已入库的资源 id。 */
  readonly resourceId?: string
}

/** 预览目标（图片或视频的绝对路径）。 */
export interface WorkbenchPreviewTarget {
  readonly path: string
  readonly kind: 'image' | 'video'
}

/** 跨挂载存活的状态字段。 */
export interface WorkbenchUiState {
  /** 当前模式。 */
  readonly mode: WorkbenchModeName
  /** 主区标签页。 */
  readonly quickTab: WorkbenchQuickTab
  /** 内容生产页的生成方式标签。 */
  readonly createTab: WorkbenchCreateTab
  /** 剧本生成页的分区标签页。 */
  readonly scriptTab: WorkbenchScriptTab
  /** 展示列是否展开（窄档浮层也用同一个开关）。 */
  readonly dockOpen: boolean
  /** 当前剧集（project）id。 */
  readonly activeId: string | undefined
  /** 当前集 id。 */
  readonly activeEpisodeId: string | undefined
  /** 资源面板里高亮的资源 id。 */
  readonly selectedResourceId: string | undefined
  /** 素材多选集合。 */
  readonly selectedAssetIds: readonly string[]
  /** 预览区的目标。 */
  readonly previewPath: WorkbenchPreviewTarget | undefined
  /** 最近一次任务列表快照（生成进度的显示来源）。 */
  readonly tasks: readonly TaskRecord[]
  /** 最近一次生成结果（结果卡）。 */
  readonly lastResult: WorkbenchPreviewTarget | undefined
  /** 单条生成表单：提示词。 */
  readonly generatePrompt: string
  /** 单条生成表单：参考图（按序）。 */
  readonly generateImages: readonly string[]
  /** 单条生成表单：尾帧图。 */
  readonly generateLastFrame: string | undefined
  /** 单条生成表单：参考视频。 */
  readonly generateRefVideo: string | undefined
  /** 单条生成表单：图片尺寸。 */
  readonly generateSize: string
  /** 单条生成表单：视频比例。 */
  readonly generateAspect: string
  /** 单条生成表单：视频时长。 */
  readonly generateDuration: string
  /** 单条生成表单：图片模型覆盖。 */
  readonly generateImageModel: string
  /** 单条生成表单：视频模型覆盖。 */
  readonly generateVideoModel: string
  /** 一键成片表单当前归属的项目（切换项目时按它保存/恢复）。 */
  readonly pipelineProjectId: string
  /** 共享剧本输入当前归属的剧集（切换剧集时按它保存/恢复）。 */
  readonly pipelineEpisodeId: string
  /** 角色提取：本集的角色卡列表。 */
  readonly roleCards: readonly RoleCard[]
  /** 角色提取：针对角色提取的提示词。 */
  readonly roleExtractPrompt: string
  /** 角色提取：本集使用的文本模型（`provider::model`）。 */
  readonly roleExtractModel: string
  /** 角色提取：本集使用的 Skill。 */
  readonly roleExtractSkillId: string
  /** 音色提取：本集的音色卡。 */
  readonly voiceCards: readonly VoiceCard[]
  /** 音色提取：专用的文本模型（`provider::model`）；空串回退分段模型。 */
  readonly voiceExtractModel: string
  /** 音色提取：专用提示词。 */
  readonly voiceExtractPrompt: string
  /** 轨迹提取：本集的轨迹卡。 */
  readonly motionCards: readonly MotionCard[]
  /** 轨迹提取：专用的文本模型（`provider::model`）；空串回退分段模型。 */
  readonly motionExtractModel: string
  /** 轨迹提取：专用提示词。 */
  readonly motionExtractPrompt: string
  /** 一键成片：剧本。 */
  readonly pipelineScript: string
  /** 导入的剧本文件（文件名 + 原文），剧本分段与角色/场景/道具分区共享。 */
  readonly pipelineImportedFiles: readonly PipelineImportedFile[]
  /** 一键成片：分镜数。 */
  readonly pipelineShots: number
  /** 一键成片：每镜秒数。 */
  readonly pipelineDuration: number
  /** 一键成片：手动指定的资源 id。 */
  readonly pipelineManualPick: readonly string[]
  /** 一键成片：拆分镜用的文本模型（`provider::model`）；空串 = 只用规则拆解。 */
  readonly pipelineTextModel: string
  /** 一键成片：增强分镜提示词的导演技能 id；空串 = 不叠加技能。 */
  readonly pipelineSkillId: string
}

/** 初始值。 */
const INITIAL: WorkbenchUiState = {
  mode: 'quick',
  quickTab: 'produce',
  createTab: 'image',
  scriptTab: 'split',
  dockOpen: true,
  activeId: undefined,
  activeEpisodeId: undefined,
  selectedResourceId: undefined,
  selectedAssetIds: [],
  previewPath: undefined,
  tasks: [],
  lastResult: undefined,
  generatePrompt: '',
  generateImages: [],
  generateLastFrame: undefined,
  generateRefVideo: undefined,
  generateSize: '',
  generateAspect: '',
  generateDuration: '',
  generateImageModel: '',
  generateVideoModel: '',
  pipelineProjectId: '',
  pipelineEpisodeId: '',
  roleCards: [],
  roleExtractPrompt: '',
  roleExtractModel: '',
  roleExtractSkillId: '',
  voiceCards: [],
  voiceExtractModel: '',
  voiceExtractPrompt: '',
  motionCards: [],
  motionExtractModel: '',
  motionExtractPrompt: '',
  pipelineScript: '',
  pipelineImportedFiles: [],
  pipelineShots: 4,
  pipelineDuration: 6,
  pipelineManualPick: [],
  pipelineTextModel: '',
  pipelineSkillId: '',
}

/**
 * 共享剧本文本与导入文件是用户真正的创作内容，不能只留在内存里。
 * 按剧集 id 落到 localStorage：刷新/重启后仍能恢复；无痕模式或超额时静默忽略，
 * 不影响编辑本身（宿主项目文件才是正式存档，这里只是输入草稿）。
 */
type ScriptDraftField = 'pipelineScript' | 'pipelineImportedFiles'
type ScriptDraft = Pick<WorkbenchUiState, ScriptDraftField>

const SCRIPT_DRAFT_FIELDS: readonly ScriptDraftField[] = ['pipelineScript', 'pipelineImportedFiles']

function scriptDraftKey(episodeId: string): string {
  return `image-video:script-draft:${episodeId}`
}

function readScriptDraft(episodeId: string): Partial<ScriptDraft> | undefined {
  try {
    const raw = localStorage.getItem(scriptDraftKey(episodeId))
    if (raw === null) return undefined
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const draft: Record<string, unknown> = {}
    if (typeof parsed['pipelineScript'] === 'string') draft['pipelineScript'] = parsed['pipelineScript']
    if (Array.isArray(parsed['pipelineImportedFiles'])) {
      // 上次导入没做完就关掉页面：标成失败，让用户重新导入，不假装已经成功。
      draft['pipelineImportedFiles'] = (parsed['pipelineImportedFiles'] as PipelineImportedFile[]).map(file => ({
        name: file.name,
        text: file.text,
        status: file.status === 'importing' ? 'failed' : file.status,
        ...file.status === 'importing' ? { error: '导入中断，请重新导入' } : {},
        ...file.error === undefined ? {} : { error: file.error },
      }))
    }
    return Object.keys(draft).length === 0 ? undefined : draft as Partial<ScriptDraft>
  } catch {
    return undefined
  }
}

function writeScriptDraft(episodeId: string, state: WorkbenchUiState): void {
  const draft: ScriptDraft = {
    pipelineScript: state.pipelineScript,
    pipelineImportedFiles: state.pipelineImportedFiles,
  }
  try {
    localStorage.setItem(scriptDraftKey(episodeId), JSON.stringify(draft))
  } catch {
    // 无痕模式 / 配额不足：草稿存不下，但不该让正在输入的用户看到报错
  }
}

/** 单个字段的 setter：值或更新函数。 */
export type WorkbenchFieldSetter<K extends keyof WorkbenchUiState> =
  (value: WorkbenchUiState[K] | ((previous: WorkbenchUiState[K]) => WorkbenchUiState[K])) => void

/** 一个宿主 API 实例对应的状态桶。 */
interface Store {
  state: WorkbenchUiState
  readonly listeners: Set<() => void>
}

const stores = new WeakMap<object, Store>()

/** 取（或建）某个 API 实例的状态桶。 */
function storeOf(owner: object): Store {
  let store = stores.get(owner)
  if (store === undefined) {
    // 新建状态桶时先恢复空 id 档（首集加载前的草稿）；切到具体集会再按 id 恢复。
    const restored = readScriptDraft('')
    store = {
      state: restored === undefined ? INITIAL : { ...INITIAL, ...restored },
      listeners: new Set(),
    }
    stores.set(owner, store)
  }
  return store
}

/**
 * 读取某个字段的当前值（非 React 场景，如事件回调里同步取）。
 * @param owner - 宿主 API 实例。
 * @param key - 字段名。
 * @returns 当前值。
 */
export function getWorkbenchField<K extends keyof WorkbenchUiState>(owner: object, key: K): WorkbenchUiState[K] {
  return storeOf(owner).state[key]
}

/**
 * 写一个字段并通知订阅者；值未变化（`Object.is`）时不通知。
 * @param owner - 宿主 API 实例。
 * @param key - 字段名。
 * @param value - 新值或更新函数。
 */
export function setWorkbenchField<K extends keyof WorkbenchUiState>(
  owner: object,
  key: K,
  value: WorkbenchUiState[K] | ((previous: WorkbenchUiState[K]) => WorkbenchUiState[K]),
): void {
  const store = storeOf(owner)
  const previous = store.state[key]
  const next = typeof value === 'function'
    ? (value as (previous: WorkbenchUiState[K]) => WorkbenchUiState[K])(previous)
    : value
  if (Object.is(previous, next)) return
  store.state = { ...store.state, [key]: next }
  if (SCRIPT_DRAFT_FIELDS.includes(key as ScriptDraftField)) {
    writeScriptDraft(store.state.pipelineEpisodeId, store.state)
  }
  for (const listener of store.listeners) listener()
}

/** 一键成片表单里**跟随项目**的字段（切换项目时整体保存/恢复）。 */
export type PipelineFieldSnapshot = Pick<
  WorkbenchUiState,
  'pipelineShots' | 'pipelineDuration' | 'pipelineManualPick' | 'pipelineTextModel' | 'pipelineSkillId'
>

/** 新项目的成片表单初值（剧本文本与导入文件按剧集存，不在这里）。 */
const PIPELINE_FIELDS_INITIAL: PipelineFieldSnapshot = {
  pipelineShots: 4,
  pipelineDuration: 6,
  pipelineManualPick: [],
  pipelineTextModel: '',
  pipelineSkillId: '',
}

/** 每个 API 实例一份「项目 id → 成片表单」快照，避免切换项目后还显示上一个项目的剧本。 */
const pipelineSnapshots = new WeakMap<object, Map<string, PipelineFieldSnapshot>>()

/** 取（或建）某个 API 实例的成片表单快照表。 */
function pipelineSnapshotsOf(owner: object): Map<string, PipelineFieldSnapshot> {
  let snapshots = pipelineSnapshots.get(owner)
  if (snapshots === undefined) {
    snapshots = new Map()
    pipelineSnapshots.set(owner, snapshots)
  }
  return snapshots
}

/** 只取跟项目走的那几个字段。 */
function snapshotPipelineFields(state: WorkbenchUiState): PipelineFieldSnapshot {
  return {
    pipelineShots: state.pipelineShots,
    pipelineDuration: state.pipelineDuration,
    pipelineManualPick: state.pipelineManualPick,
    pipelineTextModel: state.pipelineTextModel,
    pipelineSkillId: state.pipelineSkillId,
  }
}

/**
 * 切换到另一个项目的成片表单：先保存当前项目的填写内容，再恢复目标项目的（没有则回到默认值）。
 *
 * 不分项目的话，切换项目后分镜数与模型选择都还是上一部的内容——用户会以为"没刷新"。
 * 剧本文本、导入文件与角色卡按**剧集**存（见 {@link switchPipelineEpisode}），四个分区共享。
 * @param owner - 宿主 API 实例（状态桶的键）。
 * @param projectId - 目标项目 id；空串表示没有选中项目。
 */
export function switchPipelineProject(owner: object, projectId: string): void {
  const store = storeOf(owner)
  if (store.state.pipelineProjectId === projectId) return
  const snapshots = pipelineSnapshotsOf(owner)
  if (store.state.pipelineProjectId !== '') {
    snapshots.set(store.state.pipelineProjectId, snapshotPipelineFields(store.state))
  }
  const restored = snapshots.get(projectId) ?? PIPELINE_FIELDS_INITIAL
  store.state = { ...store.state, pipelineProjectId: projectId, ...restored }
  for (const listener of store.listeners) listener()
}

/** 跟随剧集的共享输入与角色卡。 */
export type EpisodeScriptSnapshot = Pick<
  WorkbenchUiState,
  'pipelineScript' | 'pipelineImportedFiles'
  | 'roleCards' | 'roleExtractPrompt' | 'roleExtractModel' | 'roleExtractSkillId'
  | 'voiceCards' | 'voiceExtractModel' | 'voiceExtractPrompt'
  | 'motionCards' | 'motionExtractModel' | 'motionExtractPrompt'
>

const EPISODE_SCRIPT_INITIAL: EpisodeScriptSnapshot = {
  pipelineScript: '',
  pipelineImportedFiles: [],
  roleCards: [],
  roleExtractPrompt: '',
  roleExtractModel: '',
  roleExtractSkillId: '',
  voiceCards: [],
  voiceExtractModel: '',
  voiceExtractPrompt: '',
  motionCards: [],
  motionExtractModel: '',
  motionExtractPrompt: '',
}

/** 每个 API 实例一份「剧集 id → 共享剧本输入 / 角色卡」快照。 */
const episodeScriptSnapshots = new WeakMap<object, Map<string, EpisodeScriptSnapshot>>()

function episodeScriptSnapshotsOf(owner: object): Map<string, EpisodeScriptSnapshot> {
  let snapshots = episodeScriptSnapshots.get(owner)
  if (snapshots === undefined) {
    snapshots = new Map()
    episodeScriptSnapshots.set(owner, snapshots)
  }
  return snapshots
}

/**
 * 切换剧集：先保存当前剧集的共享剧本输入与角色卡，再恢复目标剧集的内容。
 * 剧本分段 / 角色 / 场景 / 道具四个分区读写同一份 store，因此切回来看到的是原内容。
 */
export function switchPipelineEpisode(owner: object, episodeId: string): void {
  const store = storeOf(owner)
  if (store.state.pipelineEpisodeId === episodeId) return
  const snapshots = episodeScriptSnapshotsOf(owner)
  // 空 id 也是一档（首集加载前的草稿）：无条件先存，否则首次切集时写的内容会丢
  snapshots.set(store.state.pipelineEpisodeId, {
    pipelineScript: store.state.pipelineScript,
    pipelineImportedFiles: store.state.pipelineImportedFiles,
    roleCards: store.state.roleCards,
    roleExtractPrompt: store.state.roleExtractPrompt,
    roleExtractModel: store.state.roleExtractModel,
    roleExtractSkillId: store.state.roleExtractSkillId,
    voiceCards: store.state.voiceCards,
    voiceExtractModel: store.state.voiceExtractModel,
    voiceExtractPrompt: store.state.voiceExtractPrompt,
    motionCards: store.state.motionCards,
    motionExtractModel: store.state.motionExtractModel,
    motionExtractPrompt: store.state.motionExtractPrompt,
  })
  // 剧本文本与导入文件额外落 localStorage：重启后 WeakMap 快照随之销毁，靠这里恢复。
  writeScriptDraft(store.state.pipelineEpisodeId, store.state)
  const persisted = readScriptDraft(episodeId)
  const restored = { ...(snapshots.get(episodeId) ?? EPISODE_SCRIPT_INITIAL), ...persisted }
  store.state = { ...store.state, pipelineEpisodeId: episodeId, ...restored }
  for (const listener of store.listeners) listener()
}

/**
 * 订阅一个字段，用法与 `useState` 相同：`const [mode, setMode] = useWorkbenchField(api, 'mode')`。
 *
 * 订阅粒度是单字段：改提示词不会让只读模式的面板重渲染。组件重挂载时从桶里读回
 * 最新值，因此切走再回来状态还在。
 * @param owner - 宿主 API 实例（用作状态桶的键）。
 * @param key - 字段名。
 * @returns 当前值与 setter。
 */
export function useWorkbenchField<K extends keyof WorkbenchUiState>(
  owner: object,
  key: K,
): readonly [WorkbenchUiState[K], WorkbenchFieldSetter<K>] {
  const [value, setValue] = useState<WorkbenchUiState[K]>(() => storeOf(owner).state[key])
  useEffect(() => {
    const store = storeOf(owner)
    // 挂载与订阅之间可能有写入：先对齐一次，避免显示旧值
    setValue(() => store.state[key])
    const listener = (): void => { setValue(() => store.state[key]) }
    store.listeners.add(listener)
    return () => { store.listeners.delete(listener) }
  }, [owner, key])
  const set = useCallback<WorkbenchFieldSetter<K>>((next) => {
    setWorkbenchField(owner, key, next)
  }, [owner, key])
  return [value, set] as const
}
