// @vitest-environment jsdom
/**
 * `F3` 生成进度（Track B / B-2）：调 `tasks/running` 拿 `startedAt` → 已用时 + 进度条。
 *
 * 服务商不给百分比，所以口径是"生成中 · 12s" + 不定进度条；图片（同步）与
 * 视频（非阻塞轮询）两条路都显示。测试里推进时间（真实时钟 + 假 api 的
 * startedAt），断言文案跟着变。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 带一个项目的快速创作面板。 */
function renderQuick() {
  const host = fakeApi({})
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '进度项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 输入提示词。 */
async function typePrompt(): Promise<void> {
  fireEvent.change(await screen.findByPlaceholderText(en.generatePromptPlaceholder), { target: { value: '海面日落' } })
}

describe('F3 generation progress (B-2)', () => {
  /** 视频非阻塞生成的替身：与真宿主一致——先落一条 running 任务账本，再返回 taskId。 */
  function pendingVideoSpy(host: ReturnType<typeof fakeApi>, taskId: string) {
    return vi.fn(async () => {
      host.tasks.push({
        schemaVersion: 4, id: taskId, kind: 'video', status: 'running',
        prompt: '海面日落', projectId: 'prj-1',
        createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
      } as never)
      return { mediaMode: 'video' as const, pending: true, taskId }
    })
  }

  it('shows elapsed seconds for a running video generation (tasks/running)', async () => {
    // 宿主注册表里这条生成 5 秒前开始（wait:false 一返回就一定在册）
    const { host } = renderQuick()
    host.runningGenerations.push({
      id: 'tsk-run-1', kind: 'video', startedAt: new Date(Date.now() - 5000).toISOString(),
    })
    const spy = pendingVideoSpy(host, 'tsk-run-1')
    ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy

    await typePrompt()
    fireEvent.click(screen.getByRole('button', { name: en.generateVideo }))

    // 进度条 + "生成中 · 5s"（取 tasks/running 的 startedAt，不是本地点击时间）
    const progress = await screen.findByRole('progressbar', { name: en.generateProgress })
    expect(progress).toBeTruthy()
    await waitFor(() => { expect(screen.getByText('Generating · 5s')).toBeTruthy() })

    // 时间前进：假 api 的 startedAt 大幅前挪（60s）→ 只有消费宿主数据才可能显示这么大
    host.runningGenerations[0] = {
      id: 'tsk-run-1', kind: 'video', startedAt: new Date(Date.now() - 60_000).toISOString(),
    }
    await waitFor(() => {
      const text = document.querySelector('.iv-chip--run')?.textContent ?? ''
      const seconds = /Generating · (\d+)s/.exec(text)?.[1]
      expect(Number(seconds)).toBeGreaterThanOrEqual(58)
    }, { timeout: 12_000 })
  })

  it('ticks the elapsed clock for a synchronous image generation', async () => {
    const { host } = renderQuick()
    let release = (): void => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    const spy = vi.fn(async () => {
      await gate
      return { mediaMode: 'image' as const, path: '/tmp/outputs/gen.png', bytes: 1 }
    })
    ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy

    await typePrompt()
    fireEvent.click(screen.getByRole('button', { name: en.generateImage }))

    // 同步图片没有 taskId：用本地点击时间起步，秒表每秒推一次
    await waitFor(() => { expect(screen.getByText('Generating · 0s')).toBeTruthy() })
    await waitFor(() => { expect(screen.getByText('Generating · 1s')).toBeTruthy() }, { timeout: 3000 })

    release()
    // 生成结束：进度条与秒表一起撤下
    await waitFor(() => { expect(screen.queryByRole('progressbar', { name: en.generateProgress })).toBeNull() })
    expect(screen.getByText(en.generateDone)).toBeTruthy()
  })

  it('asks the host for the running snapshot while generating', async () => {
    const { host } = renderQuick()
    host.runningGenerations.push({
      id: 'tsk-run-2', kind: 'video', startedAt: new Date().toISOString(),
    })
    const spy = pendingVideoSpy(host, 'tsk-run-2')
    ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy

    await typePrompt()
    fireEvent.click(screen.getByRole('button', { name: en.generateVideo }))
    await waitFor(() => { expect(host.calls).toContain('tasks/running') })
  })
})
