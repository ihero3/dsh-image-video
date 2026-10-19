// @vitest-environment jsdom
/**
 * B3 错误边界：每个 pane 一个边界——单个面板崩掉只显示"该面板出错 + 重试"，
 * 不拖垮整个右栏。
 *
 * 集成用例用"宿主文档里有一个目录外的节点种类"制造一次**真实的渲染期崩溃**
 * （`nodeSpec` 对未知种类抛错），验证画布面板被兜住、其余面板照常工作。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { PaneBoundary } from '../src/client/PaneBoundary.tsx'
import { Workbench } from '../src/client/Workbench.tsx'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'
import type { WorkflowNodeKind, WorkflowRecord } from '../src/workbench/workflow.ts'
import type { ProjectRecord } from '../src/workbench/records.ts'

// React 会把捕获到的错误打到 console.error；测试里屏蔽掉，只看断言
let errorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => { errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { cleanup(); errorSpy.mockRestore() })

const t = (key: WorkbenchLocaleKey): string => en[key]

describe('B3 pane error boundary', () => {
  it('catches a throwing child, names the panel and offers retry', () => {
    let shouldThrow = true
    function Boom(): ReactNode {
      if (shouldThrow) throw new Error('渲染炸了')
      return <p>面板恢复了</p>
    }
    render(
      <PaneBoundary label="测试面板" t={t}>
        <Boom />
      </PaneBoundary>,
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain(en.paneError)
    expect(alert.textContent).toContain('测试面板')
    expect(alert.textContent).toContain('渲染炸了')

    // 重试：摘掉错误态并整棵重挂子树
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: en.paneErrorRetry }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('面板恢复了')).toBeTruthy()
  })

  it('keeps the rest of the right pane alive when one pane crashes', async () => {
    // 目录外的节点种类：画布渲染时 nodeSpec 抛错——一次真实的渲染期崩溃
    const badWorkflow: WorkflowRecord = {
      schemaVersion: 1, id: 'wfl-bad', projectId: 'prj-1', name: '坏流程',
      nodes: [{ id: 'n1', kind: 'nope' as WorkflowNodeKind, position: { x: 0, y: 0 }, params: {} }],
      edges: [],
      createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z',
    }
    const host = fakeApi({ workflows: [badWorkflow] })
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '崩溃项目',
      createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
    } satisfies ProjectRecord)
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    fireEvent.click(screen.getByRole('button', { name: en.modeWorkflow }))

    // 画布面板被兜住：显示"该面板出错 + 面板名 + 重试"
    await waitFor(() => {
      const fallback = view.container.querySelector('[data-workbench-pane="paneCanvas"] [data-pane-error]')
      expect(fallback).toBeTruthy()
    })
    const fallback = view.container.querySelector('[data-workbench-pane="paneCanvas"] [data-pane-error]')!
    expect(fallback.textContent).toContain(en.paneCanvas)
    expect(fallback.querySelector('[data-pane-error-retry]')).toBeTruthy()

    // 右栏其余部分照常：模式切换、其他停靠面板、顶栏都在
    expect(screen.getByRole('button', { name: en.modeQuick })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.modeTimeline })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.paneTasks })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.paneAssets })).toBeTruthy()
    expect(view.container.querySelector('[data-workbench-kind]')).toBeTruthy()

    // 崩掉的面板自己重试：错误态摘除后画布重新挂载（同样会再崩，但不影响别处）
    fireEvent.click(fallback.querySelector('[data-pane-error-retry]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-workbench-pane="paneCanvas"] [data-pane-error]')).toBeTruthy()
    })
    expect(screen.getByRole('heading', { name: en.paneTasks })).toBeTruthy()
  })
})
