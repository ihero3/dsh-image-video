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
import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the right pane's seat declarations (the framework-bound `useTabInfo`).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { AssetRecord, ProjectRecord, ResourceKind, ResourceRecord, ResourceUsageRecord, TaskRecord, TaskStatus } from '../workbench/records.ts'
import { newWorkbenchId } from '../workbench/records.ts'
import type { WorkbenchOptions } from '../workbench-contract.ts'
import { defaultParams, WORKFLOW_TEMPLATES, type NodeParamValue, type WorkflowRunRecord, type WorkflowRecord } from '../workbench/workflow.ts'
import {
  activeClipAt, CLIP_SPEED_RANGE, MAX_CLIP_FADE_MS, MAX_CLIP_TRANSITION_MS, MAX_TRACK_FADE_MS,
  timelineDurationMs, type ClipTransition, type TimelineClip, type TimelineRecord, type TimelineTrack, type TrackKind,
} from '../workbench/timeline.ts'
import { DRAMA_TEMPLATES } from '../workbench/drama.ts'
import { planSubtitleClips } from '../workbench/subtitles.ts'
import type { FfmpegProbe } from '../media/ffmpeg.ts'
import type { RenderJob } from '../media/render-registry.ts'
import { WorkflowCanvas } from './WorkflowCanvas.tsx'
import { VirtualList } from './VirtualList.tsx'
import { PaneBoundary } from './PaneBoundary.tsx'
import {
  LANE_PADDING_PX, laneTimeFromClientX, MIN_TIMELINE_MS, nextVideoClipStart, resizeClipLeft, resizeClipRight,
} from './timeline-math.ts'
import type { OutputFile } from '../workbench/outputs.ts'
import type { WorkbenchApi, WorkbenchDiagnostics } from './api.ts'
import { NS, type WorkbenchLocaleKey } from './locales.ts'
import { BrandMark, Icon, type IconName } from './icons.tsx'
import { useWorkbenchStyle } from './workbench-style.ts'
import { useUnifiedPolling } from './use-unified-poll.ts'

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
  const [subtitleBatchDraft, setSubtitleBatchDraft] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [diagnostics, setDiagnostics] = useState<WorkbenchDiagnostics | undefined>(undefined)
  const [previewMs, setPreviewMs] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const [ffmpeg, setFfmpeg] = useState<FfmpegProbe | undefined>(undefined)
  // 资源使用记录（`R-QCK-3`）：按资源 id 归拢，供资源库显示「被哪些素材用过」
  const [resourceUsage, setResourceUsage] = useState<readonly ResourceUsageRecord[]>([])
  // 默认值编辑草稿（`R-CFG-2`）：undefined = 不在编辑态
  const [defaultsDraft, setDefaultsDraft] = useState<Record<string, string> | undefined>(undefined)
  const [renderJob, setRenderJob] = useState<RenderJob | undefined>(undefined)
  const [health, setHealth] = useState<HealthState>({ status: 'checking' })
  // B6 导出面板：分辨率 / 帧率 / 宽高比选择（默认 = 跟随模型 / 30fps / 16:9）。
  const [exportResolution, setExportResolution] = useState('default')
  const [exportFps, setExportFps] = useState(30)
  const [exportAspect, setExportAspect] = useState('landscape')
  // B6 导出成功后「登记到素材库」的反馈。
  const [assetRegistered, setAssetRegistered] = useState(false)
  const [projects, setProjects] = useState<readonly ProjectRecord[]>([])
  const [activeId, setActiveId] = useState<string | undefined>(undefined)
  const [assets, setAssets] = useState<readonly AssetRecord[]>([])
  const [outputs, setOutputs] = useState<readonly OutputFile[]>([])
  const [tasks, setTasksRaw] = useState<readonly TaskRecord[]>([])
  const setTasks = (value: readonly TaskRecord[]): void => {
    setTasksRaw(value)
  }
  const [resources, setResources] = useState<readonly ResourceRecord[]>([])
  const [assetFilter, setAssetFilter] = useState<'all' | 'image' | 'video'>('all')
  const [resourceKind, setResourceKind] = useState<ResourceKind>('role')
  const [resourceName, setResourceName] = useState('')
  // `A153`：资源的参考图（角色定妆照 / 场景基准）
  const [resourceAsset, setResourceAsset] = useState<string | undefined>(undefined)
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

  // `A149`：快速创作里直接生成（图片同步；视频 wait:false + 轮询任务；可取消）
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generating, setGenerating] = useState<'image' | 'video' | undefined>(undefined)
  const [generateTaskId, setGenerateTaskId] = useState<string | undefined>(undefined)
  // `A151`：参考图（多模态输入）—— 图片走图生图、视频走首帧
  const [generateReference, setGenerateReference] = useState<string | undefined>(undefined)
  // `F1`：面板内就地可改的生成参数（初始值取生效默认值；改了就用改后的）
  const [generateSize, setGenerateSize] = useState('')
  const [generateAspect, setGenerateAspect] = useState('')
  const [generateDuration, setGenerateDuration] = useState('')

  /** 生成后刷新当前项目的素材列表。 */
  const refreshAssetsAfterGenerate = async (): Promise<void> => {
    if (activeId === undefined) return
    try {
      setAssets(await apiRef.current.listAssets(activeId))
    } catch {
      // 刷新失败不影响"已生成"的结论，下一次轮询会纠正
    }
  }

  /** 发一次生成（图片同步等待；视频立刻拿 taskId 交给轮询）。 */
  const runGenerate = async (mediaMode: 'image' | 'video'): Promise<void> => {
    const prompt = generatePrompt.trim()
    if (prompt === '') return
    if (activeId === undefined) {
      setNotice({ text: t('generateNeedsProject'), tone: 'error' })
      return
    }
    setGenerating(mediaMode)
    try {
      const result = await apiRef.current.generateMedia({
        mediaMode,
        prompt,
        projectId: activeId,
        ...generateReference === undefined ? {} : { image: generateReference },
        ...mediaMode === 'image'
          ? generateSize.trim() === '' ? {} : { size: generateSize.trim() }
          : {
              ...generateAspect.trim() === '' ? {} : { aspectRatio: generateAspect.trim() },
              ...Number(generateDuration) > 0 ? { duration: Number(generateDuration) } : {},
            },
        ...mediaMode === 'video' ? { wait: false } : {},
      })
      if (result.pending === true && result.taskId !== undefined) {
        setGenerateTaskId(result.taskId)
        return
      }
      await refreshAssetsAfterGenerate()
      setGeneratePrompt('')
      setNotice({ text: t('generateDone'), tone: 'info' })
    } catch (error) {
      setNotice({ text: `${t('generateFailed')}：${error instanceof Error ? error.message : String(error)}`, tone: 'error' })
    } finally {
      if (mediaMode === 'image') setGenerating(undefined)
    }
  }

  /** 追踪非阻塞视频生成：任务结束（成功/失败/取消）时收尾。 */
  useEffect(() => {
    if (generateTaskId === undefined) return
    const row = tasks.find(task => task.id === generateTaskId)
    if (row === undefined || row.status === 'running') return
    setGenerateTaskId(undefined)
    setGenerating(undefined)
    if (row.status === 'succeeded') {
      void refreshAssetsAfterGenerate()
      setGeneratePrompt('')
      setNotice({ text: t('generateDone'), tone: 'info' })
      return
    }
    if (row.status === 'cancelled') {
      setNotice({ text: t('generateCancel'), tone: 'info' })
      return
    }
    setNotice({ text: `${t('generateFailed')}：${row.error ?? ''}`, tone: 'error' })
  }, [generateTaskId, tasks, activeId])

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

  // 是否有运行中的流程（供统一轮判别节奏，`B1`）
  const runningRun = runs.some(run => run.status === 'running')

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

  /** 拉一次诊断快照（`B15` 诊断面板；不拦全局 busy，失败静默丢给面板显示）。 */
  const loadDiagnostics = useCallback(async (): Promise<void> => {
    try {
      setDiagnostics(await apiRef.current.getDiagnostics())
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : String(error), tone: 'error' })
    }
  }, [])

  useEffect(() => {
    void loadDiagnostics()
    // 宿主诊断随渲染/任务变化，但避免高频轮询；只挂载时拉一次，刷新走按钮
  }, [loadDiagnostics])

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

  // 导出任务：进入时间轴时读回最近一次（运行中的进度刷新归统一轮询，`B1`）
  const renderRunning = renderJob?.status === 'running'
  useEffect(() => {
    if (mode !== 'timeline' || activeProject === undefined) return
    const project = activeProject
    let stale = false
    void (async () => {
      try {
        const jobs = await apiRef.current.listRenders(project.id)
        if (!stale) setRenderJob(jobs[0])
      } catch {
        // 读失败不打扰用户；统一轮询会再试
      }
    })()
    return () => { stale = true }
  }, [mode, activeProject])

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
            exportFormat: pending.exportFormat, normalizeLoudness: pending.normalizeLoudness,
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
  // 时间轴总时长：空轨也要有一个可导航的尺度（默认 3s），否则落点换算会全部塌到 0。
  const timelineTotal = timeline === undefined
    ? MIN_TIMELINE_MS
    : Math.max(MIN_TIMELINE_MS, timelineDurationMs(timeline.tracks))
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

  /** 时间轴通用改法：换掉某个片段（`B14` clip 控件共用）。 */
  const patchClip = (trackId: string, clipId: string, update: (clip: TimelineClip) => TimelineClip): void => {
    patchTrack(trackId, track => ({
      ...track,
      clips: track.clips.map(clip => (clip.id === clipId ? update(clip) : clip)),
    }))
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

  /**
   * 批量字幕（`B15`）：一段台词按句切分、按字数分配时间，一键铺到字幕轨末尾。
   * 复用域层 `planSubtitleClips`（与 Agent 的 `timeline add-subtitles` 同一套规则）。
   */
  const applyBatchSubtitles = (trackId: string, script: string): void => {
    if (timeline === undefined) return
    const subtitleTrack = timeline.tracks.find(track => track.kind === 'subtitle')
    const trackEnd = subtitleTrack === undefined || subtitleTrack.clips.length === 0
      ? 0
      : Math.max(...subtitleTrack.clips.map(clip => clip.startMs + clip.durationMs))
    const totalMs = Math.max(trackEnd + 1000, timelineDurationMs(timeline.tracks))
    const clips = planSubtitleClips(script.trim(), { startMs: trackEnd, endMs: Math.max(trackEnd + 1000, totalMs) })
    if (clips.length === 0) {
      setNotice({ text: t('subtitlesApply'), tone: 'error' })
      return
    }
    patchTrack(trackId, track => ({ ...track, clips: [...track.clips, ...clips] }))
  }

  /**
   * 把内置模板实例化成工作流记录（`B15` 模板市场）。
   * 两类模板（`WORKFLOW_TEMPLATES` 的 `WorkflowTemplate` 与 `DRAMA_TEMPLATES` 的 `DramaTemplate`）
   * 结构一致：节点 `kind + params?`（缺省参数用 `defaultParams` 补）＋ 下标连线。
   */
  const instantiateAnyTemplate = (
    template: { id: string; labelKey: string; describe?: string; nodes: readonly { kind: WorkflowRecord['nodes'][number]['kind']; params?: Record<string, NodeParamValue> }[]; edges: readonly (readonly [number, number])[] },
  ): WorkflowRecord => {
    const stamp = new Date().toISOString()
    const title = template.describe?.split('：')[0] ?? template.id
    const id = newWorkbenchId('wfl')
    return {
      schemaVersion: 1,
      id,
      projectId: activeProject?.id ?? '',
      name: title,
      nodes: template.nodes.map((node, index) => ({
        id: `${id}-${index}`,
        kind: node.kind,
        position: { x: (index % 4) * 220, y: Math.floor(index / 4) * 160 },
        params: node.params ?? defaultParams(node.kind),
      })),
      edges: template.edges.map(([from, to]) => ({ id: `${id}-${from}-${to}`, source: `${id}-${from}`, target: `${id}-${to}` })),
      createdAt: stamp,
      updatedAt: stamp,
    }
  }

  // ============ B5 时间轴交互：拖拽入轨 / 片段移动 / 手柄 / 播放 ============
  /** 拖拽载荷的约定 MIME（素材入轨 / 片段移动各一种，与轨道 drop 对齐）。 */
  const ASSET_DRAG_TYPE = 'application/x-iv-asset'
  const CLIP_DRAG_TYPE = 'application/x-iv-clip'
  /** 当前拖放悬停的轨道（落点高亮）。 */
  const [dropTrackId, setDropTrackId] = useState<string | undefined>(undefined)
  /** 选中的片段（键盘 Delete 与复制按钮用；UI 瞬时状态，不入库）。 */
  const [selectedClipId, setSelectedClipId] = useState<string | undefined>(undefined)
  /** 正在拖的手柄（窗口级 mousemove/mouseup 期间活着）。 */
  const [resizing, setResizing] = useState<{ trackId: string; clipId: string; side: 'left' | 'right'; startX: number } | undefined>(undefined)
  /** 轨道 lane 的 DOM 引用（量 rect 用：像素 ↔ 毫秒的换算基准）。 */
  const laneRefs = useRef(new Map<string, HTMLElement>())
  /** 顺序播放开关。 */
  const [playing, setPlaying] = useState(false)

  /** 素材行开始拖拽：路径 + 媒体类型放进 dataTransfer。 */
  const onAssetDragStart = (event: ReactDragEvent, asset: AssetRecord): void => {
    const payload = JSON.stringify({ path: asset.path, kind: asset.kind })
    event.dataTransfer.setData(ASSET_DRAG_TYPE, payload)
    event.dataTransfer.setData('text/plain', payload)
    event.dataTransfer.effectAllowed = 'copy'
  }

  /** 片段开始拖拽：带上所在轨道与片段 id（换轨/移动都认这个载荷）。 */
  const onClipDragStart = (event: ReactDragEvent, trackId: string, clipId: string): void => {
    event.dataTransfer.setData(CLIP_DRAG_TYPE, JSON.stringify({ trackId, clipId }))
    event.dataTransfer.effectAllowed = 'move'
    setSelectedClipId(clipId)
  }

  /** 轨道接受放置：素材 → 入轨；片段 → 移动起点（同种类轨道间接驳）。 */
  const onLaneDrop = (event: ReactDragEvent, track: TimelineTrack): void => {
    event.preventDefault()
    setDropTrackId(undefined)
    const lane = laneRefs.current.get(track.id)
    const rect = lane?.getBoundingClientRect()
    const dropMs = laneTimeFromClientX(
      event.clientX,
      { left: rect?.left ?? 0, width: rect?.width ?? 0 },
      timelineTotal,
    )

    // 1) 片段移动：从原轨道摘出，落到本轨新起点
    const clipPayload = event.dataTransfer.getData(CLIP_DRAG_TYPE)
    if (clipPayload !== '') {
      let source: { trackId?: string; clipId?: string } = {}
      try { source = JSON.parse(clipPayload) as { trackId?: string; clipId?: string } } catch { return }
      if (source.clipId === undefined) return
      const clipId = source.clipId
      setTimeline(current => {
        if (current === undefined) return current
        let moved: TimelineClip | undefined
        let fromTrack: TimelineTrack | undefined
        for (const candidate of current.tracks) {
          const found = candidate.clips.find(item => item.id === clipId)
          if (found !== undefined) { moved = found; fromTrack = candidate; break }
        }
        // 字幕与视频互不串轨；找不到源片段就不动
        if (moved === undefined || fromTrack === undefined || fromTrack.kind !== track.kind) return current
        const updated = { ...moved, startMs: dropMs }
        return {
          ...current,
          tracks: current.tracks.map(candidate => {
            if (candidate.id === fromTrack?.id && candidate.id !== track.id) {
              return { ...candidate, clips: candidate.clips.filter(item => item.id !== clipId) }
            }
            if (candidate.id === track.id) {
              return { ...candidate, clips: candidate.clips.filter(item => item.id !== clipId).concat(updated) }
            }
            return candidate
          }),
        }
      })
      setTimelineState('dirty')
      return
    }

    // 2) 素材入轨：字幕轨不吃素材；音频轨只接视频（宿主从视频取音）
    const assetPayload = event.dataTransfer.getData(ASSET_DRAG_TYPE) !== ''
      ? event.dataTransfer.getData(ASSET_DRAG_TYPE)
      : event.dataTransfer.getData('text/plain')
    if (assetPayload === '') return
    let asset: { path?: string; kind?: string } = {}
    try { asset = JSON.parse(assetPayload) as { path?: string; kind?: string } } catch { return }
    if (asset.path === undefined || track.kind === 'subtitle') return
    if (asset.kind !== 'video') return
    patchTrack(track.id, current => ({
      ...current,
      clips: current.clips.concat({
        id: `clip-${Date.now().toString(36)}-${current.clips.length}`,
        assetPath: asset.path as string,
        startMs: dropMs,
        durationMs: 3000,
      }),
    }))
  }

  /** 手柄按下：记住起点，随后窗口级 mousemove 实时改片段。 */
  const onHandleMouseDown = (event: ReactMouseEvent, trackId: string, clipId: string, side: 'left' | 'right'): void => {
    event.preventDefault()
    event.stopPropagation()
    setResizing({ trackId, clipId, side, startX: event.clientX })
  }

  // 手柄拖动：像素差 → 毫秒差（按 lane 宽度比例），实时落库（去抖保存兜底）
  useEffect(() => {
    if (resizing === undefined) return
    const lane = laneRefs.current.get(resizing.trackId)
    const onMove = (event: globalThis.MouseEvent): void => {
      const rect = lane?.getBoundingClientRect()
      const usable = (rect?.width ?? 0) - LANE_PADDING_PX * 2
      if (usable <= 0) return
      const deltaMs = ((event.clientX - resizing.startX) / usable) * timelineTotal
      patchTrack(resizing.trackId, current => ({
        ...current,
        clips: current.clips.map(item => {
          if (item.id !== resizing.clipId) return item
          return resizing.side === 'left'
            ? { ...item, ...resizeClipLeft(item, deltaMs) }
            : { ...item, ...resizeClipRight(item, deltaMs) }
        }),
      }))
    }
    const onUp = (): void => { setResizing(undefined) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizing, timelineTotal])

  /** 复制片段：紧随原片段之后放一份（新 id）。 */
  const duplicateClip = (track: TimelineTrack, clip: TimelineClip): void => {
    patchTrack(track.id, current => ({
      ...current,
      clips: current.clips.concat({
        ...clip,
        id: `clip-${Date.now().toString(36)}-${current.clips.length}`,
        startMs: clip.startMs + clip.durationMs,
      }),
    }))
    setSelectedClipId(undefined)
  }

  /** 删除选中的片段（键盘 Delete 与垃圾桶按钮共用）。 */
  const removeSelectedClip = (): void => {
    if (selectedClipId === undefined) return
    setTimeline(current => current === undefined ? current : {
      ...current,
      tracks: current.tracks.map(track => ({ ...track, clips: track.clips.filter(clip => clip.id !== selectedClipId) })),
    })
    setTimelineState('dirty')
    setSelectedClipId(undefined)
  }

  /** 播放/暂停：不在任何片段里（或已到尽头）就从头开始；顺序播放跳过空隙。 */
  const togglePlay = (): void => {
    if (playing) { setPlaying(false); return }
    if (playheadMs >= timelineTotal || activeVideo === undefined) setPreviewMs(0)
    setPlaying(true)
  }

  // 顺序播放：每 100ms 按真实流逝推进播放头；过了当前视频片段的结尾就跳到
  // 下一个视频片段（跳过空隙）；没有下一个就停在尽头并暂停。
  const previewMsRef = useRef(previewMs)
  previewMsRef.current = playheadMs
  useEffect(() => {
    if (!playing || timeline === undefined) return
    let last = Date.now()
    const timer = setInterval(() => {
      const now = Date.now()
      const delta = now - last
      last = now
      const current = previewMsRef.current
      const active = activeClipAt(timeline.tracks, 'video', current)
      let next = current + delta
      if (active !== undefined && next >= active.startMs + active.durationMs) {
        const following = nextVideoClipStart(timeline.tracks, active.startMs + active.durationMs)
        if (following === undefined) {
          setPlaying(false)
          previewMsRef.current = timelineTotal
          setPreviewMs(timelineTotal)
          return
        }
        next = following
      }
      if (next >= timelineTotal) {
        setPlaying(false)
        previewMsRef.current = timelineTotal
        setPreviewMs(timelineTotal)
        return
      }
      previewMsRef.current = next
      setPreviewMs(next)
    }, 100)
    return () => { clearInterval(timer) }
  }, [playing, timeline, timelineTotal])

  // 离开时间轴模式就停播（播放头归零由下次进入决定）
  useEffect(() => {
    if (mode !== 'timeline') setPlaying(false)
  }, [mode])

  // B5/B13 时间轴快捷键：空格播放/暂停、Delete 删除选中片段。
  // 输入控件里不劫持（让用户正常改数字）。
  useEffect(() => {
    if (mode !== 'timeline') return
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target !== null && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
        || target.isContentEditable === true
      )) return
      if (event.key === ' ') {
        event.preventDefault()
        togglePlay()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedClipId === undefined) return
        event.preventDefault()
        removeSelectedClip()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  })

  const selectedAsset = assets.find(asset => asset.id === selectedId)
  // 预览目标：已登记的素材优先，其次是"从任务行直接看产出"的临时目标
  // `A152`：最新产物里尚未登记进当前项目的那些（按钮上直接显示数量）
  const registeredPaths = new Set(assets.map(asset => asset.path))
  const pendingOutputs = outputs.filter(output => !registeredPaths.has(output.path))

  // `F1`：拿到生效默认值后回填一次（用户改过就不覆盖）
  useEffect(() => {
    if (health.status !== 'ok' || health.defaults === undefined) return
    const defaults = health.defaults as unknown as Record<string, unknown>
    setGenerateSize(previous => previous === '' ? String(defaults.imageSize ?? '') : previous)
    setGenerateAspect(previous => previous === '' ? String(defaults.videoAspectRatio ?? '') : previous)
    setGenerateDuration(previous => previous === '' ? String(defaults.videoDuration ?? '') : previous)
  }, [health])

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
    const resolved = await apiRef.current.listTasks()
    setTasks(resolved)
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

  // B1 统一轮询：原「导出 2s / 运行 2.5s / 项目 5s」三个定时器收敛成**一个**定时器链
  // （有 running 任务 2s、否则 5s、±20% 抖动、`document.hidden` 停表、恢复可见立即补跳）。
  // 双向一致性（`T6-4`）口径不变：宿主→客户端没有通用推送通道，靠这条线把 Agent
  // （工具）那边的改动带进来；本地正在编辑的文档（画布/时间轴 dirty/saving）不在这条
  // 线上，不会被轮询数据覆盖。
  const pollingActive = runningRun || renderRunning
    || tasks.some(task => task.status === 'running' || task.status === 'queued')
  const modeRef = useRef(mode)
  modeRef.current = mode
  const activeProjectRef = useRef(activeProject)
  activeProjectRef.current = activeProject
  const workflowIdRef = useRef(workflow?.id)
  workflowIdRef.current = workflow?.id
  useUnifiedPolling({
    active: pollingActive,
    enabled: tab.visible,
    onTick: () => {
      void (async () => {
        try {
          await loadProjects()
          await loadTasks()
          const project = activeProjectRef.current
          if (project !== undefined) setAssets(await apiRef.current.listAssets(project.id))
          if (modeRef.current === 'timeline' && project !== undefined) {
            setRenderJob((await apiRef.current.listRenders(project.id))[0])
          }
          if (modeRef.current === 'workflow' && project !== undefined) {
            setRuns(await apiRef.current.listRuns(project.id, workflowIdRef.current))
          }
          setRefreshTick(current => current + 1)
        } catch {
          // 轮询失败静默重试，不弹错
        }
      })()
    },
  })

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
    // `A149`：桌面应用走 `dsh-app://` 自定义协议，请求由主进程转发到本机宿主，
    // `/outputs/*` 同源可用（真机实测 200/206）——不能按 hostname 判定成"非本机"。
    if (window.location?.protocol === 'dsh-app:') return true
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
                  <PaneBoundary label={t('modeQuick')} t={t}>
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
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <span className="iv-meta">{t('generateHeading')} · {t('generatePromptLabel')}</span>
                      <textarea
                        className="iv-input"
                        rows={3}
                        value={generatePrompt}
                        placeholder={t('generatePromptPlaceholder')}
                        disabled={generating !== undefined}
                        onChange={event => setGeneratePrompt(event.target.value)}
                        style={{ resize: 'vertical', font: 'inherit', padding: '6px 8px', borderRadius: '6px' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="iv-meta">{t('generateReferenceLabel')}：</span>
                        {generateReference === undefined
                          ? <span className="iv-meta">{t('generateReferenceNone')}</span>
                          : (
                            <>
                              <span className="iv-chip" title={generateReference}>{baseName(generateReference)}</span>
                              <button
                                type="button"
                                className="iv-btn iv-btn--ghost iv-btn--sm"
                                onClick={() => setGenerateReference(undefined)}
                              >
                                {t('generateClearReference')}
                              </button>
                            </>
                          )}
                        <button
                          type="button"
                          className="iv-btn iv-btn--ghost iv-btn--sm"
                          disabled={selectedAsset === undefined}
                          onClick={() => setGenerateReference(selectedAsset?.path)}
                        >
                          {t('generateUseSelected')}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="iv-meta">{t('defaultImageSize')}：</span>
                        <input
                          className="iv-input"
                          style={{ width: '96px' }}
                          aria-label={t('defaultImageSize')}
                          value={generateSize}
                          disabled={generating !== undefined}
                          onChange={event => setGenerateSize(event.target.value)}
                        />
                        <span className="iv-meta">{t('defaultVideoAspectRatio')}：</span>
                        <input
                          className="iv-input"
                          style={{ width: '76px' }}
                          aria-label={t('defaultVideoAspectRatio')}
                          value={generateAspect}
                          disabled={generating !== undefined}
                          onChange={event => setGenerateAspect(event.target.value)}
                        />
                        <span className="iv-meta">{t('defaultVideoDuration')}：</span>
                        <input
                          className="iv-input"
                          style={{ width: '56px' }}
                          aria-label={t('defaultVideoDuration')}
                          value={generateDuration}
                          disabled={generating !== undefined}
                          onChange={event => setGenerateDuration(event.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="iv-btn iv-btn--acc iv-btn--sm"
                          disabled={generating !== undefined || activeId === undefined || generatePrompt.trim() === ''}
                          onClick={() => { void runGenerate('image') }}
                        >
                          {generating === 'image' ? t('generating') : t('generateImage')}
                        </button>
                        <button
                          type="button"
                          className="iv-btn iv-btn--sm"
                          disabled={generating !== undefined || activeId === undefined || generatePrompt.trim() === ''}
                          onClick={() => { void runGenerate('video') }}
                        >
                          {generating === 'video' ? t('generating') : t('generateVideo')}
                        </button>
                        {generateTaskId === undefined
                          ? null
                          : (
                            <button
                              type="button"
                              className="iv-btn iv-btn--danger iv-btn--sm"
                              onClick={() => { void apiRef.current.cancelTask(generateTaskId) }}
                            >
                              {t('generateCancel')}
                            </button>
                          )}
                      </div>
                      <span className="iv-meta">{t('generateCostHint')}</span>
                    </div>
                    <div className="iv-stats">
                      <span className="iv-stat"><b>{outputs.length}</b><span>{t('statOutputs')}</span></span>
                      <span className="iv-stat"><b>{assets.length}</b><span>{t('statAssets')}</span></span>
                      <span className="iv-stat"><b>{tasks.length}</b><span>{t('statTasks')}</span></span>
                      <span className="iv-stat"><b>{resources.length}</b><span>{t('statResources')}</span></span>
                    </div>
                    {outputs.length === 0 ? <p className="iv-meta">{t('noOutputs')}</p> : null}
                  </div>
                  </PaneBoundary>
                </section>
              )
              : null}

            {mode === 'workflow' && workflow !== undefined
              ? (
                <section className="iv-pane" data-workbench-pane="paneCanvas" data-workbench-planned="false">
                  <PaneBoundary label={t('paneCanvas')} t={t}>
                  <div className="iv-pane-head">
                    <span className="iv-pane-tile"><Icon name="flow" size={13} /></span>
                    <h3 className="iv-pane-title">{t('paneCanvas')}</h3>
                    <div className="iv-pane-actions">
                      <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm"
                        aria-label={t('templateMarket')} aria-expanded={templateOpen}
                        data-workflow-template-toggle="true"
                        onClick={() => { setTemplateOpen(open => !open) }}>
                        <Icon name="sparkles" size={11} />{t('templateMarket')}
                      </button>
                      <span className={saveChipClass(workflowState)} data-workflow-save={workflowState} role="status">
                        <i className="iv-dot" aria-hidden="true" />
                        {t(workflowState === 'dirty' ? 'saveDirty' : workflowState === 'saving' ? 'saveSaving' : workflowState === 'failed' ? 'saveFailed' : 'saveSaved')}
                      </span>
                    </div>
                  </div>
                  {templateOpen
                    ? (
                      <div className="iv-tpl" data-workflow-template-market="true">
                        {([...WORKFLOW_TEMPLATES, ...DRAMA_TEMPLATES] as readonly {
                          id: string; labelKey: string; describe?: string
                          nodes: readonly { kind: WorkflowRecord['nodes'][number]['kind']; params?: Record<string, NodeParamValue> }[]
                          edges: readonly (readonly [number, number])[]
                        }[]).map(template => (
                          <button
                            key={template.id}
                            type="button"
                            className="iv-tpl-card"
                            data-workflow-template={template.id}
                            onClick={() => {
                              if (activeProject === undefined) return
                              setWorkflow(instantiateAnyTemplate(template))
                              setWorkflowState('dirty')
                              setTemplateOpen(false)
                            }}>
                            <Icon name="sparkles" size={12} />
                            <span className="iv-tpl-name">
                              {template.id === 'drama-series' ? t('templateDramaSeries') : t(template.labelKey as WorkbenchLocaleKey)}
                            </span>
                            <span className="iv-tpl-desc">{template.describe ?? ''}</span>
                          </button>
                        ))}
                        {WORKFLOW_TEMPLATES.length + DRAMA_TEMPLATES.length === 0
                          ? <p className="iv-meta">{t('templateMarketEmpty')}</p>
                          : null}
                      </div>
                    )
                    : null}
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
                      // B4 单节点运行：只跑选中节点及其下游（宿主 `workflows/run` 的 `only`，
                      // 认领状态见 docs/API-SURFACE.md「B 申请」）
                      onRunNode: nodeId => {
                        void run(async () => {
                          setRunBusy(true)
                          try {
                            const stored = await apiRef.current.saveWorkflow({
                              id: workflow.id, projectId: workflow.projectId, name: workflow.name,
                              nodes: workflow.nodes, edges: workflow.edges,
                            })
                            setWorkflow(stored)
                            setWorkflowState('saved')
                            const started = await apiRef.current.runWorkflow(stored.id, [nodeId])
                            setSelectedRunId(started.id)
                            setRuns(current => [started, ...current])
                          } finally {
                            setRunBusy(false)
                          }
                        })
                      },
                    }}
                  />
                  </PaneBoundary>
                </section>
              )
              : null}

            {mode === 'timeline' && timeline !== undefined
              ? (
                <section className="iv-pane" data-workbench-pane="paneTimeline" data-workbench-planned="false">
                  <PaneBoundary label={t('timelineTitle')} t={t}>
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
                      <label className="iv-check">
                        <input type="checkbox" data-timeline-loudness="true" checked={timeline.normalizeLoudness === true}
                          aria-label={t('normalizeLoudness')}
                          onChange={event => {
                            const normalizeLoudness = event.target.checked
                            setTimeline(current => current === undefined ? current : { ...current, normalizeLoudness })
                            setTimelineState('dirty')
                          }} />
                        {t('normalizeLoudness')}
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
                  <div className="iv-toolbar iv-toolbar--export">
                    {/* B6 分辨率 / 帧率 / 宽高比选择 */}
                    <label className="iv-field">
                      <span className="iv-field-label">{t('paramResolution')}</span>
                      <select className="iv-select iv-select--sm" data-timeline-export-resolution="true" aria-label={t('paramResolution')}
                        value={exportResolution} onChange={event => { setExportResolution(event.target.value); setAssetRegistered(false) }}>
                        <option value="default">{t('resolutionDefault')}</option>
                        <option value="480">{t('resolution480')}</option>
                        <option value="768">{t('resolution768')}</option>
                        <option value="2k">{t('resolution2k')}</option>
                      </select>
                    </label>
                    <label className="iv-field">
                      <span className="iv-field-label">{t('fps')}</span>
                      <select className="iv-select iv-select--sm" data-timeline-export-fps="true" aria-label={t('fps')}
                        value={exportFps} onChange={event => { setExportFps(Number(event.target.value)); setAssetRegistered(false) }}>
                        <option value={24}>24</option>
                        <option value={25}>25</option>
                        <option value={30}>30</option>
                        <option value={60}>60</option>
                      </select>
                    </label>
                    <label className="iv-field">
                      <span className="iv-field-label">{t('paramRatio')}</span>
                      <select className="iv-select iv-select--sm" data-timeline-export-aspect="true" aria-label={t('paramRatio')}
                        value={exportAspect} onChange={event => { setExportAspect(event.target.value); setAssetRegistered(false) }}>
                        <option value="landscape">{t('ratioLandscape')}</option>
                        <option value="portrait">{t('ratioPortrait')}</option>
                        <option value="square">{t('ratioSquare')}</option>
                        <option value="vertical">{t('ratioVertical')}</option>
                      </select>
                    </label>

                    <button type="button" className="iv-btn iv-btn--acc iv-btn--sm" data-timeline-export="true"
                      disabled={renderRunning || timeline.tracks.find(track => track.kind === 'video')?.clips.length === 0}
                      onClick={() => {
                        setAssetRegistered(false)
                        void run(async () => {
                          setRenderJob(await apiRef.current.renderTimeline(
                            timeline.id, timeline.projectId,
                            { resolution: exportResolution, fps: exportFps, aspect: exportAspect },
                          ))
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
                          {renderJob.status === 'succeeded' && renderJob.outputPath !== undefined
                            ? (
                              <button type="button" className="iv-btn iv-btn--sm" data-timeline-register="true"
                                disabled={assetRegistered}
                                onClick={() => {
                                  void run(async () => {
                                    await apiRef.current.attachAsset({
                                      projectId: timeline.projectId, path: renderJob.outputPath!, kind: 'video',
                                    })
                                    setAssetRegistered(true)
                                  })
                                }}>
                                <Icon name="layers" />
                                {assetRegistered ? t('alreadyRegistered') : t('registerAsAsset')}
                              </button>
                            )
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
                    <button type="button" className="iv-tp-btn iv-tp-btn--play" data-timeline-play="true"
                      aria-label={playing ? t('transportPause') : t('transportPlay')}
                      title={playing ? t('transportPause') : t('transportPlay')}
                      aria-pressed={playing}
                      onClick={togglePlay}>
                      <Icon name={playing ? 'pause' : 'play'} size={11} />
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
                            {track.kind === 'audio'
                              ? (
                                <label className="iv-t-fade">
                                  <span className="micro">{t('trackFade')}</span>
                                  <input type="number" className="iv-input" min={0} max={MAX_TRACK_FADE_MS} step={50}
                                    value={track.fadeMs ?? 0} aria-label={t('trackFade')} title={t('trackFade')} data-timeline-track-fade={track.fadeMs ?? 0}
                                    onChange={event => {
                                      const fadeMs = Number(event.target.value)
                                      patchTrack(track.id, current => ({ ...current, fadeMs: Math.max(0, Math.min(MAX_TRACK_FADE_MS, fadeMs)) }))
                                    }} />
                                  <span className="micro">ms</span>
                                </label>
                              )
                              : null}
                          </div>
                          <div
                            className={`iv-t-lane${dropTrackId === track.id ? ' iv-t-lane--drop' : ''}`}
                            data-timeline-lane={track.kind}
                            ref={element => {
                              if (element === null) laneRefs.current.delete(track.id)
                              else laneRefs.current.set(track.id, element)
                            }}
                            onDragOver={event => {
                              // 只有本轨吃得下的载荷才给落点高亮
                              const clipDrag = event.dataTransfer.types.includes(CLIP_DRAG_TYPE)
                              const assetDrag = event.dataTransfer.types.includes(ASSET_DRAG_TYPE)
                                || event.dataTransfer.types.includes('text/plain')
                              if (clipDrag || (assetDrag && track.kind !== 'subtitle')) {
                                event.preventDefault()
                                setDropTrackId(track.id)
                              }
                            }}
                            onDragLeave={() => { setDropTrackId(current => (current === track.id ? undefined : current)) }}
                            onDrop={event => { onLaneDrop(event, track) }}
                          >
                            {track.clips.length === 0
                              ? <p className="iv-meta">{t('timelineEmpty')}</p>
                              : (
                                <div className="iv-clips">
                                  {track.clips.map(clip => {
                                    const ratio = Math.max(1, timelineTotal)
                                    const left = (clip.startMs / ratio) * 100
                                    const width = Math.max(1.5, (clip.durationMs / ratio) * 100)
                                    return (
                                      <div
                                        key={clip.id}
                                        className={`iv-clip iv-clip--${track.kind}${selectedClipId === clip.id ? ' iv-clip--sel' : ''}`}
                                        data-timeline-clip={clip.id}
                                        data-timeline-clip-kind={track.kind}
                                        data-timeline-clip-selected={selectedClipId === clip.id ? 'true' : 'false'}
                                        draggable
                                        onDragStart={event => { onClipDragStart(event, track.id, clip.id) }}
                                        onClick={() => { setSelectedClipId(clip.id) }}
                                        style={{ left: `${left}%`, width: `${width}%` }}
                                      >
                                        <div
                                          className="iv-clip-h iv-clip-h--l"
                                          data-timeline-clip-handle="left"
                                          role="separator"
                                          aria-orientation="vertical"
                                          aria-label={`${t('clipResizeStart')} ${clip.id}`}
                                          onMouseDown={event => { onHandleMouseDown(event, track.id, clip.id, 'left') }}
                                        />
                                        <div
                                          className="iv-clip-h iv-clip-h--r"
                                          data-timeline-clip-handle="right"
                                          role="separator"
                                          aria-orientation="vertical"
                                          aria-label={`${t('clipResizeEnd')} ${clip.id}`}
                                          onMouseDown={event => { onHandleMouseDown(event, track.id, clip.id, 'right') }}
                                        />
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
                                            patchClip(track.id, clip.id, item => ({ ...item, durationMs }))
                                          }} />
                                        {track.kind === 'subtitle'
                                          ? null
                                          : (
                                            <>
                                              <input type="number" className="iv-input" min={CLIP_SPEED_RANGE.min} max={CLIP_SPEED_RANGE.max} step={0.25}
                                                value={clip.speed ?? 1} aria-label={`${t('clipSpeed')} ${clip.id}`} title={t('clipSpeed')}
                                                onChange={event => {
                                                  const speed = Number(event.target.value)
                                                  patchClip(track.id, clip.id, item => ({ ...item, speed: Math.min(CLIP_SPEED_RANGE.max, Math.max(CLIP_SPEED_RANGE.min, speed)) }))
                                                }} />
                                              <input type="number" className="iv-input" min={0} max={MAX_CLIP_FADE_MS} step={50}
                                                value={clip.fade ?? 0} aria-label={`${t('clipFade')} ${clip.id}`} title={t('clipFade')}
                                                onChange={event => {
                                                  const fade = Number(event.target.value)
                                                  patchClip(track.id, clip.id, item => ({ ...item, fade: Math.max(0, Math.min(MAX_CLIP_FADE_MS, fade)) }))
                                                }} />
                                              {track.kind === 'video'
                                                ? (
                                                  <>
                                                    <select className="iv-select"
                                                      value={clip.transition ?? ''} aria-label={`${t('clipTransition')} ${clip.id}`} title={t('clipTransition')}
                                                      onChange={event => {
                                                        const transition = event.target.value === '' ? undefined : event.target.value as ClipTransition
                                                        patchClip(track.id, clip.id, item => ({ ...item, ...transition === undefined ? { transition: undefined } : { transition } }))
                                                      }}>
                                                      <option value="">{t('none')}</option>
                                                      <option value="fade">{t('transitionFade')}</option>
                                                      <option value="wipeleft">{t('transitionWipeleft')}</option>
                                                      <option value="circleopen">{t('transitionCircleopen')}</option>
                                                    </select>
                                                    {clip.transition === undefined
                                                      ? null
                                                      : (
                                                        <input type="number" className="iv-input" min={0} max={MAX_CLIP_TRANSITION_MS} step={50}
                                                          value={clip.transitionDurationMs ?? 400}
                                                          aria-label={`${t('clipTransitionDuration')} ${clip.id}`} title={t('clipTransitionDuration')}
                                                          onChange={event => {
                                                            const transitionDurationMs = Number(event.target.value)
                                                            patchClip(track.id, clip.id, item => ({ ...item, transitionDurationMs: Math.max(0, Math.min(MAX_CLIP_TRANSITION_MS, transitionDurationMs)) }))
                                                          }} />
                                                      )}
                                                    {clip.crop === undefined
                                                      ? (
                                                        <button type="button" className="iv-btn iv-btn--sm"
                                                          aria-label={`${t('clipCrop')} ${clip.id}`} title={t('clipCrop')}
                                                          onClick={event => {
                                                            event.stopPropagation()
                                                            patchClip(track.id, clip.id, item => ({ ...item, crop: { x: 0, y: 0, width: 1920, height: 1080 } }))
                                                          }}>
                                                          <Icon name="sliders" size={11} />
                                                        </button>
                                                      )
                                                      : (
                                                        <>
                                                          <input type="number" className="iv-input" min={0} value={clip.crop.x}
                                                            aria-label={`${t('clipCropX')} ${clip.id}`} title={t('clipCropX')}
                                                            onChange={event => { patchClip(track.id, clip.id, item => item.crop === undefined ? item : ({ ...item, crop: { ...item.crop, x: Math.max(0, Number(event.target.value)) } })) }} />
                                                          <input type="number" className="iv-input" min={0} value={clip.crop.y}
                                                            aria-label={`${t('clipCropY')} ${clip.id}`} title={t('clipCropY')}
                                                            onChange={event => { patchClip(track.id, clip.id, item => item.crop === undefined ? item : ({ ...item, crop: { ...item.crop, y: Math.max(0, Number(event.target.value)) } })) }} />
                                                          <input type="number" className="iv-input" min={2} step={2} value={clip.crop.width}
                                                            aria-label={`${t('clipCropW')} ${clip.id}`} title={t('clipCropW')}
                                                            onChange={event => { patchClip(track.id, clip.id, item => item.crop === undefined ? item : ({ ...item, crop: { ...item.crop, width: Math.max(2, Number(event.target.value)) } })) }} />
                                                          <input type="number" className="iv-input" min={2} step={2} value={clip.crop.height}
                                                            aria-label={`${t('clipCropH')} ${clip.id}`} title={t('clipCropH')}
                                                            onChange={event => { patchClip(track.id, clip.id, item => item.crop === undefined ? item : ({ ...item, crop: { ...item.crop, height: Math.max(2, Number(event.target.value)) } })) }} />
                                                          <button type="button" className="iv-btn iv-btn--sm"
                                                            aria-label={`${t('clipCropRemove')} ${clip.id}`} title={t('clipCropRemove')}
                                                            onClick={event => {
                                                              event.stopPropagation()
                                                              patchClip(track.id, clip.id, item => ({ ...item, crop: undefined }))
                                                            }}>
                                                            <Icon name="x" size={11} />
                                                          </button>
                                                        </>
                                                      )}
                                                  </>
                                                )
                                                : null}
                                            </>
                                          )}
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
                                        <button type="button" className="iv-btn" aria-label={`${t('clipDuplicate')} ${clip.id}`}
                                          title={t('clipDuplicate')}
                                          onClick={event => { event.stopPropagation(); duplicateClip(track, clip) }}>
                                          <Icon name="copy" size={11} />
                                        </button>
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
                                    )
                                  })}
                                </div>
                              )}
                            {track.kind === 'subtitle'
                              ? (
                                <>
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
                                  <div className="iv-add-row" data-timeline-subtitles-batch="true">
                                    <textarea className="iv-input" rows={2} style={{ flex: 1, minWidth: '140px', resize: 'vertical' }}
                                      placeholder={t('subtitlesBatchPlaceholder')} aria-label={t('subtitlesBatchPlaceholder')}
                                      data-timeline-subtitles-batch-input="true"
                                      value={subtitleBatchDraft}
                                      onChange={event => { setSubtitleBatchDraft(event.target.value) }} />
                                    <button type="button" className="iv-btn iv-btn--sm" disabled={subtitleBatchDraft.trim() === ''}
                                      aria-label={t('subtitlesBatch')} data-timeline-subtitles-batch-apply="true"
                                      onClick={() => { applyBatchSubtitles(track.id, subtitleBatchDraft); setSubtitleBatchDraft('') }}>
                                      <Icon name="subtitle" />{t('subtitlesBatch')}
                                    </button>
                                  </div>
                                </>
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
                  </PaneBoundary>
                </section>
              )
              : null}
          </section>

          {/* ============ 下部停靠区：四个面板（常驻） ============ */}
          <div className="iv-dock">
            <section className="iv-pane" data-workbench-pane="paneAssets" data-workbench-planned="false">
              <PaneBoundary label={t('paneAssets')} t={t}>
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
                  disabled={busy || activeProject === undefined || pendingOutputs.length === 0}
                  title={t('attachAll')}
                  onClick={() => {
                    void run(async () => {
                      const project = activeProject
                      if (project === undefined) return
                      if (pendingOutputs.length === 0) {
                        setNotice({ text: t('alreadyRegistered'), tone: 'info' })
                        return
                      }
                      // `A152`：一次登记全部未登记产物（不再"点一次登记一个"、也不必猜下一个是谁）
                      const result = await apiRef.current.attachAssets({
                        projectId: project.id,
                        items: pendingOutputs.map(output => ({ path: output.path, kind: output.kind, bytes: output.bytes })),
                      })
                      setAssets(await apiRef.current.listAssets(project.id))
                      setNotice({ text: `${t('attachAllDone')}：${result.created}`, tone: 'info' })
                    })
                  }}
                >
                  <Icon name="plus" />{`${t('attachAll')} (${pendingOutputs.length})`}
                </button>
                <label className="iv-btn iv-btn--sm" style={{ cursor: 'pointer' }} title={t('importFiles')}>
                  <Icon name="plus" />{t('importFiles')}
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    style={{ display: 'none' }}
                    onChange={event => {
                      const files = [...(event.target.files ?? [])] as Array<File & { path?: string }>
                      const paths = files
                        .map(file => file.path)
                        .filter((entry): entry is string => typeof entry === 'string' && entry !== '')
                      event.target.value = ''
                      if (paths.length === 0) {
                        setNotice({ text: t('importUnsupported'), tone: 'error' })
                        return
                      }
                      void run(async () => {
                        const project = activeProject
                        if (project === undefined) return
                        const result = await apiRef.current.importMedia({ projectId: project.id, paths })
                        setAssets(await apiRef.current.listAssets(project.id))
                        setNotice({
                          text: `${t('importDone')}：${result.imported}${result.skipped.length > 0 ? ` · ${t('skippedCount')} ${result.skipped.length}` : ''}`,
                          tone: 'info',
                        })
                      })
                    }}
                  />
                </label>
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
                  <VirtualList className="iv-list" items={visibleAssets} renderRow={(asset, _index) => (
                    <li key={asset.id} className="iv-row" data-active={asset.id === selectedId ? 'true' : 'false'}
                      draggable
                      data-asset-draggable="true"
                      onDragStart={event => { onAssetDragStart(event, asset) }}
                      onClick={() => { setPreviewPath(undefined); setSelectedId(asset.id) }}>
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
                          className="iv-btn iv-btn--icon iv-btn--sm iv-btn--ghost"
                          aria-label={`${t('referenceAsset')} ${baseName(asset.path)}`}
                          title={t('referenceAsset')}
                          disabled={busy}
                          onClick={event => {
                            event.stopPropagation()
                            setGenerateReference(asset.path)
                            setNotice({ text: `${t('referenceAsset')}：${baseName(asset.path)}`, tone: 'info' })
                          }}
                        >
                          <Icon name="plus" size={12} />
                        </button>
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
                  )} />
                )}
              </PaneBoundary>
            </section>

            <section className="iv-pane" data-workbench-pane="panePreview" data-workbench-planned="false">
              <PaneBoundary label={t('panePreview')} t={t}>
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
              </PaneBoundary>
            </section>

            <section className="iv-pane" data-workbench-pane="paneResources" data-workbench-planned="false">
              <PaneBoundary label={t('paneResources')} t={t}>
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
                          ...resourceAsset === undefined ? {} : { assetPath: resourceAsset },
                        })
                        setResourceAsset(undefined)
                        setResourceName('')
                        setResourceNote('')
                        await loadResources(project.id)
                      })
                    }}
                  >
                    <Icon name="plus" />{t('addResource')}
                  </button>
                </div>
                <div className="iv-add-row" style={{ marginTop: '4px' }}>
                  <span className="iv-meta">{t('resourceReference')}：</span>
                  {resourceAsset === undefined
                    ? <span className="iv-meta">{t('generateReferenceNone')}</span>
                    : (
                      <>
                        <span className="iv-chip" title={resourceAsset}>{baseName(resourceAsset)}</span>
                        <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm" onClick={() => setResourceAsset(undefined)}>
                          {t('resourceClear')}
                        </button>
                      </>
                    )}
                  <button
                    type="button"
                    className="iv-btn iv-btn--ghost iv-btn--sm"
                    disabled={selectedAsset === undefined}
                    onClick={() => setResourceAsset(selectedAsset?.path)}
                  >
                    {t('resourceUseSelected')}
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
                  <VirtualList className="iv-list" items={resources} renderRow={(resource, _index) => (
                    <li key={resource.id} className="iv-row"
                      onClick={() => {
                        if (resource.assetPath === undefined) return
                        setPreviewPath({ path: resource.assetPath, kind: 'image' })
                        setSelectedId(undefined)
                      }}>
                      {resource.assetPath === undefined
                        ? <span className="iv-tile"><Icon name={RESOURCE_ICONS[resource.kind]} size={13} /></span>
                        : (
                          <img
                            className="iv-thumb"
                            src={`/outputs/${encodeURIComponent(baseName(resource.assetPath))}`}
                            alt=""
                          />
                        )}
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
                  )} />
                )}
              </div>
              </PaneBoundary>
            </section>

            <section className="iv-pane" data-workbench-pane="paneTasks" data-workbench-planned="false">
              <PaneBoundary label={t('paneTasks')} t={t}>
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
                  <VirtualList className="iv-list" items={tasks} renderRow={(task, _index) => (
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
                  )} />
                )}
              </div>
              </PaneBoundary>
            </section>

            <section className="iv-pane" data-workbench-pane="paneDiagnostics" data-workbench-planned="false">
              <PaneBoundary label={t('paneDiagnostics')} t={t}>
              <div className="iv-pane-head">
                <span className="iv-pane-tile"><Icon name="sliders" size={13} /></span>
                <h3 className="iv-pane-title">{t('paneDiagnostics')}</h3>
                <div className="iv-pane-actions">
                  <button type="button" className="iv-btn iv-btn--ghost iv-btn--sm"
                    aria-label={t('diagRefresh')} onClick={() => { void loadDiagnostics() }}>
                    <Icon name="refresh" size={11} />{t('diagRefresh')}
                  </button>
                </div>
              </div>
              <div className="iv-diag" data-diagnostics-panel="true">
                {diagnostics === undefined
                  ? <p className="iv-meta">…</p>
                  : (
                    <>
                      <div className="iv-diag-row">
                        <span className="iv-diag-k">{t('diagOutputs')}</span>
                        <span className="iv-diag-v">
                          {diagnostics.outputs.files} files · {formatBytes(diagnostics.outputs.bytes)}
                          · {diagnostics.outputs.referenced} {t('resourceUsedBy').toLowerCase()}
                          {diagnostics.outputs.oldestAt === undefined ? '' : ` · ${clockTime(diagnostics.outputs.oldestAt)} ~ ${clockTime(diagnostics.outputs.newestAt ?? '')}`}
                        </span>
                      </div>
                      <div className="iv-diag-row">
                        <span className="iv-diag-k">{t('diagRenders')}</span>
                        <span className="iv-diag-v">
                          {diagnostics.renders.running} running · {diagnostics.renders.queued} queued
                          {diagnostics.renders.stats === undefined
                            ? ''
                            : ` · ${t('diagRenderFinished')} ${diagnostics.renders.stats.finished} · ${t('diagRenderFailed')} ${diagnostics.renders.stats.failed}${diagnostics.renders.stats.durationMs === undefined ? '' : ` · ${t('diagRenderP50')} ${diagnostics.renders.stats.durationMs.p50}ms / ${t('diagRenderP90')} ${diagnostics.renders.stats.durationMs.p90}ms`}`}
                        </span>
                      </div>
                      <div className="iv-diag-row">
                        <span className="iv-diag-k">{t('diagErrors')}</span>
                        <span className="iv-diag-v">
                          {diagnostics.errors.errorCount === 0
                            ? t('diagErrorsNone')
                            : `${diagnostics.errors.errorCount}${diagnostics.errors.errors.length === 0 ? '' : ` · ${diagnostics.errors.errors[0]?.message ?? ''}`}`}
                        </span>
                      </div>
                    </>
                  )}
              </div>
              </PaneBoundary>
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
