// @vitest-environment jsdom
/**
 * 顶栏（2026-11-13 用户反馈）：
 * - 第一行的「生效默认值」图标删掉，参数编辑只留在第二行的「编辑」按钮；
 * - 「链接服务」图标换成文字按钮「登录三视」，登录后显示用户名（或邮箱）；
 * - 新建集 ↔ 模式切换、模式切换 ↔ 登录三视 各有一条竖线分隔。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render, screen, waitFor } from './client-fake-api.ts'

afterEach(cleanup)

describe('顶栏', () => {
  it('signed out: shows 登录三视, drops the duplicate defaults icon, keeps the separators', async () => {
    const host = fakeApi({ defaults: { imageProvider: 'stub-image' } })
    const view = render(<Workbench {...clientProps({ api: host.api })} />)

    const toggle = await waitFor(() => {
      const found = view.container.querySelector('[data-workbench-connect-toggle]') as HTMLButtonElement | null
      expect(found).toBeTruthy()
      return found as HTMLButtonElement
    })
    expect(toggle.textContent).toContain(en.loginThreeView)
    expect(toggle.getAttribute('data-connect-signed-in')).toBe('false')

    // 第一行不再有「生效默认值」图标按钮；第二行的「编辑」仍在
    expect(screen.queryByRole('button', { name: en.railDefaults })).toBeNull()
    await waitFor(() => { expect(view.container.querySelector('[data-workbench-defaults-edit]')).toBeTruthy() })

    // 原来的三个统计块（输出产物 / 媒体素材 / 生成任务）已删除
    expect(view.container.querySelector('[data-workbench-stats]')).toBeNull()

    // 登录 / 帮助 / 工作台三个图标吸附在最右侧，排在保存状态与版本号之后
    const meta = view.container.querySelector('.iv-top-meta') as HTMLElement
    const tools = view.container.querySelector('.iv-top-tools') as HTMLElement
    expect(meta.nextElementSibling).toBe(tools)
    expect(tools.querySelectorAll('button')).toHaveLength(3)
    expect(tools.querySelector('.iv-top-sep')).toBeNull()

    // 新建集 ↔ 模式切换 的竖线还在
    const modes = view.container.querySelector('.iv-modes') as HTMLElement
    expect(modes.previousElementSibling?.classList.contains('iv-top-sep')).toBe(true)
  })

  it('signed in: the same button shows the user name', async () => {
    const host = fakeApi()
    const api = {
      ...host.api,
      authHealth: async () => ({ ...(await host.api.authHealth()), signedIn: true, username: 'tester' }),
    }
    const view = render(<Workbench {...clientProps({ api })} />)

    await waitFor(() => {
      const toggle = view.container.querySelector('[data-workbench-connect-toggle]') as HTMLButtonElement
      expect(toggle.textContent).toContain('tester')
      expect(toggle.getAttribute('data-connect-signed-in')).toBe('true')
    })
  })
})
