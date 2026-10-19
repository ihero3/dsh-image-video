// @vitest-environment jsdom
/**
 * B13 交互细节打磨：全局快捷键（Cmd/Ctrl+Z 撤销、Cmd/Ctrl+Shift+Z / Cmd+Y 重做），
 * 以及撤销/重做按钮的键盘可达性与快捷键可发现性（aria-label + title 写明 ⌘Z）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WorkflowCanvas } from '../src/client/WorkflowCanvas.tsx'
import { en } from '../src/client/locales.ts'
import type { WorkflowRecord } from '../src/workbench/workflow.ts'

afterEach(cleanup)

function makeRecord(): WorkflowRecord {
  return {
    schemaVersion: 1, id: 'wfl-1', projectId: 'prj-1', name: 't', nodes: [], edges: [],
    createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z',
  }
}

const canvasNodes = (view: ReturnType<typeof render>): string =>
  view.container.querySelector('[data-workflow-canvas]')!.getAttribute('data-workflow-nodes')!

describe('B13 keyboard shortcuts', () => {
  it('exposes labeled undo/redo buttons that advertise the shortcut', () => {
    const view = render(<WorkflowCanvas record={makeRecord()} onChange={() => {}} t={k => en[k]} />)
    const undo = view.container.querySelector(`[aria-label="${en.canvasUndo}"]`) as HTMLButtonElement
    const redo = view.container.querySelector(`[aria-label="${en.canvasRedo}"]`) as HTMLButtonElement
    expect(undo).toBeTruthy()
    expect(redo).toBeTruthy()
    expect(undo.getAttribute('title')).toContain('Z')
    expect(redo.getAttribute('title')).toContain('Z')
  })

  it('undoes the last edit with Cmd/Ctrl+Z', async () => {
    let latest = makeRecord()
    const view = render(<WorkflowCanvas record={latest} onChange={next => { latest = next }} t={k => en[k]} />)
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} video-generate` }))
    await waitFor(() => { expect(canvasNodes(view)).toBe('1') })

    // 撤销：mac (metaKey) 与 win (ctrlKey) 都走同一条分支
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    await waitFor(() => { expect(canvasNodes(view)).toBe('0') })

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    // 已无可撤销内容，节点数保持 0（验证交互分支可达且不报错）
    expect(canvasNodes(view)).toBe('0')
  })

  it('redoes with Cmd/Ctrl+Shift+Z after undo', async () => {
    let latest = makeRecord()
    const view = render(<WorkflowCanvas record={latest} onChange={next => { latest = next }} t={k => en[k]} />)
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} video-generate` }))
    await waitFor(() => { expect(canvasNodes(view)).toBe('1') })

    fireEvent.keyDown(window, { key: 'z', metaKey: true }) // 撤销 → 0
    await waitFor(() => { expect(canvasNodes(view)).toBe('0') })

    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true }) // 重做 → 1
    await waitFor(() => { expect(canvasNodes(view)).toBe('1') })
  })
})
