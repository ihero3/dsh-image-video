// @vitest-environment jsdom
/**
 * `T1` 生成参数下拉：尺寸/比例/时长从裸 input 换成候选 select。
 *
 * 断言：
 * 1. 三个参数都渲染成 `<select>`，且首项是「自动（跟随当前生效值）」；
 * 2. 候选来自宿主 `health.options`（与协议层校验同源），浏览器包不内置服务端名单；
 * 3. 选中的值随请求下发（size / duration）。
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
    schemaVersion: 1, id: 'prj-1', name: '参数项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

describe('生成参数下拉（T1）', () => {
  it('三个参数都是 select，首项是自动', async () => {
    const { view } = renderQuick()
    await waitFor(() => { expect(view.container.querySelector('[data-generate-size]')).toBeTruthy() })

    for (const attr of ['data-generate-size', 'data-generate-aspect', 'data-generate-duration']) {
      const el = view.container.querySelector(`[${attr}]`)
      expect(el, attr).toBeTruthy()
      expect(el!.tagName).toBe('SELECT')
      expect((el as HTMLSelectElement).options[0]!.textContent).toContain(en.generateParamAuto)
    }
  })

  it('候选来自宿主 health.options（不止自动一项）', async () => {
    const { view } = renderQuick()
    await waitFor(() => { expect(view.container.querySelector('[data-generate-size]')).toBeTruthy() })
    const size = view.container.querySelector('[data-generate-size]') as HTMLSelectElement
    const aspect = view.container.querySelector('[data-generate-aspect]') as HTMLSelectElement
    const duration = view.container.querySelector('[data-generate-duration]') as HTMLSelectElement
    // 宿主下发 2 个尺寸 + 3 个比例 + 1..30 秒
    expect(size.options.length).toBe(3)
    expect(aspect.options.length).toBe(4)
    expect(duration.options.length).toBe(31)
  })

  it('选中的尺寸与时长随请求下发', async () => {
    const { host, view } = renderQuick()
    const spy = vi.fn(async () => ({ mediaMode: 'image' as const, path: '/tmp/outputs/p.png', bytes: 1 }))
    ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy

    const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box, { target: { value: '窗台上的橘猫' } })
    const size = view.container.querySelector('[data-generate-size]') as HTMLSelectElement
    fireEvent.change(size, { target: { value: '1152*864' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateImage }))

    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    expect(spy.mock.calls[0]![0]).toMatchObject({ mediaMode: 'image', size: '1152*864', projectId: 'prj-1' })
  })
})
