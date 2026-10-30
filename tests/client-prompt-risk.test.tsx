// @vitest-environment jsdom
/**
 * `T5` 快速路径接风控：提示词先过 `prompts/check`，block 直接禁用生成，warn 只提醒。
 *
 * 断言：
 * 1. 输入提示词后（防抖 400ms）调用 checkPrompt；
 * 2. block → 两个生成按钮禁用 + 提示条 `data-generate-risk="block"`；
 * 3. warn → 按钮仍可用 + 提示条 `data-generate-risk="warn"`；
 * 4. ok/清空 → 不显示提示条；
 * 5. 预检本身失败时**不阻塞**生成（静默降级）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'
import type { PromptRiskView } from '../src/client/api.ts'

afterEach(cleanup)

const RISK = (level: PromptRiskView['level']): PromptRiskView => ({
  level,
  hits: level === 'ok' ? [] : [{ category: 'test', term: 'x', severity: level === 'block' ? 'block' : 'warn', advice: '换个说法' }],
  advice: level === 'ok' ? [] : ['换个说法'],
})

function renderQuick(level: PromptRiskView['level']) {
  const host = fakeApi({})
  const check = vi.fn(async () => RISK(level))
  ;(host.api as unknown as { checkPrompt: typeof check }).checkPrompt = check
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '风控项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view, check }
}

const typePrompt = async (text: string) => {
  const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
  fireEvent.change(box, { target: { value: text } })
  return box
}

describe('快速路径风控（T5）', () => {
  it('block：禁用生成并显示红色提示', async () => {
    const { view, check } = renderQuick('block')
    await typePrompt('生成国家领导人的肖像')
    await waitFor(() => { expect(check).toHaveBeenCalled() }, { timeout: 2000 })
    await waitFor(() => {
      expect(view.container.querySelector('[data-generate-risk="block"]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-generate-blocked="true"]')).toBeTruthy()
    expect((screen.getByRole('button', { name: en.generateImage }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: en.generateVideo }) as HTMLButtonElement).disabled).toBe(true)
    expect(view.container.querySelector('[data-generate-risk="block"]')!.textContent).toContain(en.generateRiskBlocked)
  })

  it('warn：只提醒，按钮仍可用', async () => {
    const { view } = renderQuick('warn')
    await typePrompt('一段血腥的追逐场面')
    await waitFor(() => { expect(view.container.querySelector('[data-generate-risk="warn"]')).toBeTruthy() }, { timeout: 2000 })
    expect(view.container.querySelector('[data-generate-blocked]')).toBeNull()
    expect((screen.getByRole('button', { name: en.generateImage }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('ok：不显示提示条', async () => {
    const { view } = renderQuick('ok')
    await typePrompt('雨夜街头的橘猫')
    await new Promise(resolve => setTimeout(resolve, 700))
    expect(view.container.querySelector('[data-generate-risk]')).toBeNull()
  })

  it('预检失败时静默降级，不阻塞生成', async () => {
    const { host, view } = renderQuick('ok')
    ;(host.api as unknown as { checkPrompt: () => Promise<never> }).checkPrompt = async () => { throw new Error('rpc down') }
    await typePrompt('正常提示词')
    await new Promise(resolve => setTimeout(resolve, 700))
    expect(view.container.querySelector('[data-generate-risk]')).toBeNull()
    expect((screen.getByRole('button', { name: en.generateImage }) as HTMLButtonElement).disabled).toBe(false)
  })
})
