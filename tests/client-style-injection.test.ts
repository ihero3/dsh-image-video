// @vitest-environment jsdom
/**
 * The injected stylesheet must never outlive its module.
 *
 * The host keeps document-level `<style>` nodes across plugin module reloads, so a
 * "skip when the id already exists" guard leaves the *previous* version's rules in
 * place while the new JSX renders — markup and CSS come from different revisions
 * and the layout garbles (labels on the same line as their controls, rows overlapping).
 * The hook therefore always reconciles the sheet with the version it ships.
 */
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WORKBENCH_STYLE, WORKBENCH_STYLE_ID, WORKBENCH_STYLE_VERSION, useWorkbenchStyle } from '../src/client/workbench-style.ts'

const sheet = (): HTMLStyleElement => document.getElementById(WORKBENCH_STYLE_ID) as HTMLStyleElement

afterEach(() => {
  cleanup()
  document.head.querySelectorAll(`#${WORKBENCH_STYLE_ID}`).forEach(node => { node.remove() })
})

describe('workbench stylesheet injection', () => {
  it('injects the current sheet and stamps its version', () => {
    renderHook(() => useWorkbenchStyle())
    expect(document.head.querySelectorAll(`#${WORKBENCH_STYLE_ID}`)).toHaveLength(1)
    expect(sheet().textContent).toBe(WORKBENCH_STYLE)
    expect(sheet().dataset.version).toBe(WORKBENCH_STYLE_VERSION)
  })

  it('rewrites a sheet left behind by a previous module version', () => {
    const stale = document.createElement('style')
    stale.id = WORKBENCH_STYLE_ID
    stale.textContent = '.iv{--iv-panel:transparent}'
    stale.dataset.version = 'previous'
    document.head.append(stale)

    renderHook(() => useWorkbenchStyle())

    // 复用同一个节点（不叠加第二张表），内容与版本戳都被换成当前这份。
    expect(document.head.querySelectorAll(`#${WORKBENCH_STYLE_ID}`)).toHaveLength(1)
    expect(sheet()).toBe(stale)
    expect(sheet().textContent).toBe(WORKBENCH_STYLE)
    expect(sheet().dataset.version).toBe(WORKBENCH_STYLE_VERSION)
  })

  it('keeps the surface tokens opaque so overlays cannot read through', () => {
    // 层叠面板用透明叠色兜底时，浮层下的文字会透出来；这里锁住"面板取层级令牌"。
    expect(WORKBENCH_STYLE).toContain('--iv-panel:var(--dsw-alias-bg-layer-1')
    expect(WORKBENCH_STYLE).toContain('--iv-surface:color-mix(in srgb,var(--iv-panel)')
    expect(WORKBENCH_STYLE).not.toContain('--dsw-alias-bg-l1')
  })
})
