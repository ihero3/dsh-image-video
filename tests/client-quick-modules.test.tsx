// @vitest-environment jsdom
/**
 * 快速创作页的模块化分区（用户 2026-11-04）：
 *
 * 原来「一键成片」「快速创作」「展开高级」三块瀑布流堆在一起，分不清谁是谁。
 * 现在拆成 2 个编号模块卡（旧「高级设置」已下线，入口都在模块内或壳层）：
 *   ① 剧本 → 成片（一键成片）
 *   ② 一句话出一镜（快速创作）
 *
 * 断言的是**结构**：顺序、标题、各自的内容归属（生成输入框属于 ②）。
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
  it('renders two numbered modules in a fixed order', async () => {
    const { view } = await renderQuick()
    const modules = [...view.container.querySelectorAll('[data-quick-modules] > [data-module]')]
    expect(modules.map(element => element.getAttribute('data-module'))).toEqual(['pipeline', 'quick'])
    // 编号与标题
    expect(modules[0]!.querySelector('.iv-module-n')?.textContent).toBe('1')
    expect(modules[0]!.querySelector('[data-module-title="pipeline"]')?.textContent).toBe(en.modulePipeline)
    expect(modules[1]!.querySelector('[data-module-title="quick"]')?.textContent).toBe(en.moduleQuick)
  })

  it('keeps each kind of input inside its own module, so the boundary is visible', async () => {
    const { view } = await renderQuick()
    const pipeline = view.container.querySelector('[data-module="pipeline"]') as HTMLElement
    const quick = view.container.querySelector('[data-module="quick"]') as HTMLElement

    // ① 剧本
    expect(pipeline.querySelector('[data-pipeline-script]')).toBeTruthy()
    expect(pipeline.querySelector('[data-generate-prompt]')).toBeNull()
    // ② 单条生成的提示词
    expect(quick.querySelector('[data-generate-prompt]')).toBeTruthy()
    expect(quick.querySelector('[data-pipeline-script]')).toBeNull()

    // 2026-11-05 产品调整后的归属：融合生图进 ②（主路径入口）、手动分镜进 ①；
    // 旧「高级设置」模块连同提示词工坊入口已下线（工坊在「提示词·分镜」标签页）。
    expect(quick.querySelector('[data-fusion-entry] [data-fusion]')).toBeTruthy()
    expect(pipeline.querySelector('[data-storyboard-entry] [data-storyboard]')).toBeTruthy()
    expect(view.container.querySelector('[data-module="advanced"]')).toBeNull()
  })

  it('collapses a whole module from the toggle at the far right of its header (2026-11-05)', async () => {
    const { view } = await renderQuick()
    const body = (key: string): HTMLElement => view.container.querySelector(`[data-module-body="${key}"]`) as HTMLElement
    const toggle = (key: string): HTMLElement => view.container.querySelector(`[data-module-toggle="${key}"]`) as HTMLElement

    // 默认展开
    expect(body('pipeline').hasAttribute('hidden')).toBe(false)
    expect(body('quick').hasAttribute('hidden')).toBe(false)
    expect(toggle('pipeline').getAttribute('aria-expanded')).toBe('true')

    // 收起模块①：整块内容（剧本卡 + 手动分镜）一起藏起来
    fireEvent.click(toggle('pipeline'))
    await waitFor(() => { expect(body('pipeline').hasAttribute('hidden')).toBe(true) })
    expect(toggle('pipeline').getAttribute('aria-expanded')).toBe('false')
    expect(toggle('pipeline').textContent).toContain(en.moduleExpand)
    // 另一个模块不受影响
    expect(body('quick').hasAttribute('hidden')).toBe(false)

    // 模块② 同理
    fireEvent.click(toggle('quick'))
    await waitFor(() => { expect(body('quick').hasAttribute('hidden')).toBe(true) })

    // 再点回来
    fireEvent.click(toggle('pipeline'))
    await waitFor(() => { expect(body('pipeline').hasAttribute('hidden')).toBe(false) })
  })

  it('clicking anywhere on the module header row toggles it (2026-11-05)', async () => {
    const { view } = await renderQuick()
    const head = view.container.querySelector('[data-module-toggle="quick"]') as HTMLButtonElement
    const body = view.container.querySelector('[data-module-body="quick"]') as HTMLElement
    // 整行就是一个 button：点标题文字区域（不是右边那枚小胶囊）也要能收起
    expect(head.tagName).toBe('BUTTON')
    const title = head.querySelector('[data-module-title="quick"]') as HTMLElement
    fireEvent.click(title)
    await waitFor(() => { expect(body.hasAttribute('hidden')).toBe(true) })
    expect(head.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(title)
    await waitFor(() => { expect(body.hasAttribute('hidden')).toBe(false) })
  })

  it('keeps 模型详情 at shell level, collapsed by default, between params and the notice (2026-11-06)', async () => {
    // 需要参数条存在（它只在宿主给了 defaults 时渲染），所以这里单独造 host
    const host = fakeApi({
      defaults: {
        mediaMode: null, imageProvider: 'threevideo', imageSize: '1024*1024', imageStyle: 'photo',
        videoProvider: 'threevideo', videoAspectRatio: '9:16', videoDuration: 10,
      },
    })
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '模型详情位置',
      createdAt: '2026-11-06T00:00:00.000Z', updatedAt: '2026-11-06T00:00:00.000Z',
    } as never)
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    await waitFor(() => { expect(view.container.querySelector('[data-model-details]')).toBeTruthy() })
    const details = view.container.querySelector('[data-model-details]') as HTMLDetailsElement
    // ① 在壳层级（不属于任何模块）
    expect(details).toBeTruthy()
    expect(view.container.querySelector('[data-module] [data-model-details]')).toBeNull()
    // ② 位置：参数条之后、创建面板之前（"引用到提示词"提示条就在这两者之间）
    const params = view.container.querySelector('[data-workbench-defaults]') as HTMLElement
    const pane = view.container.querySelector('[data-workbench-pane="paneCreate"]') as HTMLElement
    expect(params.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(details.compareDocumentPosition(pane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // ③ 默认收起，点标题展开、再点收起（行为与原来一致）
    expect(details.open).toBe(false)
    fireEvent.click(details.querySelector('summary') as HTMLElement)
    await waitFor(() => { expect(details.open).toBe(true) })
    fireEvent.click(details.querySelector('summary') as HTMLElement)
    await waitFor(() => { expect(details.open).toBe(false) })
  })
})
