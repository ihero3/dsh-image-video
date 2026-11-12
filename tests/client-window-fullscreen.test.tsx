// @vitest-environment jsdom
/**
 * 顶栏与参数条双击窗口状态：双击空白处进入原生全屏，再双击一次恢复窗口尺寸；
 * 双击条带里的控件（模式切换、连接、编辑等）保持控件自身行为。
 */
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { cleanup } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, fakeApi, fireEvent, render, screen, waitFor } from './client-fake-api.ts'

afterEach(cleanup)

interface FullscreenStubs {
  readonly request: Mock<() => Promise<void>>
  readonly exit: Mock<() => Promise<void>>
  readonly root: HTMLElement
  /** 模拟窗口已进入全屏（浏览器会把 `fullscreenElement` 指向根元素）。 */
  enter(): void
  /** 还原 jsdom 原本没有的这些成员。 */
  restore(): void
}

function stubFullscreen(supported = true): FullscreenStubs {
  const root = document.documentElement
  const request = vi.fn<() => Promise<void>>(() => Promise.resolve())
  const exit = vi.fn<() => Promise<void>>(() => Promise.resolve())
  let element: Element | null = null
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: supported })
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element })
  Object.defineProperty(root, 'requestFullscreen', { configurable: true, value: supported ? request : undefined })
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit })
  return {
    request, exit, root,
    enter: () => { element = root },
    restore: () => {
      delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled
      delete (document as { fullscreenElement?: Element | null }).fullscreenElement
      delete (document as { exitFullscreen?: () => Promise<void> }).exitFullscreen
      delete (root as { requestFullscreen?: () => Promise<void> }).requestFullscreen
    },
  }
}

function header(container: HTMLElement): HTMLElement {
  const element = container.querySelector('[data-workbench-header]')
  expect(element).toBeTruthy()
  return element as HTMLElement
}

describe('workbench header window fullscreen', () => {
  it('双击顶栏进入全屏，已全屏时再次双击恢复窗口', () => {
    const stubs = stubFullscreen()
    try {
      const view = render(<Workbench {...clientProps()} />)
      fireEvent.doubleClick(header(view.container))
      expect(stubs.request).toHaveBeenCalledTimes(1)
      expect(stubs.exit).not.toHaveBeenCalled()

      stubs.enter()
      fireEvent.doubleClick(header(view.container))
      expect(stubs.exit).toHaveBeenCalledTimes(1)
      expect(stubs.request).toHaveBeenCalledTimes(1)
    } finally {
      stubs.restore()
    }
  })

  it('双击顶栏里的按钮只走按钮自身行为，不切换窗口状态', () => {
    const stubs = stubFullscreen()
    try {
      render(<Workbench {...clientProps()} />)
      fireEvent.doubleClick(screen.getByRole('button', { name: en.modeWorkflow }))
      expect(stubs.request).not.toHaveBeenCalled()
      expect(stubs.exit).not.toHaveBeenCalled()
    } finally {
      stubs.restore()
    }
  })

  it('宿主不支持全屏接口时双击不抛错', () => {
    const stubs = stubFullscreen(false)
    try {
      const view = render(<Workbench {...clientProps()} />)
      expect(() => { fireEvent.doubleClick(header(view.container)) }).not.toThrow()
      expect(stubs.request).not.toHaveBeenCalled()
      expect(stubs.exit).not.toHaveBeenCalled()
    } finally {
      stubs.restore()
    }
  })

  it('参数条这一行双击也能进入全屏并恢复', async () => {
    const stubs = stubFullscreen()
    try {
      const host = fakeApi({
        defaults: {
          mediaMode: null, imageProvider: 'threevideo', imageSize: '1024*1024', imageStyle: 'photo',
          videoProvider: 'threevideo', videoAspectRatio: '16:9', videoDuration: 10,
        },
      })
      const view = render(<Workbench {...clientProps({ api: host.api })} />)
      await waitFor(() => { expect(view.container.querySelector('[data-workbench-defaults]')).toBeTruthy() })
      const strip = view.container.querySelector('[data-workbench-defaults]') as HTMLElement

      fireEvent.doubleClick(strip)
      expect(stubs.request).toHaveBeenCalledTimes(1)

      stubs.enter()
      fireEvent.doubleClick(strip)
      expect(stubs.exit).toHaveBeenCalledTimes(1)
    } finally {
      stubs.restore()
    }
  })

  it('双击参数条里的编辑按钮不切换窗口状态', async () => {
    const stubs = stubFullscreen()
    try {
      const host = fakeApi({
        defaults: {
          mediaMode: null, imageProvider: 'threevideo', imageSize: '1024*1024', imageStyle: 'photo',
          videoProvider: 'threevideo', videoAspectRatio: '16:9', videoDuration: 10,
        },
      })
      const view = render(<Workbench {...clientProps({ api: host.api })} />)
      await waitFor(() => { expect(view.container.querySelector('[data-workbench-defaults-edit]')).toBeTruthy() })
      fireEvent.doubleClick(view.container.querySelector('[data-workbench-defaults-edit]') as HTMLElement)
      expect(stubs.request).not.toHaveBeenCalled()
      expect(stubs.exit).not.toHaveBeenCalled()
    } finally {
      stubs.restore()
    }
  })
})
