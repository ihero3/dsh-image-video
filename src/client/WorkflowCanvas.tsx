/**
 * 工作流画布（`T4-1`/`T4-2` + `B4` 交互补齐）。
 *
 * 边界按 `R-FLW-1`：画布**只做交互**——节点位置、连线、选择、缩放平移、适配窗口。
 * 执行、参数校验（除"必填"以外的语义校验）、调度与持久化都在宿主侧；
 * 本组件把画布维度的事实收敛成一个 `WorkflowRecord` 交给上层（`T4-1` 单一事实源），
 * 且**选择状态只在本地**，不进 `WorkflowRecord`（UI 瞬时选择不入库）。
 *
 * `B4` 补齐的交互：撤销/重做（快照历史栈，`A3` 落地后可切换）、节点复制/粘贴、
 * 框选与批量删除、单节点运行（运行器 `only`，宿主端点见 API-SURFACE「B 申请」）、
 * 节点运行中/失败状态与错误气泡。
 *
 * 样式：客户端私有插件产物由 `window.__ModuleLoader__` 以 JS 载入，不经过 Harness 的
 * CSS 打包链，所以 `@xyflow/react` 的官方样式表由 `scripts/sync-canvas-style.mjs`
 * 内嵌成字符串，在挂载时注入一次。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, addEdge, useEdgesState, useNodesState,
  useReactFlow,
  type Connection, type Edge, type Node, type NodeProps,
} from '@xyflow/react'
import {
  NODE_CATALOG, WORKFLOW_SOURCE_HANDLE, WORKFLOW_TARGET_HANDLE, WORKFLOW_TEMPLATES, defaultParams, nodeSpec, validateWorkflow,
  type NodeParamValue, type WorkflowIssue, type WorkflowNodeKind, type WorkflowRecord, type WorkflowRunRecord,
} from '../workbench/workflow.ts'
import { CANVAS_STYLE, CANVAS_STYLE_ID } from './canvas-style.ts'
import type { WorkbenchLocaleKey } from './locales.ts'
import { Icon, type IconName } from './icons.tsx'
import { useWorkbenchStyle } from './workbench-style.ts'
import { useHistoryStack } from './use-history-stack.ts'

/** 画布节点携带的数据（xyflow 要求可索引）。 */
export interface CanvasNodeData extends Record<string, unknown> {
  kind: WorkflowNodeKind
  params: Record<string, NodeParamValue>
  /** `T4-3` 校验把这个节点标记为有问题时置位（只影响样式）。 */
  invalid?: boolean
  /** `B4`：最近一次运行里这个节点的状态（来自运行记录，只影响样式）。 */
  runStatus?: 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped'
  /** `B4`：该节点失败时的错误文案（错误气泡用）。 */
  runError?: string
}

/** 画布节点类型（必须带自定义 type，否则 xyflow 会用默认节点渲染）。 */
export type CanvasNode = Node<CanvasNodeData, 'workbench'>

/** 剪贴板内容：节点 + 两端都在剪贴板里的连线（id 保持原样，粘贴时重映射）。 */
interface CanvasClipboard {
  readonly nodes: readonly CanvasNode[]
  readonly edges: readonly Edge[]
}

/** 画布组件的对外属性。 */
export interface WorkflowCanvasProps {
  /** 唯一事实源；画布只读取它做初始化。 */
  readonly record: WorkflowRecord
  /** 图变化时回写（位置/连线/参数），选择状态不在此列。 */
  readonly onChange: (record: WorkflowRecord) => void
  /** 文案取用。 */
  readonly t: (key: WorkbenchLocaleKey) => string
  /** 运行控制（`T4-4` + `B4` 单节点运行）：状态展示 + 起跑/取消/重试。 */
  readonly run?: {
    readonly latest?: WorkflowRunRecord
    /** 历史运行（最新在前），点一条即可回看它当时的节点产出与图快照。 */
    readonly history: readonly WorkflowRunRecord[]
    readonly selectedRunId?: string
    readonly busy: boolean
    readonly onStart: () => void
    readonly onCancel: () => void
    readonly onRetry: () => void
    /** `B4`：只跑这一个节点（含下游）。宿主端点认领中，调用即下发 `only`。 */
    readonly onRunNode?: (nodeId: string) => void
    readonly onSelectRun: (runId: string) => void
  }
}

/** 运行状态 → 文案键。 */
function runStatusKey(status: 'running' | 'succeeded' | 'failed' | 'cancelled'): WorkbenchLocaleKey {
  switch (status) {
    case 'running': return 'statusRunning'
    case 'succeeded': return 'statusSucceeded'
    case 'failed': return 'statusFailed'
    case 'cancelled': return 'statusCancelled'
  }
}

/** 节点运行状态 → 文案键。 */
function nodeStatusKey(status: 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped'): WorkbenchLocaleKey {
  switch (status) {
    case 'running': return 'statusRunning'
    case 'succeeded': return 'statusSucceeded'
    case 'failed': return 'statusFailed'
    case 'cancelled': return 'statusCancelled'
    case 'skipped': return 'statusSkipped'
  }
}

/** 节点种类 → 图标（画布库、节点卡片、参数面板共用）。 */
const NODE_ICONS: Record<WorkflowNodeKind, IconName> = {
  'creative-input': 'input',
  'script': 'script',
  'storyboard': 'storyboard',
  'asset-reference': 'box',
  'resource-reference': 'link',
  'motion-track': 'motion',
  'image-generate': 'image',
  'video-generate': 'video',
  'preview': 'eye',
  'publish-asset': 'upload',
  'subtitle': 'subtitle',
  'render': 'download',
  'lip-sync': 'sparkles',
  'face-swap': 'sparkles',
  'voice-synthesize': 'sparkles',
}

/** 运行状态 → 徽章色调。 */
function runChipClass(status: 'running' | 'succeeded' | 'failed' | 'cancelled'): string {
  switch (status) {
    case 'running': return 'iv-chip iv-chip--run'
    case 'succeeded': return 'iv-chip iv-chip--ok'
    case 'failed': return 'iv-chip iv-chip--err'
    case 'cancelled': return 'iv-chip'
  }
}

/** 注入官方样式表（只注入一次；模块加载器不处理 CSS 文件）。 */
function useCanvasStyle(): void {
  useEffect(() => {
    if (document.getElementById(CANVAS_STYLE_ID) !== null) return
    const style = document.createElement('style')
    style.id = CANVAS_STYLE_ID
    style.textContent = CANVAS_STYLE
    document.head.append(style)
  }, [])
}

function toCanvasNodes(record: WorkflowRecord): CanvasNode[] {
  return record.nodes.map(node => ({
    id: node.id, type: 'workbench', position: { x: node.position.x, y: node.position.y },
    data: { kind: node.kind, params: { ...node.params } },
  }))
}

function toCanvasEdges(record: WorkflowRecord): Edge[] {
  // 端口 id 必须显式带上：缺省的边在 React Flow v12 里 `undefined !== null`，会被静默丢弃
  return record.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? WORKFLOW_SOURCE_HANDLE,
    targetHandle: edge.targetHandle ?? WORKFLOW_TARGET_HANDLE,
  }))
}

/** 把画布状态合并回文档（只带持久字段，不带选择）。 */
function merge(record: WorkflowRecord, nodes: readonly CanvasNode[], edges: readonly Edge[]): WorkflowRecord {
  return {
    ...record,
    nodes: nodes.map(node => ({
      id: node.id, kind: node.data.kind,
      position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
      params: node.data.params,
    })),
    edges: edges.map(edge => ({
      id: edge.id, source: edge.source, target: edge.target,
      // 持久化端口 id：否则存盘再加载后边会丢（真机回归修复）
      sourceHandle: edge.sourceHandle ?? WORKFLOW_SOURCE_HANDLE,
      targetHandle: edge.targetHandle ?? WORKFLOW_TARGET_HANDLE,
    })),
    updatedAt: new Date().toISOString(),
  }
}

let nodeSequence = 0

/** 生成画布内唯一的节点/连线 id（与宿主的记录 id 空间无关）。 */
function nextNodeId(kind: WorkflowNodeKind): string {
  nodeSequence += 1
  return `${kind}-${Date.now().toString(36)}-${nodeSequence.toString(36)}`
}

/**
 * 节点卡片：本地化种类名 + 参数摘要 + `B4` 的运行状态徽章与错误气泡。
 *
 * 运行状态来自运行记录（`nodeRuns` 按 nodeId 归拢），只进 `node.data` 的样式字段，
 * 不被 `merge` 持久化——运行记录是宿主侧的事实，卡片只是它的镜子。
 */
function WorkflowNodeCard({ data, selected, t }: NodeProps<CanvasNode> & { t: (key: WorkbenchLocaleKey) => string }): JSX.Element {
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const spec = nodeSpec(data.kind)
  const planned = spec.availability !== 'runnable'
  const summary = spec.params
    .filter(field => data.params[field.id] !== '' && data.params[field.id] !== false && data.params[field.id] !== undefined)
    .slice(0, 2)
    .map(field => `${t(field.labelKey as WorkbenchLocaleKey)}=${String(data.params[field.id]).slice(0, 14)}`)
    .join(' · ')
  const runStatus = data.runStatus
  const failed = runStatus === 'failed'
  return (
    <div
      className="iv-node"
      data-workflow-node={data.kind}
      data-workflow-node-selected={selected ? 'true' : 'false'}
      data-workflow-node-availability={spec.availability}
      data-workflow-node-invalid={data.invalid === true ? 'true' : 'false'}
      data-workflow-node-run-status={runStatus ?? 'none'}
      role="button"
      tabIndex={0}
      aria-label={`${t(spec.labelKey as WorkbenchLocaleKey)}${runStatus === undefined ? '' : ` · ${t(nodeStatusKey(runStatus))}`}`}
    >
      <Handle id={WORKFLOW_TARGET_HANDLE} type="target" position={Position.Left} />
      <div className="iv-node-head">
        <Icon name={NODE_ICONS[data.kind]} size={13} />
        <span className="iv-node-title">{t(spec.labelKey as WorkbenchLocaleKey)}</span>
        {planned
          ? <span className="iv-node-planned" data-workflow-planned-tag="true"><Icon name="sparkles" size={9} />{t('canvasPlannedTag')}</span>
          : null}
        {runStatus === undefined ? null : (
          <span
            className={`iv-node-run iv-node-run--${runStatus}`}
            data-workflow-node-run-badge={runStatus}
            title={t(nodeStatusKey(runStatus))}
          >
            <i className="iv-dot" aria-hidden="true" />
          </span>
        )}
        {failed ? (
          <button
            type="button"
            className="iv-node-err"
            data-workflow-node-error-toggle="true"
            aria-label={t('nodeErrorDetails')}
            title={data.runError ?? t('statusFailed')}
            onClick={event => { event.stopPropagation(); setBubbleOpen(open => !open) }}
          >
            <Icon name="alert" size={10} />
          </button>
        ) : null}
      </div>
      {summary === '' ? null : <div className="iv-node-body">{summary}</div>}
      {failed && bubbleOpen ? (
        <div className="iv-node-bubble" data-workflow-node-error-bubble="true" role="status">
          {data.runError ?? t('statusFailed')}
        </div>
      ) : null}
      <Handle id={WORKFLOW_SOURCE_HANDLE} type="source" position={Position.Right} />
    </div>
  )
}

/** 画布内部实现（需要 `ReactFlowProvider` 才能调用 `fitView`）。 */
function CanvasSurface({ record, onChange, t, run }: WorkflowCanvasProps): JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(toCanvasNodes(record))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toCanvasEdges(record))
  const [error, setError] = useState<string | undefined>(undefined)
  const [templateId, setTemplateId] = useState<string>(WORKFLOW_TEMPLATES[0]?.id ?? '')
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  const { fitView } = useReactFlow<CanvasNode, Edge>()
  const lastPushed = useRef<string>('')
  const seededId = useRef<string>(record.id)
  const clipboard = useRef<CanvasClipboard | undefined>(undefined)
  // B4：快照历史栈（A3 落地前撤销/重做的家）。解构出稳定身份的回调，
  // 避免每渲染重建 handler（否则键盘监听会每帧重绑）。
  const {
    commit: commitHistory, undo: undoHistory, redo: redoHistory, reset: resetHistory,
    canUndo, canRedo, undoDepth, redoDepth,
  } = useHistoryStack<{ nodes: CanvasNode[]; edges: Edge[] }>({
    nodes: toCanvasNodes(record), edges: toCanvasEdges(record),
  })
  // 选中的节点（B4）：点选/框选/多选都由 xyflow 的 store 裁决，
  // `onSelectionChange` 把结果同步进来——选择只在本地，不进 WorkflowRecord（R-FLW-1）
  const onSelectionChange = useCallback((params: { nodes: readonly Node[] }) => {
    setSelectedIds(params.nodes.map(node => node.id))
  }, [])
  const selectedNodes = useMemo(
    () => nodes.filter(node => selectedIds.includes(node.id)),
    [nodes, selectedIds],
  )

  // 文档换了一份（例如切项目）才重新播种；同一份文档的编辑不回灌，避免打断拖拽。
  useEffect(() => {
    if (seededId.current === record.id) return
    seededId.current = record.id
    const nextNodes = toCanvasNodes(record)
    const nextEdges = toCanvasEdges(record)
    setNodes(nextNodes)
    setEdges(nextEdges)
    resetHistory({ nodes: nextNodes, edges: nextEdges })
    setSelectedIds([])
  }, [record, setNodes, setEdges, resetHistory])

  // 图变化 → 回写唯一事实源（选择不在其中）。
  useEffect(() => {
    const merged = merge(record, nodes, edges)
    const fingerprint = JSON.stringify({ nodes: merged.nodes, edges: merged.edges })
    if (fingerprint === lastPushed.current) return
    lastPushed.current = fingerprint
    onChange(merged)
  }, [nodes, edges, record, onChange])

  // 卡片要用当前语言渲染，所以 nodeTypes 跟着 t 走（t 变化才重建，避免每帧换组件）
  // `T4-3`：每次图变化都跑一遍校验（纯函数），并把问题节点标到卡片上
  const validation = useMemo(
    () => validateWorkflow(merge(record, nodes, edges).nodes, merge(record, nodes, edges).edges),
    [record, nodes, edges],
  )
  const invalidFingerprint = validation.issues
    .filter(issue => issue.nodeId !== undefined)
    .map(issue => issue.nodeId)
    .join(',')
  useEffect(() => {
    const invalidIds = new Set(validation.issues.flatMap(issue => (issue.nodeId === undefined ? [] : [issue.nodeId])))
    setNodes(current => {
      let changed = false
      const next = current.map(node => {
        const invalid = invalidIds.has(node.id)
        if ((node.data.invalid === true) === invalid) return node
        changed = true
        return { ...node, data: { ...node.data, invalid } }
      })
      return changed ? next : current
    })
    // 只在"问题节点集合"变化时同步，避免连环渲染
  }, [invalidFingerprint, setNodes])

  // `B4`：把最近一次运行的节点状态/错误同步进卡片数据（运行记录是宿主事实，卡片只镜像）
  const runFingerprint = (run?.latest?.nodeRuns ?? [])
    .map(entry => `${entry.nodeId}:${entry.status}:${entry.error ?? ''}`)
    .join('|')
  useEffect(() => {
    const byId = new Map((run?.latest?.nodeRuns ?? []).map(entry => [entry.nodeId, entry]))
    setNodes(current => {
      let changed = false
      const next = current.map(node => {
        const entry = byId.get(node.id)
        const status = entry?.status
        const errorText = entry?.error
        if (node.data.runStatus === status && node.data.runError === errorText) return node
        changed = true
        return { ...node, data: { ...node.data, runStatus: status, runError: errorText } }
      })
      return changed ? next : current
    })
  }, [runFingerprint, setNodes])

  const nodeTypes = useMemo(() => ({
    workbench: (nodeProps: NodeProps<CanvasNode>) => <WorkflowNodeCard {...nodeProps} t={t} />,
  }), [t])

  /**
   * 应用一张新图：改本地状态 + 推历史 + 回写事实源（回写由上面的 effect 完成）。
   * @param next - 新图。
   * @param tag - 历史合并标签（拖拽/连续输入传稳定 tag，一次性动作传唯一 tag）。
   */
  const applyGraph = useCallback((next: { nodes: CanvasNode[]; edges: Edge[] }, tag?: string) => {
    setNodes(next.nodes)
    setEdges(next.edges)
    commitHistory(next, tag)
  }, [commitHistory, setNodes, setEdges])

  // planned 节点按 `T3-2` 可以放进图并保存，只是**不可运行**（执行侧由 `T3-3` 拒绝）；
  // 因此这里不拦，只在卡片与参数面板上如实标注。
  const addNode = useCallback((kind: WorkflowNodeKind) => {
    const index = nodes.length
    const node: CanvasNode = {
      id: nextNodeId(kind), type: 'workbench',
      position: { x: 40 + (index % 4) * 190, y: 40 + Math.floor(index / 4) * 120 },
      data: { kind, params: defaultParams(kind) },
      selected: true,
    }
    const nextNodes: CanvasNode[] = nodes.map<CanvasNode>(candidate => ({ ...candidate, selected: false }))
    nextNodes.push(node)
    applyGraph({ nodes: nextNodes, edges }, `add:${node.id}`)
  }, [nodes, edges, applyGraph])

  const updateParam = useCallback((id: string, key: string, value: NodeParamValue) => {
    const nextNodes = nodes.map(node => (
      node.id === id ? { ...node, data: { ...node.data, params: { ...node.data.params, [key]: value } } } : node
    ))
    // 连续打字合并成一步历史
    applyGraph({ nodes: nextNodes, edges }, `param:${id}:${key}`)
  }, [nodes, edges, applyGraph])

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source === connection.target) { setError(t('canvasSelfLoop')); return }
    setError(undefined)
    const id = `${connection.source}-${connection.target}`
    if (edges.some(edge => edge.id === id)) return
    const nextEdges = addEdge({ ...connection, id }, edges)
    applyGraph({ nodes, edges: nextEdges }, `connect:${id}`)
  }, [nodes, edges, applyGraph, t])

  const applyTemplate = useCallback((id: string) => {
    const template = WORKFLOW_TEMPLATES.find(candidate => candidate.id === id)
    if (template === undefined) return
    const stamp = Date.now().toString(36)
    const built: CanvasNode[] = template.nodes.map((spec, index) => ({
      id: `${template.id}-${index}-${stamp}`,
      type: 'workbench',
      position: { x: 40 + (index % 2) * 200, y: 30 + Math.floor(index / 2) * 110 },
      data: { kind: spec.kind, params: { ...defaultParams(spec.kind), ...spec.params ?? {} } },
    }))
    const builtEdges = template.edges.map(([from, to]) => ({
      id: `${built[from]?.id ?? from}->${built[to]?.id ?? to}`,
      source: built[from]?.id ?? String(from),
      target: built[to]?.id ?? String(to),
    }))
    setError(undefined)
    applyGraph({ nodes: built, edges: builtEdges }, `template:${id}`)
  }, [applyGraph])

  /** 删除选中的节点（批量：框选/多选后一次删完）。 */
  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    const doomed = new Set(selectedIds)
    const nextNodes = nodes.filter(node => !doomed.has(node.id))
    const nextEdges = edges.filter(edge => !doomed.has(edge.source) && !doomed.has(edge.target))
    applyGraph({ nodes: nextNodes, edges: nextEdges }, `delete:${Date.now().toString(36)}`)
  }, [selectedIds, nodes, edges, applyGraph])

  /** 复制选中的节点（含两端都在选区里的连线）到内部剪贴板。 */
  const copySelected = useCallback(() => {
    if (selectedIds.length === 0) { setError(t('canvasPasteEmpty')); return }
    const doomed = new Set(selectedIds)
    clipboard.current = {
      nodes: selectedNodes.map(node => ({
        ...node,
        data: { ...node.data, params: { ...node.data.params } },
      })),
      edges: edges.filter(edge => doomed.has(edge.source) && doomed.has(edge.target)),
    }
    setError(undefined)
  }, [selectedIds, selectedNodes, edges, t])

  /** 粘贴：换新 id、级联偏移、只选粘贴进来的这一批。 */
  const pasteClipboard = useCallback(() => {
    const clip = clipboard.current
    if (clip === undefined || clip.nodes.length === 0) { setError(t('canvasPasteEmpty')); return }
    const idMap = new Map<string, string>()
    const pasted: CanvasNode[] = clip.nodes.map((node, index) => {
      const id = nextNodeId(node.data.kind)
      idMap.set(node.id, id)
      return {
        ...node,
        id,
        position: { x: node.position.x + 24, y: node.position.y + 24 + index * 6 },
        selected: true,
        data: { ...node.data, params: { ...node.data.params } },
      }
    })
    const remap = (id: string): string => idMap.get(id) ?? id
    const pastedEdges: Edge[] = clip.edges.map(edge => ({
      ...edge,
      id: `${remap(edge.source)}->${remap(edge.target)}`,
      source: remap(edge.source),
      target: remap(edge.target),
    }))
    const nextNodes: CanvasNode[] = nodes.map<CanvasNode>(node => ({ ...node, selected: false }))
    nextNodes.push(...pasted)
    const nextEdges: Edge[] = edges.concat(pastedEdges)
    setError(undefined)
    applyGraph({ nodes: nextNodes, edges: nextEdges }, `paste:${Date.now().toString(36)}`)
  }, [nodes, edges, applyGraph])

  /** 撤销/重做：取历史栈的上一态，应用到画布（回写由 effect 完成）。 */
  const undo = useCallback(() => {
    const previous = undoHistory()
    if (previous === undefined) return
    setNodes(previous.nodes)
    setEdges(previous.edges)
  }, [undoHistory, setNodes, setEdges])

  const redo = useCallback(() => {
    const next = redoHistory()
    if (next === undefined) return
    setNodes(next.nodes)
    setEdges(next.edges)
  }, [redoHistory, setNodes, setEdges])

  // `B13` 快捷键：Cmd/Ctrl+Z 撤销、Cmd/Ctrl+Shift+Z（或 +Y）重做、C/V 复制粘贴、
  // Delete/Backspace 删除选中。输入控件里不劫持（让用户正常打字）。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target !== null && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
        || target.isContentEditable === true
      )) return
      const meta = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (meta && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo(); else undo()
        return
      }
      if (meta && key === 'y') { event.preventDefault(); redo(); return }
      if (meta && key === 'c') { event.preventDefault(); copySelected(); return }
      if (meta && key === 'v') { event.preventDefault(); pasteClipboard(); return }
      if (!meta && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (selectedIds.length > 0) { event.preventDefault(); deleteSelected() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [undo, redo, copySelected, pasteClipboard, deleteSelected, selectedIds.length])

  // 拖拽结束 = 一步历史（拖动过程中的每个 position 变化都合并进来）
  const onNodeDragStop = useCallback((_event: unknown, node: Node) => {
    commitHistory({ nodes, edges }, `drag:${node.id}`)
  }, [commitHistory, nodes, edges])

  // 点空白处：xyflow 会清掉内部选择（→ onSelectionChange([])），这里只清错误提示
  const onPaneClick = useCallback(() => { setError(undefined) }, [])

  return (
    <div
      className="iv-canvas-main"
      data-workflow-canvas="true"
      data-workflow-nodes={String(nodes.length)}
      data-workflow-edges={String(edges.length)}
      data-workflow-selected={selectedIds[0] ?? ''}
      data-workflow-selected-count={String(selectedIds.length)}
      data-workflow-history={`${undoDepth}/${redoDepth}`}
    >
      <div className="iv-pal" data-workflow-palette="true">
        <span className="iv-micro" style={{ width: '100%' }}>{t('canvasPalette')}</span>
        {NODE_CATALOG.filter(spec => spec.availability === 'runnable').map(spec => (
          <button
            key={spec.kind}
            type="button"
            className="iv-pal-chip"
            data-workflow-palette-item={spec.kind}
            data-workflow-availability={spec.availability}
            aria-label={`${t('canvasAdd')} ${spec.kind}`}
            title={spec.reasonKey === undefined ? spec.kind : t(spec.reasonKey as WorkbenchLocaleKey)}
            onClick={() => { addNode(spec.kind) }}
          >
            <Icon name={NODE_ICONS[spec.kind]} size={12} />
            <span>{t(spec.labelKey as WorkbenchLocaleKey)}</span>
          </button>
        ))}
        {NODE_CATALOG.some(spec => spec.availability !== 'runnable')
          ? (
            <>
              <span className="iv-pal-sep" role="separator" />
              {NODE_CATALOG.filter(spec => spec.availability !== 'runnable').map(spec => (
                <button
                  key={spec.kind}
                  type="button"
                  className="iv-pal-chip"
                  data-workflow-palette-item={spec.kind}
                  data-workflow-availability={spec.availability}
                  aria-label={`${t('canvasAdd')} ${spec.kind}`}
                  title={spec.reasonKey === undefined ? spec.kind : t(spec.reasonKey as WorkbenchLocaleKey)}
                  onClick={() => { addNode(spec.kind) }}
                >
                  <Icon name={NODE_ICONS[spec.kind]} size={12} />
                  <span>{t(spec.labelKey as WorkbenchLocaleKey)}</span>
                  <span className="iv-meta">{t('canvasPlannedTag')}</span>
                </button>
              ))}
            </>
          )
          : null}
      </div>

      <div className="iv-canvas-main">
        <div className="iv-toolbar">
          <select
            className="iv-select"
            data-workflow-template="true"
            aria-label={t('templateTitle')}
            value={templateId}
            onChange={event => { setTemplateId(event.target.value) }}
          >
            {WORKFLOW_TEMPLATES.map(template => (
              <option key={template.id} value={template.id}>{t(template.labelKey as WorkbenchLocaleKey)}</option>
            ))}
          </select>
          <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="apply-template"
            onClick={() => { applyTemplate(templateId) }}>
            <Icon name="copy" />{t('templateApply')}
          </button>
          <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="fit"
            onClick={() => { void fitView({ padding: 0.2 }) }}>
            <Icon name="search" />{t('canvasFit')}
          </button>
          <span className="iv-toolbar-sep" role="separator" aria-hidden="true" />
          <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="undo"
            aria-label={t('canvasUndo')} title={`${t('canvasUndo')}（⌘Z）`}
            disabled={!canUndo} onClick={undo}>
            <Icon name="undo" />{undoDepth > 0 ? undoDepth : ''}
          </button>
          <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="redo"
            aria-label={t('canvasRedo')} title={`${t('canvasRedo')}（⌘⇧Z）`}
            disabled={!canRedo} onClick={redo}>
            <Icon name="redo" />{redoDepth > 0 ? redoDepth : ''}
          </button>
          <span className="iv-toolbar-sep" role="separator" aria-hidden="true" />
          <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="copy"
            aria-label={t('canvasCopy')} title={`${t('canvasCopy')}（⌘C）`}
            disabled={selectedIds.length === 0} onClick={copySelected}>
            <Icon name="copy" />{t('canvasCopy')}
          </button>
          <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="paste"
            aria-label={t('canvasPaste')} title={`${t('canvasPaste')}（⌘V）`} onClick={pasteClipboard}>
            <Icon name="clipboard" />{t('canvasPaste')}
          </button>
          <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="delete-node"
            aria-label={t('canvasDeleteSelected')} title={`${t('canvasDeleteSelected')}（Delete）`}
            disabled={selectedIds.length === 0} onClick={deleteSelected}>
            <Icon name="trash" />{t('canvasDeleteSelected')}{selectedIds.length > 1 ? ` · ${selectedIds.length}` : ''}
          </button>
          <span className="iv-count">
            {nodes.length} {t('canvasNodesCount')} · {edges.length} {t('canvasEdgesCount')}
          </span>
        </div>

        <div className="iv-issues" data-workflow-issues={String(validation.issues.length)}
          data-workflow-runnable={validation.ok ? 'true' : 'false'} data-ok={validation.ok ? 'true' : 'false'}>
          <strong>{t('validationTitle')}</strong>
          {validation.ok
            ? <span data-workflow-validation="ok"><Icon name="check" size={12} />{t('validationOk')}</span>
            : validation.issues.slice(0, 6).map((issue: WorkflowIssue, index) => (
              <span key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? index}`} className="iv-issue"
                data-workflow-issue={issue.code} title={issue.message}>
                <Icon name="alert" size={12} />{issue.nodeId === undefined ? '' : `${issue.nodeId}: `}
                {t(issue.code === 'missing-required' ? 'issueRequired'
                  : issue.code === 'port-mismatch' ? 'issuePort'
                    : issue.code === 'self-loop' ? 'issueSelfLoop'
                      : issue.code === 'dangling-edge' ? 'issueDangling'
                        : issue.code === 'cycle' ? 'issueCycle' : 'issuePlanned')}
              </span>
            ))}
        </div>

        {run === undefined ? null : (
          <div className="iv-run" data-workflow-run={run.latest?.status ?? 'none'} data-workflow-run-count={String(run.latest?.nodeRuns.length ?? 0)}>
            <div className="iv-run-head">
              <strong>{t('runTitle')}</strong>
              {run.latest === undefined
                ? <span className="iv-meta">{t('runNone')}</span>
                : (
                  <>
                    <span className={runChipClass(run.latest.status)}>
                      <i className="iv-dot" aria-hidden="true" />
                      {t(runStatusKey(run.latest.status))}
                      {' · '}
                      {run.latest.nodeRuns.filter(node => node.status === 'succeeded').length}/{run.latest.nodeRuns.length}
                    </span>
                    {run.latest.error === undefined ? null : (
                      <span className="iv-meta iv-ellipsis" title={run.latest.error}>{run.latest.error.slice(0, 80)}</span>
                    )}
                  </>
                )}
            </div>
            {run.history.length > 1
              ? (
                <div className="iv-run-history" data-workflow-run-history="true">
                  {run.history.slice(0, 8).map(entry => (
                    <button
                      key={entry.id}
                      type="button"
                      className="iv-run-item"
                      data-workflow-run-item={entry.id}
                      data-workflow-run-item-selected={entry.id === run.selectedRunId ? 'true' : 'false'}
                      onClick={() => { run.onSelectRun(entry.id) }}
                    >
                      {new Date(entry.startedAt).toLocaleTimeString('zh-CN', { hour12: false })}
                      {' · '}{t(runStatusKey(entry.status))}
                      {' · '}{entry.nodeRuns.filter(node => node.outputPath !== undefined).length} {t('runArtifacts')}
                    </button>
                  ))}
                </div>
              )
              : null}
            {run.latest === undefined
              ? null
              : (
                <div className="iv-run-nodes">
                  {run.latest.nodeRuns.map(node => (
                    <span key={node.nodeId} className="iv-node-run" data-workflow-node-run={node.nodeId} data-workflow-node-status={node.status}>
                      <i className="iv-dot" aria-hidden="true" />
                      <span className="iv-ellipsis">
                        {node.nodeId} · {t(nodeStatusKey(node.status))}
                        {node.outputPath === undefined ? '' : ` · ${node.outputPath.split('/').pop() ?? ''}`}
                        {node.error === undefined ? '' : ` · ${node.error.slice(0, 60)}`}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            <div className="iv-run-actions">
              <button type="button" className="iv-btn iv-btn--primary iv-btn--sm" data-workflow-run-action="start"
                disabled={run.busy || !validation.ok || run.latest?.status === 'running'} onClick={run.onStart}>
                <Icon name="play" />{t('runStart')}
              </button>
              <button type="button" className="iv-btn iv-btn--sm" data-workflow-run-action="cancel"
                disabled={run.latest?.status !== 'running'} onClick={run.onCancel}>
                {t('runCancel')}
              </button>
              <button type="button" className="iv-btn iv-btn--sm" data-workflow-run-action="retry"
                disabled={run.latest?.status !== 'failed'} onClick={run.onRetry}>
                {t('runRetry')}
              </button>
            </div>
          </div>
        )}

        <div className="iv-flow" data-workflow-flow="true">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onNodeDragStop={onNodeDragStop}
            onPaneClick={onPaneClick}
            // 多选修饰键两个平台都认（默认值跟 isMacOs 走，Windows 用户按 Cmd 没反应）
            multiSelectionKeyCode={['Meta', 'Control']}
            selectionOnDrag
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={18} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {selectedNodes.length === 0
          ? <p className="iv-meta">{t('canvasEmpty')}</p>
          : (
            <div className="iv-inspector" data-workflow-inspector={selectedNodes[0]!.id}>
              <div className="iv-inspector-head">
                <Icon name={NODE_ICONS[selectedNodes[0]!.data.kind]} size={13} />
                {t('canvasParams')} · {selectedNodes[0]!.data.kind}
                {selectedNodes.length > 1 ? <span className="iv-meta">{t('canvasSelected')} · {selectedNodes.length}</span> : null}
                {run?.onRunNode === undefined || selectedNodes.length !== 1 ? null : (
                  <button
                    type="button"
                    className="iv-btn iv-btn--sm"
                    data-workflow-action="run-node"
                    aria-label={t('canvasRunNode')}
                    title={t('canvasRunNode')}
                    disabled={run.busy || run.latest?.status === 'running'}
                    onClick={() => { run.onRunNode?.(selectedNodes[0]!.id) }}
                  >
                    <Icon name="play" size={11} />{t('canvasRunNode')}
                  </button>
                )}
              </div>
              {nodeSpec(selectedNodes[0]!.data.kind).availability !== 'runnable'
                ? (
                  <span className="iv-meta" data-workflow-planned-note="true" style={{ color: 'var(--iv-warn)' }}>
                    <Icon name="sparkles" size={12} /> {t(nodeSpec(selectedNodes[0]!.data.kind).reasonKey as WorkbenchLocaleKey)}
                  </span>
                )
                : null}
              {nodeSpec(selectedNodes[0]!.data.kind).params.length === 0
                ? <span className="iv-meta">{t('canvasNoParams')}</span>
                : nodeSpec(selectedNodes[0]!.data.kind).params.map(field => (
                  <label key={field.id} className="iv-field">
                    <span>{t(field.labelKey as WorkbenchLocaleKey)}</span>
                    {field.type === 'boolean'
                      ? (
                        <input
                          type="checkbox"
                          data-workflow-param={field.id}
                          checked={selectedNodes[0]!.data.params[field.id] === true}
                          onChange={event => { updateParam(selectedNodes[0]!.id, field.id, event.target.checked) }}
                        />
                      )
                      : field.type === 'select'
                        ? (
                          <select
                            className="iv-select"
                            data-workflow-param={field.id}
                            value={String(selectedNodes[0]!.data.params[field.id] ?? '')}
                            onChange={event => { updateParam(selectedNodes[0]!.id, field.id, event.target.value) }}
                          >
                            {(field.options ?? []).map(option => (
                              <option key={option.value} value={option.value}>{t(option.labelKey as WorkbenchLocaleKey)}</option>
                            ))}
                          </select>
                        )
                        : field.type === 'textarea'
                          ? (
                            <textarea
                              className="iv-input iv-textarea"
                              data-workflow-param={field.id}
                              rows={2}
                              value={String(selectedNodes[0]!.data.params[field.id] ?? '')}
                              onChange={event => { updateParam(selectedNodes[0]!.id, field.id, event.target.value) }}
                            />
                          )
                          : (
                            <input
                              className="iv-input"
                              data-workflow-param={field.id}
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={String(selectedNodes[0]!.data.params[field.id] ?? '')}
                              onChange={event => {
                                updateParam(selectedNodes[0]!.id, field.id, field.type === 'number'
                                  ? Number(event.target.value) : event.target.value)
                              }}
                            />
                          )}
                  </label>
                ))}
            </div>
          )}
        {error === undefined ? null : <p className="iv-notice iv-notice--error" role="status">{error}</p>}
        <p className="iv-meta">{t('canvasTransient')}</p>
      </div>
    </div>
  )
}

/** 对外画布组件：套 `ReactFlowProvider` 并注入官方样式 + 设计系统样式。 */
export function WorkflowCanvas(props: WorkflowCanvasProps): JSX.Element {
  useCanvasStyle()
  useWorkbenchStyle()
  return (
    <ReactFlowProvider>
      <CanvasSurface {...props} />
    </ReactFlowProvider>
  )
}
