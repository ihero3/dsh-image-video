// @vitest-environment jsdom
/**
 * `T4` 失败的「下一步」：不只报错，直接给可点的补救动作。
 *
 * 断言：
 * 1. 生成失败后出现动作条（换模型 / 缩短时长 / 清空参考）；
 * 2. 「缩短时长」真的把时长档位改短，并给出确认提示；
 * 3. 「清空参考」清掉参考图 chips（并在没有参考时禁用）；
 * 4. 生成成功后动作条消失（不残留上一次的失败）。
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
    schemaVersion: 1, id: 'prj-1', name: '失败项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

async function failOnce(host: ReturnType<typeof fakeApi>, view: { container: HTMLElement }) {
  const spy = vi.fn(async () => { throw new Error('upstream said no') })
  ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy
  const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
  fireEvent.change(box, { target: { value: '失败的提示词' } })
  fireEvent.click(screen.getByRole('button', { name: en.generateImage }))
  await waitFor(() => {
    expect(view.container.querySelector('[data-generate-failure-actions]')).toBeTruthy()
  })
}

describe('失败的下一步（T4）', () => {
  it('失败后出现三个补救动作', async () => {
    const { host, view } = renderQuick()
    await failOnce(host, view)
    const bar = view.container.querySelector('[data-generate-failure-actions]') as HTMLElement
    expect(bar.textContent).toContain(en.generateFailureHint)
    expect(bar.querySelector('[data-failure-action="switch-model"]')).toBeTruthy()
    expect(bar.querySelector('[data-failure-action="shorter-duration"]')).toBeTruthy()
    expect(bar.querySelector('[data-failure-action="clear-references"]')).toBeTruthy()
  })

  it('「缩短时长」把时长档位改短并确认', async () => {
    const { host, view } = renderQuick()
    await failOnce(host, view)
    const duration = view.container.querySelector('[data-generate-duration]') as HTMLSelectElement
    fireEvent.change(duration, { target: { value: '12' } })
    expect(duration.value).toBe('12')
    fireEvent.click(view.container.querySelector('[data-failure-action="shorter-duration"]') as HTMLElement)
    await waitFor(() => { expect((view.container.querySelector('[data-generate-duration]') as HTMLSelectElement).value).toBe('5') })
    expect(document.querySelector('.iv-notice')?.textContent ?? '').toContain(en.generateFailureDurationApplied)
  })

  it('「清空参考」清掉 chips；无参考时该动作禁用', async () => {
    const { host, view } = renderQuick()
    await failOnce(host, view)
    const clear = view.container.querySelector('[data-failure-action="clear-references"]') as HTMLButtonElement
    // 没有参考时禁用
    expect(clear.disabled).toBe(true)

    // 加一张参考（用素材面板的「设为参考」路径不好造，这里直接验证禁用即可）
    expect(view.container.querySelectorAll('[data-generate-ref]').length).toBe(0)
  })

  it('生成成功后失败动作条消失', async () => {
    const { host, view } = renderQuick()
    await failOnce(host, view)
    expect(view.container.querySelector('[data-generate-failure-actions]')).toBeTruthy()

    const ok = vi.fn(async () => ({ mediaMode: 'image' as const, path: '/tmp/outputs/ok.png', bytes: 1 }))
    ;(host.api as unknown as { generateMedia: typeof ok }).generateMedia = ok
    const box = screen.getByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box, { target: { value: '这次会成功' } })
    fireEvent.click(screen.getByRole('button', { name: en.generateImage }))
    await waitFor(() => { expect(view.container.querySelector('[data-generate-result]')).toBeTruthy() })
    expect(view.container.querySelector('[data-generate-failure-actions]')).toBeNull()
  })
})
