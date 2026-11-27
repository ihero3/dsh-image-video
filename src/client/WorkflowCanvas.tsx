/**
 * 工作流画布（`T4-1`/`T4-2` + `B4` 交互补齐）。
 *
 * 边界按 `R-FLW-1`：画布**只做交互**——节点位置、连线、选择、缩放平移、适配窗口。
 * 执行、参数校验（除"必填"以外的语义校验）、调度与持久化都在宿主侧；
 * 本组件把画布维度的事实收敛成一个 `WorkflowRecord` 交给上层（`T4-1` 单一事实源），
 * 且**选择状态只在本地**，不进 `WorkflowRecord`（UI 瞬时选择不入库）。
 *
 * 交互口径参考 ComfyUI / LiblibAI 这类节点式生成工具（见
 * `docs/research/workflow-editor-references.md`）：
 * - 节点库是**左侧可检索的分组栏**，支持拖拽落到画布任意位置（不是一排平铺的 chip）；
 * - 空画布给**模板起步**（选一张模板即得一条可跑的链路），而不是一大片空白；
 * - 运行是**唯一的主按钮**，运行中给出进度与逐节点状态；缓存/失败直接标在卡片上；
 * - 参数收在**浮层检视器**里，选中才出现，避免把画布高度挤走；
 * - 端口类型在**拖线当刻**校验（`portsCompatible`），不让用户先接一条错的线再去日志里找原因。
 *
 * 样式：客户端私有插件产物由 `window.__ModuleLoader__` 以 JS 载入，不经过 Harness 的
 * CSS 打包链，所以 `@xyflow/react` 的官方样式表由 `scripts/sync-canvas-style.mjs`
 * 内嵌成字符串，在挂载时注入一次。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import {
  Background, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, addEdge, useEdgesState, useNodesState,
  useReactFlow, useViewport,
  type Connection, type Edge, type IsValidConnection, type Node, type NodeProps,
} from '@xyflow/react'
import {
  NODE_CATALOG, WORKFLOW_SOURCE_HANDLE, WORKFLOW_TARGET_HANDLE, WORKFLOW_TEMPLATES, defaultParams, hasNodeExecutor, nodeSpec,
  portsCompatible, validateWorkflow,
  type NodeGroup, type NodeParamValue, type WorkflowIssue, type WorkflowNodeKind, type WorkflowRecord,
  type WorkflowRunRecord,
} from '../workbench/workflow.ts'
import { CANVAS_STYLE, CANVAS_STYLE_ID } from './canvas-style.ts'
import { downloadWorkflowFile, parseWorkflowFile, serializeWorkflow } from './workflow-io.ts'
import { readWorkflowFromImage } from './image-workflow.ts'
import { autoLayout, filterItems } from './workflow-layout.ts'
import { ModelPicker } from './panels/ModelPicker.tsx'
import { useDialogFocus } from './use-dialog-focus.ts'
import type { WorkbenchApi } from './api.ts'
import type { WorkbenchLocaleKey } from './locales.ts'
import { Icon, type IconName } from './icons.tsx'
import { useWorkbenchStyle } from './workbench-style.ts'
import { useModernTheme } from './modern-theme.ts'
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
  /** 该节点的产出路径（运行记录里的 `outputPath`，卡片缩略图用）。 */
  outputPath?: string
  /** 产出是图还是视频（决定缩略图的呈现）。 */
  outputKind?: 'image' | 'video'
  /** 这条产出来自跨运行缓存（卡片上标「缓存」，与 ComfyUI 的 cached 节点同义）。 */
  cached?: boolean
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
  /** 导入 / 导出的结果提示（上层接到全局通知条）。 */
  readonly onNotice?: (text: string, tone: 'info' | 'error') => void
  /** 点节点上的产出缩略图：把产物送到右侧预览（与素材列表同一个落点）。 */
  readonly onPreview?: (path: string, kind: 'image' | 'video') => void
  /**
   * 宿主 API：只用于「模型」字段的候选与默认值（`models/catalog`）。
   * 不传时该字段退回纯文本输入——画布不该因为拿不到目录就整块不可用。
   */
  readonly api?: WorkbenchApi
  /**
   * 外部整图替换信号（`F3` 模板市场）：值变化时把 `record` 的最新图**经 applyGraph 应用**，
   * 而不是重新播种——这样替换会进撤销栈，确认弹窗承诺的 Ctrl/Cmd+Z 才成立。
   * 只比较值，不比较图；调用方每次替换自增即可。
   */
  readonly replaceRevision?: number
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
    /** `B4`：只跑这一个节点（含下游），宿主 `workflows/run` 已支持 `only`。 */
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
  'external': 'box',
}

/** 节点库分组（顺序即侧栏顺序；`planned` 永远在最后）。 */
const LIBRARY_GROUPS: readonly { readonly id: NodeGroup; readonly labelKey: WorkbenchLocaleKey }[] = [
  { id: 'input', labelKey: 'canvasGroupInput' },
  { id: 'story', labelKey: 'canvasGroupStory' },
  { id: 'generate', labelKey: 'canvasGroupGenerate' },
  { id: 'finish', labelKey: 'canvasGroupFinishPlanned' },
  { id: 'planned', labelKey: 'canvasGroupPlanned' },
]

/** 空画布首推的模板（ComfyUI「默认工作流」的同位物：点一下就有可跑的东西）。 */
const ONBOARD_TEMPLATES = ['quick-image', 'quick-video', 'production-line', 'reference-remake'] as const

/** 从画布拖到节点库/画布之间传递节点种类的 MIME（自定义类型，避免把文件拖拽认错）。 */
const NODE_DND_TYPE = 'application/x-dsh-workflow-node'

/** 运行状态 → 徽章色调。 */
function runChipClass(status: 'running' | 'succeeded' | 'failed' | 'cancelled'): string {
  switch (status) {
    case 'running': return 'iv-chip iv-chip--run'
    case 'succeeded': return 'iv-chip iv-chip--ok'
    case 'failed': return 'iv-chip iv-chip--err'
    case 'cancelled': return 'iv-chip'
  }
}

/** 产出路径 → 预览地址（宿主把产出目录挂在 `/outputs/` 下）。 */
function outputUrl(path: string): string {
  const name = path.split('/').pop() ?? path
  return `/outputs/${encodeURIComponent(name)}`
}

/** 产出路径 → 图/视频（决定用 `<img>` 还是播放入口）。 */
function mediaKindOf(path: string): 'image' | 'video' {
  return /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(path) ? 'image' : 'video'
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

/**
 * 给一条边补上稳定的端口 id。
 *
 * React Flow v12 对 `undefined` 与 `null` 的 handle 匹配是严格的：边若不带 handle id，
 * 端点解析不到就会被**静默丢弃**（画布上"有节点没连线"就是这个 bug）。
 * 所有进画布的边都要过这一道：加载、模板、粘贴、连线。
 */
function withHandles(edge: Edge): Edge {
  return {
    ...edge,
    sourceHandle: edge.sourceHandle ?? WORKFLOW_SOURCE_HANDLE,
    targetHandle: edge.targetHandle ?? WORKFLOW_TARGET_HANDLE,
  }
}

function toCanvasEdges(record: WorkflowRecord): Edge[] {
  return record.edges.map(edge => withHandles({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
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
 * 节点卡片：本地化种类名 + 参数摘要 + 运行状态 + 产出缩略图。
 *
 * 运行状态与产出都来自运行记录（`nodeRuns` 按 nodeId 归拢），只进 `node.data` 的样式字段，
 * 不被 `merge` 持久化——运行记录是宿主侧的事实，卡片只是它的镜子。
 */
function WorkflowNodeCard({
  id, data, selected, t, onPreview, onActivate,
}: NodeProps<CanvasNode> & {
  t: (key: WorkbenchLocaleKey) => string
  onPreview?: (path: string, kind: 'image' | 'video') => void
  /** `F18`：键盘 Enter/Space 激活 = 单选该节点（与点选同一路，检视器由此出现）。 */
  onActivate?: (nodeId: string) => void
}): JSX.Element {
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const spec = nodeSpec(data.kind)
  const planned = spec.availability !== 'runnable'
  const external = spec.availability === 'external'
  // `B5`：只给「后期与交付」这一组标不执行——它们承诺产出成片，却没有执行器。
  // 输入/分镜类节点虽也走不到生成工具，但只作为提示词数据上游，不在此处制造噪音。
  const noExecutor = !planned && spec.group === 'finish' && !hasNodeExecutor(data.kind)
  const summary = spec.params
    .filter(field => data.params[field.id] !== '' && data.params[field.id] !== false && data.params[field.id] !== undefined)
    .slice(0, 2)
    .map(field => `${t(field.labelKey as WorkbenchLocaleKey)}=${String(data.params[field.id]).slice(0, 14)}`)
    .join(' · ')
  const runStatus = data.runStatus
  const failed = runStatus === 'failed'
  const outputPath = data.outputPath
  const outputKind = data.outputKind ?? (outputPath === undefined ? undefined : mediaKindOf(outputPath))
  return (
    <div
      className="iv-node"
      data-workflow-node={data.kind}
      data-workflow-node-selected={selected ? 'true' : 'false'}
      data-workflow-node-availability={spec.availability}
      data-workflow-node-no-executor={noExecutor ? 'true' : undefined}
      data-workflow-node-group={spec.group}
      data-workflow-node-invalid={data.invalid === true ? 'true' : 'false'}
      data-workflow-node-run-status={runStatus ?? 'none'}
      role="button"
      tabIndex={0}
      onKeyDown={event => {
        // 卡片自称 button，就得像 button 一样能被键盘激活。
        // 以前只靠 xyflow 默认 a11y（可聚焦、方向键移动），Enter/Space 什么都不发生。
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        event.stopPropagation()
        onActivate?.(id)
      }}
      aria-label={`${t(spec.labelKey as WorkbenchLocaleKey)}${runStatus === undefined ? '' : ` · ${t(nodeStatusKey(runStatus))}`}`}
    >
      <Handle
        id={WORKFLOW_TARGET_HANDLE}
        type="target"
        position={Position.Left}
        className={`iv-handle iv-handle--in iv-handle--${spec.input}`}
      />
      <div className="iv-node-head">
        <Icon name={NODE_ICONS[data.kind]} size={13} />
        <span className="iv-node-title">{t(spec.labelKey as WorkbenchLocaleKey)}</span>
        {data.cached === true ? (
          <span className="iv-node-cached" data-workflow-node-cached="true" title={t('canvasCached')}>
            {t('canvasCached')}
          </span>
        ) : null}
        {planned
          ? <span className="iv-node-planned" data-workflow-planned-tag="true">
            <Icon name="sparkles" size={9} />{t(external ? 'canvasExternalTag' : 'canvasPlannedTag')}
          </span>
          : null}
        {noExecutor
          ? <span className="iv-node-noexec" data-workflow-no-executor-tag="true" title={t('canvasNoExecutorHint')}>
            <Icon name="alert" size={9} />{t('canvasNoExecutorTag')}
          </span>
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
      {outputPath === undefined
        ? null
        : (
          <button
            type="button"
            className="iv-node-media"
            data-workflow-node-media={outputKind ?? 'image'}
            title={`${t('canvasOutputPreview')} · ${outputPath.split('/').pop() ?? outputPath}`}
            onClick={event => {
              event.stopPropagation()
              if (outputPath !== undefined) onPreview?.(outputPath, outputKind ?? 'image')
            }}
          >
            {outputKind === 'image'
              ? <img src={outputUrl(outputPath)} alt="" loading="lazy" draggable={false} />
              : (
                <>
                  <i className="iv-node-media-play" aria-hidden="true"><Icon name="play" size={12} /></i>
                  <span className="iv-node-media-name">{outputPath.split('/').pop()}</span>
                </>
              )}
          </button>
        )}
      {failed && bubbleOpen ? (
        <div className="iv-node-bubble" data-workflow-node-error-bubble="true" role="status">
          {data.runError ?? t('statusFailed')}
        </div>
      ) : null}
      <Handle
        id={WORKFLOW_SOURCE_HANDLE}
        type="source"
        position={Position.Right}
        className={`iv-handle iv-handle--out iv-handle--${spec.output}`}
      />
    </div>
  )
}

/** 空画布起步卡：选模板 / 空白 / 导入（ComfyUI 默认工作流 + LiblibAI 一键同款的同位物）。 */
function CanvasOnboarding({
  t, templates, onPick, onBlank, onImport,
}: {
  readonly t: (key: WorkbenchLocaleKey) => string
  readonly templates: readonly { readonly id: string; readonly labelKey: string; readonly nodeCount: number }[]
  readonly onPick: (id: string) => void
  readonly onBlank: () => void
  readonly onImport: () => void
}): JSX.Element {
  return (
    <div className="iv-wf-onboard" data-workflow-onboarding="true">
      <div className="iv-wf-onboard-card">
        <span className="iv-wf-onboard-eyebrow"><Icon name="sparkles" size={11} />{t('canvasOnboardingTitle')}</span>
        <p className="iv-wf-onboard-hint">{t('canvasOnboardingHint')}</p>
        <div className="iv-wf-onboard-grid">
          {templates.map(template => (
            <button
              key={template.id}
              type="button"
              className="iv-wf-onboard-tpl"
              data-workflow-onboarding-template={template.id}
              onClick={() => { onPick(template.id) }}
            >
              <span className="iv-wf-onboard-tpl-name">{t(template.labelKey as WorkbenchLocaleKey)}</span>
              <span className="iv-wf-onboard-tpl-meta">
                {t('canvasOnboardingNodes').replace('{n}', String(template.nodeCount))}
              </span>
            </button>
          ))}
        </div>
        <div className="iv-wf-onboard-foot">
          <button type="button" className="iv-btn iv-btn--sm" data-workflow-onboarding-blank="true" onClick={onBlank}>
            {t('canvasOnboardingBlank')}
          </button>
          <button type="button" className="iv-btn iv-btn--sm" data-workflow-onboarding-import="true" onClick={onImport}>
            <Icon name="upload" size={11} />{t('canvasOnboardingImport')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 画布内部实现（需要 `ReactFlowProvider` 才能调用 `fitView`）。 */
function CanvasSurface({ record, onChange, t, run, onNotice, onPreview, api, replaceRevision }: WorkflowCanvasProps): JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(toCanvasNodes(record))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toCanvasEdges(record))
  const [error, setError] = useState<string | undefined>(undefined)
  const [templateId, setTemplateId] = useState<string>(WORKFLOW_TEMPLATES[0]?.id ?? '')
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  /** 日志抽屉默认收起：校验与运行明细不再抢占画布高度，只在顶部留状态摘要。 */
  const [logOpen, setLogOpen] = useState(false)
  /** 全屏画布：把整个工作流区抬成覆盖视口的浮层，画布独占剩余高度。 */
  const [maximized, setMaximized] = useState(false)
  /** 节点库检索词（分组内实时过滤；`/` 聚焦）。 */
  const [libraryQuery, setLibraryQuery] = useState('')
  /** 节点库收起态（窄窗口默认由 CSS 收成图标条，这里只记用户手动切换）。 */
  const [libraryCollapsed, setLibraryCollapsed] = useState(false)
  /** 空画布起步卡是否已被用户主动收起（收起后就是一张干净的空白画布）。 */
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  /** 双击空白处的快速添加：位置（相对画布）与落点（画布坐标）。 */
  const [quickAdd, setQuickAdd] = useState<{
    readonly left: number
    readonly top: number
    readonly position: { readonly x: number; readonly y: number }
  } | undefined>(undefined)
  const [quickQuery, setQuickQuery] = useState('')
  /**
   * 整图替换前的确认（应用模板 / 导入 / 粘贴 JSON 都会覆盖当前图）。
   * 只有图里已有节点时才拦；空画布直接应用，不打扰首次使用。
   */
  const [pendingReplace, setPendingReplace] = useState<{ label: string; run: () => void } | undefined>(undefined)
  const replacePanelRef = useRef<HTMLDivElement | null>(null)
  useDialogFocus(pendingReplace !== undefined, replacePanelRef, () => { setPendingReplace(undefined) })
  const { fitView, screenToFlowPosition, setCenter } = useReactFlow<CanvasNode, Edge>()
  const { zoom } = useViewport()
  const flowRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const lastPushed = useRef<string>('')
  const seededId = useRef<string>(record.id)
  const clipboard = useRef<CanvasClipboard | undefined>(undefined)
  const workflowFileRef = useRef<HTMLInputElement | null>(null)
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
  /**
   * `F18`：节点卡的键盘激活（Enter/Space）。
   * 走与点选同一条路——改本地 `nodes` 的 `selected`，再由 `onSelectionChange`
   * 同步 `selectedIds`，检视器因此和鼠标点选一样打开。多选被收成单选：键盘激活
   * 一次只认一个节点，避免"按了回车却开了多选面板"。
   */
  const activateNode = useCallback((nodeId: string) => {
    setNodes(current => current.map(node => ({ ...node, selected: node.id === nodeId })))
    setEdges(current => current.map(edge => (edge.selected === true ? { ...edge, selected: false } : edge)))
  }, [setNodes, setEdges])
  /** 关抽屉 = 清空选中（与点画布空白同语义），焦点管理由此统一入口驱动。 */
  const closeInspector = useCallback(() => {
    setNodes(current => current.map(node => (node.selected === true ? { ...node, selected: false } : node)))
    setSelectedIds([])
  }, [setNodes])
  const inspectorRef = useRef<HTMLDivElement | null>(null)
  useDialogFocus(selectedNodes.length > 0, inspectorRef, closeInspector, '.iv-flow')

  // 窄屏抽屉会盖住右缘节点：仅在选中节点确实落入覆盖区时把视口左移一次。
  useEffect(() => {
    if (selectedNodes.length === 0) return
    const flow = flowRef.current
    if (flow === undefined || flow === null || window.innerWidth >= 900) return
    const drawerWidth = Math.min(300, flow.clientWidth * 0.86)
    const trigger = selectedNodes[0]!
    const x = trigger.position.x + (trigger.measured?.width ?? 180) / 2
    const y = trigger.position.y + (trigger.measured?.height ?? 60) / 2
    const project = flow.querySelector<HTMLElement>('.react-flow__viewport')
    const matrix = project?.style.transform ?? ''
    const scale = Number(/scale\(([\d.]+)\)/.exec(matrix)?.[1] ?? '1')
    const translate = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(matrix)
    const screenX = (translate !== null ? Number(translate[1]) : 0) + x * scale
    const screenY = (translate !== null ? Number(translate[2]) : 0) + y * scale
    if (screenX > flow.clientWidth - drawerWidth && screenY >= 0 && screenY <= flow.clientHeight) {
      void setCenter(x - drawerWidth / (2 * scale), y, { zoom: scale, duration: 180 })
    }
  }, [selectedIds.join(','), setCenter])

  // 全屏浮层盖住整个工作台：锁住页面滚动，退出时恢复原值
  useEffect(() => {
    if (!maximized) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [maximized])

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
    setOnboardingDismissed(false)
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

  // `B4`：把最近一次运行的节点状态/错误/产出同步进卡片数据（运行记录是宿主事实，卡片只镜像）
  const runFingerprint = (run?.latest?.nodeRuns ?? [])
    .map(entry => `${entry.nodeId}:${entry.status}:${entry.error ?? ''}:${entry.outputPath ?? ''}:${entry.cached === true ? '1' : '0'}`)
    .join('|')
  useEffect(() => {
    const byId = new Map((run?.latest?.nodeRuns ?? []).map(entry => [entry.nodeId, entry]))
    setNodes(current => {
      let changed = false
      const next = current.map(node => {
        const entry = byId.get(node.id)
        const status = entry?.status
        const errorText = entry?.error
        const outputPath = entry?.outputPath
        const outputKind = outputPath === undefined ? undefined : mediaKindOf(outputPath)
        const cached = entry?.cached === true ? true : undefined
        if (node.data.runStatus === status && node.data.runError === errorText
          && node.data.outputPath === outputPath && node.data.outputKind === outputKind
          && node.data.cached === cached) return node
        changed = true
        return {
          ...node,
          data: { ...node.data, runStatus: status, runError: errorText, outputPath, outputKind, cached },
        }
      })
      return changed ? next : current
    })
  }, [runFingerprint, setNodes])

  // 运行开始/失败时自动展开日志抽屉，保证错误可见；其余状态尊重用户手动折叠
  const previousRunStatus = useRef(run?.latest?.status)
  useEffect(() => {
    const status = run?.latest?.status
    if (status === previousRunStatus.current) return
    previousRunStatus.current = status
    if (status === 'running' || status === 'failed') setLogOpen(true)
  }, [run?.latest?.status])

  const nodeTypes = useMemo(() => ({
    workbench: (nodeProps: NodeProps<CanvasNode>) => (
      <WorkflowNodeCard {...nodeProps} t={t} onPreview={onPreview} onActivate={activateNode} />
    ),
  }), [t, onPreview, activateNode])

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

  /**
   * `F3`：外部整图替换（模板市场）走历史提交，而不是重播种。
   *
   * 以前模板市场会新建一条工作流记录，`record.id` 一变画布就 `resetHistory`，
   * 确认弹窗里「可用 Ctrl/Cmd+Z 撤销」当场变成假话。现在替换复用同一条记录，
   * 这里按 `replaceRevision` 把最新图推入撤销栈——撤销回到替换前的整图。
   * 首次渲染时 ref 已等于当前值，不会把挂载当成替换。
   */
  const appliedReplaceRevision = useRef(replaceRevision ?? 0)
  useEffect(() => {
    if (replaceRevision === undefined || replaceRevision === appliedReplaceRevision.current) return
    appliedReplaceRevision.current = replaceRevision
    const nextNodes = toCanvasNodes(record)
    const nextEdges = toCanvasEdges(record)
    setSelectedIds([])
    setOnboardingDismissed(false)
    applyGraph({ nodes: nextNodes, edges: nextEdges }, `replace:${replaceRevision}`)
    window.setTimeout(() => { void fitView({ padding: 0.12 }) }, 0)
  }, [replaceRevision, record, applyGraph, fitView])

  /** 视口中心对应的画布坐标（点击节点库/快捷键加节点时用，避免全叠在左上角）。 */
  const viewportCenter = useCallback((): { x: number, y: number } => {
    const rect = flowRef.current?.getBoundingClientRect()
    if (rect === undefined || rect.width === 0) return { x: 80, y: 80 }
    return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }, [screenToFlowPosition])

  // planned 节点按 `T3-2` 可以放进图并保存，只是**不可运行**（执行侧由 `T3-3` 拒绝）；
  // 因此这里不拦，只在卡片与参数面板上如实标注。
  const addNodeAt = useCallback((kind: WorkflowNodeKind, position?: { x: number, y: number }) => {
    const spot = position ?? viewportCenter()
    const node: CanvasNode = {
      id: nextNodeId(kind), type: 'workbench',
      position: { x: Math.round(spot.x - 90), y: Math.round(spot.y - 40) },
      data: { kind, params: defaultParams(kind) },
      selected: true,
    }
    const nextNodes: CanvasNode[] = nodes.map<CanvasNode>(candidate => ({ ...candidate, selected: false }))
    nextNodes.push(node)
    applyGraph({ nodes: nextNodes, edges }, `add:${node.id}`)
  }, [nodes, edges, applyGraph, viewportCenter])

  const updateParam = useCallback((id: string, key: string, value: NodeParamValue) => {
    const nextNodes = nodes.map(node => (
      node.id === id ? { ...node, data: { ...node.data, params: { ...node.data.params, [key]: value } } } : node
    ))
    // 连续打字合并成一步历史
    applyGraph({ nodes: nextNodes, edges }, `param:${id}:${key}`)
  }, [nodes, edges, applyGraph])

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source === connection.target) { setError(t('canvasSelfLoop')); return }
    const source = nodes.find(node => node.id === connection.source)
    const target = nodes.find(node => node.id === connection.target)
    if (source !== undefined && target !== undefined && !portsCompatible(source.data.kind, target.data.kind)) {
      setError(t('issuePort'))
      return
    }
    setError(undefined)
    const id = `${connection.source}-${connection.target}`
    if (edges.some(edge => edge.id === id)) return
    const nextEdges = addEdge(withHandles({ ...connection, id } as Edge), edges)
    applyGraph({ nodes, edges: nextEdges }, `connect:${id}`)
  }, [nodes, edges, applyGraph, t])

  /** 拖线时实时拒绝不兼容的端口（ComfyUI 口径：接不上的线不去日志里解释）。 */
  const isValidConnection = useCallback<IsValidConnection<Edge>>(connection => {
    if (connection.source === connection.target) return false
    const source = nodes.find(node => node.id === connection.source)
    const target = nodes.find(node => node.id === connection.target)
    if (source === undefined || target === undefined) return false
    return portsCompatible(source.data.kind, target.data.kind)
  }, [nodes])

  /** 整图替换的统一守卫：图非空时先确认，空画布直接执行。 */
  const requestReplace = useCallback((label: string, run: () => void) => {
    if (nodes.length === 0) { run(); return }
    setPendingReplace({ label, run })
  }, [nodes.length])

  const applyTemplateNow = useCallback((id: string) => {
    const template = WORKFLOW_TEMPLATES.find(candidate => candidate.id === id)
    if (template === undefined) return
    const stamp = Date.now().toString(36)
    const built: CanvasNode[] = template.nodes.map((spec, index) => ({
      id: `${template.id}-${index}-${stamp}`,
      type: 'workbench',
      position: { x: 0, y: 0 },
      data: { kind: spec.kind, params: { ...defaultParams(spec.kind), ...spec.params ?? {} } },
    }))
    const builtEdges: Edge[] = template.edges.map(([from, to]) => withHandles({
      id: `${built[from]?.id ?? from}->${built[to]?.id ?? to}`,
      source: built[from]?.id ?? String(from),
      target: built[to]?.id ?? String(to),
    }))
    // 模板自带连线：直接按链路排版，用户看到的是一条从左到右的流水线而不是叠在一起
    const positions = autoLayout(
      built.map(node => ({ id: node.id, position: node.position })),
      builtEdges,
    )
    const laidOut = built.map(node => ({ ...node, position: positions.get(node.id) ?? node.position }))
    setError(undefined)
    setOnboardingDismissed(false)
    applyGraph({ nodes: laidOut, edges: builtEdges }, `template:${id}`)
    window.setTimeout(() => { void fitView({ padding: 0.12 }) }, 0)
  }, [applyGraph, fitView])

  const applyTemplate = useCallback((id: string) => {
    requestReplace(t('canvasReplaceTemplate'), () => { applyTemplateNow(id) })
  }, [requestReplace, applyTemplateNow, t])

  /** 自动排列：按深度分列重排（导入的外部工作流尤其需要）。 */
  const relayout = useCallback(() => {
    const current = merge(record, nodes, edges)
    const positions = autoLayout(current.nodes, current.edges)
    const laidOut = nodes.map(node => {
      const position = positions.get(node.id)
      return position === undefined ? node : { ...node, position }
    })
    applyGraph({ nodes: laidOut, edges }, `layout:${Date.now().toString(36)}`)
    window.setTimeout(() => { void fitView({ padding: 0.12 }) }, 0)
  }, [record, nodes, edges, applyGraph, fitView])

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
    const pastedEdges: Edge[] = clip.edges.map(edge => withHandles({
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

  /** 导入工作流 JSON：先做结构校验，通过才替换整张图（可撤销；图非空时先确认）。 */
  const importWorkflowTextNow = useCallback(async (text: string): Promise<void> => {
    try {
      const parsed = parseWorkflowFile(text)
      const graph: WorkflowRecord = { ...record, nodes: [...parsed.nodes], edges: [...parsed.edges] }
      applyGraph({ nodes: toCanvasNodes(graph), edges: toCanvasEdges(graph) }, `import:${Date.now().toString(36)}`)
      setSelectedIds([])
      setOnboardingDismissed(false)
      setError(undefined)
      const base = t('canvasImportWorkflowDone').replace('{n}', String(parsed.nodes.length))
      const report = parsed.report
      if (report === undefined) {
        onNotice?.(base, 'info')
      } else {
        const detail = [
          `映射 ${report.mapped.length} 类节点`,
          ...report.warnings.slice(0, 3),
        ].join(' · ')
        onNotice?.(`${base} · ${detail}`, 'info')
      }
      window.setTimeout(() => { void fitView({ padding: 0.12 }) }, 0)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
      onNotice?.(`${t('canvasImportWorkflowFailed')}：${message}`, 'error')
    }
  }, [record, applyGraph, onNotice, t, fitView])

  const importWorkflowText = useCallback(async (text: string): Promise<void> => {
    requestReplace(t('canvasReplaceImport'), () => { void importWorkflowTextNow(text) })
  }, [requestReplace, importWorkflowTextNow, t])

  const importWorkflowFile = useCallback(async (file: File): Promise<void> => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    // ComfyUI / LiblibAI 出图会把工作流写进 PNG 文本块：有就直接用它。
    const fromImage = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
      ? readWorkflowFromImage(bytes)
      : undefined
    await importWorkflowText(fromImage ?? new TextDecoder().decode(bytes))
  }, [importWorkflowText])

  /** 拖拽文件到画布：和文件选择走同一个导入入口。 */
  const importDroppedFile = useCallback((event: DragEvent): void => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    const name = file?.name.toLowerCase() ?? ''
    if (file !== undefined && (name.endsWith('.json') || name.endsWith('.png')
      || file.type === 'application/json' || file.type === 'image/png')) {
      void importWorkflowFile(file)
    }
  }, [importWorkflowFile])

  /** 从节点库拖进画布：落在松手的位置（而不是又回到左上角）。 */
  const dropNode = useCallback((event: DragEvent): void => {
    const kind = event.dataTransfer.getData(NODE_DND_TYPE)
    if (kind === '') return
    event.preventDefault()
    const spec = NODE_CATALOG.find(candidate => candidate.kind === kind)
    if (spec === undefined) return
    addNodeAt(spec.kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }, [addNodeAt, screenToFlowPosition])

  /** 导出工作流 JSON：带格式标识与版本，换一台机器也能按同一套校验导回来。 */
  const exportWorkflowFile = useCallback(() => {
    downloadWorkflowFile(serializeWorkflow(merge(record, nodes, edges)), record.name || 'workflow')
  }, [record, nodes, edges])

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
  // Delete/Backspace 删除选中、`/` 聚焦节点库检索。输入控件里不劫持（让用户正常打字）。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const typing = target !== null && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
        || target.isContentEditable === true
      )
      if (event.key === 'Escape') {
        // 由内到外：快速添加 → 参数检视器（=清空选中）→ 退出最大化
        if (quickAdd !== undefined) { event.preventDefault(); setQuickAdd(undefined); setQuickQuery(''); return }
        if (selectedIds.length > 0) {
          event.preventDefault()
          setNodes(current => current.map(node => (node.selected === true ? { ...node, selected: false } : node)))
          setSelectedIds([])
          return
        }
        if (maximized) { event.preventDefault(); setMaximized(false); return }
        return
      }
      if (typing) return
      const meta = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (key === '/' && !meta) {
        event.preventDefault()
        setLibraryCollapsed(false)
        searchRef.current?.focus()
        return
      }
      if (meta && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo(); else undo()
        return
      }
      if (meta && key === 'y') { event.preventDefault(); redo(); return }
      if (meta && key === 'a') {
        event.preventDefault()
        const ids = nodes.map(node => node.id)
        setNodes(current => current.map(node => (node.selected === true ? node : { ...node, selected: true })))
        setSelectedIds(ids)
        return
      }
      if (meta && key === 'c') { event.preventDefault(); copySelected(); return }
      if (meta && key === 'v') {
        event.preventDefault()
        // 剪贴板里是工作流 JSON 就建图；否则保持原来的"复制节点"语义。
        void (async () => {
          try {
            const text = await navigator.clipboard.readText()
            const trimmed = text.trim()
            if (trimmed.startsWith('{') && (trimmed.includes('"nodes"') || trimmed.includes('"class_type"'))) {
              await importWorkflowText(trimmed)
              return
            }
          } catch {
            // 剪贴板不可用（无权限 / 非安全上下文）时照旧走内部粘贴
          }
          pasteClipboard()
        })()
        return
      }
      if (!meta && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (selectedIds.length > 0) { event.preventDefault(); deleteSelected() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [
    undo, redo, copySelected, pasteClipboard, deleteSelected, selectedIds.length, maximized,
    importWorkflowText, quickAdd, nodes, setNodes,
  ])

  // 拖拽结束 = 一步历史（拖动过程中的每个 position 变化都合并进来）
  const onNodeDragStop = useCallback((_event: unknown, node: Node) => {
    commitHistory({ nodes, edges }, `drag:${node.id}`)
  }, [commitHistory, nodes, edges])

  // 点空白处：xyflow 会清掉内部选择（→ onSelectionChange([])），这里只清错误提示
  const onPaneClick = useCallback(() => { setError(undefined) }, [])

  /** 双击空白：在光标处弹出快速添加（ComfyUI 的招牌交互）。 */
  const onCanvasDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (!target.classList.contains('react-flow__pane')) return
    const rect = flowRef.current?.getBoundingClientRect()
    if (rect === undefined) return
    setQuickAdd({
      left: event.clientX - rect.left,
      top: event.clientY - rect.top,
      position: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    })
    setQuickQuery('')
  }, [screenToFlowPosition])

  // 节点库：已本地化的登记表 + 检索（分组在渲染时再切）
  const libraryEntries = useMemo(() => NODE_CATALOG
    .filter(spec => spec.availability !== 'external')
    .map(spec => ({ spec, kind: spec.kind, label: t(spec.labelKey as WorkbenchLocaleKey) })), [t])
  const filteredEntries = useMemo(
    () => filterItems(libraryEntries, libraryQuery),
    [libraryEntries, libraryQuery],
  )
  const quickMatches = useMemo(() => filterItems(libraryEntries, quickQuery), [libraryEntries, quickQuery])
  const onboardingTemplates = useMemo(() => ONBOARD_TEMPLATES.flatMap(id => {
    const template = WORKFLOW_TEMPLATES.find(candidate => candidate.id === id)
    return template === undefined
      ? []
      : [{ id: template.id, labelKey: template.labelKey, nodeCount: template.nodes.length }]
  }), [])

  /** 运行进度（运行中才有）：卡片与顶部进度条共用。 */
  const runProgress = run?.latest === undefined
    ? undefined
    : {
      done: run.latest.nodeRuns.filter(entry => entry.status === 'succeeded').length,
      total: run.latest.nodeRuns.length,
      status: run.latest.status,
    }
  const runBusy = run?.busy === true || run?.latest?.status === 'running'
  const progressPercent = runProgress === undefined || runProgress.total === 0
    ? 0
    : Math.round((runProgress.done / runProgress.total) * 100)

  return (
    <div
      className={`iv-workflow${maximized ? ' iv-workflow--max' : ''}`}
      data-workflow-canvas="true"
      data-workflow-maximized={maximized ? 'true' : 'false'}
      data-workflow-nodes={String(nodes.length)}
      data-workflow-edges={String(edges.length)}
      data-workflow-selected={selectedIds[0] ?? ''}
      data-workflow-selected-count={String(selectedIds.length)}
      data-workflow-history={`${undoDepth}/${redoDepth}`}
      data-workflow-library-collapsed={libraryCollapsed ? 'true' : 'false'}
    >
      {/* 工具条：左边是「建图」的动作（模板/撤销/排版/适配/导入导出），右边是唯一的主按钮「运行」 */}
      <div className="iv-wf-head" data-workflow-toolbar="true">
        <div className="iv-wf-head-main">
          <div className="iv-wf-tpl">
            <select
              className="iv-select iv-select--sm"
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
              <Icon name="copy" size={12} />{t('templateApply')}
            </button>
          </div>
          <span className="iv-toolbar-sep" role="separator" aria-hidden="true" />
          <button type="button" className="iv-btn iv-btn--sm iv-btn--icon" data-workflow-action="undo"
            aria-label={t('canvasUndo')} title={`${t('canvasUndo')}（⌘Z）`}
            disabled={!canUndo} onClick={undo}>
            <Icon name="undo" size={13} />
            {undoDepth > 0 ? <span className="iv-btn-badge">{undoDepth}</span> : null}
          </button>
          <button type="button" className="iv-btn iv-btn--sm iv-btn--icon" data-workflow-action="redo"
            aria-label={t('canvasRedo')} title={`${t('canvasRedo')}（⌘⇧Z）`}
            disabled={!canRedo} onClick={redo}>
            <Icon name="redo" size={13} />
            {redoDepth > 0 ? <span className="iv-btn-badge">{redoDepth}</span> : null}
          </button>
          <span className="iv-toolbar-sep" role="separator" aria-hidden="true" />
          <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="auto-layout"
            aria-label={t('canvasAutoLayout')} title={t('canvasAutoLayout')} onClick={relayout}>
            <Icon name="layers" size={12} />{t('canvasAutoLayout')}
          </button>
          <button type="button" className="iv-btn iv-btn--sm iv-btn--icon" data-workflow-action="fit"
            aria-label={t('canvasFit')} title={t('canvasFit')}
            onClick={() => { void fitView({ padding: 0.2 }) }}>
            <Icon name="expand" size={13} />
          </button>
          <input
            ref={workflowFileRef}
            type="file"
            accept=".json,application/json,.png,image/png"
            data-workflow-import-file="true"
            style={{ display: 'none' }}
            onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file !== undefined) void importWorkflowFile(file)
            }}
          />
          <button type="button" className="iv-btn iv-btn--sm iv-btn--icon" data-workflow-action="import"
            aria-label={t('canvasImportWorkflow')} title={t('canvasImportWorkflow')}
            onClick={() => workflowFileRef.current?.click()}>
            <Icon name="upload" size={13} />
          </button>
          <button type="button" className="iv-btn iv-btn--sm iv-btn--icon" data-workflow-action="export"
            aria-label={t('canvasExportWorkflow')} title={t('canvasExportWorkflow')}
            onClick={exportWorkflowFile}>
            <Icon name="download" size={13} />
          </button>
        </div>
        <div className="iv-wf-head-run">
          {run === undefined
            ? null
            : (
              <div className="iv-run-actions" data-workflow-toolbar-run="true">
                {validation.issues.length === 0
                  ? null
                  : (
                    <button type="button" className="iv-chip iv-chip--warn" data-workflow-log-issue-count="true"
                      title={t('validationTitle')} onClick={() => { setLogOpen(true) }}>
                      <Icon name="alert" size={11} />{validation.issues.length}
                    </button>
                  )}
                <span className="iv-wf-runstate" data-workflow-run-status={run.latest?.status ?? 'none'}>
                  <i className="iv-dot" aria-hidden="true" />
                  {run.latest === undefined ? t('runNone') : t(runStatusKey(run.latest.status))}
                </span>
                <button type="button" className="iv-btn iv-btn--acc iv-btn--sm" data-workflow-run-action="start"
                  disabled={runBusy || !validation.ok || nodes.length === 0} onClick={run.onStart}>
                  <Icon name="play" size={12} />
                  {run.latest?.status === 'running'
                    ? t('canvasProgress').replace('{done}', String(runProgress?.done ?? 0)).replace('{total}', String(runProgress?.total ?? 0))
                    : t('runStart')}
                </button>
                {run.latest?.status === 'running'
                  ? (
                    <button type="button" className="iv-btn iv-btn--sm" data-workflow-run-action="cancel"
                      onClick={run.onCancel}>
                      {t('runCancel')}
                    </button>
                  )
                  : run.latest?.status === 'failed'
                    ? (
                      <button type="button" className="iv-btn iv-btn--sm" data-workflow-run-action="retry"
                        onClick={run.onRetry}>
                        {t('runRetry')}
                      </button>
                    )
                    : null}
              </div>
            )}
          <button type="button" className="iv-btn iv-btn--sm iv-btn--icon"
            data-workflow-log-toggle="true" aria-expanded={logOpen}
            aria-controls="iv-workflow-log" aria-label={t('canvasLogs')} title={t('canvasLogs')}
            onClick={() => { setLogOpen(open => !open) }}>
            <Icon name="script" size={13} />
          </button>
          <button type="button" className="iv-btn iv-btn--sm iv-btn--icon" data-workflow-action="maximize"
            aria-pressed={maximized} aria-label={maximized ? t('canvasRestore') : t('canvasMaximize')}
            title={maximized ? t('canvasRestore') : t('canvasMaximize')}
            onClick={() => { setMaximized(value => !value) }}>
            <Icon name={maximized ? 'shrink' : 'expand'} size={13} />
          </button>
        </div>
      </div>

      <div className="iv-wf-body">
        {/* 节点库：分组 + 检索 + 拖拽；窄窗口由容器查询收成图标条 */}
        <aside className="iv-wf-lib" data-workflow-library="true" aria-label={t('canvasPalette')}>
          <div className="iv-wf-lib-head">
            <span className="iv-wf-lib-title">
              <Icon name="box" size={12} />{t('canvasPalette')}
            </span>
            <button type="button" className="iv-wf-lib-toggle" data-workflow-library-toggle="true"
              aria-expanded={!libraryCollapsed} aria-label={t('canvasLibraryToggle')}
              title={t('canvasLibraryToggle')}
              onClick={() => { setLibraryCollapsed(value => !value) }}>
              <Icon name="chevron" size={11} />
            </button>
          </div>
          <div className="iv-wf-lib-search">
            <Icon name="search" size={11} />
            <input
              ref={searchRef}
              type="search"
              className="iv-input iv-input--bare"
              data-workflow-library-search="true"
              placeholder={t('canvasLibraryHint')}
              aria-label={t('canvasLibraryHint')}
              value={libraryQuery}
              onChange={event => { setLibraryQuery(event.target.value) }}
            />
          </div>
          <div className="iv-wf-lib-body">
            {filteredEntries.length === 0
              ? <p className="iv-meta" data-workflow-library-empty="true">{t('canvasLibraryEmpty')}</p>
              : LIBRARY_GROUPS.map(group => {
                const items = filteredEntries.filter(entry => entry.spec.group === group.id)
                if (items.length === 0) return null
                return (
                  <div key={group.id} className="iv-wf-lib-group" data-workflow-library-group={group.id}>
                    <span className="iv-wf-lib-group-title">{t(group.labelKey)}</span>
                    {items.map(entry => (
                      <button
                        key={entry.kind}
                        type="button"
                        className="iv-wf-lib-item"
                        data-workflow-palette-item={entry.kind}
                        data-workflow-availability={entry.spec.availability}
                        draggable
                        aria-label={`${t('canvasAdd')} ${entry.kind}`}
                        data-workflow-no-executor={entry.spec.availability === 'runnable' && entry.spec.group === 'finish' && !hasNodeExecutor(entry.kind) ? 'true' : undefined}
                        title={entry.spec.availability === 'runnable' && entry.spec.group === 'finish' && !hasNodeExecutor(entry.kind)
                          ? t('canvasNoExecutorHint')
                          : entry.spec.reasonKey === undefined ? t('canvasDragHint') : t(entry.spec.reasonKey as WorkbenchLocaleKey)}
                        onDragStart={event => {
                          event.dataTransfer.setData(NODE_DND_TYPE, entry.kind)
                          event.dataTransfer.effectAllowed = 'copy'
                        }}
                        onClick={() => { addNodeAt(entry.kind) }}
                      >
                        <Icon name={NODE_ICONS[entry.kind]} size={12} />
                        <span className="iv-wf-lib-item-name">{entry.label}</span>
                        {entry.spec.availability === 'planned'
                          ? <span className="iv-wf-lib-item-tag">{t('canvasPlannedTag')}</span>
                          : entry.spec.availability === 'runnable' && entry.spec.group === 'finish' && !hasNodeExecutor(entry.kind)
                            ? <span className="iv-wf-lib-item-tag iv-wf-lib-item-tag--noexec" data-workflow-no-executor-tag="true">
                              {t('canvasNoExecutorTag')}
                            </span>
                            : null}
                      </button>
                    ))}
                  </div>
                )
              })}
          </div>
        </aside>

        <div
          ref={flowRef}
          className="iv-flow" data-workflow-flow="true"
          data-workflow-drop-import="true" tabIndex={-1}
          onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
          onDrop={event => { importDroppedFile(event); dropNode(event) }}
          onDoubleClick={onCanvasDoubleClick}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onSelectionChange={onSelectionChange}
            onNodeDragStop={onNodeDragStop}
            onPaneClick={onPaneClick}
            // 多选修饰键两个平台都认（默认值跟 isMacOs 走，Windows 用户按 Cmd 没反应）
            multiSelectionKeyCode={['Meta', 'Control']}
            selectionOnDrag
            snapToGrid
            snapGrid={[12, 12]}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={18} />
            {nodes.length >= 6 ? (
              <MiniMap
                pannable zoomable
                className="iv-flow-minimap"
                style={{ width: 148, height: 92 }}
                nodeColor={node => (selectedIds.includes(node.id) ? 'var(--iv-acc)' : 'var(--iv-tx3)')}
                nodeStrokeWidth={0}
                maskColor="color-mix(in srgb, var(--iv-panel) 70%, transparent)"
              />
            ) : null}
          </ReactFlow>
          <div className="iv-flow-zoombadge" data-workflow-zoom={String(Math.round(zoom * 100))}>
            {Math.round(zoom * 100)}%
          </div>

          {nodes.length === 0 && !onboardingDismissed
            ? (
              <CanvasOnboarding
                t={t}
                templates={onboardingTemplates}
                onPick={id => { applyTemplate(id) }}
                onBlank={() => { setOnboardingDismissed(true) }}
                onImport={() => { workflowFileRef.current?.click() }}
              />
            )
            : null}
          {nodes.length === 0 && onboardingDismissed
            ? <p className="iv-flow-hint" data-workflow-empty-hint="true">{t('canvasEmpty')}</p>
            : null}

          {/* 选中态动作条：点选/框选后浮在画布顶上，不占固定高度 */}
          <div className="iv-wf-selectbar" data-workflow-selection-bar="true" data-empty={selectedIds.length === 0 ? 'true' : 'false'}>
            <span className="iv-wf-selectbar-count">
              {selectedIds.length} {t('canvasSelected')}
            </span>
            <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="copy"
              aria-label={t('canvasCopy')} title={`${t('canvasCopy')}（⌘C）`}
              disabled={selectedIds.length === 0} onClick={copySelected}>
              <Icon name="copy" size={11} />{t('canvasCopy')}
            </button>
            <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="paste"
              aria-label={t('canvasPaste')} title={`${t('canvasPaste')}（⌘V）`} onClick={pasteClipboard}>
              <Icon name="clipboard" size={11} />{t('canvasPaste')}
            </button>
            <button type="button" className="iv-btn iv-btn--sm" data-workflow-action="delete-node"
              aria-label={t('canvasDeleteSelected')} title={`${t('canvasDeleteSelected')}（Delete）`}
              disabled={selectedIds.length === 0} onClick={deleteSelected}>
              <Icon name="trash" size={11} />{t('canvasDeleteSelected')}{selectedIds.length > 1 ? ` · ${selectedIds.length}` : ''}
            </button>
            {run?.onRunNode === undefined || selectedNodes.length !== 1
              ? null
              : (
                <button
                  type="button"
                  className="iv-btn iv-btn--sm"
                  data-workflow-action="run-node"
                  aria-label={t('canvasRunNode')}
                  title={t('canvasRunNode')}
                  disabled={runBusy}
                  onClick={() => { run.onRunNode?.(selectedNodes[0]!.id) }}
                >
                  <Icon name="play" size={11} />{t('canvasRunNodeShort')}
                </button>
              )}
          </div>

          {/* 运行进度：一条细线，不抢画布高度 */}
          {run !== undefined && run.latest?.status === 'running'
            ? (
              <div className="iv-wf-progress" data-workflow-progress={String(progressPercent)} role="progressbar"
                aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${progressPercent}%` }} />
              </div>
            )
            : null}

          {/* 参数检视器：选中即浮在画布右上，画布不因选中而变矮 */}
          {selectedNodes.length === 0
            ? null
            : (
              <aside className="iv-inspector iv-wf-inspector" ref={inspectorRef} tabIndex={-1}
                role="complementary" aria-label={t('canvasParams')}
                data-workflow-inspector={selectedNodes[0]!.id} data-workflow-inspector-open="true">
                <div className="iv-inspector-head">
                  <Icon name={NODE_ICONS[selectedNodes[0]!.data.kind]} size={13} />
                  <span className="iv-wf-inspector-title">{t(nodeSpec(selectedNodes[0]!.data.kind).labelKey as WorkbenchLocaleKey)}</span>
                  {selectedNodes.length > 1
                    ? <span className="iv-meta">{t('canvasSelected')} · {selectedNodes.length}</span>
                    : null}
                  <button type="button" className="iv-wf-inspector-close"
                    data-workflow-inspector-close="true"
                    aria-label={t('canvasCloseInspector')} title={t('canvasCloseInspector')}
                    onClick={closeInspector}>
                    <Icon name="x" size={11} />
                  </button>
                </div>
                {nodeSpec(selectedNodes[0]!.data.kind).availability !== 'runnable'
                  ? (
                    <span className="iv-meta" data-workflow-planned-note="true" style={{ color: 'var(--iv-warn)' }}>
                      <Icon name="sparkles" size={12} /> {t(nodeSpec(selectedNodes[0]!.data.kind).reasonKey as WorkbenchLocaleKey)}
                    </span>
                  )
                  : nodeSpec(selectedNodes[0]!.data.kind).group === 'finish' && !hasNodeExecutor(selectedNodes[0]!.data.kind)
                    ? (
                      <span className="iv-meta" data-workflow-no-executor-note="true" style={{ color: 'var(--iv-warn)' }}>
                        <Icon name="alert" size={12} /> {t('canvasNoExecutorHint')}
                      </span>
                    )
                    : null}
                {selectedNodes[0]!.data.outputPath === undefined
                  ? null
                  : (
                    <button type="button" className="iv-wf-inspector-output" data-workflow-inspector-output="true"
                      onClick={() => {
                        const path = selectedNodes[0]!.data.outputPath
                        if (path !== undefined) onPreview?.(path, selectedNodes[0]!.data.outputKind ?? 'image')
                      }}>
                      <Icon name="eye" size={11} />{t('canvasOutputPreview')}
                    </button>
                  )}
                {nodeSpec(selectedNodes[0]!.data.kind).params.length === 0
                  ? <span className="iv-meta">{t('canvasNoParams')}</span>
                  : nodeSpec(selectedNodes[0]!.data.kind).params.map(field => (
                    <label key={field.id} className="iv-field">
                      <span>{t(field.labelKey as WorkbenchLocaleKey)}</span>
                      {field.id === 'model' && api !== undefined
                        ? (
                          <ModelPicker
                            api={api}
                            t={t}
                            mediaMode={selectedNodes[0]!.data.kind === 'video-generate' ? 'video' : 'image'}
                            value={String(selectedNodes[0]!.data.params.model ?? '')}
                            onChange={model => { updateParam(selectedNodes[0]!.id, field.id, model) }}
                            selectAttrs={{ 'data-workflow-param': field.id }}
                          />
                        )
                        : field.type === 'boolean'
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
              </aside>
            )}

          {/* 双击空白处的快速添加：输入名字回车即落在光标位置 */}
          {quickAdd === undefined
            ? null
            : (
              <div className="iv-wf-quick" data-workflow-quick-add="true"
                style={{ left: quickAdd.left, top: quickAdd.top }}>
                <input
                  autoFocus
                  type="text"
                  className="iv-input"
                  data-workflow-quick-input="true"
                  placeholder={t('canvasQuickAddHint')}
                  aria-label={t('canvasQuickAdd')}
                  value={quickQuery}
                  onChange={event => { setQuickQuery(event.target.value) }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      const first = quickMatches[0]
                      if (first !== undefined) {
                        addNodeAt(first.kind, quickAdd.position)
                        setQuickAdd(undefined)
                        setQuickQuery('')
                      }
                    }
                  }}
                />
                <div className="iv-wf-quick-list" role="listbox">
                  {quickMatches.slice(0, 7).map(entry => (
                    <button
                      key={entry.kind}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="iv-wf-quick-item"
                      data-workflow-quick-item={entry.kind}
                      onClick={() => {
                        addNodeAt(entry.kind, quickAdd.position)
                        setQuickAdd(undefined)
                        setQuickQuery('')
                      }}
                    >
                      <Icon name={NODE_ICONS[entry.kind]} size={11} />
                      <span>{entry.label}</span>
                    </button>
                  ))}
                  {quickMatches.length === 0
                    ? <span className="iv-meta">{t('canvasLibraryEmpty')}</span>
                    : null}
                </div>
              </div>
            )}

          {error === undefined ? null : <p className="iv-notice iv-notice--error" role="status">{error}</p>}
        </div>
      </div>

      {/* 状态条：节点/连线、校验、运行状态一排放定，替代原来散在画布下方的几行说明 */}
      <div className="iv-wf-status" data-workflow-status="true">
        <span className="iv-wf-status-count" data-workflow-count="true">
          {nodes.length} {t('canvasNodesCount')} · {edges.length} {t('canvasEdgesCount')}
        </span>
        {nodes.length === 0
          ? <span className="iv-wf-status-flag" data-workflow-status-validation="empty">{t('canvasStatusEmpty')}</span>
          : (() => {
            // `F10`：planned 节点是**预期状态**，不是错误（设计文档 D5：胶囊用 `--warn` 不用 `--danger`）。
            // 以前只要有 planned 节点就把整条校验染红，与工具条那颗 warn 胶囊自相矛盾。
            const blockers = validation.issues.filter(issue => issue.code !== 'not-runnable')
            const planned = validation.issues.length - blockers.length
            const state = blockers.length > 0 ? 'issues' : planned > 0 ? 'planned' : 'ok'
            const flagClass = state === 'issues'
              ? ' iv-wf-status-flag--err'
              : state === 'planned' ? ' iv-wf-status-flag--warn' : ' iv-wf-status-flag--ok'
            return (
              <span
                className={`iv-wf-status-flag${flagClass}`}
                data-workflow-status-validation={state}
                data-workflow-status-blockers={blockers.length}
                data-workflow-status-planned={planned}
                title={state === 'planned' ? t('canvasStatusPlannedOnly') : undefined}
              >
                <Icon name={state === 'ok' ? 'check' : state === 'planned' ? 'sparkles' : 'alert'} size={11} />
                {state === 'ok' ? t('validationOk') : `${blockers.length > 0 ? blockers.length : planned}`}
              </span>
            )
          })()}
        {run?.latest === undefined
          ? <span className="iv-wf-status-run">{t('runNone')}</span>
          : (
            <span className={`${runChipClass(run.latest.status)} iv-wf-status-run`} data-workflow-status-run={run.latest.status}>
              <i className="iv-dot" aria-hidden="true" />
              {t(runStatusKey(run.latest.status))}
              {' · '}
              {run.latest.nodeRuns.filter(node => node.status === 'succeeded').length}/{run.latest.nodeRuns.length}
            </span>
          )}
        <span className="iv-wf-status-note" title={t('canvasAutoSave')}>{t('canvasAutoSave')}</span>
      </div>

      {/* 整图替换确认：图非空时先问一次，避免「点一下画了半小时的图就没了」 */}
      {pendingReplace === undefined
        ? null
        : (
          <div className="iv-help-mask" data-workflow-replace-confirm="true">
            <div className="iv-help" ref={replacePanelRef} tabIndex={-1} role="dialog" aria-modal="true"
              aria-label={t('canvasReplaceTitle')}>
              <h3 className="iv-help-title">{t('canvasReplaceTitle')}</h3>
              <p className="iv-help-body">{pendingReplace.label}</p>
              <p className="iv-meta">{t('canvasReplaceBody')}</p>
              <div className="iv-row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="iv-btn iv-btn--ghost"
                  data-workflow-replace-cancel="true"
                  onClick={() => { setPendingReplace(undefined) }}>
                  {t('canvasReplaceCancel')}
                </button>
                <button type="button" className="iv-btn iv-btn--acc"
                  data-workflow-replace-ok="true"
                  onClick={() => {
                    const pending = pendingReplace
                    setPendingReplace(undefined)
                    pending?.run()
                  }}>
                  {t('canvasReplaceConfirm')}
                </button>
              </div>
            </div>
          </div>
        )}

      <div className="iv-worklog" id="iv-workflow-log" data-workflow-log="true"
        data-workflow-log-open={logOpen ? 'true' : 'false'}>
        <button type="button" className="iv-worklog-head" data-workflow-log-head="true"
          aria-expanded={logOpen} aria-controls="iv-workflow-log-body"
          onClick={() => { setLogOpen(open => !open) }}>
          <Icon name="chevron" size={12} className="iv-worklog-caret" />
          <strong>{t('canvasLogs')}</strong>
          {validation.ok
            ? (
              <span className="iv-chip iv-chip--ok" data-workflow-log-validation="ok">
                <Icon name="check" size={11} />{t('validationOk')}
              </span>
            )
            : (
              <span className="iv-chip iv-chip--err" data-workflow-log-validation={String(validation.issues.length)}>
                <Icon name="alert" size={11} />{validation.issues.length}
              </span>
            )}
          {run === undefined
            ? null
            : run.latest === undefined
              ? <span className="iv-meta">{t('runNone')}</span>
              : (
                <span className={runChipClass(run.latest.status)}>
                  <i className="iv-dot" aria-hidden="true" />
                  {t(runStatusKey(run.latest.status))}
                  {' · '}
                  {run.latest.nodeRuns.filter(node => node.status === 'succeeded').length}/{run.latest.nodeRuns.length}
                </span>
              )}
        </button>
        <div className="iv-worklog-body" id="iv-workflow-log-body" hidden={!logOpen}>
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** 对外画布组件：套 `ReactFlowProvider` 并注入官方样式 + 设计系统样式。 */
export function WorkflowCanvas(props: WorkflowCanvasProps): JSX.Element {
  useCanvasStyle()
  useWorkbenchStyle()
  useModernTheme()
  return (
    <ReactFlowProvider>
      <CanvasSurface {...props} />
    </ReactFlowProvider>
  )
}
