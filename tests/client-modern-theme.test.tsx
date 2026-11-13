// @vitest-environment jsdom
/**
 * 统一视觉主题层的契约：把连接弹层的白卡片 / 胶囊 tab / 描边输入框 / 黑底主按钮
 * 推广到工作台、画布与引导层，且不能破坏既有设计系统样式表。
 *
 * Gate 关注三件事：
 * 1. 样式表按 id 幂等注入、热替换后能按版本自愈（与 workbench-style 同一机制）；
 * 2. 关键控件都有覆盖规则，且 CSS 字符串里没有会提前终止模板字符串的反引号；
 * 3. 三个界面入口都真的挂载了它，且主题层排在宿主样式表之后（能覆盖原规则）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import {
  MODERN_THEME_STYLE, MODERN_THEME_STYLE_ID, MODERN_THEME_VERSION, useModernTheme,
} from '../src/client/modern-theme.ts'
import { WORKBENCH_STYLE_ID } from '../src/client/workbench-style.ts'
import { Workbench } from '../src/client/Workbench.tsx'
import { GuideOverlay } from '../src/client/screens/GuideOverlay.tsx'
import { zh, type GuideLocaleKey } from '../src/client/screens/guide-locales.ts'
import { clientProps, fakeApi, render } from './client-fake-api.ts'

const sheet = (): HTMLStyleElement => document.getElementById(MODERN_THEME_STYLE_ID) as HTMLStyleElement

/** 主题层必须排在宿主表之后，否则同特异性规则会被原表压回去。 */
function expectAfterHost(): void {
  const styles = [...document.head.querySelectorAll('style')]
  const hostIndex = styles.findIndex(node => node.id === WORKBENCH_STYLE_ID)
  const themeIndex = styles.findIndex(node => node.id === MODERN_THEME_STYLE_ID)
  expect(hostIndex).toBeGreaterThan(-1)
  expect(themeIndex).toBeGreaterThan(hostIndex)
}

afterEach(() => {
  cleanup()
  document.head.querySelectorAll(`#${MODERN_THEME_STYLE_ID}`).forEach(node => { node.remove() })
})

describe('modern theme stylesheet injection', () => {
  it('injects the current sheet and stamps its version', () => {
    renderHook(() => useModernTheme())
    expect(document.head.querySelectorAll(`#${MODERN_THEME_STYLE_ID}`)).toHaveLength(1)
    expect(sheet().textContent).toBe(MODERN_THEME_STYLE)
    expect(sheet().dataset.version).toBe(MODERN_THEME_VERSION)
  })

  it('reuses one node across repeated mounts', () => {
    const first = renderHook(() => useModernTheme())
    const node = sheet()
    renderHook(() => useModernTheme())
    expect(document.head.querySelectorAll(`#${MODERN_THEME_STYLE_ID}`)).toHaveLength(1)
    expect(sheet()).toBe(node)
    first.unmount()
  })

  it('rewrites a sheet left behind by a previous module version', () => {
    const stale = document.createElement('style')
    stale.id = MODERN_THEME_STYLE_ID
    stale.textContent = '.iv{--iv-fs-root:9px}'
    stale.dataset.version = 'previous'
    document.head.append(stale)

    renderHook(() => useModernTheme())

    expect(document.head.querySelectorAll(`#${MODERN_THEME_STYLE_ID}`)).toHaveLength(1)
    expect(sheet()).toBe(stale)
    expect(sheet().textContent).toBe(MODERN_THEME_STYLE)
    expect(sheet().dataset.version).toBe(MODERN_THEME_VERSION)
  })
})

describe('modern theme coverage', () => {
  it('has no backticks in the CSS string', () => {
    expect(MODERN_THEME_STYLE).not.toContain('`')
  })

  it('covers fonts, tabs, buttons, inputs and the guide layer', () => {
    for (const selector of [
      '--iv-fs-root:13px',
      '--iv-acc:var(--iv-solid)',
      '.iv .iv-modes{',
      '.iv .iv-tabs',
      '.iv .iv-quick-tabs .iv-btn--acc',
      '.iv .iv-btn{',
      '.iv .iv-btn--acc',
      '.iv .iv-input,.iv .iv-select{',
      '.iv textarea.iv-input',
      '.iv .iv-pane{',
      '.ivg-mask .ivg-btn{',
      '.ivg-mask .ivg-select',
    ]) {
      expect(MODERN_THEME_STYLE, `缺少覆盖规则 ${selector}`).toContain(selector)
    }
  })

  it('keeps every selector scoped to the plugin (no bare global overrides)', () => {
    // 每条规则独占一行；只取含选择器的行，跳过根块的属性行与 @media 包裹行。
    const rules = MODERN_THEME_STYLE
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.includes('{') && !line.startsWith('@media'))
    expect(rules.length).toBeGreaterThan(30)
    for (const rule of rules) {
      expect(/^\.iv[\s{]|^\.ivg-mask[\s{]/.test(rule), `未限定作用域: ${rule}`).toBe(true)
    }
  })
})

describe('modern theme mounting', () => {
  it('Workbench mounts the theme after the workbench stylesheet', () => {
    const host = fakeApi()
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    expect(view.container.querySelector('.iv')).toBeTruthy()
    expect(sheet().textContent).toBe(MODERN_THEME_STYLE)
    expectAfterHost()
  })

  it('GuideOverlay mounts the theme even without the workbench shell', () => {
    render(
      <GuideOverlay
        t={(key: GuideLocaleKey) => zh[key]}
        ffmpeg={{ ok: true }}
        outputsDir="/tmp/outputs"
        models={[]}
        onOpenConnect={vi.fn()}
        onDone={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(document.querySelector('.ivg-mask')).toBeTruthy()
    expect(sheet().textContent).toBe(MODERN_THEME_STYLE)
  })
})
