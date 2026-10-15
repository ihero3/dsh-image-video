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
function fakeApi(options: { failHealth?: string; tasks?: TaskRecord[]; assets?: AssetRecord[] } = {}) {
  const projects: ProjectRecord[] = []
  const assets: AssetRecord[] = [...(options.assets ?? [])]
  const tasks: TaskRecord[] = [...(options.tasks ?? [])]
  const resources: ResourceRecord[] = []
  const calls: string[] = []
  let counter = 0
  const api: WorkbenchApi = {
    health: async () => {
      calls.push('health')
      if (options.failHealth !== undefined) throw new Error(options.failHealth)
      return HEALTH
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
  return { api, calls, projects, assets, tasks, resources }
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
    expect(await screen.findByText(/host said no/)).toBeTruthy()
  })
})
