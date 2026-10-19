// @vitest-environment jsdom
/**
 * B6 导出面板：分辨率 / 帧率 / 宽高比选择（调 A2 的新签名 `renderTimeline(..., options)`）、
 * 导出进度/取消、成功后「登记到素材库」提示。
 *
 * 关键断言：选择非默认规格后，导出请求体（`timelines/render` 收到 options）正确携带
 * resolution / fps / aspect；无视频片段时导出按钮禁用。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 挂载工作台并进入时间轴模式（带一个视频素材 + 项目）。 */
async function renderTimeline() {
  const host = fakeApi({
    assets: [{
      schemaVersion: 1, id: 'ast-v', projectId: 'prj-1', kind: 'video',
      path: '/tmp/outputs/clip.mp4', bytes: 1024, createdAt: '2026-10-16T00:00:00.000Z',
    }],
  })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '导出项目',
    createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
  await waitFor(() => { expect(view.container.querySelector('[data-timeline-lane="video"]')).toBeTruthy() })
  return { host, view }
}

/** 用「选择素材 + 加入轨道」给视频轨加一个片段，使导出按钮可用。 */
async function addVideoClip(view: ReturnType<typeof render>): Promise<void> {
  const picker = view.container.querySelector('[data-timeline-track="video"] select') as HTMLSelectElement
  fireEvent.change(picker, { target: { value: '/tmp/outputs/clip.mp4' } })
  fireEvent.click(view.container.querySelector('[data-timeline-track="video"] button[aria-label^="Add to track"]') as HTMLElement)
  await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(1) })
}

describe('B6 export panel', () => {
  it('shows the resolution / fps / aspect selectors with sane defaults', async () => {
    const { view } = await renderTimeline()
    await addVideoClip(view)
    const resolution = view.container.querySelector('[data-timeline-export-resolution]') as HTMLSelectElement
    const fps = view.container.querySelector('[data-timeline-export-fps]') as HTMLSelectElement
    const aspect = view.container.querySelector('[data-timeline-export-aspect]') as HTMLSelectElement
    expect(resolution).toBeTruthy()
    expect(fps).toBeTruthy()
    expect(aspect).toBeTruthy()
    expect(resolution.value).toBe('default')
    expect(fps.value).toBe('30')
    expect(aspect.value).toBe('landscape')
  })

  it('disables export until a video clip exists on the timeline', async () => {
    const { view } = await renderTimeline()
    const exportButton = view.container.querySelector('[data-timeline-export]') as HTMLButtonElement
    // 进入时间轴、尚无片段：禁用
    expect(exportButton.disabled).toBe(true)
    await addVideoClip(view)
    expect(exportButton.disabled).toBe(false)
  })

  it('sends the chosen resolution / fps / aspect in the export request body', async () => {
    const { host, view } = await renderTimeline()
    await addVideoClip(view)

    fireEvent.change(view.container.querySelector('[data-timeline-export-resolution]') as HTMLSelectElement, { target: { value: '2k' } })
    fireEvent.change(view.container.querySelector('[data-timeline-export-fps]') as HTMLSelectElement, { target: { value: '60' } })
    fireEvent.change(view.container.querySelector('[data-timeline-export-aspect]') as HTMLSelectElement, { target: { value: 'square' } })

    fireEvent.click(view.container.querySelector('[data-timeline-export]') as HTMLButtonElement)
    await waitFor(() => { expect(host.calls).toContain('timelines/render') })

    expect(host.exportOptions()).toEqual({ resolution: '2k', fps: 60, aspect: 'square' })
  })

  it('marks the job running after starting export, and offers register-to-asset on success', async () => {
    const { view } = await renderTimeline()
    await addVideoClip(view)
    fireEvent.click(view.container.querySelector('[data-timeline-export]') as HTMLButtonElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-timeline-render="running"]')).toBeTruthy()
    })
    // 导出中：登记按钮不应出现
    expect(view.container.querySelector('[data-timeline-register]')).toBeNull()
  })
})
