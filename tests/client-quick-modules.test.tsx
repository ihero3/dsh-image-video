// @vitest-environment jsdom
/**
 * 页面模块化分区（用户 2026-11-04；2026-11-20 拆出「剧本生成」模式）：
 *
 * - 快速创作页只有 1 个编号模块卡：① 一句话出一镜（单条生成 + 融合生图）
 * - 剧本生成页有 2 个编号模块卡：① 剧本 → 成片（剧本 / 集 · 段 · 分镜规模 /
 *   文本模型与 Skill）、② 本集工作区（选集、模型 / Skill 选择、分段、分镜、
 *   生图生视频与工作流）。两卡并列、各自可展开合并。
 *
 * 断言的是**结构**：顺序、标题、各自的内容归属（生成输入框属于快速创作页）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, openCreateTab, render } from './client-fake-api.ts'
import type { SkillRecord } from '../src/workbench/skills.ts'

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
    expect(view.container.querySelector('[data-module="episode"] [data-episode-workspace]')).toBeTruthy()
  })
  return { host, view }
}

describe('页面 · 模块化分区', () => {
  it('renders one module per page, in a fixed order', async () => {
    const { view } = await renderQuick()
    const quickModules = [...view.container.querySelectorAll('[data-quick-modules] > [data-module]')]
    expect(quickModules.map(element => element.getAttribute('data-module'))).toEqual(['quick'])
    // v1.2：编号徽标 .iv-module-n 已删除；标题作为纯元数据由 hidden span 承载
    expect(quickModules[0]!.querySelector('[data-module-title="quick"]')?.textContent).toBe(en.moduleQuick)

    // 「剧本生成」是独立模式页：① 剧本 → 成片、② 本集工作区（并列）
    await switchMode(view, 'modeScript', '[data-module="pipeline"]')
    const scriptModules = [...view.container.querySelectorAll('.iv-modules > [data-module]')]
    expect(scriptModules.map(element => element.getAttribute('data-module'))).toEqual(['pipeline', 'episode'])
    const pipeline = view.container.querySelector('[data-module="pipeline"]') as HTMLElement
    // 2026-11-26：编号徽标与折叠头已删除，标题降级为 hidden 元数据，两层容器仍是测试契约
    expect(pipeline.querySelector('.iv-module-n')).toBeNull()
    expect(pipeline.querySelector('[data-module-toggle]')).toBeNull()
    expect(pipeline.querySelector('[data-module-title="pipeline"]')?.textContent).toBe(en.modulePipeline)
    expect(pipeline.querySelector('[data-module-title="pipeline"]')?.hasAttribute('hidden')).toBe(true)
    const episode = view.container.querySelector('[data-module="episode"]') as HTMLElement
    expect(episode.querySelector('.iv-module-n')).toBeNull()
    expect(episode.querySelector('[data-module-toggle]')).toBeNull()
    expect(episode.querySelector('[data-module-title="episode"]')?.textContent).toBe(en.moduleEpisode)
    expect(episode.querySelector('[data-module-title="episode"]')?.hasAttribute('hidden')).toBe(true)
    // 快速创作页不再承载剧本层级
    expect(view.container.querySelector('[data-quick-modules]')).toBeNull()
  })

  it('keeps each kind of input inside its own page, so the boundary is visible', async () => {
    const { view } = await renderScriptWithEpisode()

    // 剧本生成页：① 剧本卡（含导入与文本模型）；② 模型/Skill 选择器 + 本集工作区
    const pipeline = view.container.querySelector('[data-module="pipeline"]') as HTMLElement
    const episode = view.container.querySelector('[data-module="episode"]') as HTMLElement
    expect(pipeline.querySelector('[data-pipeline-script]')).toBeTruthy()
    expect(episode.querySelector('[data-script-selectors]')).toBeTruthy()
    expect(episode.querySelector('[data-episode-workspace]')).toBeTruthy()
    expect(pipeline.querySelector('[data-generate-prompt]')).toBeNull()
    // 2026-11-19（B-20）分镜工坊并入「一键成片」卡片，模块卡里不再有独立的分镜折叠区。
    expect(pipeline.querySelector('[data-pipeline-text-model]')).toBeTruthy()
    expect(pipeline.querySelector('[data-pipeline-import-file]')).toBeTruthy()
    expect(pipeline.querySelector('[data-storyboard-entry]')).toBeNull()

    // 快速创作页：单条生成的提示词 + 三种生成方式标签
    await switchMode(view, 'modeQuick', '[data-quick-modules]')
    const quick = view.container.querySelector('[data-module="quick"]') as HTMLElement
    expect(quick.querySelector('[data-generate-prompt]')).toBeTruthy()
    expect(quick.querySelector('[data-pipeline-script]')).toBeNull()
    expect(quick.querySelector('[data-create-tab="image"]')).toBeTruthy()
    expect(quick.querySelector('[data-create-tab="video"]')).toBeTruthy()
    expect(view.container.querySelector('[data-module="advanced"]')).toBeNull()
  })

  it('默认停在生图页，切到生视频后提示词仍保留', async () => {
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

  it('keeps both script modules flat and always visible (2026-11-26)', async () => {
    const { view } = await renderQuick()
    const body = (key: string): HTMLElement => view.container.querySelector(`[data-module-body="${key}"]`) as HTMLElement

    // 两个装饰性折叠头已删除：内容恒展开，容器与 data-module-body 仍在 DOM 供断言定位
    await switchMode(view, 'modeScript', '[data-module="pipeline"]')
    expect(body('pipeline').hasAttribute('hidden')).toBe(false)
    expect(body('episode').hasAttribute('hidden')).toBe(false)
    expect(view.container.querySelector('[data-module-toggle="pipeline"]')).toBeNull()
    expect(view.container.querySelector('[data-module-toggle="episode"]')).toBeNull()
  })

  // v1.2：原「点 module 标题行折叠」用例已删除——快速创作页不再有折叠按钮。
  // 剧本页的同类行为由上一个用例覆盖；module 骨架仍由结构断言守住。

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

  it('shows supported text models in the top params strip and shares the selection with module 2', async () => {
    const { view } = await renderScriptWithEpisode()
    await waitFor(() => { expect(view.container.querySelector('[data-workbench-text-model]')).toBeTruthy() })
    const top = view.container.querySelector('[data-workbench-text-model]') as HTMLSelectElement
    expect([...top.options].map(option => option.value)).toEqual(expect.arrayContaining(['rules', 'fake::fake-text']))
    const moduleSelect = () => view.container.querySelector('[data-script-text-model]') as HTMLSelectElement
    expect(moduleSelect().value).toBe('rules')
    fireEvent.change(top, { target: { value: 'fake::fake-text' } })
    await waitFor(() => { expect(moduleSelect().value).toBe('fake::fake-text') })
  })

  it('inserts a pipeline skill into the script and hides it from the dropdown', async () => {
    const stamp = '2026-11-24T00:00:00.000Z'
    const skill: SkillRecord = {
      schemaVersion: 1, id: 'skl-p', kind: 'director', name: '镜头感', description: '',
      prompt: 'prompt', builtin: false, enabled: true, createdAt: stamp, updatedAt: stamp,
    }
    const host = fakeApi({ skills: [skill] })
    host.projects.push({ schemaVersion: 1, id: 'prj-1', name: '剧', createdAt: stamp, updatedAt: stamp } as never)
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    await switchMode(view, 'modeScript', '[data-module="pipeline"]')
    const select = () => view.container.querySelector('[data-pipeline-skill]') as HTMLSelectElement
    const script = () => view.container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement
    await waitFor(() => { expect([...select().options].map(option => option.value)).toContain('skl-p') })
    fireEvent.change(select(), { target: { value: 'skl-p' } })
    await waitFor(() => {
      expect(script().value).toContain('【@镜头感】')
      expect([...select().options].map(option => option.value)).not.toContain('skl-p')
    })
    fireEvent.change(script(), { target: { value: '纯剧本' } })
    await waitFor(() => { expect([...select().options].map(option => option.value)).toContain('skl-p') })
  })
})
