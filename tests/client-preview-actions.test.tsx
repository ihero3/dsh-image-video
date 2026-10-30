// @vitest-environment jsdom
/**
 * `T7` 预览面板「送到生成位」：省掉「回素材区选中 → 回上方面板」的往返。
 *
 * 断言：
 * 1. 预览图片时出现「设为参考」「设为尾帧」两个动作（视频不出现这两个）；
 * 2. 点「设为参考」→ 进入参考图 chips；
 * 3. 点「设为尾帧」→ 视频槽的尾帧就位；
 * 4. 预览视频时出现「设为参考视频」→ 参考视频槽就位。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const img = (id: string, path: string) => ({
  schemaVersion: 4, id, projectId: 'prj-1', kind: 'image' as const, path, bytes: 100,
  createdAt: '2026-10-01T00:00:00.000Z',
})
const vid = (id: string, path: string) => ({
  schemaVersion: 4, id, projectId: 'prj-1', kind: 'video' as const, path, bytes: 200,
  createdAt: '2026-10-02T00:00:00.000Z',
})

function renderWith(assets: ReturnType<typeof img>[]) {
  const host = fakeApi({ assets })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '预览项目',
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 在素材区点某一条 → 预览面板出现该素材。 */
async function preview(container: HTMLElement, fileName: string) {
  // 点素材行的「预览」按钮（aria-label = "<Preview> <文件名>"），而不是多选 checkbox。
  // 必须先等素材行渲染（VirtualList 异步挂载），否则拿到空列表。
  const find = () => Array.from(container.querySelectorAll('.iv-row-btn'))
    .find(node => (node.getAttribute('aria-label') ?? '').includes(fileName))
  await waitFor(() => { expect(find(), `没找到 ${fileName} 的预览按钮`).toBeTruthy() })
  fireEvent.click(find() as HTMLElement)
  await waitFor(() => { expect(container.querySelector('[data-preview-actions]')).toBeTruthy() })
}

describe('预览送参考位（T7）', () => {
  it('预览图片显示「设为参考 / 设为尾帧」', async () => {
    const { view } = renderWith([img('a1', '/tmp/outputs/pic.png')])
    await preview(view.container, 'pic.png')
    const actions = view.container.querySelector('[data-preview-actions]') as HTMLElement
    expect(actions.getAttribute('data-preview-actions')).toBe('image')
    expect(actions.querySelector('[data-preview-send="reference"]')).toBeTruthy()
    expect(actions.querySelector('[data-preview-send="last-frame"]')).toBeTruthy()
    expect(actions.querySelector('[data-preview-send="reference-video"]')).toBeNull()
  })

  it('「设为参考」把图加进参考 chips', async () => {
    const { view } = renderWith([img('a1', '/tmp/outputs/pic.png')])
    await preview(view.container, 'pic.png')
    fireEvent.click(view.container.querySelector('[data-preview-send="reference"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-generate-ref="/tmp/outputs/pic.png"]')).toBeTruthy()
    })
  })

  it('「设为尾帧」让尾帧槽就位', async () => {
    const { view } = renderWith([img('a1', '/tmp/outputs/pic.png')])
    await preview(view.container, 'pic.png')
    fireEvent.click(view.container.querySelector('[data-preview-send="last-frame"]') as HTMLElement)
    await waitFor(() => {
      expect(document.querySelector('.iv-notice')?.textContent ?? '').toContain(en.previewSentLastFrame)
    })
    // 尾帧槽显示该文件名
    const slots = view.container.querySelector('[data-video-slots]') as HTMLElement
    expect(slots.textContent).toContain('pic.png')
  })

  it('预览视频只显示「设为参考视频」', async () => {
    const { view } = renderWith([vid('v1', '/tmp/outputs/clip.mp4')])
    await preview(view.container, 'clip.mp4')
    const actions = view.container.querySelector('[data-preview-actions]') as HTMLElement
    expect(actions.getAttribute('data-preview-actions')).toBe('video')
    expect(actions.querySelector('[data-preview-send="reference-video"]')).toBeTruthy()
    expect(actions.querySelector('[data-preview-send="reference"]')).toBeNull()
    fireEvent.click(actions.querySelector('[data-preview-send="reference-video"]') as HTMLElement)
    await waitFor(() => {
      expect(document.querySelector('.iv-notice')?.textContent ?? '').toContain(en.previewSentReferenceVideo)
    })
  })
})
