// @vitest-environment jsdom
/**
 * `T3` 本次结果就地展示：生成完在生成按钮下方看到产物，不用滚到最底部停靠区。
 *
 * 断言：
 * 1. 图片同步成功后出现 `[data-generate-result]`，含缩略图与「查看 / 设为参考 / 关闭」；
 * 2. 「设为参考」把产物加进参考图 chips；
 * 3. 「关闭」把结果卡收掉；
 * 4. 视频（非阻塞）完成后同样就地展示（路径取自任务账本）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

function renderQuick() {
  const host = fakeApi({})
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '结果项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

async function generateOnce(host: ReturnType<typeof fakeApi>, view: { container: HTMLElement }) {
  const spy = vi.fn(async () => ({
    mediaMode: 'image' as const, path: '/tmp/outputs/last.png', bytes: 1024,
  }))
  ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy
  const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
  fireEvent.change(box, { target: { value: '窗台上的橘猫' } })
  fireEvent.click(screen.getByRole('button', { name: en.generateImage }))
  await waitFor(() => { expect(view.container.querySelector('[data-generate-result]')).toBeTruthy() })
  return spy
}

describe('本次结果就地展示（T3）', () => {
  it('生成成功后出现结果卡与缩略图', async () => {
    const { host, view } = renderQuick()
    await generateOnce(host, view)
    const card = view.container.querySelector('[data-generate-result]') as HTMLElement
    expect(card.getAttribute('data-generate-result')).toBe('/tmp/outputs/last.png')
    expect(card.textContent).toContain(en.generateResultTitle)
    expect(card.querySelector('[data-generate-result-media="image"]')).toBeTruthy()
    expect(card.querySelector('[data-generate-result-view]')).toBeTruthy()
    expect(card.querySelector('[data-generate-result-as-ref]')).toBeTruthy()
  })

  it('「设为参考」把结果加进参考图；「关闭」收掉结果卡', async () => {
    const { host, view } = renderQuick()
    await generateOnce(host, view)
    const card = view.container.querySelector('[data-generate-result]') as HTMLElement

    fireEvent.click(card.querySelector('[data-generate-result-as-ref]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-generate-ref="/tmp/outputs/last.png"]')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: en.generateResultDismiss }))
    await waitFor(() => { expect(view.container.querySelector('[data-generate-result]')).toBeNull() })
  })

  it('视频完成后也用任务账本的产物路径就地展示', async () => {
    const { host, view } = renderQuick()
    const tasks = (host as unknown as { tasks: Array<Record<string, unknown>> }).tasks
    const spy = vi.fn(async () => ({ mediaMode: 'video' as const, pending: true, taskId: 'tsk-v1' }))
    ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy
    tasks.push({
      schemaVersion: 4, id: 'tsk-v1', kind: 'video', status: 'succeeded',
      provider: 'threevideo', prompt: '海面日落', projectId: 'prj-1',
      outputPath: '/tmp/outputs/last.mp4',
      startedAt: '2026-10-30T00:00:00.000Z',
    })
    const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box, { target: { value: '海面日落' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateVideo }))
    await waitFor(() => {
      const card = view.container.querySelector('[data-generate-result]')
      expect(card?.getAttribute('data-generate-result')).toBe('/tmp/outputs/last.mp4')
      expect(card?.querySelector('[data-generate-result-media="video"]')).toBeTruthy()
    })
  })
})
