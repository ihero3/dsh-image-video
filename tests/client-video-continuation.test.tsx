// @vitest-environment jsdom
/**
 * `B-4`（A-4）视频续写显式模式：必须有参考视频，缺则响亮拒绝（绝不静默降级成普通生视频）；
 * 有参考视频时 `continuation:true` 随 `media/generate` 透传宿主。
 *
 * 端点由 Track A 的 A-4 落地；本文件只用假宿主验证**界面行为**：守卫拦截与续写透传。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 一个项目 + （可选）一段视频素材，渲染快速创作面板。 */
function renderQuick(withVideo = false) {
  const host = fakeApi()
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '生成项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  if (withVideo) {
    host.assets.push({
      schemaVersion: 4, id: 'ast-vid', projectId: 'prj-1', kind: 'video',
      path: '/tmp/outputs/clip.mp4', bytes: 1024, createdAt: '2026-10-21T00:00:00.000Z',
    } as never)
  }
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

describe('B-4 video continuation (A-4)', () => {
  it('refuses to continue without a reference video', async () => {
    const { host, view } = renderQuick()
    const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box, { target: { value: '接上一镜继续' } })
    // 开启续写但没给参考视频
    fireEvent.click(view.container.querySelector('[data-video-continuation="true"]') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: en.generateVideo }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain(en.videoContinuationNeedsRefVideo)
    })
    // 守卫在调用前拦截，绝不发出生成请求
    expect(host.generatePayloads).toHaveLength(0)
  })

  it('passes continuation:true when a reference video is supplied', async () => {
    const { host, view } = renderQuick(true)
    const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box, { target: { value: '接上一镜继续' } })

    // 选中视频素材行（单击行即设为当前选中资源）
    const rows = Array.from(view.container.querySelectorAll('li.iv-row')) as HTMLElement[]
    const videoRow = rows.find(row => row.textContent?.includes('clip.mp4'))
    expect(videoRow).toBeTruthy()
    fireEvent.click(videoRow as HTMLElement)

    // 参考视频按钮此刻可用
    const refBtn = view.container.querySelector('[data-video-reference-use="true"]') as HTMLButtonElement
    expect(refBtn.disabled).toBe(false)
    fireEvent.click(refBtn)

    // 开启续写显式模式
    fireEvent.click(view.container.querySelector('[data-video-continuation="true"]') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: en.generateVideo }))

    await waitFor(() => { expect(host.generatePayloads).toHaveLength(1) })
    const payload = host.generatePayloads[0] as { mediaMode: 'image' | 'video'; continuation?: boolean }
    expect(payload.mediaMode).toBe('video')
    expect(payload.continuation).toBe(true)
  })
})
