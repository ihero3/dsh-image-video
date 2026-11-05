// @vitest-environment jsdom
/**
 * 快速创作页的模块化分区（用户 2026-11-04）：
 *
 * 原来「一键成片」「快速创作」「展开高级」三块瀑布流堆在一起，分不清谁是谁。
 * 现在拆成 3 个编号模块卡：
 *   ① 剧本 → 成片（一键成片）
 *   ② 一句话出一镜（快速创作）
 *   ③ 高级设置（融合生图 / 提示词工坊 / 分镜 / 模型能力，默认收起）
 *
 * 断言的是**结构**：顺序、标题、各自的内容归属（生成输入框属于 ②，高级开关属于 ③）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 挂载工作台（默认就是「快速创作」模式）。 */
async function renderQuick() {
  const host = fakeApi()
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  await waitFor(() => {
    expect(view.container.querySelector('[data-quick-modules]')).toBeTruthy()
  })
  return { host, view }
}

describe('快速创作页 · 模块化分区', () => {
  it('renders three numbered modules in a fixed order', async () => {
    const { view } = await renderQuick()
    const modules = [...view.container.querySelectorAll('[data-quick-modules] > [data-module]')]
    expect(modules.map(element => element.getAttribute('data-module'))).toEqual(['pipeline', 'quick', 'advanced'])
    // 编号与标题
    expect(modules[0]!.querySelector('.iv-module-n')?.textContent).toBe('1')
    expect(modules[0]!.querySelector('[data-module-title="pipeline"]')?.textContent).toBe(en.modulePipeline)
    expect(modules[1]!.querySelector('[data-module-title="quick"]')?.textContent).toBe(en.moduleQuick)
    expect(modules[2]!.querySelector('[data-module-title="advanced"]')?.textContent).toBe(en.moduleAdvanced)
  })

  it('keeps each kind of input inside its own module, so the boundary is visible', async () => {
    const { view } = await renderQuick()
    const pipeline = view.container.querySelector('[data-module="pipeline"]') as HTMLElement
    const quick = view.container.querySelector('[data-module="quick"]') as HTMLElement
    const advanced = view.container.querySelector('[data-module="advanced"]') as HTMLElement

    // ① 剧本
    expect(pipeline.querySelector('[data-pipeline-script]')).toBeTruthy()
    expect(pipeline.querySelector('[data-generate-prompt]')).toBeNull()
    // ② 单条生成的提示词
    expect(quick.querySelector('[data-generate-prompt]')).toBeTruthy()
    expect(quick.querySelector('[data-pipeline-script]')).toBeNull()
    // ③ 高级抽屉（默认收起，开关就在这一块里）
    const toggle = advanced.querySelector('[data-advanced-toggle]') as HTMLElement
    expect(toggle).toBeTruthy()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const drawer = advanced.querySelector('[data-advanced-open]') as HTMLElement
    expect(drawer.hasAttribute('hidden')).toBe(true)

    // 2026-11-05 产品调整后的归属：融合生图进 ②（主路径入口）、手动分镜进 ①
    expect(quick.querySelector('[data-fusion-entry] [data-fusion]')).toBeTruthy()
    expect(pipeline.querySelector('[data-storyboard-entry] [data-storyboard]')).toBeTruthy()
    // 高级抽屉只剩低频工具（提示词工坊 / 输出空态），不再包含融合生图与分镜
    expect(advanced.querySelector('[data-fusion]')).toBeNull()
    expect(advanced.querySelector('[data-storyboard]')).toBeNull()

    // 展开后抽屉才出来
    fireEvent.click(toggle)
    await waitFor(() => { expect((advanced.querySelector('[data-advanced-open]') as HTMLElement).hasAttribute('hidden')).toBe(false) })
    expect(advanced.querySelector('[data-prompt-studio]')).toBeTruthy()
  })
})
