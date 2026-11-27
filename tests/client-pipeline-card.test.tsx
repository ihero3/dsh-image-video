// @vitest-environment jsdom
/**
 * 剧本生成卡片（2026-11-24 精简）：这一块**只生成剧本**。
 *
 * 钉住产品口径：
 * - 导入文件后只展示「全文 N 字」，不再切段 / 展示第几段下拉 / 「本次只拆选中的一段」；
 * - 每镜秒数、生成分镜、生成画布、生成图片、生成视频及逐镜编辑全部移除；
 * - 集数 / 每集段数 / 每段分镜数默认「自动」，剧本模型默认只用规则，技能可多次选择；
 * - 剧本文本与导入文件仍写在共享 store，角色 / 场景 / 道具分区继续拿它们当输入。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { WorkbenchApi } from '../src/client/api.ts'
import { PipelineCard } from '../src/client/PipelineCard.tsx'
import { switchPipelineEpisode } from '../src/client/workbench-store.ts'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'

afterEach(() => { cleanup() })

const t = (key: WorkbenchLocaleKey): string => en[key]

/** 假宿主：只实现本卡片会走到的端点。 */
function makeApi(overrides: Partial<WorkbenchApi> = {}): WorkbenchApi {
  return {
    listTextModels: vi.fn(async () => ({ models: [] })),
    listSkills: vi.fn(async () => []),
    generateEpisodes: vi.fn(async () => ({ episodes: [{ id: 'ep-9' }] })),
    importScript: vi.fn(async (input: { fileName: string }) => ({
      fileName: input.fileName, text: '导入的正文。', bytes: 12,
    })),
    ...overrides,
  } as unknown as WorkbenchApi
}

const scriptInput = (container: HTMLElement): HTMLTextAreaElement =>
  container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement
const generateButton = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector('[data-pipeline-script-generate]') as HTMLButtonElement

describe('PipelineCard · 只生成剧本', () => {
  it('没有分镜 / 画布 / 图片 / 视频 / 每镜秒数 / 切段这些入口', () => {
    const { container } = render(<PipelineCard api={makeApi()} t={t} projectId="prj-1" />)
    for (const attr of [
      'data-pipeline-compose', 'data-pipeline-to-canvas', 'data-pipeline-inline-image',
      'data-pipeline-inline-run', 'data-pipeline-duration', 'data-pipeline-cancel',
      'data-pipeline-shots-panel', 'data-pipeline-inline', 'data-pipeline-result',
      'data-pipeline-export', 'data-pipeline-save-episode', 'data-pipeline-pick',
      'data-pipeline-windows', 'data-pipeline-window-select', 'data-pipeline-button-hints',
    ]) {
      expect(container.querySelector(`[${attr}]`), attr).toBeNull()
    }
    expect(container.textContent).not.toContain('split into')
    expect(container.textContent).not.toContain('本次只拆')
    expect(container.querySelector('[data-pipeline-script-generate]')).not.toBeNull()
  })

  it('剧本框 6 行；三级数量默认用占位「自动」，点击直接输入数字，清空后仍是自动', () => {
    const { container } = render(<PipelineCard api={makeApi()} t={t} projectId="prj-1" />)
    expect(scriptInput(container).rows).toBe(6)
    for (const attr of ['data-pipeline-plan-episodes', 'data-pipeline-plan-segments', 'data-pipeline-plan-shots']) {
      const input = container.querySelector(`[${attr}]`) as HTMLInputElement
      expect(input.value).toBe('')
      expect(input.placeholder).toBe(en.pipelineAuto)
    }
    expect((container.querySelector('[data-pipeline-text-model]') as HTMLSelectElement).value).toBe('')
    expect(generateButton(container).disabled).toBe(true)

    const episodes = container.querySelector('[data-pipeline-plan-episodes]') as HTMLInputElement
    fireEvent.focus(episodes)
    fireEvent.change(episodes, { target: { value: '3' } })
    expect(episodes.value).toBe('3')
    fireEvent.change(episodes, { target: { value: '' } })
    expect(episodes.value).toBe('')
    expect(episodes.placeholder).toBe(en.pipelineAuto)
  })

  it('生成剧本按钮是独占一行的主按钮，点击后把全文交给宿主并交回集', async () => {
    const created = [{ id: 'ep-9', no: 0 }]
    const generateEpisodes = vi.fn(async () => ({ episodes: created }))
    const onEpisodesGenerated = vi.fn()
    const api = makeApi({ generateEpisodes } as unknown as Partial<WorkbenchApi>)
    const { container } = render(
      <PipelineCard api={api} t={t} projectId="prj-1" episodeId="ep-1"
        onEpisodesGenerated={onEpisodesGenerated} />,
    )
    expect(generateButton(container).className).toContain('iv-btn--action--primary')

    fireEvent.change(scriptInput(container), { target: { value: '雨夜街头。林夏抬头。' } })
    fireEvent.click(generateButton(container))

    await waitFor(() => { expect(generateEpisodes).toHaveBeenCalledTimes(1) })
    expect(generateEpisodes).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'prj-1', episodeId: 'ep-1', script: '雨夜街头。林夏抬头。',
      episodes: 1, segments: 3, shots: 4,
    }))
    await waitFor(() => { expect(onEpisodesGenerated).toHaveBeenCalledWith(created) })
    expect(container.querySelector('[data-pipeline-notice]')?.textContent)
      .toBe(en.pipelineGenerateDone.replace('{n}', '1'))
  })

  it('生成中按钮禁用并显示进行态；失败如实报错', async () => {
    let resolve!: (value: { episodes: readonly unknown[] }) => void
    const generateEpisodes = vi.fn(() => new Promise<{ episodes: readonly unknown[] }>(done => { resolve = done }))
    const api = makeApi({ generateEpisodes } as unknown as Partial<WorkbenchApi>)
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" />)
    fireEvent.change(scriptInput(container), { target: { value: '一句话创意。' } })
    fireEvent.click(generateButton(container))
    await waitFor(() => {
      expect(generateButton(container).disabled).toBe(true)
      expect(generateButton(container).textContent).toContain(en.pipelineGeneratingScript)
    })
    resolve({ episodes: [{ id: 'ep-1' }] })
    await waitFor(() => { expect(generateButton(container).disabled).toBe(false) })

    const failing = makeApi({ generateEpisodes: vi.fn(async () => { throw new Error('宿主拒绝了') }) } as unknown as Partial<WorkbenchApi>)
    const view = render(<PipelineCard api={failing} t={t} projectId="prj-1" />)
    fireEvent.change(scriptInput(view.container), { target: { value: '另一句话。' } })
    fireEvent.click(generateButton(view.container))
    await waitFor(() => {
      expect(view.container.querySelector('[data-pipeline-error]')?.textContent).toContain('宿主拒绝了')
    })
  })

  it('导入后展示全文总字数（不切段），原文并入剧本框', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" />)
    const file = new File(['正文'], 'episode.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    fireEvent.change(container.querySelector('[data-pipeline-import-file]') as HTMLInputElement, { target: { files: [file] } })
    await waitFor(() => { expect(scriptInput(container).value).toBe('导入的正文。') })
    expect(container.querySelector('[data-pipeline-script-chars]')?.textContent)
      .toBe(en.pipelineScriptChars.replace('{chars}', '6'))
    expect(container.querySelector('[data-pipeline-window-select]')).toBeNull()
    expect(container.querySelector('[data-pipeline-imported-item="episode.docx"]')).not.toBeNull()
    expect(container.querySelector('[data-pipeline-notice]')?.textContent).toContain('episode.docx')
  })

  it('没有项目时按钮禁用并说明原因', () => {
    const { container } = render(<PipelineCard api={makeApi()} t={t} />)
    fireEvent.change(scriptInput(container), { target: { value: '剧本' } })
    expect(generateButton(container).disabled).toBe(true)
    expect(container.textContent).toContain(en.pipelineNeedsProject)
  })

  it('切换剧集：上一集剧本不会留在下一集，切回来内容还在', () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" />)
    act(() => { switchPipelineEpisode(api, 'ep-1') })
    fireEvent.change(scriptInput(container), { target: { value: '第一部的剧本' } })
    act(() => { switchPipelineEpisode(api, 'ep-2') })
    expect(scriptInput(container).value).toBe('')
    fireEvent.change(scriptInput(container), { target: { value: '第二部的剧本' } })
    act(() => { switchPipelineEpisode(api, 'ep-1') })
    expect(scriptInput(container).value).toBe('第一部的剧本')
    act(() => { switchPipelineEpisode(api, 'ep-2') })
    expect(scriptInput(container).value).toBe('第二部的剧本')
  })
})
