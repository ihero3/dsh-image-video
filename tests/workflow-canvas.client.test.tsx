// @vitest-environment jsdom
/**
 * 画布交互（`T4-1`/`T4-2`）。
 *
 * 只验"交互 + 单一事实源"这条边界：节点库能加节点、参数写进 `WorkflowRecord`、
 * 连线可删、**选择状态不进文档**（`R-FLW-1`）。
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WorkflowCanvas } from '../src/client/WorkflowCanvas.tsx'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'
import type { WorkflowRecord } from '../src/workbench/workflow.ts'

// jsdom 没有 ResizeObserver，而 @xyflow/react 用它测量视口与节点
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }
})

// 每个用例互不干扰：上一次挂载的画布必须卸载，否则 screen 会查到重复元素
afterEach(() => { cleanup() })

const t = (key: WorkbenchLocaleKey): string => en[key]

function makeRecord(): WorkflowRecord {
  return {
    schemaVersion: 1, id: 'wfl-1', projectId: 'prj-1', name: '测试工作流',
    nodes: [], edges: [], createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z',
  }
}

function renderCanvas() {
  let latest = makeRecord()
  const view = render(
    <WorkflowCanvas record={latest} onChange={next => { latest = next }} t={t} />,
  )
  return { view, current: () => latest }
}

const canvas = (view: ReturnType<typeof render>): HTMLElement => {
  const element = view.container.querySelector('[data-workflow-canvas]')
  if (element === null) throw new Error('画布没有挂载')
  return element as HTMLElement
}

describe('workflow canvas', () => {
  it('lists every catalog node and marks the planned ones', () => {
    const { view } = renderCanvas()
    const items = view.container.querySelectorAll('[data-workflow-palette-item]')
    expect(items).toHaveLength(15)

    const planned = view.container.querySelectorAll('[data-workflow-availability="planned"]')
    expect(planned).toHaveLength(3)
    for (const item of planned) {
      // `T3-2`：planned 可以放进图并保存，所以按钮**不是**禁用；原因靠 title/文案交代
      expect((item as HTMLButtonElement).disabled).toBe(false)
      expect(item.getAttribute('title')).toBeTruthy()
    }
    expect(view.container.querySelectorAll('[data-workflow-availability="runnable"]')).toHaveLength(12)
  })

  it('lets a planned node be placed but marks it as not runnable', async () => {
    const { view, current } = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} lip-sync` }))
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })

    // 节点卡片由 xyflow 量完尺寸后渲染，等它出现
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-node="lip-sync"]')?.getAttribute('data-workflow-node-availability'))
        .toBe('planned')
    })
    expect(view.container.querySelector('[data-workflow-node="lip-sync"] [data-workflow-planned-tag]')).toBeTruthy()
    // 参数面板给出不可运行的原因，而不是假装能跑
    expect(view.container.querySelector('[data-workflow-planned-note]')?.textContent).toContain(en.plannedLipSync)
    expect(current().nodes[0]?.kind).toBe('lip-sync')
  })

  it('adds a node and writes its parameters into the record', async () => {
    const { view, current } = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} video-generate` }))
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })

    // 选中后参数面板出现，改时长写进事实源
    const duration = await screen.findByLabelText(en.paramDuration)
    fireEvent.change(duration, { target: { value: '9' } })
    await waitFor(() => {
      expect(current().nodes[0]?.params.duration).toBe(9)
    })
    expect(current().nodes[0]?.kind).toBe('video-generate')
  })

  it('keeps the transient selection out of the record', async () => {
    const { current } = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} script` }))
    await waitFor(() => { expect(current().nodes).toHaveLength(1) })
    // 文档字段只有这些：没有 selection / selectedId
    expect(Object.keys(current()).sort()).toEqual(
      ['createdAt', 'edges', 'id', 'name', 'nodes', 'projectId', 'schemaVersion', 'updatedAt'],
    )
  })

  it('deletes the selected node from the record', async () => {
    const { view, current } = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} preview` }))
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })

    fireEvent.click(view.container.querySelector('[data-workflow-action="delete-node"]') as HTMLElement)
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('0') })
    expect(current().nodes).toHaveLength(0)
  })
})
