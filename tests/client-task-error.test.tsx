// @vitest-environment jsdom
/**
 * `T10` 任务面板：失败原因可展开。
 *
 * 之前失败任务只在 `title` 里带 error——鼠标悬停才看得到，触屏和键盘都拿不到。
 * 现在给失败任务一个「查看原因」按钮，展开后完整显示上游原文。
 *
 * 断言：
 * 1. 失败任务显示「查看原因」按钮，成功/进行中不显示；
 * 2. 点开后出现 `[data-task-error]` 且内容为上游原文；
 * 3. 再点收起；
 * 4. 没有 error 的失败任务不显示该按钮（不给出空展开）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const task = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  schemaVersion: 4, id, kind: 'video' as const, status, provider: 'threevideo',
  prompt: '海面日落', projectId: 'prj-1', startedAt: '2026-10-30T00:00:00.000Z', ...extra,
})

function renderWith(tasks: ReturnType<typeof task>[]) {
  const host = fakeApi({ tasks: tasks as never })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '任务项目',
    createdAt: '2026-10-30T00:00:00.000Z', updatedAt: '2026-10-30T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

describe('任务失败原因（T10）', () => {
  it('失败任务有「查看原因」，展开显示原文，再点收起', async () => {
    const { view } = renderWith([task('tsk-f1', 'failed', { error: 'Upstream request failed: model minimax-h3 unavailable' })])
    const toggle = await waitFor(() => {
      const node = view.container.querySelector('[data-task-error-toggle="tsk-f1"]') as HTMLButtonElement
      expect(node).toBeTruthy()
      return node
    })
    expect(toggle.textContent).toContain(en.taskErrorShow)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(view.container.querySelector('[data-task-error="tsk-f1"]')).toBeNull()

    fireEvent.click(toggle)
    await waitFor(() => {
      const pre = view.container.querySelector('[data-task-error="tsk-f1"]') as HTMLElement
      expect(pre).toBeTruthy()
      expect(pre.textContent).toContain('model minimax-h3 unavailable')
    })
    expect((view.container.querySelector('[data-task-error-toggle="tsk-f1"]') as HTMLElement).textContent).toContain(en.taskErrorHide)

    fireEvent.click(view.container.querySelector('[data-task-error-toggle="tsk-f1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-task-error="tsk-f1"]')).toBeNull() })
  })

  it('成功任务不显示该按钮', async () => {
    const { view } = renderWith([task('tsk-ok', 'succeeded', { outputPath: '/tmp/outputs/x.mp4', bytes: 100 })])
    await waitFor(() => { expect(view.container.querySelector('[data-task-card="tsk-ok"]')).toBeTruthy() })
    expect(view.container.querySelector('[data-task-error-toggle="tsk-ok"]')).toBeNull()
  })

  it('失败但没有 error 原文时不显示按钮（不给空展开）', async () => {
    const { view } = renderWith([task('tsk-f2', 'failed')])
    await waitFor(() => { expect(view.container.querySelector('[data-task-card="tsk-f2"]')).toBeTruthy() })
    expect(view.container.querySelector('[data-task-error-toggle="tsk-f2"]')).toBeNull()
  })
})
