// @vitest-environment jsdom
/**
 * 剧本生成卡片不再手动挑料：项目里有资源也不在这里列复选框、排序条或匹配回显。
 * 生成剧本只吃剧本正文 + 三级数量 + 模型 / 技能，不下发 `resourceIds`。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { PipelineCard } from '../src/client/PipelineCard.tsx'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'
import { cleanup as cleanupHost, fakeApi, render as renderHost } from './client-fake-api.ts'

afterEach(() => { cleanup(); cleanupHost() })

const t = (key: WorkbenchLocaleKey): string => en[key]

/** 造一条资源记录（仅用于确认「有资源也不显示挑料」）。 */
function resource(id: string, kind: 'role' | 'scene' | 'prop', name: string) {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', kind, name, scope: 'project' as const,
    createdAt: '2026-10-14T02:00:00.000Z', updatedAt: '2026-10-14T02:00:00.000Z',
  }
}

describe('PipelineCard · 手动挑料已移出', () => {
  it('项目里有资源也不出现挑料列表、排序条与匹配回显', () => {
    const host = fakeApi()
    host.resources.push(resource('res-1', 'role', '林萧'), resource('res-2', 'scene', '雨夜街道'))
    const { container } = renderHost(<PipelineCard api={host.api} t={t} projectId="prj-1" onStarted={() => {}} />)
    for (const attr of [
      'data-pipeline-pick', 'data-pipeline-pick-list', 'data-pipeline-pick-item',
      'data-pipeline-pick-selected', 'data-pipeline-pick-order', 'data-pipeline-matched',
    ]) {
      expect(container.querySelector(`[${attr}]`), attr).toBeNull()
    }
  })

  it('生成剧本不下发 resourceIds', async () => {
    const generateEpisodes = vi.fn(async () => ({ episodes: [{ id: 'ep-1' }] }))
    const api = {
      generateEpisodes,
      listTextModels: vi.fn(async () => ({ models: [] })),
      listSkills: vi.fn(async () => []),
    } as unknown as Parameters<typeof PipelineCard>[0]['api']
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, {
      target: { value: '雨夜街头。林夏抬头。' },
    })
    fireEvent.click(container.querySelector('[data-pipeline-script-generate]') as HTMLButtonElement)
    await waitFor(() => { expect(generateEpisodes).toHaveBeenCalledTimes(1) })
    expect(generateEpisodes.mock.calls[0]?.[0]).not.toHaveProperty('resourceIds')
  })
})
