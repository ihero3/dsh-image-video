// @vitest-environment jsdom
/**
 * 设计系统契约（Round 6 / R6-0）。
 *
 * 目的不是"再测一遍业务"，而是把**设计语言的形状**钉住，防止后续打磨时无意识破坏：
 * - 图标：24 视窗 / 1.8 描边 / 圆角线帽 / fill=none / aria-hidden，且每个名字都真有图形；
 * - 令牌：基础面色与文字色必须在样式表里定义（否则 `var()` 会静默退化成透明）；
 * - 结构：`.iv-pane` 不得嵌套（嵌套会得到双边框、双内边距）。
 *
 * 只断言**当前已成立**的事实。目标是"改完才成立"的契约放在文件末尾用 `it.todo` 占位，
 * 由对应批次启用（写早了会当场把 gate 弄红，反而逼人删测试）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { BrandMark, ICON_NAMES, Icon } from '../src/client/icons.tsx'
import { WORKBENCH_STYLE } from '../src/client/workbench-style.ts'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { cleanup, clientProps, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/**
 * 面板骨架契约：标题必须在内容之前，子区块不得抢在标题前，且不再有 `.iv-pane-body` 这层空壳。
 *
 * 只对"有 `.iv-pane-head` 的 pane"生效——quick 页是 hero 布局，本来就没有 head。
 */
function assertPaneSkeleton(container: HTMLElement): number {
  const panes = [...container.querySelectorAll('.iv-pane')]
  expect(panes.length).toBeGreaterThan(0)
  let checked = 0

  for (const pane of panes) {
    const children = [...pane.children]
    const headIndex = children.findIndex(el => el.classList.contains('iv-pane-head'))
    if (headIndex === -1) continue
    checked += 1
    const name = pane.getAttribute('data-workbench-pane') ?? '(未命名 pane)'

    // 1) head 必须是第一个可渲染子元素
    expect(headIndex, `${name}: 首个可渲染子元素不是 .iv-pane-head`).toBe(0)

    // 2) 子区块只能出现在 head 之后
    const subIndexes = children
      .map((el, index) => (el.classList.contains('iv-sub') ? index : -1))
      .filter(index => index !== -1)
    for (const index of subIndexes) {
      expect(index, `${name}: .iv-sub 出现在 pane-head 之前`).toBeGreaterThan(headIndex)
    }
  }

  // 3) `.iv-pane-body` 已删除（它与 .iv-pane 声明相同，是纯冗余层）
  expect(container.querySelector('.iv-pane-body')).toBeNull()
  return checked
}

describe('图标风格契约', () => {
  it('每个 IconName 都渲染出符合规范的 svg', () => {
    const view = render(
      <div>
        {ICON_NAMES.map(name => <Icon key={name} name={name} />)}
      </div>,
    )
    const svgs = [...view.container.querySelectorAll('svg')]
    expect(svgs).toHaveLength(ICON_NAMES.length)

    for (const [index, svg] of svgs.entries()) {
      const name = ICON_NAMES[index]!
      // 视窗与描边：全套共用一个网格，混入异风格图标会在这里被拦住
      expect(svg.getAttribute('viewBox'), `${name}: viewBox`).toBe('0 0 24 24')
      expect(svg.getAttribute('stroke-width'), `${name}: stroke-width`).toBe('1.8')
      expect(svg.getAttribute('stroke-linecap'), `${name}: linecap`).toBe('round')
      expect(svg.getAttribute('stroke-linejoin'), `${name}: linejoin`).toBe('round')
      expect(svg.getAttribute('stroke'), `${name}: stroke`).toBe('currentColor')
      // 描边图标不填充：填充会把 1.8 描边的细节糊掉
      expect(svg.getAttribute('fill'), `${name}: fill`).toBe('none')
      // 装饰图标对辅助技术隐藏，语义由宿主按钮的 aria-label 承担
      expect(svg.getAttribute('aria-hidden'), `${name}: aria-hidden`).toBe('true')
      expect(svg.getAttribute('focusable'), `${name}: focusable`).toBe('false')
      // 名字进了表就必须真有图形（path 或 SHAPES 的多个元素）
      expect(svg.children.length, `${name}: 空图形`).toBeGreaterThan(0)
    }
  })

  it('品牌标是唯一的填充标，且同样使用 24 网格', () => {
    const view = render(<BrandMark />)
    const svg = view.container.querySelector('svg')!
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.getAttribute('fill')).toBe('currentColor')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    // 填充标不该带描边属性，否则会在 24 网格上二次加粗
    expect(svg.getAttribute('stroke')).toBeNull()
  })

  it('默认尺寸 14px，与 11–12px 正文搭配', () => {
    const view = render(<Icon name="film" />)
    const svg = view.container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('14')
    expect(svg.getAttribute('height')).toBe('14')
  })
})

describe('设计令牌契约', () => {
  const REQUIRED = [
    '--iv-panel', '--iv-panel-2', '--iv-panel-3', '--iv-surface',
    '--iv-line', '--iv-line-2',
    '--iv-tx', '--iv-tx2', '--iv-tx3',
    '--iv-acc', '--iv-acc-soft', '--iv-on-acc',
    '--iv-ok', '--iv-warn', '--iv-danger',
    '--iv-ok-soft', '--iv-warn-soft', '--iv-danger-soft',
    '--iv-monitor', '--iv-r', '--iv-mono',
  ]

  it('基础面色 / 文字色 / 语义色都在 .iv 作用域内定义', () => {
    for (const token of REQUIRED) {
      // 必须是"定义"（`--iv-x:`）而不是"使用"（`var(--iv-x)`）
      expect(WORKBENCH_STYLE.includes(`${token}:`), `缺少令牌定义 ${token}`).toBe(true)
    }
  })

  it('视频监视器恒深，不跟随主题', () => {
    // 监视器用固定深色字面量；一旦有人把它改成 host 令牌，调色判断会被界面底色干扰
    expect(WORKBENCH_STYLE).toMatch(/--iv-monitor:\s*#0a0b0d/)
  })
})

describe('结构契约', () => {
  it('.iv-pane 不嵌套（嵌套会得到双边框 / 双内边距）', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    // 等到工作台真正挂载完（避免在空容器上做"没有嵌套"的空断言）
    expect(view.container.querySelector('.iv')).toBeTruthy()

    const panes = [...view.container.querySelectorAll('.iv-pane')]
    expect(panes.length).toBeGreaterThan(0)
    expect(view.container.querySelectorAll('.iv-pane .iv-pane')).toHaveLength(0)
  })
})

describe('令牌化契约（R6-1）', () => {
  it('间距令牌 --iv-sp-1..6 存在', () => {
    for (let i = 1; i <= 6; i += 1) {
      expect(WORKBENCH_STYLE.includes(`--iv-sp-${i}:`), `缺少 --iv-sp-${i}`).toBe(true)
    }
  })

  it('字号 / 字重 / 圆角 / 层级 / 动效 / 阴影令牌存在', () => {
    const tokens = [
      '--iv-fs-root', '--iv-fs-metric', '--iv-fs-title', '--iv-fs-strong',
      '--iv-fs-body', '--iv-fs-meta', '--iv-fs-micro', '--iv-fs-tick',
      '--iv-fw-regular', '--iv-fw-medium', '--iv-fw-bold',
      '--iv-r-xs', '--iv-r-sm', '--iv-r-lg', '--iv-r-xl', '--iv-r-pill',
      '--iv-z-sticky', '--iv-z-playhead', '--iv-z-tip', '--iv-z-overlay',
      '--iv-dur-1', '--iv-dur-2', '--iv-dur-3', '--iv-ease',
      '--iv-shadow-acc', '--iv-shadow-acc-hover', '--iv-shadow-2', '--iv-shadow-3',
    ]
    for (const token of tokens) {
      expect(WORKBENCH_STYLE.includes(`${token}:`), `缺少令牌定义 ${token}`).toBe(true)
    }
  })

  it('不再出现裸 gap——防止"再来一个 7px"', () => {
    // 例外只有 gap:0（轨道头内部不需要行间距），故只禁像素值
    expect(WORKBENCH_STYLE.match(/gap:[^;}]*\d+px/g) ?? []).toEqual([])
  })

  it('font-size / font-weight 只通过令牌取值', () => {
    expect(WORKBENCH_STYLE.match(/font-size:(?!var\()/g) ?? []).toEqual([])
    expect(WORKBENCH_STYLE.match(/font-weight:\d/g) ?? []).toEqual([])
  })

  it('border-radius 不再出现裸像素值（50% 圆形除外）', () => {
    expect(WORKBENCH_STYLE.match(/border-radius:\s*\d+px/g) ?? []).toEqual([])
  })

  it('z-index 不再出现裸数字', () => {
    expect(WORKBENCH_STYLE.match(/z-index:\d/g) ?? []).toEqual([])
  })

  it('主滚动区预留滚动条槽位，避免"有无滚动条"时内容横向抖动', () => {
    for (const selector of ['.iv-main{', '.iv-list{', '.iv-pop-panel{', '.iv-exports-list{']) {
      const at = WORKBENCH_STYLE.indexOf(selector)
      expect(at, `找不到 ${selector}`).toBeGreaterThan(-1)
      const rule = WORKBENCH_STYLE.slice(at, WORKBENCH_STYLE.indexOf('}', at))
      expect(rule.includes('scrollbar-gutter:stable'), `${selector} 缺少 scrollbar-gutter`).toBe(true)
    }
  })
})

describe('待启用契约（由对应批次改为 it）', () => {
  it('R6-2 quick 模式的 pane 骨架：标题在内容之前，无 pane-body', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    expect(view.container.querySelector('.iv')).toBeTruthy()
    expect(assertPaneSkeleton(view.container)).toBeGreaterThan(0)
  })

  it('R6-2 时间轴模式的 pane 骨架（子区块已移到主内容之后）', async () => {
    const host = fakeApi({
      assets: [{
        schemaVersion: 1, id: 'ast-v', projectId: 'prj-1', kind: 'video',
        path: '/tmp/outputs/clip.mp4', bytes: 1024, createdAt: '2026-10-16T00:00:00.000Z',
      }],
    })
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '结构契约',
      createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
    })
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
    // 时间轴模式会建一条默认轨道；等到轨道出现再检查结构
    await waitFor(() => { expect(view.container.querySelector('[data-timeline-lane="video"]')).toBeTruthy() })

    expect(assertPaneSkeleton(view.container)).toBeGreaterThan(0)
    // 配音卡与多比例导出必须落在 pane 内、且位于 pane-head 之后
    const pane = view.container.querySelector('[data-workbench-pane="paneTimeline"]') as HTMLElement
    expect(pane).toBeTruthy()
    const children = [...pane.children]
    const headIndex = children.findIndex(el => el.classList.contains('iv-pane-head'))
    // 配音卡（.iv-card）与多比例（.iv-sub）都是子区块，必须落在 pane-head 之后
    const blocks = children.filter(el => el.classList.contains('iv-sub') || el.classList.contains('iv-card'))
    expect(blocks.length, 'paneTimeline 应有两个子区块（配音卡 / 多比例）').toBeGreaterThanOrEqual(2)
    for (const block of blocks) {
      expect(children.indexOf(block)).toBeGreaterThan(headIndex)
    }
  })
})
