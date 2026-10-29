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

  it('根容器 .iv 自己撑满宽度（否则宿主 flex 包装会把它收缩成一条竖线）', () => {
    // 回归：宿主把 tab 内容挂进 display:flex;column 的容器，中间包装是 display:contents，
    // 于是 .iv 成为 flex item。只写 height:100% 时宽度会被收缩到内容最小宽（实测 8px），
    // 表现为"插件打不开/一片空白"。必须显式 width:100% + min-width:0。
    const rootRule = WORKBENCH_STYLE.match(/\.iv\{([^}]*)\}/)
    expect(rootRule).not.toBeNull()
    const body = rootRule?.[1] ?? ''
    expect(body).toContain('width:100%')
    expect(body).toContain('min-width:0')
    expect(body).toContain('height:100%')
  })
})
