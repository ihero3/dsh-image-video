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
import { type ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
import type { WorkbenchHealth } from '../workbench-contract.ts';
/** Injected share the client plugin binds once. */
export interface WorkbenchInjected {
    /** Registered tab kind, echoed in the header so the seat wiring is visible at a glance. */
    kind: string;
    /** Host answer for the workbench channel's `health` endpoint. */
    health: () => Promise<WorkbenchHealth>;
}
/** The three modes the workbench offers. */
export type WorkbenchMode = 'quick' | 'workflow' | 'timeline';
/** Props the right-pane seat binds for this body. */
export type WorkbenchProps = PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<WorkbenchInjected> & PropsLocale<typeof NS>;
/**
 * Render the workbench skeleton.
 * @param props - seat runtime hooks, the injected face, and localized copy.
 * @returns the skeleton surface.
 */
export declare function Workbench(props: WorkbenchProps): ReactNode;
