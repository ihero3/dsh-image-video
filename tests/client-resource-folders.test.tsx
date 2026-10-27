// @vitest-environment jsdom
/**
 * `B-7` 资源分类 + 重绘计划面板：按 `listResourcesWithFolders` 的 `folders` 做过滤侧栏；
 * `planResourceRedraw` 零花费给出重绘建议；"发送融合"把建议提示词带回融合表单。
 *
 * 端点由 Track A 的 A-7 落地；本文件只用假宿主验证**界面行为**：分类过滤 / 重绘展开 / 回传融合。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { ResourceFoldersPanel } from '../src/client/panels/ResourceFoldersPanel.tsx'
import { en } from '../src/client/locales.ts'
import type { WorkbenchLocaleKey } from '../src/client/locales.ts'
import { cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const t = (key: WorkbenchLocaleKey): string => en[key]

/** 造一条带可选分类的资源记录。 */
function resource(id: string, kind: 'role' | 'scene' | 'prop', name: string, folder?: string) {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', kind, name, scope: 'project' as const,
    createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z',
    ...(folder === undefined ? {} : { folder }),
  }
}

describe('ResourceFoldersPanel (B-7)', () => {
  it('groups resources by folder and filters via the folder bar', async () => {
    const host = fakeApi()
    host.resources.push(
      resource('res-role', 'role', '林萧', '角色'),
      resource('res-scene', 'scene', '雨夜街道', '场景'),
      resource('res-prop', 'prop', '雨伞'), // 未分类
    )
    const view = render(<ResourceFoldersPanel api={host.api} t={t} projectId="prj-1" />)

    // 分类条：全部 / 未分类 / 角色 / 场景
    await waitFor(() => { expect(screen.getByText('林萧')).toBeTruthy() })
    const folderBar = view.container.querySelector('[data-folder-bar="true"]') as HTMLElement
    expect(folderBar.querySelector('[data-folder="__all__"]')).toBeTruthy()
    expect(folderBar.querySelector('[data-folder="__none__"]')).toBeTruthy()
    expect(folderBar.querySelector('[data-folder="角色"]')).toBeTruthy()
    expect(folderBar.querySelector('[data-folder="场景"]')).toBeTruthy()

    // 只点「角色」分类 → 只剩林萧
    fireEvent.click(folderBar.querySelector('[data-folder="角色"]') as HTMLElement)
    expect(screen.getByText('林萧')).toBeTruthy()
    expect(screen.queryByText('雨夜街道')).toBeNull()
    expect(screen.queryByText('雨伞')).toBeNull()

    // 切回「未分类」→ 只剩雨伞
    fireEvent.click(folderBar.querySelector('[data-folder="__none__"]') as HTMLElement)
    expect(screen.getByText('雨伞')).toBeTruthy()
    expect(screen.queryByText('林萧')).toBeNull()
  })

  it('opens a zero-cost redraw plan and records the resource id', async () => {
    const host = fakeApi()
    host.resources.push(resource('res-scene', 'scene', '雨夜街道', '场景'))
    render(<ResourceFoldersPanel api={host.api} t={t} projectId="prj-1" />)

    await waitFor(() => { expect(screen.getByText('雨夜街道')).toBeTruthy() })
    fireEvent.click(screen.getByText(en.redrawPlanRun))

    await waitFor(() => { expect(host.redrawPayloads).toEqual([{ resourceId: 'res-scene' }]) })
    // 计划块展开：回显建议提示词（fake 计划固定返回 'redraw prompt'）
    const planBlock = await screen.findByText(en.redrawPlanPromptLabel, { exact: false })
    expect(planBlock).toBeTruthy()
    expect(screen.getByText('redraw prompt')).toBeTruthy()
  })

  it('sends the redraw suggestion prompt back to the compose form', async () => {
    const host = fakeApi()
    host.resources.push(resource('res-scene', 'scene', '雨夜街道', '场景'))
    const onSend = vi.fn()
    render(<ResourceFoldersPanel api={host.api} t={t} projectId="prj-1" onSendToCompose={onSend} />)

    await waitFor(() => { expect(screen.getByText('雨夜街道')).toBeTruthy() })
    fireEvent.click(screen.getByText(en.redrawPlanRun))
    await waitFor(() => { expect(screen.getByText(en.redrawPlanToForm)).toBeTruthy() })
    fireEvent.click(screen.getByText(en.redrawPlanToForm))

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('redraw prompt')
  })
})
