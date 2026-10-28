// @vitest-environment jsdom
/**
 * 时间轴片段手柄的键盘通道（R6-3 / WCAG 2.1 SC 2.1.1）。
 *
 * 在此之前手柄是 `<div role="separator">` + 只有 `onMouseDown`：不可聚焦、不可键盘操作，
 * 剪辑的核心动作（改起点/改时长）对键盘用户完全不可用。这里钉住四件事：
 * 能聚焦、ARIA 数值完整、方向键真的改了片段、Home/End 真的到边界。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { cleanup, clientProps, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 挂载工作台 → 时间轴模式 → 给视频轨加一个 3s 片段。 */
async function renderWithClip() {
  const host = fakeApi({
    assets: [{
      schemaVersion: 1, id: 'ast-v', projectId: 'prj-1', kind: 'video',
      path: '/tmp/outputs/clip.mp4', bytes: 1024, createdAt: '2026-10-16T00:00:00.000Z',
    }],
  })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '键盘剪辑',
    createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
  await waitFor(() => { expect(view.container.querySelector('[data-timeline-lane="video"]')).toBeTruthy() })

  const picker = view.container.querySelector('[data-timeline-track="video"] select') as HTMLSelectElement
  fireEvent.change(picker, { target: { value: '/tmp/outputs/clip.mp4' } })
  fireEvent.click(view.container.querySelector('[data-timeline-track="video"] button[aria-label^="Add to track"]') as HTMLElement)
  await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(1) })

  const handle = (side: 'left' | 'right'): HTMLElement => {
    const node = view.container.querySelector(`[data-timeline-clip-handle="${side}"]`)
    if (node === null) throw new Error(`没有 ${side} 手柄`)
    return node as HTMLElement
  }
  const value = (side: 'left' | 'right', attr: 'aria-valuenow' | 'aria-valuemin' | 'aria-valuemax'): number =>
    Number(handle(side).getAttribute(attr))

  return { host, view, handle, value }
}

describe('时间轴手柄键盘通道', () => {
  it('手柄可聚焦，且 ARIA 数值完整（读屏能报出时间）', async () => {
    const { handle } = await renderWithClip()

    for (const side of ['left', 'right'] as const) {
      const node = handle(side)
      expect(node.getAttribute('tabindex'), `${side}: 不可聚焦`).toBe('0')
      expect(node.getAttribute('role')).toBe('separator')
      expect(node.getAttribute('aria-orientation')).toBe('vertical')
      expect(node.getAttribute('aria-valuenow')).toBeTruthy()
      expect(node.getAttribute('aria-valuemin')).toBeTruthy()
      expect(node.getAttribute('aria-valuemax')).toBeTruthy()
      // 念时间码，不念毫秒
      expect(node.getAttribute('aria-valuetext')).toMatch(/^\d+:\d{2}\.\d$/)
    }
  })

  it('方向键把左手柄移动 100ms，Shift 移动 1s（并被夹在 0）', async () => {
    const { handle, value } = await renderWithClip()
    const before = value('left', 'aria-valuenow')

    fireEvent.keyDown(handle('left'), { key: 'ArrowRight' })
    await waitFor(() => { expect(value('left', 'aria-valuenow')).toBe(before + 100) })

    // Shift + 左 是 -1s；此刻起点只有 100ms，所以被夹到 0（边界规则生效，不是变负数）
    fireEvent.keyDown(handle('left'), { key: 'ArrowLeft', shiftKey: true })
    await waitFor(() => { expect(value('left', 'aria-valuenow')).toBe(0) })

    // 从 0 用 Shift + 右 应该一次走满 1s，证明大步长确实生效
    fireEvent.keyDown(handle('left'), { key: 'ArrowRight', shiftKey: true })
    await waitFor(() => { expect(value('left', 'aria-valuenow')).toBe(1000) })
  })

  it('方向键改右手柄时长，Home 收到最短时长', async () => {
    const { handle, value } = await renderWithClip()
    const start = value('right', 'aria-valuenow')
    const minimum = value('right', 'aria-valuemin')

    fireEvent.keyDown(handle('right'), { key: 'ArrowRight' })
    await waitFor(() => { expect(value('right', 'aria-valuenow')).toBeGreaterThan(start) })

    fireEvent.keyDown(handle('right'), { key: 'Home' })
    await waitFor(() => { expect(value('right', 'aria-valuenow')).toBe(minimum) })
  })

  it('左手柄 Home 回到 0，且不会把片段压没', async () => {
    const { handle, value } = await renderWithClip()

    fireEvent.keyDown(handle('left'), { key: 'Home' })
    await waitFor(() => { expect(value('left', 'aria-valuenow')).toBe(0) })

    // 已经在 0，再按一次不该变成负数，时长也不该归零
    fireEvent.keyDown(handle('left'), { key: 'Home' })
    await waitFor(() => { expect(value('left', 'aria-valuenow')).toBe(0) })
    expect(value('right', 'aria-valuenow')).toBeGreaterThan(0)
  })

  it('不认识的按键不影响片段（Tab 仍能正常移出焦点）', async () => {
    const { handle, value } = await renderWithClip()
    const before = value('left', 'aria-valuenow')
    fireEvent.keyDown(handle('left'), { key: 'a' })
    fireEvent.keyDown(handle('left'), { key: 'Tab' })
    expect(value('left', 'aria-valuenow')).toBe(before)
  })
})
