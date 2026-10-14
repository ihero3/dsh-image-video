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
import type { AssetRecord, ProjectRecord } from '../src/workbench/records.ts'
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
function fakeApi(options: { failHealth?: string } = {}) {
  const projects: ProjectRecord[] = []
  const assets: AssetRecord[] = []
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
      counter += 1
      const asset: AssetRecord = {
        schemaVersion: 1, id: `ast-${counter}`, projectId: input.projectId, kind: input.kind,
        path: input.path, bytes: input.bytes ?? 0, createdAt: `2026-10-14T01:00:0${counter}.000Z`,
      }
      assets.push(asset)
      return asset
    },
    removeAsset: async (id) => {
      calls.push('assets/remove')
      const index = assets.findIndex(asset => asset.id === id)
      if (index < 0) return false
      assets.splice(index, 1)
      return true
    },
    listOutputs: async () => { calls.push('outputs/list'); return [OUTPUT_IMAGE, OUTPUT_VIDEO] },
  }
  return { api, calls, projects, assets }
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
    expect(view.container.querySelector('[data-workbench-pane=paneTasks]')?.getAttribute('data-workbench-planned')).toBe('true')
    expect(screen.getAllByText(en.panePlanned)).toHaveLength(2)
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
