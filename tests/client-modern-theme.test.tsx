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
import { WORKBENCH_STYLE, WORKBENCH_STYLE_ID } from '../src/client/workbench-style.ts'
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

  it('分镜提示词区：模型行紧贴输入框，下一组提示词留间隔，字段不被 flex-basis 撑高', () => {
    // 纵向 flex 下 .iv-sb-field 的 flex:1 1 150px 会落在高度轴上，把提示词 label 拉高，
    // textarea 下方的空白会一路把模型行顶远；必须局部复位为内容高度。
    expect(WORKBENCH_STYLE).toContain('.iv-shot-prompt-main>.iv-sb-field{flex:0 0 auto}')
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-shot-prompt-main>.iv-sb-field{flex:0 0 auto}')
    // 输入框 → 模型行用紧凑间距；模型行 → 下一组提示词另加间隔，形成视觉分组
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-shot-prompt-main{display:flex;flex-direction:column;gap:4px;min-width:0}')
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-shot-prompt-main>.iv-shot-tool-row+.iv-sb-field{margin-top:8px}')
    // 通用 textarea 的 84px 最小高度会在两行提示词内部留空，分镜区要收窄
    const baseTextarea = MODERN_THEME_STYLE.indexOf('.iv .iv-textarea,.iv textarea.iv-input{')
    const shotTextarea = MODERN_THEME_STYLE.indexOf('.iv .iv-shot-prompt-main textarea.iv-input{min-height:56px}')
    expect(shotTextarea).toBeGreaterThan(baseTextarea)
  })

  it('生图/生视频按钮的 hover 与静止态不同（鼠标移上有明确反馈）', () => {
    // primary（生成分镜脚本）与 soft（一键生图/生视频、逐镜生成）都要有独立 hover 规则
    for (const variant of ['primary', 'soft']) {
      const base = `.iv .iv-btn--action--${variant}{`
      const hover = `.iv .iv-btn--action--${variant}:hover:not(:disabled){`
      expect(MODERN_THEME_STYLE, `缺少静止态 ${base}`).toContain(base)
      const hoverAt = MODERN_THEME_STYLE.indexOf(hover)
      expect(hoverAt, `缺少 hover 规则 ${hover}`).toBeGreaterThan(-1)
      // hover 规则体里要有真实的视觉变化，不能与静止态一样只有背景色声明
      const hoverBody = MODERN_THEME_STYLE.slice(hoverAt, MODERN_THEME_STYLE.indexOf('}', hoverAt))
      expect(hoverBody).toMatch(/box-shadow|transform|background:var\(--iv-solid-hover\)|border-color:var\(--iv-acc\)/)
    }
    // 按下要有回落反馈，且尊重减少动效偏好
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-btn--action:active:not(:disabled){')
    expect(MODERN_THEME_STYLE).toContain('prefers-reduced-motion:reduce')
  })

  it('快速创作 v1.2：新结构必须有样式，旧 module 分隔线不能漏到 quick 容器', () => {
    for (const rule of [
      '.iv .iv-pane--compact{',
      '.iv .iv-create-tabs .iv-btn.iv-btn--acc{',
      '.iv .iv-qc-field{',
      '.iv .iv-ref-grid{',
      '.iv .iv-ref-cell--base{',
      '.iv .iv-advanced-head::-webkit-details-marker{',
      '.iv .iv-gen-separator{',
      '.iv .iv-modules--quick,.iv .iv-module--quick{padding-top:0;border-top:0;gap:0}',
    ]) {
      expect(MODERN_THEME_STYLE, `缺少快速创作规则 ${rule}`).toContain(rule)
    }
    // 添加入口是 RefPickField：必须把触发按钮撑成网格单元，否则仍是 26px 小胶囊
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-ref-add-cell .iv-pick>.iv-btn{')
    // 网格列宽必须有上限，否则宽面板里每个缩略图被拉成 280px 的大黑块
    expect(MODERN_THEME_STYLE).toContain('grid-template-columns:repeat(auto-fill,minmax(88px,120px))')
    // 折叠箭头与网格过渡都要尊重减少动效偏好
    expect(MODERN_THEME_STYLE).toContain('prefers-reduced-motion:reduce){.iv .iv-ref-cell')
  })

  it('次级入口是带图标的胶囊切换，字段说明不横向铺满（2026-11-26）', () => {
    // 内容生产 / 提取提示词：整组一个胶囊底，激活项浮起，图标继承文字色（激活变强调色）
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-quick-tabs--minor{display:flex;align-items:center')
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-quick-tabs--minor .iv-btn .iv-ico{flex:none;margin-right:var(--iv-sp-1)')
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-quick-tabs--minor .iv-btn.is-active .iv-ico')
    // 字段说明按内容宽度收口：1000px 宽面板里不该拉成一条横幅
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-qc-field>.iv-qc-field-hint{align-self:flex-start;max-width:56ch')
  })

  it('结果展示按素材自身比例，预览舞台随内容高度自适应（2026-11-26）', () => {
    // 固定 96×96 + cover 会把横图两侧、竖图上下各裁掉一截，只剩中间一块
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-last-result-media{width:auto;height:auto;max-width:min(200px,100%);max-height:160px;object-fit:contain')
    // 舞台高度由内容决定（小图不被拉成 320px 高），超大时才封顶
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-dock-preview{height:auto;min-height:160px;max-height:min(52vh,420px)}')
    // 双击放大态必须解除上面那套上限，否则放大后反而更小
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-dock-preview--expanded{min-height:0;max-height:none}')
  })

  it('视频槽位（首帧/尾帧/参考视频）给足缩略图尺寸，不被徽章胶囊压扁（2026-11-26）', () => {
    // .iv-chip 是 19px 高的徽章胶囊；槽位直接复用它会把缩略图压成一条横杠
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-slot-row .iv-chip{height:auto;max-width:min(440px,100%)')
    // 缩略图给到 64×40 并按 contain 完整展示，避免竖图被裁
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-slot-row .iv-ref-thumb{width:64px;height:40px;flex:none')
    expect(MODERN_THEME_STYLE).toContain('object-fit:contain;background:var(--iv-monitor)}')
    // 文件名给足宽度，否则只剩前几位时间戳
    expect(MODERN_THEME_STYLE).toContain('.iv .iv-slot-row .iv-ellipsis{max-width:220px')
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
