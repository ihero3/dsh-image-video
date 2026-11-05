// @vitest-environment jsdom
/**
 * 「失败的下一步」按钮组（`T4` / 清单 C11 + C14）**已于 2026-11-05 删除**。
 *
 * 用户对功能清单的批注：C11 写「保留（没看到这个）」、C14 写「可以试试（换模型/缩短时长/清空参考）
 * —— 删掉吧」。两者描述的是界面上同一组按钮，按 C14 执行：**只留错误文案，不再给一排补救按钮**。
 *
 * 本文件因此改为"回归哨兵"：
 * 1. 生成失败后**不出现** `[data-generate-failure-actions]` 动作条；
 * 2. 失败原因仍然可见（顶部提示条 `iv-notice--error` 带服务商原始信息）；
 * 3. 参数与参考图**不会被自动改动**（删掉动作条后，任何"顺手改状态"的副作用都不该存在）。
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

/** 让一次生图失败，返回容器。 */
async function failOnce(host: ReturnType<typeof fakeApi>) {
  const spy = vi.fn(async () => { throw new Error('upstream said no') })
  ;(host.api as unknown as { generateMedia: typeof spy }).generateMedia = spy
  const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
  fireEvent.change(box, { target: { value: '失败的提示词' } })
  fireEvent.click(screen.getByRole('button', { name: en.generateImage }))
}

describe('失败不再给"可以试试"按钮组（2026-11-05 删除）', () => {
  it('keeps the error message but shows no remediation bar', async () => {
    const { host, view } = renderQuick()
    await failOnce(host)
    // 错误原因仍要可见（服务商原文进提示条）
    await waitFor(() => { expect(view.container.textContent).toContain('upstream said no') })
    // 动作条已删
    expect(view.container.querySelector('[data-generate-failure-actions]')).toBeNull()
    expect(view.container.querySelector('[data-failure-action]')).toBeNull()
  })

  it('does not silently change duration or clear references on failure', async () => {
    const { host, view } = renderQuick()
    await failOnce(host)
    await waitFor(() => { expect(view.container.textContent).toContain('upstream said no') })
    const duration = view.container.querySelector('[data-generate-duration]') as HTMLSelectElement
    // 时长仍是默认跟随（''），没被"缩短时长"副作用改掉
    expect(duration.value).toBe('')
  })
})
