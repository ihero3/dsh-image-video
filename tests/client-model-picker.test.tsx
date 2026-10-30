// @vitest-environment jsdom
/**
 * `T2` 模型选择器：快速路径可以指定模型，并与能力卡联动。
 *
 * 断言：
 * 1. 图片/视频各有一个下拉，候选按 `kinds` 过滤（图片下拉里不出现纯视频模型）；
 * 2. 首项是「自动」（= 宿主默认），选中后显示该模型的一句话能力摘要；
 * 3. 选中的模型随请求下发；不选则**不下发 model**（保持宿主默认链）。
 * 4. 能力卡目录取不到时降级为自动 + 明确提示，不假装有候选。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'
import type { ModelCardView } from '../src/client/api.ts'

afterEach(cleanup)

const CARDS: ModelCardView[] = [
  {
    id: 'img-a', name: 'Image A', family: 'fam', kinds: ['image'], strength: '通用文生图',
    costTier: 'low', aspectRatios: ['1:1'],
    features: {
      imageToVideo: false,
      firstLastFrame: { supported: false }, multiFrame: { supported: false },
      referenceVideo: { supported: false }, audio: { supported: false },
    },
    promptTips: ['四段式'], verified: true,
  },
  {
    id: 'vid-b', name: 'Video B', family: 'fam', kinds: ['video'], strength: '图生视频默认',
    costTier: 'medium', duration: { minSec: 1, maxSec: 30, customizable: true }, aspectRatios: ['16:9'],
    features: {
      imageToVideo: true,
      firstLastFrame: { supported: true }, multiFrame: { supported: true },
      referenceVideo: { supported: true }, audio: { supported: true },
    },
    promptTips: ['写运镜'], verified: true,
  },
]

function renderQuick(cards: readonly ModelCardView[] = CARDS) {
  const host = fakeApi({})
  const catalog = vi.fn(async () => ({ cards, consistencyIssues: [] }))
  ;(host.api as unknown as { modelsCatalog: typeof catalog }).modelsCatalog = catalog
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '模型项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view, catalog }
}

describe('模型选择器（T2）', () => {
  it('图片/视频下拉存在，且按 kinds 过滤', async () => {
    const { view } = renderQuick()
    await waitFor(() => {
      const image = view.container.querySelector('[data-generate-model="image"]') as HTMLSelectElement
      expect(image?.options.length).toBe(2) // 自动 + Image A
    })
    const image = view.container.querySelector('[data-generate-model="image"]') as HTMLSelectElement
    const video = view.container.querySelector('[data-generate-model="video"]') as HTMLSelectElement
    expect(image.options[0]!.textContent).toContain(en.generateParamAuto)
    expect(Array.from(image.options).map(o => o.value)).toEqual(['', 'img-a'])
    expect(Array.from(video.options).map(o => o.value)).toEqual(['', 'vid-b'])
  })

  it('选中后显示能力摘要', async () => {
    const { view } = renderQuick()
    await waitFor(() => { expect(view.container.querySelector('[data-generate-model="image"]')).toBeTruthy() })
    const image = view.container.querySelector('[data-generate-model="image"]') as HTMLSelectElement
    fireEvent.change(image, { target: { value: 'img-a' } })
    await waitFor(() => {
      const note = view.container.querySelector('[data-model-picker-note="img-a"]')
      expect(note?.textContent).toContain('通用文生图')
    })
  })

  it('选中的模型随请求下发；不选则不下发 model', async () => {
    const { host, view } = renderQuick()
    const spy = vi.fn(async () => ({ mediaMode: 'image' as const, path: '/tmp/o.png', bytes: 1 }))
    ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy

    const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box, { target: { value: '海边灯塔' } })
    // 先不选模型
    fireEvent.click(screen.getByRole('button', { name: en.generateImage }))
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    expect((spy.mock.calls[0]![0] as Record<string, unknown>).model).toBeUndefined()

    // 选模型后再发一次（成功后提示词被清空，要重新填）
    const image = view.container.querySelector('[data-generate-model="image"]') as HTMLSelectElement
    fireEvent.change(image, { target: { value: 'img-a' } })
    const box2 = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box2, { target: { value: '海边灯塔，第二次' } })
    await waitFor(() => { expect(screen.queryByRole('button', { name: en.generateImage })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.generateImage }))
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(2) })
    expect((spy.mock.calls[1]![0] as Record<string, unknown>).model).toBe('img-a')
  })

  it('目录不可用时降级为自动并提示', async () => {
    const { view } = renderQuick()
    const host = fakeApi({})
    void host
    // 换一个会抛错的 api
    const broken = fakeApi({})
    ;(broken.api as unknown as { modelsCatalog: () => Promise<never> }).modelsCatalog = async () => { throw new Error('no catalog') }
    broken.projects.push({
      schemaVersion: 1, id: 'prj-2', name: '坏目录',
      createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
    })
    cleanup()
    const view2 = render(<Workbench {...clientProps({ api: broken.api })} />)
    await waitFor(() => {
      expect(view2.container.querySelector('[data-model-picker-error="true"]')).toBeTruthy()
    })
    const image = view2.container.querySelector('[data-generate-model="image"]') as HTMLSelectElement
    expect(image.options.length).toBe(1) // 只有「自动」
    void view
  })
})
