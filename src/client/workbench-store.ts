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
import type { TaskRecord } from '../workbench/records.ts'
import type { PipelineMode } from '../workbench/pipeline.ts'

/** 工作台的三种模式。 */
export type WorkbenchModeName = 'quick' | 'workflow' | 'timeline'

/** 主区标签页：内容生产 / 提示词·分镜。 */
export type WorkbenchQuickTab = 'produce' | 'prompt'

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
  /** 一键成片：剧本。 */
  readonly pipelineScript: string
  /** 一键成片：生成模式。 */
  readonly pipelineMode: PipelineMode
  /** 一键成片：分镜数。 */
  readonly pipelineShots: number
  /** 一键成片：每镜秒数。 */
  readonly pipelineDuration: number
  /** 一键成片：参考视频路径。 */
  readonly pipelineReferenceVideo: string
  /** 一键成片：手动指定的资源 id。 */
  readonly pipelineManualPick: readonly string[]
}

/** 初始值。 */
const INITIAL: WorkbenchUiState = {
  mode: 'quick',
  quickTab: 'produce',
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
  pipelineScript: '',
  pipelineMode: 'image-to-video',
  pipelineShots: 4,
  pipelineDuration: 6,
  pipelineReferenceVideo: '',
  pipelineManualPick: [],
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
    store = { state: INITIAL, listeners: new Set() }
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
