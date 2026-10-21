// @vitest-environment jsdom
/**
 * 快速创作「直接生成」（Track A / A149）：面板里发 `media/generate`，
 * 图片同步等结果并刷新素材；视频 `wait:false` + 轮询，且能取消。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 渲染带一个项目的快速创作面板。 */
function renderQuick() {
  const host = fakeApi({})
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '生成项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

describe('quick create generate (A149)', () => {
  it('sends media/generate and files the generated asset', async () => {
    const { host } = renderQuick()
    const spy = vi.fn(async (input: { mediaMode: string; prompt: string; projectId?: string }) => ({
      mediaMode: 'image' as const, path: '/tmp/outputs/gen.png', bytes: 2048,
      asset: { schemaVersion: 4, id: 'ast-gen', projectId: input.projectId ?? 'prj-1', kind: 'image', path: '/tmp/outputs/gen.png', bytes: 2048 },
    }))
    ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy

    const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box, { target: { value: '雨夜霓虹，特写' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateImage }))

    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    expect(spy.mock.calls[0]![0]).toMatchObject({ mediaMode: 'image', prompt: '雨夜霓虹，特写', projectId: 'prj-1' })
    await waitFor(() => { expect(screen.getByText(en.generateDone)).toBeTruthy() })
  })

  it('runs video non-blocking and can cancel it', async () => {
    const { host } = renderQuick()
    const generateSpy = vi.fn(async () => ({ mediaMode: 'video' as const, pending: true, taskId: 'tsk-gen-1' }))
    const cancelSpy = vi.fn(async () => true)
    ;(host.api as unknown as { generateMedia: typeof generateSpy }).generateMedia = generateSpy
    ;(host.api as unknown as { cancelTask: typeof cancelSpy }).cancelTask = cancelSpy

    const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box, { target: { value: '海面日落' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateVideo }))

    await waitFor(() => { expect(generateSpy).toHaveBeenCalledTimes(1) })
    // 视频必须是非阻塞调用
    expect(generateSpy.mock.calls[0]![0]).toMatchObject({ mediaMode: 'video', wait: false, projectId: 'prj-1' })
    // 生成中出现取消按钮，点了会真的调 tasks/cancel
    const cancel = await screen.findByRole('button', { name: en.generateCancel })
    fireEvent.click(cancel)
    await waitFor(() => { expect(cancelSpy).toHaveBeenCalledWith('tsk-gen-1') })
  })
})
