// @vitest-environment jsdom
/**
 * `G4` 首尾帧 / 视频编辑 UI 入口（Track B / B-3）：视频生成表单的「尾帧图」与
 * 「参考视频」两个可选槽 + 真人勾选，请求体带 `media[]` 与 `realPerson` 透传。
 *
 * 契约口径（与工具 generate-video 的 `media[]` 同构）：
 * - 尾帧图 → `{image, type:'last_frame'}`；参考视频 → `{video, type:'reference_video'}`；
 * - 有首帧参考时首帧也进 `media`（`{image, type:'first_frame'}`）——工具的
 *   `image` 字段在 `media` 存在时被忽略，不能只发 `image`；
 * - 真人勾选 → `realPerson: true` 透传。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 带一个项目 + 一张图 + 一个视频的工作台。 */
function renderQuick() {
  const host = fakeApi({
    assets: [
      { schemaVersion: 4, id: 'ast-img', projectId: 'prj-1', kind: 'image', path: '/tmp/outputs/portrait.png', bytes: 2048, createdAt: '2026-10-21T00:00:00.000Z' },
      { schemaVersion: 4, id: 'ast-vid', projectId: 'prj-1', kind: 'video', path: '/tmp/outputs/dance.mp4', bytes: 4096, createdAt: '2026-10-21T00:00:00.000Z' },
    ] as never,
  })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '视频项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const spy = vi.fn(async () => ({ mediaMode: 'video' as const, pending: true, taskId: 'tsk-edit-1' }))
  ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view, spy }
}

/** 选中某个素材（点素材行主按钮）。 */
async function selectAsset(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: `${en.panePreview} ${name}` }))
}

describe('G4 video edit slots (B-3)', () => {
  it('sends last frame and reference video as an ordered media array', async () => {
    const { view, spy } = renderQuick()

    // 尾帧槽：选中图片 → 「用选中素材」
    await selectAsset('portrait.png')
    fireEvent.click(view.container.querySelector('[data-video-last-frame-use]') as HTMLElement)
    // 参考视频槽：选中视频 → 「用选中素材」
    await selectAsset('dance.mp4')
    fireEvent.click(view.container.querySelector('[data-video-reference-use]') as HTMLElement)
    // 两个槽都亮出 chip
    await waitFor(() => {
      expect(view.container.querySelector('.iv-vslots')?.textContent).toContain('portrait.png')
      expect(view.container.querySelector('.iv-vslots')?.textContent).toContain('dance.mp4')
    })

    fireEvent.change(await screen.findByPlaceholderText(en.generatePromptPlaceholder), { target: { value: '把背景换成雪夜街道' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateVideo }))
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })

    const payload = spy.mock.calls[0]![0] as { media?: Array<Record<string, string>>; realPerson?: boolean }
    expect(payload.media).toEqual([
      { image: '/tmp/outputs/portrait.png', type: 'last_frame' },
      { video: '/tmp/outputs/dance.mp4', type: 'reference_video' },
    ])
    // 未勾真人 → 不透传 realPerson
    expect(payload.realPerson).toBeUndefined()
  })

  it('passes the real-person checkbox through', async () => {
    const { view, spy } = renderQuick()
    await selectAsset('dance.mp4')
    fireEvent.click(view.container.querySelector('[data-video-reference-use]') as HTMLElement)
    fireEvent.click(view.container.querySelector('[data-video-real-person]') as HTMLElement)

    fireEvent.change(await screen.findByPlaceholderText(en.generatePromptPlaceholder), { target: { value: '换一件风衣' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateVideo }))
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })

    const payload = spy.mock.calls[0]![0] as { media?: Array<Record<string, string>>; realPerson?: boolean }
    expect(payload.realPerson).toBe(true)
    expect(payload.media).toEqual([{ video: '/tmp/outputs/dance.mp4', type: 'reference_video' }])
  })

  it('keeps a first-frame reference inside media when both are set', async () => {
    const { view, spy } = renderQuick()
    // 首帧参考走 F2 的多参考图列表（第一张）
    fireEvent.click(await screen.findByRole('button', { name: `${en.referenceAsset} portrait.png` }))
    // 尾帧
    await selectAsset('portrait.png')
    fireEvent.click(view.container.querySelector('[data-video-last-frame-use]') as HTMLElement)

    fireEvent.change(await screen.findByPlaceholderText(en.generatePromptPlaceholder), { target: { value: '从笑到哭' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateVideo }))
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })

    const payload = spy.mock.calls[0]![0] as { media?: Array<Record<string, string>>; image?: string }
    // 首帧必须在 media 里（工具侧 media 存在时忽略 image），且不能再单发 image
    expect(payload.media).toEqual([
      { image: '/tmp/outputs/portrait.png', type: 'first_frame' },
      { image: '/tmp/outputs/portrait.png', type: 'last_frame' },
    ])
    expect(payload.image).toBeUndefined()
  })

  it('leaves plain video generation untouched when no slot is filled', async () => {
    const { spy } = renderQuick()
    fireEvent.change(await screen.findByPlaceholderText(en.generatePromptPlaceholder), { target: { value: '海面日落' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateVideo }))
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })

    const payload = spy.mock.calls[0]![0] as { media?: unknown; realPerson?: unknown }
    expect(payload.media).toBeUndefined()
    expect(payload.realPerson).toBeUndefined()
    // 仍然是非阻塞 + 绑定项目
    expect(spy.mock.calls[0]![0]).toMatchObject({ mediaMode: 'video', wait: false, projectId: 'prj-1' })
  })
})
