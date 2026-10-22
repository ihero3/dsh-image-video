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

  it('reorders with the move buttons and with drag-and-drop', async () => {
    const { view, spy } = renderWithImages(3)
    await addReference(view, 0)
    await addReference(view, 1)
    await addReference(view, 2)

    // 键盘/按钮排序：第二枚前移 → 变成首位（底图）
    fireEvent.click(screen.getByRole('button', { name: `${en.generateRefsMoveUp} ref-1.png` }))
    await waitFor(() => {
      const chips = view.container.querySelectorAll('[data-generate-ref]')
      expect(chips[0]!.getAttribute('data-generate-ref')).toBe('/tmp/outputs/ref-1.png')
    })

    // 拖拽排序：把第三枚拖到第一枚的位置
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
      images: ['/tmp/outputs/ref-2.png', '/tmp/outputs/ref-1.png', '/tmp/outputs/ref-0.png'],
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

  it('stops at six references and says so', async () => {
    const { host, view } = renderWithImages(7)
    for (let index = 0; index < 7; index += 1) {
      fireEvent.click(await screen.findByRole('button', { name: `${en.referenceAsset} ref-${index}.png` }))
    }
    // 第 7 张被拒：仍然 6 枚 chip，并给出提示
    await waitFor(() => { expect(view.container.querySelectorAll('[data-generate-ref]')).toHaveLength(6) })
    expect(screen.getByText(en.generateRefsFull)).toBeTruthy()
    expect(host.calls).toContain('assets/list')
  })
})
