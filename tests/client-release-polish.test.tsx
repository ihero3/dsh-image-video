// @vitest-environment jsdom
/**
 * `B-17` 发布前收尾：帮助入口（模式说明 + 联系方式 + 版本）与示例项目。
 *
 * 帮助浮层不再罗列快捷键，改为四类说明、联系方式与版本号（版本只在这里展示，
 * 头部不再占位）；示例项目一键建项并套用「快速图片」模板，让新用户打开就有东西可看。
 * 真实生成端到端走查需要宿主授权（见 `docs/archive/2026-10-31/WALKTHROUGH-v1.0.0.md`），
 * 本文件只覆盖不花额度的部分。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

describe('B-17 release polish', () => {
  it('opens the help overlay with mode descriptions, contact and version', async () => {
    const view = render(<Workbench {...clientProps()} />)
    await screen.findByRole('button', { name: en.modeQuick })

    // 默认不占地方：帮助浮层不存在
    expect(view.container.querySelector('[data-workbench-help]')).toBeNull()

    fireEvent.click(view.container.querySelector('[data-workbench-help-toggle]') as HTMLElement)
    const help = view.container.querySelector('[data-workbench-help]') as HTMLElement
    expect(help).toBeTruthy()
    // 四个模式的说明：顺序是快速创作 → 剧本生成 → 工作流 → 时间线
    const modes = [en.helpModeQuick, en.helpModeScript, en.helpModeWorkflow, en.helpModeTimeline]
    for (const text of modes) expect(help.textContent).toContain(text)
    const order = modes.map(text => help.textContent?.indexOf(text) ?? -1)
    expect(order.every(index => index >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    // 联系方式
    expect(help.textContent).toContain(en.helpContactOrg)
    expect(help.textContent).toContain(en.helpContactWechat)
    // 版本号只在帮助里展示，头部不再占位
    expect(help.textContent).toContain('0.3.1')
    const topMeta = view.container.querySelector('.iv-top-meta') as HTMLElement
    expect(topMeta?.textContent ?? '').not.toContain('0.3.1')

    // 关闭按钮收起
    fireEvent.click(view.container.querySelector('[data-workbench-help-close]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-workbench-help]')).toBeNull() })
  })

  it('creates an example project seeded with the quick-image template', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    await screen.findByText(en.projectNone)

    fireEvent.click(view.container.querySelector('[data-workbench-example-project]') as HTMLElement)
    await waitFor(() => { expect(host.projects).toHaveLength(1) })
    // 示例工作流落库：script → image-generate 两个节点（quick-image 模板）
    await waitFor(() => { expect(host.workflows).toHaveLength(1) })
    const workflow = host.workflows[0]
    expect(workflow?.projectId).toBe(host.projects[0]?.id)
    expect(workflow?.nodes.map(node => node.kind)).toEqual(['script', 'image-generate'])
    expect(workflow?.edges).toHaveLength(1)
    // 建完即选中：顶栏选择器里出现示例项目
    const picker = screen.getByRole('combobox', { name: en.sectionProject })
    expect([...picker.querySelectorAll('option')]).toHaveLength(1)
    expect(view.container.querySelector('.iv-notice')?.textContent).toContain(en.exampleProjectDone)
  })

  it('hides the example-project button once a project exists', async () => {
    const host = fakeApi()
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '已有项目',
      createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
    })
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    await screen.findByRole('combobox', { name: en.sectionProject })
    expect(view.container.querySelector('[data-workbench-example-project]')).toBeNull()
  })
})
