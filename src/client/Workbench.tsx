/**
 * Workbench surface: the right-pane tab body.
 *
 * Phase 1 shipped the skeleton and the host health check; this is the first
 * *usable* slice — create and pick a project, register a file from the output
 * directory as its asset, preview it, and remove records again. Everything it
 * does goes through the injected `api` (the `/image-video` channel), so no part
 * of this component reaches into the host directly.
 *
 * Colours stay theme-neutral (`currentColor` + `color-mix`) until the theme pass
 * (`R-NFR-3`) switches every surface to the Harness CSS variables.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the right pane's seat declarations (the framework-bound `useTabInfo`).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { AssetRecord, ProjectRecord, ResourceKind, ResourceRecord, TaskRecord, TaskStatus } from '../workbench/records.ts'
import { newWorkbenchId } from '../workbench/records.ts'
import type { WorkflowRecord, WorkflowRunRecord } from '../workbench/workflow.ts'
import { timelineDurationMs, type TimelineRecord, type TimelineTrack, type TrackKind } from '../workbench/timeline.ts'
import type { FfmpegProbe } from '../media/ffmpeg.ts'
import { WorkflowCanvas } from './WorkflowCanvas.tsx'
import type { OutputFile } from '../workbench/outputs.ts'
import type { WorkbenchApi } from './api.ts'
import { NS, type WorkbenchLocaleKey } from './locales.ts'

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
  | { status: 'ok'; version: string; provider: string }
  | { status: 'failed'; message: string }

/** Mode → dictionary key, in switch order. */
const MODE_KEYS: Record<WorkbenchMode, WorkbenchLocaleKey> = {
  quick: 'modeQuick',
  workflow: 'modeWorkflow',
  timeline: 'modeTimeline',
}
const MODES: readonly WorkbenchMode[] = ['quick', 'workflow', 'timeline']

const SURFACE = {
  display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px',
  font: 'inherit', color: 'inherit', height: '100%', boxSizing: 'border-box', overflow: 'auto',
} as const

/** One theme-neutral hairline; the theme pass replaces it with a Harness token. */
const HAIRLINE = '1px solid color-mix(in srgb, currentColor 18%, transparent)'
const PILL = { border: HAIRLINE, borderRadius: '999px', padding: '0 8px', fontSize: '12px', opacity: 0.8 } as const
const BUTTON = {
  border: HAIRLINE, borderRadius: '6px', padding: '3px 9px', color: 'inherit',
  background: 'transparent', cursor: 'pointer', fontSize: '12px',
} as const
const INPUT = {
  border: HAIRLINE, borderRadius: '6px', padding: '3px 8px', color: 'inherit',
  background: 'transparent', fontSize: '12px', minWidth: '110px',
} as const
const PANE = { border: HAIRLINE, borderRadius: '8px', padding: '10px', minHeight: '88px' } as const
const PANE_TITLE = { margin: '0 0 6px', fontSize: '13px', fontWeight: 600 } as const
const MUTED = { margin: 0, fontSize: '12px', opacity: 0.65 } as const

/** Human-readable size for one asset row. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Resource kinds in picker order. */
const RESOURCE_KINDS: readonly ResourceKind[] = ['role', 'scene', 'prop', 'brand', 'style', 'voice']

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
  const [ffmpeg, setFfmpeg] = useState<FfmpegProbe | undefined>(undefined)
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
  const activeAt = (kind: TrackKind): { id: string; assetPath?: string; text?: string; style?: { fontSize?: number; color?: string; position?: 'top' | 'middle' | 'bottom' } } | undefined =>
    timeline?.tracks
      .filter(track => track.kind === kind)
      .flatMap(track => track.clips)
      .find(clip => playheadMs >= clip.startMs && playheadMs < clip.startMs + clip.durationMs)
  const activeVideo = activeAt('video')
  const activeSubtitle = activeAt('subtitle')

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
        setHealth({ status: 'ok', version: facts.version, provider: facts.provider })
      } catch (error) {
        setHealth({ status: 'failed', message: error instanceof Error ? error.message : String(error) })
      }
      await run(async () => { await loadProjects(); await loadOutputs(); await loadTasks() })
    })()
  }, [loadOutputs, loadProjects, loadTasks, run])

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

  const healthText = health.status === 'checking'
    ? t('healthChecking')
    : health.status === 'ok'
      ? `${health.version} · ${health.provider}`
      : t('healthFailed')

  return (
    <div
      style={SURFACE}
      data-workbench-kind={kind}
      data-workbench-visible={tab.visible ? 'true' : 'false'}
      data-workbench-fullscreen={sidebar.fullscreen ? 'true' : 'false'}
      data-workbench-health={health.status}
      data-workbench-save={saveState}
      data-workbench-projects={String(projects.length)}
      data-workbench-assets={String(assets.length)}
      data-workbench-tasks={String(tasks.length)}
      data-workbench-resources={String(resources.length)}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '13px' }}>{t('sectionProject')}</strong>
        {projects.length === 0
          ? <span style={{ fontSize: '13px', opacity: 0.7 }}>{t('projectNone')}</span>
          : (
            <select
              aria-label={t('sectionProject')}
              value={activeId ?? ''}
              onChange={event => { setActiveId(event.target.value) }}
              style={INPUT}
            >
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          )}
        <input
          aria-label={t('newProject')}
          placeholder={t('projectNamePlaceholder')}
          value={name}
          onChange={event => { setName(event.target.value) }}
          style={INPUT}
        />
        <button
          type="button"
          style={BUTTON}
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
        {activeProject === undefined || renaming ? null : (
          <button
            type="button"
            style={BUTTON}
            onClick={() => { setRenaming(true); setRenameValue(activeProject.name); setSaveState('saved') }}
          >
            {t('rename')}
          </button>
        )}
        {activeProject === undefined ? null : (
          <button
            type="button"
            style={BUTTON}
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
            {confirming === activeProject.id ? t('confirmRemove') : t('remove')}
          </button>
        )}
        <span
          style={PILL}
          title={saveState === 'failed' ? t('saveFailed') : undefined}
        >
          {t(saveState === 'dirty' ? 'saveDirty' : saveState === 'saving' ? 'saveSaving' : saveState === 'failed' ? 'saveFailed' : 'saveSaved')}
        </span>
        {renaming && activeProject !== undefined
          ? (
            <>
              <input
                aria-label={t('rename')}
                value={renameValue}
                onChange={event => {
                  setRenameValue(event.target.value)
                  const next = event.target.value.trim()
                  setSaveState(next === activeProject.name || next === '' ? 'saved' : 'dirty')
                }}
                style={INPUT}
              />
              <button
                type="button"
                style={BUTTON}
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
              <button type="button" style={BUTTON} onClick={() => { setRenaming(false); setSaveState('saved') }}>
                {t('cancel')}
              </button>
            </>
          )
          : null}
        <span style={PILL} title={health.status === 'failed' ? health.message : undefined}>{healthText}</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.55 }}>{kind}</span>
      </header>

      <nav style={{ display: 'flex', gap: '6px' }} aria-label={t('tabTitle')}>
        {MODES.map(candidate => (
          <button
            key={candidate}
            type="button"
            aria-pressed={candidate === mode}
            onClick={() => { setMode(candidate) }}
            style={{
              ...BUTTON,
              background: candidate === mode ? 'color-mix(in srgb, currentColor 10%, transparent)' : 'transparent',
            }}
          >
            {t(MODE_KEYS[candidate])}
          </button>
        ))}
        <button
          type="button"
          style={{ ...BUTTON, marginLeft: 'auto' }}
          disabled={busy}
          onClick={() => { void run(async () => { await loadProjects(); await loadOutputs(); await loadTasks() }) }}
        >
          {t('refresh')}
        </button>
      </nav>

      {notice === undefined ? null : (
        <p style={{ ...MUTED, opacity: 0.9 }} role="status">
          {notice.tone === 'error' ? `${t('failed')}: ` : ''}{notice.text}
        </p>
      )}

      <section aria-label={t(MODE_KEYS[mode])} style={PANE}>
        <p style={MUTED}>
          {busy ? t('busy') : t('emptyHint')}
          {' · '}
          {outputs.length === 0 ? t('noOutputs') : `${outputs.length} output(s)`}
        </p>
      </section>

      {mode === 'workflow' && workflow !== undefined
        ? (
          <section data-workbench-pane="paneCanvas" data-workbench-planned="false" style={{ ...PANE, minHeight: '360px' }}>
            <h3 style={PANE_TITLE}>{t('paneCanvas')}</h3>
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
            <p style={MUTED} data-workflow-save={workflowState} role="status">
              {t(workflowState === 'dirty' ? 'saveDirty' : workflowState === 'saving' ? 'saveSaving' : workflowState === 'failed' ? 'saveFailed' : 'saveSaved')}
            </p>
          </section>
        )
        : null}

      {mode === 'timeline' && timeline !== undefined
        ? (
          <section data-workbench-pane="paneTimeline" data-workbench-planned="false" style={PANE}>
            <h3 style={PANE_TITLE}>
              {t('timelineTitle')}
              {' · '}{t('timelineTotal')} {Math.round(timelineDurationMs(timeline.tracks) / 1000)}s
            </h3>
            <p style={MUTED} data-timeline-save={timelineState}>
              {t(timelineState === 'dirty' ? 'saveDirty' : timelineState === 'saving' ? 'saveSaving' : timelineState === 'failed' ? 'saveFailed' : 'saveSaved')}
              {' · '}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <input type="checkbox" data-timeline-burn="true" checked={timeline.burnSubtitles}
                  aria-label={t('burnSubtitles')}
                  onChange={event => {
                    const burnSubtitles = event.target.checked
                    setTimeline(current => current === undefined ? current : { ...current, burnSubtitles })
                    setTimelineState('dirty')
                  }} />
                {t('burnSubtitles')}
              </label>
            </p>
            <p style={{ ...MUTED, fontSize: '10px' }} data-timeline-ffmpeg={ffmpeg === undefined ? 'unknown' : ffmpeg.available ? 'ok' : ffmpeg.code ?? 'unavailable'}>
              {ffmpeg === undefined
                ? '…'
                : ffmpeg.available
                  ? `${t('ffmpegOk')} ${ffmpeg.version ?? ''} · ${ffmpeg.path ?? ''}`
                  : ffmpeg.message ?? ''}
              {' '}
              <button type="button" style={{ ...BUTTON, fontSize: '10px' }} onClick={() => { void recheckFfmpeg() }}>
                {t('ffmpegRecheck')}
              </button>
            </p>
            <strong style={{ fontSize: '11px', opacity: 0.8 }}>{t('previewTitle')}</strong>
            <div data-timeline-preview="true" data-timeline-active-clip={activeVideo?.id ?? ''}
              data-timeline-active-subtitle={activeSubtitle?.id ?? ''}
              style={{ position: 'relative', minHeight: '120px', background: '#101014', borderRadius: '6px', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              {activeVideo?.assetPath === undefined
                ? <span style={{ ...MUTED, fontSize: '11px' }}>{t('previewIdle')}</span>
                : /\.(png|jpe?g|webp|gif)$/i.test(activeVideo.assetPath)
                  ? <img src={`/outputs/${encodeURIComponent(baseName(activeVideo.assetPath))}`} alt="" style={{ maxWidth: '100%', maxHeight: '200px' }} />
                  : <video src={`/outputs/${encodeURIComponent(baseName(activeVideo.assetPath))}`} muted
                    style={{ maxWidth: '100%', maxHeight: '200px' }} />}
              {activeSubtitle?.text === undefined ? null : (
                <span data-timeline-subtitle-preview="true"
                  style={{
                    position: 'absolute', left: 0, right: 0, padding: '0 8px', textAlign: 'center',
                    color: activeSubtitle.style?.color ?? '#ffffff',
                    fontSize: `${Math.max(11, Math.min(26, Math.round((activeSubtitle.style?.fontSize ?? 32) / 2)))}px`,
                    ...(activeSubtitle.style?.position ?? 'bottom') === 'bottom' ? { bottom: '6px' } : {},
                    ...activeSubtitle.style?.position === 'top' ? { top: '6px' } : {},
                    ...activeSubtitle.style?.position === 'middle' ? { top: '50%', transform: 'translateY(-50%)' } : {},
                    textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                  }}>
                  {activeSubtitle.text}
                </span>
              )}
            </div>
            <input type="range" data-timeline-playhead="true" min={0} max={Math.max(1, timelineTotal)}
              value={playheadMs} aria-label={t('playhead')}
              onChange={event => { setPreviewMs(Number(event.target.value)) }} />
            <p style={{ ...MUTED, fontSize: '10px' }}>{t('previewNote')}</p>
            {timeline.tracks.map(track => (
              <div key={track.id} data-timeline-track={track.kind} style={{ marginBottom: '8px' }}>
                <strong style={{ fontSize: '11px' }}>{t(trackKindKey(track.kind))}</strong>
                {track.clips.length === 0
                  ? <p style={{ ...MUTED, fontSize: '11px' }}>{t('timelineEmpty')}</p>
                  : (
                    <ul style={{ margin: '2px 0 4px', padding: 0, listStyle: 'none', display: 'grid', gap: '2px' }}>
                      {track.clips.map(clip => (
                        <li key={clip.id} data-timeline-clip={clip.id} data-timeline-clip-kind={track.kind}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={clip.assetPath ?? clip.text ?? ''}>
                            {track.kind === 'subtitle' ? (clip.text ?? '') : baseName(clip.assetPath ?? '')}
                          </span>
                          <input type="number" value={clip.startMs} aria-label={`${t('clipStart')} ${clip.id}`}
                            style={{ ...INPUT, minWidth: '64px' }}
                            onChange={event => {
                              const startMs = Number(event.target.value)
                              patchTrack(track.id, current => ({
                                ...current,
                                clips: current.clips.map(item => (item.id === clip.id ? { ...item, startMs } : item)),
                              }))
                            }} />
                          <input type="number" value={clip.durationMs} aria-label={`${t('clipDuration')} ${clip.id}`}
                            style={{ ...INPUT, minWidth: '64px' }}
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
                                <input type="number" min={8} max={200} value={clip.style?.fontSize ?? 32}
                                  aria-label={`${t('styleFontSize')} ${clip.id}`} style={{ ...INPUT, minWidth: '54px' }}
                                  onChange={event => {
                                    const fontSize = Number(event.target.value)
                                    patchTrack(track.id, current => ({
                                      ...current,
                                      clips: current.clips.map(item => (item.id === clip.id
                                        ? { ...item, style: { ...item.style, fontSize } }
                                        : item)),
                                    }))
                                  }} />
                                <input type="color" value={clip.style?.color ?? '#ffffff'}
                                  aria-label={`${t('styleColor')} ${clip.id}`} style={{ width: '26px', padding: 0 }}
                                  onChange={event => {
                                    const color = event.target.value
                                    patchTrack(track.id, current => ({
                                      ...current,
                                      clips: current.clips.map(item => (item.id === clip.id
                                        ? { ...item, style: { ...item.style, color } }
                                        : item)),
                                    }))
                                  }} />
                                <select value={clip.style?.position ?? 'bottom'}
                                  aria-label={`${t('stylePosition')} ${clip.id}`} style={{ ...INPUT, minWidth: '72px' }}
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
                          <button type="button" style={BUTTON} aria-label={`${t('remove')} ${clip.id}`}
                            onClick={() => {
                              patchTrack(track.id, current => ({
                                ...current, clips: current.clips.filter(item => item.id !== clip.id),
                              }))
                            }}>
                            {t('remove')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                {track.kind === 'subtitle'
                  ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input placeholder={t('subtitlePlaceholder')} aria-label={t('subtitlePlaceholder')}
                        value={subtitleDraft} style={INPUT}
                        onChange={event => { setSubtitleDraft(event.target.value) }} />
                      <button type="button" style={BUTTON} disabled={subtitleDraft.trim() === ''}
                        aria-label={t('addSubtitle')}
                        onClick={() => { appendClip(track.id, { text: subtitleDraft.trim() }); setSubtitleDraft('') }}>
                        {t('addSubtitle')}
                      </button>
                    </div>
                  )
                  : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <select aria-label={`${t('pickAsset')} ${track.kind}`} value={clipAssetPath} style={INPUT}
                        onChange={event => { setClipAssetPath(event.target.value) }}>
                        <option value=''>{t('pickAsset')}</option>
                        {assets
                          .filter(candidate => track.kind === 'audio' ? candidate.kind === 'video' : candidate.kind === track.kind)
                          .map(candidate => (
                            <option key={candidate.id} value={candidate.path}>{baseName(candidate.path)}</option>
                          ))}
                      </select>
                      <button type="button" style={BUTTON} disabled={clipAssetPath === ''}
                        aria-label={`${t('addClip')} ${track.kind}`}
                        onClick={() => { appendClip(track.id, { assetPath: clipAssetPath }); setClipAssetPath('') }}>
                        {t('addClip')}
                      </button>
                    </div>
                  )}
              </div>
            ))}
          </section>
        )
        : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
        <section data-workbench-pane="paneAssets" data-workbench-planned="false" style={PANE}>
          <h3 style={PANE_TITLE}>{t('paneAssets')}</h3>
          <button
            type="button"
            style={{ ...BUTTON, marginBottom: '6px' }}
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
            {t('registerLatest')}
          </button>
          <button
            type="button"
            style={{ ...BUTTON, marginBottom: '6px' }}
            disabled={busy || activeProject === undefined}
            aria-label={t('compactAssets')}
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
            {t('compactAssets')}
          </button>
          <select
            aria-label={t('filterAll')}
            value={assetFilter}
            onChange={event => { setAssetFilter(event.target.value as 'all' | 'image' | 'video') }}
            style={{ ...INPUT, marginBottom: '6px' }}
          >
            <option value="all">{t('filterAll')}</option>
            <option value="image">{t('filterImage')}</option>
            <option value="video">{t('filterVideo')}</option>
          </select>
          {visibleAssets.length === 0
            ? <p style={MUTED}>{t('noAssets')}</p>
            : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '4px' }}>
                {visibleAssets.map(asset => (
                  <li key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <button
                      type="button"
                      aria-pressed={asset.id === selectedId}
                      aria-label={`${t('panePreview')} ${baseName(asset.path)}`}
                      onClick={() => { setPreviewPath(undefined); setSelectedId(asset.id) }}
                      style={{
                        ...BUTTON, flex: 1, textAlign: 'left', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {asset.kind === 'video' ? '🎬' : '🖼️'} {baseName(asset.path)} · {formatBytes(asset.bytes)}
                    </button>
                    <button
                      type="button"
                      // 可访问名带上文件名：同一区域里可能有多个"删除"按钮
                      aria-label={`${confirming === asset.id ? t('confirmRemove') : t('remove')} ${baseName(asset.path)}`}
                      style={BUTTON}
                      disabled={busy}
                      onClick={() => {
                        if (confirming !== asset.id) { setConfirming(asset.id); return }
                        setConfirming(undefined)
                        void run(async () => {
                          await apiRef.current.removeAsset(asset.id)
                          setAssets(await apiRef.current.listAssets(asset.projectId))
                        })
                      }}
                    >
                      {confirming === asset.id ? t('confirmRemove') : t('remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section data-workbench-pane="panePreview" data-workbench-planned="false" style={PANE}>
          <h3 style={PANE_TITLE}>{t('panePreview')}</h3>
          {previewTarget === undefined
            ? <p style={MUTED}>{t('previewEmpty')}</p>
            : previewTarget.kind === 'video'
              ? (
                <video
                  key={previewTarget.path}
                  src={`/outputs/${encodeURIComponent(baseName(previewTarget.path))}`}
                  controls
                  style={{ width: '100%', borderRadius: '6px' }}
                />
              )
              : (
                <img
                  alt={baseName(previewTarget.path)}
                  src={`/outputs/${encodeURIComponent(baseName(previewTarget.path))}`}
                  style={{ width: '100%', borderRadius: '6px' }}
                />
              )}
        </section>

        <section data-workbench-pane="paneResources" data-workbench-planned="false" style={PANE}>
          <h3 style={PANE_TITLE}>{t('paneResources')}</h3>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <select
              aria-label={t('paneResources')}
              value={resourceKind}
              onChange={event => { setResourceKind(event.target.value as ResourceKind) }}
              style={INPUT}
            >
              {RESOURCE_KINDS.map(kind => <option key={kind} value={kind}>{t(kindKey(kind))}</option>)}
            </select>
            <input
              aria-label={t('resourceNamePlaceholder')}
              placeholder={t('resourceNamePlaceholder')}
              value={resourceName}
              onChange={event => { setResourceName(event.target.value) }}
              style={INPUT}
            />
            <input
              aria-label={t('notePlaceholder')}
              placeholder={t('notePlaceholder')}
              value={resourceNote}
              onChange={event => { setResourceNote(event.target.value) }}
              style={INPUT}
            />
            <button
              type="button"
              style={BUTTON}
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
              {t('addResource')}
            </button>
          </div>
          {resources.length === 0
            ? <p style={MUTED}>{t('noResources')}</p>
            : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '4px' }}>
                {resources.map(resource => (
                  <li key={resource.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={resource.note ?? ''}>
                      {t(kindKey(resource.kind))} · {resource.name}{resource.note === undefined ? '' : ` · ${resource.note}`}
                    </span>
                    <button
                      type="button"
                      style={BUTTON}
                      aria-label={`${confirming === resource.id ? t('confirmRemove') : t('remove')} ${resource.name}`}
                      disabled={busy}
                      onClick={() => {
                        if (confirming !== resource.id) { setConfirming(resource.id); return }
                        setConfirming(undefined)
                        void run(async () => {
                          await apiRef.current.removeResource(resource.id)
                          if (activeProject !== undefined) await loadResources(activeProject.id)
                        })
                      }}
                    >
                      {confirming === resource.id ? t('confirmRemove') : t('remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section data-workbench-pane="paneTasks" data-workbench-planned="false" style={PANE}>
          <h3 style={PANE_TITLE}>{t('paneTasks')}</h3>
          {tasks.length === 0
            ? <p style={MUTED}>{t('noTasks')}</p>
            : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '4px' }}>
                {tasks.map(task => (
                  <li key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <button
                      type="button"
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
                      style={{
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left',
                        cursor: task.outputPath === undefined ? 'default' : 'pointer', fontSize: '12px', padding: 0,
                      }}
                      title={task.error ?? task.prompt ?? task.outputPath ?? ''}
                    >
                      {task.kind === 'video' ? '🎬' : '🖼️'} {t(statusKey(task.status))}
                      {' · '}{task.model ?? '—'}{' · '}{formatBytes(task.bytes ?? 0)}{' · '}{clockTime(task.createdAt)}
                    </button>
                    {task.status === 'running'
                      ? (
                        <button
                          type="button"
                          style={BUTTON}
                          aria-label={`${t('cancelTask')} ${task.id}`}
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
                      style={BUTTON}
                      aria-label={`${t('registerAsAsset')} ${task.id}`}
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
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </div>
  )
}
