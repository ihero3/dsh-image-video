/**
 * 工作流的类型与节点目录（画布半边与宿主半边共用）。
 *
 * 边界按 `R-FLW-1`：画布只负责**交互**（位置、连线、选择、缩放平移、适配窗口），
 * 不承担执行、参数校验、调度与持久化——那些在宿主侧（`T4-3`/`T4-4`/`T4-6`）。
 * 这里只放"节点长什么样"的静态事实，让两个半边对同一套目录有单一事实源。
 *
 * 节点集按 `R-FLW-2`：V1 十个节点 + `subtitle`/`render` 本方案实现，
 * `lip-sync`/`face-swap`/`voice-synthesize` 标记为 `planned`（列表里可见、不可运行，
 * 并给出原因），对应阶段 3 的"预留能力边界"要求。
 */

/** 节点可运行性。`planned` 的节点在画布上可见但不可加入。 */
export type NodeAvailability = 'runnable' | 'planned'

/** 端口数据种类（用于后续宿主的类型匹配校验，画布只用来判断能否连线）。 */
export type PortKind = 'any' | 'text' | 'media' | 'resource' | 'asset'

/** 节点参数取值。 */
export type NodeParamValue = string | number | boolean

/** 一个节点参数的编辑形态。 */
export interface NodeParamField {
  readonly id: string
  readonly labelKey: string
  readonly type: 'text' | 'textarea' | 'number' | 'select' | 'boolean'
  readonly default: NodeParamValue
  readonly options?: readonly { readonly value: string; readonly labelKey: string }[]
  /** 运行前必须有值（空串/`false` 也算缺）——`T4-3` 的必填校验。 */
  readonly required?: boolean
}

/** 目录里的一个节点种类。 */
export interface NodeKindSpec {
  readonly kind: WorkflowNodeKind
  readonly labelKey: string
  readonly availability: NodeAvailability
  /** `planned` 的不可运行原因（locale key）。 */
  readonly reasonKey?: string
  readonly input: PortKind
  readonly output: PortKind
  readonly params: readonly NodeParamField[]
}

/** `R-FLW-2` 的节点集（含本方案实现与 planned）。 */
export type WorkflowNodeKind =
  | 'creative-input' | 'script' | 'storyboard' | 'asset-reference' | 'resource-reference'
  | 'motion-track' | 'image-generate' | 'video-generate' | 'preview' | 'publish-asset'
  | 'subtitle' | 'render'
  | 'lip-sync' | 'face-swap' | 'voice-synthesize'

/** 画布上的一个节点。 */
export interface WorkflowNode {
  readonly id: string
  readonly kind: WorkflowNodeKind
  readonly position: { readonly x: number; readonly y: number }
  readonly params: Readonly<Record<string, NodeParamValue>>
}

/** 画布上的一条连线。 */
export interface WorkflowEdge {
  readonly id: string
  readonly source: string
  readonly target: string
}

/**
 * 工作流文档：画布维度的唯一事实源（`T4-1`）。
 *
 * 注意**没有**选择状态字段——UI 的瞬时选择按 `R-FLW-1` 不入库。
 */
export interface WorkflowRecord {
  readonly schemaVersion: 1
  readonly id: string
  readonly projectId: string
  readonly name: string
  readonly nodes: readonly WorkflowNode[]
  readonly edges: readonly WorkflowEdge[]
  readonly createdAt: string
  readonly updatedAt: string
}

// 模型名**不写进代码**：默认模型由宿主配置决定（`T2-11`），画布只留空并提示。
const RATIO_OPTIONS = [
  { value: '1:1', labelKey: 'ratioSquare' },
  { value: '3:4', labelKey: 'ratioPortrait' },
  { value: '16:9', labelKey: 'ratioLandscape' },
  { value: '9:16', labelKey: 'ratioVertical' },
] as const

const VIDEO_RATIO_OPTIONS = [
  { value: '16:9', labelKey: 'ratioLandscape' },
  { value: '9:16', labelKey: 'ratioVertical' },
  { value: '1:1', labelKey: 'ratioSquare' },
] as const

const RESOLUTION_OPTIONS = [
  { value: '480P', labelKey: 'resolution480' },
  { value: '720P', labelKey: 'resolution720' },
  { value: '1080P', labelKey: 'resolution1080' },
] as const

/**
 * 节点目录。顺序即画布左侧节点库的展示顺序（先能用的，后 planned）。
 *
 * `video-generate` 按 `D7` 显式承载参考视频与 `compare`（不另立 `video-edit` 节点），
 * 参数语义与对话里的 `generate_video` 对齐（`R-FLW-4`）。
 */
export const NODE_CATALOG: readonly NodeKindSpec[] = [
  {
    kind: 'creative-input', labelKey: 'nodeCreativeInput', availability: 'runnable', input: 'any', output: 'text',
    params: [{ id: 'brief', labelKey: 'paramBrief', type: 'textarea', default: '', required: true }],
  },
  {
    kind: 'script', labelKey: 'nodeScript', availability: 'runnable', input: 'text', output: 'text',
    params: [{ id: 'text', labelKey: 'paramScript', type: 'textarea', default: '', required: true }],
  },
  {
    kind: 'storyboard', labelKey: 'nodeStoryboard', availability: 'runnable', input: 'text', output: 'media',
    params: [
      { id: 'shots', labelKey: 'paramShots', type: 'number', default: 4, required: true },
      { id: 'note', labelKey: 'paramNote', type: 'text', default: '' },
    ],
  },
  {
    kind: 'asset-reference', labelKey: 'nodeAssetReference', availability: 'runnable', input: 'media', output: 'asset',
    params: [{ id: 'assetId', labelKey: 'paramAsset', type: 'text', default: '', required: true }],
  },
  {
    kind: 'resource-reference', labelKey: 'nodeResourceReference', availability: 'runnable', input: 'any', output: 'resource',
    params: [{ id: 'resourceId', labelKey: 'paramResource', type: 'text', default: '', required: true }],
  },
  {
    kind: 'motion-track', labelKey: 'nodeMotionTrack', availability: 'runnable', input: 'media', output: 'media',
    params: [{ id: 'note', labelKey: 'paramNote', type: 'text', default: '' }],
  },
  {
    kind: 'image-generate', labelKey: 'nodeImageGenerate', availability: 'runnable', input: 'text', output: 'media',
    params: [
      { id: 'model', labelKey: 'paramModel', type: 'text', default: '' },
      { id: 'prompt', labelKey: 'paramPrompt', type: 'textarea', default: '', required: true },
      { id: 'ratio', labelKey: 'paramRatio', type: 'select', default: '3:4', options: RATIO_OPTIONS },
    ],
  },
  {
    kind: 'video-generate', labelKey: 'nodeVideoGenerate', availability: 'runnable', input: 'media', output: 'media',
    params: [
      { id: 'model', labelKey: 'paramModel', type: 'text', default: '' },
      { id: 'prompt', labelKey: 'paramPrompt', type: 'textarea', default: '', required: true },
      { id: 'ratio', labelKey: 'paramRatio', type: 'select', default: '16:9', options: VIDEO_RATIO_OPTIONS },
      { id: 'duration', labelKey: 'paramDuration', type: 'number', default: 5 },
      { id: 'resolution', labelKey: 'paramResolution', type: 'select', default: '720P', options: RESOLUTION_OPTIONS },
      { id: 'referenceVideo', labelKey: 'paramReferenceVideo', type: 'text', default: '' },
      { id: 'compare', labelKey: 'paramCompare', type: 'boolean', default: false },
    ],
  },
  {
    kind: 'preview', labelKey: 'nodePreview', availability: 'runnable', input: 'media', output: 'media',
    params: [],
  },
  {
    kind: 'publish-asset', labelKey: 'nodePublishAsset', availability: 'runnable', input: 'media', output: 'asset',
    params: [{ id: 'name', labelKey: 'paramAssetName', type: 'text', default: '' }],
  },
  {
    kind: 'subtitle', labelKey: 'nodeSubtitle', availability: 'runnable', input: 'media', output: 'media',
    params: [{ id: 'text', labelKey: 'paramScript', type: 'textarea', default: '', required: true }],
  },
  {
    kind: 'render', labelKey: 'nodeRender', availability: 'runnable', input: 'media', output: 'media',
    params: [{ id: 'note', labelKey: 'paramNote', type: 'text', default: '' }],
  },
  {
    kind: 'lip-sync', labelKey: 'nodeLipSync', availability: 'planned', reasonKey: 'plannedLipSync',
    input: 'media', output: 'media', params: [],
  },
  {
    kind: 'face-swap', labelKey: 'nodeFaceSwap', availability: 'planned', reasonKey: 'plannedFaceSwap',
    input: 'media', output: 'media', params: [],
  },
  {
    kind: 'voice-synthesize', labelKey: 'nodeVoiceSynthesize', availability: 'planned', reasonKey: 'plannedVoice',
    input: 'text', output: 'media', params: [],
  },
]

const BY_KIND = new Map(NODE_CATALOG.map(spec => [spec.kind, spec]))

/** 画布规模上限：挡住畸形载荷，也给前端一个明确的边界。 */
export const MAX_WORKFLOW_NODES = 200
/** 连线数量上限。 */
export const MAX_WORKFLOW_EDGES = 400

/**
 * 校验一个节点种类。
 * @param value - 原始值。
 * @returns 目录里的种类。
 * @throws {Error} 当它不是已知种类。
 */
export function normalizeNodeKind(value: unknown): WorkflowNodeKind {
  if (typeof value !== 'string' || !BY_KIND.has(value as WorkflowNodeKind)) {
    throw new Error(`unknown workflow node kind: ${String(value)}`)
  }
  return value as WorkflowNodeKind
}

/**
 * 校验画布的节点与连线。
 *
 * 只做"结构可信"这一层（种类存在、坐标是有限数、连线两端都在图里、不含自环、
 * 不超规模）——语义校验（必填参数、端口类型、环检测）属于 `T4-3`，跑在图执行前。
 * @param nodes - 待校验节点。
 * @param edges - 待校验连线。
 * @returns 归一化后的节点与连线。
 * @throws {Error} 结构不合法时。
 */
export function normalizeGraph(
  nodes: unknown,
  edges: unknown,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) throw new Error('workflow nodes/edges must be arrays')
  if (nodes.length > MAX_WORKFLOW_NODES) throw new Error(`workflow has more than ${MAX_WORKFLOW_NODES} nodes`)
  if (edges.length > MAX_WORKFLOW_EDGES) throw new Error(`workflow has more than ${MAX_WORKFLOW_EDGES} edges`)

  const seen = new Set<string>()
  const cleanNodes = nodes.map(raw => {
    if (typeof raw !== 'object' || raw === null) throw new Error('workflow node must be an object')
    const node = raw as Record<string, unknown>
    const id = typeof node.id === 'string' && node.id !== '' ? node.id : undefined
    if (id === undefined) throw new Error('workflow node needs a non-empty id')
    if (seen.has(id)) throw new Error(`duplicate workflow node id: ${id}`)
    seen.add(id)
    const kind = normalizeNodeKind(node.kind)
    const position = (typeof node.position === 'object' && node.position !== null ? node.position : {}) as Record<string, unknown>
    const x = Number(position.x)
    const y = Number(position.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`workflow node ${id} needs finite coordinates`)
    const params = (typeof node.params === 'object' && node.params !== null ? node.params : {}) as Record<string, unknown>
    const cleanParams: Record<string, NodeParamValue> = {}
    for (const field of nodeSpec(kind).params) {
      const value = params[field.id]
      if (value === undefined || value === null) { cleanParams[field.id] = field.default; continue }
      if (typeof value === 'string' || typeof value === 'boolean') { cleanParams[field.id] = value; continue }
      if (typeof value === 'number' && Number.isFinite(value)) { cleanParams[field.id] = value; continue }
      throw new Error(`workflow node ${id} parameter ${field.id} has an unsupported value`)
    }
    return { id, kind, position: { x: Math.round(x), y: Math.round(y) }, params: cleanParams }
  })

  const cleanEdges = edges.map(raw => {
    if (typeof raw !== 'object' || raw === null) throw new Error('workflow edge must be an object')
    const edge = raw as Record<string, unknown>
    const source = typeof edge.source === 'string' ? edge.source : ''
    const target = typeof edge.target === 'string' ? edge.target : ''
    if (!seen.has(source) || !seen.has(target)) throw new Error('workflow edge must connect two nodes in the graph')
    if (source === target) throw new Error(`workflow edge ${source} loops onto itself`)
    const id = typeof edge.id === 'string' && edge.id !== '' ? edge.id : `${source}->${target}`
    return { id, source, target }
  })
  return { nodes: cleanNodes, edges: cleanEdges }
}

/** 取一个节点种类的事实。 */
export function nodeSpec(kind: WorkflowNodeKind): NodeKindSpec {
  const spec = BY_KIND.get(kind)
  if (spec === undefined) throw new Error(`unknown workflow node kind: ${kind}`)
  return spec
}

/** 该种类当前能否加入画布。 */
export function isRunnable(kind: WorkflowNodeKind): boolean {
  return nodeSpec(kind).availability === 'runnable'
}

/** 新节点的默认参数（取自目录）。 */
export function defaultParams(kind: WorkflowNodeKind): Record<string, NodeParamValue> {
  const spec = nodeSpec(kind)
  return Object.fromEntries(spec.params.map(field => [field.id, field.default]))
}

/** 一次运行里单个节点的记录。 */
export interface WorkflowRunNodeRecord {
  readonly nodeId: string
  readonly kind: WorkflowNodeKind
  readonly status: 'succeeded' | 'failed' | 'skipped' | 'cancelled'
  readonly startedAt: string
  readonly finishedAt?: string
  readonly outputPath?: string
  readonly bytes?: number
  readonly error?: string
}

/** 一次运行的记录（含图快照，`R-FLW-6`）。 */
export interface WorkflowRunRecord {
  readonly schemaVersion: 1
  readonly id: string
  readonly workflowId: string
  readonly projectId: string
  readonly status: 'running' | 'succeeded' | 'failed' | 'cancelled'
  /** 图快照：后续改图不影响已发生的运行记录 */
  readonly graph: { readonly nodes: readonly WorkflowNode[]; readonly edges: readonly WorkflowEdge[] }
  readonly nodeRuns: readonly WorkflowRunNodeRecord[]
  readonly startedAt: string
  readonly finishedAt?: string
  readonly error?: string
}

/** 端口兼容表：目标输入能接受哪些来源输出。`any` 全收；`asset` 可当 `media` 用。 */
const PORT_ACCEPTS: Record<PortKind, readonly PortKind[]> = {
  any: ['any', 'text', 'media', 'resource', 'asset'],
  text: ['any', 'text'],
  media: ['any', 'media', 'asset'],
  resource: ['any', 'resource'],
  asset: ['any', 'asset', 'media'],
}

/** 一条图校验问题（`T4-3`）。 */
export interface WorkflowIssue {
  readonly code: 'missing-required' | 'port-mismatch' | 'self-loop' | 'dangling-edge' | 'cycle' | 'not-runnable'
  readonly message: string
  readonly nodeId?: string
  readonly edgeId?: string
}

/** 图校验结果。 */
export interface WorkflowValidation {
  readonly ok: boolean
  readonly issues: readonly WorkflowIssue[]
}

/**
 * 校验整张图：必填参数、端口类型、自环、悬空连线、环、planned 节点不可运行。
 *
 * 纯函数、不碰 IO——画布用它做即时反馈，宿主在运行前用同一份逻辑拒绝（`R-FLW-3`）。
 * @param nodes - 图里的节点。
 * @param edges - 图里的连线。
 * @returns 是否可运行，以及全部问题。
 */
export function validateWorkflow(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
): WorkflowValidation {
  const issues: WorkflowIssue[] = []
  const byId = new Map(nodes.map(node => [node.id, node]))

  for (const node of nodes) {
    const spec = nodeSpec(node.kind)
    if (spec.availability !== 'runnable') {
      issues.push({
        code: 'not-runnable', nodeId: node.id,
        message: `${node.kind} is planned and cannot run (${spec.reasonKey ?? 'no reason recorded'})`,
      })
    }
    for (const field of spec.params) {
      if (field.required !== true) continue
      const value = node.params[field.id]
      if (value === undefined || value === '' || value === false) {
        issues.push({ code: 'missing-required', nodeId: node.id, message: `${node.kind}.${field.id} is required` })
      }
    }
  }

  for (const edge of edges) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (source === undefined || target === undefined) {
      issues.push({ code: 'dangling-edge', edgeId: edge.id, message: `edge ${edge.id} references a missing node` })
      continue
    }
    if (edge.source === edge.target) {
      issues.push({ code: 'self-loop', edgeId: edge.id, message: `edge ${edge.id} loops onto itself` })
      continue
    }
    const from = nodeSpec(source.kind).output
    const to = nodeSpec(target.kind).input
    if (!PORT_ACCEPTS[to].includes(from)) {
      issues.push({
        code: 'port-mismatch', edgeId: edge.id,
        message: `${source.kind}(${from}) cannot feed ${target.kind}(${to})`,
      })
    }
  }

  // 环检测：三色 DFS；遇到灰节点即回边，把回路写进消息
  const colour = new Map<string, 'white' | 'grey' | 'black'>()
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, [])
    outgoing.get(edge.source)?.push(edge.target)
  }
  const stack: string[] = []
  const walk = (id: string): void => {
    colour.set(id, 'grey')
    stack.push(id)
    for (const next of outgoing.get(id) ?? []) {
      const state = colour.get(next) ?? 'white'
      if (state === 'grey') {
        issues.push({ code: 'cycle', nodeId: next, message: `cycle: ${[...stack.slice(stack.indexOf(next)), next].join(' -> ')}` })
        continue
      }
      if (state === 'white') walk(next)
    }
    stack.pop()
    colour.set(id, 'black')
  }
  for (const node of nodes) if ((colour.get(node.id) ?? 'white') === 'white') walk(node.id)

  return { ok: issues.length === 0, issues }
}

/** 目录里可用 / 预留的数量，供 UI 显示与测试断言。 */
export function catalogSummary(): { runnable: number; planned: number } {
  return {
    runnable: NODE_CATALOG.filter(spec => spec.availability === 'runnable').length,
    planned: NODE_CATALOG.filter(spec => spec.availability === 'planned').length,
  }
}
