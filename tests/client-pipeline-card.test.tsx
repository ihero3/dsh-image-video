// @vitest-environment jsdom
/**
 * 「一键成片」卡片的渲染与交互契约（`P0-2` + 2026-11-05 产品口径 `B1`/`B2`/`B4`/`B5`/`B5.1`/`B6`）。
 *
 * 这个用例最早是被真机崩溃逼出来的：`pipelines/compose` 的响应是 `{ pipeline }`，api 层当初没解包，
 * 卡片读 `result.warnings.length` 直接炸掉整个快速创作面板。所以基础两条一直是：
 * 1. 点击「生成分镜」后，结果条要正常渲染出分镜数与工作流 id；
 * 2. `warnings` 缺失（旧宿主/历史数据）时**不许崩**——渲染仍然完成。
 *
 * 2026-11-05 起新增的口径各自钉一组：
 * - `B1` 剧本 6 行；`B2` 第三种模式「视频生视频（复刻）」+ 参考片；`B4` 每镜默认 6 秒；
 * - `B5` 生成后可逐条改画面/视频提示词与本镜时长，改过时长再用 `shotDurations` 重排；
 * - `B5.1`「生成画布」只落库切画布、**不起跑**；`B6`「就地生成」逐镜调 `generateMedia`，
 *   串行推进，失败能看出是第几镜。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { WorkbenchApi } from '../src/client/api.ts'
import { PipelineCard } from '../src/client/PipelineCard.tsx'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'

afterEach(() => { cleanup() })

const t = (key: WorkbenchLocaleKey): string => en[key]

/**
 * 造一份假宿主：`composePipeline` 默认回 3 镜成功结果；
 * `runPipeline` 只留作哨兵——卡片已不应该再起跑任何工作流（每次断言 `not.toHaveBeenCalled`）。
 */
function makeApi(overrides: Partial<WorkbenchApi> = {}): WorkbenchApi {
  return {
    composePipeline: vi.fn(async () => ({
      workflowId: 'wfl-pipe-1', name: '一键成片 · 3 镜（图生视频）', mode: 'image-to-video',
      shots: 3, nodes: 6, warnings: ['未指定生图模型：将使用宿主默认模型'], missingResources: [],
    })),
    runPipeline: vi.fn(),
    listResources: vi.fn(async () => []),
    createResource: vi.fn(async () => ({ id: 'res-new' })),
    // `C5`：视频 `wait:false` 提交后按任务 id 轮询成片；默认让每条任务都立刻成功
    listTasks: vi.fn(async () => [
      { id: 'tsk-video', status: 'succeeded', outputPath: '/tmp/outputs/shot.mp4' },
      { id: 'tsk-1', status: 'succeeded', outputPath: '/tmp/outputs/shot-1.mp4' },
      { id: 'tsk-2', status: 'succeeded', outputPath: '/tmp/outputs/shot-2.mp4' },
      { id: 'tsk-3', status: 'succeeded', outputPath: '/tmp/outputs/shot-3.mp4' },
    ]),
    generateMedia: vi.fn(async (input: { mediaMode: 'image' | 'video' }) => (
      input.mediaMode === 'video'
        ? { mediaMode: 'video' as const, pending: true, taskId: 'tsk-video' }
        : { mediaMode: 'image' as const, path: '/tmp/outputs/shot.png' }
    )),
    ...overrides,
  } as unknown as WorkbenchApi
}

/** 走到「生成分镜」排完版：填剧本 → 点生成分镜 → 等可编辑分镜出现。 */
async function composeShots(container: HTMLElement, script = '雨夜街头。林夏抬头。镜头推近。'): Promise<void> {
  fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: script } })
  fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
  await waitFor(() => { expect(container.querySelector('[data-pipeline-shots-panel]')).not.toBeNull() })
}

describe('PipelineCard', () => {
  it('生成分镜后渲染结果条：分镜数 + 工作流 id + 提醒，且不起跑', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '雨夜街头。林夏抬头。镜头推近。' } })
    fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelector('[data-pipeline-result]')).not.toBeNull() })
    const result = container.querySelector('[data-pipeline-result]') as HTMLElement
    expect(result.textContent).toContain(en.pipelineComposed)
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

  it('B5.1/B6：卡片不再有一键起跑按钮（起跑只发生在画布或就地生成）', async () => {
    const started: string[] = []
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={id => { started.push(id) }} />)
    // 旧「一键生成」（pipelines/run：起跑 + 跳画布）与 B5.1/B6 口径冲突，已按产品决定删除
    expect(container.querySelector('[data-pipeline-run]')).toBeNull()
    expect(container.querySelectorAll('[data-pipeline-compose], [data-pipeline-to-canvas], [data-pipeline-inline-run]').length).toBe(3)
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '一句。两句。' } })
    fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelector('[data-pipeline-result]')).not.toBeNull() })
    // 生成分镜只是排版：既不起跑、也不切画布
    expect(api.runPipeline).not.toHaveBeenCalled()
    expect(started).toEqual([])
  })

  it('没有严格模式开关：缺料只提示、不拦（用户 2026-11-04 要求删掉）', async () => {
    const composePipeline = vi.fn(async () => ({
      workflowId: 'wfl-loose-1', name: '一键成片 · 1 镜', mode: 'image-to-video',
      shots: 1, nodes: 2, warnings: [], missingResources: ['林夏'],
    }))
    const api = makeApi({ composePipeline: composePipeline as unknown as WorkbenchApi['composePipeline'] })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    // ① 复选框已经删掉
    expect(container.querySelector('[data-pipeline-strict]')).toBeNull()
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '雨夜街头，林夏走来。' } })
    fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
    // ② 缺料照常能编排（不再有"严格模式拒绝执行"这条路）
    await waitFor(() => { expect(composePipeline).toHaveBeenCalledTimes(1) })
    // ③ 请求不再带 strictResources（宿主默认宽松）
    expect(composePipeline.mock.calls[0]?.[0]).not.toHaveProperty('strictResources')
    // ④ 缺料信息仍然给出来（带登记入口）
    await waitFor(() => { expect(container.querySelector('[data-pipeline-missing-item="林夏"]')).toBeTruthy() })
  })

  // ---- B1：剧本 6 行 / B4：每镜默认 6 秒 --------------------------------------
  it('B1/B4：剧本输入框 6 行，每镜时长默认 6 秒', () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    expect((container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement).rows).toBe(6)
    expect((container.querySelector('[data-pipeline-duration]') as HTMLInputElement).value).toBe('6')
  })

  // ---- B2：视频生视频（复刻）+ 参考片 ---------------------------------------
  it('B2：模式下拉有三项，选视频生视频会出现参考片入口且缺片时给提示', async () => {
    const composePipeline = vi.fn(async () => ({
      workflowId: 'wfl-v2v', name: '一键成片 · 2 镜（视频生视频（复刻））', mode: 'video-to-video',
      shots: 2, nodes: 2, warnings: [], missingResources: [],
    }))
    const api = makeApi({ composePipeline: composePipeline as unknown as WorkbenchApi['composePipeline'] })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    const select = container.querySelector('[data-pipeline-mode]') as HTMLSelectElement
    expect([...select.options].map(option => option.value)).toEqual(['image-to-video', 'text-to-video', 'video-to-video'])
    expect(select.selectedOptions[0]?.textContent).toBe(en.pipelineModeImageToVideo)
    // 图生视频时不该有参考片区（不占位、不误导）
    expect(container.querySelector('[data-pipeline-ref-video]')).toBeNull()

    fireEvent.change(select, { target: { value: 'video-to-video' } })
    await waitFor(() => { expect(container.querySelector('[data-pipeline-ref-video]')).not.toBeNull() })
    const missing = container.querySelector('[data-pipeline-ref-video-missing]')
    expect(missing?.textContent).toContain(en.pipelineVideoToVideoNeedsRef)

    fireEvent.change(container.querySelector('[data-pipeline-ref-video-input]') as HTMLInputElement, {
      target: { value: '/tmp/outputs/ref.mp4' },
    })
    expect(container.querySelector('[data-pipeline-ref-video-missing]')).toBeNull()

    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '雨夜街头。林夏抬头。' } })
    fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
    await waitFor(() => { expect(composePipeline).toHaveBeenCalledTimes(1) })
    // 模式与参考片都下发（复刻模式必须带片）
    expect(composePipeline.mock.calls[0]?.[0]).toMatchObject({ mode: 'video-to-video', referenceVideo: '/tmp/outputs/ref.mp4' })
  })

  it('B2：宿主注入选中素材时才有「用选中素材」，点了就填参考片；未注入时不摆死按钮', async () => {
    const api = makeApi()
    const bare = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(bare.container.querySelector('[data-pipeline-mode]') as HTMLSelectElement, { target: { value: 'video-to-video' } })
    await waitFor(() => { expect(bare.container.querySelector('[data-pipeline-ref-video]')).not.toBeNull() })
    expect(bare.container.querySelector('[data-pipeline-ref-video-use]')).toBeNull()
    bare.unmount()

    const withAsset = render(
      <PipelineCard
        api={api}
        t={t}
        projectId="prj-1"
        onStarted={() => {}}
        selectedAsset={{ path: '/tmp/outputs/picked.mp4', kind: 'video' }}
      />,
    )
    fireEvent.change(withAsset.container.querySelector('[data-pipeline-mode]') as HTMLSelectElement, { target: { value: 'video-to-video' } })
    await waitFor(() => { expect(withAsset.container.querySelector('[data-pipeline-ref-video-use]')).not.toBeNull() })
    fireEvent.click(withAsset.container.querySelector('[data-pipeline-ref-video-use]') as HTMLButtonElement)
    expect((withAsset.container.querySelector('[data-pipeline-ref-video-input]') as HTMLInputElement).value).toBe('/tmp/outputs/picked.mp4')
  })

  // ---- B5：可编辑分镜（提示词 + 本镜时长 + 用 shotDurations 重排） ------------
  it('B5：生成分镜后列出可编辑分镜，改过本镜时长就用 shotDurations 重排', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await composeShots(container)
    // 三句话 → 三镜；每镜都有画面/视频提示词与本镜时长
    expect(container.querySelectorAll('[data-pipeline-shot]').length).toBe(3)
    expect(container.querySelectorAll('[data-pipeline-shot-video-prompt]').length).toBe(3)
    expect(container.querySelectorAll('[data-pipeline-shot-image-prompt]').length).toBe(3)
    expect((container.querySelector('[data-pipeline-shot-duration="2"]') as HTMLInputElement).value).toBe('6')
    expect(container.querySelector('[data-pipeline-shots-panel]')?.textContent).toContain(en.pipelineShotEditable)
    expect(container.querySelector('[data-pipeline-shots-panel]')?.textContent).toContain(en.pipelineShotDuration)
    // 首次编排不下发逐镜时长（没有改动就没有噪音）
    expect(api.composePipeline).toHaveBeenCalledTimes(1)
    expect((api.composePipeline as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0]).not.toHaveProperty('shotDurations')

    // 改第 2 镜时长 → 再点生成分镜：按逐镜时长重排
    fireEvent.change(container.querySelector('[data-pipeline-shot-duration="2"]') as HTMLInputElement, { target: { value: '9' } })
    fireEvent.click(container.querySelector('[data-pipeline-compose]') as HTMLButtonElement)
    await waitFor(() => { expect(api.composePipeline).toHaveBeenCalledTimes(2) })
    expect((api.composePipeline as unknown as { mock: { calls: unknown[][] } }).mock.calls[1]?.[0]).toMatchObject({ shotDurations: [6, 9, 6] })
  })

  it('B5：宿主回传 shotDetails 时以宿主为准（不拿本地推算覆盖）', async () => {
    const api = makeApi({
      composePipeline: vi.fn(async () => ({
        workflowId: 'wfl-detail', name: '一键成片 · 2 镜', mode: 'image-to-video',
        shots: 2, nodes: 4, warnings: [], missingResources: [],
        shotDetails: [
          { index: 1, shot: '宿主第 1 镜', duration: 4, imagePrompt: '宿主图 1', videoPrompt: '宿主视频 1' },
          { index: 2, shot: '宿主第 2 镜', duration: 11, imagePrompt: '宿主图 2', videoPrompt: '宿主视频 2' },
        ],
      })) as unknown as WorkbenchApi['composePipeline'],
    })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await composeShots(container, '一句。两句。三句。')
    // 宿主给了 2 镜（不是脚本句数），提示词与时长都用宿主那份
    expect(container.querySelectorAll('[data-pipeline-shot]').length).toBe(2)
    expect((container.querySelector('[data-pipeline-shot-duration="2"]') as HTMLInputElement).value).toBe('11')
    expect((container.querySelector('[data-pipeline-shot-video-prompt="1"]') as HTMLTextAreaElement).value).toBe('宿主视频 1')
    expect(container.querySelector('[data-pipeline-shots-panel]')?.textContent).toContain('宿主第 2 镜')
  })

  // ---- B5.1：生成画布（落库 + 切画布，但不起跑） ------------------------------
  it('B5.1：生成画布只编排并切画布，不调用 workflows/run', async () => {
    const started: string[] = []
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={id => { started.push(id) }} />)
    // 提示文案也在（说清"不生成"）
    expect(container.querySelector('[data-pipeline-button-hints]')?.textContent).toContain(en.pipelineToCanvasHint)
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '一句。两句。' } })
    fireEvent.click(container.querySelector('[data-pipeline-to-canvas]') as HTMLButtonElement)
    await waitFor(() => { expect(started).toEqual(['wfl-pipe-1']) })
    expect(api.composePipeline).toHaveBeenCalledTimes(1)
    expect(api.runPipeline).not.toHaveBeenCalled()
    expect(api.generateMedia).not.toHaveBeenCalled()
  })

  // ---- B6：就地生成（逐镜 generateMedia，串行推进） ---------------------------
  it('B6：就地生成在图生视频模式下逐镜「先出图再出视频」，并带本镜时长', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await composeShots(container)
    fireEvent.change(container.querySelector('[data-pipeline-shot-duration="3"]') as HTMLInputElement, { target: { value: '8' } })
    fireEvent.click(container.querySelector('[data-pipeline-inline-run]') as HTMLButtonElement)
    await waitFor(() => {
      expect(container.querySelectorAll('[data-pipeline-inline-row]').length).toBe(3)
      expect(container.querySelector('[data-pipeline-inline-progress]')?.textContent).not.toContain('#')
    })
    const calls = (api.generateMedia as unknown as { mock: { calls: { 0: Record<string, unknown> }[] } }).mock.calls.map(call => call[0])
    // 6 次：3 镜 ×（图 + 视频），顺序是"图 → 视频 → 图 → 视频…"（串行）
    expect(calls.map(call => call.mediaMode)).toEqual(['image', 'video', 'image', 'video', 'image', 'video'])
    const videos = calls.filter(call => call.mediaMode === 'video')
    // 每镜用自己的时长（第 3 镜改成 8 秒）
    expect(videos.map(video => video.duration)).toEqual([6, 6, 8])
    // 首帧图接力：视频请求带上刚出的那张图
    expect(videos[0]?.image).toBe('/tmp/outputs/shot.png')
    // 都提交成功：每镜一行、没有错误条
    expect(container.querySelector('[data-pipeline-inline-error]')).toBeNull()
    expect(container.querySelectorAll('[data-pipeline-inline-state="submitted"]').length).toBe(3)
  })

  it('B6：就地生成失败要看出是第几镜，且后面的镜不再偷偷跑', async () => {
    let videoCalls = 0
    const generateMedia = vi.fn(async (input: { mediaMode: 'image' | 'video' }) => {
      if (input.mediaMode === 'video') {
        videoCalls += 1
        if (videoCalls === 2) throw new Error('上游拒绝了')
        return { mediaMode: 'video' as const, pending: true, taskId: `tsk-${videoCalls}` }
      }
      return { mediaMode: 'image' as const, path: '/tmp/outputs/shot.png' }
    })
    const api = makeApi({ generateMedia: generateMedia as unknown as WorkbenchApi['generateMedia'] })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await composeShots(container)
    fireEvent.click(container.querySelector('[data-pipeline-inline-run]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelector('[data-pipeline-inline-error]')).not.toBeNull() })
    const text = (container.querySelector('[data-pipeline-inline-error]') as HTMLElement).textContent ?? ''
    expect(text).toContain('#2')
    expect(text).toContain('上游拒绝了')
    // 第 2 镜被打上失败态，第 3 镜没有开跑
    expect(container.querySelector('[data-pipeline-inline-state="failed"]')?.getAttribute('data-pipeline-inline-row')).toBe('2')
    expect(videoCalls).toBe(2)
  })

  it('C5：视频 `wait:false` 提交后要等任务落成片，才算这一镜跑完', async () => {
    let polls = 0
    const listTasks = vi.fn(async () => {
      polls += 1
      return polls < 2
        ? [{ id: 'tsk-video', status: 'running' }]
        : [{ id: 'tsk-video', status: 'succeeded', outputPath: '/tmp/outputs/shot.mp4' }]
    })
    const api = makeApi({ listTasks: listTasks as unknown as WorkbenchApi['listTasks'] })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '一句。' } })
    fireEvent.click(container.querySelector('[data-pipeline-inline-run]') as HTMLButtonElement)
    await waitFor(() => {
      expect((container.querySelector('[data-pipeline-inline-row="1"]') as HTMLElement).textContent).toContain('/tmp/outputs/shot.mp4')
    }, { timeout: 5000 })
    // 第一次轮询还在跑、第二次才拿到成片——不是"提交成功就收工"
    expect(polls).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('[data-pipeline-inline-error]')).toBeNull()
  })

  it('C5：视频任务失败要停在本镜并给出原因', async () => {
    const listTasks = vi.fn(async () => [{ id: 'tsk-video', status: 'failed', error: '内容审核未通过' }])
    const api = makeApi({ listTasks: listTasks as unknown as WorkbenchApi['listTasks'] })
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '一句。两句。' } })
    fireEvent.click(container.querySelector('[data-pipeline-inline-run]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelector('[data-pipeline-inline-error]')).not.toBeNull() })
    const text = (container.querySelector('[data-pipeline-inline-error]') as HTMLElement).textContent ?? ''
    expect(text).toContain('#1')
    expect(text).toContain('内容审核未通过')
    expect(container.querySelectorAll('[data-pipeline-inline-state="failed"]').length).toBe(1)
  })

  it('B6：没先「生成分镜」也能就地生成（客户端按同一纯函数先排版）', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    fireEvent.change(container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement, { target: { value: '一句。两句。' } })
    fireEvent.click(container.querySelector('[data-pipeline-inline-run]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelectorAll('[data-pipeline-inline-state="submitted"]').length).toBe(2) })
    // 顺带把分镜列出来（用户能对照"刚刚生成的是哪几镜"），但没有落库工作流
    expect(container.querySelectorAll('[data-pipeline-shot]').length).toBe(2)
    expect(api.composePipeline).not.toHaveBeenCalled()
  })

  it('B6：视频生视频就地生成只出视频（带参考片），没有参考片直接拒绝', async () => {
    const api = makeApi()
    const { container } = render(<PipelineCard api={api} t={t} projectId="prj-1" onStarted={() => {}} />)
    await composeShots(container, '两句。话。')
    fireEvent.change(container.querySelector('[data-pipeline-mode]') as HTMLSelectElement, { target: { value: 'video-to-video' } })
    // 没填参考片：点就地生成只给提示，一个模型调用都不发
    fireEvent.click(container.querySelector('[data-pipeline-inline-run]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelector('[data-pipeline-error]')).not.toBeNull() })
    expect((container.querySelector('[data-pipeline-error]') as HTMLElement).textContent).toContain(en.pipelineVideoToVideoNeedsRef)
    expect(api.generateMedia).not.toHaveBeenCalled()

    fireEvent.change(container.querySelector('[data-pipeline-ref-video-input]') as HTMLInputElement, { target: { value: '/tmp/outputs/ref.mp4' } })
    await composeShots(container, '两句。话。')
    fireEvent.click(container.querySelector('[data-pipeline-inline-run]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelectorAll('[data-pipeline-inline-row]').length).toBeGreaterThan(0) })
    const calls = (api.generateMedia as unknown as { mock: { calls: { 0: Record<string, unknown> }[] } }).mock.calls.map(call => call[0])
    expect(calls.every(call => call.mediaMode === 'video')).toBe(true)
    expect(calls[0]?.image).toBeUndefined()
    expect(calls[0]?.media).toEqual([{ video: '/tmp/outputs/ref.mp4', type: 'reference_video' }])
  })
})
