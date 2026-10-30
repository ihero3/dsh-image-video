// @vitest-environment jsdom
/**
 * `T8` 高级抽屉：右栏只有 575px 宽（DSH 实测上限），三栏放不下；
 * 同宽度下的正解是**纵向分段 + 低频功能折叠**，让「提示词 → 参数 → 生成 → 结果」在主视线闭环。
 *
 * 断言：
 * 1. 默认收起：融合生图 / 提示词工坊 / 剧本分镜 / 模型能力卡都不可见；
 * 2. 收起时主视线内仍有 提示词 / 参数 / 模型选择 / 生成按钮（核心动线不被折叠）；
 * 3. 点开抽屉后四个区块全部出现；再点收起又隐藏；
 * 4. `aria-expanded` 与 `data-advanced-open` 同步（可访问性 + 可断言）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

function renderQuick() {
  const host = fakeApi({})
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '抽屉项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}


describe('高级抽屉（T8）', () => {
  it('默认收起：四个高级区块不可见，但核心动线仍在', async () => {
    const { view } = renderQuick()
    await waitFor(() => { expect(view.container.querySelector('[data-advanced-toggle]')).toBeTruthy() })

    const drawer = view.container.querySelector('[data-advanced-open]') as HTMLElement
    expect(drawer.getAttribute('data-advanced-open')).toBe('false')
    expect(drawer.hidden).toBe(true)

    // 核心动线不被折叠：提示词 / 三个参数 / 两个模型选择 / 生成按钮
    expect(view.container.querySelector('[data-generate-prompt]')).toBeTruthy()
    expect(view.container.querySelector('[data-generate-size]')).toBeTruthy()
    expect(view.container.querySelector('[data-generate-model="image"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: en.generateImage })).toBeTruthy()
  })

  it('点开后四个区块出现；再点收起', async () => {
    const { view } = renderQuick()
    const toggle = await waitFor(() => {
      const node = view.container.querySelector('[data-advanced-toggle]') as HTMLButtonElement
      expect(node).toBeTruthy()
      return node
    })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)
    await waitFor(() => {
      const drawer = view.container.querySelector('[data-advanced-open]') as HTMLElement
      expect(drawer.getAttribute('data-advanced-open')).toBe('true')
      expect(drawer.hidden).toBe(false)
    })
    // 四个区块都在抽屉里
    const drawer = view.container.querySelector('[data-advanced-open]') as HTMLElement
    expect(drawer.querySelector('[data-fusion]')).toBeTruthy()
    expect(drawer.querySelector('[data-prompt-studio]')).toBeTruthy()
    expect(drawer.querySelector('[data-storyboard]')).toBeTruthy()
    // aria-expanded 同步
    expect((view.container.querySelector('[data-advanced-toggle]') as HTMLElement).getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(view.container.querySelector('[data-advanced-toggle]') as HTMLElement)
    await waitFor(() => {
      expect((view.container.querySelector('[data-advanced-open]') as HTMLElement).hidden).toBe(true)
    })
  })

  it('开关文案随状态切换（展开/收起）', async () => {
    const { view } = renderQuick()
    const toggle = await waitFor(() => {
      const node = view.container.querySelector('[data-advanced-toggle]') as HTMLButtonElement
      expect(node).toBeTruthy()
      return node
    })
    expect(toggle.textContent).toContain(en.advancedExpand)
    fireEvent.click(toggle)
    await waitFor(() => {
      expect((view.container.querySelector('[data-advanced-toggle]') as HTMLElement).textContent).toContain(en.advancedCollapse)
    })
  })
})

