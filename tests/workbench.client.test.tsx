// @vitest-environment jsdom
/**
 * Workbench skeleton render: the framework shape the later phases fill in —
 * project header, the three mode buttons, the current mode's area, and the four
 * panes — plus the seat facts it reports through `data-*` attributes.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Workbench, type WorkbenchProps } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import type { WorkbenchHealth } from '../src/workbench-contract.ts'

/** The host answer the seat's injected face would resolve to. */
const HEALTH: WorkbenchHealth = {
  plugin: 'dsh-image-video', version: '0.3.1', channel: '/image-video',
  provider: 'threerouter', outputsDir: '/tmp/outputs', at: '2026-10-14T00:00:00.000Z',
}

afterEach(cleanup)

/**
 * The right-pane seat binds far more props than the skeleton reads (shortcuts,
 * stores, actions). The test binds only the three the component consumes, which
 * is what the seat would supply for a render on its own.
 */
function props(overrides: { visible?: boolean; fullscreen?: boolean; health?: () => Promise<WorkbenchHealth> } = {}): WorkbenchProps {
  const useTabInfo = () => ({
    sidebar: { expanded: true, fullscreen: overrides.fullscreen ?? false },
    panel: { id: 'pane-1' },
    tab: { visible: overrides.visible ?? true },
  })
  return {
    kind: 'dsh-image-video-workbench',
    t: (key: keyof typeof en) => en[key],
    useTabInfo,
    health: overrides.health ?? (() => Promise.resolve(HEALTH)),
  } as unknown as WorkbenchProps
}

describe('workbench skeleton', () => {
  it('renders the header, three modes and four panes', () => {
    const view = render(<Workbench {...props()} />)
    expect(view.container.querySelector('[data-workbench-kind]')?.getAttribute('data-workbench-kind'))
      .toBe('dsh-image-video-workbench')
    expect(screen.getByText(en.sectionProject)).toBeTruthy()
    expect(screen.getByText(en.projectNone)).toBeTruthy()
    expect(screen.getByText(en.saveSaved)).toBeTruthy()
    for (const mode of [en.modeQuick, en.modeWorkflow, en.modeTimeline]) {
      expect(screen.getByRole('button', { name: mode })).toBeTruthy()
    }
    for (const pane of [en.paneAssets, en.paneResources, en.panePreview, en.paneTasks]) {
      expect(screen.getByRole('heading', { name: pane })).toBeTruthy()
    }
    // 计划 §15 第 5 条：两个入口必须有"不可运行"提示（其余面暂不加）
    expect(screen.getAllByText(en.panePlanned)).toHaveLength(2)
    for (const entry of ['paneAssets', 'paneResources']) {
      expect(view.container.querySelector(`[data-workbench-pane=${entry}]`)?.getAttribute('data-workbench-planned')).toBe('true')
    }
    expect(view.container.querySelector('[data-workbench-pane=paneTasks]')?.getAttribute('data-workbench-planned')).toBe('false')
    expect(screen.getByText(en.emptyHint)).toBeTruthy()
  })

  it('switches the current mode without losing the panes', () => {
    render(<Workbench {...props()} />)
    const quick = screen.getByRole('button', { name: en.modeQuick })
    const workflow = screen.getByRole('button', { name: en.modeWorkflow })
    expect(quick.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(workflow)
    expect(workflow.getAttribute('aria-pressed')).toBe('true')
    expect(quick.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('region', { name: en.modeWorkflow })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.paneTasks })).toBeTruthy()
  })

  it('shows the host facts the injected face resolved', async () => {
    const view = render(<Workbench {...props()} />)
    const root = view.container.querySelector('[data-workbench-kind]')!
    // 首帧是"连接中"，宿主答复落地后才变 ok
    expect(root.getAttribute('data-workbench-health')).toBe('checking')
    expect(await screen.findByText('0.3.1 · threerouter')).toBeTruthy()
    expect(root.getAttribute('data-workbench-health')).toBe('ok')
  })

  it('reports a refused health check without breaking the surface', async () => {
    const view = render(<Workbench {...props({ health: () => Promise.reject(new Error('boom')) })} />)
    const root = view.container.querySelector('[data-workbench-kind]')!
    await screen.findByText(en.healthFailed)
    expect(root.getAttribute('data-workbench-health')).toBe('failed')
    // 原始报错只放在 title 里，不进可见文案
    expect(screen.getByTitle('boom')).toBeTruthy()
    // 骨架其余部分照常
    expect(screen.getByRole('heading', { name: en.paneTasks })).toBeTruthy()
  })

  it('reports the seat facts it was handed', () => {
    const view = render(<Workbench {...props({ visible: false, fullscreen: true })} />)
    const root = view.container.querySelector('[data-workbench-kind]')!
    expect(root.getAttribute('data-workbench-visible')).toBe('false')
    expect(root.getAttribute('data-workbench-fullscreen')).toBe('true')
  })
})
