// @vitest-environment jsdom
/**
 * `B-15` 分镜工坊：剧本 → `storyboard/plan` → 可编辑镜头表 → 带入生成 / 送入画布。
 *
 * 端点由 Track A 的 A-7 落地（v1.0.0）；本文件用假宿主验证界面行为：
 * 入参形状（projectId/script/shots?）、镜头增删改与重排序号、两个"送出"动作、
 * 空脚本/无项目的禁用护栏、宿主错误如实展示（不伪造镜头）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 一个项目 + 挂载好的工作台（默认就在快速模式；等项目列表异步落地）。 */
async function renderStoryboard() {
  const host = fakeApi()
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '分镜项目',
    createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  // 顶栏出现项目选择器 = 项目已加载且 activeId 已就位（按钮禁用护栏依赖它）
  await screen.findByRole('combobox', { name: en.sectionProject })
  return { host, view }
}

/** 等镜头表渲染出来（planStoryboard 是异步的）。 */
async function waitForShots(view: ReturnType<typeof render>): Promise<void> {
  await waitFor(() => { expect(view.container.querySelectorAll('[data-storyboard-shot]')).toHaveLength(2) })
}

/** 拆解一版两镜分镜（假宿主固定返回两镜）。 */
async function planTwoShots(view: ReturnType<typeof render>): Promise<void> {
  fireEvent.change(view.container.querySelector('[data-storyboard-script="true"]') as HTMLTextAreaElement, {
    target: { value: '晨光落在杯口。热气缓慢升腾。' },
  })
  fireEvent.click(view.container.querySelector('[data-storyboard-plan="true"]') as HTMLElement)
  await waitForShots(view)
}

/** 提示条文本（工作流/时间轴模式还有 role=status 的保存芯片，不能全局 getByRole）。 */
function noticeText(view: ReturnType<typeof render>): string {
  return view.container.querySelector('.iv-notice')?.textContent ?? ''
}

describe('B-15 storyboard workshop', () => {
  it('sends projectId + script (+ target shot count) to storyboard/plan', async () => {
    const { host, view } = await renderStoryboard()

    fireEvent.change(view.container.querySelector('[data-storyboard-script="true"]') as HTMLTextAreaElement, {
      target: { value: '晨光落在杯口。热气缓慢升腾。' },
    })
    fireEvent.click(view.container.querySelector('[data-storyboard-plan="true"]') as HTMLElement)
    await waitFor(() => { expect(host.storyboardPayloads).toHaveLength(1) })
    // 没填目标镜头数：不带 shots 字段（宿主按句数封顶）
    expect(host.storyboardPayloads[0]).toEqual({ projectId: 'prj-1', script: '晨光落在杯口。热气缓慢升腾。' })

    // 填了目标镜头数：按四舍五入下发
    fireEvent.change(view.container.querySelector('[data-storyboard-target="true"]') as HTMLInputElement, {
      target: { value: '3' },
    })
    fireEvent.click(view.container.querySelector('[data-storyboard-plan="true"]') as HTMLElement)
    await waitFor(() => { expect(host.storyboardPayloads).toHaveLength(2) })
    expect(host.storyboardPayloads[1]).toEqual({ projectId: 'prj-1', script: '晨光落在杯口。热气缓慢升腾。', shots: 3 })
  })

  it('keeps the plan button disabled until a script exists', async () => {
    const { view } = await renderStoryboard()
    const plan = view.container.querySelector('[data-storyboard-plan="true"]') as HTMLButtonElement
    // 空剧本：禁用（护栏在按钮上，不靠点击后的 notice）
    expect(plan.disabled).toBe(true)
    fireEvent.change(view.container.querySelector('[data-storyboard-script="true"]') as HTMLTextAreaElement, {
      target: { value: '有内容了' },
    })
    expect(plan.disabled).toBe(false)
  })

  it('edits a shot in place and sends its image prompt to the generate form', async () => {
    const { view } = await renderStoryboard()
    await planTwoShots(view)

    const prompt = view.container.querySelector('[data-storyboard-shot="0"] [data-storyboard-field="imagePrompt"]') as HTMLTextAreaElement
    fireEvent.change(prompt, { target: { value: '改过的图片提示词' } })

    fireEvent.click(view.container.querySelector('[data-storyboard-shot="0"] [data-storyboard-to-generate="0"]') as HTMLElement)
    // 只填表不自动生成：生成表单拿到编辑后的提示词
    const generatePrompt = view.container.querySelector('[data-generate-prompt="true"]') as HTMLTextAreaElement
    expect(generatePrompt.value).toBe('改过的图片提示词')
    expect(noticeText(view)).toContain(en.storyboardSentGenerate.replace('{n}', '1'))
  })

  it('sends a shot to the canvas image node, creating one when absent', async () => {
    const { host, view } = await renderStoryboard()
    await planTwoShots(view)

    fireEvent.click(view.container.querySelector('[data-storyboard-shot="1"] [data-storyboard-to-canvas="1"]') as HTMLElement)
    await waitFor(() => { expect(host.calls).toContain('workflows/save') })
    const saved = host.workflows[0]
    const imageNodes = saved?.nodes.filter(node => node.kind === 'image-generate') ?? []
    expect(imageNodes).toHaveLength(1)
    expect(imageNodes[0]?.params.prompt).toBe('热气缓慢升腾；电影感构图，主体清晰，光影统一')
    // 送入画布后切到工作流模式，让用户直接看见
    expect(view.container.querySelector('[data-workbench-pane="paneCanvas"]')).toBeTruthy()
    expect(noticeText(view)).toContain(en.storyboardSentCanvas.replace('{n}', '2'))
  })

  it('rewrites the prompt of an existing image node instead of adding another', async () => {
    const { host, view } = await renderStoryboard()
    host.workflows.push({
      schemaVersion: 1, id: 'wfl-seed', projectId: 'prj-1', name: '既有流程',
      nodes: [
        { id: 'n-img', kind: 'image-generate', position: { x: 0, y: 0 }, params: { prompt: '旧提示词' } },
        { id: 'n-script', kind: 'script', position: { x: 220, y: 0 }, params: { text: '一句' } },
      ],
      edges: [],
      createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z',
    })
    await planTwoShots(view)

    fireEvent.click(view.container.querySelector('[data-storyboard-shot="0"] [data-storyboard-to-canvas="0"]') as HTMLElement)
    await waitFor(() => { expect(host.calls).toContain('workflows/save') })
    const saved = host.workflows.find(workflow => workflow.id === 'wfl-seed')
    const imageNodes = saved?.nodes.filter(node => node.kind === 'image-generate') ?? []
    expect(imageNodes).toHaveLength(1)
    expect(imageNodes[0]?.params.prompt).toBe('晨光落在杯口；电影感构图，主体清晰，光影统一')
  })

  it('reorders, removes and adds shots with 1-based reindexing', async () => {
    const { view } = await renderStoryboard()
    await planTwoShots(view)

    const firstPrompt = () =>
      (view.container.querySelector('[data-storyboard-shot="0"] [data-storyboard-field="imagePrompt"]') as HTMLTextAreaElement).value
    const secondPrompt = () =>
      (view.container.querySelector('[data-storyboard-shot="1"] [data-storyboard-field="imagePrompt"]') as HTMLTextAreaElement).value
    const beforeFirst = firstPrompt()
    const beforeSecond = secondPrompt()

    // 下移第一镜：两镜交换，序号仍从 1 连续
    fireEvent.click(view.container.querySelector('[data-storyboard-shot="0"] [data-storyboard-down="0"]') as HTMLElement)
    expect(firstPrompt()).toBe(beforeSecond)
    expect(secondPrompt()).toBe(beforeFirst)
    const indices = [...view.container.querySelectorAll('.iv-sb-shot-index')].map(node => node.textContent)
    expect(indices).toEqual(['1', '2'])

    // 删掉第二镜：只剩一镜
    fireEvent.click(view.container.querySelector('[data-storyboard-shot="1"] [data-storyboard-remove="1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-storyboard-shot]')).toHaveLength(1) })
    expect([...view.container.querySelectorAll('.iv-sb-shot-index')].map(node => node.textContent)).toEqual(['1'])

    // 手动补一镜：新的空镜落在末尾，序号接上
    fireEvent.click(view.container.querySelector('[data-storyboard-add-bottom="true"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-storyboard-shot]')).toHaveLength(2) })
    const added = view.container.querySelector('[data-storyboard-shot="1"] [data-storyboard-field="imagePrompt"]') as HTMLTextAreaElement
    expect(added.value).toBe('')
    expect([...view.container.querySelectorAll('.iv-sb-shot-index')].map(node => node.textContent)).toEqual(['1', '2'])
  })

  it('surfaces the host error verbatim and keeps the previous shot table untouched', async () => {
    const { host, view } = await renderStoryboard()
    vi.spyOn(host.api, 'planStoryboard').mockRejectedValueOnce(new Error('剧本不能为空：至少需要一句话'))

    fireEvent.change(view.container.querySelector('[data-storyboard-script="true"]') as HTMLTextAreaElement, {
      target: { value: '。' },
    })
    fireEvent.click(view.container.querySelector('[data-storyboard-plan="true"]') as HTMLElement)

    await waitFor(() => {
      expect(noticeText(view)).toContain('剧本不能为空：至少需要一句话')
    })
    // 不伪造结果：镜头表不出现
    expect(view.container.querySelectorAll('[data-storyboard-shot]')).toHaveLength(0)
  })
})
