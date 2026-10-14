/**
 * Workbench skeleton, browser half: the surface shape the later phases fill in —
 * header (project name, save state, mode switch, host health), the current mode's
 * working area, and the four panes (media assets / resources / preview / tasks).
 *
 * It reads the seat's own tab information (`useTabInfo`) so the right-pane
 * integration is observable on its own, and asks the host half for its health
 * over the workbench RPC channel on mount — that answer is the end-to-end proof
 * that the browser half, the channel and the host half agree.
 *
 * Colours stay theme-neutral (`currentColor` + `color-mix`) until the theme pass
 * (`R-NFR-3`) switches every surface to the Harness CSS variables.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the right pane's seat declarations (the framework-bound `useTabInfo`).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { NS, type WorkbenchLocaleKey } from './locales.ts'
import type { WorkbenchHealth } from '../workbench-contract.ts'

/** Injected share the client plugin binds once. */
export interface WorkbenchInjected {
  /** Registered tab kind, echoed in the header so the seat wiring is visible at a glance. */
  kind: string
  /** Host answer for the workbench channel's `health` endpoint. */
  health: () => Promise<WorkbenchHealth>
}

/** The three modes the workbench offers. */
export type WorkbenchMode = 'quick' | 'workflow' | 'timeline'

/** Props the right-pane seat binds for this body. */
export type WorkbenchProps =
  PropsRuntime<'sidebar.right.pane.tab'>
  & InjectFace<WorkbenchInjected>
  & PropsLocale<typeof NS>

/** What the header can say about the host. */
type HealthState =
  | { status: 'checking' }
  | { status: 'ok'; health: WorkbenchHealth }
  | { status: 'failed'; message: string }

/** Mode → dictionary key, in switch order. */
const MODE_KEYS: Record<WorkbenchMode, WorkbenchLocaleKey> = {
  quick: 'modeQuick',
  workflow: 'modeWorkflow',
  timeline: 'modeTimeline',
}
const MODES: readonly WorkbenchMode[] = ['quick', 'workflow', 'timeline']

/** One pane of the workbench grid: what it is, and whether it is runnable yet. */
interface Pane {
  /** Dictionary key of the pane's title. */
  readonly label: WorkbenchLocaleKey
  /**
   * `true` for entries that exist as placeholders only: 计划 §15 要求「媒体素材 /
   * 创作资源」两个入口明确给出**不可运行提示**，而不是让用户以为点了就能用。
   */
  readonly planned: boolean
}

/** Panes in grid order: the two entry points first, then the working surfaces. */
const PANES: readonly Pane[] = [
  { label: 'paneAssets', planned: true },
  { label: 'paneResources', planned: true },
  { label: 'panePreview', planned: false },
  { label: 'paneTasks', planned: false },
]

const SURFACE = {
  display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px',
  font: 'inherit', color: 'inherit', height: '100%', boxSizing: 'border-box', overflow: 'auto',
} as const

/** One theme-neutral hairline; the theme pass replaces it with a Harness token. */
const HAIRLINE = '1px solid color-mix(in srgb, currentColor 18%, transparent)'

/** One pill in the header row. */
const PILL = { border: HAIRLINE, borderRadius: '999px', padding: '0 8px', fontSize: '12px', opacity: 0.8 } as const

/**
 * Render the workbench skeleton.
 * @param props - seat runtime hooks, the injected face, and localized copy.
 * @returns the skeleton surface.
 */
export function Workbench(props: WorkbenchProps): ReactNode {
  const { kind, t, useTabInfo, health } = props
  const [mode, setMode] = useState<WorkbenchMode>('quick')
  const [healthState, setHealthState] = useState<HealthState>({ status: 'checking' })
  const { sidebar, tab } = useTabInfo()

  // 注入面通过 ref 固定：座位可能每次渲染给出新的函数实例，直接写进依赖数组会让
  // 健康检查自我循环（一次渲染一次请求）。
  const healthRef = useRef(health)
  healthRef.current = health
  useEffect(() => {
    let alive = true
    healthRef.current().then(
      (value) => { if (alive) setHealthState({ status: 'ok', health: value }) },
      (error: unknown) => {
        if (alive) {
          setHealthState({ status: 'failed', message: error instanceof Error ? error.message : String(error) })
        }
      },
    )
    return () => { alive = false }
  }, [])

  const healthText = healthState.status === 'checking'
    ? t('healthChecking')
    : healthState.status === 'ok'
      ? `${healthState.health.version} · ${healthState.health.provider}`
      : t('healthFailed')

  return (
    <div
      style={SURFACE}
      data-workbench-kind={kind}
      data-workbench-visible={tab.visible ? 'true' : 'false'}
      data-workbench-fullscreen={sidebar.fullscreen ? 'true' : 'false'}
      data-workbench-health={healthState.status}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '13px' }}>{t('sectionProject')}</strong>
        <span style={{ fontSize: '13px', opacity: 0.7 }}>{t('projectNone')}</span>
        <span style={PILL}>{t('saveSaved')}</span>
        <span style={PILL} title={healthState.status === 'failed' ? healthState.message : undefined}>
          {healthText}
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
          <section
            key={pane.label}
            data-workbench-pane={pane.label}
            data-workbench-planned={pane.planned ? 'true' : 'false'}
            style={{ border: HAIRLINE, borderRadius: '8px', padding: '10px', minHeight: '88px' }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600 }}>{t(pane.label)}</h3>
            {pane.planned
              ? <p style={{ margin: 0, fontSize: '12px', opacity: 0.6 }}>{t('panePlanned')}</p>
              : null}
          </section>
        ))}
      </div>
    </div>
  )
}
