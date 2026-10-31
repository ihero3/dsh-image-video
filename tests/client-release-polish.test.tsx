// @vitest-environment jsdom
/**
 * `B-17` 发布前收尾：帮助入口（快捷键 + 模式说明）与示例项目。
 *
 * 帮助浮层只陈述**真实存在**的快捷键（Ctrl/⌘+Enter 生成、Ctrl/⌘+Z 撤销、
 * 空格播放、Delete 删除）；示例项目一键建项并套用「快速图片」模板，
 * 让新用户打开就有东西可看。真实生成端到端走查需要宿主授权（见
 * `docs/archive/2026-10-31/WALKTHROUGH-v1.0.0.md`），本文件只覆盖不花额度的部分。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

describe('B-17 release polish', () => {
  it('opens the help overlay with real shortcuts and mode descriptions', async () => {
    const view = render(<Workbench {...clientProps()} />)
    await screen.findByRole('button', { name: en.modeQuick })

    // 默认不占地方：帮助浮层不存在
    expect(view.container.querySelector('[data-workbench-help]')).toBeNull()

    fireEvent.click(view.container.querySelector('[data-workbench-help-toggle]') as HTMLElement)
    const help = view.container.querySelector('[data-workbench-help]') as HTMLElement
    expect(help).toBeTruthy()
    // 快捷键逐条如实呈现（没有绑定的键不写）
    expect(help.textContent).toContain(en.helpGenerateShortcut)
    expect(help.textContent).toContain(en.helpUndoShortcut)
    expect(help.textContent).toContain(en.helpPlayShortcut)
    expect(help.textContent).toContain(en.helpDeleteShortcut)
    // 三个模式的说明
    expect(help.textContent).toContain(en.helpModeQuick)
    expect(help.textContent).toContain(en.helpModeWorkflow)
    expect(help.textContent).toContain(en.helpModeTimeline)

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
