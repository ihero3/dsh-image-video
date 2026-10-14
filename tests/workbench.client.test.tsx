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

afterEach(cleanup)

/**
 * The right-pane seat binds far more props than the skeleton reads (shortcuts,
 * stores, actions). The test binds only the three the component consumes, which
 * is what the seat would supply for a render on its own.
 */
function props(overrides: { visible?: boolean; fullscreen?: boolean } = {}): WorkbenchProps {
  const useTabInfo = () => ({
    sidebar: { expanded: true, fullscreen: overrides.fullscreen ?? false },
    panel: { id: 'pane-1' },
    tab: { visible: overrides.visible ?? true },
  })
  return {
    kind: 'dsh-image-video-workbench',
    t: (key: keyof typeof en) => en[key],
    useTabInfo,
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

  it('reports the seat facts it was handed', () => {
    const view = render(<Workbench {...props({ visible: false, fullscreen: true })} />)
    const root = view.container.querySelector('[data-workbench-kind]')!
    expect(root.getAttribute('data-workbench-visible')).toBe('false')
    expect(root.getAttribute('data-workbench-fullscreen')).toBe('true')
  })
})
