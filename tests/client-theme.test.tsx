// @vitest-environment jsdom
/**
 * B7 主题与响应式：明暗两套主题通过宿主变量（`--dsw-alias-*`）取得，不写死颜色；
 * 窄窗（<=768px）有一套紧凑排版规则。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, clientProps, fakeApi, render } from './client-fake-api.ts'
import { WORKBENCH_STYLE_ID } from '../src/client/workbench-style.ts'
import { Workbench } from '../src/client/Workbench.tsx'

afterEach(cleanup)

describe('B7 theme and responsive', () => {
  it('delegates text/theme color to host variables rather than hardcoding', () => {
    const host = fakeApi()
    render(<Workbench {...clientProps({ api: host.api })} />)
    const style = document.getElementById(WORKBENCH_STYLE_ID)
    expect(style).toBeTruthy()
    const css = style!.textContent ?? ''
    // 关键文字色 --iv-tx 由宿主变量 --dsw-alias-label-primary 提供，取不到再退到 currentColor
    expect(css).toContain('--iv-tx:var(--dsw-alias-label-primary')
    // 主体背景/边框同理走宿主别名变量（保证深浅两套主题都能套）
    expect(css).toContain('--dsw-alias-bg-layer-1')
  })

  it('ships a narrow-window (max-width: 768px) responsive rule', () => {
    const host = fakeApi()
    render(<Workbench {...clientProps({ api: host.api })} />)
    const css = document.getElementById(WORKBENCH_STYLE_ID)!.textContent ?? ''
    expect(css).toContain('@media (max-width:768px)')
  })
})
