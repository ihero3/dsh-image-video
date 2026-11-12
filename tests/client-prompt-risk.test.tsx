// @vitest-environment jsdom
/**
 * 快速路径的提示词风控（`T5`）**已于 2026-11-05 按产品要求删除**。
 *
 * 用户原话：「保留 没看到这个风控预检，删了吧，也不需要这个」。
 * 所以本文件从"断言风控行为"改成"断言风控不再发生"：
 * 1. 输入提示词**不再**调用 `checkPrompt`（省一次 RPC）；
 * 2. 界面上不出现 `[data-generate-risk]` 提示条，也不再有 `data-generate-blocked`；
 * 3. 生成按钮只由"没提示词 / 没剧集 / 正在生成"三种状态禁用，不受风控影响。
 *
 * 融合生图（模块 ② 内）里的风控是另一条路径，由 `client-fusion-*` 覆盖，不在这里断言。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 渲染快速创作页，并把 `checkPrompt` 换成间谍（用来证明它**没有**被调用）。 */
function renderQuick() {
  const host = fakeApi({})
  const check = vi.fn(async () => ({ level: 'block' as const, hits: [], advice: ['换个说法'] }))
  ;(host.api as unknown as { checkPrompt: typeof check }).checkPrompt = check
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '风控已删',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view, check }
}

describe('快速路径不再做提示词风控（2026-11-05 删除）', () => {
  it('typing a prompt does not call the risk endpoint and shows no risk notice', async () => {
    const { view, check } = renderQuick()
    const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box, { target: { value: '生成国家领导人的肖像' } })
    // 给足防抖时间（原实现是 400ms）
    await new Promise(resolve => setTimeout(resolve, 700))
    expect(check).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-generate-risk]')).toBeNull()
    expect(view.container.querySelector('[data-generate-blocked]')).toBeNull()
  })

  it('keeps both generate buttons enabled once a prompt exists', async () => {
    renderQuick()
    const box = await screen.findByPlaceholderText(en.generatePromptPlaceholder)
    fireEvent.change(box, { target: { value: '雨夜街头的橘猫' } })
    await waitFor(() => {
      expect((screen.getByRole('button', { name: en.generateImage }) as HTMLButtonElement).disabled).toBe(false)
    })
    expect((screen.getByRole('button', { name: en.generateVideo }) as HTMLButtonElement).disabled).toBe(false)
  })
})
