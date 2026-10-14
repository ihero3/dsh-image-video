/**
 * Workbench skeleton, browser half: the surface shape the later phases fill in —
 * header (project name, save state, mode switch), the current mode's working
 * area, and the four panes (media assets / resources / preview / tasks).
 *
 * It reads the seat's own tab information (`useTabInfo`) so the right-pane
 * integration is observable on its own: visibility and docked-vs-fullscreen are
 * reported as `data-*` attributes rather than user-facing copy.
 *
 * Colours stay theme-neutral (`currentColor` + `color-mix`) until the theme pass
 * (`R-NFR-3`) switches every surface to the Harness CSS variables.
 */
import { useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the right pane's seat declarations (the framework-bound `useTabInfo`).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { NS, type WorkbenchLocaleKey } from './locales.ts'

/** Injected share the client plugin binds once. */
export interface WorkbenchInjected {
  /** Registered tab kind, echoed in the header so the seat wiring is visible at a glance. */
  kind: string
}

/** The three modes the workbench offers. */
export type WorkbenchMode = 'quick' | 'workflow' | 'timeline'

/** Props the right-pane seat binds for this body. */
export type WorkbenchProps =
  PropsRuntime<'sidebar.right.pane.tab'>
  & InjectFace<WorkbenchInjected>
  & PropsLocale<typeof NS>

/** Mode → dictionary key, in switch order. */
const MODE_KEYS: Record<WorkbenchMode, WorkbenchLocaleKey> = {
  quick: 'modeQuick',
  workflow: 'modeWorkflow',
  timeline: 'modeTimeline',
}
const MODES: readonly WorkbenchMode[] = ['quick', 'workflow', 'timeline']

/** Pane → dictionary key, in grid order. */
const PANES: readonly WorkbenchLocaleKey[] = ['paneAssets', 'paneResources', 'panePreview', 'paneTasks']

const SURFACE = {
  display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px',
  font: 'inherit', color: 'inherit', height: '100%', boxSizing: 'border-box', overflow: 'auto',
} as const

/** One theme-neutral hairline; the theme pass replaces it with a Harness token. */
const HAIRLINE = '1px solid color-mix(in srgb, currentColor 18%, transparent)'

/**
 * Render the workbench skeleton.
 * @param props - seat runtime hooks, the injected face, and localized copy.
 * @returns the skeleton surface.
 */
export function Workbench(props: WorkbenchProps): ReactNode {
  const { kind, t, useTabInfo } = props
  const [mode, setMode] = useState<WorkbenchMode>('quick')
  const { sidebar, tab } = useTabInfo()
  return (
    <div
      style={SURFACE}
      data-workbench-kind={kind}
      data-workbench-visible={tab.visible ? 'true' : 'false'}
      data-workbench-fullscreen={sidebar.fullscreen ? 'true' : 'false'}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '13px' }}>{t('sectionProject')}</strong>
        <span style={{ fontSize: '13px', opacity: 0.7 }}>{t('projectNone')}</span>
        <span style={{ border: HAIRLINE, borderRadius: '999px', padding: '0 8px', fontSize: '12px', opacity: 0.8 }}>
          {t('saveSaved')}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.55 }}>{kind}</span>
      </header>
      <nav style={{ display: 'flex', gap: '6px' }} aria-label={t('tabTitle')}>
        {MODES.map(candidate => (
          <button
            key={candidate}
            type="button"
            aria-pressed={candidate === mode}
            onClick={() => { setMode(candidate) }}
            style={{
              border: HAIRLINE, borderRadius: '6px', padding: '4px 10px', color: 'inherit', cursor: 'pointer',
              background: candidate === mode ? 'color-mix(in srgb, currentColor 10%, transparent)' : 'transparent',
            }}
          >
            {t(MODE_KEYS[candidate])}
          </button>
        ))}
      </nav>
      <section
        aria-label={t(MODE_KEYS[mode])}
        style={{ border: HAIRLINE, borderRadius: '8px', padding: '10px', minHeight: '72px' }}
      >
        <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>{t('emptyHint')}</p>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
        {PANES.map(pane => (
          <section key={pane} style={{ border: HAIRLINE, borderRadius: '8px', padding: '10px', minHeight: '88px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600 }}>{t(pane)}</h3>
          </section>
        ))}
      </div>
    </div>
  )
}
