// @vitest-environment jsdom
/**
 * 首次使用引导覆盖层的行为契约。
 *
 * 只测「组件自己的责任」：三步结构与完成标记、ffmpeg 缺失提示、默认值提交参数、Esc /
 * 「稍后再说」关闭、焦点移入弹层、样式表版本注入。连接弹层、默认值落库等接线行为属于
 * 外层工作台，不在本文件覆盖。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  GUIDE_IMAGE_SIZES,
  GuideOverlay,
  type GuideChoice,
  type GuideOverlayProps,
} from '../src/client/screens/GuideOverlay.tsx'
import { GUIDE_NS, en, zh, type GuideLocaleKey } from '../src/client/screens/guide-locales.ts'
import { GUIDE_STYLE, GUIDE_STYLE_ID, GUIDE_STYLE_VERSION } from '../src/client/screens/guide-style.ts'

afterEach(() => {
  cleanup()
  document.head.querySelectorAll(`#${GUIDE_STYLE_ID}`).forEach(node => {
    node.remove()
  })
})

const MODELS = [
  { id: 'img-a', label: 'Image A' },
  { id: 'vid-b', label: 'Video B' },
] as const

function setup(overrides: Partial<GuideOverlayProps> = {}) {
  const props: GuideOverlayProps = {
    t: (key: GuideLocaleKey) => zh[key],
    ffmpeg: { ok: true, path: '/opt/homebrew/bin/ffmpeg' },
    outputsDir: '~/Documents/deepseek-harness/default-workspace/outputs',
    models: MODELS,
    onOpenConnect: vi.fn(),
    onChangeOutputsDir: vi.fn(),
    onDone: vi.fn(),
    onDismiss: vi.fn(),
    ...overrides,
  }
  const view = render(<GuideOverlay {...props} />)
  return { ...view, props }
}

const badge = (container: HTMLElement, step: string): string | null =>
  container.querySelector(`[data-guide-step="${step}"] .ivg-n`)?.textContent ?? null

describe('GuideOverlay - 三步结构', () => {
  it('renders an accessible modal with all three steps and entry points', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: zh.title })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // 没有可聚焦元素时焦点也要有落点，这是 useDialogFocus 的调用约定。
    expect(dialog.getAttribute('tabindex')).toBe('-1')

    for (const title of [zh.step1Title, zh.step2Title, zh.step3Title]) {
      expect(screen.getByText(title)).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: zh.connectAccount })).toBeTruthy()
    expect(screen.getByRole('button', { name: zh.connectApiKey })).toBeTruthy()
    expect(screen.getByRole('button', { name: zh.enterWorkbench })).toBeTruthy()
    expect(screen.getByRole('button', { name: zh.later })).toBeTruthy()
  })

  it('shows a check mark on finished steps and leaves the unfinished one as its number', () => {
    const { container } = setup()
    // ffmpeg ok + 输出目录有值 + models 非空 → 前两步都完成
    expect(badge(container, 'connect')).toBe('✓')
    expect(badge(container, 'env')).toBe('✓')
    expect(badge(container, 'defaults')).toBe('3')
    expect(container.querySelector('[data-guide-step="defaults"]')?.getAttribute('data-current')).toBe('true')
  })

  it('keeps every step pending when neither ffmpeg nor models are ready', () => {
    const { container } = setup({ ffmpeg: undefined, models: [] })
    expect(badge(container, 'connect')).toBe('1')
    expect(badge(container, 'env')).toBe('2')
    expect(container.querySelector('[data-guide-step="connect"]')?.getAttribute('data-current')).toBe('true')
    // 探测中：两处 chip 都显示「检测中」
    expect(screen.getAllByText(zh.ffmpegChecking).length).toBeGreaterThanOrEqual(1)
  })
})

describe('GuideOverlay - 环境检查', () => {
  it('explains a missing ffmpeg with the probe message and no path', () => {
    const { container } = setup({ ffmpeg: { ok: false, message: 'command not found: ffmpeg' } })
    expect(screen.getByText(zh.ffmpegMissing)).toBeTruthy()
    const note = container.querySelector('.ivg-note[data-tone="warn"]')
    expect(note).not.toBeNull()
    expect(note?.textContent).toContain(zh.ffmpegMissingHint)
    expect(note?.textContent).toContain('command not found: ffmpeg')
    // 第 2 步没完成，徽标仍是序号 2
    expect(badge(container, 'env')).toBe('2')
  })

  it('shows the detected ffmpeg path and the outputs folder', () => {
    setup()
    expect(screen.getByText(zh.ffmpegOk)).toBeTruthy()
    expect(screen.getByText('/opt/homebrew/bin/ffmpeg')).toBeTruthy()
    expect(screen.getByText('~/Documents/deepseek-harness/default-workspace/outputs')).toBeTruthy()
    expect(screen.getByText(zh.envReady)).toBeTruthy()
  })

  it('delegates output-folder changes to the caller', () => {
    const { props } = setup()
    fireEvent.click(screen.getByRole('button', { name: zh.change }))
    expect(props.onChangeOutputsDir).toHaveBeenCalledTimes(1)
  })

  it('omits the output-folder button when the host has no way to change it', () => {
    setup({ onChangeOutputsDir: undefined })
    expect(screen.queryByRole('button', { name: zh.change })).toBeNull()
  })
})

describe('GuideOverlay - 默认模型与尺寸', () => {
  it('submits the picked image model, video model and size', () => {
    const { props } = setup()
    const image = screen.getByRole('combobox', { name: zh.imageModelLabel }) as HTMLSelectElement
    const video = screen.getByRole('combobox', { name: zh.videoModelLabel }) as HTMLSelectElement
    const size = screen.getByRole('combobox', { name: zh.imageSizeLabel }) as HTMLSelectElement

    // 未动过下拉时取清单第一项，避免默认值为空
    expect(image.value).toBe('img-a')
    expect(video.value).toBe('img-a')
    expect(size.value).toBe(GUIDE_IMAGE_SIZES[0])

    fireEvent.change(image, { target: { value: 'vid-b' } })
    fireEvent.change(video, { target: { value: 'img-a' } })
    fireEvent.change(size, { target: { value: '720*1280' } })
    fireEvent.click(screen.getByRole('button', { name: zh.enterWorkbench }))

    expect(props.onDone).toHaveBeenCalledTimes(1)
    const choice = (props.onDone as unknown as { mock: { calls: [GuideChoice][] } }).mock.calls[0]![0]
    expect(choice).toEqual({ imageModel: 'vid-b', videoModel: 'img-a', imageSize: '720*1280' })
  })

  it('falls back to an explanatory option and empty ids when no model is available', () => {
    const { props } = setup({ models: [] })
    const image = screen.getByRole('combobox', { name: zh.imageModelLabel }) as HTMLSelectElement
    expect(image.value).toBe('')
    expect(image.textContent).toContain(zh.noModels)
    fireEvent.click(screen.getByRole('button', { name: zh.enterWorkbench }))
    expect(props.onDone).toHaveBeenCalledWith({
      imageModel: '',
      videoModel: '',
      imageSize: GUIDE_IMAGE_SIZES[0],
    })
  })
})

describe('GuideOverlay - 关闭与焦点', () => {
  it('closes on Esc through the shared dialog focus hook', () => {
    const { props } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses via the later button and a backdrop click, but not from inside the card', () => {
    const { props, container } = setup()
    fireEvent.click(screen.getByRole('button', { name: zh.later }))
    expect(props.onDismiss).toHaveBeenCalledTimes(1)

    fireEvent.mouseDown(container.querySelector('.ivg-mask') as HTMLElement)
    expect(props.onDismiss).toHaveBeenCalledTimes(2)

    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(props.onDismiss).toHaveBeenCalledTimes(2)
  })

  it('opens the connect flow from both entry points and flips step one to done', () => {
    const { props, container } = setup({ models: [] })
    expect(badge(container, 'connect')).toBe('1')

    fireEvent.click(screen.getByRole('button', { name: zh.connectAccount }))
    expect(props.onOpenConnect).toHaveBeenCalledTimes(1)
    // 用户去连接后回来，第一步至少表达「已去处理」
    expect(badge(container, 'connect')).toBe('✓')

    fireEvent.click(screen.getByRole('button', { name: zh.connectApiKey }))
    expect(props.onOpenConnect).toHaveBeenCalledTimes(2)
  })

  it('moves focus into the dialog on mount', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: zh.title })
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: zh.connectAccount }))
  })
})

describe('GuideOverlay - 文案与样式', () => {
  it('ships complete zh/en copy under its own namespace', () => {
    expect(GUIDE_NS).toBe('image-video-guide')
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    for (const key of Object.keys(zh) as GuideLocaleKey[]) {
      expect(zh[key].length).toBeGreaterThan(0)
      expect(en[key].length).toBeGreaterThan(0)
    }
  })

  it('renders English copy through the injected t function', () => {
    setup({ t: (key: GuideLocaleKey) => en[key] })
    expect(screen.getByRole('dialog', { name: en.title })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.enterWorkbench })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.later })).toBeTruthy()
  })

  it('injects a versioned guide-only stylesheet scoped by the ivg- prefix', () => {
    setup()
    const sheet = document.getElementById(GUIDE_STYLE_ID) as HTMLStyleElement | null
    expect(sheet).not.toBeNull()
    expect(sheet?.textContent).toBe(GUIDE_STYLE)
    expect(sheet?.dataset.version).toBe(GUIDE_STYLE_VERSION)
    // 独立表：不能顺手把主工作台样式注入进来
    expect(document.getElementById('dsh-image-video-workbench-style')).toBeNull()
    // 颜色只取宿主/工作台令牌（--dsw-alias-* / --iv-*），不写死部署事实
    expect(GUIDE_STYLE).toContain('--dsw-alias-')
    expect(GUIDE_STYLE).toContain('.ivg-mask')
    // 样式表是模板字符串：反引号会提前终止字符串
    expect(GUIDE_STYLE).not.toContain('`')
  })
})
