// @vitest-environment jsdom
/**
 * 分镜合并后的交互契约（`B-20`，2026-11-19）：
 * 「分镜工坊」已并入「快速创作 · 一键成片」，因此这一组用例覆盖原先分散在
 * `client-storyboard-edit` / `client-storyboard-pipeline` 里的核心能力，并加上模型与导入：
 * - 文本模型：默认只用规则，选了模型就把 provider/model 一起下发；
 * - 剧本文件导入：走宿主 `scripts/import`，前端只替换正文；
 * - 逐镜编辑：上移 / 删除 / 添加后按 1-based 重新编号；
 * - 局部重拆：只重写一镜，其余镜头保持原样；
 * - 落库到本集分镜：分段存在就复用，不存在就新建。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { WorkbenchApi } from '../src/client/api.ts'
import { PipelineCard } from '../src/client/PipelineCard.tsx'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'

afterEach(() => { cleanup() })

const t = (key: WorkbenchLocaleKey): string => en[key]

const shotDetails = [
  { index: 1, shot: '第一镜', duration: 6, imagePrompt: '图 1', videoPrompt: '视频 1' },
  { index: 2, shot: '第二镜', duration: 6, imagePrompt: '图 2', videoPrompt: '视频 2' },
  { index: 3, shot: '第三镜', duration: 6, imagePrompt: '图 3', videoPrompt: '视频 3' },
]

const entities = {
  roles: [{ kind: 'role' as const, name: '林夏', prompt: '短发女孩，纯白背景' }],
  props: [],
  scenes: [{ kind: 'scene' as const, name: '雨夜街头', prompt: '雨夜空镜' }],
}

/** 造一份假宿主（只实现本组用例走到的端点）。 */
function makeApi(overrides: Partial<WorkbenchApi> = {}): WorkbenchApi {
  return {
    composePipeline: vi.fn(async () => ({
      workflowId: 'wfl-1', name: '一键成片 · 3 镜', mode: 'image-to-video',
      shots: 3, nodes: 6, warnings: [], missingResources: [],
      shotDetails, source: 'rules' as const,
    })),
    listResources: vi.fn(async () => []),
    listTextModels: vi.fn(async () => ({
      models: [
        { provider: 'deepseek', providerName: 'DeepSeek', id: 'chat', name: 'Chat' },
      ],
    })),
    importScript: vi.fn(async () => ({ fileName: 'episode.docx', text: '导入的正文。', bytes: 12 })),
    replanStoryboard: vi.fn(async () => ({
      shots: [
        { index: 1, shot: '第一镜', characters: [], imagePrompt: '图 1', videoPrompt: '视频 1' },
        { index: 2, shot: '重写第二镜', characters: ['林夏'], scene: '雨夜街头', imagePrompt: '新图', videoPrompt: '新视频' },
        { index: 3, shot: '第三镜', characters: [], imagePrompt: '图 3', videoPrompt: '视频 3' },
      ],
    })),
    listSegments: vi.fn(async () => []),
    createSegment: vi.fn(async () => ({ id: 'seg-new' })),
    saveStoryboard: vi.fn(async () => ({ id: 'sb-1' })),
    ...overrides,
  } as unknown as WorkbenchApi
}

/** 填剧本并排一次分镜。 */
async function compose(container: HTMLElement): Promise<void> {
  fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '一句。两句。三句。' } })
  fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
  await waitFor(() => { expect(container.querySelector('[data-pipeline-shots-panel]')).not.toBeNull() })
}

/** 读某一镜的镜头描述输入框。 */
function shotLabel(container: HTMLElement, index: number): string {
  return (container.querySelector(`[data-pipeline-shot-label="${index}"]`) as HTMLInputElement).value
}

describe('分镜合并（B-20）', () => {
  it('默认只用规则：不下发 provider/model', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await compose(container)
    const call = (api.composePipeline as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0]?.[0]
    expect(call).not.toHaveProperty('provider')
    expect(call).not.toHaveProperty('model')
    expect(container.querySelector('[data-pipeline-plan-source]')?.textContent).toBe(en.pipelineSourceRules)
  })

  it('选了文本模型就把 provider + model 一起下发（拆解交给模型）', async () => {
    const api = makeApi({
      listTextModels: vi.fn(async () => ({
        models: [{ provider: 'deepseek', providerName: 'DeepSeek', id: 'chat', name: 'Chat' }],
      })),
      composePipeline: vi.fn(async () => ({
        workflowId: 'wfl-2', name: '一键成片 · 3 镜', mode: 'image-to-video',
        shots: 3, nodes: 6, warnings: [], missingResources: [],
        shotDetails, source: 'model' as const, entities,
      })),
    })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await waitFor(() => { expect(container.querySelectorAll('[data-pipeline-text-model] option').length).toBe(2) })
    fireEvent.change(container.querySelector('[data-pipeline-text-model]') as HTMLSelectElement, { target: { value: 'deepseek::chat' } })
    await compose(container)
    const call = (api.composePipeline as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0]?.[0]
    expect(call).toMatchObject({ provider: 'deepseek', model: 'chat' })
    // 来源与实体库都要能看见（用户知道这份分镜是谁拆的）
    expect(container.querySelector('[data-pipeline-plan-source]')?.textContent).toBe(en.pipelineSourceModel)
    expect(container.querySelector('[data-pipeline-entity="role:林夏"]')).not.toBeNull()
  })

  it('导演技能：默认选第一个启用中的，并随分镜拆解下发 skillId', async () => {
    const listSkills = vi.fn(async () => ([
      { id: 'skill-director', kind: 'director' as const, name: '短剧导演', description: '', prompt: '镜头要稳', builtin: true, enabled: true },
    ]))
    const api = makeApi({ listSkills: listSkills as unknown as WorkbenchApi['listSkills'] })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await waitFor(() => {
      expect((container.querySelector('[data-pipeline-skill]') as HTMLSelectElement).value).toBe('skill-director')
    })
    await compose(container)
    const call = (api.composePipeline as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0]?.[0]
    expect(call).toMatchObject({ skillId: 'skill-director' })
  })

  it('长篇剧本按章节切段：只把选中的那一段交给编排', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    const script = `第一章 起\n${'甲'.repeat(12_000)}\n\n第二章 承\n${'乙'.repeat(12_000)}`
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: script } })
    const select = container.querySelector('[data-pipeline-window-select]') as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(select.options.length).toBe(2)
    fireEvent.change(select, { target: { value: '1' } })
    fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
    await waitFor(() => { expect(api.composePipeline).toHaveBeenCalled() })
    const call = (api.composePipeline as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0]?.[0]
    expect(String(call?.script)).toContain('乙')
    expect(String(call?.script)).not.toContain('甲')
    expect(String(call?.script).length).toBeLessThanOrEqual(20_000)
  })

  it('导入本地文件：选中文件后交宿主解析，并展示已引用文件名', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    const file = new File(['正文'], 'episode.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    fireEvent.change(container.querySelector('[data-pipeline-import-file]') as HTMLInputElement, { target: { files: [file] } })
    await waitFor(() => { expect(api.importScript).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'episode.docx' })) })
    await waitFor(() => {
      expect((container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement).value).toBe('导入的正文。')
    })
    expect(container.querySelector('[data-pipeline-notice]')?.textContent).toContain('episode.docx')
    expect(container.querySelector('[data-pipeline-imported]')?.textContent).toContain('episode.docx')
  })

  it('支持多选：每份文件都列在「已引用文件」里，并逐份并入剧本', async () => {
    const importScript = vi.fn(async (input: { fileName?: string }) => ({
      fileName: input.fileName ?? '', text: `正文-${input.fileName}`, bytes: 8,
    }))
    const api = makeApi({ importScript: importScript as unknown as WorkbenchApi['importScript'] })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-import-file]') as HTMLInputElement, {
      target: { files: [new File(['a'], 'a.pdf'), new File(['b'], 'b.txt')] },
    })
    await waitFor(() => {
      const item = (name: string): string | null | undefined =>
        container.querySelector(`[data-pipeline-imported-item="${name}"]`)?.getAttribute('data-pipeline-imported-status')
      expect(item('a.pdf')).toBe('done')
      expect(item('b.txt')).toBe('done')
    })
    expect(container.querySelectorAll('[data-pipeline-imported-item]').length).toBe(2)
    expect((container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement).value)
      .toBe('正文-a.pdf\n\n正文-b.txt')
  })

  it('某份文件解析失败时仍留在列表里标出原因，其他文件照常并入', async () => {
    const importScript = vi.fn(async (input: { fileName?: string }) => {
      if (input.fileName === '扫描件.pdf') throw new Error('提取不到可读文字')
      return { fileName: input.fileName ?? '', text: '可用正文', bytes: 8 }
    })
    const api = makeApi({ importScript: importScript as unknown as WorkbenchApi['importScript'] })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-import-file]') as HTMLInputElement, {
      target: { files: [new File(['x'], '扫描件.pdf'), new File(['y'], '可用.txt')] },
    })
    await waitFor(() => {
      expect(container.querySelector('[data-pipeline-imported-item="扫描件.pdf"]')?.getAttribute('data-pipeline-imported-status'))
        .toBe('failed')
    })
    expect(container.querySelector('[data-pipeline-imported-item="可用.txt"]')?.getAttribute('data-pipeline-imported-status'))
      .toBe('done')
    expect(container.querySelector('[data-pipeline-error]')?.textContent).toContain('扫描件.pdf')
    expect((container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement).value).toBe('可用正文')
  })

  it('上移 / 删除 / 添加后按 1-based 重新编号', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await compose(container)
    expect(shotLabel(container, 1)).toBe('第一镜')

    fireEvent.click(container.querySelector('[data-pipeline-shot-up="2"]') as HTMLButtonElement)
    expect(shotLabel(container, 1)).toBe('第二镜')
    expect(shotLabel(container, 2)).toBe('第一镜')

    fireEvent.click(container.querySelector('[data-pipeline-shot-remove="1"]') as HTMLButtonElement)
    expect(container.querySelectorAll('[data-pipeline-shot]').length).toBe(2)
    expect(shotLabel(container, 1)).toBe('第一镜')

    fireEvent.click(container.querySelector('[data-pipeline-shot-add]') as HTMLButtonElement)
    expect(container.querySelectorAll('[data-pipeline-shot]').length).toBe(3)
    expect(shotLabel(container, 3)).toBe('')
  })

  it('局部重拆只改一镜，其余镜头保持不变', async () => {
    const api = makeApi({
      composePipeline: vi.fn(async () => ({
        workflowId: 'wfl-3', name: '一键成片 · 3 镜', mode: 'image-to-video',
        shots: 3, nodes: 6, warnings: [], missingResources: [],
        shotDetails, source: 'model' as const, entities,
      })),
    })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await waitFor(() => { expect(container.querySelectorAll('[data-pipeline-text-model] option').length).toBe(2) })
    fireEvent.change(container.querySelector('[data-pipeline-text-model]') as HTMLSelectElement, { target: { value: 'deepseek::chat' } })
    await compose(container)

    fireEvent.click(container.querySelector('[data-pipeline-shot-replan="2"]') as HTMLButtonElement)
    await waitFor(() => { expect(shotLabel(container, 2)).toBe('重写第二镜') })
    expect(shotLabel(container, 1)).toBe('第一镜')
    expect(shotLabel(container, 3)).toBe('第三镜')
    expect(api.replanStoryboard).toHaveBeenCalledWith(expect.objectContaining({ index: 2, provider: 'deepseek', model: 'chat' }))
  })

  it('没有模型时局部重拆给出提示且不发请求', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await compose(container)
    expect((container.querySelector('[data-pipeline-shot-replan="1"]') as HTMLButtonElement).disabled).toBe(true)
    expect(api.replanStoryboard).not.toHaveBeenCalled()
  })

  it('保存到本集分镜：没有分段就新建一个，再整表落库', async () => {
    const api = makeApi()
    const { container } = render(
      <PipelineCard api={api} t={t} projectId="prj-1" episodeId="ep-1" onStarted={() => {}} />,
    )
    await compose(container)
    fireEvent.click(container.querySelector('[data-pipeline-save-episode]') as HTMLButtonElement)
    await waitFor(() => { expect(api.saveStoryboard).toHaveBeenCalledTimes(1) })
    expect(api.createSegment).toHaveBeenCalledWith('ep-1', expect.objectContaining({ durationSec: 18 }))
    expect(api.saveStoryboard).toHaveBeenCalledWith(expect.objectContaining({ episodeId: 'ep-1', segmentId: 'seg-new' }))
    await waitFor(() => {
      expect(container.querySelector('[data-pipeline-notice]')?.textContent).toContain('3')
    })
  })

  it('没选剧集时保存按钮禁用', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await compose(container)
    expect((container.querySelector('[data-pipeline-save-episode]') as HTMLButtonElement).disabled).toBe(true)
    expect(container.textContent).toContain(en.pipelineSaveNeedsEpisode)
  })

  it('拆解过程中可取消：中断请求并给"已停止"提示', async () => {
    let aborted = false
    const composeNeverSettles: WorkbenchApi['composePipeline'] = (_input, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => {
        aborted = true
        reject(new Error('aborted'))
      })
    })
    const api = makeApi({ composePipeline: vi.fn(composeNeverSettles) })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '一句。两句。' } })
    fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelector('[data-pipeline-cancel]')).not.toBeNull() })
    fireEvent.click(container.querySelector('[data-pipeline-cancel]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelector('[data-pipeline-notice]')?.textContent).toBe(en.pipelineCancelled) })
    expect(aborted).toBe(true)
  })
})

describe('生成剧本（B-22）', () => {
  it('剧本为空时按钮禁用；剧本框是唯一入口（不再有单独的一句话创意输入）', () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    expect((container.querySelector('[data-pipeline-script-generate]') as HTMLButtonElement).disabled).toBe(true)
    expect(container.querySelector('[data-pipeline-brief]')).toBeNull()
  })

  it('按三级数量下发并把人造的集交回外层', async () => {
    const created = { id: 'ep-9', no: 0, script: { text: '剧本正文', updatedAt: '2026-11-20T00:00:00.000Z' } }
    const generateEpisodes = vi.fn(async () => ({ episodes: [created] }))
    const onEpisodesGenerated = vi.fn()
    const api = makeApi({ generateEpisodes } as unknown as Partial<WorkbenchApi>)
    const { container } = render(
      <PipelineCard api={api} t={t} projectId="prj-1" episodeId="ep-1" onStarted={() => {}} onEpisodesGenerated={onEpisodesGenerated} />,
    )
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '一句。两句。' } })
    fireEvent.change(container.querySelector('[data-pipeline-plan-episodes]') as HTMLInputElement, { target: { value: '2' } })
    fireEvent.change(container.querySelector('[data-pipeline-plan-shots]') as HTMLInputElement, { target: { value: '5' } })
    fireEvent.click(container.querySelector('[data-pipeline-script-generate]') as HTMLButtonElement)

    await waitFor(() => { expect(generateEpisodes).toHaveBeenCalledTimes(1) })
    expect(generateEpisodes).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'prj-1', episodeId: 'ep-1', script: '一句。两句。', episodes: 2, shots: 5,
    }))
    await waitFor(() => { expect(onEpisodesGenerated).toHaveBeenCalledWith([created]) })
  })
})
