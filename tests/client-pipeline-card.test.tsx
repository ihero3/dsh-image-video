// @vitest-environment jsdom
/**
 * 「一键成片」卡片的渲染契约（`P0-2`）。
 *
 * 这个用例是被真机崩溃逼出来的：`pipelines/compose` 的响应是 `{ pipeline }`，api 层当初没解包，
 * 卡片读 `result.warnings.length` 直接炸掉整个快速创作面板。所以这里钉两件事：
 * 1. 点击「仅编排」后，结果条要正常渲染出分镜数与「已保存」；
 * 2. `warnings` 缺失（旧宿主/历史数据）时**不许崩**——渲染仍然完成。
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
    composePipeline: vi.fn(async () => ({
      workflowId: 'wfl-pipe-1', name: '一键成片 · 3 镜（图生视频）', mode: 'image-to-video',
      shots: 3, nodes: 6, warnings: ['未指定生图模型：将使用宿主默认模型'], missingResources: [],
    })),
    runPipeline: vi.fn(),
    ...overrides,
  } as unknown as WorkbenchApi
}

describe('PipelineCard', () => {
  it('仅编排（零花费）后渲染结果条：分镜数 + 工作流 id + 提醒', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    const script = container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement
    fireEvent.change(script, { target: { value: '雨夜街头。林夏抬头。镜头推近。' } })
    fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelector('[data-pipeline-result]')).not.toBeNull() })
    const result = container.querySelector('[data-pipeline-result]') as HTMLElement
    expect(result.textContent).toContain('Pipeline saved')
    expect(result.textContent).toContain('3 shots')
    expect(result.textContent).toContain('wfl-pipe-1')
    expect(result.textContent).toContain('未指定生图模型')
    // 只编排绝不起跑
    expect(api.runPipeline).not.toHaveBeenCalled()
  })

  it('warnings 缺失时不崩（旧宿主/历史数据）', async () => {
    const api = makeApi({
      composePipeline: vi.fn(async () => ({
        workflowId: 'wfl-pipe-2', name: '一键成片 · 1 镜', mode: 'text-to-video',
        shots: 1, nodes: 1, missingResources: [],
      })) as unknown as WorkbenchApi['composePipeline'],
    })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '一句话。' } })
    fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelector('[data-pipeline-result]')).not.toBeNull() })
    expect((container.querySelector('[data-pipeline-result]') as HTMLElement).textContent).toContain('wfl-pipe-2')
    expect(container.querySelector('[data-pipeline-error]')).toBeNull()
  })

  it('一键生成会立刻起跑，并把 workflowId 交给画布', async () => {
    const started: string[] = []
    const api = makeApi({
      runPipeline: vi.fn(async () => ({
        pipeline: { workflowId: 'wfl-run-1', name: '一键成片 · 2 镜', mode: 'image-to-video', shots: 2, nodes: 4, warnings: [], missingResources: [] },
        run: { id: 'run-1' },
      })) as unknown as WorkbenchApi['runPipeline'],
    })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={id => { started.push(id) }} />)
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '两句话。第二句。' } })
    fireEvent.click(container.querySelector('[data-pipeline-run]') as HTMLButtonElement)
    await waitFor(() => { expect(started).toEqual(['wfl-run-1']) })
    expect(api.runPipeline).toHaveBeenCalledTimes(1)
    expect((container.querySelector('[data-pipeline-result]') as HTMLElement).textContent).toContain('Pipeline started')
  })
})
