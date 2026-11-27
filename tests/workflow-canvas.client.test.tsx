// @vitest-environment jsdom
/**
 * 画布交互（`T4-1`/`T4-2`）。
 *
 * 只验"交互 + 单一事实源"这条边界：节点库能加节点、参数写进 `WorkflowRecord`、
 * 连线可删、**选择状态不进文档**（`R-FLW-1`）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WorkflowCanvas } from '../src/client/WorkflowCanvas.tsx'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'
import type { WorkflowRecord, WorkflowRunRecord } from '../src/workbench/workflow.ts'
import { defaultParams } from '../src/workbench/workflow.ts'

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
  it('持久化的边带上端口 id（否则重启后画布"有节点没连线"）', async () => {
    let latest: WorkflowRecord | undefined
    const record: WorkflowRecord = {
      ...makeRecord(),
      nodes: [
        { id: 'n1', kind: 'image-generate', position: { x: 0, y: 0 }, params: {} },
        { id: 'n2', kind: 'video-generate', position: { x: 220, y: 0 }, params: {} },
      ],
      // 旧数据：边没有 handle 字段
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    }
    const view = render(<WorkflowCanvas record={record} onChange={next => { latest = next }} t={t} />)
    await waitFor(() => { expect(latest).toBeDefined() })
    const edge = (latest as WorkflowRecord).edges[0]!
    expect(edge.sourceHandle).toBe('out')
    expect(edge.targetHandle).toBe('in')
    expect(canvas(view).getAttribute('data-workflow-edges')).toBe('1')
  })

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

  it('B5：后期与交付组标「规划中」，四个无执行器节点在节点库里带提示', () => {
    const { view } = renderCanvas()
    const finish = view.container.querySelector('[data-workflow-library-group="finish"]') as HTMLElement
    expect(finish.querySelector('.iv-wf-lib-group-title')?.textContent).toBe(en.canvasGroupFinishPlanned)

    const noExec = view.container.querySelectorAll('[data-workflow-palette-item][data-workflow-no-executor="true"]')
    expect(noExec).toHaveLength(4)
    for (const item of noExec) {
      expect(item.getAttribute('data-workflow-availability')).toBe('runnable')
      expect(item.querySelector('[data-workflow-no-executor-tag]')?.textContent).toContain(en.canvasNoExecutorTag)
      expect((item as HTMLButtonElement).disabled).toBe(false)
    }
    // T3-2 不受影响：planned 仍是 3 个、仍可放置，且不带「不执行」标记
    expect(view.container.querySelectorAll('[data-workflow-palette-item][data-workflow-availability="planned"]')).toHaveLength(3)
    expect(view.container.querySelectorAll('[data-workflow-palette-item][data-workflow-no-executor="true"][data-workflow-availability="planned"]')).toHaveLength(0)
  })

  it('B5：无执行器节点可加入画布，但卡片和检视器如实标「不执行」', async () => {
    const { view } = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} preview` }))
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-node="preview"]')?.getAttribute('data-workflow-node-no-executor'))
        .toBe('true')
    })
    const card = view.container.querySelector('[data-workflow-node="preview"]') as HTMLElement
    expect(card.getAttribute('data-workflow-node-availability')).toBe('runnable')
    expect(card.querySelector('[data-workflow-no-executor-tag]')?.textContent).toContain(en.canvasNoExecutorTag)
    expect(card.querySelector('[data-workflow-planned-tag]')).toBeNull()
    expect(view.container.querySelector('[data-workflow-no-executor-note]')?.textContent).toContain(en.canvasNoExecutorHint)

    // 真正有执行器的节点不该被误标
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} image-generate` }))
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-node="image-generate"]')?.getAttribute('data-workflow-node-no-executor'))
        .toBeNull()
    })
  })

  it('applies an external replacement through history so Cmd/Ctrl+Z restores the old graph (F3)', async () => {
    // 模板市场承诺"整图替换后可撤销"。替换必须复用同一条工作流记录（同 id），
    // 让画布走 applyGraph 而不是重播种——否则 resetHistory 会把撤销栈清空。
    const base = makeRecord()
    const view = render(<WorkflowCanvas record={base} onChange={() => {}} t={t} replaceRevision={0} />)
    expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('0')

    const replaced: WorkflowRecord = {
      ...base,
      nodes: [{
        id: 'wfl-1-0-x', kind: 'image-generate',
        position: { x: 0, y: 0 }, params: defaultParams('image-generate'),
      }],
    }
    view.rerender(<WorkflowCanvas record={replaced} onChange={() => {}} t={t} replaceRevision={1} />)
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })

    // 撤销 → 回到替换前的空图（承诺成立）
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('0') })
    // 重做 → 替换后的图（替换是一条历史，不是一次性状态）
    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })
  })

  it('节点卡可用键盘 Enter/Space 激活并打开检视器（F18）', async () => {
    const record: WorkflowRecord = {
      ...makeRecord(),
      nodes: [{ id: 'n1', kind: 'image-generate', position: { x: 0, y: 0 }, params: {} }],
      edges: [],
    }
    const view = render(<WorkflowCanvas record={record} onChange={() => {}} t={t} />)
    const card = (): HTMLElement => view.container.querySelector('[data-workflow-node="image-generate"]') as HTMLElement

    // 未选中：卡片刻意带 role=button + tabIndex=0，但键盘以前按了什么都不发生
    expect(card().getAttribute('role')).toBe('button')
    expect(card().getAttribute('data-workflow-node-selected')).toBe('false')
    expect(view.container.querySelector('[data-workflow-inspector-open="true"]')).toBeNull()

    card().focus()
    fireEvent.keyDown(card(), { key: 'Enter' })
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-inspector-open="true"]')).toBeTruthy()
    })
    expect(card().getAttribute('data-workflow-node-selected')).toBe('true')
    // 检视器一开就接管焦点（useDialogFocus），键盘用户不会被留在卡片上
    const inspector = view.container.querySelector('[data-workflow-inspector]') as HTMLElement
    await waitFor(() => { expect(inspector.contains(document.activeElement)).toBe(true) })

    // 关掉再按空格：两个键都要能用
    fireEvent.click(view.container.querySelector('[data-workflow-inspector-close="true"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-inspector-open="true"]')).toBeNull()
    })
    fireEvent.keyDown(card(), { key: ' ' })
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-inspector-open="true"]')).toBeTruthy()
    })
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

  it('renders the card with the localized name and parameter labels', async () => {
    const { view } = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} video-generate` }))
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-node="video-generate"]')).toBeTruthy()
    })
    const text = view.container.querySelector('[data-workflow-node="video-generate"]')?.textContent ?? ''
    expect(text).toContain(en.nodeVideoGenerate)
    expect(text).toContain(en.paramRatio)
    expect(text).not.toContain('video-generate')
    // 参数用标签而不是原始键名（键名是小写 `duration`，标签是 `Duration`）
    expect(text).not.toContain('duration=')
  })

  it('shows validation issues and clears them once the parameter is filled', async () => {
    const { view } = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} image-generate` }))
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-issues]')?.getAttribute('data-workflow-issues')).toBe('1')
    })
    expect(view.container.querySelector('[data-workflow-issue="missing-required"]')).toBeTruthy()
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-node="image-generate"]')?.getAttribute('data-workflow-node-invalid')).toBe('true')
    })

    // 填上必填提示词 → 校验通过
    const prompt = await screen.findByLabelText(en.paramPrompt)
    fireEvent.change(prompt, { target: { value: '一只猫在窗台' } })
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-validation="ok"]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-workflow-issues]')?.getAttribute('data-workflow-runnable')).toBe('true')
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

describe('B4 canvas interaction', () => {
  /** 带一个已知 id 节点的文档（运行状态/错误气泡用例用）。 */
  function makeRecordWithNode(): WorkflowRecord {
    return {
      ...makeRecord(),
      nodes: [{ id: 'n1', kind: 'script', position: { x: 12, y: 34 }, params: { text: '第一句' } }],
    }
  }

  /** 一次失败运行：n1 失败并带错误文案。 */
  function failedRun(): WorkflowRunRecord {
    return {
      schemaVersion: 1, id: 'run-1', workflowId: 'wfl-1', projectId: 'prj-1', status: 'failed',
      graph: { nodes: [], edges: [] },
      nodeRuns: [{
        nodeId: 'n1', kind: 'script', status: 'failed',
        startedAt: '2026-10-15T00:00:00.000Z', error: 'provider said no',
      }],
      startedAt: '2026-10-15T00:00:00.000Z', finishedAt: '2026-10-15T00:00:01.000Z',
    }
  }

  /** 渲染画布并跟踪事实源；可传入 run 控制面。 */
  function renderWith(record: WorkflowRecord, run?: WorkflowCanvasProps['run']) {
    let latest = record
    const onRunNode = vi.fn()
    const view = render(
      <WorkflowCanvas
        record={latest}
        onChange={next => { latest = next }}
        t={t}
        run={run === undefined ? undefined : { ...run, onRunNode }}
      />,
    )
    return { view, current: () => latest, onRunNode }
  }

  /** 点选一个节点（xyflow 的选择在 mousedown 上裁决）。 */
  async function selectNode(view: ReturnType<typeof render>, nodeId: string): Promise<void> {
    const card = await waitFor(() => {
      const element = view.container.querySelector(`[data-workflow-node]`)
      if (element === null) throw new Error('卡片还没渲染')
      return element as HTMLElement
    })
    void nodeId
    fireEvent.mouseDown(card)
    fireEvent.click(card)
  }

  it('undoes and redoes node additions, and the record follows', async () => {
    const { view, current } = renderWith(makeRecord())
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} script` }))
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })
    expect(canvas(view).getAttribute('data-workflow-history')).toBe('1/0')
    expect(current().nodes).toHaveLength(1)

    // 撤销：节点没了，事实源同步回滚
    fireEvent.click(view.container.querySelector('[data-workflow-action="undo"]') as HTMLElement)
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('0') })
    expect(canvas(view).getAttribute('data-workflow-history')).toBe('0/1')
    expect(current().nodes).toHaveLength(0)

    // 重做：节点回来，位置参数与撤销前一致
    fireEvent.click(view.container.querySelector('[data-workflow-action="redo"]') as HTMLElement)
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })
    expect(current().nodes).toHaveLength(1)
  })

  it('copies and pastes a node with a fresh id and an offset position', async () => {
    const { view, current } = renderWith(makeRecord())
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} script` }))
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })
    const original = current().nodes[0]!

    // 新加的节点自动选中：⌘C 复制、⌘V 粘贴
    fireEvent.keyDown(window, { key: 'c', metaKey: true })
    fireEvent.keyDown(window, { key: 'v', metaKey: true })
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('2') })

    const pasted = current().nodes[1]!
    expect(pasted.id).not.toBe(original.id)
    expect(pasted.kind).toBe(original.kind)
    expect(pasted.params).toEqual(original.params)
    // 级联偏移：不会与原节点完全重合
    expect(pasted.position.x).toBe(original.position.x + 24)
    expect(pasted.position.y).toBe(original.position.y + 24)
  })

  it('deletes several selected nodes in one batch', async () => {
    const { view, current } = renderWith(makeRecord())
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} script` }))
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} preview` }))
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('2') })

    // 点选第一个（xyflow 的选择在 mousedown 上裁决）。jsdom 合成事件的 view 默认是
    // null，d3-drag 要读 event.view.document 才会抛；`_globalProxy` 是 jsdom 内部
    // 认的 Window（vitest 把全局 window 换成了代理，只有它过得去 instanceof 检查）。
    const paneView = (window as unknown as { _globalProxy?: Window })._globalProxy
    const cards = view.container.querySelectorAll('[data-workflow-node]')
    fireEvent.mouseDown(cards[0] as HTMLElement, paneView === undefined ? {} : { view: paneView })
    fireEvent.mouseUp(cards[0] as HTMLElement, paneView === undefined ? {} : { view: paneView })
    fireEvent.click(cards[0] as HTMLElement)
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-selected-count')).toBe('1') })
    fireEvent.keyDown(window, { key: 'Control' })
    fireEvent.mouseDown(cards[1] as HTMLElement, paneView === undefined ? {} : { view: paneView })
    fireEvent.mouseUp(cards[1] as HTMLElement, paneView === undefined ? {} : { view: paneView })
    fireEvent.click(cards[1] as HTMLElement)
    fireEvent.keyUp(window, { key: 'Control' })
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-selected-count')).toBe('2') })

    // 批量删除：一次删完，历史记一步（初始空图 + 两次添加 + 一次删除）
    fireEvent.click(view.container.querySelector('[data-workflow-action="delete-node"]') as HTMLElement)
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('0') })
    expect(current().nodes).toHaveLength(0)
    expect(canvas(view).getAttribute('data-workflow-history')).toBe('3/0')
  })

  it('removes the selected node on the Delete key', async () => {
    const { view } = renderWith(makeRecord())
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} script` }))
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })
    fireEvent.keyDown(window, { key: 'Delete' })
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('0') })
  })

  it('runs only the selected node (and its downstream) when asked', async () => {
    const run = {
      latest: undefined, history: [], busy: false,
      onStart: () => {}, onCancel: () => {}, onRetry: () => {}, onSelectRun: () => {},
    }
    const { view, current, onRunNode } = renderWith(makeRecord(), run)
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} script` }))
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })
    const nodeId = current().nodes[0]?.id
    expect(nodeId).toBeTruthy()

    fireEvent.click(view.container.querySelector('[data-workflow-action="run-node"]') as HTMLElement)
    expect(onRunNode).toHaveBeenCalledTimes(1)
    expect(onRunNode.mock.calls[0]?.[0]).toBe(nodeId)
  })

  it('shows run status on the card and an error bubble for the failed node', async () => {
    const run = { latest: failedRun(), history: [failedRun()], busy: false, onStart: () => {}, onCancel: () => {}, onRetry: () => {}, onSelectRun: () => {} }
    const { view } = renderWith(makeRecordWithNode(), run)

    // 失败状态徽章
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-node]')?.getAttribute('data-workflow-node-run-status')).toBe('failed')
    })
    // 点错误开关 → 气泡给出失败原因
    fireEvent.click(view.container.querySelector('[data-workflow-node-error-toggle]') as HTMLElement)
    const bubble = await waitFor(() => {
      const element = view.container.querySelector('[data-workflow-node-error-bubble]')
      if (element === null) throw new Error('气泡没出现')
      return element
    })
    expect(bubble.textContent).toContain('provider said no')
  })

  it('keeps validation and run details in a collapsed log drawer', () => {
    const { view } = renderCanvas()
    const log = view.container.querySelector('[data-workflow-log]')
    const body = view.container.querySelector('#iv-workflow-log-body') as HTMLElement
    // 默认收起，画布拿满高度；校验结果仍留在 DOM 里可随时查
    expect(log?.getAttribute('data-workflow-log-open')).toBe('false')
    expect(body.hidden).toBe(true)
    expect(view.container.querySelector('[data-workflow-issues]')).toBeTruthy()

    fireEvent.click(view.container.querySelector('[data-workflow-log-toggle]') as HTMLElement)
    expect(log?.getAttribute('data-workflow-log-open')).toBe('true')
    expect(body.hidden).toBe(false)
    expect(view.container.querySelector('[data-workflow-validation="ok"]')).toBeTruthy()
  })

  it('maximizes the canvas and restores it on Escape', () => {
    const { view } = renderCanvas()
    fireEvent.click(view.container.querySelector('[data-workflow-action="maximize"]') as HTMLElement)
    expect(canvas(view).getAttribute('data-workflow-maximized')).toBe('true')
    expect(canvas(view).className).toContain('iv-workflow--max')
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(canvas(view).getAttribute('data-workflow-maximized')).toBe('false')
    expect(document.body.style.overflow).toBe('')
  })

  it('closes the inspector first on Escape, then leaves maximize (2026-11-26)', async () => {
    const { view } = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} lip-sync` }))
    await waitFor(() => { expect(view.container.querySelector('[data-workflow-inspector]')).toBeTruthy() })
    const inspector = view.container.querySelector('[data-workflow-inspector-open]') as HTMLElement
    expect(inspector.getAttribute('role')).toBe('complementary')
    expect(inspector.contains(document.activeElement)).toBe(true)

    fireEvent.click(view.container.querySelector('[data-workflow-action="maximize"]') as HTMLElement)
    expect(canvas(view).getAttribute('data-workflow-maximized')).toBe('true')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => { expect(view.container.querySelector('[data-workflow-inspector]')).toBeNull() })
    expect(canvas(view).getAttribute('data-workflow-maximized')).toBe('true')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(canvas(view).getAttribute('data-workflow-maximized')).toBe('false')
  })
})

describe('工作流画布：节点式编辑器的上手路径', () => {
  const flow = (view: ReturnType<typeof render>): HTMLElement => {
    const element = view.container.querySelector('[data-workflow-flow]')
    if (element === null) throw new Error('画布没挂载')
    return element as HTMLElement
  }

  it('空画布给模板起步，点一下就得到一条可跑的链路', async () => {
    const { view, current } = renderCanvas()
    const onboarding = view.container.querySelector('[data-workflow-onboarding]')
    expect(onboarding).toBeTruthy()
    // 四张首推模板卡（快速出图 / 快速出片 / 生产线 / 参考复刻）
    expect(view.container.querySelectorAll('[data-workflow-onboarding-template]')).toHaveLength(4)

    fireEvent.click(view.container.querySelector('[data-workflow-onboarding-template="quick-image"]') as HTMLElement)
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('2') })
    // 有图之后起步卡自动让位，画布拿回全部空间
    expect(view.container.querySelector('[data-workflow-onboarding]')).toBeNull()
    // 模板自带示例提示词：不需要用户先填一版才能跑
    expect(current().nodes.some(node => node.kind === 'image-generate' && node.params.prompt !== '')).toBe(true)
  })

  it('按名字过滤节点库，只留下匹配的节点', async () => {
    const { view } = renderCanvas()
    const input = view.container.querySelector('[data-workflow-library-search]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'video' } })
    await waitFor(() => {
      expect(view.container.querySelectorAll('[data-workflow-palette-item]')).toHaveLength(1)
    })
    expect(view.container.querySelector('[data-workflow-palette-item="video-generate"]')).toBeTruthy()

    fireEvent.change(input, { target: { value: 'no-such-node' } })
    await waitFor(() => {
      expect(view.container.querySelector('[data-workflow-library-empty]')).toBeTruthy()
    })
  })

  it('把节点库的节点拖到画布上会真的落一个节点', async () => {
    const { view } = renderCanvas()
    fireEvent.drop(flow(view), {
      dataTransfer: {
        getData: (type: string) => (type === 'application/x-dsh-workflow-node' ? 'video-generate' : ''),
        files: [],
      },
    })
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })
    expect(view.container.querySelector('[data-workflow-node="video-generate"]')).toBeTruthy()
  })

  it('把命中缓存的节点标成缓存（与 ComfyUI 的 cached 同义）', async () => {
    const record: WorkflowRecord = {
      ...makeRecord(),
      nodes: [{ id: 'n1', kind: 'image-generate', position: { x: 0, y: 0 }, params: { prompt: '一只猫' } }],
    }
    const run: WorkflowCanvasProps['run'] = {
      latest: {
        schemaVersion: 1, id: 'run-c', workflowId: 'wfl-1', projectId: 'prj-1', status: 'succeeded',
        graph: { nodes: [], edges: [] },
        nodeRuns: [{
          nodeId: 'n1', kind: 'image-generate', status: 'succeeded', cached: true,
          startedAt: '2026-10-15T00:00:00.000Z', outputPath: '/tmp/outputs/cat.png',
        }],
        startedAt: '2026-10-15T00:00:00.000Z',
      },
      history: [], busy: false, onStart: () => {}, onCancel: () => {}, onRetry: () => {}, onSelectRun: () => {},
    }
    const view = render(<WorkflowCanvas record={record} onChange={() => {}} t={t} run={run} />)
    await waitFor(() => { expect(view.container.querySelector('[data-workflow-node-cached]')).toBeTruthy() })
  })

  it('节点卡片显示产出缩略图，点它就送到右侧预览', async () => {
    const record: WorkflowRecord = {
      ...makeRecord(),
      nodes: [{ id: 'n1', kind: 'image-generate', position: { x: 0, y: 0 }, params: { prompt: '一只猫' } }],
    }
    const onPreview = vi.fn()
    const run: WorkflowCanvasProps['run'] = {
      latest: {
        schemaVersion: 1, id: 'run-p', workflowId: 'wfl-1', projectId: 'prj-1', status: 'succeeded',
        graph: { nodes: [], edges: [] },
        nodeRuns: [{
          nodeId: 'n1', kind: 'image-generate', status: 'succeeded',
          startedAt: '2026-10-15T00:00:00.000Z', outputPath: '/tmp/outputs/cat.png',
        }],
        startedAt: '2026-10-15T00:00:00.000Z',
      },
      history: [], busy: false, onStart: () => {}, onCancel: () => {}, onRetry: () => {}, onSelectRun: () => {},
    }
    const view = render(
      <WorkflowCanvas record={record} onChange={() => {}} t={t} run={run} onPreview={onPreview} />,
    )
    const media = await waitFor(() => {
      const element = view.container.querySelector('[data-workflow-node-media="image"]')
      if (element === null) throw new Error('缩略图没出来')
      return element as HTMLElement
    })
    expect(media.querySelector('img')?.getAttribute('src')).toBe('/outputs/cat.png')
    fireEvent.click(media)
    expect(onPreview).toHaveBeenCalledWith('/tmp/outputs/cat.png', 'image')
  })
})

describe('工作流画布：模型字段是选择器而不是空白输入框', () => {
  const cards = [
    {
      id: 'img-a', name: 'Image A', family: 'fam', kinds: ['image'], strength: '出图',
      costTier: 'low', aspectRatios: ['1:1'],
      features: {
        imageToVideo: false, firstLastFrame: { supported: false }, multiFrame: { supported: false },
        referenceVideo: { supported: false }, audio: { supported: false },
      },
      promptTips: [], verified: true,
    },
    {
      id: 'vid-b', name: 'Video B', family: 'fam', kinds: ['video'], strength: '出片',
      costTier: 'low', duration: { minSec: 1, maxSec: 10, customizable: true }, aspectRatios: ['16:9'],
      features: {
        imageToVideo: true, firstLastFrame: { supported: false }, multiFrame: { supported: false },
        referenceVideo: { supported: false }, audio: { supported: false },
      },
      promptTips: [], verified: true,
    },
  ]

  function fakeApi(defaults?: { image?: string, video?: string }) {
    return {
      modelsCatalog: async () => ({ cards, consistencyIssues: [], ...defaults === undefined ? {} : { defaults } }),
    } as unknown as import('../src/client/api.ts').WorkbenchApi
  }

  it('生图节点列出图片模型，并把宿主默认标出来；选择写进事实源', async () => {
    const { view, current } = renderCanvas()
    // renderCanvas 不传 api：模型字段退回文本输入（画布不该因为拿不到目录就不可用）
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} image-generate` }))
    await waitFor(() => { expect(canvas(view).getAttribute('data-workflow-nodes')).toBe('1') })
    expect((view.container.querySelector('[data-workflow-param="model"]') as HTMLInputElement).tagName).toBe('INPUT')
  })

  it('传入宿主 API 后模型字段变成下拉，默认模型可见，切换写入记录', async () => {
    let latest = makeRecord()
    const view = render(
      <WorkflowCanvas
        record={latest}
        onChange={next => { latest = next }}
        t={t}
        api={fakeApi({ image: 'img-a' })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} image-generate` }))
    const select = await waitFor(() => {
      const element = view.container.querySelector('[data-workflow-param="model"]')
      if (element === null) throw new Error('模型下拉没出现')
      return element as HTMLSelectElement
    })
    expect(Array.from(select.options).map(option => option.value)).toEqual(['', 'img-a'])
    // 宿主默认标在对应项上，并在下方写出来
    expect(Array.from(select.options).find(option => option.value === 'img-a')?.textContent)
      .toContain(en.modelDefaultTag)
    expect(view.container.querySelector('[data-model-picker-default]')?.getAttribute('data-model-picker-default'))
      .toBe('img-a')

    fireEvent.change(select, { target: { value: 'img-a' } })
    await waitFor(() => { expect(latest.nodes[0]?.params.model).toBe('img-a') })
  })

  it('视频节点的模型候选只含视频模型', async () => {
    let latest = makeRecord()
    const view = render(
      <WorkflowCanvas
        record={latest}
        onChange={next => { latest = next }}
        t={t}
        api={fakeApi()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: `${en.canvasAdd} video-generate` }))
    const select = await waitFor(() => {
      const element = view.container.querySelector('[data-workflow-param="model"]')
      if (element === null) throw new Error('模型下拉没出现')
      return element as HTMLSelectElement
    })
    expect(Array.from(select.options).map(option => option.value)).toEqual(['', 'vid-b'])
  })
})
