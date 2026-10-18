/**
 * Workbench surface: the right-pane tab body.
 *
 * Phase 1 shipped the skeleton and the host health check; this is the first
 * *usable* slice — create and pick a project, register a file from the output
 * directory as its asset, preview it, and remove records again. Everything it
 * does goes through the injected `api` (the `/image-video` channel), so no part
 * of this component reaches into the host directly.
 *
 * Presentation: one design-system sheet (`workbench-style.ts`, class prefix
 * `iv-`) injected once at mount, plus the stroke icon set (`icons.tsx`). All
 * colours resolve through the Harness design tokens with currentColor-mix
 * fallbacks (`R-NFR-3`); no deployment fact is baked into the bundle.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the right pane's seat declarations (the framework-bound `useTabInfo`).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { AssetRecord, ProjectRecord, ResourceKind, ResourceRecord, ResourceUsageRecord, TaskRecord, TaskStatus } from '../workbench/records.ts'
import { newWorkbenchId } from '../workbench/records.ts'
import type { WorkbenchOptions } from '../workbench-contract.ts'
import type { WorkflowRecord, WorkflowRunRecord } from '../workbench/workflow.ts'
import { activeClipAt, timelineDurationMs, type TimelineRecord, type TimelineTrack, type TrackKind } from '../workbench/timeline.ts'
import type { FfmpegProbe } from '../media/ffmpeg.ts'
import type { RenderJob } from '../media/render-registry.ts'
import { WorkflowCanvas } from './WorkflowCanvas.tsx'
import type { OutputFile } from '../workbench/outputs.ts'
import type { WorkbenchApi } from './api.ts'
import { NS, type WorkbenchLocaleKey } from './locales.ts'
import { BrandMark, Icon, type IconName } from './icons.tsx'
import { useWorkbenchStyle } from './workbench-style.ts'

/** Injected share the client plugin binds once. */
export interface WorkbenchInjected {
  /** Registered tab kind, echoed in the header so the seat wiring is visible at a glance. */
  kind: string
  /** Host API over the workbench channel. */
  api: WorkbenchApi
}

/** The three modes the workbench offers. */
export type WorkbenchMode = 'quick' | 'workflow' | 'timeline'

/** Props the right-pane seat binds for this body. */
export type WorkbenchProps =
  PropsRuntime<'sidebar.right.pane.tab'>
  & InjectFace<WorkbenchInjected>
  & PropsLocale<typeof NS>

/** What the header can say about the host. */
type HealthState =
  | { status: 'checking' }
  | { status: 'ok'; version: string; provider: string; defaults?: Record<string, string | number | null>; options?: WorkbenchOptions }
  | { status: 'failed'; message: string }

/** Mode → dictionary key, in switch order. */
const MODE_KEYS: Record<WorkbenchMode, WorkbenchLocaleKey> = {
  quick: 'modeQuick',
  workflow: 'modeWorkflow',
  timeline: 'modeTimeline',
}
const MODES: readonly WorkbenchMode[] = ['quick', 'workflow', 'timeline']

/** Mode → icon (segmented switcher). */
const MODE_ICONS: Record<WorkbenchMode, IconName> = {
  quick: 'bolt', workflow: 'flow', timeline: 'film',
}

/** Resource kind → icon (resource library rows). */
const RESOURCE_ICONS: Record<ResourceKind, IconName> = {
  'role': 'user', 'scene': 'image', 'prop': 'box', 'brand': 'tag',
  'style': 'sparkles', 'voice': 'music', 'motion-track': 'motion',
}

/** Timeline track kind → icon (track label column). */
const TRACK_ICONS: Record<TrackKind, IconName> = {
  video: 'video', audio: 'music', subtitle: 'subtitle',
}

/** Timeline track kind → NLE 轨号（V1/A1/S1，行业通用记法）。 */
function trackIdKey(kind: TrackKind): WorkbenchLocaleKey {
  switch (kind) {
    case 'video': return 'trackVideoId'
    case 'audio': return 'trackAudioId'
    case 'subtitle': return 'trackSubtitleId'
  }
}

/**
 * 生效默认值的分组（弹层里按「媒体类型 / 图像 / 视频」分块）。
 * 7 个字段一次性平铺会变成一堵表单墙；分组后每组 1–3 项，扫读成本降一个量级。
 * `fields` 用接口字段名（下发 patch 的口径），与 `defaultRows[].field` 对齐。
 */
const DEFAULT_GROUPS: ReadonlyArray<{ key: WorkbenchLocaleKey; fields: readonly string[] }> = [
  { key: 'defaultsGroupMode', fields: ['mediaMode'] },
  { key: 'defaultsGroupImage', fields: ['imageProvider', 'imageSize', 'imageStyle'] },
  { key: 'defaultsGroupVideo', fields: ['videoProvider', 'videoAspectRatio', 'videoDuration'] },
]

/**
 * 滚动到某个面板（左栏快捷入口用）。
 *
 * 停靠区四个面板在宽屏下本来就一直可见，`scrollIntoView` 对已在视口内的元素
 * 是"无事发生"——用户点按钮会觉得没反应。所以除了尽可能滚动，还回一手**视觉确认**：
 * 给目标面板加 `iv-pane--flash` 一次性高亮（2 秒渐隐的描边 + 底色）。
 *
 * @param pane - 目标面板的 `data-workbench-pane` 值。
 */
function scrollToPane(pane: string): void {
  const target = document.querySelector<HTMLElement>(`[data-workbench-pane="${pane}"]`)
  if (target === null) return
  target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  // 重启动画：先摘掉类，强制一次重排，再挂回去
  target.classList.remove('iv-pane--flash')
  void target.offsetWidth
  target.classList.add('iv-pane--flash')
  target.addEventListener('animationend', () => { target.classList.remove('iv-pane--flash') }, { once: true })
}

/** Save four-state → chip tone. */
function saveChipClass(state: 'saved' | 'dirty' | 'saving' | 'failed'): string {
  switch (state) {
    case 'saved': return 'iv-chip iv-chip--ok'
    case 'saving': return 'iv-chip iv-chip--run'
    case 'dirty': return 'iv-chip iv-chip--warn'
    case 'failed': return 'iv-chip iv-chip--err'
  }
}

/** Task status → status-dot tone. */
function taskDotClass(status: TaskStatus): string {
  switch (status) {
    case 'running': return 'iv-dot iv-dot--run'
    case 'succeeded': return 'iv-dot iv-dot--ok'
    case 'failed': return 'iv-dot iv-dot--err'
    default: return 'iv-dot'
  }
}

/** `m:ss.d` of a millisecond offset, for the timeline timecode. */
function timecode(ms: number): string {
  const total = Math.max(0, ms) / 1000
  const minutes = Math.floor(total / 60)
  const seconds = Math.floor(total % 60)
  const tenths = Math.floor((total * 10) % 10)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
}

/** Human-readable size for one asset row. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Resource kinds in picker order. */
const RESOURCE_KINDS: readonly ResourceKind[] = ['role', 'scene', 'prop', 'brand', 'style', 'voice', 'motion-track']

/** Localized label for one timeline track kind. */
function trackKindKey(kind: TrackKind): WorkbenchLocaleKey {
  switch (kind) {
    case 'video': return 'trackVideo'
    case 'audio': return 'trackAudio'
    case 'subtitle': return 'trackSubtitle'
  }
}

/** Localized label for one resource kind. */
function kindKey(kind: ResourceKind): WorkbenchLocaleKey {
  switch (kind) {
    case 'role': return 'kindRole'
    case 'scene': return 'kindScene'
    case 'prop': return 'kindProp'
    case 'brand': return 'kindBrand'
    case 'style': return 'kindStyle'
    case 'motion-track': return 'resourceMotionTrack'
    case 'voice': return 'kindVoice'
  }
}

/** Localized label for one task status. */
function statusKey(status: TaskStatus): WorkbenchLocaleKey {
  switch (status) {
    case 'queued': return 'statusQueued'
    case 'running': return 'statusRunning'
    case 'succeeded': return 'statusSucceeded'
    case 'failed': return 'statusFailed'
    case 'cancelled': return 'statusCancelled'
    case 'imported-idle': return 'statusImportedIdle'
  }
}

/** `HH:MM` of an ISO stamp, for the task list. */
function clockTime(iso: string): string {
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** File name of an absolute path. */
function baseName(path: string): string {
  return path.split('/').pop() ?? path
}

/**
 * Render the workbench.
 * @param props - seat runtime hooks, the injected API, and localized copy.
 * @returns the workbench surface.
 */
export function Workbench(props: WorkbenchProps): ReactNode {
  const { api, kind, t, useTabInfo } = props
  const { sidebar, tab } = useTabInfo()

  // 设计系统样式表：挂载时注入一次（幂等，与 xyflow 官方样式同一机制）。
  useWorkbenchStyle()

  // 注入面通过 ref 固定：座位可能每次渲染给出新实例，写进依赖数组会自我循环。
  const apiRef = useRef(api)
  apiRef.current = api

  const [mode, setMode] = useState<WorkbenchMode>('quick')
  // 工作流文档：画布维度的单一事实源（`T4-1`）。持久化随后端端点接入。
  const [workflow, setWorkflow] = useState<WorkflowRecord | undefined>(undefined)
  const [workflowState, setWorkflowState] = useState<'saved' | 'dirty' | 'saving' | 'failed'>('saved')
  const [runs, setRuns] = useState<readonly WorkflowRunRecord[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined)
  const [runBusy, setRunBusy] = useState(false)
  // 时间轴（阶段 5）：三轨 + clip，改动去抖落库
  const [timeline, setTimeline] = useState<TimelineRecord | undefined>(undefined)
  const [timelineState, setTimelineState] = useState<'saved' | 'dirty' | 'saving' | 'failed'>('saved')
  const [clipAssetPath, setClipAssetPath] = useState('')
  const [subtitleDraft, setSubtitleDraft] = useState('')
  const [previewMs, setPreviewMs] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const [ffmpeg, setFfmpeg] = useState<FfmpegProbe | undefined>(undefined)
  // 资源使用记录（`R-QCK-3`）：按资源 id 归拢，供资源库显示「被哪些素材用过」
  const [resourceUsage, setResourceUsage] = useState<readonly ResourceUsageRecord[]>([])
  // 默认值编辑草稿（`R-CFG-2`）：undefined = 不在编辑态
  const [defaultsDraft, setDefaultsDraft] = useState<Record<string, string> | undefined>(undefined)
  const [renderJob, setRenderJob] = useState<RenderJob | undefined>(undefined)
  const [health, setHealth] = useState<HealthState>({ status: 'checking' })
  const [projects, setProjects] = useState<readonly ProjectRecord[]>([])
  const [activeId, setActiveId] = useState<string | undefined>(undefined)
  const [assets, setAssets] = useState<readonly AssetRecord[]>([])
  const [outputs, setOutputs] = useState<readonly OutputFile[]>([])
  const [tasks, setTasks] = useState<readonly TaskRecord[]>([])
  const [resources, setResources] = useState<readonly ResourceRecord[]>([])
  const [assetFilter, setAssetFilter] = useState<'all' | 'image' | 'video'>('all')
  const [resourceKind, setResourceKind] = useState<ResourceKind>('role')
  const [resourceName, setResourceName] = useState('')
  const [resourceNote, setResourceNote] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty' | 'failed'>('saved')
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [previewPath, setPreviewPath] = useState<{ path: string; kind: 'image' | 'video' } | undefined>(undefined)
  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState<string | undefined>(undefined)
  // 被引用的素材/资源：首次删除被拒后，亮出"仍要删除"（force）让用户明确承担后果
  const [forceTarget, setForceTarget] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; tone: 'info' | 'error' } | undefined>(undefined)

  const activeProject = projects.find(project => project.id === activeId)
  // 进入工作流模式（或切项目）时读回该项目的流程文档；没有就准备一份空文档
  useEffect(() => {
    if (mode !== 'workflow' || activeProject === undefined) return
    const project = activeProject
    void (async () => {
      try {
        const rows = await apiRef.current.listWorkflows(project.id)
        const existing = rows[0]
        if (existing !== undefined) { setWorkflow(existing); setWorkflowState('saved'); return }
        setWorkflow(current => {
          if (current !== undefined && current.projectId === project.id) return current
          const stamp = new Date().toISOString()
          return {
            schemaVersion: 1, id: newWorkbenchId('wfl'), projectId: project.id,
            name: `${project.name} 工作流`, nodes: [], edges: [], createdAt: stamp, updatedAt: stamp,
          }
        })
        setWorkflowState('saved')
      } catch (error) {
        setNotice({ text: error instanceof Error ? error.message : String(error), tone: 'error' })
      }
    })()
  }, [mode, activeProject])

  // 进入工作流模式（或切项目）读回该项目最近的运行记录
  useEffect(() => {
    if (mode !== 'workflow' || activeProject === undefined || workflow === undefined) {
      setRuns([])
      setSelectedRunId(undefined)
      return
    }
    const project = activeProject
    const workflowId = workflow.id
    let stale = false
    void (async () => {
      try {
        const rows = await apiRef.current.listRuns(project.id, workflowId)
        if (stale) return
        setRuns(rows)
        setSelectedRunId(current => current ?? rows[0]?.id)
      } catch (error) {
        if (!stale) setNotice({ text: error instanceof Error ? error.message : String(error), tone: 'error' })
      }
    })()
    return () => { stale = true }
  }, [mode, activeProject, workflow?.id])

  // 只在运行中轮询（没有宿主→客户端推送通道）
  const runningRun = runs.some(run => run.status === 'running')
  useEffect(() => {
    if (!runningRun || activeProject === undefined) return
    const project = activeProject
    const workflowId = workflow?.id
    const timer = setInterval(() => {
      void (async () => {
        try {
          setRuns(await apiRef.current.listRuns(project.id, workflowId))
        } catch {
          // 轮询失败不打扰用户；状态留给下一次或手动刷新
        }
      })()
    }, 2500)
    return () => { clearInterval(timer) }
  }, [runningRun, activeProject, workflow?.id])

  // 进入时间轴模式（或切项目）读回该项目的成片时间轴；没有就准备一份空的三轨文档
  useEffect(() => {
    if (mode !== 'timeline' || activeProject === undefined) {
      setTimeline(undefined)
      return
    }
    const project = activeProject
    let stale = false
    void (async () => {
      try {
        const rows = await apiRef.current.listTimelines(project.id)
        if (stale) return
        const existing = rows[0]
        if (existing !== undefined) { setTimeline(existing); setTimelineState('saved'); return }
        const stamp = new Date().toISOString()
        setTimeline(current => {
          if (current !== undefined && current.projectId === project.id) return current
          return {
            schemaVersion: 1, id: newWorkbenchId('tml'), projectId: project.id, name: `${project.name} 成片`,
            frameRate: 30,
            tracks: [
              { id: 'track-video', kind: 'video', clips: [] },
              { id: 'track-audio', kind: 'audio', clips: [] },
              { id: 'track-subtitle', kind: 'subtitle', clips: [] },
            ],
            burnSubtitles: true,
            createdAt: stamp, updatedAt: stamp,
          }
        })
        setTimelineState('saved')
      } catch (error) {
        if (!stale) setNotice({ text: error instanceof Error ? error.message : String(error), tone: 'error' })
      }
    })()
    return () => { stale = true }
  }, [mode, activeProject])

  // 资源使用记录：切项目或资源增删后重读（轻量，资源库就要这份「被谁用过」）
  useEffect(() => {
    if (activeProject === undefined) { setResourceUsage([]); return }
    const project = activeProject
    let stale = false
    void (async () => {
      try {
        const rows = await apiRef.current.listResourceUsage({ projectId: project.id })
        if (!stale) setResourceUsage(rows)
      } catch {
        // 拿不到就只显示资源本身，不打扰用户
      }
    })()
    return () => { stale = true }
  }, [activeProject, resources.length])

  // 时间轴模式下探测一次 ffmpeg（导出能力的前置条件，`T5-4`）
  const recheckFfmpeg = useCallback(async (): Promise<void> => {
    try {
      setFfmpeg(await apiRef.current.probeFfmpeg())
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : String(error), tone: 'error' })
    }
  }, [])

  useEffect(() => {
    if (mode !== 'timeline') return
    let stale = false
    void (async () => {
      try {
        const probe = await apiRef.current.probeFfmpeg()
        if (!stale) setFfmpeg(probe)
      } catch {
        // 探测失败不阻塞时间轴编辑（导出前会再拦一次）
      }
    })()
    return () => { stale = true }
  }, [mode])

  // 导出任务：进入时间轴时读回最近一次，运行中每 2 秒轮询（没有推送通道）
  const renderRunning = renderJob?.status === 'running'
  useEffect(() => {
    if (mode !== 'timeline' || activeProject === undefined) return
    const project = activeProject
    let stale = false
    const load = async (): Promise<void> => {
      try {
        const jobs = await apiRef.current.listRenders(project.id)
        if (!stale) setRenderJob(jobs[0])
      } catch {
        // 轮询失败不打扰用户
      }
    }
    void load()
    if (!renderRunning) return () => { stale = true }
    const timer = setInterval(() => { void load() }, 2000)
    return () => { stale = true; clearInterval(timer) }
  }, [mode, activeProject, renderRunning])

  // 时间轴改动 → 去抖落库
  const timelineDirty = timelineState === 'dirty'
  useEffect(() => {
    if (mode !== 'timeline' || !timelineDirty || timeline === undefined) return
    const pending = timeline
    const timer = setTimeout(() => {
      void (async () => {
        setTimelineState('saving')
        try {
          const stored = await apiRef.current.saveTimeline({
            id: pending.id, projectId: pending.projectId, name: pending.name,
            tracks: pending.tracks, frameRate: pending.frameRate, burnSubtitles: pending.burnSubtitles,
          })
          setTimeline(stored)
          setTimelineState('saved')
        } catch (error) {
          setTimelineState('failed')
          setNotice({ text: error instanceof Error ? error.message : String(error), tone: 'error' })
        }
      })()
    }, 800)
    return () => { clearTimeout(timer) }
  }, [timelineDirty, timeline, mode])

  // 画布改动 → 去抖落库（`T4-1` 单一事实源 + 保存四态）
  const workflowDirty = workflowState === 'dirty'
  useEffect(() => {
    if (mode !== 'workflow' || !workflowDirty || workflow === undefined) return
    const pending = workflow
    // 后台静默落库：不占全局 busy（用户还能继续拖节点），失败只反映在画布保存态上
    const timer = setTimeout(() => {
      void (async () => {
        setWorkflowState('saving')
        try {
          const stored = await apiRef.current.saveWorkflow({
            id: pending.id, projectId: pending.projectId, name: pending.name,
            nodes: pending.nodes, edges: pending.edges,
          })
          setWorkflow(stored)
          setWorkflowState('saved')
        } catch (error) {
          setWorkflowState('failed')
          setNotice({ text: error instanceof Error ? error.message : String(error), tone: 'error' })
        }
      })()
    }, 800)
    return () => { clearTimeout(timer) }
  }, [workflowDirty, workflow, mode])

  /** 时间轴总时长与当前播放头处的活动片段（顺序预览用）。 */
  const timelineTotal = timeline === undefined ? 0 : timelineDurationMs(timeline.tracks)
  const playheadMs = Math.max(0, Math.min(previewMs, timelineTotal))
  // 与导出共用同一边界判断（`R-TML-3`）
  const activeVideo = timeline === undefined ? undefined : activeClipAt(timeline.tracks, 'video', playheadMs)
  const activeSubtitle = timeline === undefined ? undefined : activeClipAt(timeline.tracks, 'subtitle', playheadMs)

  /** 时间轴通用改法：换掉某条轨道。 */
  const patchTrack = (trackId: string, update: (track: TimelineTrack) => TimelineTrack): void => {
    setTimeline(current => current === undefined
      ? current
      : { ...current, tracks: current.tracks.map(track => (track.id === trackId ? update(track) : track)) })
    setTimelineState('dirty')
  }

  /** 末尾追加一个 clip（起点接在该轨当前末尾）。 */
  const appendClip = (trackId: string, clip: { assetPath?: string; text?: string }): void => {
    const stamp = new Date().toISOString()
    patchTrack(trackId, track => {
      const end = track.clips.reduce((longest, existing) => Math.max(longest, existing.startMs + existing.durationMs), 0)
      const id = `clip-${Date.now().toString(36)}-${track.clips.length}`
      return {
        ...track,
        clips: [...track.clips, {
          id, startMs: end, durationMs: 3000,
          ...clip.assetPath === undefined ? {} : { assetPath: clip.assetPath },
          ...clip.text === undefined ? {} : { text: clip.text },
        }],
      }
    })
    void stamp
  }

  const selectedAsset = assets.find(asset => asset.id === selectedId)
  // 预览目标：已登记的素材优先，其次是"从任务行直接看产出"的临时目标
  const previewTarget = selectedAsset === undefined
    ? previewPath
    : { path: selectedAsset.path, kind: selectedAsset.kind }
  const visibleAssets = assetFilter === 'all' ? assets : assets.filter(asset => asset.kind === assetFilter)

  /** Run one host action, surfacing failure as a notice instead of a crash. */
  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true)
    setNotice(undefined)
    try {
      await action()
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : String(error), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }, [])

  const loadProjects = useCallback(async () => {
    const list = await apiRef.current.listProjects()
    setProjects(list)
    setActiveId(previous => (previous !== undefined && list.some(item => item.id === previous) ? previous : list[0]?.id))
  }, [])

  const loadOutputs = useCallback(async () => {
    setOutputs(await apiRef.current.listOutputs())
  }, [])

  const loadTasks = useCallback(async () => {
    setTasks(await apiRef.current.listTasks())
  }, [])

  const loadResources = useCallback(async (projectId: string) => {
    setResources(await apiRef.current.listResources(projectId))
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const facts = await apiRef.current.health()
        setHealth({
          status: 'ok', version: facts.version, provider: facts.provider,
          ...facts.defaults === undefined ? {} : { defaults: facts.defaults },
          ...facts.options === undefined ? {} : { options: facts.options },
        })

      } catch (error) {
        setHealth({ status: 'failed', message: error instanceof Error ? error.message : String(error) })
      }
      await run(async () => { await loadProjects(); await loadOutputs(); await loadTasks() })
    })()
  }, [loadOutputs, loadProjects, loadTasks, run])

  // 双向一致性（`T6-4`）：宿主→客户端没有通用推送通道，所以按**固定 5 秒**节奏轮询
  // 项目/素材/任务，让 Agent（工具）那边的改动自动出现；口径与取舍：
  //   · 延迟 ≤ 5 秒（面板不可见时不轮询，省掉无意义的往返）
  //   · 本地正在编辑的文档（画布/时间轴处于 dirty/saving）**不覆盖**，避免打断输入
  //     —— 这些面的"Agent 改名后工具能读到"方向本来就是宿主权威，无需客户端推送
  //   · 轮询失败静默重试，不弹错
  useEffect(() => {
    if (!tab.visible) return
    const timer = setInterval(() => {
      void (async () => {
        try {
          await loadProjects()
          await loadTasks()
          if (activeProject !== undefined) setAssets(await apiRef.current.listAssets(activeProject.id))
          setRefreshTick(current => current + 1)
        } catch {
          // 下一轮再试
        }
      })()
    }, 5000)
    return () => { clearInterval(timer) }
  }, [tab.visible, activeProject?.id, loadProjects, loadTasks])

  // 自动保存：改名输入停下约 0.9 秒后落盘（手动"保存"仍在，四态照旧）。
  // 依赖里只放"是否处于未保存"，避免每次按键都重建定时器。
  const dirtyRename = renaming && saveState === 'dirty'
  useEffect(() => {
    if (!dirtyRename || activeProject === undefined) return
    const timer = setTimeout(() => {
      void run(async () => {
        setSaveState('saving')
        try {
          await apiRef.current.renameProject(activeProject.id, renameValue.trim())
          await loadProjects()
          setSaveState('saved')
        } catch (error) {
          setSaveState('failed')
          throw error
        }
      })
    }, 900)
    return () => { clearTimeout(timer) }
  }, [dirtyRename, activeProject, renameValue, loadProjects, run])

  useEffect(() => {
    void (async () => {
      setSelectedId(undefined)
      if (activeId === undefined) { setAssets([]); setResources([]); return }
      try {
        setAssets(await apiRef.current.listAssets(activeId))
        await loadResources(activeId)
      } catch (error) {
        setNotice({ text: error instanceof Error ? error.message : String(error), tone: 'error' })
      }
    })()
  }, [activeId, loadResources])

  // 生效默认值（7 字段）只读展示：界面上看得出这一轮按什么参数生成（`T2-11`）
  // `field` 是接口字段名（imageSize…），`key` 是界面文案键：下发 patch 必须用前者
  const defaultRows: Array<{ key: WorkbenchLocaleKey; field: string; value: string }> = health.status === 'ok' && health.defaults !== undefined
    ? ([
      ['defaultMediaMode', health.defaults.mediaMode],
      ['defaultImageProvider', health.defaults.imageProvider],
      ['defaultImageSize', health.defaults.imageSize],
      ['defaultImageStyle', health.defaults.imageStyle],
      ['defaultVideoProvider', health.defaults.videoProvider],
      ['defaultVideoAspectRatio', health.defaults.videoAspectRatio],
      ['defaultVideoDuration', health.defaults.videoDuration],
    ] as Array<[WorkbenchLocaleKey, string | number | null | undefined]>)
      .map(([key, value]) => ({
        key,
        field: key.replace(/^default/, '').replace(/^./, character => character.toLowerCase()),
        value: value === null || value === undefined || value === '' ? t('none') : String(value),
      }))
    : []

  // 默认值下拉选项（`R-CFG-2`）：白名单随宿主 `health` 下发，与协议层校验同源，
  // 浏览器包不内置服务商名（`T2-11`）。'' = 未设置（清除覆盖，跟随设置）；
  // 宿主未下发 `options` 时只给「未设置」。
  const options = health.status === 'ok' ? health.options : undefined
  const styleLabelKeys: Record<string, WorkbenchLocaleKey> = {
    photo: 'optStylePhoto', illustration: 'optStyleIllustration',
    '3d': 'optStyle3d', anime: 'optStyleAnime', ink: 'optStyleInk',
  }
  const defaultsOptions = (field: string): ReadonlyArray<{ value: string; label: string }> => {
    const unset = { value: '', label: t('none') }
    switch (field) {
      case 'mediaMode':
        return [unset, { value: 'text', label: t('optModeText') }, { value: 'image', label: t('optModeImage') }, { value: 'video', label: t('optModeVideo') }]
      case 'imageProvider':
        return [unset, ...(options?.imageProviders ?? []).map(provider => ({ value: provider, label: provider }))]
      case 'videoProvider':
        return [unset, ...(options?.videoProviders ?? []).map(provider => ({ value: provider, label: provider }))]
      case 'imageSize':
        return [unset, ...(options?.imageSizes ?? []).map(option => ({ value: option.size, label: `${option.label} · ${option.size}` }))]
      case 'imageStyle':
        return [unset, ...(options?.imageStyles ?? []).map(id => ({ value: id, label: t(styleLabelKeys[id] ?? 'optStylePhoto') }))]
      case 'videoAspectRatio':
        return [unset, ...(options?.videoAspectRatios ?? []).map(ratio => ({ value: ratio, label: ratio }))]
      case 'videoDuration': {
        const duration = options?.videoDuration
        if (duration === undefined) return [unset]
        return [unset, ...Array.from({ length: duration.max - duration.min + 1 }, (_, index) => {
          const value = String(duration.min + index)
          return { value, label: value }
        })]
      }
      default:
        return [unset]
    }
  }

  // 非本机宿主：`/outputs` 只在回环注册，预览会打不开——先告诉用户怎么办（`T2-9`）
  const hostIsLoopback = (() => {
    if (typeof window === 'undefined') return true
    const host = window.location?.hostname ?? ''
    return host === '' || host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]'
  })()

  const healthText = health.status === 'checking'
    ? t('healthChecking')
    : health.status === 'ok'
      ? `${health.version} · ${health.provider}`
      : t('healthFailed')

  return (
    <div
      className="iv"
      data-workbench-kind={kind}
      data-workbench-visible={tab.visible ? 'true' : 'false'}
      data-workbench-refreshed={String(refreshTick)}
      data-workbench-fullscreen={sidebar.fullscreen ? 'true' : 'false'}
      data-workbench-health={health.status}
      data-workbench-save={saveState}
      data-workbench-projects={String(projects.length)}
      data-workbench-assets={String(assets.length)}
      data-workbench-tasks={String(tasks.length)}
      data-workbench-resources={String(resources.length)}
    >
      {/* ============ 顶栏：品牌 / 项目 / 状态 / 操作 ============ */}
      <header className="iv-top">
        <div className="iv-brand">
          <span className="iv-mark"><BrandMark size={12} /></span>
          <span className="iv-brand-text">
            <span className="iv-brand-name">dsh-image-video</span>
            <span className="iv-brand-sub">{t('brandTagline')}</span>
          </span>
        </div>
        <span className="iv-top-sep" aria-hidden="true" />
        <div className="iv-proj">
          <span className="iv-micro">{t('sectionProject')}</span>
          {projects.length === 0
            ? <span className="iv-meta">{t('projectNone')}</span>
            : (
              <select
                className="iv-select"
                aria-label={t('sectionProject')}
                value={activeId ?? ''}
                onChange={event => { setActiveId(event.target.value) }}
                style={{ maxWidth: '180px' }}
              >
                {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            )}
          <span className="iv-newform">
            <input
              className="iv-input"
              aria-label={t('newProject')}
              placeholder={t('projectNamePlaceholder')}
              value={name}
              onChange={event => { setName(event.target.value) }}
            />
            <button
              type="button"
              className="iv-btn iv-btn--acc iv-btn--sm"
              disabled={busy || name.trim().length === 0}
              onClick={() => {
                void run(async () => {
                  const project = await apiRef.current.createProject(name.trim())
                  setName('')
                  await loadProjects()
                  setActiveId(project.id)
                })
              }}
            >
              {t('create')}
            </button>
          </span>
        </div>
        <div className="iv-top-meta">
          <span className={saveChipClass(saveState)} title={saveState === 'failed' ? t('saveFailed') : undefined}>
            <i className="iv-dot" aria-hidden="true" />
            {t(saveState === 'dirty' ? 'saveDirty' : saveState === 'saving' ? 'saveSaving' : saveState === 'failed' ? 'saveFailed' : 'saveSaved')}
          </span>
          <span
            className={`iv-chip${health.status === 'ok' ? ' iv-chip--ok' : health.status === 'checking' ? '' : ' iv-chip--err'}`}
            title={health.status === 'failed' ? health.message : undefined}
          >
            <i className="iv-dot" aria-hidden="true" />
            {healthText}
          </span>
          {activeProject === undefined || renaming ? null : (
            <button
              type="button"
              className="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm"
              aria-label={t('rename')}
              title={t('rename')}
              onClick={() => { setRenaming(true); setRenameValue(activeProject.name); setSaveState('saved') }}
            >
              <Icon name="pencil" />
            </button>
          )}
          {activeProject === undefined ? null : (
            <button
              type="button"
              className={`iv-btn iv-btn--icon iv-btn--sm${confirming === activeProject.id ? ' iv-btn--danger' : ' iv-btn--ghost'}`}
              aria-label={confirming === activeProject.id ? t('confirmRemove') : t('remove')}
              title={confirming === activeProject.id ? t('confirmRemove') : t('remove')}
              disabled={busy}
              onClick={() => {
                if (confirming !== activeProject.id) { setConfirming(activeProject.id); return }
                setConfirming(undefined)
                void run(async () => {
                  await apiRef.current.removeProject(activeProject.id)
                  await loadProjects()
                })
              }}
            >
              <Icon name={confirming === activeProject.id ? 'alert' : 'trash'} />
            </button>
          )}
          <button
            type="button"
            className="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm"
            aria-label={t('refresh')}
            title={t('refresh')}
            disabled={busy}
            onClick={() => { void run(async () => { await loadProjects(); await loadOutputs(); await loadTasks() }) }}
          >
            <Icon name="refresh" />
          </button>
        </div>
      </header>

      {/* ============ 改名行 ============ */}
      {renaming && activeProject !== undefined
        ? (
          <div className="iv-rename">
            <Icon name="pencil" />
            <input
              className="iv-input"
              aria-label={t('rename')}
              value={renameValue}
              onChange={event => {
                setRenameValue(event.target.value)
                const next = event.target.value.trim()
                setSaveState(next === activeProject.name || next === '' ? 'saved' : 'dirty')
              }}
            />
            <button
              type="button"
              className="iv-btn iv-btn--acc iv-btn--sm"
              disabled={busy || renameValue.trim() === ''}
              onClick={() => {
                void run(async () => {
                  setSaveState('saving')
                  try {
                    await apiRef.current.renameProject(activeProject.id, renameValue.trim())
                    await loadProjects()
                    setRenaming(false)
                    setSaveState('saved')
                  } catch (error) {
                    setSaveState('failed')
                    throw error
                  }
                })
              }}
            >
              {t('save')}
            </button>
            <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" onClick={() => { setRenaming(false); setSaveState('saved') }}>
              {t('cancel')}
            </button>
          </div>
        )
        : null}

      {/* ============ 默认值摘要条 + 弹层 ============ */}
      {defaultRows.length === 0
        ? null
        : (
          <div className="iv-defaults" data-workbench-defaults="true">
            <span className="iv-micro">{t('defaultsTitle')}</span>
            {defaultRows.map(row => (
              <span key={row.key} className="iv-def" data-workbench-default={row.key}>
                <i>{t(row.key)}</i><b>{row.value}</b>
              </span>
            ))}
            <span className="iv-pop">
              <button
                type="button"
                className="iv-btn iv-btn--ghost iv-btn--sm"
                data-workbench-defaults-edit="true"
                onClick={() => {
                  setDefaultsDraft(Object.fromEntries(defaultRows.map(row => [row.field, row.value === t('none') ? '' : row.value])))
                }}
              >
                <Icon name="sliders" />{t('defaultsEdit')}
              </button>
              {defaultsDraft === undefined ? null : (
                <div className="iv-pop-panel" data-workbench-defaults-editor="true" role="dialog" aria-label={t('defaultsTitle')}>
                  <div className="iv-pop-head">
                    <Icon name="sliders" size={14} />
                    <span className="iv-pop-head-txt">
                      <b className="iv-pop-head-title">{t('defaultsTitle')}</b>
                      <span className="iv-pop-head-sub">{t('defaultsEditHint')}</span>
                    </span>
                  </div>
                  {DEFAULT_GROUPS.map(group => {
                    const rows = defaultRows.filter(row => group.fields.includes(row.field))
                    if (rows.length === 0) return null
                    return (
                      <div key={group.key} className="iv-pop-group">
                        <span className="iv-micro iv-pop-group-title">{t(group.key)}</span>
                        <div className="iv-pop-grid">
                          {rows.map(row => {
                            const options = defaultsOptions(row.field)
                            const current = defaultsDraft[row.field] ?? ''
                            // 防御：当前值不在白名单时补一个原值选项，避免 select 静默漂移到第一项
                            const known = options.some(option => option.value === current)
                            return (
                              <label key={row.key}>
                                <span>{t(row.key)}</span>
                                <select
                                  className="iv-select"
                                  aria-label={t(row.key)}
                                  value={current}
                                  onChange={event => { setDefaultsDraft({ ...defaultsDraft, [row.field]: event.target.value }) }}
                                >
                                  {known ? null : <option value={current}>{current}</option>}
                                  {options.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  <div className="iv-pop-foot">
                    <span className="iv-meta">{t('defaultsEditHint')}</span>
                    <button
                      type="button"
                      className="iv-btn iv-btn--acc iv-btn--sm"
                      data-workbench-defaults-save="true"
                      disabled={busy}
                      onClick={() => {
                        void run(async () => {
                          const patch: Record<string, string | number | null> = {}
                          for (const row of defaultRows) {
                            const next = (defaultsDraft[row.field] ?? '').trim()
                            const current = row.value === t('none') ? '' : row.value
                            if (next === current) continue
                            patch[row.field] = next === '' ? null : /duration/i.test(row.field) ? Number(next) : next
                          }
                          if (Object.keys(patch).length > 0) await apiRef.current.saveDefaults(patch)
                          setDefaultsDraft(undefined)
                          const facts = await apiRef.current.health()
                          setHealth({
                            status: 'ok', version: facts.version, provider: facts.provider,
                            ...facts.defaults === undefined ? {} : { defaults: facts.defaults },
                          })
                          setNotice({ text: t('defaultsSaved'), tone: 'info' })
                        })
                      }}
                    >
                      {t('defaultsSave')}
                    </button>
                    <button
                      type="button"
                      className="iv-btn iv-btn--ghost iv-btn--sm"
                      data-workbench-defaults-cancel="true"
                      onClick={() => { setDefaultsDraft(undefined) }}
                    >
                      {t('defaultsCancel')}
                    </button>
                  </div>
                </div>
              )}
            </span>
          </div>
        )}

      {/* ============ 提示条 ============ */}
      {notice === undefined ? null : (
        <p className={`iv-notice${notice.tone === 'error' ? ' iv-notice--error' : ''}`} role="status">
          <Icon name={notice.tone === 'error' ? 'alert' : 'check'} />
          <span>{notice.tone === 'error' ? `${t('failed')}: ` : ''}{notice.text}</span>
        </p>
      )}

      {/* ============ 身体：左图标栏 + 主区 ============ */}
      <div className="iv-body">
        <nav className="iv-rail" aria-label={t('tabTitle')}>
          {MODES.map(candidate => (
            <button
              key={candidate}
              type="button"
              className={`iv-rail-btn${candidate === mode ? ' on' : ''}`}
              aria-pressed={candidate === mode}
              aria-label={t(MODE_KEYS[candidate])}
              onClick={() => { setMode(candidate) }}
            >
              <Icon name={MODE_ICONS[candidate]} size={15} />
              <span className="iv-rail-tip">{t(MODE_KEYS[candidate])}</span>
            </button>
          ))}
          <span className="iv-rail-sep" aria-hidden="true" />
          <button
            type="button"
            className="iv-rail-btn"
            aria-label={t('railAssets')}
            onClick={() => { scrollToPane('paneAssets') }}
          >
            <Icon name="layers" size={15} />
            <span className="iv-rail-tip">{t('railAssets')}</span>
          </button>
          <button
            type="button"
            className="iv-rail-btn"
            aria-label={t('railTasks')}
            onClick={() => { scrollToPane('paneTasks') }}
          >
            <Icon name="clock" size={15} />
            <span className="iv-rail-tip">{t('railTasks')}</span>
          </button>
          <div className="iv-rail-bottom">
            <button
              type="button"
              className="iv-rail-btn"
              aria-label={t('railDefaults')}
              onClick={() => {
                if (defaultsDraft === undefined && defaultRows.length > 0) {
                  setDefaultsDraft(Object.fromEntries(defaultRows.map(row => [row.field, row.value === t('none') ? '' : row.value])))
                }
                document.querySelector('[data-workbench-defaults]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
              }}
            >
              <Icon name="sliders" size={15} />
              <span className="iv-rail-tip">{t('railDefaults')}</span>
            </button>
          </div>
        </nav>

        <main className="iv-main">
          {/* ============ 模式页 ============ */}
          <section className="iv-page" aria-label={t(MODE_KEYS[mode])}>
            {mode === 'quick'
              ? (
                <section className="iv-pane">
                  <div className="iv-hero">
                    <div className="iv-hero-top">
                      <span className="iv-hero-ico"><Icon name="bolt" size={19} /></span>
                      <div style={{ display: 'grid', gap: '1px' }}>
                        <h3 className="iv-hero-title">{t('modeQuick')}</h3>
                        <span className="iv-meta">{busy ? t('busy') : t('emptyHint')}</span>
                      </div>
                    </div>
                    <p className="iv-hero-text">{t('modeQuickHint')}</p>
                    <div className="iv-steps">
                      <span className="iv-step"><span className="iv-step-n">1</span>{t('heroStepChat')}</span>
                      <Icon name="chevron" className="iv-step-arrow" size={12} />
                      <span className="iv-step"><span className="iv-step-n">2</span>{t('heroStepOutputs')}</span>
                      <Icon name="chevron" className="iv-step-arrow" size={12} />
                      <span className="iv-step"><span className="iv-step-n">3</span>{t('heroStepFile')}</span>
                    </div>
                    <div className="iv-stats">
                      <span className="iv-stat"><b>{outputs.length}</b><span>{t('statOutputs')}</span></span>
                      <span className="iv-stat"><b>{assets.length}</b><span>{t('statAssets')}</span></span>
                      <span className="iv-stat"><b>{tasks.length}</b><span>{t('statTasks')}</span></span>
                      <span className="iv-stat"><b>{resources.length}</b><span>{t('statResources')}</span></span>
                    </div>
                    {outputs.length === 0 ? <p className="iv-meta">{t('noOutputs')}</p> : null}
                  </div>
                </section>
              )
              : null}

            {mode === 'workflow' && workflow !== undefined
              ? (
                <section className="iv-pane" data-workbench-pane="paneCanvas" data-workbench-planned="false">
                  <div className="iv-pane-head">
                    <span className="iv-pane-tile"><Icon name="flow" size={13} /></span>
                    <h3 className="iv-pane-title">{t('paneCanvas')}</h3>
                    <div className="iv-pane-actions">
                      <span className={saveChipClass(workflowState)} data-workflow-save={workflowState} role="status">
                        <i className="iv-dot" aria-hidden="true" />
                        {t(workflowState === 'dirty' ? 'saveDirty' : workflowState === 'saving' ? 'saveSaving' : workflowState === 'failed' ? 'saveFailed' : 'saveSaved')}
                      </span>
                    </div>
                  </div>
                  <WorkflowCanvas
                    record={workflow}
                    onChange={next => { setWorkflow(next); setWorkflowState('dirty') }}
                    t={t}
                    run={{
                      ...(runs.find(run => run.id === selectedRunId) ?? runs[0]) === undefined
                        ? {}
                        : { latest: runs.find(run => run.id === selectedRunId) ?? runs[0] },
                      history: runs,
                      ...selectedRunId === undefined ? {} : { selectedRunId },
                      onSelectRun: setSelectedRunId,
                      busy: runBusy,
                      onStart: () => {
                        void run(async () => {
                          setRunBusy(true)
                          try {
                            // 起跑前先落库，保证宿主拿到的是当前这张图
                            const stored = await apiRef.current.saveWorkflow({
                              id: workflow.id, projectId: workflow.projectId, name: workflow.name,
                              nodes: workflow.nodes, edges: workflow.edges,
                            })
                            setWorkflow(stored)
                            setWorkflowState('saved')
                            const started = await apiRef.current.runWorkflow(stored.id)
                            setSelectedRunId(started.id)
                            setRuns(current => [started, ...current])
                          } finally {
                            setRunBusy(false)
                          }
                        })
                      },
                      onCancel: () => {
                        void run(async () => {
                          const id = selectedRunId ?? runs[0]?.id
                          if (id === undefined) return
                          await apiRef.current.cancelRun(id)
                        })
                      },
                      onRetry: () => {
                        void run(async () => {
                          const id = selectedRunId ?? runs[0]?.id
                          if (id === undefined) return
                          setRunBusy(true)
                          try {
                            const retried = await apiRef.current.retryRun(id)
                            setSelectedRunId(retried.id)
                            setRuns(current => [retried, ...current])
                          } finally {
                            setRunBusy(false)
                          }
                        })
                      },
                    }}
                  />
                </section>
              )
              : null}

            {mode === 'timeline' && timeline !== undefined
              ? (
                <section className="iv-pane" data-workbench-pane="paneTimeline" data-workbench-planned="false">
                  <div className="iv-pane-head">
                    <span className="iv-pane-tile"><Icon name="film" size={13} /></span>
                    <h3 className="iv-pane-title">{t('timelineTitle')}</h3>
                    <span className="iv-chip">
                      <Icon name="clock" />
                      {t('timelineTotal')} {Math.round(timelineDurationMs(timeline.tracks) / 1000)}s
                    </span>
                    <div className="iv-pane-actions">
                      <label className="iv-check">
                        <input type="checkbox" data-timeline-burn="true" checked={timeline.burnSubtitles}
                          aria-label={t('burnSubtitles')}
                          onChange={event => {
                            const burnSubtitles = event.target.checked
                            setTimeline(current => current === undefined ? current : { ...current, burnSubtitles })
                            setTimelineState('dirty')
                          }} />
                        {t('burnSubtitles')}
                      </label>
                      <span className={saveChipClass(timelineState)} data-timeline-save={timelineState} role="status">
                        <i className="iv-dot" aria-hidden="true" />
                        {t(timelineState === 'dirty' ? 'saveDirty' : timelineState === 'saving' ? 'saveSaving' : timelineState === 'failed' ? 'saveFailed' : 'saveSaved')}
                      </span>
                    </div>
                  </div>

                  {/* ffmpeg 状态行 */}
                  <div className="iv-toolbar" data-timeline-ffmpeg={ffmpeg === undefined ? 'unknown' : ffmpeg.available ? 'ok' : ffmpeg.code ?? 'unavailable'}>
                    <span className={`iv-chip${ffmpeg !== undefined && ffmpeg.available ? ' iv-chip--ok' : ffmpeg === undefined ? '' : ' iv-chip--err'}`}>
                      <i className="iv-dot" aria-hidden="true" />
                      {ffmpeg === undefined
                        ? '…'
                        : ffmpeg.available
                          ? `${t('ffmpegOk')} ${ffmpeg.version ?? ''}`
                          : t('healthFailed')}
                    </span>
                    <span className="iv-meta iv-ellipsis" style={{ flex: 1 }} title={ffmpeg?.path ?? ffmpeg?.message ?? ''}>
                      {ffmpeg === undefined ? '' : ffmpeg.available ? ffmpeg.path ?? '' : ffmpeg.message ?? ''}
                    </span>
                    <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" onClick={() => { void recheckFfmpeg() }}>
                      <Icon name="refresh" />{t('ffmpegRecheck')}
                    </button>
                  </div>

                  {/* 导出操作行 */}
                  <div className="iv-toolbar">
                    <button type="button" className="iv-btn iv-btn--acc iv-btn--sm" data-timeline-export="true"
                      disabled={renderRunning || timeline.tracks.find(track => track.kind === 'video')?.clips.length === 0}
                      onClick={() => {
                        void run(async () => {
                          setRenderJob(await apiRef.current.renderTimeline(timeline.id, timeline.projectId))
                        })
                      }}>
                      <Icon name="download" />{t('exportStart')}
                    </button>
                    <button type="button" className="iv-btn iv-btn--sm" disabled={!renderRunning} data-timeline-export-cancel="true"
                      onClick={() => {
                        void run(async () => {
                          const id = renderJob?.id
                          if (id === undefined) return
                          await apiRef.current.cancelRender(id)
                        })
                      }}>
                      {t('exportCancel')}
                    </button>
                    {renderJob === undefined
                      ? null
                      : (
                        <>
                          <span
                            className={`iv-chip${renderJob.status === 'succeeded' ? ' iv-chip--ok' : renderJob.status === 'running' ? ' iv-chip--run' : renderJob.status === 'failed' ? ' iv-chip--err' : ''}`}
                            data-timeline-render={renderJob.status}
                            data-timeline-render-percent={String(renderJob.percent)}
                          >
                            <i className="iv-dot" aria-hidden="true" />
                            {t(renderJob.status === 'running' ? 'exportRunning' : renderJob.status === 'succeeded' ? 'exportDone' : 'exportFailed')}
                            {renderJob.status === 'running' ? ` ${renderJob.percent}%` : ''}
                            {renderJob.outputPath === undefined ? '' : ` · ${t('exportResult')} ${baseName(renderJob.outputPath)}`}
                            {renderJob.error === undefined ? '' : ` · ${renderJob.error.slice(0, 90)}`}
                          </span>
                          {renderJob.status === 'running'
                            ? <span className="iv-progress"><i style={{ width: `${Math.max(2, renderJob.percent)}%` }} /></span>
                            : null}
                        </>
                      )}
                  </div>

                  {/* 节目监视器（恒深，媒体惯例） */}
                  <div className="iv-monitor" data-timeline-preview="true" data-timeline-active-clip={activeVideo?.id ?? ''}
                    data-timeline-active-subtitle={activeSubtitle?.id ?? ''}>
                    {activeVideo?.assetPath === undefined
                      ? <span className="iv-meta" style={{ color: '#9aa0a8' }}>{t('previewIdle')}</span>
                      : /\.(png|jpe?g|webp|gif)$/i.test(activeVideo.assetPath)
                        ? <img src={`/outputs/${encodeURIComponent(baseName(activeVideo.assetPath))}`} alt="" />
                        : <video src={`/outputs/${encodeURIComponent(baseName(activeVideo.assetPath))}`} muted />}
                    <span className="iv-mon-tc">{timecode(playheadMs)} / {timecode(timelineTotal)}</span>
                    <span className="iv-mon-badge">{t('monitorProgram')}</span>
                    {activeSubtitle?.text === undefined ? null : (
                      <span data-timeline-subtitle-preview="true"
                        className="iv-mon-sub"
                        style={{
                          fontSize: `${Math.max(11, Math.min(26, Math.round((activeSubtitle.style?.fontSize ?? 32) / 2)))}px`,
                          color: activeSubtitle.style?.color ?? '#ffffff',
                          ...(activeSubtitle.style?.position ?? 'bottom') === 'bottom' ? { bottom: '9px' } : {},
                          ...activeSubtitle.style?.position === 'top' ? { top: '9px' } : {},
                          ...activeSubtitle.style?.position === 'middle' ? { top: '50%', transform: 'translateY(-50%)' } : {},
                        }}>
                        {activeSubtitle.text}
                      </span>
                    )}
                  </div>

                  {/* transport：播放头 + 时间码 */}
                  <div className="iv-transport">
                    <button type="button" className="iv-tp-btn iv-tp-btn--play" aria-label={t('transportPlay')} title={t('transportPlay')}>
                      <Icon name="play" size={11} />
                    </button>
                    <span className="iv-tc-now">{timecode(playheadMs)}</span>
                    <input type="range" className="iv-scrub" data-timeline-playhead="true" min={0} max={Math.max(1, timelineTotal)}
                      value={playheadMs} aria-label={t('playhead')}
                      onChange={event => { setPreviewMs(Number(event.target.value)) }} />
                    <span className="iv-tc-total">/ {timecode(timelineTotal)}</span>
                    <span className="iv-zoom">
                      <Icon name="search" size={11} />
                      {t('timelineZoom')}
                      <input className="iv-scrub" type="range" min={0} max={100} defaultValue={60} aria-label={t('timelineZoom')} />
                    </span>
                  </div>

                  {/* 轨道区：刻度尺 + V1/A1/S1 + 播放头 */}
                  <div className="iv-tl">
                    <div className="iv-ruler" aria-hidden="true">
                      {[0, 25, 50, 75, 100].map(pct => (
                        <i key={pct} style={{ left: `${pct}%` }} />
                      ))}
                      {[0, 25, 50, 75, 100].map(pct => (
                        <b key={pct} style={{ left: `${pct}%` }}>{timecode((timelineTotal * pct) / 100)}</b>
                      ))}
                    </div>
                    <div className="iv-tracks">
                      <div className="iv-playhead" style={{ left: `calc(46px + (100% - 46px) * ${playheadMs / Math.max(1, timelineTotal)})` }} />
                      {timeline.tracks.map(track => (
                        <div key={track.id} className="iv-track" data-timeline-track={track.kind}>
                          <div className="iv-t-head">
                            <span className="micro">{t(trackIdKey(track.kind))}</span>
                            <span className="iv-t-kind">{t(trackKindKey(track.kind))}</span>
                          </div>
                          <div className="iv-t-lane">
                            {track.clips.length === 0
                              ? <p className="iv-meta">{t('timelineEmpty')}</p>
                              : (
                                <div className="iv-clips">
                                  {track.clips.map(clip => (
                                    <div
                                      key={clip.id}
                                      className={`iv-clip iv-clip--${track.kind}`}
                                      data-timeline-clip={clip.id}
                                      data-timeline-clip-kind={track.kind}
                                      style={{ flexGrow: String(Math.max(0.6, clip.durationMs / 1000)) }}
                                    >
                                      <div className="iv-clip-top">
                                        <Icon name={TRACK_ICONS[track.kind]} size={11} />
                                        <span className="iv-ellipsis" title={clip.assetPath ?? clip.text ?? ''}>
                                          {track.kind === 'subtitle' ? (clip.text ?? '') : baseName(clip.assetPath ?? '')}
                                        </span>
                                        <span className="iv-clip-dur">{(clip.durationMs / 1000).toFixed(1)}s</span>
                                      </div>
                                      <div className="iv-clip-row">
                                        <input type="number" className="iv-input" value={clip.startMs} aria-label={`${t('clipStart')} ${clip.id}`}
                                          onChange={event => {
                                            const startMs = Number(event.target.value)
                                            patchTrack(track.id, current => ({
                                              ...current,
                                              clips: current.clips.map(item => (item.id === clip.id ? { ...item, startMs } : item)),
                                            }))
                                          }} />
                                        <input type="number" className="iv-input" value={clip.durationMs} aria-label={`${t('clipDuration')} ${clip.id}`}
                                          onChange={event => {
                                            const durationMs = Number(event.target.value)
                                            patchTrack(track.id, current => ({
                                              ...current,
                                              clips: current.clips.map(item => (item.id === clip.id ? { ...item, durationMs } : item)),
                                            }))
                                          }} />
                                        {track.kind === 'subtitle'
                                          ? (
                                            <>
                                              <input type="number" className="iv-input" min={8} max={200} value={clip.style?.fontSize ?? 32}
                                                aria-label={`${t('styleFontSize')} ${clip.id}`}
                                                onChange={event => {
                                                  const fontSize = Number(event.target.value)
                                                  patchTrack(track.id, current => ({
                                                    ...current,
                                                    clips: current.clips.map(item => (item.id === clip.id
                                                      ? { ...item, style: { ...item.style, fontSize } }
                                                      : item)),
                                                  }))
                                                }} />
                                              <input type="color" className="iv-color" value={clip.style?.color ?? '#ffffff'}
                                                aria-label={`${t('styleColor')} ${clip.id}`}
                                                onChange={event => {
                                                  const color = event.target.value
                                                  patchTrack(track.id, current => ({
                                                    ...current,
                                                    clips: current.clips.map(item => (item.id === clip.id
                                                      ? { ...item, style: { ...item.style, color } }
                                                      : item)),
                                                  }))
                                                }} />
                                              <select className="iv-select" value={clip.style?.position ?? 'bottom'}
                                                aria-label={`${t('stylePosition')} ${clip.id}`}
                                                onChange={event => {
                                                  const position = event.target.value as 'top' | 'middle' | 'bottom'
                                                  patchTrack(track.id, current => ({
                                                    ...current,
                                                    clips: current.clips.map(item => (item.id === clip.id
                                                      ? { ...item, style: { ...item.style, position } }
                                                      : item)),
                                                  }))
                                                }}>
                                                <option value="top">top</option>
                                                <option value="middle">middle</option>
                                                <option value="bottom">bottom</option>
                                              </select>
                                            </>
                                          )
                                          : null}
                                        <button type="button" className="iv-btn" aria-label={`${t('remove')} ${clip.id}`}
                                          onClick={() => {
                                            patchTrack(track.id, current => ({
                                              ...current, clips: current.clips.filter(item => item.id !== clip.id),
                                            }))
                                          }}>
                                          <Icon name="trash" size={11} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            {track.kind === 'subtitle'
                              ? (
                                <div className="iv-add-row">
                                  <input className="iv-input" style={{ flex: 1, minWidth: '110px' }}
                                    placeholder={t('subtitlePlaceholder')} aria-label={t('subtitlePlaceholder')}
                                    value={subtitleDraft}
                                    onChange={event => { setSubtitleDraft(event.target.value) }} />
                                  <button type="button" className="iv-btn iv-btn--sm" disabled={subtitleDraft.trim() === ''}
                                    aria-label={t('addSubtitle')}
                                    onClick={() => { appendClip(track.id, { text: subtitleDraft.trim() }); setSubtitleDraft('') }}>
                                    <Icon name="plus" />{t('addSubtitle')}
                                  </button>
                                </div>
                              )
                              : (
                                <div className="iv-add-row">
                                  <select className="iv-select" aria-label={`${t('pickAsset')} ${track.kind}`} value={clipAssetPath}
                                    onChange={event => { setClipAssetPath(event.target.value) }}>
                                    <option value=''>{t('pickAsset')}</option>
                                    {assets
                                      .filter(candidate => track.kind === 'audio' ? candidate.kind === 'video' : candidate.kind === track.kind)
                                      .map(candidate => (
                                        <option key={candidate.id} value={candidate.path}>{baseName(candidate.path)}</option>
                                      ))}
                                  </select>
                                  <button type="button" className="iv-btn iv-btn--sm" disabled={clipAssetPath === ''}
                                    aria-label={`${t('addClip')} ${track.kind}`}
                                    onClick={() => { appendClip(track.id, { assetPath: clipAssetPath }); setClipAssetPath('') }}>
                                    <Icon name="plus" />{t('addClip')}
                                  </button>
                                </div>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="iv-meta">{t('previewNote')}</p>
                </section>
              )
              : null}
          </section>

          {/* ============ 下部停靠区：四个面板（常驻） ============ */}
          <div className="iv-dock">
            <section className="iv-pane" data-workbench-pane="paneAssets" data-workbench-planned="false">
              <div className="iv-pane-head">
                <span className="iv-pane-tile"><Icon name="layers" size={13} /></span>
                <h3 className="iv-pane-title">{t('paneAssets')}</h3>
                <div className="iv-pane-actions">
                  <select
                    className="iv-select"
                    aria-label={t('filterAll')}
                    value={assetFilter}
                    onChange={event => { setAssetFilter(event.target.value as 'all' | 'image' | 'video') }}
                  >
                    <option value="all">{t('filterAll')}</option>
                    <option value="image">{t('filterImage')}</option>
                    <option value="video">{t('filterVideo')}</option>
                  </select>
                </div>
              </div>
              <div className="iv-toolbar">
                <button
                  type="button"
                  className="iv-btn iv-btn--sm"
                  disabled={busy || activeProject === undefined || outputs.length === 0}
                  onClick={() => {
                    void run(async () => {
                      const project = activeProject
                      if (project === undefined) return
                      const known = new Set(assets.map(asset => asset.path))
                      const candidate = outputs.find(output => !known.has(output.path))
                      if (candidate === undefined) {
                        // 目录里全登记过了 vs 目录里根本没有产物，是两件事（都是信息，不是失败）
                        setNotice({
                          text: assets.length === 0 ? t('noOutputs') : t('alreadyRegistered'),
                          tone: 'info',
                        })
                        return
                      }
                      const attached = await apiRef.current.attachAsset({
                        projectId: project.id, path: candidate.path, kind: candidate.kind, bytes: candidate.bytes,
                      })
                      if (!attached.created) setNotice({ text: t('alreadyRegistered'), tone: 'info' })
                      setAssets(await apiRef.current.listAssets(project.id))
                    })
                  }}
                >
                  <Icon name="plus" />{t('registerLatest')}
                </button>
                <button
                  type="button"
                  className="iv-btn iv-btn--sm"
                  disabled={busy || activeProject === undefined}
                  aria-label={t('compactAssets')}
                  title={t('compactAssets')}
                  onClick={() => {
                    void run(async () => {
                      const project = activeProject
                      if (project === undefined) return
                      const removed = await apiRef.current.compactAssets()
                      setAssets(await apiRef.current.listAssets(project.id))
                      setNotice({ text: `${t('compacted')} · ${removed}`, tone: 'info' })
                    })
                  }}
                >
                  <Icon name="copy" />{t('compactAssets')}
                </button>
              </div>
              {visibleAssets.length === 0
                ? (
                  <div className="iv-empty">
                    <span className="iv-empty-tile"><Icon name="layers" size={17} /></span>
                    <strong>{t('noAssets')}</strong>
                    {outputs.length === 0 ? <span>{t('noOutputs')}</span> : null}
                  </div>
                )
                : (
                  <ul className="iv-list">
                    {visibleAssets.map(asset => (
                      <li key={asset.id} className="iv-row" data-active={asset.id === selectedId ? 'true' : 'false'}>
                        {asset.kind === 'image'
                          ? (
                            <img
                              className="iv-thumb"
                              src={`/outputs/${encodeURIComponent(baseName(asset.path))}`}
                              alt=""
                            />
                          )
                          : (
                            <span className="iv-tile iv-tile--video"><Icon name="video" size={13} /></span>
                          )}
                        <button
                          type="button"
                          className="iv-row-btn"
                          aria-pressed={asset.id === selectedId}
                          aria-label={`${t('panePreview')} ${baseName(asset.path)}`}
                          onClick={() => { setPreviewPath(undefined); setSelectedId(asset.id) }}
                        >
                          <span className="iv-ellipsis">{baseName(asset.path)}</span>
                          <span className="iv-meta">{formatBytes(asset.bytes)}</span>
                        </button>
                        <div className="iv-row-actions">
                          <button
                            type="button"
                            // 可访问名带上文件名：同一区域里可能有多个"删除"按钮
                            className={`iv-btn iv-btn--icon iv-btn--sm${confirming === asset.id ? ' iv-btn--danger' : ' iv-btn--ghost'}`}
                            aria-label={`${confirming === asset.id ? t('confirmRemove') : t('remove')} ${baseName(asset.path)}`}
                            title={confirming === asset.id ? t('confirmRemove') : t('remove')}
                            disabled={busy}
                            onClick={() => {
                              if (confirming !== asset.id) { setConfirming(asset.id); setForceTarget(undefined); return }
                              setConfirming(undefined)
                              const force = forceTarget === asset.id
                              void run(async () => {
                                try {
                                  await apiRef.current.removeAsset(asset.id, force)
                                  setForceTarget(undefined)
                                  setAssets(await apiRef.current.listAssets(asset.projectId))
                                } catch (error) {
                                  // 宿主会说明"谁在引用"；这里再给一次明确的二次确认
                                  if (!force) setForceTarget(asset.id)
                                  throw error
                                }
                              })
                            }}
                          >
                            {confirming === asset.id ? t('confirmRemove') : <Icon name="trash" />}
                          </button>
                          {forceTarget === asset.id
                            ? (
                              <button
                                type="button"
                                className="iv-btn iv-btn--danger iv-btn--sm"
                                data-workbench-force-remove={asset.id}
                                aria-label={`${t('forceRemove')} ${baseName(asset.path)}`}
                                disabled={busy}
                                onClick={() => {
                                  void run(async () => {
                                    await apiRef.current.removeAsset(asset.id, true)
                                    setForceTarget(undefined)
                                    setAssets(await apiRef.current.listAssets(asset.projectId))
                                  })
                                }}
                              >
                                {t('forceRemove')}
                              </button>
                            )
                            : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
            </section>

            <section className="iv-pane" data-workbench-pane="panePreview" data-workbench-planned="false">
              <div className="iv-pane-head">
                <span className="iv-pane-tile"><Icon name="eye" size={13} /></span>
                <h3 className="iv-pane-title">{t('panePreview')}</h3>
              </div>
              <div className="iv-pane-body">
                {hostIsLoopback
                  ? null
                  : (
                    <p className="iv-banner" data-workbench-host-hint="remote" style={{
                      color: 'var(--iv-warn)', background: 'var(--iv-warn-soft)',
                      border: '1px solid color-mix(in srgb, var(--iv-warn) 32%, transparent)',
                      borderRadius: '5px', padding: '6px 9px', fontSize: '10.5px',
                      display: 'flex', alignItems: 'flex-start', gap: '6px',
                    }}>
                      <Icon name="alert" size={12} />
                      <span>{t('hostHintRemote')}</span>
                    </p>
                  )}
                {previewTarget === undefined
                  ? (
                    <div className="iv-empty">
                      <span className="iv-empty-tile"><Icon name="eye" size={17} /></span>
                      <strong>{t('previewEmpty')}</strong>
                    </div>
                  )
                  : previewTarget.kind === 'video'
                    ? (
                      <video
                        key={previewTarget.path}
                        src={`/outputs/${encodeURIComponent(baseName(previewTarget.path))}`}
                        controls
                      />
                    )
                    : (
                      <img
                        alt={baseName(previewTarget.path)}
                        src={`/outputs/${encodeURIComponent(baseName(previewTarget.path))}`}
                      />
                    )}
              </div>
            </section>

            <section className="iv-pane" data-workbench-pane="paneResources" data-workbench-planned="false">
              <div className="iv-pane-head">
                <span className="iv-pane-tile"><Icon name="tag" size={13} /></span>
                <h3 className="iv-pane-title">{t('paneResources')}</h3>
              </div>
              <div className="iv-pane-body">
                <div className="iv-add-row">
                  <select
                    className="iv-select"
                    aria-label={t('paneResources')}
                    value={resourceKind}
                    onChange={event => { setResourceKind(event.target.value as ResourceKind) }}
                  >
                    {RESOURCE_KINDS.map(kind => <option key={kind} value={kind}>{t(kindKey(kind))}</option>)}
                  </select>
                  <input
                    className="iv-input"
                    style={{ flex: 1, minWidth: '78px' }}
                    aria-label={t('resourceNamePlaceholder')}
                    placeholder={t('resourceNamePlaceholder')}
                    value={resourceName}
                    onChange={event => { setResourceName(event.target.value) }}
                  />
                  <input
                    className="iv-input"
                    style={{ flex: 1, minWidth: '78px' }}
                    aria-label={t('notePlaceholder')}
                    placeholder={t('notePlaceholder')}
                    value={resourceNote}
                    onChange={event => { setResourceNote(event.target.value) }}
                  />
                  <button
                    type="button"
                    className="iv-btn iv-btn--acc iv-btn--sm"
                    disabled={busy || activeProject === undefined || resourceName.trim() === ''}
                    onClick={() => {
                      void run(async () => {
                        const project = activeProject
                        if (project === undefined) return
                        const note = resourceNote.trim()
                        await apiRef.current.createResource({
                          projectId: project.id, kind: resourceKind, name: resourceName.trim(),
                          ...note === '' ? {} : { note },
                        })
                        setResourceName('')
                        setResourceNote('')
                        await loadResources(project.id)
                      })
                    }}
                  >
                    <Icon name="plus" />{t('addResource')}
                  </button>
                </div>
                {resources.length === 0
                  ? (
                    <div className="iv-empty">
                      <span className="iv-empty-tile"><Icon name="tag" size={17} /></span>
                      <strong>{t('noResources')}</strong>
                    </div>
                  )
                  : (
                    <ul className="iv-list">
                      {resources.map(resource => (
                        <li key={resource.id} className="iv-row">
                          <span className="iv-tile"><Icon name={RESOURCE_ICONS[resource.kind]} size={13} /></span>
                          <span className="iv-row-main iv-ellipsis" title={resource.note ?? ''}>
                            {t(kindKey(resource.kind))} · {resource.name}{resource.note === undefined ? '' : ` · ${resource.note}`}
                          </span>
                          {(() => {
                            const used = resourceUsage.filter(entry => entry.resourceId === resource.id)
                            const latest = used[0]
                            return (
                              <span className="iv-badge" data-resource-usage={resource.id} title={latest?.assetPath ?? ''}>
                                {used.length === 0
                                  ? t('resourceUnused')
                                  : `${t('resourceUsedBy')} ${used.length} ${t('resourceUseUnit')}${latest === undefined ? '' : ` · ${baseName(latest.assetPath)}`}`}
                              </span>
                            )
                          })()}
                          <div className="iv-row-actions">
                            <button
                              type="button"
                              className={`iv-btn iv-btn--icon iv-btn--sm${confirming === resource.id ? ' iv-btn--danger' : ' iv-btn--ghost'}`}
                              aria-label={`${confirming === resource.id ? t('confirmRemove') : t('remove')} ${resource.name}`}
                              title={confirming === resource.id ? t('confirmRemove') : t('remove')}
                              disabled={busy}
                              onClick={() => {
                                if (confirming !== resource.id) { setConfirming(resource.id); setForceTarget(undefined); return }
                                setConfirming(undefined)
                                const force = forceTarget === resource.id
                                void run(async () => {
                                  try {
                                    await apiRef.current.removeResource(resource.id, force)
                                    setForceTarget(undefined)
                                    if (activeProject !== undefined) await loadResources(activeProject.id)
                                  } catch (error) {
                                    if (!force) setForceTarget(resource.id)
                                    throw error
                                  }
                                })
                              }}
                            >
                              {confirming === resource.id ? t('confirmRemove') : <Icon name="trash" />}
                            </button>
                            {forceTarget === resource.id
                              ? (
                                <button
                                  type="button"
                                  className="iv-btn iv-btn--danger iv-btn--sm"
                                  data-workbench-force-remove={resource.id}
                                  aria-label={`${t('forceRemove')} ${resource.name}`}
                                  disabled={busy}
                                  onClick={() => {
                                    void run(async () => {
                                      await apiRef.current.removeResource(resource.id, true)
                                      setForceTarget(undefined)
                                      if (activeProject !== undefined) await loadResources(activeProject.id)
                                    })
                                  }}
                                >
                                  {t('forceRemove')}
                                </button>
                              )
                              : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            </section>

            <section className="iv-pane" data-workbench-pane="paneTasks" data-workbench-planned="false">
              <div className="iv-pane-head">
                <span className="iv-pane-tile"><Icon name="clock" size={13} /></span>
                <h3 className="iv-pane-title">{t('paneTasks')}</h3>
              </div>
              <div className="iv-pane-body">
                {tasks.length === 0
                  ? (
                    <div className="iv-empty">
                      <span className="iv-empty-tile"><Icon name="clock" size={17} /></span>
                      <strong>{t('noTasks')}</strong>
                    </div>
                  )
                  : (
                    <ul className="iv-list">
                      {tasks.map(task => (
                        <li key={task.id} className="iv-row">
                          <span className={taskDotClass(task.status)} aria-hidden="true" />
                          <button
                            type="button"
                            className="iv-row-btn"
                            aria-label={`${t('previewOutput')} ${task.id}`}
                            disabled={task.outputPath === undefined}
                            onClick={() => {
                              const path = task.outputPath
                              if (path === undefined) return
                              // 一律按路径预览：该产物可能登记在**别的项目**里，
                              // 那样 assets（按当前项目过滤）里根本没有它。
                              setPreviewPath({ path, kind: task.kind })
                              setSelectedId(assets.find(asset => asset.path === path)?.id)
                            }}
                            title={task.error ?? task.prompt ?? task.outputPath ?? ''}
                          >
                            {t(statusKey(task.status))}{' · '}{task.model ?? '—'}{' · '}{formatBytes(task.bytes ?? 0)}{' · '}{clockTime(task.createdAt)}
                          </button>
                          <div className="iv-row-actions">
                            {task.status === 'running'
                              ? (
                                <button
                                  type="button"
                                  className="iv-btn iv-btn--sm"
                                  aria-label={`${t('cancelTask')} ${task.id}`}
                                  title={t('cancelTask')}
                                  disabled={busy}
                                  onClick={() => {
                                    void run(async () => {
                                      await apiRef.current.cancelTask(task.id)
                                      await loadTasks()
                                    })
                                  }}
                                >
                                  {t('cancelTask')}
                                </button>
                              )
                              : null}
                            <button
                              type="button"
                              className="iv-btn iv-btn--sm"
                              aria-label={`${t('registerAsAsset')} ${task.id}`}
                              title={t('registerAsAsset')}
                              disabled={busy || activeProject === undefined || task.outputPath === undefined}
                              onClick={() => {
                                void run(async () => {
                                  const project = activeProject
                                  const path = task.outputPath
                                  if (project === undefined || path === undefined) return
                                  const attached = await apiRef.current.attachAsset({
                                    projectId: project.id, path, kind: task.kind,
                                    bytes: task.bytes, provider: task.provider, model: task.model, prompt: task.prompt,
                                  })
                                  if (!attached.created) setNotice({ text: t('alreadyRegistered'), tone: 'info' })
                                  await apiRef.current.assignTask(task.id, project.id)
                                  setAssets(await apiRef.current.listAssets(project.id))
                                  await loadTasks()
                                })
                              }}
                            >
                              {t('registerAsAsset')}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* ============ 底部状态栏 ============ */}
      <footer className="iv-status">
        <span className="dot" aria-hidden="true" />
        <span><b>{t('statusReady')}</b></span>
        <span>{t('statOutputs')} <b>{outputs.length}</b></span>
        <span>{t('statAssets')} <b>{assets.length}</b></span>
        <span>{t('statTasks')} <b>{tasks.length}</b></span>
        <div className="iv-status-right">
          <span>{hostIsLoopback ? '127.0.0.1' : window.location?.hostname ?? ''}</span>
          <span className="iv-mono">{kind}</span>
        </div>
      </footer>
    </div>
  )
}
