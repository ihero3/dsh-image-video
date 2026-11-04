// @vitest-environment jsdom
/**
 * 资源面板「方案 B」简化（2026-11-04）：
 *
 * 用户要的是"先能看懂、再用得深"。所以：
 * - 每行默认只留 **缩略图 + 名称（含参考图张数）+ `+`挂图 + 详情**；
 *   使用记录 / 编辑 / 参考图 / 删除都收进「详情」（默认 `hidden`，不可见也不可聚焦）。
 * - 分类 + 重绘计划属高级功能，**默认不渲染**，点「高级：分类与重绘计划」才展开。
 * - 类型分栏只留 角色 / 场景 / 道具，其余进「更多类型」。
 * - 新建只要求名称，定妆照可后补（给一句提示，别让新手以为必须先选图）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'
import type { ResourceRecord } from '../src/workbench/records.ts'

afterEach(cleanup)

/** 挂载并等资源行出现。 */
async function renderResources() {
  const host = fakeApi()
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '测试剧',
    createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z',
  } as never)
  host.resources.push({
    schemaVersion: 1, id: 'res-1', projectId: 'prj-1', kind: 'role', name: '女主', scope: 'project',
    createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z',
    assetPaths: ['/tmp/outputs/a.png'],
  } as unknown as ResourceRecord)
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  await waitFor(() => { expect(view.container.querySelector('[data-resource-row="res-1"]')).toBeTruthy() })
  return { host, view }
}

describe('资源面板简化（方案 B）', () => {
  it('keeps secondary actions hidden until 详情 is opened', async () => {
    const { view } = await renderResources()
    const hiddenOf = (selector: string): boolean =>
      (view.container.querySelector(selector) as HTMLElement).hasAttribute('hidden')

    // 默认：编辑 / 参考图 / 使用记录都不可见
    expect(hiddenOf('[data-resource-edit="res-1"]')).toBe(true)
    expect(hiddenOf('[data-resource-refs-manage="res-1"]')).toBe(true)
    expect(hiddenOf('[data-resource-usage="res-1"]')).toBe(true)
    // 「+挂图」和「详情」始终可见（主路径只需要这两个）
    expect(hiddenOf('[data-resource-attach="res-1"]')).toBe(false)
    expect(hiddenOf('[data-resource-expand="res-1"]')).toBe(false)

    // 展开后：三样都出来，按钮 aria-expanded 跟上
    fireEvent.click(view.container.querySelector('[data-resource-expand="res-1"]') as HTMLElement)
    await waitFor(() => { expect(hiddenOf('[data-resource-edit="res-1"]')).toBe(false) })
    expect(hiddenOf('[data-resource-refs-manage="res-1"]')).toBe(false)
    expect(hiddenOf('[data-resource-usage="res-1"]')).toBe(false)
    expect(view.container.querySelector('[data-resource-expand="res-1"]')?.getAttribute('aria-expanded')).toBe('true')
  })

  it('shows the reference count on the row, so the thumbnail is not the only signal', async () => {
    const { view } = await renderResources()
    const row = view.container.querySelector('[data-resource-row="res-1"]') as HTMLElement
    expect(row.textContent).toContain(en.resourceRefsCount.replace('{n}', '1'))
  })

  it('keeps folders & redraw plan behind an advanced toggle (off by default)', async () => {
    const { view } = await renderResources()
    const toggle = view.container.querySelector('[data-resource-folders-toggle]') as HTMLElement
    expect(toggle).toBeTruthy()
    expect(toggle.textContent).toContain(en.resourceFoldersAdvanced)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    // 默认不渲染分类/重绘计划面板（新手第一眼看不到这块高级功能）
    expect(view.container.querySelector('[data-res-folders]')).toBeNull()
    fireEvent.click(toggle)
    await waitFor(() => { expect(toggle.getAttribute('aria-expanded')).toBe('true') })
    expect(view.container.querySelector('[data-res-folders]')).toBeTruthy()
  })

  it('names the extra kinds 更多类型 and tells the user a name is enough', async () => {
    const { view } = await renderResources()
    expect(en.resourceTabOther).toBe('More types')
    expect(view.container.querySelector('[data-resource-create-hint]')?.textContent).toBe(en.resourceCreateHint)
  })
})
