// @vitest-environment jsdom
/**
 * B8 a11y：三模式切换是可键盘聚焦的 <button>，带 aria-label / aria-pressed（焦点的真实来源）；
 * 导出面板的分辨率 / 帧率 / 宽高比选择器都带 aria-label；切换模式后焦点状态正确反映当前模式。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { cleanup, clientProps, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

describe('B8 accessibility', () => {
  it('exposes labeled, keyboard-focusable mode switches with pressed state', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    await waitFor(() => { expect(view.container.querySelector(`[aria-label="${en.modeQuick}"]`)).toBeTruthy() })

    for (const key of ['modeQuick', 'modeWorkflow', 'modeTimeline'] as const) {
      const button = view.container.querySelector(`[aria-label="${en[key]}"]`) as HTMLButtonElement
      expect(button).toBeTruthy()
      expect(button.tagName).toBe('BUTTON')
      // 原生 <button> 默认可 Tab 聚焦，没有把自己踢出焦点顺序
      expect(button.getAttribute('tabindex')).not.toBe('-1')
      expect(button.getAttribute('aria-pressed')).toBe(key === 'modeQuick' ? 'true' : 'false')
    }
  })

  it('reflects the active mode after a keyboard-driven switch', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    const timeline = await screen.findByRole('button', { name: en.modeTimeline })
    fireEvent.click(timeline)
    await waitFor(() => {
      expect((view.container.querySelector(`[aria-label="${en.modeTimeline}"]`) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
    })
    expect((view.container.querySelector(`[aria-label="${en.modeQuick}"]`) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false')
  })

  it('gives the export resolution / fps / aspect selectors accessible names', async () => {
    const host = fakeApi({
      assets: [{ schemaVersion: 1, id: 'ast-v', projectId: 'prj-1', kind: 'video', path: '/tmp/outputs/clip.mp4', bytes: 1, createdAt: '2026-10-16T00:00:00.000Z' }],
    })
    host.projects.push({ schemaVersion: 1, id: 'prj-1', name: 'a11y', createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z' })
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
    await waitFor(() => { expect(view.container.querySelector('[data-timeline-export-resolution]')).toBeTruthy() })
    expect((view.container.querySelector('[data-timeline-export-resolution]') as HTMLSelectElement).getAttribute('aria-label')).toBe(en.paramResolution)
    expect((view.container.querySelector('[data-timeline-export-fps]') as HTMLSelectElement).getAttribute('aria-label')).toBe(en.fps)
    expect((view.container.querySelector('[data-timeline-export-aspect]') as HTMLSelectElement).getAttribute('aria-label')).toBe(en.paramRatio)
  })

  it('moves focus into the help dialog, traps Tab, closes on Esc and returns focus', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    const trigger = await screen.findByRole('button', { name: en.railHelp })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = await waitFor(() => {
      const node = view.container.querySelector('.iv-help') as HTMLElement | null
      expect(node).not.toBeNull()
      return node!
    })

    // 打开即移入：焦点落在浮层内部，而不是继续留在背后的界面上
    await waitFor(() => { expect(dialog.contains(document.activeElement)).toBe(true) })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('tabindex')).toBe('-1')

    // Tab 在末尾回环到第一个（不逃出浮层）
    const items = [...dialog.querySelectorAll<HTMLElement>('button')]
    expect(items.length).toBeGreaterThan(0)
    items[items.length - 1]!.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(items[0])

    // Esc 关闭，并把焦点归还给触发按钮
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => { expect(view.container.querySelector('.iv-help')).toBeNull() })
    await waitFor(() => { expect(document.activeElement).toBe(trigger) })

    // 同一次渲染里顺手验播报区：常驻节点（无消息时也在），且可见提示条不带 role
    const region = view.container.querySelector('[data-live-region]') as HTMLElement
    expect(region).not.toBeNull()
    expect(region.getAttribute('role')).toBe('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.getAttribute('aria-atomic')).toBe('true')
    const notice = view.container.querySelector('.iv-notice')
    if (notice !== null) expect(notice.getAttribute('role')).toBeNull()
  })
})
