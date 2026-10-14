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
  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | undefined>(undefined)

  const activeProject = projects.find(project => project.id === activeId)
  const selectedAsset = assets.find(asset => asset.id === selectedId)
  const visibleAssets = assetFilter === 'all' ? assets : assets.filter(asset => asset.kind === assetFilter)

  /** Run one host action, surfacing failure as a notice instead of a crash. */
  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true)
    setNotice(undefined)
    try {
      await action()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
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

  useEffect(() => {
    void (async () => {
      setSelectedId(undefined)
      if (activeId === undefined) { setAssets([]); setResources([]); return }
      try {
        setAssets(await apiRef.current.listAssets(activeId))
        await loadResources(activeId)
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error))
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
        <p style={{ ...MUTED, opacity: 0.9 }} role="status">{t('failed')}: {notice}</p>
      )}

      <section aria-label={t(MODE_KEYS[mode])} style={PANE}>
        <p style={MUTED}>
          {busy ? t('busy') : t('emptyHint')}
          {' · '}
          {outputs.length === 0 ? t('noOutputs') : `${outputs.length} output(s)`}
        </p>
      </section>

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
                if (candidate === undefined) { setNotice(t('noOutputs')); return }
                await apiRef.current.attachAsset({
                  projectId: project.id, path: candidate.path, kind: candidate.kind, bytes: candidate.bytes,
                })
                setAssets(await apiRef.current.listAssets(project.id))
              })
            }}
          >
            {t('registerLatest')}
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
                      onClick={() => { setSelectedId(asset.id) }}
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
          {selectedAsset === undefined
            ? <p style={MUTED}>{t('previewEmpty')}</p>
            : selectedAsset.kind === 'video'
              ? (
                <video
                  key={selectedAsset.id}
                  src={`/outputs/${encodeURIComponent(baseName(selectedAsset.path))}`}
                  controls
                  style={{ width: '100%', borderRadius: '6px' }}
                />
              )
              : (
                <img
                  alt={baseName(selectedAsset.path)}
                  src={`/outputs/${encodeURIComponent(baseName(selectedAsset.path))}`}
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
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={task.error ?? task.prompt ?? task.outputPath ?? ''}>
                      {task.kind === 'video' ? '🎬' : '🖼️'} {t(statusKey(task.status))}
                      {' · '}{task.model ?? '—'}{' · '}{formatBytes(task.bytes ?? 0)}{' · '}{clockTime(task.createdAt)}
                    </span>
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
                          await apiRef.current.attachAsset({
                            projectId: project.id, path, kind: task.kind,
                            bytes: task.bytes, provider: task.provider, model: task.model, prompt: task.prompt,
                          })
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
