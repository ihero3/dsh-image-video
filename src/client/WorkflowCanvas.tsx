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
  NODE_CATALOG, WORKFLOW_TEMPLATES, defaultParams, nodeSpec, validateWorkflow,
  type NodeParamValue, type WorkflowIssue, type WorkflowNodeKind, type WorkflowRecord, type WorkflowRunRecord,
} from '../workbench/workflow.ts'
import { CANVAS_STYLE, CANVAS_STYLE_ID } from './canvas-style.ts'
import type { WorkbenchLocaleKey } from './locales.ts'
import { Icon, type IconName } from './icons.tsx'
import { useWorkbenchStyle } from './workbench-style.ts'

/** 画布节点携带的数据（xyflow 要求可索引）。 */
export interface CanvasNodeData extends Record<string, unknown> {
  kind: WorkflowNodeKind
  params: Record<string, NodeParamValue>
  /** `T4-3` 校验把这个节点标记为有问题时置位（只影响样式）。 */
  invalid?: boolean
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
  /** 运行控制（`T4-4`）：状态展示 + 起跑/取消/重试。 */
  readonly run?: {
    readonly latest?: WorkflowRunRecord
    /** 历史运行（最新在前），点一条即可回看它当时的节点产出与图快照。 */
    readonly history: readonly WorkflowRunRecord[]
    readonly selectedRunId?: string
    readonly busy: boolean
    readonly onStart: () => void
    readonly onCancel: () => void
    readonly onRetry: () => void
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
      className="iv-node"
      data-workflow-node={data.kind}
      data-workflow-node-selected={selected ? 'true' : 'false'}
      data-workflow-node-availability={spec.availability}
      data-workflow-node-invalid={data.invalid === true ? 'true' : 'false'}
    >
      <Handle type="target" position={Position.Left} />
      <div className="iv-node-head">
        <Icon name={NODE_ICONS[data.kind]} size={13} />
        <span className="iv-node-title">{t(spec.labelKey as WorkbenchLocaleKey)}</span>
        {planned
          ? <span className="iv-node-planned" data-workflow-planned-tag="true"><Icon name="sparkles" size={9} />{t('canvasPlannedTag')}</span>
          : null}
      </div>
      {summary === '' ? null : <div className="iv-node-body">{summary}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/** 画布内部实现（需要 `ReactFlowProvider` 才能调用 `fitView`）。 */
function CanvasSurface({ record, onChange, t, run }: WorkflowCanvasProps): JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(toCanvasNodes(record))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toCanvasEdges(record))
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [templateId, setTemplateId] = useState<string>(WORKFLOW_TEMPLATES[0]?.id ?? '')
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
    setNodes(built)
    setEdges(template.edges.map(([from, to]) => ({
      id: `${built[from]?.id ?? from}->${built[to]?.id ?? to}`,
      source: built[from]?.id ?? String(from),
      target: built[to]?.id ?? String(to),
    })))
    setSelectedId(undefined)
    setError(undefined)
  }, [setNodes, setEdges])

  const removeSelected = useCallback(() => {
    if (selectedId === undefined) return
    setNodes(current => current.filter(node => node.id !== selectedId))
    setEdges(current => current.filter(edge => edge.source !== selectedId && edge.target !== selectedId))
    setSelectedId(undefined)
  }, [selectedId, setNodes, setEdges])

  return (
    <div
      className="iv-canvas"
      data-workflow-canvas="true"
      data-workflow-nodes={String(nodes.length)}
      data-workflow-edges={String(edges.length)}
      data-workflow-selected={selectedId ?? ''}
    >
      <div className="iv-palette" data-workflow-palette="true">
        <strong className="iv-eyebrow iv-pal-title">{t('canvasPalette')}</strong>
        {NODE_CATALOG.filter(spec => spec.availability === 'runnable').map(spec => (
          <button
            key={spec.kind}
            type="button"
            className="iv-pal-item"
            data-workflow-palette-item={spec.kind}
            data-workflow-availability={spec.availability}
            aria-label={`${t('canvasAdd')} ${spec.kind}`}
            title={spec.reasonKey === undefined ? spec.kind : t(spec.reasonKey as WorkbenchLocaleKey)}
            onClick={() => { addNode(spec.kind) }}
          >
            <Icon name={NODE_ICONS[spec.kind]} size={13} />
            <span className="iv-ellipsis">{t(spec.labelKey as WorkbenchLocaleKey)}</span>
          </button>
        ))}
        {NODE_CATALOG.some(spec => spec.availability !== 'runnable')
          ? (
            <>
              <span className="iv-pal-sep" role="separator" />
              <strong className="iv-eyebrow">{t('palettePlanned')}</strong>
              {NODE_CATALOG.filter(spec => spec.availability !== 'runnable').map(spec => (
                <button
                  key={spec.kind}
                  type="button"
                  className="iv-pal-item"
                  data-workflow-palette-item={spec.kind}
                  data-workflow-availability={spec.availability}
                  aria-label={`${t('canvasAdd')} ${spec.kind}`}
                  title={spec.reasonKey === undefined ? spec.kind : t(spec.reasonKey as WorkbenchLocaleKey)}
                  onClick={() => { addNode(spec.kind) }}
                >
                  <Icon name={NODE_ICONS[spec.kind]} size={13} />
                  <span className="iv-ellipsis">{t(spec.labelKey as WorkbenchLocaleKey)}</span>
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
          <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="delete-node"
            disabled={selectedId === undefined} onClick={removeSelected}>
            <Icon name="trash" />{t('canvasDeleteNode')}
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
          ? <p className="iv-meta">{t('canvasEmpty')}</p>
          : (
            <div className="iv-inspector" data-workflow-inspector={selected.id}>
              <div className="iv-inspector-head">
                <Icon name={NODE_ICONS[selected.data.kind]} size={13} />
                {t('canvasParams')} · {selected.data.kind}
              </div>
              {nodeSpec(selected.data.kind).availability !== 'runnable'
                ? (
                  <span className="iv-meta" data-workflow-planned-note="true" style={{ color: 'var(--iv-warn)' }}>
                    <Icon name="sparkles" size={12} /> {t(nodeSpec(selected.data.kind).reasonKey as WorkbenchLocaleKey)}
                  </span>
                )
                : null}
              {nodeSpec(selected.data.kind).params.length === 0
                ? <span className="iv-meta">{t('canvasNoParams')}</span>
                : nodeSpec(selected.data.kind).params.map(field => (
                  <label key={field.id} className="iv-field">
                    <span>{t(field.labelKey as WorkbenchLocaleKey)}</span>
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
                            className="iv-select"
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
                              className="iv-input iv-textarea"
                              data-workflow-param={field.id}
                              rows={2}
                              value={String(selected.data.params[field.id] ?? '')}
                              onChange={event => { updateParam(selected.id, field.id, event.target.value) }}
                            />
                          )
                          : (
                            <input
                              className="iv-input"
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
