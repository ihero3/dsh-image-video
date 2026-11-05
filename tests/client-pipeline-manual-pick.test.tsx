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

  it('keeps the picked order and lets the user move it up/down before composing (B7)', async () => {
    const host = fakeApi()
    host.resources.push(
      resource('res-1', 'role', '林萧'),
      resource('res-2', 'scene', '雨夜街道'),
      resource('res-3', 'prop', '雨伞'),
    )
    const { container } = render(<PipelineCard api={host.api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await waitFor(() => { expect(container.querySelector('[data-pipeline-pick-list="true"]')).toBeTruthy() })
    fireEvent.change(container.querySelector('[data-pipeline-script="true"]') as HTMLTextAreaElement, {
      target: { value: '雨夜街头。林夏抬头。' },
    })
    // 先勾场景、再勾角色：挑选顺序就是排序条的顺序
    fireEvent.click(container.querySelector('[data-pipeline-pick-item="res-2"]') as HTMLInputElement)
    fireEvent.click(container.querySelector('[data-pipeline-pick-item="res-1"]') as HTMLInputElement)
    const orderNow = (): (string | null)[] => [...container.querySelectorAll('[data-pipeline-pick-selected]')]
      .map(node => node.getAttribute('data-pipeline-pick-selected'))
    expect(orderNow()).toEqual(['res-2', 'res-1'])
    // 第一项不能再上移，末项不能再下移（护栏在按钮上）
    expect((container.querySelector('[data-pipeline-pick-up="res-2"]') as HTMLButtonElement).disabled).toBe(true)
    expect((container.querySelector('[data-pipeline-pick-down="res-1"]') as HTMLButtonElement).disabled).toBe(true)
    // 把「雨夜街道」下移一位 → 顺序变成 角色 → 场景
    fireEvent.click(container.querySelector('[data-pipeline-pick-down="res-2"]') as HTMLButtonElement)
    expect(orderNow()).toEqual(['res-1', 'res-2'])
    // 排好的顺序原样写进 resourceIds（顺序即语义：先用谁的参考图）
    fireEvent.click(container.querySelector('[data-pipeline-compose="true"]') as HTMLButtonElement)
    await waitFor(() => { expect(host.pipelinePayloads).toHaveLength(1) })
    expect(host.pipelinePayloads[0]!.resourceIds).toEqual(['res-1', 'res-2'])
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
