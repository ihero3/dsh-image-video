// @vitest-environment jsdom
/**
 * `F2` 多参考图选择器（Track B / B-1）：素材多选（≤6）→ `media/generate` 的 `images[]`。
 *
 * 口径（与工具侧 generate-image 对齐）：
 * - 首图 = 底图，其余 = 风格/脸部参考，**顺序即语义**；
 * - 只有 1 张时沿用单图字段 `image`（工具侧 image 优先于 images，两个一起发会互相盖）；
 * - 排序可拖拽也可键盘（前移/后移按钮），封顶 6 张。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 假的 dataTransfer（与时间轴拖拽测试同一套桩）。 */
function fakeDataTransfer() {
  const store = new Map<string, string>()
  return {
    types: [] as string[],
    effectAllowed: 'uninitialized',
    setData(type: string, value: string) { store.set(type, value); this.types.push(type) },
    getData(type: string) { return store.get(type) ?? '' },
  }
}

/** 带一个项目 + N 张图片素材的工作台。 */
function renderWithImages(count: number) {
  const host = fakeApi({})
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '参考图项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  for (let index = 0; index < count; index += 1) {
    host.assets.push({
      schemaVersion: 4, id: `ast-${index}`, projectId: 'prj-1', kind: 'image',
      path: `/tmp/outputs/ref-${index}.png`, bytes: 2048, createdAt: '2026-10-21T00:00:00.000Z',
    } as never)
  }
  const spy = vi.fn(async () => ({ mediaMode: 'image' as const, path: '/tmp/outputs/gen.png', bytes: 1 }))
  ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view, spy }
}

/** 点素材行上的「引用到提示词」把素材追加进参考图列表。 */
async function addReference(view: ReturnType<typeof render>, index: number): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: `${en.referenceAsset} ref-${index}.png` }))
}


/**
 * 只在**可见提示条**里查文案。
 *
 * Round 6 加了常驻 live region（`data-live-region`）用于读屏播报，它渲染的文本与可见
 * 提示条相同——`getByText` 会同时命中两处而抛 "Found multiple elements"。
 * 这里用 CSS 限定到可见提示条，测的仍是用户能看到的那条。
 */
const noticeText = (): string => {
  const node = document.querySelector('.iv-notice')
  return node?.textContent ?? ''
}

describe('F2 multi-reference selector (B-1)', () => {
  it('sends several references as an ordered images array', async () => {
    const { view, spy } = renderWithImages(3)
    await addReference(view, 0)
    await addReference(view, 1)
    await addReference(view, 2)

    // 三枚 chip，按点击顺序排列；第一枚标"底图"，其余标"参考"
    const chips = view.container.querySelectorAll('[data-generate-ref]')
    expect(chips).toHaveLength(3)
    expect(chips[0]!.getAttribute('data-generate-ref')).toBe('/tmp/outputs/ref-0.png')
    expect(chips[1]!.getAttribute('data-generate-ref')).toBe('/tmp/outputs/ref-1.png')
    expect(chips[2]!.getAttribute('data-generate-ref')).toBe('/tmp/outputs/ref-2.png')

    fireEvent.change(await screen.findByPlaceholderText(en.generatePromptPlaceholder), { target: { value: '同一角色的三个镜头' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateImage }))
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    // 按序下发；且不再发单图 image（会盖掉整组）
    expect(spy.mock.calls[0]![0]).toMatchObject({
      mediaMode: 'image',
      images: ['/tmp/outputs/ref-0.png', '/tmp/outputs/ref-1.png', '/tmp/outputs/ref-2.png'],
    })
    expect(spy.mock.calls[0]![0]).not.toHaveProperty('image')
  })

  it('keeps the single-reference path on the image field (A151 compatible)', async () => {
    const { view, spy } = renderWithImages(2)
    await addReference(view, 1)

    fireEvent.change(await screen.findByPlaceholderText(en.generatePromptPlaceholder), { target: { value: '侧脸' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateImage }))
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    expect(spy.mock.calls[0]![0]).toMatchObject({ mediaMode: 'image', image: '/tmp/outputs/ref-1.png' })
    expect(spy.mock.calls[0]![0]).not.toHaveProperty('images')
  })

  it('reorders with drag-and-drop (v1.2: move buttons removed)', async () => {
    const { view, spy } = renderWithImages(3)
    await addReference(view, 0)
    await addReference(view, 1)
    await addReference(view, 2)

    // 拖拽排序：把第三枚拖到第一枚的位置。上移/下移按钮已移除，拖拽是唯一排序入口
    const transfer = fakeDataTransfer()
    const chips = view.container.querySelectorAll('[data-generate-ref]')
    fireEvent.dragStart(chips[2]!, { dataTransfer: transfer })
    fireEvent.dragOver(chips[0]!, { dataTransfer: transfer })
    fireEvent.drop(chips[0]!, { dataTransfer: transfer })
    await waitFor(() => {
      const after = view.container.querySelectorAll('[data-generate-ref]')
      expect(after[0]!.getAttribute('data-generate-ref')).toBe('/tmp/outputs/ref-2.png')
    })

    fireEvent.change(await screen.findByPlaceholderText(en.generatePromptPlaceholder), { target: { value: '排序后生成' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateImage }))
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    expect(spy.mock.calls[0]![0]).toMatchObject({
      images: ['/tmp/outputs/ref-2.png', '/tmp/outputs/ref-0.png', '/tmp/outputs/ref-1.png'],
    })
  })

  it('removes one chip and clears the whole list', async () => {
    const { view } = renderWithImages(2)
    await addReference(view, 0)
    await addReference(view, 1)
    expect(view.container.querySelectorAll('[data-generate-ref]')).toHaveLength(2)

    fireEvent.click(view.container.querySelector('[data-generate-ref-remove="/tmp/outputs/ref-0.png"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-generate-ref]')).toHaveLength(1) })

    fireEvent.click(screen.getByRole('button', { name: en.generateClearReference }))
    await waitFor(() => { expect(view.container.querySelectorAll('[data-generate-ref]')).toHaveLength(0) })
  })

  it('stops at eight references and says so (2026-11-05 上限 6 → 8)', async () => {
    const { host, view } = renderWithImages(9)
    for (let index = 0; index < 9; index += 1) {
      fireEvent.click(await screen.findByRole('button', { name: `${en.referenceAsset} ref-${index}.png` }))
    }
    // 第 9 张被拒：仍然 8 枚 chip，并给出提示
    await waitFor(() => { expect(view.container.querySelectorAll('[data-generate-ref]')).toHaveLength(8) })
    expect(noticeText()).toContain(en.generateRefsFull)
    expect(host.calls).toContain('assets/list')
  })

  it('picks from a first-image + name list, and keeps the panel open for more', async () => {
    const { view } = renderWithImages(2)
    fireEvent.click(view.container.querySelector('[data-generate-refs-pick="true"]') as HTMLElement)
    const panel = await waitFor(() => {
      const node = view.container.querySelector('[data-ref-picker="refs"]')
      if (node === null) throw new Error('missing reference picker')
      return node as HTMLElement
    })

    // 每行都是「首图 + 名称」：缩略图指向产物，名称与文件名一致
    const row = panel.querySelector('[data-ref-option="asset:ast-1"]') as HTMLElement
    expect(row.querySelector('img')?.getAttribute('src')).toContain('ref-1.png')
    expect(row.textContent).toContain('ref-1.png')

    fireEvent.click(row)
    await waitFor(() => { expect(view.container.querySelector('[data-generate-ref="/tmp/outputs/ref-1.png"]')).toBeTruthy() })
    // 多选面板不关闭：连续添加时不用重新打开
    expect(view.container.querySelector('[data-ref-picker="refs"]')).toBeTruthy()
    expect(row.textContent).toContain(en.refPickerAdded)

    // 搜索按名称过滤
    fireEvent.change(panel.querySelector('[data-ref-picker-search="refs"]') as HTMLInputElement, {
      target: { value: 'ref-0' },
    })
    expect(panel.querySelector('[data-ref-option="asset:ast-0"]')).toBeTruthy()
    expect(panel.querySelector('[data-ref-option="asset:ast-1"]')).toBeNull()
  })

  it('offers a resource’s first reference image with the resource name', async () => {
    const { host, view } = renderWithImages(0)
    host.resources.push({
      schemaVersion: 1, id: 'res-role', projectId: 'prj-1', kind: 'role', name: '林萧',
      scope: 'project', assetPaths: ['/tmp/outputs/face.png'],
      createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
    } as never)

    fireEvent.click(view.container.querySelector('[data-generate-refs-pick="true"]') as HTMLElement)
    const row = await waitFor(() => {
      const node = view.container.querySelector('[data-ref-option="resource:res-role"]')
      if (node === null) throw new Error('missing resource row')
      return node as HTMLElement
    })
    expect(row.textContent).toContain('林萧')
    // 元信息给的是资源类型；首图取该资源的第一张参考图
    expect(row.textContent).toContain(en.kindRole)
    fireEvent.click(row)
    await waitFor(() => { expect(view.container.querySelector('[data-generate-ref="/tmp/outputs/face.png"]')).toBeTruthy() })
  })

  it('lists series resources before the asset library and floats the panel', async () => {
    const { host, view } = renderWithImages(1)
    host.resources.push({
      schemaVersion: 1, id: 'res-scene', projectId: 'prj-1', kind: 'scene', name: '天台',
      scope: 'project', assetPaths: ['/tmp/outputs/roof.png'],
      createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
    } as never)

    fireEvent.click(view.container.querySelector('[data-generate-refs-pick="true"]') as HTMLElement)
    const panel = await waitFor(() => {
      const node = view.container.querySelector('[data-ref-picker="refs"]')
      if (node === null) throw new Error('missing reference picker')
      return node as HTMLElement
    })
    const titles = Array.from(panel.querySelectorAll('.iv-pop-group-title')).map(node => node.textContent)
    expect(titles).toEqual([en.refPickerResources, en.refPickerAssets])
    // 固定定位：不再被右侧栏的滚动容器裁掉
    expect(panel.style.position).toBe('fixed')
  })

  it('accepts a resource dragged from the series resource panel', async () => {
    const { host, view } = renderWithImages(0)
    host.resources.push({
      schemaVersion: 1, id: 'res-role', projectId: 'prj-1', kind: 'role', name: '林萧',
      scope: 'project', assetPaths: ['/tmp/outputs/face.png'],
      createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
    } as never)
    const row = await waitFor(() => {
      const node = view.container.querySelector('[data-resource-row="res-role"]')
      if (node === null) throw new Error('missing resource row')
      return node as HTMLElement
    })

    const transfer = fakeDataTransfer()
    fireEvent.dragStart(row, { dataTransfer: transfer })
    const zone = view.container.querySelector('[data-generate-refs]') as HTMLElement
    fireEvent.dragOver(zone, { dataTransfer: transfer })
    fireEvent.drop(zone, { dataTransfer: transfer })
    await waitFor(() => { expect(view.container.querySelector('[data-generate-ref="/tmp/outputs/face.png"]')).toBeTruthy() })
  })

  it('keeps the add cell inside the grid and builds thumb URLs from Windows paths', async () => {
    const path = 'D:\\apps\\desktop\\home\\profiles\\desktop\\outputs\\shot-2026.png'
    const host = fakeApi({})
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: 'Windows 路径',
      createdAt: '2026-11-26T00:00:00.000Z', updatedAt: '2026-11-26T00:00:00.000Z',
    })
    host.assets.push({
      schemaVersion: 4, id: 'ast-win', projectId: 'prj-1', kind: 'image',
      path, bytes: 2048, createdAt: '2026-11-26T00:00:00.000Z',
    } as never)
    const view = render(<Workbench {...clientProps({ api: host.api })} />)

    // 添加入口必须留在网格里：放到网格外会被 aspect-ratio 撑成整行高的空白框
    expect(view.container.querySelector('.iv-ref-grid .iv-ref-add-cell')).toBeTruthy()

    fireEvent.click(await screen.findByRole('button', { name: `${en.referenceAsset} shot-2026.png` }))
    const thumb = await waitFor(() => {
      const node = view.container.querySelector('[data-generate-ref] .iv-ref-thumb')
      if (node === null) throw new Error('missing reference thumb')
      return node as HTMLImageElement
    })
    expect(thumb.getAttribute('src')).toBe('/outputs/shot-2026.png')
  })
})
