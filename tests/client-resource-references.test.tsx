// @vitest-environment jsdom
/**
 * `B-8`（F6）资源资料库：资源可挂多张参考图（`assetPaths[]`）、把选中素材归到该资源、
 * 行内管理（增/删/清）。旧数据只有 `assetPath`，读时合并不丢。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 造一条资源记录。 */
function resource(id: string, kind: 'role' | 'scene', name: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', kind, name, scope: 'project',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
    ...extra,
  }
}

/** 一个项目 + 两张图片素材 + 角色「林萧」（旧数据：只有 assetPath 一张参考图）。 */
function renderResources() {
  const host = fakeApi({
    assets: [
      { schemaVersion: 4, id: 'ast-1', projectId: 'prj-1', kind: 'image', path: '/tmp/outputs/face-a.png', bytes: 2048, createdAt: '2026-10-21T00:00:00.000Z' },
      { schemaVersion: 4, id: 'ast-2', projectId: 'prj-1', kind: 'image', path: '/tmp/outputs/face-b.png', bytes: 2048, createdAt: '2026-10-21T00:00:00.000Z' },
    ] as never,
  })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '资料库',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  host.resources.push(resource('res-1', 'role', '林萧', { assetPath: '/tmp/outputs/face-a.png' }))
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 选中某张素材（点素材行主按钮）。 */
async function selectAsset(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: `${en.panePreview} ${name}` }))
}

describe('B-8 resource references (F6)', () => {
  it('merges the legacy single assetPath into the reference list', async () => {
    const { view } = renderResources()
    await waitFor(() => {
      expect(view.container.querySelector('[data-resource-usage="res-1"]')).toBeTruthy()
    })
    // 旧数据一张参考图：有缩略图、无 "+n" 角标
    const pane = view.container.querySelector('[data-workbench-pane="paneResources"]') as HTMLElement
    const thumb = pane.querySelector('img.iv-thumb') as HTMLImageElement
    expect(thumb.getAttribute('src')).toBe('/outputs/face-a.png')
    expect(pane.querySelector('.iv-thumb-more')).toBeNull()

    // 打开行内编辑器：合并视图里就是那一张
    fireEvent.click(pane.querySelector('[data-resource-refs-manage="res-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-resource-refs-editor="res-1"]')).toBeTruthy() })
    expect(view.container.querySelectorAll('[data-resource-ref]')).toHaveLength(1)
  })

  it('attaches the selected asset to a resource through assetPaths', async () => {
    const { host, view } = renderResources()
    const spy = vi.spyOn(host.api, 'updateResource')
    await waitFor(() => {
      expect(view.container.querySelector('[data-resource-attach="res-1"]')).toBeTruthy()
    })

    // 选中第二张图 → 点资源行的「挂选中素材」
    await selectAsset('face-b.png')
    fireEvent.click(view.container.querySelector('[data-resource-attach="res-1"]') as HTMLElement)
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    // 整组替换语义：旧图在前（底图），新图追加
    expect(spy.mock.calls[0]![0]).toMatchObject({
      id: 'res-1',
      assetPaths: ['/tmp/outputs/face-a.png', '/tmp/outputs/face-b.png'],
    })

    // 行内出现 "+1" 角标（两张参考图）
    await waitFor(() => {
      const pane = view.container.querySelector('[data-workbench-pane="paneResources"]') as HTMLElement
      expect(pane.querySelector('.iv-thumb-more')?.textContent).toBe('+1')
    })
  })

  it('adds and removes references in the inline editor', async () => {
    const { host, view } = renderResources()
    const spy = vi.spyOn(host.api, 'updateResource')
    await waitFor(() => {
      expect(view.container.querySelector('[data-resource-refs-manage="res-1"]')).toBeTruthy()
    })
    fireEvent.click(view.container.querySelector('[data-resource-refs-manage="res-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-resource-refs-editor="res-1"]')).toBeTruthy() })

    // 编辑器里「挂选中素材」再添一张
    await selectAsset('face-b.png')
    fireEvent.click(view.container.querySelector('[data-resource-refs-add="true"]') as HTMLElement)
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    expect(spy.mock.calls[0]![0]).toMatchObject({
      assetPaths: ['/tmp/outputs/face-a.png', '/tmp/outputs/face-b.png'],
    })
    await waitFor(() => { expect(view.container.querySelectorAll('[data-resource-ref]')).toHaveLength(2) })

    // 已挂上的素材：编辑器「挂选中素材」与行内「挂选中素材」都禁用（UI 护栏，
    // 处理器里的重复提示是竞态兜底，正常路径点不到）
    await waitFor(() => { expect(view.container.querySelectorAll('[data-resource-ref]')).toHaveLength(2) })
    const addButton = view.container.querySelector('[data-resource-refs-add="true"]') as HTMLButtonElement
    expect(addButton.disabled).toBe(true)
    expect(view.container.querySelector('[data-resource-attach="res-1"]')?.hasAttribute('disabled')).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)

    // 摘掉第一张 → 只剩第二张
    fireEvent.click(view.container.querySelector('[data-resource-ref-remove="/tmp/outputs/face-a.png"]') as HTMLElement)
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(2) })
    expect(spy.mock.calls[1]![0]).toMatchObject({ assetPaths: ['/tmp/outputs/face-b.png'] })
    await waitFor(() => { expect(view.container.querySelectorAll('[data-resource-ref]')).toHaveLength(1) })
  })

  it('clears every reference including the legacy field', async () => {
    const { host, view } = renderResources()
    const spy = vi.spyOn(host.api, 'updateResource')
    await waitFor(() => {
      expect(view.container.querySelector('[data-resource-refs-manage="res-1"]')).toBeTruthy()
    })
    fireEvent.click(view.container.querySelector('[data-resource-refs-manage="res-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-resource-refs-clear="true"]')).toBeTruthy() })

    fireEvent.click(view.container.querySelector('[data-resource-refs-clear="true"]') as HTMLElement)
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    // 两个字段都清：只清 assetPaths 的话，合并视图还会显示旧 assetPath
    expect(spy.mock.calls[0]![0]).toMatchObject({ id: 'res-1', assetPaths: null, assetPath: null })
    await waitFor(() => { expect(view.container.querySelectorAll('[data-resource-ref]')).toHaveLength(0) })
  })
})
