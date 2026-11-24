// @vitest-environment jsdom
/**
 * 剧本生成卡片不再做物料匹配（`B-18` 的 compose / missing / register 出口已随
 * 「只生成剧本」一起移除）：角色 / 场景 / 道具资源由剧本生成页各自的提取分区管理。
 *
 * 这里只钉一条：填了剧本也不会冒出编排结果、缺失清单或登记按钮，
 * 更不会因为点「生成剧本」去调 `pipelines/compose` / `resources/create`。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { WorkbenchApi } from '../src/client/api.ts'
import { PipelineCard } from '../src/client/PipelineCard.tsx'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'

afterEach(() => { cleanup() })

const t = (key: WorkbenchLocaleKey): string => en[key]

describe('PipelineCard · 物料匹配已移出', () => {
  it('填了剧本也只有生成剧本入口，没有编排结果与缺料登记', async () => {
    const composePipeline = vi.fn()
    const createResource = vi.fn()
    const api = {
      composePipeline, createResource,
      listTextModels: vi.fn(async () => ({ models: [] })),
      listSkills: vi.fn(async () => []),
      generateEpisodes: vi.fn(async () => ({ episodes: [{ id: 'ep-1' }] })),
    } as unknown as WorkbenchApi
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, {
      target: { value: '雨夜街头，林夏撑伞走来。' },
    })

    for (const attr of [
      'data-pipeline-result', 'data-pipeline-missing', 'data-pipeline-missing-item',
      'data-pipeline-register', 'data-pipeline-matched', 'data-pipeline-compose',
      'data-pipeline-pick', 'data-pipeline-pick-list',
    ]) {
      expect(container.querySelector(`[${attr}]`), attr).toBeNull()
    }
    expect(container.querySelector('[data-pipeline-script-generate]')).not.toBeNull()

    fireEvent.click(container.querySelector('[data-pipeline-script-generate]') as HTMLButtonElement)
    await waitFor(() => { expect(api.generateEpisodes).toHaveBeenCalledTimes(1) })
    expect(composePipeline).not.toHaveBeenCalled()
    expect(createResource).not.toHaveBeenCalled()
  })
})
