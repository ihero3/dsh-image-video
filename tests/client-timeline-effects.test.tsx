// @vitest-environment jsdom
/**
 * B14 接新契约（客户端半边）：转场 / 变速 / 淡入淡出 / 裁剪控件、音轨淡入淡出、
 * 导出响度开关，都写回时间轴并随去抖落库（`saveTimeline` 收到对应字段）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 进入时间轴模式（带一个视频素材），返回宿主与视图。 */
async function renderTimelineWithVideoClip() {
  const host = fakeApi({
    assets: [{
      schemaVersion: 1, id: 'ast-v', projectId: 'prj-1', kind: 'video',
      path: '/tmp/outputs/clip.mp4', bytes: 1024, createdAt: '2026-10-16T00:00:00.000Z',
    }],
  })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '时间轴项目',
    createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
  await waitFor(() => { expect(view.container.querySelector('[data-timeline-lane="video"]')).toBeTruthy() })
  // 通过「选素材 + 加入轨道」给视频轨加一个片段
  const picker = view.container.querySelector('[data-timeline-track="video"] select') as HTMLSelectElement
  fireEvent.change(picker, { target: { value: '/tmp/outputs/clip.mp4' } })
  fireEvent.click(view.container.querySelector('[data-timeline-track="video"] button[aria-label^="Add to track"]') as HTMLElement)
  await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(1) })
  return { host, view }
}

/** 等去抖落库（默认 800ms），读到保存后的时间轴记录。 */
async function waitForSavedTimeline(host: ReturnType<typeof fakeApi>) {
  await waitFor(() => { expect(host.timelines).toHaveLength(1) }, { timeout: 3000 })
  return host.timelines[0]!
}

describe('B14 clip effect controls', () => {
  it('exposes speed / fade controls on a video clip and persists them', async () => {
    const { host, view } = await renderTimelineWithVideoClip()
    const speedInput = view.container.querySelector(`[aria-label^="${en.clipSpeed} "]`) as HTMLInputElement
    expect(speedInput).toBeTruthy()
    // 变速默认 1；改成 2
    fireEvent.change(speedInput, { target: { value: '2' } })
    const fadeInput = view.container.querySelector(`[aria-label^="${en.clipFade} "]`) as HTMLInputElement
    fireEvent.change(fadeInput, { target: { value: '500' } })
    const saved = await waitForSavedTimeline(host)
    const savedClip = saved.tracks.find(track => track.kind === 'video')?.clips[0]
    expect(savedClip?.speed).toBe(2)
    expect(savedClip?.fade).toBe(500)
  })

  it('offers a transition picker that writes transition + duration', async () => {
    const { host, view } = await renderTimelineWithVideoClip()
    const transitionSelect = view.container.querySelector(`[aria-label^="${en.clipTransition}"]`) as HTMLSelectElement
    expect(transitionSelect).toBeTruthy()
    fireEvent.change(transitionSelect, { target: { value: 'fade' } })
    await waitFor(() => {
      const duration = view.container.querySelector(`[aria-label^="${en.clipTransitionDuration}"]`) as HTMLInputElement
      expect(duration).toBeTruthy()
    })
    const durationInput = view.container.querySelector(`[aria-label^="${en.clipTransitionDuration}"]`) as HTMLInputElement
    fireEvent.change(durationInput, { target: { value: '800' } })
    const saved = await waitForSavedTimeline(host)
    const savedClip = saved.tracks.find(track => track.kind === 'video')?.clips[0]
    expect(savedClip?.transition).toBe('fade')
    expect(savedClip?.transitionDurationMs).toBe(800)
  })

  it('toggles the loudness switch into the timeline document', async () => {
    const { host, view } = await renderTimelineWithVideoClip()
    const loudness = view.container.querySelector('[data-timeline-loudness="true"]') as HTMLInputElement
    expect(loudness).toBeTruthy()
    expect(loudness.checked).toBe(false)
    fireEvent.click(loudness)
    const saved = await waitForSavedTimeline(host)
    expect(saved.normalizeLoudness).toBe(true)
  })

  it('adds an audio-track fade control that clamps to 0–5000 ms', async () => {
    const { host, view } = await renderTimelineWithVideoClip()
    const fadeInput = view.container.querySelector('[data-timeline-track-fade]') as HTMLInputElement
    expect(fadeInput).toBeTruthy()
    fireEvent.change(fadeInput, { target: { value: '-9999' } })
    const saved = await waitForSavedTimeline(host)
    const audioTrack = saved.tracks.find(track => track.kind === 'audio')
    expect(audioTrack?.fadeMs).toBe(0)
  })
})
