/**
 * Workbench surface: the right-pane tab body.
 *
 * Phase 1 shipped the skeleton and the host health check; this is the first
 * *usable* slice — create and pick a project, register a file from the output
 * directory as its asset, preview it, and remove records again. Everything it
 * does goes through the injected `api` (the `/image-video` channel), so no part
 * of this component reaches into the host directly.
 *
 * Colours stay theme-neutral (`currentColor` + `color-mix`) until the theme pass
 * (`R-NFR-3`) switches every surface to the Harness CSS variables.
 */
import { type ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorkbenchApi } from './api.ts';
import { NS } from './locales.ts';
/** Injected share the client plugin binds once. */
export interface WorkbenchInjected {
    /** Registered tab kind, echoed in the header so the seat wiring is visible at a glance. */
    kind: string;
    /** Host API over the workbench channel. */
    api: WorkbenchApi;
}
/** The three modes the workbench offers. */
export type WorkbenchMode = 'quick' | 'workflow' | 'timeline';
/** Props the right-pane seat binds for this body. */
export type WorkbenchProps = PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<WorkbenchInjected> & PropsLocale<typeof NS>;
/**
 * Render the workbench.
 * @param props - seat runtime hooks, the injected API, and localized copy.
 * @returns the workbench surface.
 */
export declare function Workbench(props: WorkbenchProps): ReactNode;
