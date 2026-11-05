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
    await waitFor(() => { expect(screen.getByText(en.moduleQuickDesc)).toBeTruthy() })
    // 引导三步已删；模块头的一句话说明还在（承担"这页是干什么的"）
    // 三步引导整块已删（.iv-steps 不再渲染）
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
