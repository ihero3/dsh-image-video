// @vitest-environment jsdom
/**
 * `G2` 物料库分栏（Track B / B-4）：创作资源面板拆成 角色/场景/物品 三栏
 * （+「其他」下拉），显示参考图缩略图，支持按名筛选。
 *
 * 数据口径：`resources/list?kind=` 宿主支持，面板一次取全量再本地过滤——
 * 切栏/改筛选零请求、零闪烁。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 造一条资源记录。 */
function resource(id: string, kind: 'role' | 'scene' | 'prop' | 'voice', name: string, assetPath?: string) {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', kind, name, scope: 'project',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
    ...assetPath === undefined ? {} : { assetPath },
  }
}

/** 带三类资源 + 一张带参考图的角色资源的工作台。 */
function renderResources() {
  const host = fakeApi({})
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '物料项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  host.resources.push(
    resource('res-r1', 'role', '林萧', '/tmp/outputs/linxiao.png'),
    resource('res-r2', 'role', '苏晚'),
    resource('res-s1', 'scene', '雨夜街道'),
    resource('res-p1', 'prop', '旧相机'),
    resource('res-v1', 'voice', '低沉男声'),
  )
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 资源面板里当前可见的资源名。 */
function visibleResourceNames(view: ReturnType<typeof render>): string[] {
  const pane = view.container.querySelector('[data-workbench-pane="paneResources"]') as HTMLElement
  return [...pane.querySelectorAll('.iv-row-main')].map(row => row.textContent ?? '')
}

describe('G2 resource library columns (B-4)', () => {
  it('splits the panel into role / scene / prop columns and switches between them', async () => {
    const { view } = renderResources()

    // 三个常驻栏 + 「其他」下拉
    for (const kind of ['role', 'scene', 'prop']) {
      expect(view.container.querySelector(`[data-resource-tab="${kind}"]`)).toBeTruthy()
    }
    expect(view.container.querySelector('[data-resource-tab="other"]')).toBeTruthy()

    // 默认停在角色栏：只看得到角色
    await waitFor(() => {
      const names = visibleResourceNames(view)
      expect(names.join('|')).toContain('林萧')
      expect(names.join('|')).toContain('苏晚')
      expect(names.join('|')).not.toContain('雨夜街道')
    })
    expect(view.container.querySelector('[data-resource-tab="role"]')?.getAttribute('aria-selected')).toBe('true')

    // 切到场景栏：角色藏起，场景出现
    fireEvent.click(view.container.querySelector('[data-resource-tab="scene"]') as HTMLElement)
    await waitFor(() => {
      const names = visibleResourceNames(view).join('|')
      expect(names).toContain('雨夜街道')
      expect(names).not.toContain('林萧')
    })

    // 切到物品栏
    fireEvent.click(view.container.querySelector('[data-resource-tab="prop"]') as HTMLElement)
    await waitFor(() => {
      const names = visibleResourceNames(view).join('|')
      expect(names).toContain('旧相机')
      expect(names).not.toContain('雨夜街道')
    })
  })

  it('reaches the remaining kinds through the other dropdown', async () => {
    const { view } = renderResources()
    const other = view.container.querySelector('[data-resource-tab="other"]') as HTMLSelectElement
    fireEvent.change(other, { target: { value: 'voice' } })
    await waitFor(() => {
      const names = visibleResourceNames(view).join('|')
      expect(names).toContain('低沉男声')
      expect(names).not.toContain('林萧')
    })
  })

  it('filters the active column by name', async () => {
    const { view } = renderResources()
    await waitFor(() => { expect(visibleResourceNames(view).length).toBe(2) })

    fireEvent.change(view.container.querySelector('[data-resource-filter]') as HTMLElement, { target: { value: '苏晚' } })
    await waitFor(() => {
      const names = visibleResourceNames(view)
      expect(names).toHaveLength(1)
      expect(names[0]).toContain('苏晚')
    })

    // 换栏时筛选清空，不会把上一条的过滤条件带到新栏
    fireEvent.change(view.container.querySelector('[data-resource-filter]') as HTMLElement, { target: { value: '' } })
    fireEvent.click(view.container.querySelector('[data-resource-tab="scene"]') as HTMLElement)
    await waitFor(() => { expect(visibleResourceNames(view).join('|')).toContain('雨夜街道') })
  })

  it('shows the reference thumbnail and files new resources into the active column', async () => {
    const { host, view } = renderResources()
    const createSpy = vi.spyOn(host.api, 'createResource')
    await waitFor(() => { expect(visibleResourceNames(view).length).toBe(2) })

    // 参考图缩略图：src 指向 /outputs/<文件名>
    const thumb = view.container.querySelector('[data-workbench-pane="paneResources"] img.iv-thumb') as HTMLImageElement
    expect(thumb.getAttribute('src')).toBe('/outputs/linxiao.png')

    // 在角色栏新建 → createResource 收到 kind='role'
    fireEvent.change(screen.getByPlaceholderText(en.resourceNamePlaceholder), { target: { value: '新角色' } })
    fireEvent.click(screen.getByRole('button', { name: en.addResource }))
    await waitFor(() => { expect(host.calls).toContain('resources/create') })

    // 切到场景栏再新建 → kind='scene'
    fireEvent.click(view.container.querySelector('[data-resource-tab="scene"]') as HTMLElement)
    fireEvent.change(screen.getByPlaceholderText(en.resourceNamePlaceholder), { target: { value: '新场景' } })
    fireEvent.click(screen.getByRole('button', { name: en.addResource }))
    await waitFor(() => { expect(host.calls.filter(call => call === 'resources/create').length).toBe(2) })

    expect(createSpy.mock.calls[0]![0]).toMatchObject({ kind: 'role', name: '新角色' })
    expect(createSpy.mock.calls[1]![0]).toMatchObject({ kind: 'scene', name: '新场景' })
  })
})
