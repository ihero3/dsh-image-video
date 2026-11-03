// @vitest-environment jsdom
/**
 * 「媒体素材」面板顶部的本地产物统计（用户 2026-11-03 提出"想看占了多少磁盘、能不能打开目录"）。
 *
 * 产品边界：**只展示 + 打开目录，不提供清理**——删除是破坏性动作，交给人自己在文件管理器里做。
 * 所以这里断言两件事：① 体积数字来自 `assets/size-report`；② 打开目录失败时把路径给用户手动打开，
 * 不假装成功。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 挂载工作台并等体积行出现。 */
async function renderAssets(options: Parameters<typeof fakeApi>[0] = {}) {
  const host = fakeApi(options)
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  await waitFor(() => { expect(view.container.querySelector('[data-asset-storage]')).toBeTruthy() })
  return { host, view }
}

describe('媒体素材 · 本地产物统计与打开目录', () => {
  it('shows how much disk the local outputs take, from the size report', async () => {
    const { host, view } = await renderAssets({
      sizeReport: { totalBytes: 1_288_490_188, topBytes: 0, topShare: 0, medianBytes: 0, count: 32, top: [] },
    })
    const line = view.container.querySelector('[data-asset-storage]') as HTMLElement
    await waitFor(() => { expect(line.textContent).toContain('32') })
    expect(line.textContent).toContain(en.storageUsageLabel)
    // 体积按 MB/GB 展示（单位取决于大小与实现，只断言出现人类可读单位）
    expect(line.textContent).toMatch(/\d+(?:\.\d+)?\s?(?:MB|GB)/)
    expect(host.calls).toContain('assets/size-report')
  })

  it('opens the outputs folder through the host and reports success quietly', async () => {
    const { host, view } = await renderAssets()
    fireEvent.click(view.container.querySelector('[data-asset-reveal]') as HTMLElement)
    await waitFor(() => { expect(host.calls).toContain('outputs/reveal') })
    expect(view.container.querySelector('[data-asset-reveal-note]')).toBeNull()
  })

  it('shows the path when the host cannot open a file manager (no fake success)', async () => {
    const { view } = await renderAssets({
      revealResult: { ok: false, path: '/home/user/.dsh/outputs', reason: '无法唤起文件管理器（xdg-open）' },
    })
    fireEvent.click(view.container.querySelector('[data-asset-reveal]') as HTMLElement)
    const note = await waitFor(() => {
      const element = view.container.querySelector('[data-asset-reveal-note]') as HTMLElement
      expect(element).toBeTruthy()
      return element
    })
    expect(note.textContent).toContain('/home/user/.dsh/outputs')
    // 文案要说明"打不开"，而不是静默什么都不发生
    expect(note.textContent).toContain(en.storageRevealFailed.split('{path}')[0]!.trim())
  })
})
