// @vitest-environment jsdom
/**
 * 时间轴精剪 v1.2（`docs/TIMELINE-PANE-REDESIGN.md`）的界面契约：
 *
 * - **同屏**：监视器在轨道之前、导出条在轨道之后（顺序由 DOM 保证，不靠 magic number）；
 * - **检查器 fallback**：无选中时「展示」首段但不写选中态，破坏性动作禁用，首次改参数自动选中；
 * - **片段条只留三件事**：位置 / 内容 / 左右手柄（参数搬走、图片片段有缩略底）；
 * - **缩放是真的**：滑杆改变刻度密度与内层宽度；
 * - **键盘可达**：片段可聚焦，Enter/Space 选中。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'
import { cleanup, clientProps, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 两段视频 + 一条字幕的时间轴（片段种类齐全，便于验证检查器切换）。 */
function seededTimeline(): TimelineRecord {
  const stamp = '2026-11-26T00:00:00.000Z'
  return {
    schemaVersion: 1, id: 'tml-pane', projectId: 'prj-1', name: '精剪', frameRate: 30, burnSubtitles: true,
    tracks: [
      {
        id: 'v1', kind: 'video', clips: [
          { id: 'c1', assetPath: '/tmp/outputs/a.mp4', startMs: 0, durationMs: 3000 },
          { id: 'c2', assetPath: '/tmp/outputs/b.png', startMs: 3000, durationMs: 2000 },
        ],
      },
      { id: 'a1', kind: 'audio', clips: [] },
      { id: 's1', kind: 'subtitle', clips: [{ id: 't1', text: '林夏撑伞走来', startMs: 0, durationMs: 2000 }] },
    ],
    createdAt: stamp, updatedAt: stamp,
  }
}

/** 进入时间轴模式。 */
async function openTimeline(host = fakeApi({ timelines: [seededTimeline()] })) {
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '精剪项目',
    createdAt: '2026-11-26T00:00:00.000Z', updatedAt: '2026-11-26T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
  await waitFor(() => { expect(view.container.querySelector('[data-timeline-lane="video"]')).toBeTruthy() })
  return { host, view }
}

/** 在文档顺序上 a 是否位于 b 之前。 */
function before(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

describe('时间轴精剪：布局顺序与同屏', () => {
  it('监视器 → 轨道 → 导出条，导出开关在导出条里（不在 pane 头）', async () => {
    const { view } = await openTimeline()
    const monitor = view.container.querySelector('[data-timeline-preview]') as HTMLElement
    const tracks = view.container.querySelector('[data-timeline-tracks]') as HTMLElement
    const exportBar = view.container.querySelector('[data-timeline-export-bar]') as HTMLElement
    expect(monitor).toBeTruthy()
    expect(tracks).toBeTruthy()
    expect(exportBar).toBeTruthy()
    expect(before(monitor, tracks), '监视器必须在轨道之前').toBe(true)
    expect(before(tracks, exportBar), '导出条必须在轨道之后').toBe(true)

    // 两个时间轴级开关跟着 D1 落进导出条
    expect(exportBar.querySelector('[data-timeline-burn]')).toBeTruthy()
    expect(exportBar.querySelector('[data-timeline-loudness]')).toBeTruthy()
    // 导出条不是浮层：它就是文档流里的常驻区块
    expect(exportBar.className).not.toContain('overlay')
  })

  it('播放头只覆盖轨道区（不再有 46px 的 JS 数学）', async () => {
    const { view } = await openTimeline()
    const layer = view.container.querySelector('.iv-tl-lane-layer') as HTMLElement
    const playhead = layer?.querySelector('.iv-playhead') as HTMLElement
    expect(playhead).toBeTruthy()
    expect(playhead.getAttribute('style') ?? '').toContain('left:')
    // 轨道区之外（ruler 头列）不出现第二条播放头
    expect(view.container.querySelectorAll('.iv-playhead')).toHaveLength(1)
  })
})

describe('时间轴精剪：片段条瘦身与检查器', () => {
  it('片段条只剩位置/内容/手柄，且图片片段有缩略底', async () => {
    const { view } = await openTimeline()
    // 两段视频 + 一条字幕
    const clips = view.container.querySelectorAll('[data-timeline-clip]')
    expect(clips).toHaveLength(3)
    for (const clip of clips) {
      expect(clip.querySelectorAll('input, select, textarea')).toHaveLength(0)
      expect(clip.querySelector('[data-timeline-clip-handle="left"]')).toBeTruthy()
      expect(clip.querySelector('[data-timeline-clip-handle="right"]')).toBeTruthy()
    }
    // 第二段是图片：缩略底 + 名字 + 时长
    const imageClip = docsFind(clips, 'c2')
    expect(imageClip.querySelector('.iv-clip-thumb')?.getAttribute('src')).toBe('/outputs/b.png')
  })

  it('未选中时检查器展示首段（fallback），不写选中态、破坏性动作禁用', async () => {
    const { view } = await openTimeline()
    const inspector = view.container.querySelector('[data-timeline-clip-inspector]') as HTMLElement
    expect(inspector.getAttribute('data-timeline-clip-inspector')).toBe('c1')
    expect(inspector.getAttribute('data-timeline-clip-inspector-fallback')).toBe('true')
    // 片段不高亮：fallback 只是「展示」，不是「选中」
    expect(view.container.querySelector('[data-timeline-clip-selected="true"]')).toBeNull()

    const duplicate = view.container.querySelector(`[data-timeline-clip-inspector] [aria-label^="${en.clipDuplicate}"]`) as HTMLButtonElement
    const remove = view.container.querySelector(`[data-timeline-clip-inspector] [aria-label^="${en.remove}"]`) as HTMLButtonElement
    expect(duplicate.disabled).toBe(true)
    expect(remove.disabled).toBe(true)
  })

  it('首次改参数会自动把该片段写入选中态', async () => {
    const { view } = await openTimeline()
    const speed = view.container.querySelector(`[data-timeline-clip-inspector] [aria-label^="${en.clipSpeed} "]`) as HTMLInputElement
    fireEvent.change(speed, { target: { value: '2' } })
    await waitFor(() => {
      expect(view.container.querySelector('[data-timeline-clip-inspector]')?.getAttribute('data-timeline-clip-inspector-fallback')).toBe('false')
    })
    expect(view.container.querySelector('[data-timeline-clip="c1"]')?.getAttribute('data-timeline-clip-selected')).toBe('true')
  })

  it('点选第二个片段后检查器切到它，动作恢复可用', async () => {
    const { view } = await openTimeline()
    fireEvent.click(view.container.querySelector('[data-timeline-clip="c2"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-timeline-clip-inspector]')?.getAttribute('data-timeline-clip-inspector')).toBe('c2')
    })
    const duplicate = view.container.querySelector(`[data-timeline-clip-inspector] [aria-label^="${en.clipDuplicate}"]`) as HTMLButtonElement
    expect(duplicate.disabled).toBe(false)
  })

  it('片段可聚焦，Enter 选中（参数搬走后键盘仍能切换片段）', async () => {
    const { view } = await openTimeline()
    const clip = view.container.querySelector('[data-timeline-clip="c2"]') as HTMLElement
    expect(clip.getAttribute('tabindex')).toBe('0')
    expect(clip.getAttribute('role')).toBe('group')
    fireEvent.keyDown(clip, { key: 'Enter' })
    await waitFor(() => {
      expect(view.container.querySelector('[data-timeline-clip="c2"]')?.getAttribute('data-timeline-clip-selected')).toBe('true')
    })
  })
})

describe('时间轴精剪：缩放与刻度', () => {
  it('缩放滑杆改变刻度数量与内层宽度（不再是死控件）', async () => {
    const { view } = await openTimeline()
    const zoom = view.container.querySelector('[data-timeline-zoom]') as HTMLInputElement
    const rulerLabels = () => view.container.querySelectorAll('.iv-ruler b').length
    expect(zoom.value).toBe('100')
    expect(rulerLabels()).toBe(7)

    fireEvent.change(zoom, { target: { value: '300' } })
    await waitFor(() => { expect(rulerLabels()).toBe(13) })
    const inner = view.container.querySelector('.iv-tl-inner') as HTMLElement
    expect(inner.getAttribute('style') ?? '').toContain('--iv-tl-zoom')

    fireEvent.change(zoom, { target: { value: '50' } })
    await waitFor(() => { expect(rulerLabels()).toBe(7) })
  })
})

/** 从片段节点列表里按 data-timeline-clip 找到目标。 */
function docsFind(clips: NodeListOf<Element>, id: string): HTMLElement {
  for (const clip of clips) {
    if (clip.getAttribute('data-timeline-clip') === id) return clip as HTMLElement
  }
  throw new Error(`没有片段 ${id}`)
}
