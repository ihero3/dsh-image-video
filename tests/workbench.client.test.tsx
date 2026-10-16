// @vitest-environment jsdom
/**
 * Workbench surface behaviour: the phase-1 skeleton facts (header, modes, panes,
 * seat data) plus the phase-2 slice actually being *usable* — create a project,
 * register an output as its asset, preview it, and remove records with the
 * two-step confirmation.
 *
 * The API is an in-memory fake, so the assertions are about this component's
 * behaviour; the host side of the contract is covered by the host tests and by
 * the real-transport test.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Workbench, type WorkbenchProps } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import type { WorkbenchApi } from '../src/client/api.ts'
import type { AssetRecord, ProjectRecord, ResourceRecord, TaskRecord } from '../src/workbench/records.ts'
import type { WorkflowRecord, WorkflowRunRecord } from '../src/workbench/workflow.ts'
import type { TimelineRecord, TimelineTrack } from '../src/workbench/timeline.ts'
import type { OutputFile } from '../src/workbench/outputs.ts'

afterEach(cleanup)

const HEALTH = {
  plugin: 'dsh-image-video' as const, version: '0.3.1', channel: '/image-video',
  provider: 'threerouter', outputsDir: '/tmp/outputs', at: '2026-10-14T00:00:00.000Z',
}

/** Outputs the fake host offers. */
const OUTPUT_IMAGE: OutputFile = {
  name: 'shot.png', path: '/tmp/outputs/shot.png', kind: 'image', bytes: 2048, modifiedAt: '2026-10-14T10:00:00.000Z',
}
const OUTPUT_VIDEO: OutputFile = {
  name: 'clip.mp4', path: '/tmp/outputs/clip.mp4', kind: 'video', bytes: 4_096_000, modifiedAt: '2026-10-14T09:00:00.000Z',
}

/** In-memory stand-in for the host API, recording the calls it received. */
function fakeApi(options: {
  failHealth?: string
  tasks?: TaskRecord[]
  assets?: AssetRecord[]
  workflows?: WorkflowRecord[]
  runs?: WorkflowRunRecord[]
  timelines?: TimelineRecord[]
  ffmpeg?: { available: boolean; code?: string; message?: string; version?: string; path?: string }
  defaults?: Record<string, string | number | null>
} = {}) {
  const projects: ProjectRecord[] = []
  const assets: AssetRecord[] = [...(options.assets ?? [])]
  const tasks: TaskRecord[] = [...(options.tasks ?? [])]
  const resources: ResourceRecord[] = []
  const workflows: WorkflowRecord[] = [...(options.workflows ?? [])]
  const runs: WorkflowRunRecord[] = [...(options.runs ?? [])]
  const timelines: TimelineRecord[] = [...(options.timelines ?? [])]
  let runSequence = 0
  let renderJobs: Array<{ id: string; timelineId: string; projectId: string; status: 'running' | 'succeeded' | 'cancelled' | 'failed'; percent: number; startedAt: string; outputPath?: string; bytes?: number; durationMs?: number; error?: string }> = []
  let renderPolls = 0
  const calls: string[] = []
  let counter = 0
  const api: WorkbenchApi = {
    health: async () => {
      calls.push('health')
      if (options.failHealth !== undefined) throw new Error(options.failHealth)
      return options.defaults === undefined ? HEALTH : { ...HEALTH, defaults: options.defaults }
    },
    listProjects: async () => { calls.push('projects/list'); return [...projects] },
    createProject: async (name) => {
      calls.push('projects/create')
      counter += 1
      const project: ProjectRecord = {
        schemaVersion: 1, id: `prj-${counter}`, name,
        createdAt: `2026-10-14T00:00:0${counter}.000Z`, updatedAt: `2026-10-14T00:00:0${counter}.000Z`,
      }
      projects.push(project)
      return project
    },
    removeProject: async (id) => {
      calls.push('projects/remove')
      const index = projects.findIndex(project => project.id === id)
      if (index < 0) return false
      projects.splice(index, 1)
      return true
    },
    listAssets: async (projectId) => {
      calls.push('assets/list')
      return assets.filter(asset => asset.projectId === projectId)
    },
    attachAsset: async input => {
      calls.push('assets/attach')
      const existing = assets.find(asset => asset.projectId === input.projectId && asset.path === input.path)
      if (existing !== undefined) return { asset: existing, created: false }
      counter += 1
      const asset: AssetRecord = {
        schemaVersion: 1, id: `ast-${counter}`, projectId: input.projectId, kind: input.kind,
        path: input.path, bytes: input.bytes ?? 0, createdAt: `2026-10-14T01:00:0${counter}.000Z`,
      }
      assets.push(asset)
      return { asset, created: true }
    },
    removeAsset: async (id) => {
      calls.push('assets/remove')
      const index = assets.findIndex(asset => asset.id === id)
      if (index < 0) return false
      assets.splice(index, 1)
      return true
    },
    renameProject: async (id, name) => {
      calls.push('projects/rename')
      const index = projects.findIndex(project => project.id === id)
      const updated = { ...projects[index]!, name }
      projects[index] = updated
      return updated
    },
    listResources: async (projectId, kind) => {
      calls.push('resources/list')
      return resources.filter(resource => resource.projectId === projectId && (kind === undefined || resource.kind === kind))
    },
    createResource: async input => {
      calls.push('resources/create')
      counter += 1
      const resource: ResourceRecord = {
        schemaVersion: 1, id: `res-${counter}`, projectId: input.projectId, kind: input.kind, name: input.name,
        createdAt: `2026-10-14T02:00:0${counter}.000Z`, updatedAt: `2026-10-14T02:00:0${counter}.000Z`,
        ...input.note === undefined ? {} : { note: input.note },
      }
      resources.push(resource)
      return resource
    },
    removeResource: async (id) => {
      calls.push('resources/remove')
      const index = resources.findIndex(resource => resource.id === id)
      if (index < 0) return false
      resources.splice(index, 1)
      return true
    },
    listTasks: async () => { calls.push('tasks/list'); return [...tasks] },
    runWorkflow: async (workflowId) => {
      calls.push('workflows/run')
      runSequence += 1
      const run: WorkflowRunRecord = {
        schemaVersion: 1, id: `run-${runSequence}`, workflowId, projectId: 'prj-1', status: 'succeeded',
        graph: { nodes: [], edges: [] },
        nodeRuns: [{
          nodeId: 'i', kind: 'image-generate', status: 'succeeded',
          startedAt: '2026-10-15T00:00:00.000Z', outputPath: '/tmp/out/shot.png',
        }],
        startedAt: '2026-10-15T00:00:00.000Z', finishedAt: '2026-10-15T00:00:00.000Z',
      }
      runs.unshift(run)
      return run
    },
    listRuns: async () => { calls.push('workflows/runs'); return [...runs] },
    cancelRun: async (runId) => {
      calls.push('workflows/run-cancel')
      const run = runs.find(candidate => candidate.id === runId)
      if (run === undefined) return false
      runs[runs.indexOf(run)] = { ...run, status: 'cancelled' }
      return true
    },
    retryRun: async (runId) => {
      calls.push('workflows/run-retry')
      const previous = runs.find(candidate => candidate.id === runId)
      runSequence += 1
      const run: WorkflowRunRecord = {
        schemaVersion: 1, id: `run-${runSequence}`, workflowId: previous?.workflowId ?? 'wfl-1',
        projectId: previous?.projectId ?? 'prj-1', status: 'running', graph: { nodes: [], edges: [] },
        nodeRuns: [], startedAt: '2026-10-15T00:00:01.000Z',
      }
      runs.unshift(run)
      return run
    },
    probeFfmpeg: async () => {
      calls.push('media/ffmpeg')
      return options.ffmpeg ?? { available: true, version: '7.1.1', path: '/opt/homebrew/bin/ffmpeg', encoders: { h264: true, aac: true } }
    },
    renderTimeline: async (timelineId) => {
      calls.push('timelines/render')
      renderJobs = [{ id: 'render-1', timelineId, projectId: 'prj-1', status: 'running', percent: 0, startedAt: '2026-10-16T00:00:00.000Z' }]
      return renderJobs[0]!
    },
    listRenders: async () => {
      calls.push('timelines/renders')
      // 第二次轮询就"渲染完成"，模拟真实进度收尾
      renderPolls += 1
      if (renderPolls > 1 && renderJobs[0] !== undefined) {
        renderJobs = [{ ...renderJobs[0]!, status: 'succeeded', percent: 100, outputPath: '/tmp/outputs/movie.mp4', bytes: 2048, durationMs: 1000 }]
      }
      return [...renderJobs]
    },
    cancelRender: async (renderId) => {
      calls.push('timelines/render-cancel')
      if (renderJobs[0]?.id !== renderId) return false
      renderJobs = [{ ...renderJobs[0]!, status: 'cancelled', error: '渲染已取消' }]
      return true
    },
    listTimelines: async () => {
      calls.push('timelines/list')
      return [...timelines]
    },
    saveTimeline: async (input) => {
      calls.push('timelines/save')
      const stamp = '2026-10-16T00:00:00.000Z'
      const existing = input.id === undefined ? undefined : timelines.find(row => row.id === input.id)
      const record: TimelineRecord = {
        schemaVersion: 1, id: existing?.id ?? `tml-${timelines.length + 1}`, projectId: input.projectId,
        name: input.name ?? '未命名时间轴', frameRate: input.frameRate ?? 30,
        burnSubtitles: input.burnSubtitles ?? existing?.burnSubtitles ?? true,
        tracks: input.tracks as TimelineTrack[], createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
      }
      const index = timelines.findIndex(row => row.id === record.id)
      if (index < 0) timelines.push(record)
      else timelines[index] = record
      return record
    },
    removeTimeline: async (id) => {
      calls.push('timelines/remove')
      const index = timelines.findIndex(row => row.id === id)
      if (index < 0) return false
      timelines.splice(index, 1)
      return true
    },
    listWorkflows: async (projectId) => {
      calls.push('workflows/list')
      return workflows.filter(workflow => workflow.projectId === projectId)
    },
    saveWorkflow: async input => {
      calls.push('workflows/save')
      const stamp = '2026-10-15T00:00:00.000Z'
      const existing = workflows.find(workflow => workflow.id === input.id)
      const record: WorkflowRecord = {
        schemaVersion: 1,
        id: existing?.id ?? `wfl-${workflows.length + 1}`,
        projectId: input.projectId,
        name: input.name ?? '未命名工作流',
        nodes: input.nodes as WorkflowRecord['nodes'],
        edges: input.edges as WorkflowRecord['edges'],
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      }
      if (existing === undefined) workflows.push(record)
      else workflows[workflows.indexOf(existing)] = record
      return record
    },
    removeWorkflow: async (id) => {
      calls.push('workflows/remove')
      const index = workflows.findIndex(workflow => workflow.id === id)
      if (index < 0) return false
      workflows.splice(index, 1)
      return true
    },
    compactAssets: async () => {
      calls.push('maintenance/compact')
      const seen = new Map<string, AssetRecord>()
      let removed = 0
      for (const asset of [...assets]) {
        const key = `${asset.projectId}\u0000${asset.path}`
        if (seen.has(key)) { removed += 1; assets.splice(assets.indexOf(asset), 1); continue }
        seen.set(key, asset)
      }
      return removed
    },
    cancelTask: async (id) => {
      calls.push('tasks/cancel')
      const index = tasks.findIndex(task => task.id === id)
      if (index < 0) return false
      tasks[index] = { ...tasks[index]!, status: 'cancelled' }
      return true
    },
    assignTask: async (id, projectId) => {
      calls.push('tasks/assign')
      const index = tasks.findIndex(task => task.id === id)
      const updated = { ...tasks[index]!, projectId }
      tasks[index] = updated
      return updated
    },
    listOutputs: async () => { calls.push('outputs/list'); return [OUTPUT_IMAGE, OUTPUT_VIDEO] },
  }
  return { api, calls, projects, assets, tasks, resources, workflows, timelines }
}

/** Props for one render; the seat binds far more than this component reads. */
function props(overrides: { visible?: boolean; fullscreen?: boolean; api?: WorkbenchApi } = {}): WorkbenchProps {
  const useTabInfo = () => ({
    sidebar: { expanded: true, fullscreen: overrides.fullscreen ?? false },
    panel: { id: 'pane-1' },
    tab: { visible: overrides.visible ?? true },
  })
  return {
    kind: 'dsh-image-video-workbench',
    t: (key: keyof typeof en) => en[key],
    useTabInfo,
    api: overrides.api ?? fakeApi().api,
  } as unknown as WorkbenchProps
}

/** Create the first project through the UI and wait for it to land. */
async function createProject(host: ReturnType<typeof fakeApi>, name: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(en.newProject), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: en.create }))
  await waitFor(() => { expect(host.projects).toHaveLength(1) })
}

describe('workbench skeleton', () => {
  it('renders the header, three modes and four panes', async () => {
    const view = render(<Workbench {...props()} />)
    expect(view.container.querySelector('[data-workbench-kind]')?.getAttribute('data-workbench-kind'))
      .toBe('dsh-image-video-workbench')
    expect(screen.getByText(en.sectionProject)).toBeTruthy()
    for (const mode of [en.modeQuick, en.modeWorkflow, en.modeTimeline]) {
      expect(screen.getByRole('button', { name: mode })).toBeTruthy()
    }
    for (const pane of [en.paneAssets, en.paneResources, en.panePreview, en.paneTasks]) {
      expect(screen.getByRole('heading', { name: pane })).toBeTruthy()
    }
    // 阶段 2 起：素材与预览面可交互，只剩创作资源与任务仍是占位
    expect(view.container.querySelector('[data-workbench-pane=paneAssets]')?.getAttribute('data-workbench-planned')).toBe('false')
    expect(view.container.querySelector('[data-workbench-pane=paneTasks]')?.getAttribute('data-workbench-planned')).toBe('false')
    // 阶段 2 起四个面板都是真的（不再有"不可运行"占位）
    expect(screen.queryByText(en.panePlanned)).toBeNull()
    for (const pane of ['paneAssets', 'paneResources', 'panePreview', 'paneTasks']) {
      expect(view.container.querySelector(`[data-workbench-pane=${pane}]`)?.getAttribute('data-workbench-planned')).toBe('false')
    }
    expect(await screen.findByText('0.3.1 · threerouter')).toBeTruthy()
  })

  it('switches the current mode without losing the panes', () => {
    render(<Workbench {...props()} />)
    const quick = screen.getByRole('button', { name: en.modeQuick })
    const workflow = screen.getByRole('button', { name: en.modeWorkflow })
    expect(quick.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(workflow)
    expect(workflow.getAttribute('aria-pressed')).toBe('true')
    expect(quick.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('region', { name: en.modeWorkflow })).toBeTruthy()
  })

  it('reports the seat facts it was handed', () => {
    const view = render(<Workbench {...props({ visible: false, fullscreen: true })} />)
    const root = view.container.querySelector('[data-workbench-kind]')!
    expect(root.getAttribute('data-workbench-visible')).toBe('false')
    expect(root.getAttribute('data-workbench-fullscreen')).toBe('true')
  })

  it('reports a refused health check without breaking the surface', async () => {
    const view = render(<Workbench {...props({ api: fakeApi({ failHealth: 'boom' }).api })} />)
    const root = view.container.querySelector('[data-workbench-kind]')!
    await screen.findByText(en.healthFailed)
    expect(root.getAttribute('data-workbench-health')).toBe('failed')
    expect(screen.getByTitle('boom')).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.paneTasks })).toBeTruthy()
  })
})

describe('workbench project and asset flow', () => {
  it('creates a project and shows it in the picker', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)

    await createProject(host, '我的第一个项目')

    expect(host.calls).toContain('projects/create')
    expect(view.container.querySelector('[data-workbench-projects]')?.getAttribute('data-workbench-projects')).toBe('1')
    expect(screen.getByRole('option', { name: '我的第一个项目' })).toBeTruthy()
  })

  it('registers the newest unregistered output as an asset and previews it', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '素材项目')

    fireEvent.click(await screen.findByRole('button', { name: en.registerLatest }))
    await waitFor(() => { expect(host.assets).toHaveLength(1) })
    expect(host.assets[0]?.path).toBe(OUTPUT_IMAGE.path)
    expect(view.container.querySelector('[data-workbench-assets]')?.getAttribute('data-workbench-assets')).toBe('1')

    // 点素材行 → 预览面用只读媒体路由渲染该文件
    fireEvent.click(await screen.findByRole('button', { name: `${en.panePreview} shot.png` }))
    const image = await screen.findByRole('img', { name: 'shot.png' })
    expect(image.getAttribute('src')).toBe('/outputs/shot.png')
  })

  it('removes an asset only after the confirmation click', async () => {
    const host = fakeApi()
    render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '待删除')
    fireEvent.click(await screen.findByRole('button', { name: en.registerLatest }))
    await waitFor(() => { expect(host.assets).toHaveLength(1) })

    // 素材的删除按钮带文件名，便于与项目级删除区分
    fireEvent.click(screen.getByRole('button', { name: `${en.remove} shot.png` }))
    expect(host.calls).not.toContain('assets/remove')
    fireEvent.click(screen.getByRole('button', { name: `${en.confirmRemove} shot.png` }))
    await waitFor(() => { expect(host.calls).toContain('assets/remove') })
    expect(host.assets).toHaveLength(0)
  })

  it('lists recorded generations and files one into the active project', async () => {
    const task: TaskRecord = {
      schemaVersion: 1, id: 'tsk-1', kind: 'video', status: 'succeeded', provider: 'threerouter',
      model: 'minimax-h3', outputPath: '/tmp/outputs/clip.mp4', bytes: 4_096_000,
      createdAt: '2026-10-14T10:30:00.000Z', updatedAt: '2026-10-14T10:30:00.000Z',
    }
    const host = fakeApi({ tasks: [task] })
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)

    // 任务面板：状态/模型/大小/时间都可读
    expect(await screen.findByText(new RegExp(`${en.statusSucceeded} · minimax-h3`))).toBeTruthy()
    expect(view.container.querySelector('[data-workbench-tasks]')?.getAttribute('data-workbench-tasks')).toBe('1')

    await createProject(host, '任务项目')
    fireEvent.click(await screen.findByRole('button', { name: `${en.registerAsAsset} tsk-1` }))
    await waitFor(() => { expect(host.assets).toHaveLength(1) })
    expect(host.calls).toContain('assets/attach')
    expect(host.calls).toContain('tasks/assign')
    expect(host.assets[0]?.path).toBe(task.outputPath)
    expect(host.tasks[0]?.projectId).toBe(host.projects[0]?.id)
  })

  it('creates a creative resource in the active project', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '资源项目')

    fireEvent.change(await screen.findByLabelText(en.resourceNamePlaceholder), { target: { value: '女主' } })
    fireEvent.change(screen.getByLabelText(en.notePlaceholder), { target: { value: '短发' } })
    fireEvent.click(screen.getByRole('button', { name: en.addResource }))

    await waitFor(() => { expect(host.resources).toHaveLength(1) })
    expect(host.resources[0]).toMatchObject({ kind: 'role', name: '女主', note: '短发' })
    expect(view.container.querySelector('[data-workbench-resources]')?.getAttribute('data-workbench-resources')).toBe('1')
    expect(await screen.findByText(new RegExp(`${en.kindRole} · 女主`))).toBeTruthy()
  })

  it('renames a project through the save-state four states', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '旧名')

    const root = view.container.querySelector('[data-workbench-kind]')!
    expect(root.getAttribute('data-workbench-save')).toBe('saved')

    fireEvent.click(screen.getByRole('button', { name: en.rename }))
    const input = await screen.findByLabelText(en.rename)
    expect((input as HTMLInputElement).value).toBe('旧名')

    fireEvent.change(input, { target: { value: '新名字' } })
    expect(root.getAttribute('data-workbench-save')).toBe('dirty')

    fireEvent.click(screen.getByRole('button', { name: en.save }))
    await waitFor(() => { expect(host.calls).toContain('projects/rename') })
    await waitFor(() => { expect(root.getAttribute('data-workbench-save')).toBe('saved') })
    expect(host.projects[0]?.name).toBe('新名字')
    expect(screen.getByRole('option', { name: '新名字' })).toBeTruthy()
  })

  it('loads the stored workflow when entering the workflow mode', async () => {
    const host = fakeApi({
      workflows: [{
        schemaVersion: 1, id: 'wfl-seed', projectId: 'prj-1', name: '既有流程',
        nodes: [{ id: 'n1', kind: 'script', position: { x: 12, y: 34 }, params: { text: '第一句' } }],
        edges: [],
        createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
      }],
    })
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '流程项目',
      createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
    })
    const view = render(<Workbench {...props({ api: host.api })} />)
    fireEvent.click(await screen.findByRole('button', { name: en.modeWorkflow }))

    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-canvas]')?.getAttribute('data-workflow-nodes')).toBe('1')
    })
    expect(host.calls).toContain('workflows/list')
    expect(view.container.querySelector('[data-workflow-node="script"]')).toBeTruthy()
  })

  it('edits a three-track timeline, autosaves it and restores it on reopen', async () => {
    const clip: AssetRecord = {
      schemaVersion: 1, id: 'ast-v', projectId: 'prj-1', kind: 'video',
      path: '/tmp/outputs/clip.mp4', bytes: 1024, createdAt: '2026-10-16T00:00:00.000Z',
    }
    const host = fakeApi({ assets: [clip] })
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '时间轴项目')
    fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
    await waitFor(() => { expect(view.container.querySelector('[data-workbench-pane="paneTimeline"]')).toBeTruthy() })

    // 三轨齐全
    expect(view.container.querySelectorAll('[data-timeline-track]')).toHaveLength(3)

    // 视频轨：从素材里加入一个 clip
    const picker = view.container.querySelector('[data-timeline-track="video"] select') as HTMLSelectElement
    fireEvent.change(picker, { target: { value: '/tmp/outputs/clip.mp4' } })
    fireEvent.click(view.container.querySelector('[data-timeline-track="video"] button[aria-label^="Add to track"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelectorAll('[data-timeline-track="video"] [data-timeline-clip]')).toHaveLength(1)
    })

    // 字幕轨：加一条字幕
    fireEvent.change(view.container.querySelector('[data-timeline-track="subtitle"] input') as HTMLElement, {
      target: { value: '第一句字幕' },
    })
    fireEvent.click(view.container.querySelector('[aria-label="Add subtitle"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(2) })

    // 顺序预览：播放头移动会切换"当前片段"（字幕）
    const firstSubtitle = view.container.querySelector('[data-timeline-active-subtitle]')?.getAttribute('data-timeline-active-subtitle')
    expect(firstSubtitle).toBeTruthy()
    fireEvent.change(view.container.querySelector('[data-timeline-playhead]') as HTMLElement, { target: { value: '3500' } })
    await waitFor(() => {
      expect(view.container.querySelector('[data-timeline-active-subtitle]')?.getAttribute('data-timeline-active-subtitle')).not.toBe(firstSubtitle)
    })

    // 字幕样式 + 烧录开关都会落库
    fireEvent.change(view.container.querySelector('[data-timeline-track="subtitle"] input[type="color"]') as HTMLElement, {
      target: { value: '#ffcc00' },
    })
    fireEvent.click(view.container.querySelector('[data-timeline-burn]') as HTMLElement)
    // 去抖 800ms + 异步保存，给足时间
    await waitFor(() => {
      expect(host.timelines[0]?.burnSubtitles).toBe(false)
      expect(host.timelines[0]?.tracks[2]?.clips[0]?.style?.color).toBe('#ffcc00')
    }, { timeout: 4000 })

    // 自动保存：文档落库且是三轨结构
    await waitFor(() => { expect(host.calls).toContain('timelines/save') })
    await waitFor(() => {
      expect(host.timelines[0]?.tracks.map(track => track.clips.length)).toEqual([1, 0, 1])
    })
    expect(host.timelines[0]?.tracks.map(track => track.kind)).toEqual(['video', 'audio', 'subtitle'])

    // 重开（重新挂载）后恢复：重新进入时间轴模式读回文档
    view.unmount()
    const reopened = render(<Workbench {...props({ api: host.api })} />)
    fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
    await waitFor(() => { expect(reopened.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(2) })
  })

  it('keeps project, canvas nodes and timeline clips across mode round-trips (T6-2)', async () => {
    const seededWorkflow: WorkflowRecord = {
      schemaVersion: 1, id: 'wfl-1', projectId: 'prj-1', name: '往返', edges: [],
      nodes: [{ id: 'n1', kind: 'image-generate', position: { x: 123, y: 45 }, params: { prompt: '猫' } }],
      createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z',
    }
    const seededTimeline: TimelineRecord = {
      schemaVersion: 1, id: 'tml-1', projectId: 'prj-1', name: '往返成片', frameRate: 30, burnSubtitles: true,
      tracks: [
        { id: 'v1', kind: 'video', clips: [{ id: 'clip-1', assetPath: '/tmp/outputs/a.mp4', startMs: 0, durationMs: 1000 }] },
        { id: 'a1', kind: 'audio', clips: [] },
        { id: 's1', kind: 'subtitle', clips: [{ id: 'clip-2', text: '字幕', startMs: 0, durationMs: 800 }] },
      ],
      createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z',
    }
    const host = fakeApi({ workflows: [seededWorkflow], timelines: [seededTimeline] })
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '往返项目')

    const switchTo = async (label: string): Promise<void> => {
      fireEvent.click(await screen.findByRole('button', { name: label }))
      await new Promise(resolve => { setTimeout(resolve, 50) })
    }

    // A：画布
    await switchTo(en.modeWorkflow)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-workflow-node]')).toHaveLength(1) })
    // C：时间轴
    await switchTo(en.modeTimeline)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(2) })
    // B：快速创作（离开两个编辑面）
    await switchTo(en.modeQuick)
    // 回到画布与时间轴：节点位置与 clip 必须一模一样
    await switchTo(en.modeWorkflow)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-workflow-node]')).toHaveLength(1) })
    expect(host.workflows[0]?.nodes[0]?.position).toEqual({ x: 123, y: 45 })
    await switchTo(en.modeTimeline)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(2) })
    expect(host.timelines[0]?.tracks[0]?.clips[0]?.id).toBe('clip-1')
    expect(host.timelines[0]?.tracks[2]?.clips[0]?.id).toBe('clip-2')
    // 项目本身也还在
    expect(host.projects).toHaveLength(1)
  })

  it('polls the host so changes made by the agent show up without a manual refresh (T6-4)', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    // 先有一个项目，项目下拉才会出现
    await createProject(host, '我的项目')
    await waitFor(() => { expect(view.container.querySelector('select[aria-label="Project"]')).toBeTruthy() })
    const before = view.container.querySelector('select[aria-label="Project"]')?.textContent ?? ''
    expect(before).toContain('我的项目')
    expect(before).not.toContain('Agent 建的项目')

    // 模拟 Agent（工具）在宿主侧新建了一个项目：客户端不点刷新也该看到（口径：≤5 秒）
    host.projects.push({
      schemaVersion: 1, id: 'prj-agent', name: 'Agent 建的项目',
      createdAt: '2026-10-16T05:00:00.000Z', updatedAt: '2026-10-16T05:00:00.000Z',
    })
    await waitFor(() => {
      expect(view.container.querySelector('select[aria-label="Project"]')?.textContent).toContain('Agent 建的项目')
    }, { timeout: 9000 })
  }, 15_000)

  it('shows the seven effective defaults from the host (T2-11)', async () => {
    const host = fakeApi({
      defaults: {
        mediaMode: 'video', imageProvider: 'threerouter', imageSize: '1024*1024', imageStyle: null,
        videoProvider: 'threerouter', videoAspectRatio: '16:9', videoDuration: 5,
      },
    })
    const view = render(<Workbench {...props({ api: host.api })} />)
    await waitFor(() => {
      expect(view.container.querySelector('[data-workbench-defaults]')).toBeTruthy()
    })
    const rows = [...view.container.querySelectorAll('[data-workbench-default]')]
    expect(rows).toHaveLength(7)
    expect(view.container.textContent).toContain('1024*1024')
    expect(view.container.textContent).toContain('16:9')
    // 没设的字段要明确说"未设置"，而不是留空
    expect(view.container.querySelector('[data-workbench-default="defaultImageStyle"]')?.textContent).toContain(en.none)
  })

  it('tells the user what to do when the host is not loopback (T2-9)', async () => {
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: '192.168.1.9', href: 'http://192.168.1.9:65323/', protocol: 'http:' },
    })
    try {
      const host = fakeApi()
      const view = render(<Workbench {...props({ api: host.api })} />)
      await waitFor(() => {
        expect(view.container.querySelector('[data-workbench-host-hint="remote"]')).toBeTruthy()
      })
      expect(view.container.querySelector('[data-workbench-host-hint="remote"]')?.textContent).toContain('127.0.0.1')
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })

  it('exports the timeline, shows progress and then the artifact', async () => {
    const host = fakeApi({
      timelines: [{
        schemaVersion: 1, id: 'tml-1', projectId: 'prj-1', name: '成片', frameRate: 30, burnSubtitles: true,
        tracks: [
          { id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: '/tmp/outputs/clip.mp4', startMs: 0, durationMs: 1000 }] },
          { id: 'a1', kind: 'audio', clips: [] },
          { id: 's1', kind: 'subtitle', clips: [] },
        ],
        createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z',
      }],
    })
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '导出项目')
    fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
    await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(1) })

    // 没在跑时"取消导出"不可用
    expect((view.container.querySelector('[data-timeline-export-cancel]') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(view.container.querySelector('[data-timeline-export]') as HTMLElement)
    await waitFor(() => { expect(host.calls).toContain('timelines/render') })
    await waitFor(() => {
      expect(view.container.querySelector('[data-timeline-render]')?.getAttribute('data-timeline-render')).toBe('succeeded')
    }, { timeout: 4000 })
    expect(view.container.querySelector('[data-timeline-render]')?.getAttribute('data-timeline-render-percent')).toBe('100')
    expect(view.container.querySelector('[data-timeline-render]')?.textContent).toContain('movie.mp4')
  })

  it('shows an actionable ffmpeg status in the timeline pane', async () => {
    const host = fakeApi({
      ffmpeg: { available: false, code: 'MEDIA_FFMPEG_UNAVAILABLE', message: '未找到可用的 ffmpeg。macOS 可执行 `brew install ffmpeg`；已装在别处就设 DSH_FFMPEG_PATH=/path/to/ffmpeg 后重试。' },
    })
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, 'ffmpeg 项目')
    fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
    await waitFor(() => {
      expect(view.container.querySelector('[data-timeline-ffmpeg]')?.getAttribute('data-timeline-ffmpeg')).toBe('MEDIA_FFMPEG_UNAVAILABLE')
    })
    // 文案里必须给出下一步动作，而不是一句看不出怎么办的英文
    expect(view.container.querySelector('[data-timeline-ffmpeg]')?.textContent).toContain('brew install ffmpeg')
    const before = host.calls.filter(call => call === 'media/ffmpeg').length
    fireEvent.click(screen.getByRole('button', { name: en.ffmpegRecheck }))
    await waitFor(() => {
      expect(host.calls.filter(call => call === 'media/ffmpeg').length).toBeGreaterThan(before)
    })
  })

  it('applies a built-in template into the canvas', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '模板项目')
    fireEvent.click(await screen.findByRole('button', { name: en.modeWorkflow }))
    await waitFor(() => { expect(view.container.querySelector('[data-workflow-canvas]')).toBeTruthy() })

    // 默认选中第一个模板（文案→分镜→图→视频），套用后应有 6 个节点且校验通过
    const picker = view.container.querySelector('[data-workflow-template]') as HTMLSelectElement
    expect(picker.value).toBe('copy-to-video')
    fireEvent.click(view.container.querySelector('[data-workflow-action="apply-template"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-canvas]')?.getAttribute('data-workflow-nodes')).toBe('6')
    })
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-validation="ok"]')).toBeTruthy()
    })
    // 模板自带示例值：运行按钮可用
    expect((view.container.querySelector('[data-workflow-run-action="start"]') as HTMLButtonElement).disabled).toBe(false)
  })

  it('lists past runs and shows the node results of the selected one', async () => {
    const made = (id: string, status: WorkflowRunRecord['status'], nodeStatus: 'succeeded' | 'failed', startedAt: string): WorkflowRunRecord => ({
      schemaVersion: 1, id, workflowId: 'wfl-1', projectId: 'prj-1', status,
      graph: { nodes: [], edges: [] },
      nodeRuns: [{
        nodeId: 'i', kind: 'image-generate', status: nodeStatus, startedAt,
        ...nodeStatus === 'succeeded' ? { outputPath: '/tmp/out/shot.png' } : { error: 'provider said no' },
      }],
      startedAt, finishedAt: startedAt,
    })
    const host = fakeApi({
      runs: [
        made('run-new', 'succeeded', 'succeeded', '2026-10-15T02:00:00.000Z'),
        made('run-old', 'failed', 'failed', '2026-10-15T01:00:00.000Z'),
      ],
    })
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '回看项目')
    fireEvent.click(await screen.findByRole('button', { name: en.modeWorkflow }))
    await waitFor(() => { expect(view.container.querySelectorAll('[data-workflow-run-item]').length).toBe(2) })

    // 默认看最新一次
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-run]')?.getAttribute('data-workflow-run')).toBe('succeeded')
    })
    // 点旧的那次 → 切到它的结果（失败节点 + 原因）
    fireEvent.click(view.container.querySelector('[data-workflow-run-item="run-old"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-run]')?.getAttribute('data-workflow-run')).toBe('failed')
    })
    expect(view.container.querySelector('[data-workflow-node-run="i"]')?.getAttribute('data-workflow-node-status')).toBe('failed')
    expect(view.container.querySelector('[data-workflow-run-item="run-old"]')?.getAttribute('data-workflow-run-item-selected')).toBe('true')
  })

  it('runs the workflow from the canvas once the graph validates', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '运行项目')
    fireEvent.click(await screen.findByRole('button', { name: en.modeWorkflow }))
    await waitFor(() => { expect(view.container.querySelector('[data-workflow-canvas]')).toBeTruthy() })

    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} image-generate` }))
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-run-action="start"]')).toBeTruthy()
    })
    // 图不合法（必填提示词为空）时不能起跑
    expect((view.container.querySelector('[data-workflow-run-action="start"]') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(await screen.findByLabelText(en.paramPrompt), { target: { value: '一只猫' } })
    await waitFor(() => {
      expect((view.container.querySelector('[data-workflow-run-action="start"]') as HTMLButtonElement).disabled).toBe(false)
    })
    fireEvent.click(view.container.querySelector('[data-workflow-run-action="start"]') as HTMLElement)

    await waitFor(() => { expect(host.calls).toContain('workflows/run') })
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-run]')?.getAttribute('data-workflow-run')).toBe('succeeded')
    })
    expect(view.container.querySelector('[data-workflow-node-run="i"]')?.getAttribute('data-workflow-node-status')).toBe('succeeded')
  })

  it('auto-saves canvas edits into the stored workflow', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '画布项目')
    fireEvent.click(await screen.findByRole('button', { name: en.modeWorkflow }))
    await waitFor(() => { expect(view.container.querySelector('[data-workflow-canvas]')).toBeTruthy() })

    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} script` }))
    await waitFor(() => { expect(host.calls).toContain('workflows/save') }, { timeout: 4000 })
    expect(host.workflows[0]?.nodes).toHaveLength(1)
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-save]')?.getAttribute('data-workflow-save')).toBe('saved')
    }, { timeout: 4000 })
  })

  it('merges duplicate asset records from the assets pane', async () => {
    const duplicate = (id: string): AssetRecord => ({
      schemaVersion: 1, id, projectId: 'prj-1', kind: 'image', path: '/tmp/outputs/dup.png',
      bytes: 1024, createdAt: '2026-10-14T00:00:00.000Z',
    })
    const host = fakeApi({ assets: [duplicate('ast-a'), duplicate('ast-b')] })
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '去重项目',
      createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
    })
    const view = render(<Workbench {...props({ api: host.api })} />)
    await waitFor(() => {
      expect(view.container.querySelector('[data-workbench-assets]')?.getAttribute('data-workbench-assets')).toBe('2')
    })

    fireEvent.click(screen.getByRole('button', { name: en.compactAssets }))
    await waitFor(() => { expect(host.calls).toContain('maintenance/compact') })
    expect(host.assets).toHaveLength(1)
    expect(await screen.findByText(new RegExp(en.compacted))).toBeTruthy()
  })

  it('filters assets by media kind', async () => {
    const seededImage: AssetRecord = {
      schemaVersion: 1, id: 'ast-img', projectId: 'prj-1', kind: 'image', path: '/tmp/outputs/shot.png',
      bytes: 2048, createdAt: '2026-10-14T00:00:01.000Z',
    }
    const seededVideo: AssetRecord = {
      schemaVersion: 1, id: 'ast-vid', projectId: 'prj-1', kind: 'video', path: '/tmp/outputs/clip.mp4',
      bytes: 4096, createdAt: '2026-10-14T00:00:02.000Z',
    }
    const host = fakeApi({ assets: [seededImage, seededVideo] })
    // 直接以一个已存在的项目 id 作为活动项目：先建项目并使 id 对齐
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '既有项目',
      createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
    })
    const view = render(<Workbench {...props({ api: host.api })} />)
    await waitFor(() => { expect(view.container.querySelector('[data-workbench-assets]')?.getAttribute('data-workbench-assets')).toBe('2') })

    fireEvent.change(screen.getByLabelText(en.filterAll), { target: { value: 'image' } })
    await waitFor(() => { expect(screen.queryByRole('button', { name: `${en.panePreview} clip.mp4` })).toBeNull() })
    expect(screen.getByRole('button', { name: `${en.panePreview} shot.png` })).toBeTruthy()

    fireEvent.change(screen.getByLabelText(en.filterAll), { target: { value: 'video' } })
    expect(await screen.findByRole('button', { name: `${en.panePreview} clip.mp4` })).toBeTruthy()
    expect(screen.queryByRole('button', { name: `${en.panePreview} shot.png` })).toBeNull()
  })

  it('auto-saves the rename shortly after typing stops', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '自动保存前')
    const root = view.container.querySelector('[data-workbench-kind]')!

    fireEvent.click(screen.getByRole('button', { name: en.rename }))
    fireEvent.change(await screen.findByLabelText(en.rename), { target: { value: '自动保存后' } })
    expect(root.getAttribute('data-workbench-save')).toBe('dirty')

    // 不点「保存」：等去抖自己落盘
    await waitFor(() => { expect(host.calls).toContain('projects/rename') }, { timeout: 4000 })
    await waitFor(() => { expect(root.getAttribute('data-workbench-save')).toBe('saved') }, { timeout: 4000 })
    expect(host.projects[0]?.name).toBe('自动保存后')
  })

  it('shows an informational notice without the failure prefix', async () => {
    const host = fakeApi()
    render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    await createProject(host, '提示项目')
    // 两条产出都登记完，再点一次 → 纯信息提示
    fireEvent.click(await screen.findByRole('button', { name: en.registerLatest }))
    await waitFor(() => { expect(host.assets).toHaveLength(1) })
    fireEvent.click(screen.getByRole('button', { name: en.registerLatest }))
    await waitFor(() => { expect(host.assets).toHaveLength(2) })
    fireEvent.click(screen.getByRole('button', { name: en.registerLatest }))
    const info = await screen.findByText(new RegExp(en.alreadyRegistered))
    expect(info.textContent).not.toContain(en.failed)
  })

  it('is idempotent when the same output is registered twice', async () => {
    const path = '/tmp/outputs/from-task.png'
    const finished: TaskRecord = {
      schemaVersion: 1, id: 'tsk-dup', kind: 'image', status: 'succeeded', provider: 'threerouter',
      model: 'minimax-image-01', outputPath: path, bytes: 512,
      createdAt: '2026-10-14T11:00:00.000Z', updatedAt: '2026-10-14T11:00:00.000Z',
    }
    const already: AssetRecord = {
      schemaVersion: 1, id: 'ast-dup', projectId: 'prj-1', kind: 'image', path,
      bytes: 512, createdAt: '2026-10-14T11:00:01.000Z',
    }
    const host = fakeApi({ tasks: [finished], assets: [already] })
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '幂等项目',
      createdAt: '2026-10-14T11:00:00.000Z', updatedAt: '2026-10-14T11:00:00.000Z',
    })
    render(<Workbench {...props({ api: host.api })} />)

    fireEvent.click(await screen.findByRole('button', { name: `${en.registerAsAsset} tsk-dup` }))
    // 同一路径第二次登记：不新增素材，并提示"已登记过"
    expect(await screen.findByText(new RegExp(en.alreadyRegistered))).toBeTruthy()
    expect(host.assets).toHaveLength(1)
    expect(host.calls.filter(call => call === 'assets/attach')).toHaveLength(1)
  })

  it('previews a task output registered in another project by path', async () => {
    const path = '/tmp/outputs/other-project.png'
    const finished: TaskRecord = {
      schemaVersion: 1, id: 'tsk-other', kind: 'image', status: 'succeeded', provider: 'threerouter',
      model: 'minimax-image-01', outputPath: path, bytes: 512,
      createdAt: '2026-10-14T11:00:00.000Z', updatedAt: '2026-10-14T11:00:00.000Z',
    }
    // 该产出登记在别的项目：当前项目的 assets 里没有它，预览仍应按路径显示
    const host = fakeApi({ tasks: [finished] })
    host.projects.push({
      schemaVersion: 1, id: 'prj-other', name: '别的项目',
      createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
    })
    render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(new RegExp(en.statusSucceeded))

    fireEvent.click(await screen.findByRole('button', { name: `${en.previewOutput} tsk-other` }))
    const image = await screen.findByRole('img', { name: 'other-project.png' })
    expect(image.getAttribute('src')).toBe('/outputs/other-project.png')
  })

  it('previews a task output straight from the task row', async () => {
    const finished: TaskRecord = {
      schemaVersion: 1, id: 'tsk-out', kind: 'image', status: 'succeeded', provider: 'threerouter',
      model: 'minimax-image-01', outputPath: '/tmp/outputs/from-task.png', bytes: 512,
      createdAt: '2026-10-14T11:00:00.000Z', updatedAt: '2026-10-14T11:00:00.000Z',
    }
    const host = fakeApi({ tasks: [finished] })
    render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(new RegExp(en.statusSucceeded))

    // 未登记为素材时，点任务行也能直接看产出（走只读媒体路由）
    fireEvent.click(await screen.findByRole('button', { name: `${en.previewOutput} tsk-out` }))
    const image = await screen.findByRole('img', { name: 'from-task.png' })
    expect(image.getAttribute('src')).toBe('/outputs/from-task.png')
  })

  it('offers cancel only for a running generation and files the result', async () => {
    const running: TaskRecord = {
      schemaVersion: 1, id: 'tsk-run', kind: 'video', status: 'running', provider: 'threerouter',
      model: 'minimax-h3', createdAt: '2026-10-14T11:00:00.000Z', updatedAt: '2026-10-14T11:00:00.000Z',
    }
    const host = fakeApi({ tasks: [running] })
    render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(new RegExp(en.statusRunning))

    const cancel = await screen.findByRole('button', { name: `${en.cancelTask} tsk-run` })
    fireEvent.click(cancel)
    await waitFor(() => { expect(host.calls).toContain('tasks/cancel') })
    expect(await screen.findByText(new RegExp(en.statusCancelled))).toBeTruthy()
    // 取消后不再提供取消按钮
    expect(screen.queryByRole('button', { name: `${en.cancelTask} tsk-run` })).toBeNull()
  })

  it('surfaces a host failure as a notice instead of crashing', async () => {
    const host = fakeApi()
    host.api.createProject = async () => { throw new Error('host said no') }
    render(<Workbench {...props({ api: host.api })} />)
    await screen.findByText(en.projectNone)
    fireEvent.change(screen.getByLabelText(en.newProject), { target: { value: '坏项目' } })
    fireEvent.click(screen.getByRole('button', { name: en.create }))
    const failure = await screen.findByText(new RegExp(`host said no`))
    // 失败提示要带「操作失败」前缀（信息类提示不带，见下一条用例）
    expect(failure.textContent).toContain(en.failed)
  })
})
