// @vitest-environment jsdom
/**
 * B5 时间轴交互：素材拖拽入轨（落点即时间）、片段拖动改起点、左右手柄改时长、
 * 播放/暂停（顺序播放）、播放头跟随、删除/复制片段。
 *
 * 像素 ↔ 毫秒的换算基准是 lane 的 rect；jsdom 量不到真实布局，集成用例用
 * stub 的 rect 喂同样的函数（与线上口径一致，见 `timeline-math.ts`）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import {
  LANE_PADDING_PX, laneTimeFromClientX, nextVideoClipStart, resizeClipLeft, resizeClipRight,
} from '../src/client/timeline-math.ts'
import { clientProps, cleanup, createProject, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 假的 dataTransfer：记录 setData 的内容，drop 时原样读回。 */
function fakeDataTransfer() {
  const store = new Map<string, string>()
  return {
    types: [] as string[],
    effectAllowed: 'uninitialized',
    setData(type: string, value: string) { store.set(type, value); this.types.push(type) },
    getData(type: string) { return store.get(type) ?? '' },
  }
}

/** 给 lane 一个确定的 rect（jsdom 默认全是 0）。 */
function stubLaneRect(view: ReturnType<typeof render>, kind: string, left = 0, width = 400): void {
  const lane = view.container.querySelector(`[data-timeline-lane="${kind}"]`) as HTMLElement | null
  if (lane === null) throw new Error(`没有 ${kind} 轨的 lane`)
  lane.getBoundingClientRect = () => ({
    left, top: 0, width, height: 60, right: left + width, bottom: 60, x: left, y: 0,
    toJSON: () => ({}),
  })
}

/** 手动派发 drop：jsdom 的 DragEvent 把 `clientX` 当只读 getter，init 里的 clientX 会被吞掉，
 * 这里用 defineProperty 强行挂上，跟真实浏览器一致。 */
function fireDropWithClientX(
  node: HTMLElement,
  transfer: ReturnType<typeof fakeDataTransfer>,
  clientX: number,
): void {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as unknown as DragEvent
  Object.defineProperty(event, 'clientX', { value: clientX, configurable: true })
  Object.defineProperty(event, 'dataTransfer', { value: transfer, configurable: true })
  node.dispatchEvent(event)
}

/** 挂载工作台并进入时间轴模式（带一个视频素材）。 */
async function renderTimeline() {
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
  stubLaneRect(view, 'video')
  stubLaneRect(view, 'audio')
  stubLaneRect(view, 'subtitle')
  return { host, view }
}

/** 用现有的"选择素材 + 加入轨道"给视频轨加一个 3s 片段。 */
async function addClipViaPicker(view: ReturnType<typeof render>): Promise<void> {
  const picker = view.container.querySelector('[data-timeline-track="video"] select') as HTMLSelectElement
  fireEvent.change(picker, { target: { value: '/tmp/outputs/clip.mp4' } })
  fireEvent.click(view.container.querySelector('[data-timeline-track="video"] button[aria-label^="Add to track"]') as HTMLElement)
  await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(1) })
}

/** 片段当前的 left%（时间比例 → CSS 百分比）。 */
function clipLeftPercent(view: ReturnType<typeof render>): string {
  const style = view.container.querySelector('[data-timeline-clip]')?.getAttribute('style') ?? ''
  const match = /left:\s*([\d.]+)%/.exec(style)
  return match?.[1] ?? ''
}

describe('B5 timeline math', () => {
  it('maps mouse x to milliseconds by lane ratio (padding-aware)', () => {
    const lane = { left: 0, width: 400 }
    // 可用宽度 = 400 - 2*8 = 384；鼠标在最左 padding 内 → 0
    expect(laneTimeFromClientX(0, lane, 3000)).toBe(0)
    expect(laneTimeFromClientX(8, lane, 3000)).toBe(0)
    // 正中间：192/384 = 0.5 → 1500ms
    expect(laneTimeFromClientX(200, lane, 3000)).toBe(1500)
    // 超出右边界夹到总时长
    expect(laneTimeFromClientX(9999, lane, 3000)).toBe(3000)
    // 有偏移的 lane
    expect(laneTimeFromClientX(100, { left: 100, width: 400 }, 3000)).toBe(0)
    expect(laneTimeFromClientX(300, { left: 100, width: 400 }, 3000)).toBe(1500)
    // 退化输入有确定值
    expect(laneTimeFromClientX(10, { left: 0, width: 0 }, 3000)).toBe(0)
    expect(LANE_PADDING_PX).toBe(8)
  })

  it('resizes clips from either handle with a floor', () => {
    const clip = { startMs: 1000, durationMs: 3000 }
    // 右手柄：只改时长
    expect(resizeClipRight(clip, 500)).toEqual({ startMs: 1000, durationMs: 3500 })
    expect(resizeClipRight(clip, -99999)).toEqual({ startMs: 1000, durationMs: 200 })
    // 左手柄：起点后移、时长等量变短；不许越过右边界
    expect(resizeClipLeft(clip, 500)).toEqual({ startMs: 1500, durationMs: 2500 })
    expect(resizeClipLeft(clip, -500)).toEqual({ startMs: 500, durationMs: 3500 })
    expect(resizeClipLeft(clip, 99999)).toEqual({ startMs: 3800, durationMs: 200 })
    expect(resizeClipLeft({ startMs: 0, durationMs: 3000 }, -100)).toEqual({ startMs: 0, durationMs: 3000 })
  })

  it('finds the next video clip for sequential playback', () => {
    const tracks = [
      { id: 'v1', kind: 'video' as const, clips: [
        { id: 'c1', assetPath: '/a.mp4', startMs: 0, durationMs: 3000 },
        { id: 'c2', assetPath: '/b.mp4', startMs: 5000, durationMs: 2000 },
      ] },
      { id: 's1', kind: 'subtitle' as const, clips: [
        { id: 't1', text: 'x', startMs: 100, durationMs: 900 },
      ] },
    ]
    expect(nextVideoClipStart(tracks, 3000)).toBe(5000)
    expect(nextVideoClipStart(tracks, 0)).toBe(0)
    expect(nextVideoClipStart(tracks, 7000)).toBeUndefined()
  })
})

describe('B5 timeline interaction', () => {
  it('drops an asset onto a lane at the mouse position', async () => {
    const { view } = await renderTimeline()
    const row = view.container.querySelector('li[data-asset-draggable]') as HTMLElement
    expect(row).toBeTruthy()

    // 从素材行拖出，落到视频轨 x=200 处（rect 宽 400 → 比例 0.5 → 1500ms）
    const transfer = fakeDataTransfer()
    fireEvent.dragStart(row, { dataTransfer: transfer })
    const lane = view.container.querySelector('[data-timeline-lane="video"]') as HTMLElement
    fireEvent.dragOver(lane, { dataTransfer: transfer })
    expect(lane.className).toContain('iv-t-lane--drop')
    fireDropWithClientX(lane, transfer, 200)

    // 片段落在鼠标位置附近：lane 宽 400 → 比例 0.5 → 约 1500ms
    await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(1) })
    const startInput = view.container.querySelector('[data-timeline-track="video"] input') as HTMLInputElement
    expect(Number(startInput.value)).toBeGreaterThanOrEqual(1400)
    expect(Number(startInput.value)).toBeLessThanOrEqual(1600)
    expect(clipLeftPercent(view)).not.toBe('0')
  })

  it('moves a clip to a new start when dragged inside the lane', async () => {
    const { view } = await renderTimeline()
    await addClipViaPicker(view)
    expect(clipLeftPercent(view)).toBe('0')

    const transfer = fakeDataTransfer()
    const clip = view.container.querySelector('[data-timeline-clip]') as HTMLElement
    fireEvent.dragStart(clip, { dataTransfer: transfer })
    const lane = view.container.querySelector('[data-timeline-lane="video"]') as HTMLElement
    fireDropWithClientX(lane, transfer, 300)

    // 300px → (300-8)/384 = 0.76 → 约 2280ms（落点换算口径与线上一致）
    await waitFor(() => { expect(clipLeftPercent(view)).not.toBe('0') })
    const startInput = view.container.querySelector('[data-timeline-track="video"] input') as HTMLInputElement
    expect(Number(startInput.value)).toBeGreaterThanOrEqual(2200)
    expect(Number(startInput.value)).toBeLessThanOrEqual(2360)
  })

  it('changes duration with the right handle and start with the left handle', async () => {
    const { view } = await renderTimeline()
    await addClipViaPicker(view)
    const startInput = () => view.container.querySelector('[data-timeline-track="video"] input') as HTMLInputElement
    const durationInput = () => view.container.querySelectorAll('[data-timeline-track="video"] input')[1] as HTMLInputElement
    expect(Number(durationInput().value)).toBe(3000)

    // 右手柄右移 100px：+100/384*3000 ≈ 781ms
    fireEvent.mouseDown(view.container.querySelector('[data-timeline-clip-handle="right"]') as HTMLElement, { clientX: 300 })
    fireEvent.mouseMove(window, { clientX: 400 })
    fireEvent.mouseUp(window)
    await waitFor(() => { expect(Number(durationInput().value)).toBeGreaterThan(3000) })
    expect(Number(startInput().value)).toBe(0)

    // 左手柄右移 100px：起点 +781ms、时长等量变短
    const beforeStart = Number(startInput().value)
    const beforeDuration = Number(durationInput().value)
    fireEvent.mouseDown(view.container.querySelector('[data-timeline-clip-handle="left"]') as HTMLElement, { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: 100 })
    fireEvent.mouseUp(window)
    await waitFor(() => { expect(Number(startInput().value)).toBeGreaterThan(beforeStart) })
    expect(Number(durationInput().value)).toBe(beforeDuration - (Number(startInput().value) - beforeStart))
  })

  it('plays the sequence, follows the playhead and stops at the end', async () => {
    const { view } = await renderTimeline()
    await addClipViaPicker(view)
    const playhead = () => view.container.querySelector('[data-timeline-playhead]') as HTMLInputElement
    const playButton = () => view.container.querySelector('[data-timeline-play]') as HTMLElement

    fireEvent.click(playButton())
    expect(playButton().getAttribute('aria-pressed')).toBe('true')

    // 播放头跟随：推进约 1s（100ms 一跳，给真实定时器留足时间）
    await waitFor(() => { expect(Number(playhead().value)).toBeGreaterThan(800) }, { timeout: 4000 })
    expect(Number(playhead().value)).toBeLessThanOrEqual(1500)

    // 暂停：时间停住
    fireEvent.click(playButton())
    const paused = Number(playhead().value)
    await new Promise(resolve => { setTimeout(resolve, 300) })
    expect(Number(playhead().value)).toBe(paused)

    // 再播放直到尽头（片段 3s）：自动停下并停在总时长
    fireEvent.click(playButton())
    await waitFor(() => { expect(Number(playhead().value)).toBe(3000) }, { timeout: 6000 })
    expect(playButton().getAttribute('aria-pressed')).toBe('false')
  })

  it('duplicates a clip and removes the selected one on the Delete key', async () => {
    const { view } = await renderTimeline()
    await addClipViaPicker(view)

    // 复制：紧随原片段之后
    fireEvent.click(view.container.querySelector(`[aria-label^="${en.clipDuplicate}"]`) as HTMLElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(2) })
    // 域层 duplicateClip：副本落在原片段结尾之后（0 + 3000）
    const inputs = view.container.querySelectorAll('[data-timeline-track="video"] input')
    expect(Number(inputs[4]!.value)).toBe(3000)

    // 选中一个片段，按 Delete 删掉
    fireEvent.click(view.container.querySelector('[data-timeline-clip]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-timeline-clip]')?.getAttribute('data-timeline-clip-selected')).toBe('true')
    })
    fireEvent.keyDown(window, { key: 'Delete' })
    await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(1) })
  })

  it('splits a clip at the playhead through the domain rule (B17)', async () => {
    const { view } = await renderTimeline()
    await addClipViaPicker(view)

    // 播放头推到 1500ms（3s 片段的中间）
    const playhead = view.container.querySelector('[data-timeline-playhead]') as HTMLInputElement
    fireEvent.change(playhead, { target: { value: '1500' } })

    // 分割：域层 splitClipAt —— 两半时长守恒（1500 + 1500），右半起点=拆分点
    fireEvent.click(view.container.querySelector('[data-timeline-clip-split]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(2) })

    const inputs = view.container.querySelectorAll('[data-timeline-track="video"] input')
    // 每片四个输入：起点 / 时长 / 变速 / 淡入淡出
    expect(Number(inputs[0]!.value)).toBe(0)        // 左半起点
    expect(Number(inputs[1]!.value)).toBe(1500)     // 左半时长
    expect(Number(inputs[4]!.value)).toBe(1500)     // 右半起点
    expect(Number(inputs[5]!.value)).toBe(1500)     // 右半时长

    // 分割后选中右半：还能再切一刀
    await waitFor(() => {
      const selected = view.container.querySelectorAll('[data-timeline-clip]')
      expect(selected[1]?.getAttribute('data-timeline-clip-selected')).toBe('true')
    })
  })

  it('disables split when the playhead is outside the clip (B17)', async () => {
    const { view } = await renderTimeline()
    await addClipViaPicker(view)

    // 播放头在 0（片段起点）：严格内部才算，起点/终点都是无效拆分
    const playhead = view.container.querySelector('[data-timeline-playhead]') as HTMLInputElement
    fireEvent.change(playhead, { target: { value: '0' } })
    const split = view.container.querySelector('[data-timeline-clip-split]') as HTMLButtonElement
    expect(split.disabled).toBe(true)
    expect(split.getAttribute('title')).toBe(en.clipSplitOutsideHint)

    // 推进到片段内部，按钮启用
    fireEvent.change(playhead, { target: { value: '1200' } })
    expect(view.container.querySelector('[data-timeline-clip-split]')?.hasAttribute('disabled')).toBe(false)
  })
})
