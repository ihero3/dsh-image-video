// @vitest-environment jsdom
/**
 * B10 空态：空列表（素材 / 任务）给出「下一步做什么」的空态文案。
 *
 * 2026-11-05 产品调整：三步引导（对话区生成 → 落入输出 → 登记进剧集）已删除
 * （用户签字：没意义、不需要引导），本文件只保留空态断言。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { cleanup, clientProps, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

describe('B10 empty states and onboarding', () => {
  it('no longer shows the 3-step onboarding guide (deleted on 2026-11-05)', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    // v1.2 紧凑表单：quick 页不再在模块头堆说明文字，等生成区挂载即可断言结构
    await waitFor(() => { expect(view.container.querySelector('[data-quick-modules]')).toBeTruthy() })
    // 引导三步与「生成快捷入口」都已删，不再回来
    expect(view.container.querySelector('.iv-steps')).toBeNull()
    expect(view.container.querySelector('[data-generate-shortcut]')).toBeNull()
  })

  it('shows empty-state guidance when there are no assets or tasks yet', async () => {
    const host = fakeApi()
    render(<Workbench {...clientProps({ api: host.api })} />)
    await waitFor(() => { expect(screen.getByText(en.noAssets)).toBeTruthy() })
    // 「下一步做什么」：没有素材时告诉用户产物会落到 outputs；没有任务时给空态文案
    expect(screen.getByText(en.noTasks)).toBeTruthy()
  })
})
