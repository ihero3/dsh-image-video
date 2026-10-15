/**
 * 工作流画布（`T4-1`/`T4-2`）。
 *
 * 边界按 `R-FLW-1`：画布**只做交互**——节点位置、连线、选择、缩放平移、适配窗口。
 * 执行、参数校验（除"必填"以外的语义校验）、调度与持久化都在宿主侧；
 * 本组件把画布维度的事实收敛成一个 `WorkflowRecord` 交给上层（`T4-1` 单一事实源），
 * 且**选择状态只在本地**，不进 `WorkflowRecord`（UI 瞬时选择不入库）。
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
  NODE_CATALOG, defaultParams, nodeSpec,
  type NodeParamValue, type WorkflowNodeKind, type WorkflowRecord,
} from '../workbench/workflow.ts'
import { CANVAS_STYLE, CANVAS_STYLE_ID } from './canvas-style.ts'
import type { WorkbenchLocaleKey } from './locales.ts'

/** 画布节点携带的数据（xyflow 要求可索引）。 */
export interface CanvasNodeData extends Record<string, unknown> {
  kind: WorkflowNodeKind
  params: Record<string, NodeParamValue>
}

/** 画布节点类型（必须带自定义 type，否则 xyflow 会用默认节点渲染）。 */
export type CanvasNode = Node<CanvasNodeData, 'workbench'>

/** 画布组件的对外属性。 */
export interface WorkflowCanvasProps {
  /** 唯一事实源；画布只读取它做初始化。 */
  readonly record: WorkflowRecord
  /** 图变化时回写（位置/连线/参数），选择状态不在此列。 */
  readonly onChange: (record: WorkflowRecord) => void
  /** 文案取用。 */
  readonly t: (key: WorkbenchLocaleKey) => string
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
  return record.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target }))
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
    edges: edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target })),
    updatedAt: new Date().toISOString(),
  }
}

let nodeSequence = 0

/** 生成画布内唯一的节点/连线 id（与宿主的记录 id 空间无关）。 */
function nextNodeId(kind: WorkflowNodeKind): string {
  nodeSequence += 1
  return `${kind}-${Date.now().toString(36)}-${nodeSequence.toString(36)}`
}

/** 节点卡片：本地化种类名 + 参数摘要（用参数标签而不是键名）+ 左右连接点。 */
function WorkflowNodeCard({ data, selected, t }: NodeProps<CanvasNode> & { t: (key: WorkbenchLocaleKey) => string }): JSX.Element {
  const spec = nodeSpec(data.kind)
  const planned = spec.availability !== 'runnable'
  const summary = spec.params
    .filter(field => data.params[field.id] !== '' && data.params[field.id] !== false && data.params[field.id] !== undefined)
    .slice(0, 2)
    .map(field => `${t(field.labelKey as WorkbenchLocaleKey)}=${String(data.params[field.id]).slice(0, 14)}`)
    .join(' · ')
  return (
    <div
      data-workflow-node={data.kind}
      data-workflow-node-selected={selected ? 'true' : 'false'}
      data-workflow-node-availability={spec.availability}
      style={{
        minWidth: '132px', padding: '6px 8px', borderRadius: '8px', fontSize: '12px',
        border: `1px ${planned ? 'dashed' : 'solid'} ${selected ? 'var(--dsh-accent, #4c8dff)' : 'var(--dsh-border, #3a3a3a)'}`,
        background: 'var(--dsh-surface, #1f1f22)', color: 'var(--dsh-text, #e8e8ea)',
        boxShadow: selected ? '0 0 0 2px rgba(76,141,255,0.35)' : 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ width: 9, height: 9 }} />
      <div style={{ fontWeight: 600 }}>{t(spec.labelKey as WorkbenchLocaleKey)}</div>
      {planned
        ? <div data-workflow-planned-tag="true" style={{ opacity: 0.8, fontSize: '9px', marginTop: '2px' }}>⚠ {t('canvasPlannedTag')}</div>
        : null}
      {summary === '' ? null : (
        <div style={{ opacity: 0.7, fontSize: '10px', marginTop: '2px' }}>{summary}</div>
      )}
      <Handle type="source" position={Position.Right} style={{ width: 9, height: 9 }} />
    </div>
  )
}

/** 画布内部实现（需要 `ReactFlowProvider` 才能调用 `fitView`）。 */
function CanvasSurface({ record, onChange, t }: WorkflowCanvasProps): JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(toCanvasNodes(record))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toCanvasEdges(record))
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const { fitView } = useReactFlow<CanvasNode, Edge>()
  const lastPushed = useRef<string>('')
  const seededId = useRef<string>(record.id)

  // 文档换了一份（例如切项目）才重新播种；同一份文档的编辑不回灌，避免打断拖拽。
  useEffect(() => {
    if (seededId.current === record.id) return
    seededId.current = record.id
    setNodes(toCanvasNodes(record))
    setEdges(toCanvasEdges(record))
    setSelectedId(undefined)
  }, [record, setNodes, setEdges])

  // 图变化 → 回写唯一事实源（选择不在其中）。
  useEffect(() => {
    const merged = merge(record, nodes, edges)
    const fingerprint = JSON.stringify({ nodes: merged.nodes, edges: merged.edges })
    if (fingerprint === lastPushed.current) return
    lastPushed.current = fingerprint
    onChange(merged)
  }, [nodes, edges, record, onChange])

  // 卡片要用当前语言渲染，所以 nodeTypes 跟着 t 走（t 变化才重建，避免每帧换组件）
  const nodeTypes = useMemo(() => ({
    workbench: (nodeProps: NodeProps<CanvasNode>) => <WorkflowNodeCard {...nodeProps} t={t} />,
  }), [t])
  const selected = nodes.find(node => node.id === selectedId)

  // planned 节点按 `T3-2` 可以放进图并保存，只是**不可运行**（执行侧由 `T3-3` 拒绝）；
  // 因此这里不拦，只在卡片与参数面板上如实标注。
  const addNode = useCallback((kind: WorkflowNodeKind) => {
    setNodes(current => {
      const index = current.length
      const node: CanvasNode = {
        id: nextNodeId(kind), type: 'workbench',
        position: { x: 40 + (index % 4) * 190, y: 40 + Math.floor(index / 4) * 120 },
        data: { kind, params: defaultParams(kind) },
      }
      setSelectedId(node.id)
      return [...current, node]
    })
  }, [setNodes])

  const updateParam = useCallback((id: string, key: string, value: NodeParamValue) => {
    setNodes(current => current.map(node => (
      node.id === id ? { ...node, data: { ...node.data, params: { ...node.data.params, [key]: value } } } : node
    )))
  }, [setNodes])

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source === connection.target) { setError(t('canvasSelfLoop')); return }
    setError(undefined)
    setEdges(current => addEdge({ ...connection, id: `${connection.source}-${connection.target}` }, current))
  }, [setEdges, t])

  const removeSelected = useCallback(() => {
    if (selectedId === undefined) return
    setNodes(current => current.filter(node => node.id !== selectedId))
    setEdges(current => current.filter(edge => edge.source !== selectedId && edge.target !== selectedId))
    setSelectedId(undefined)
  }, [selectedId, setNodes, setEdges])

  return (
    <div
      data-workflow-canvas="true"
      data-workflow-nodes={String(nodes.length)}
      data-workflow-edges={String(edges.length)}
      data-workflow-selected={selectedId ?? ''}
      style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: '8px', minHeight: '320px' }}
    >
      <div data-workflow-palette="true" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <strong style={{ fontSize: '11px', opacity: 0.75 }}>{t('canvasPalette')}</strong>
        {NODE_CATALOG.map(spec => (
          <button
            key={spec.kind}
            type="button"
            data-workflow-palette-item={spec.kind}
            data-workflow-availability={spec.availability}
            aria-label={`${t('canvasAdd')} ${spec.kind}`}
            title={spec.reasonKey === undefined ? spec.kind : t(spec.reasonKey as WorkbenchLocaleKey)}
            onClick={() => { addNode(spec.kind) }}
            style={{
              fontSize: '11px', textAlign: 'left', padding: '3px 6px', borderRadius: '6px',
              border: '1px solid var(--dsh-border, #3a3a3a)', background: 'transparent',
              color: 'var(--dsh-text, #e8e8ea)', opacity: spec.availability === 'runnable' ? 1 : 0.6,
              borderStyle: spec.availability === 'runnable' ? 'solid' : 'dashed',
              cursor: 'pointer',
            }}
          >
            {t(spec.labelKey as WorkbenchLocaleKey)}{spec.availability === 'runnable' ? '' : ` · ${t('canvasPlannedTag')}`}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" data-workflow-action="fit" onClick={() => { void fitView({ padding: 0.2 }) }}
            style={{ fontSize: '11px' }}>{t('canvasFit')}</button>
          <button type="button" data-workflow-action="delete-node" disabled={selectedId === undefined}
            onClick={removeSelected} style={{ fontSize: '11px' }}>{t('canvasDeleteNode')}</button>
          <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: 'auto' }}>
            {nodes.length} {t('canvasNodesCount')} · {edges.length} {t('canvasEdgesCount')}
          </span>
        </div>

        <div data-workflow-flow="true" style={{ height: '260px', border: '1px solid var(--dsh-border, #3a3a3a)', borderRadius: '8px', overflow: 'hidden' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_event, node) => { setSelectedId(node.id) }}
            onPaneClick={() => { setSelectedId(undefined) }}
            fitView
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={18} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {selected === undefined
          ? <p style={{ margin: 0, fontSize: '11px', opacity: 0.7 }}>{t('canvasEmpty')}</p>
          : (
            <div data-workflow-inspector={selected.id} style={{ display: 'grid', gap: '4px' }}>
              <strong style={{ fontSize: '11px' }}>{t('canvasParams')} · {selected.data.kind}</strong>
              {nodeSpec(selected.data.kind).availability !== 'runnable'
                ? (
                  <span data-workflow-planned-note="true" style={{ fontSize: '11px', color: 'var(--dsh-warning, #d08c00)' }}>
                    ⚠ {t(nodeSpec(selected.data.kind).reasonKey as WorkbenchLocaleKey)}
                  </span>
                )
                : null}
              {nodeSpec(selected.data.kind).params.length === 0
                ? <span style={{ fontSize: '11px', opacity: 0.7 }}>{t('canvasNoParams')}</span>
                : nodeSpec(selected.data.kind).params.map(field => (
                  <label key={field.id} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '4px', fontSize: '11px' }}>
                    <span style={{ opacity: 0.8 }}>{t(field.labelKey as WorkbenchLocaleKey)}</span>
                    {field.type === 'boolean'
                      ? (
                        <input
                          type="checkbox"
                          data-workflow-param={field.id}
                          checked={selected.data.params[field.id] === true}
                          onChange={event => { updateParam(selected.id, field.id, event.target.checked) }}
                        />
                      )
                      : field.type === 'select'
                        ? (
                          <select
                            data-workflow-param={field.id}
                            value={String(selected.data.params[field.id] ?? '')}
                            onChange={event => { updateParam(selected.id, field.id, event.target.value) }}
                          >
                            {(field.options ?? []).map(option => (
                              <option key={option.value} value={option.value}>{t(option.labelKey as WorkbenchLocaleKey)}</option>
                            ))}
                          </select>
                        )
                        : field.type === 'textarea'
                          ? (
                            <textarea
                              data-workflow-param={field.id}
                              rows={2}
                              value={String(selected.data.params[field.id] ?? '')}
                              onChange={event => { updateParam(selected.id, field.id, event.target.value) }}
                            />
                          )
                          : (
                            <input
                              data-workflow-param={field.id}
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={String(selected.data.params[field.id] ?? '')}
                              onChange={event => {
                                updateParam(selected.id, field.id, field.type === 'number'
                                  ? Number(event.target.value) : event.target.value)
                              }}
                            />
                          )}
                  </label>
                ))}
            </div>
          )}
        {error === undefined ? null : <p role="status" style={{ margin: 0, fontSize: '11px' }}>{error}</p>}
        <p style={{ margin: 0, fontSize: '10px', opacity: 0.55 }}>{t('canvasTransient')}</p>
      </div>
    </div>
  )
}

/** 对外画布组件：套 `ReactFlowProvider` 并注入官方样式。 */
export function WorkflowCanvas(props: WorkflowCanvasProps): JSX.Element {
  useCanvasStyle()
  return (
    <ReactFlowProvider>
      <CanvasSurface {...props} />
    </ReactFlowProvider>
  )
}
