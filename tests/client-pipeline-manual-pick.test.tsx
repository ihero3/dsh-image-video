// @vitest-environment jsdom
/**
 * `B-18`（A-18）流水线手动挑选物料：把指定资源 id 强制塞进 `pipelines/compose` / `pipelines/run`；
 * 结果回显 `matchedResources`（手动挑的 + 剧本自动匹配的都在这）。未挑选时**不带** resourceIds（剧本自动匹配）。
 *
 * 端点由 Track A 的 A-18 落地；本文件只用假宿主验证**界面行为**：resourceIds 透传与 matchedResources 回显。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { PipelineCard } from '../src/client/PipelineCard.tsx'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'
import { cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const t = (key: WorkbenchLocaleKey): string => en[key]

/** 造一条资源记录。 */
function resource(id: string, kind: 'role' | 'scene' | 'prop', name: string) {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', kind, name, scope: 'project' as const,
    createdAt: '2026-10-14T02:00:00.000Z', updatedAt: '2026-10-14T02:00:00.000Z',
  }
}

describe('PipelineCard manual pick (B-18)', () => {
  it('passes picked resource ids and echoes matched resources', async () => {
    const host = fakeApi()
    host.resources.push(
      resource('res-1', 'role', '林萧'),
      resource('res-2', 'scene', '雨夜街道'),
    )
    const { container } = render(<PipelineCard api={host.api} t={t} projectId="prj-1" onStarted={() => {}} />)

    // 手动挑选列表异步加载
    await waitFor(() => { expect(container.querySelector('[data-pipeline-pick-list="true"]')).toBeTruthy() })
    // 写剧本（compose 按钮在空剧本时禁用）
    fireEvent.change(container.querySelector('[data-pipeline-script="true"]') as HTMLTextAreaElement, {
      target: { value: '雨夜街头。林夏抬头。' },
    })
    // 手动勾选一个物料
    fireEvent.click(container.querySelector('[data-pipeline-pick-item="res-1"]') as HTMLInputElement)
    fireEvent.click(container.querySelector('[data-pipeline-compose="true"]') as HTMLButtonElement)

    await waitFor(() => { expect(host.pipelinePayloads).toHaveLength(1) })
    expect(host.pipelinePayloads[0]!.resourceIds).toEqual(['res-1'])
    // 匹配到的物料回显
    await waitFor(() => { expect(container.querySelector('[data-pipeline-matched-item="res-1"]')).toBeTruthy() })
    expect(container.querySelector('[data-pipeline-matched-item="res-2"]')).toBeNull()
  })

  it('omits resourceIds when nothing is manually picked (script auto-matches)', async () => {
    const host = fakeApi()
    host.resources.push(resource('res-1', 'role', '林萧'))
    const { container } = render(<PipelineCard api={host.api} t={t} projectId="prj-1" onStarted={() => {}} />)

    await waitFor(() => { expect(container.querySelector('[data-pipeline-pick-list="true"]')).toBeTruthy() })
    fireEvent.change(container.querySelector('[data-pipeline-script="true"]') as HTMLTextAreaElement, {
      target: { value: '一句话。' },
    })
    // 不勾选任何物料，直接编排
    fireEvent.click(container.querySelector('[data-pipeline-compose="true"]') as HTMLButtonElement)

    await waitFor(() => { expect(host.pipelinePayloads).toHaveLength(1) })
    expect(host.pipelinePayloads[0]!.resourceIds).toBeUndefined()
    // 没有手动挑的，也就没有 matched 回显
    expect(container.querySelector('[data-pipeline-matched]')).toBeNull()
  })
})
