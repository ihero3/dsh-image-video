// @vitest-environment jsdom
/**
 * 生成剧本的接口契约（2026-11-24）：文本模型 / 技能 / 文件导入都只为「生成剧本」服务。
 *
 * - 剧本模型默认只用规则；选了模型才下发 provider/model，并让「自动」数量走推荐接口；
 * - 技能与所有技能入口一样：选中往剧本里插 `【@技能名】` token，可多次选，删 token 即取消；
 * - 导入文件写进共享 store，角色 / 场景 / 道具分区共用同一份原文；
 * - 整篇正文一次交给 `episodes/generate`：不再按章节切段、不展示「第几段」。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { WorkbenchApi } from '../src/client/api.ts'
import { PipelineCard } from '../src/client/PipelineCard.tsx'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'

afterEach(() => { cleanup() })

const t = (key: WorkbenchLocaleKey): string => en[key]

function makeApi(overrides: Partial<WorkbenchApi> = {}): WorkbenchApi {
  return {
    listTextModels: vi.fn(async () => ({
      models: [{ provider: 'deepseek', providerName: 'DeepSeek', id: 'chat', name: 'Chat' }],
    })),
    listSkills: vi.fn(async () => []),
    generateEpisodes: vi.fn(async () => ({ episodes: [{ id: 'ep-9' }] })),
    suggestEpisodeCounts: vi.fn(async () => ({ episodes: 2, segments: 4, shots: 5 })),
    importScript: vi.fn(async (input: { fileName: string }) => ({ fileName: input.fileName, text: '导入的正文。', bytes: 12 })),
    ...overrides,
  } as unknown as WorkbenchApi
}

const scriptInput = (container: HTMLElement): HTMLTextAreaElement =>
  container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement
const generateButton = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector('[data-pipeline-script-generate]') as HTMLButtonElement
const payloadOf = (spy: ReturnType<typeof vi.fn>): Record<string, unknown> =>
  (spy.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>

describe('生成剧本 · 文本模型与技能', () => {
  it('默认只用规则：不下发 provider/model，也不调自动推荐', async () => {
    const generateEpisodes = vi.fn(async () => ({ episodes: [{ id: 'ep-1' }] }))
    const suggestEpisodeCounts = vi.fn(async () => ({ episodes: 2, segments: 3, shots: 4 }))
    const api = makeApi({ generateEpisodes, suggestEpisodeCounts } as unknown as Partial<WorkbenchApi>)
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(scriptInput(container), { target: { value: '雨夜街头。林夏抬头。' } })
    fireEvent.click(generateButton(container))
    await waitFor(() => { expect(generateEpisodes).toHaveBeenCalledTimes(1) })
    const payload = payloadOf(generateEpisodes)
    expect(payload).not.toHaveProperty('provider')
    expect(payload).not.toHaveProperty('model')
    expect(suggestEpisodeCounts).not.toHaveBeenCalled()
  })

  it('默认只用规则 + 自动：长剧本按字数推算多集，不回落成 1 集', async () => {
    const generateEpisodes = vi.fn(async () => ({ episodes: [{ id: 'ep-1' }] }))
    const suggestEpisodeCounts = vi.fn(async () => ({ episodes: 1, segments: 1, shots: 1 }))
    const api = makeApi({ generateEpisodes, suggestEpisodeCounts } as unknown as Partial<WorkbenchApi>)
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    // 模拟导入整本长剧本（远超 20 万字单集上限）
    const longScript = '这是一句用于模拟整本小说的正文内容。'.repeat(12_000)
    fireEvent.change(scriptInput(container), { target: { value: longScript } })
    fireEvent.click(generateButton(container))
    await waitFor(() => { expect(generateEpisodes).toHaveBeenCalledTimes(1) })
    const payload = payloadOf(generateEpisodes)
    // 无模型：不调推荐，集数按字数推到 >1，保证能拆开落库
    expect(suggestEpisodeCounts).not.toHaveBeenCalled()
    expect(payload).not.toHaveProperty('provider')
    expect(payload.episodes as number).toBeGreaterThan(1)
    expect(payload.episodes as number).toBeLessThanOrEqual(12)
  })

  it('选了文本模型：下发 provider/model，自动数量由模型推荐', async () => {
    const generateEpisodes = vi.fn(async () => ({ episodes: [{ id: 'ep-1' }] }))
    const suggestEpisodeCounts = vi.fn(async () => ({ episodes: 2, segments: 4, shots: 5 }))
    const api = makeApi({ generateEpisodes, suggestEpisodeCounts } as unknown as Partial<WorkbenchApi>)
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await waitFor(() => { expect(container.querySelectorAll('[data-pipeline-text-model] option').length).toBe(2) })
    fireEvent.change(container.querySelector('[data-pipeline-text-model]') as HTMLSelectElement, { target: { value: 'deepseek::chat' } })
    fireEvent.change(scriptInput(container), { target: { value: '一句话创意。' } })
    fireEvent.click(generateButton(container))
    await waitFor(() => { expect(generateEpisodes).toHaveBeenCalledTimes(1) })
    expect(suggestEpisodeCounts).toHaveBeenCalledWith(expect.objectContaining({
      script: '一句话创意。', provider: 'deepseek', model: 'chat',
    }))
    expect(payloadOf(generateEpisodes)).toMatchObject({
      provider: 'deepseek', model: 'chat', episodes: 2, segments: 4, shots: 5,
    })
  })

  it('选了模型但推荐集数过小时：用字数安全线下限兜底，不让长剧本塞一集', async () => {
    const generateEpisodes = vi.fn(async () => ({ episodes: [{ id: 'ep-1' }] }))
    // 模型错误地只推荐 1 集
    const suggestEpisodeCounts = vi.fn(async () => ({ episodes: 1, segments: 1, shots: 1 }))
    const api = makeApi({ generateEpisodes, suggestEpisodeCounts } as unknown as Partial<WorkbenchApi>)
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await waitFor(() => { expect(container.querySelectorAll('[data-pipeline-text-model] option').length).toBe(2) })
    fireEvent.change(container.querySelector('[data-pipeline-text-model]') as HTMLSelectElement, { target: { value: 'deepseek::chat' } })
    const longScript = '这是一句用于模拟整本小说的正文内容。'.repeat(12_000)
    fireEvent.change(scriptInput(container), { target: { value: longScript } })
    fireEvent.click(generateButton(container))
    await waitFor(() => { expect(generateEpisodes).toHaveBeenCalledTimes(1) })
    expect((payloadOf(generateEpisodes).episodes as number)).toBeGreaterThan(1)
  })

  it('技能可多次选择：每次插入一个 token，删掉即取消，生成正文不带 token', async () => {
    const skills = [
      { id: 'skill-a', kind: 'director' as const, name: '短剧导演', description: '', prompt: '镜头要稳', builtin: true, enabled: true },
      { id: 'skill-b', kind: 'director' as const, name: '电影感', description: '', prompt: '胶片质感', builtin: true, enabled: true },
    ]
    const generateEpisodes = vi.fn(async () => ({ episodes: [{ id: 'ep-1' }] }))
    const api = makeApi({
      generateEpisodes,
      listSkills: vi.fn(async () => skills) as unknown as WorkbenchApi['listSkills'],
    } as unknown as Partial<WorkbenchApi>)
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    const select = container.querySelector('[data-pipeline-skill]') as HTMLSelectElement
    await waitFor(() => { expect(select.options.length).toBe(3) })

    fireEvent.change(select, { target: { value: 'skill-a' } })
    await waitFor(() => { expect(scriptInput(container).value).toContain('【@短剧导演】') })
    fireEvent.change(select, { target: { value: 'skill-b' } })
    await waitFor(() => { expect(scriptInput(container).value).toContain('【@电影感】') })
    // 已插入的不再出现在候选里，但可以继续选下一个
    expect([...select.options].some(option => option.value === 'skill-a')).toBe(false)

    // 删掉 token 就等于取消选择：生成时既不带 skillId，正文也不含标记
    fireEvent.change(scriptInput(container), { target: { value: '雨夜街头。' } })
    await waitFor(() => { expect(scriptInput(container).value).toBe('雨夜街头。') })
    fireEvent.click(generateButton(container))
    await waitFor(() => { expect(generateEpisodes).toHaveBeenCalledTimes(1) })
    expect(payloadOf(generateEpisodes).script).toBe('雨夜街头。')
    expect(payloadOf(generateEpisodes)).not.toHaveProperty('skillId')
  })

  it('保留技能 token 时下发第一个技能，正文仍清干净', async () => {
    const skills = [
      { id: 'skill-a', kind: 'director' as const, name: '短剧导演', description: '', prompt: '', builtin: true, enabled: true },
      { id: 'skill-b', kind: 'director' as const, name: '电影感', description: '', prompt: '', builtin: true, enabled: true },
    ]
    const generateEpisodes = vi.fn(async () => ({ episodes: [{ id: 'ep-1' }] }))
    const api = makeApi({
      generateEpisodes,
      listSkills: vi.fn(async () => skills) as unknown as WorkbenchApi['listSkills'],
    } as unknown as Partial<WorkbenchApi>)
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    const select = container.querySelector('[data-pipeline-skill]') as HTMLSelectElement
    await waitFor(() => { expect(select.options.length).toBe(3) })
    fireEvent.change(select, { target: { value: 'skill-a' } })
    fireEvent.change(select, { target: { value: 'skill-b' } })
    await waitFor(() => { expect(scriptInput(container).value).toContain('【@电影感】') })
    fireEvent.change(scriptInput(container), { target: { value: '雨夜街头。【@短剧导演】 【@电影感】' } })
    fireEvent.click(generateButton(container))
    await waitFor(() => { expect(generateEpisodes).toHaveBeenCalledTimes(1) })
    expect(payloadOf(generateEpisodes)).toMatchObject({ script: '雨夜街头。', skillId: 'skill-a' })
  })
})

describe('生成剧本 · 共享导入', () => {
  it('导入本地文件：原文并入剧本、文件名留在共享列表、展示全文字数', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-import-file]') as HTMLInputElement, {
      target: { files: [new File(['正文'], 'episode.docx')] },
    })
    await waitFor(() => { expect(api.importScript).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'episode.docx' })) })
    await waitFor(() => {
      expect(container.querySelector('[data-pipeline-imported-item="episode.docx"]')?.getAttribute('data-pipeline-imported-status')).toBe('done')
    })
    expect(scriptInput(container).value).toBe('导入的正文。')
    expect(container.querySelector('[data-pipeline-script-chars]')?.textContent)
      .toBe(en.pipelineScriptChars.replace('{chars}', '6'))
  })

  it('支持多选：每份文件都列在共享列表里，并逐份并入剧本', async () => {
    const importScript = vi.fn(async (input: { fileName?: string }) => ({
      fileName: input.fileName ?? '', text: `正文-${input.fileName}`, bytes: 8,
    }))
    const api = makeApi({ importScript: importScript as unknown as WorkbenchApi['importScript'] })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-import-file]') as HTMLInputElement, {
      target: { files: [new File(['a'], 'a.pdf'), new File(['b'], 'b.txt')] },
    })
    await waitFor(() => {
      expect(container.querySelector('[data-pipeline-imported-item="a.pdf"]')?.getAttribute('data-pipeline-imported-status')).toBe('done')
      expect(container.querySelector('[data-pipeline-imported-item="b.txt"]')?.getAttribute('data-pipeline-imported-status')).toBe('done')
    })
    expect(container.querySelectorAll('[data-pipeline-imported-item]').length).toBe(2)
    expect(scriptInput(container).value).toBe('正文-a.pdf\n\n正文-b.txt')
  })

  it('某份文件解析失败仍留在列表标出原因，其他文件照常并入', async () => {
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
      expect(container.querySelector('[data-pipeline-imported-item="扫描件.pdf"]')?.getAttribute('data-pipeline-imported-status')).toBe('failed')
    })
    expect(container.querySelector('[data-pipeline-imported-item="可用.txt"]')?.getAttribute('data-pipeline-imported-status')).toBe('done')
    expect(container.querySelector('[data-pipeline-error]')?.textContent).toContain('扫描件.pdf')
    expect(scriptInput(container).value).toBe('可用正文')
  })

  it('三级数量手填后按下发的值生成，不自动推荐', async () => {
    const generateEpisodes = vi.fn(async () => ({ episodes: [{ id: 'ep-1' }] }))
    const suggestEpisodeCounts = vi.fn(async () => ({ episodes: 2, segments: 3, shots: 4 }))
    const api = makeApi({ generateEpisodes, suggestEpisodeCounts } as unknown as Partial<WorkbenchApi>)
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(scriptInput(container), { target: { value: '一句。两句。' } })
    fireEvent.change(container.querySelector('[data-pipeline-plan-episodes]') as HTMLInputElement, { target: { value: '2' } })
    fireEvent.change(container.querySelector('[data-pipeline-plan-segments]') as HTMLInputElement, { target: { value: '6' } })
    fireEvent.change(container.querySelector('[data-pipeline-plan-shots]') as HTMLInputElement, { target: { value: '5' } })
    fireEvent.click(generateButton(container))
    await waitFor(() => { expect(generateEpisodes).toHaveBeenCalledTimes(1) })
    expect(payloadOf(generateEpisodes)).toMatchObject({ episodes: 2, segments: 6, shots: 5 })
    expect(suggestEpisodeCounts).not.toHaveBeenCalled()
  })
})
