// @vitest-environment jsdom
/**
 * 页面模块化分区（用户 2026-11-04；2026-11-20 拆出「剧本生成」模式）：
 *
 * - 快速创作页只有 1 个编号模块卡：① 一句话出一镜（单条生成 + 融合生图）
 * - 剧本生成页只有 1 个编号模块卡：① 剧本 → 成片（剧本、集 / 分段 / 分镜、
 *   模型与 Skill 选择、本集工作区）
 *
 * 断言的是**结构**：顺序、标题、各自的内容归属（生成输入框属于快速创作页）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, openCreateTab, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 切到某个模式页，并等目标模式页的标志元素出现。 */
async function switchMode(view: ReturnType<typeof render>, key: 'modeQuick' | 'modeScript', marker: string) {
  fireEvent.click(await screen.findByRole('button', { name: en[key] }))
  await waitFor(() => { expect(view.container.querySelector(marker)).toBeTruthy() })
}

/** 挂载工作台（默认就是「快速创作」模式）。 */
async function renderQuick() {
  const host = fakeApi()
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  await waitFor(() => {
    expect(view.container.querySelector('[data-quick-modules]')).toBeTruthy()
  })
  return { host, view }
}

/** 带一集剧本的挂载：剧本层级的选择器与工作区只有存在剧集时才渲染。 */
async function renderScriptWithEpisode() {
  const stamp = '2026-11-13T00:00:00.000Z'
  const host = fakeApi({
    episodes: [{
      schemaVersion: 1, id: 'ep-1', projectId: 'prj-1', no: 1, title: '第1集',
      script: { text: '', updatedAt: stamp }, segments: [], storyboards: [],
      resourceRefs: [], assetRefs: [], createdAt: stamp, updatedAt: stamp,
    }],
  })
  host.projects.push({ schemaVersion: 1, id: 'prj-1', name: '剧', createdAt: stamp, updatedAt: stamp } as never)
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  await switchMode(view, 'modeScript', '[data-module="pipeline"]')
  await waitFor(() => {
    expect(view.container.querySelector('[data-module="pipeline"] [data-episode-workspace]')).toBeTruthy()
  })
  return { host, view }
}

describe('页面 · 模块化分区', () => {
  it('renders one module per page, in a fixed order', async () => {
    const { view } = await renderQuick()
    const quickModules = [...view.container.querySelectorAll('[data-quick-modules] > [data-module]')]
    expect(quickModules.map(element => element.getAttribute('data-module'))).toEqual(['quick'])
    expect(quickModules[0]!.querySelector('.iv-module-n')?.textContent).toBe('1')
    expect(quickModules[0]!.querySelector('[data-module-title="quick"]')?.textContent).toBe(en.moduleQuick)

    // 「剧本生成」是独立模式页：① 剧本 → 成片
    await switchMode(view, 'modeScript', '[data-module="pipeline"]')
    const pipeline = view.container.querySelector('[data-module="pipeline"]') as HTMLElement
    expect(pipeline.querySelector('.iv-module-n')?.textContent).toBe('1')
    expect(pipeline.querySelector('[data-module-title="pipeline"]')?.textContent).toBe(en.modulePipeline)
    // 快速创作页不再承载剧本层级
    expect(view.container.querySelector('[data-quick-modules]')).toBeNull()
  })

  it('keeps each kind of input inside its own page, so the boundary is visible', async () => {
    const { view } = await renderScriptWithEpisode()

    // 剧本生成页：剧本卡 + 模型/Skill 选择器 + 本集工作区
    const pipeline = view.container.querySelector('[data-module="pipeline"]') as HTMLElement
    expect(pipeline.querySelector('[data-pipeline-script]')).toBeTruthy()
    expect(pipeline.querySelector('[data-script-selectors]')).toBeTruthy()
    expect(pipeline.querySelector('[data-episode-workspace]')).toBeTruthy()
    expect(pipeline.querySelector('[data-generate-prompt]')).toBeNull()
    // 2026-11-19（B-20）分镜工坊并入「一键成片」卡片，① 里不再有独立的分镜折叠区。
    expect(pipeline.querySelector('[data-pipeline-text-model]')).toBeTruthy()
    expect(pipeline.querySelector('[data-pipeline-import-file]')).toBeTruthy()
    expect(pipeline.querySelector('[data-storyboard-entry]')).toBeNull()

    // 快速创作页：单条生成的提示词 + 三种生成方式标签
    await switchMode(view, 'modeQuick', '[data-quick-modules]')
    const quick = view.container.querySelector('[data-module="quick"]') as HTMLElement
    expect(quick.querySelector('[data-generate-prompt]')).toBeTruthy()
    expect(quick.querySelector('[data-pipeline-script]')).toBeNull()
    expect(quick.querySelector('[data-create-tab="image"]')).toBeTruthy()
    expect(quick.querySelector('[data-create-tab="fusion"]')).toBeTruthy()
    expect(quick.querySelector('[data-create-tab="video"]')).toBeTruthy()
    // 融合生图是并列的第三种输入方式：切过去才渲染它的面板
    expect(quick.querySelector('[data-fusion]')).toBeNull()
    await openCreateTab(view, 'fusion')
    expect(quick.querySelector('[data-create-panel="fusion"] [data-fusion]')).toBeTruthy()
    expect(view.container.querySelector('[data-module="advanced"]')).toBeNull()
  })

  it('默认停在生图页，切到融合 / 生视频后提示词仍保留', async () => {
    const { view } = await renderQuick()
    expect(view.container.querySelector('[data-create-tab="image"]')?.getAttribute('aria-selected')).toBe('true')
    const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box, { target: { value: '雨夜霓虹，一名撑伞的少女' } })

    await openCreateTab(view, 'video')
    const videoBox = await screen.findByPlaceholderText(en.generatePromptPlaceholder) as HTMLTextAreaElement
    expect(videoBox.value).toBe('雨夜霓虹，一名撑伞的少女')

    fireEvent.click(view.container.querySelector('[data-create-tab="image"]') as HTMLElement)
    const backBox = await screen.findByPlaceholderText(en.generatePromptPlaceholder) as HTMLTextAreaElement
    expect(backBox.value).toBe('雨夜霓虹，一名撑伞的少女')
  })

  it('collapses a whole module from the toggle at the far right of its header (2026-11-05)', async () => {
    const { view } = await renderQuick()
    const body = (key: string): HTMLElement => view.container.querySelector(`[data-module-body="${key}"]`) as HTMLElement
    const toggle = (key: string): HTMLElement => view.container.querySelector(`[data-module-toggle="${key}"]`) as HTMLElement

    // 快速创作页：① 默认展开，收起后整块内容藏起来
    expect(body('quick').hasAttribute('hidden')).toBe(false)
    fireEvent.click(toggle('quick'))
    await waitFor(() => { expect(body('quick').hasAttribute('hidden')).toBe(true) })
    expect(toggle('quick').getAttribute('aria-expanded')).toBe('false')

    // 剧本生成页：① 同样可整块收起（剧本卡 + 分层结构一起藏起来）
    await switchMode(view, 'modeScript', '[data-module="pipeline"]')
    expect(body('pipeline').hasAttribute('hidden')).toBe(false)
    expect(toggle('pipeline').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle('pipeline'))
    await waitFor(() => { expect(body('pipeline').hasAttribute('hidden')).toBe(true) })
    expect(toggle('pipeline').getAttribute('aria-expanded')).toBe('false')
    expect(toggle('pipeline').textContent).toContain(en.moduleExpand)

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
    await waitFor(() => { expect(view.container.querySelector('[data-model-details-toggle]')).toBeTruthy() })
    // ① 入口在「当前生效参数」条的最右侧（同一条行内、靠右）
    const params = view.container.querySelector('[data-workbench-defaults]') as HTMLElement
    const toggle = view.container.querySelector('[data-model-details-toggle]') as HTMLButtonElement
    expect(params.contains(toggle)).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.style.marginLeft).toBe('auto')
    // ② 默认不展开
    expect(view.container.querySelector('[data-model-details]')).toBeNull()
    // ③ 点一下展开：内容仍是壳层级（不属于任何模块），位置在参数条之后、创建面板之前
    fireEvent.click(toggle)
    await waitFor(() => { expect(view.container.querySelector('[data-model-details]')).toBeTruthy() })
    const details = view.container.querySelector('[data-model-details]') as HTMLElement
    expect(view.container.querySelector('[data-module] [data-model-details]')).toBeNull()
    const pane = view.container.querySelector('[data-workbench-pane="paneCreate"]') as HTMLElement
    expect(params.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(details.compareDocumentPosition(pane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // ④ 再点一下收起
    fireEvent.click(toggle)
    await waitFor(() => { expect(view.container.querySelector('[data-model-details]')).toBeNull() })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
})
