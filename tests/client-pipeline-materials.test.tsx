// @vitest-environment jsdom
/**
 * 「一键成片」物料自动匹配闭环（`P0-2` 待补：物料挑选/自动匹配 UI 第一步）。
 *
 * 宿主 `pipelines/compose` 本来就回传 `missingResources`（剧本提到、资源库还没有的
 * 角色/场景/物品），客户端类型里也有这个字段，但界面一直没渲染——严格模式下用户只看到
 * 一句"对不上"，不知道缺什么、去哪补。这里钉五件事：
 * 1. 缺失物料必须渲染成清单（名字 + 说明 + 登记入口）；
 * 2. 点「登记为角色/场景/物品」→ 调 `resources/create` → **按同一入参自动重编**，
 *    刷新后缺项消失（不让用户自己再点一次「仅编排」）；
 * 3. 登记失败如实报错，缺项仍在——不伪造"已匹配"；
 * 4. 缺失为空时显示"未检测到缺失物料"，不给假阳性；
 * 5. 登记进行中登记按钮禁用（按钮 disabled 即护栏）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { WorkbenchApi } from '../src/client/api.ts'
import { PipelineCard } from '../src/client/PipelineCard.tsx'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'

afterEach(() => { cleanup() })

const t = (key: WorkbenchLocaleKey): string => en[key]

/** 采集 spy 引用，方便断言入参（api 对象本身是 `as unknown as WorkbenchApi` 造的）。 */
interface PipelineSpies {
  readonly api: WorkbenchApi
  readonly composePipeline: ReturnType<typeof vi.fn>
  readonly createResource: ReturnType<typeof vi.fn>
  readonly runPipeline: ReturnType<typeof vi.fn>
}

/**
 * 假宿主：第一次 compose 回缺失清单，之后（登记后重编）缺失为空。
 * @param options.missing - 首次编排的缺失物料名。
 * @param options.createError - 登记时宿主抛的错误（模拟重名等）。
 */
function makeApi(options: { readonly missing?: readonly string[]; readonly createError?: Error } = {}): PipelineSpies {
  const missing = options.missing ?? ['林夏', '雨夜街头']
  let composeCalls = 0
  const composePipeline = vi.fn(async () => {
    composeCalls += 1
    return {
      workflowId: 'wfl-pipe-1',
      name: '一键成片 · 3 镜（图生视频）',
      mode: 'image-to-video',
      shots: 3,
      nodes: 6,
      warnings: [],
      missingResources: composeCalls === 1 ? missing : [],
    }
  })
  const createResource = options.createError === undefined
    ? vi.fn(async () => ({ id: 'res-1' }))
    : vi.fn(async () => { throw options.createError })
  const runPipeline = vi.fn()
  const api = { composePipeline, createResource, runPipeline } as unknown as WorkbenchApi
  return { api, composePipeline, createResource, runPipeline }
}

/** 走一遍「填剧本 → 仅编排」，等结果区出现。 */
async function composeScript(container: HTMLElement, script: string): Promise<void> {
  fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: script } })
  fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
  await waitFor(() => { expect(container.querySelector('[data-pipeline-result]')).not.toBeNull() })
}

describe('PipelineCard 物料自动匹配', () => {
  it('编排结果渲染缺失物料清单与登记入口', async () => {
    const spies = makeApi()
    const { container } = render(<PipelineCard api={spies.api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await composeScript(container, '雨夜街头。林夏抬头。镜头推近。')
    expect(container.querySelector('[data-pipeline-missing-item="林夏"]')).not.toBeNull()
    expect(container.querySelector('[data-pipeline-missing-item="雨夜街头"]')).not.toBeNull()
    // 每个缺失项三个登记入口（角色/场景/物品）
    expect(container.querySelectorAll('[data-pipeline-register="role"]').length).toBe(2)
    expect(container.querySelectorAll('[data-pipeline-register="scene"]').length).toBe(2)
    expect(container.querySelectorAll('[data-pipeline-register="prop"]').length).toBe(2)
    // 只编排绝不起跑
    expect(spies.runPipeline).not.toHaveBeenCalled()
  })

  it('登记为角色后自动重编：缺项消失、入参正确', async () => {
    const spies = makeApi()
    const { container } = render(<PipelineCard api={spies.api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await composeScript(container, '雨夜街头。林夏抬头。镜头推近。')
    fireEvent.click(
      container.querySelector('[data-pipeline-missing-item="林夏"] [data-pipeline-register="role"]') as HTMLButtonElement,
    )
    await waitFor(() => { expect(container.querySelector('[data-pipeline-missing]')).toBeNull() })
    // 登记入参：项目 + 类型 + 名字，一个不少
    expect(spies.createResource).toHaveBeenCalledTimes(1)
    expect(spies.createResource.mock.calls[0]?.[0]).toMatchObject({ projectId: 'prj-1', kind: 'role', name: '林夏' })
    // 自动重编过一次（第二次 compose 回传缺失为空）
    expect(spies.composePipeline).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[data-pipeline-missing-none]')).not.toBeNull()
    expect(container.querySelector('[data-pipeline-error]')).toBeNull()
  })

  it('登记失败如实报错，缺项仍在（不伪造已匹配）', async () => {
    const spies = makeApi({ createError: new Error('同名资源已存在') })
    const { container } = render(<PipelineCard api={spies.api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await composeScript(container, '雨夜街头。林夏抬头。镜头推近。')
    fireEvent.click(
      container.querySelector('[data-pipeline-missing-item="林夏"] [data-pipeline-register="scene"]') as HTMLButtonElement,
    )
    await waitFor(() => { expect(container.querySelector('[data-pipeline-error]')).not.toBeNull() })
    expect((container.querySelector('[data-pipeline-error]') as HTMLElement).textContent).toContain('同名资源已存在')
    // 没有假装匹配上：缺项还在，也没有偷偷重编
    expect(container.querySelector('[data-pipeline-missing-item="林夏"]')).not.toBeNull()
    expect(spies.composePipeline).toHaveBeenCalledTimes(1)
  })

  it('缺失为空时显示未检测到缺失物料', async () => {
    const spies = makeApi({ missing: [] })
    const { container } = render(<PipelineCard api={spies.api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await composeScript(container, '一句话。')
    expect(container.querySelector('[data-pipeline-missing-none]')).not.toBeNull()
    expect(container.querySelector('[data-pipeline-missing]')).toBeNull()
    expect(container.querySelectorAll('[data-pipeline-register]').length).toBe(0)
  })

  it('登记进行中禁用登记按钮（按钮 disabled 即护栏）', async () => {
    let release: (value: { id: string }) => void = () => {}
    const createResource = vi.fn(() => new Promise<{ id: string }>(resolve => { release = resolve }))
    const spies = makeApi()
    const api = { ...spies.api, createResource } as unknown as WorkbenchApi
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await composeScript(container, '雨夜街头。林夏抬头。镜头推近。')
    fireEvent.click(
      container.querySelector('[data-pipeline-missing-item="林夏"] [data-pipeline-register="role"]') as HTMLButtonElement,
    )
    const button = container.querySelector('[data-pipeline-missing-item="林夏"] [data-pipeline-register="role"]') as HTMLButtonElement
    await waitFor(() => { expect(button.disabled).toBe(true) })
    release({ id: 'res-1' })
    await waitFor(() => { expect(container.querySelector('[data-pipeline-missing]')).toBeNull() })
  })
})
