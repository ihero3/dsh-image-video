// @vitest-environment jsdom
/**
 * `B-7`（F5）素材批量操作：多选 → 批量删除（`assets/remove-many`）/ 批量引用到提示词。
 *
 * 口径（A-2）：不存在的 id 与被引用的素材进 `skipped` 不中断整批；被引用的给
 * "仍要删除"二次确认（force）。批量引用按列表顺序进 F2 的参考图（封顶 6 张）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 带一个项目 + 3 个素材（其中 ast-2 被引用）的工作台。 */
function renderAssets() {
  const host = fakeApi({
    assets: [
      { schemaVersion: 4, id: 'ast-1', projectId: 'prj-1', kind: 'image', path: '/tmp/outputs/a.png', bytes: 2048, createdAt: '2026-10-21T00:00:00.000Z' },
      { schemaVersion: 4, id: 'ast-2', projectId: 'prj-1', kind: 'image', path: '/tmp/outputs/b.png', bytes: 2048, createdAt: '2026-10-21T00:00:00.000Z' },
      { schemaVersion: 4, id: 'ast-3', projectId: 'prj-1', kind: 'video', path: '/tmp/outputs/c.mp4', bytes: 4096, createdAt: '2026-10-21T00:00:00.000Z' },
    ] as never,
    referencedAssetIds: ['ast-2'],
  })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '批量操作',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 勾选/取消某个素材。 */
function toggleSelect(view: ReturnType<typeof render>, id: string): void {
  fireEvent.click(view.container.querySelector(`[data-asset-select="${id}"]`) as HTMLElement)
}

describe('B-7 bulk asset operations (F5)', () => {
  it('removes the selected assets in one remove-many call', async () => {
    const { host, view } = renderAssets()
    const spy = vi.spyOn(host.api, 'removeAssets')
    await waitFor(() => { expect(view.container.querySelectorAll('[data-asset-select]')).toHaveLength(3) })

    toggleSelect(view, 'ast-1')
    toggleSelect(view, 'ast-3')
    // 批量条出现并显示已选数量
    await waitFor(() => { expect(view.container.querySelector('[data-asset-bulk="true"]')?.textContent).toContain('2') })

    fireEvent.click(view.container.querySelector('[data-bulk-remove="true"]') as HTMLElement)
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    // 一次调用带全部 id；不带 force
    expect(spy.mock.calls[0]![0]).toMatchObject({ ids: ['ast-1', 'ast-3'] })
    expect(spy.mock.calls[0]![0]).not.toHaveProperty('force')
    // 两个都被删掉，剩下被引用的那个
    await waitFor(() => { expect(view.container.querySelectorAll('[data-asset-select]')).toHaveLength(1) })
    expect(host.assets.map(asset => asset.id)).toEqual(['ast-2'])
  })

  it('offers force delete when the host skips referenced assets', async () => {
    const { host, view } = renderAssets()
    const spy = vi.spyOn(host.api, 'removeAssets')
    await waitFor(() => { expect(view.container.querySelectorAll('[data-asset-select]')).toHaveLength(3) })

    toggleSelect(view, 'ast-1')
    toggleSelect(view, 'ast-2')
    fireEvent.click(view.container.querySelector('[data-bulk-remove="true"]') as HTMLElement)

    // ast-2 被引用进了 skipped；没删的留在选区，"仍要删除"出现
    await waitFor(() => { expect(view.container.querySelector('[data-bulk-force-remove="true"]')).toBeTruthy() })
    expect(view.container.querySelectorAll('[data-asset-select]')).toHaveLength(2)

    fireEvent.click(view.container.querySelector('[data-bulk-force-remove="true"]') as HTMLElement)
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(2) })
    expect(spy.mock.calls[1]![0]).toMatchObject({ ids: ['ast-2'], force: true })
    await waitFor(() => { expect(view.container.querySelectorAll('[data-asset-select]')).toHaveLength(1) })
  })

  it('references the selected images into the generate form in order', async () => {
    const { host, view } = renderAssets()
    const generateSpy = vi.fn(async () => ({ mediaMode: 'image' as const, path: '/tmp/outputs/gen.png', bytes: 1 }))
    ;(host.api as unknown as { generateMedia: typeof generateSpy }).generateMedia = generateSpy
    await waitFor(() => { expect(view.container.querySelectorAll('[data-asset-select]')).toHaveLength(3) })

    toggleSelect(view, 'ast-1')
    toggleSelect(view, 'ast-2')
    toggleSelect(view, 'ast-3') // 视频不该进参考图
    fireEvent.click(view.container.querySelector('[data-bulk-reference="true"]') as HTMLElement)

    // 只有图片进了参考图列表，且按素材列表顺序（a → b）
    await waitFor(() => {
      const chips = view.container.querySelectorAll('[data-generate-ref]')
      expect(chips).toHaveLength(2)
      expect(chips[0]!.getAttribute('data-generate-ref')).toBe('/tmp/outputs/a.png')
      expect(chips[1]!.getAttribute('data-generate-ref')).toBe('/tmp/outputs/b.png')
    })

    // 带进生成表单后直接出图：images 按序
    fireEvent.change(await screen.findByPlaceholderText(en.generatePromptPlaceholder), { target: { value: '同一个角色' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateImage }))
    await waitFor(() => { expect(generateSpy).toHaveBeenCalledTimes(1) })
    expect(generateSpy.mock.calls[0]![0]).toMatchObject({
      images: ['/tmp/outputs/a.png', '/tmp/outputs/b.png'],
    })
  })

  it('clears the selection without touching the assets', async () => {
    const { view } = renderAssets()
    await waitFor(() => { expect(view.container.querySelectorAll('[data-asset-select]')).toHaveLength(3) })
    toggleSelect(view, 'ast-1')
    await waitFor(() => { expect(view.container.querySelector('[data-asset-bulk="true"]')).toBeTruthy() })

    fireEvent.click(view.container.querySelector('[data-asset-bulk="true"] button:last-child') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-asset-bulk="true"]')).toBeNull() })
    expect(view.container.querySelectorAll('[data-asset-select]')).toHaveLength(3)
  })
})
