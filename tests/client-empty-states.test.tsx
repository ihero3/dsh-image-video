// @vitest-environment jsdom
/**
 * B10 空态与引导：首次打开（quick 模式）展示 3 步引导（生成 → 落入输出 → 登记进项目）；
 * 空列表（素材 / 任务）给出「下一步做什么」的空态文案。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { cleanup, clientProps, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

describe('B10 empty states and onboarding', () => {
  it('shows the 3-step onboarding guide on first open (quick mode)', async () => {
    const host = fakeApi()
    render(<Workbench {...clientProps({ api: host.api })} />)
    await waitFor(() => { expect(screen.getByText(en.heroStepChat)).toBeTruthy() })
    // 选项目 → 快速创作 → 放时间轴：生成 / 落入输出目录 / 登记进项目
    expect(screen.getByText(en.heroStepOutputs)).toBeTruthy()
    expect(screen.getByText(en.heroStepFile)).toBeTruthy()
    expect(screen.getByText(en.modeQuickHint)).toBeTruthy()
  })

  it('shows empty-state guidance when there are no assets or tasks yet', async () => {
    const host = fakeApi()
    render(<Workbench {...clientProps({ api: host.api })} />)
    await waitFor(() => { expect(screen.getByText(en.noAssets)).toBeTruthy() })
    // 「下一步做什么」：没有素材时告诉用户产物会落到 outputs；没有任务时给空态文案
    expect(screen.getByText(en.noTasks)).toBeTruthy()
  })
})
