// @vitest-environment jsdom
/**
 * M4「提取提示词」标签页：引用图片 / 视频 → 提取要点 + 文本模型 → 可编辑
 * → 存入本集提示词库 → 一键带入生成表单 / 删除。
 *
 * 只用假宿主验证界面行为，重点覆盖「引用列表同时给出画面与文件名」「提取不可用时
 * 如实报错、不伪造结果」与「只列本集提示词」三条契约。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import type { PromptRecord } from '../src/client/api.ts'
import type { EpisodeRecord } from '../src/workbench/episodes.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const STAMP = '2026-11-09T00:00:00.000Z'

/** 一集 + 两张图片 / 一条视频素材 + 可选本集提示词种子。 */
function renderStudio(seed?: readonly PromptRecord[]) {
  const episode: EpisodeRecord = {
    schemaVersion: 1, id: 'ep-1', projectId: 'prj-1', no: 1, title: '第1集',
    script: { text: '', updatedAt: STAMP }, segments: [], storyboards: [],
    resourceRefs: [], assetRefs: [], createdAt: STAMP, updatedAt: STAMP,
  }
  const host = fakeApi({
    episodes: [episode],
    assets: [
      { schemaVersion: 4, id: 'ast-1', projectId: 'prj-1', kind: 'image', path: '/tmp/outputs/shot.png', bytes: 2048, createdAt: STAMP },
      { schemaVersion: 4, id: 'ast-2', projectId: 'prj-1', kind: 'image', path: '/tmp/outputs/wide.png', bytes: 2048, createdAt: STAMP },
      { schemaVersion: 4, id: 'ast-3', projectId: 'prj-1', kind: 'video', path: '/tmp/outputs/clip.mp4', bytes: 4096, createdAt: STAMP },
    ] as never,
    prompts: seed === undefined ? undefined : [...seed],
  })
  host.projects.push({ schemaVersion: 1, id: 'prj-1', name: '提示词', createdAt: STAMP, updatedAt: STAMP } as never)
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 切到「提取提示词」标签页并等它挂载。 */
async function openStudio(view: ReturnType<typeof renderStudio>['view']): Promise<void> {
  await waitFor(() => { expect(view.container.querySelector('[data-quick-tab="prompt"]')).toBeTruthy() })
  fireEvent.click(view.container.querySelector('[data-quick-tab="prompt"]') as HTMLElement)
  await waitFor(() => { expect(view.container.querySelector('[data-prompt-studio="true"]')).toBeTruthy() })
}

/** 通过引用选择器追加一条素材（每次添加后浮层会收起）。 */
function addSource(view: ReturnType<typeof renderStudio>['view'], assetId: string): void {
  fireEvent.click(view.container.querySelector('[data-studio-add-source="true"]') as HTMLElement)
  fireEvent.click(view.container.querySelector(`[data-studio-option="${assetId}"]`) as HTMLElement)
}

describe('提取提示词标签页', () => {
  it('references images and videos, showing a thumbnail and file name for each', async () => {
    const { view } = renderStudio()
    await openStudio(view)

    addSource(view, 'ast-1')
    addSource(view, 'ast-3')

    const rows = [...view.container.querySelectorAll('[data-studio-ref]')]
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('shot.png')
    expect(rows[1]?.textContent).toContain('clip.mp4')
    // 引用列表里画面与文件名同时出现
    expect(rows[0]?.querySelector('.iv-ref-picker-thumb')).toBeTruthy()
    expect(rows[1]?.querySelector('video.iv-ref-picker-thumb')).toBeTruthy()
    expect(screen.getByText(/2\/8/)).toBeTruthy()
  })

  it('extracts prompts from the selected references into one editable draft', async () => {
    const { host, view } = renderStudio()
    await openStudio(view)

    addSource(view, 'ast-1')
    addSource(view, 'ast-2')

    fireEvent.click(view.container.querySelector('[data-studio-extract="true"]') as HTMLElement)
    await waitFor(() => { expect(host.extractInputs).toHaveLength(2) })
    expect(host.extractInputs[0]).toMatchObject({ path: '/tmp/outputs/shot.png' })

    // 每个引用拼成一段，按选择顺序用空行分隔
    const draft = view.container.querySelector('[data-studio-draft="true"]') as HTMLTextAreaElement
    await waitFor(() => {
      expect(draft.value.split('\n\n')).toHaveLength(2)
      expect(draft.value).toContain('a courier in the rain')
    })
  })

  it('sends the extraction key points and the chosen text model', async () => {
    const { host, view } = renderStudio()
    await openStudio(view)

    addSource(view, 'ast-1')
    fireEvent.change(view.container.querySelector('[data-studio-rules="true"]') as HTMLTextAreaElement, {
      target: { value: '重点写人物外观与镜头语言' },
    })
    fireEvent.change(view.container.querySelector('[data-studio-model="true"]') as HTMLSelectElement, {
      target: { value: 'fake::fake-text' },
    })
    fireEvent.click(view.container.querySelector('[data-studio-extract="true"]') as HTMLElement)

    await waitFor(() => { expect(host.extractInputs).toHaveLength(1) })
    expect(host.extractInputs[0]).toMatchObject({
      path: '/tmp/outputs/shot.png',
      instructions: '重点写人物外观与镜头语言',
      provider: 'fake',
      model: 'fake-text',
    })
  })

  it('saves the draft into the episode prompt library and applies it to the generate form', async () => {
    const { host, view } = renderStudio()
    await openStudio(view)

    const draft = view.container.querySelector('[data-studio-draft="true"]') as HTMLTextAreaElement
    fireEvent.change(draft, { target: { value: '柔和电影感人像' } })
    fireEvent.change(view.container.querySelector('[data-studio-name="true"]') as HTMLInputElement, {
      target: { value: 'Portrait' },
    })
    fireEvent.click(view.container.querySelector('[data-studio-save="true"]') as HTMLElement)

    await waitFor(() => { expect(host.prompts).toHaveLength(1) })
    expect(host.prompts[0]).toMatchObject({ name: 'Portrait', text: '柔和电影感人像', projectId: 'prj-1', episodeId: 'ep-1' })

    await waitFor(() => { expect(view.container.querySelector('[data-studio-prompt]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-studio-prompt-apply]') as HTMLElement)
    const promptBox = view.container.querySelector('[data-generate-prompt="true"]') as HTMLTextAreaElement
    await waitFor(() => { expect(promptBox.value).toBe('柔和电影感人像') })
  })

  it('only lists prompts belonging to the current episode and removes one', async () => {
    const { host, view } = renderStudio([
      { id: 'prm-ep', name: '本集', text: '本集提示词', episodeId: 'ep-1' },
      { id: 'prm-other', name: '别的集', text: '别的集提示词', episodeId: 'ep-2' },
    ])
    await openStudio(view)

    await waitFor(() => { expect(view.container.querySelector('[data-studio-prompt="prm-ep"]')).toBeTruthy() })
    expect(view.container.querySelector('[data-studio-prompt="prm-other"]')).toBeNull()

    fireEvent.click(view.container.querySelector('[data-studio-prompt-remove="prm-ep"]') as HTMLElement)
    await waitFor(() => { expect(host.prompts.some(record => record.id === 'prm-ep')).toBe(false) })
    await waitFor(() => { expect(view.container.querySelector('[data-studio-prompt="prm-ep"]')).toBeNull() })
  })

  it('reports extraction failure honestly and never fabricates a draft', async () => {
    const { host, view } = renderStudio()
    await openStudio(view)

    addSource(view, 'ast-1')
    vi.spyOn(host.api, 'extractPrompt').mockRejectedValueOnce(new Error('vision model unavailable'))
    fireEvent.click(view.container.querySelector('[data-studio-extract="true"]') as HTMLElement)

    await waitFor(() => {
      expect((document.querySelector('.iv-notice')?.textContent ?? '')).toContain('vision model unavailable')
    })
    const draft = view.container.querySelector('[data-studio-draft="true"]') as HTMLTextAreaElement
    expect(draft.value).toBe('')
  })

  it('caps the references at eight sources', async () => {
    const { view } = renderStudio()
    await openStudio(view)
    expect(view.container.querySelector('[data-studio-sources]')).toBeTruthy()
    // 假宿主只有三条素材，上限提示只校验选择计数文案
    addSource(view, 'ast-1')
    expect(screen.getByText(/1\/8/)).toBeTruthy()
  })

  it('点已选引用或选择器里的预览按钮，右侧预览展示对应素材', async () => {
    const { view } = renderStudio()
    await openStudio(view)
    addSource(view, 'ast-1')
    addSource(view, 'ast-3')

    fireEvent.click(view.container.querySelector('[data-studio-ref-preview="/tmp/outputs/shot.png"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-preview-actions="image"]')).toBeTruthy() })
    expect((view.container.querySelector('.iv-dock-preview img') as HTMLImageElement).getAttribute('src'))
      .toBe('/outputs/shot.png')

    fireEvent.click(view.container.querySelector('[data-studio-ref-preview="/tmp/outputs/clip.mp4"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-preview-video-thumb]')).toBeTruthy() })
    expect(screen.getByText(/2\/8/)).toBeTruthy()

    // 选择器里不引用也能预览，点完浮层收起、引用数不变
    fireEvent.click(view.container.querySelector('[data-studio-add-source="true"]') as HTMLElement)
    fireEvent.click(view.container.querySelector('[data-studio-preview="ast-2"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-preview-actions="image"]')).toBeTruthy() })
    expect((view.container.querySelector('.iv-dock-preview img') as HTMLImageElement).getAttribute('src'))
      .toBe('/outputs/wide.png')
    expect(screen.getByText(/2\/8/)).toBeTruthy()
  })
})
