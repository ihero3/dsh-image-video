// @vitest-environment jsdom
/**
 * B2 列表虚拟化：超过 100 条只渲染可视区（保持键盘与 aria 行为）。
 *
 * 断言分两层：纯窗口数学（`visibleWindow`）+ 集成 DOM（1000 条数据下
 * 素材面板实际渲染的 `.iv-row` 节点数 < 60）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import {
  VIRTUALIZE_THRESHOLD, visibleWindow,
} from '../src/client/VirtualList.tsx'
import { clientProps, cleanup, fakeApi, render, screen } from './client-fake-api.ts'
import type { AssetRecord, ProjectRecord } from '../src/workbench/records.ts'

afterEach(cleanup)

/** 造 n 条图片素材（都挂在 prj-1 下）。 */
function makeAssets(count: number): AssetRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    schemaVersion: 1 as const,
    id: `ast-${index}`,
    projectId: 'prj-1',
    kind: 'image' as const,
    path: `/tmp/outputs/shot-${index}.png`,
    bytes: 1024,
    createdAt: '2026-10-14T00:00:00.000Z',
  }))
}

/** 用一个已存在的项目 + n 条素材挂载工作台。 */
function renderWithAssets(count: number) {
  const host = fakeApi({ assets: makeAssets(count) })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '大体量项目',
    createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
  } satisfies ProjectRecord)
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 素材面板当前渲染的行数。 */
function renderedRows(view: ReturnType<typeof render>): number {
  return view.container.querySelectorAll('[data-workbench-pane="paneAssets"] .iv-row').length
}

describe('B2 list virtualization', () => {
  it('computes the visible window with overscan and spacers', () => {
    // 1000 条、视口 240px、行高 28px：首屏 9 行 + 上下各 6 行缓冲
    const first = visibleWindow({ scrollTop: 0, viewportHeight: 240, total: 1000 })
    expect(first.start).toBe(0)
    expect(first.end).toBe(15)
    expect(first.topHeight).toBe(0)
    expect(first.totalHeight).toBe(28_000)
    expect(first.bottomHeight).toBe(28_000 - 15 * 28)

    // 滚到第 100 行：窗口前移，顶占位 = 94 行高
    const scrolled = visibleWindow({ scrollTop: 100 * 28, viewportHeight: 240, total: 1000 })
    expect(scrolled.start).toBe(94)
    expect(scrolled.end).toBe(115)
    expect(scrolled.topHeight).toBe(94 * 28)

    // 贴底：末行不越界
    const bottom = visibleWindow({ scrollTop: 28_000, viewportHeight: 240, total: 1000 })
    expect(bottom.end).toBe(1000)
    expect(bottom.bottomHeight).toBe(0)

    // 空列表与视口缺失（jsdom）都有确定值
    expect(visibleWindow({ scrollTop: 0, viewportHeight: 0, total: 0 })).toMatchObject({ start: 0, end: 0, totalHeight: 0 })
    expect(visibleWindow({ scrollTop: 0, viewportHeight: 0, total: 1000 }).end).toBe(15)
  })

  it(`renders every row when the list has ${VIRTUALIZE_THRESHOLD} items or fewer`, async () => {
    const { view } = renderWithAssets(VIRTUALIZE_THRESHOLD)
    await waitFor(() => {
      expect(view.container.querySelector('[data-workbench-assets]')?.getAttribute('data-workbench-assets'))
        .toBe(String(VIRTUALIZE_THRESHOLD))
    })
    // 阈值以下全量直出，不加占位节点
    expect(renderedRows(view)).toBe(VIRTUALIZE_THRESHOLD)
    expect(view.container.querySelectorAll('[data-workbench-pane="paneAssets"] li[aria-hidden="true"]')).toHaveLength(0)
  })

  it('renders only the visible window (plus overscan) for 1000 items', async () => {
    const { view } = renderWithAssets(1000)
    await waitFor(() => {
      expect(view.container.querySelector('[data-workbench-assets]')?.getAttribute('data-workbench-assets')).toBe('1000')
    })
    // 1000 条数据：渲染节点数 < 60（首屏 9 行 + 12 行缓冲 + 2 个占位）
    const rows = renderedRows(view)
    expect(rows).toBeLessThan(60)
    expect(rows).toBeGreaterThan(0)
    // 底占位 li 撑起滚动条（首屏顶占位为 0，不渲染），且对辅助技术隐藏
    expect(view.container.querySelectorAll('[data-workbench-pane="paneAssets"] li[aria-hidden="true"]')).toHaveLength(1)

    // 行仍可交互（键盘可达的按钮与 aria 名保持不变）
    const firstName = await screen.findByRole('button', { name: `${en.panePreview} shot-0.png` })
    fireEvent.click(firstName)
    await waitFor(() => {
      expect(view.container.querySelector('[data-workbench-pane="panePreview"] img')?.getAttribute('src'))
        .toBe('/outputs/shot-0.png')
    })
  })

  it('moves the window when the virtualized list is scrolled', async () => {
    const { view } = renderWithAssets(1000)
    await waitFor(() => { expect(renderedRows(view)).toBeGreaterThan(0) })
    const list = view.container.querySelector('[data-workbench-pane="paneAssets"] ul.iv-list') as HTMLElement
    expect(list).toBeTruthy()
    // 虚拟化分支给容器限高，超出部分内部滚动
    expect(list.style.maxHeight).toBeTruthy()

    // 滚到第 500 行附近：窗口跟着走，出现中段素材
    list.scrollTop = 500 * 28
    fireEvent.scroll(list)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: `${en.panePreview} shot-0.png` })).toBeNull()
    })
    expect(await screen.findByRole('button', { name: `${en.panePreview} shot-500.png` })).toBeTruthy()
    expect(renderedRows(view)).toBeLessThan(60)
  })
})
