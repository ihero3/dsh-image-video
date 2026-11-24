/**
 * 外部工作流适配层：ComfyUI / LiblibAI 导出的 JSON → 本项目工作流图。
 *
 * 已核实的两种真实格式：
 * - UI / 保存格式（`nodes` + `links`）：LiblibAI 导出的 .json 与本地 ComfyUI 保存文件
 *   底层同构，节点有 `type` / `pos` / `widgets_values` / `inputs`，连线是
 *   `[linkId, originId, originSlot, targetId, targetSlot, dataType]` 数组。
 * - API 格式（节点 id → `{class_type, inputs}`）：`inputs` 里连线写作 `["上游id", 输出槽]`。
 *
 * 设计原则：
 * 1. 能映射的常见基础节点映射到内置节点，并把映射情况写进 report；
 * 2. 映射不了的节点**不丢弃**，保留为 `external` 节点，原始 JSON 存进 `config` 参数，
 *    既能在画布上看见，也能导回外部格式时不丢数据；
 * 3. 连线两端都在图里才保留；最后统一过 `normalizeGraph` 做结构校验。
 *
 * 本层只做结构转换，不伪装成"能执行 ComfyUI 工作流"——external 节点不可运行。
 *
 * @module dsh-image-video/workbench/workflow-adapters
 */
import {
  defaultParams, normalizeGraph,
  type NodeParamValue, type WorkflowEdge, type WorkflowNode, type WorkflowNodeKind,
} from './workflow.ts'
/** 与 client/workflow-io.ts 的常量保持一致（这里不反向依赖客户端模块）。 */
const WORKFLOW_FILE_FORMAT = 'dsh-image-video-workflow'

/** 识别到的外部格式。native 由调用方交给 workflow-io 处理，不在本层解析。 */
export type ExternalWorkflowFormat = 'native' | 'comfy-ui' | 'comfy-api' | 'package'

/** 一次适配的报告：映射了什么、保留了什么、有哪些提醒。 */
export interface AdapterReport {
  readonly format: ExternalWorkflowFormat
  /** 成功映射到内置节点的 class_type（去重，保序）。 */
  readonly mapped: readonly string[]
  /** 保留为 external 节点的 class_type（去重，保序）。 */
  readonly preserved: readonly string[]
  readonly warnings: readonly string[]
}

/** 适配结果：节点 / 连线 / 报告，可直接交给画布。 */
export interface AdaptedWorkflow {
  readonly name?: string
  readonly nodes: readonly WorkflowNode[]
  readonly edges: readonly WorkflowEdge[]
  readonly report: AdapterReport
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** ComfyUI 节点在 UI / API 两种格式下的统一视图。 */
interface ComfyNodeView {
  readonly id: string
  readonly classType: string
  readonly title?: string
  readonly position: { readonly x: number; readonly y: number }
  /** UI 格式是 widget 数组，API 格式是 inputs 对象；两边都保留。 */
  readonly widgets: readonly unknown[]
  readonly inputs: Record<string, unknown>
  readonly raw: unknown
}

/** 一个节点的映射结果。 */
interface NodeMapping {
  readonly kind: WorkflowNodeKind
  readonly params: Record<string, NodeParamValue>
  /** 给用户看的映射说明（写进 warnings 汇总）。 */
  readonly note: string
}

/** 提示词宽高 → 本平台比例档位（就近取，无法判断时留默认）。 */
function ratioFromSize(width: number, height: number, fallback: string): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return fallback
  const ratio = width / height
  const options: readonly { readonly value: string; readonly score: number }[] = [
    { value: '1:1', score: Math.abs(ratio - 1) },
    { value: '3:4', score: Math.abs(ratio - 0.75) },
    { value: '16:9', score: Math.abs(ratio - 16 / 9) },
    { value: '9:16', score: Math.abs(ratio - 9 / 16) },
  ]
  return options.reduce((best, candidate) => candidate.score < best.score ? candidate : best, options[0]!).value
}

/**
 * class_type → 内置节点。只映射语义明确的常见基础节点；
 * 带 ControlNet / LoRA / IPAdapter 等语义的节点一律保留为 external，
 * 因为猜错映射比不映射更糟。
 */
function mapNode(node: ComfyNodeView): NodeMapping {
  const classType = node.classType
  const prompt = asText(node.widgets[0] ?? node.inputs['text'])
  const model = asText(node.inputs['ckpt_name'] ?? node.widgets[0] ?? '')
  const width = asNumber(node.widgets[1] ?? node.inputs['width'], 0)
  const height = asNumber(node.widgets[2] ?? node.inputs['height'], 0)

  switch (classType) {
    case 'CLIPTextEncode':
    case 'TextEncodeInput':
      return { kind: 'script', params: { ...defaultParams('script'), text: prompt }, note: '文本编码 → 剧本文本' }
    case 'PrimitiveNode':
    case 'Note':
    case 'MarkdownNote':
      return { kind: 'creative-input', params: { ...defaultParams('creative-input'), brief: prompt }, note: '文本输入 → 创意输入' }
    case 'KSampler':
    case 'KSamplerAdvanced':
    case 'SamplerCustom':
      return {
        kind: 'image-generate',
        params: { ...defaultParams('image-generate'), prompt: '', model },
        note: '采样器 → 生图（提示词需自行补，上游 CLIPTextEncode 已导入为剧本节点）',
      }
    case 'EmptyLatentImage':
    case 'EmptySD3LatentImage':
      return {
        kind: 'image-generate',
        params: { ...defaultParams('image-generate'), prompt: '', ratio: ratioFromSize(width, height, '3:4') },
        note: '空潜变量 → 生图（尺寸折算为比例）',
      }
    case 'SaveImage':
    case 'PreviewImage':
    case 'SaveAnimatedWEBP':
    case 'SaveAnimatedPNG':
    case 'SaveWEBM':
      return { kind: 'preview', params: defaultParams('preview'), note: '图像/视频输出 → 预览' }
    case 'LoadImage':
    case 'LoadImageMask':
      return {
        kind: 'asset-reference',
        params: { ...defaultParams('asset-reference'), assetId: asText(node.widgets[0] ?? node.inputs['image']) },
        note: '加载图片 → 素材引用（需在素材库重新关联）',
      }
    default:
      break
  }
  // 视频类节点：只认语义明确的名字，避免把普通 loader 误判成生视频。
  if (/^(SVD|AnimateDiff|WanImageToVideo|HunyuanVideo|LTXVideo|LumaVideo|Kling|Vidu|Runway|GenerateVideo)/i.test(classType)) {
    return {
      kind: 'video-generate',
      params: { ...defaultParams('video-generate'), prompt: '', model: classType },
      note: '视频生成节点 → 生视频（提示词需自行补）',
    }
  }
  return {
    kind: 'external',
    params: { ...defaultParams('external'), classType, config: JSON.stringify(node.raw) },
    note: '无法映射，保留原始节点供查看',
  }
}

/** ComfyUI UI / API 节点 → 统一视图。 */
function uiNodes(raw: Record<string, unknown>): ComfyNodeView[] {
  const list = raw['nodes']
  return (Array.isArray(list) ? list : []).flatMap((entry, index) => {
    if (!isObject(entry)) return []
    const pos = Array.isArray(entry['pos']) ? entry['pos'] : []
    const inputs: Record<string, unknown> = {}
    if (Array.isArray(entry['inputs'])) {
      for (const input of entry['inputs']) {
        if (!isObject(input) || typeof input['name'] !== 'string') continue
        inputs[input['name']] = input['value']
      }
    }
    return [{
      id: String(entry['id'] ?? index + 1),
      classType: asText(entry['type'] ?? entry['class_type']),
      ...typeof entry['title'] === 'string' ? { title: entry['title'] } : {},
      position: { x: asNumber(pos[0], 0), y: asNumber(pos[1], index * 200) },
      widgets: Array.isArray(entry['widgets_values']) ? entry['widgets_values'] : [],
      inputs,
      raw: entry,
    }]
  })
}

function apiNodes(raw: Record<string, unknown>): ComfyNodeView[] {
  return Object.entries(raw).flatMap(([id, entry], index) => {
    if (!isObject(entry)) return []
    const meta = isObject(entry['_meta']) ? entry['_meta'] : {}
    return [{
      id,
      classType: asText(entry['class_type']),
      ...typeof meta['title'] === 'string' ? { title: meta['title'] } : {},
      // API 格式没有布局信息：按顺序铺成网格，保证画布上看得见、拖得动。
      position: { x: (index % 4) * 280, y: Math.floor(index / 4) * 200 },
      widgets: [],
      inputs: isObject(entry['inputs']) ? entry['inputs'] : {},
      raw: entry,
    }]
  })
}

/** UI 格式的 links 数组 → 边。 */
function uiEdges(raw: Record<string, unknown>, knownIds: ReadonlySet<string>): WorkflowEdge[] {
  const links = raw['links']
  if (!Array.isArray(links)) return []
  return links.flatMap((link, index) => {
    if (!Array.isArray(link) || link.length < 4) return []
    const source = String(link[1] ?? '')
    const target = String(link[3] ?? '')
    if (!knownIds.has(source) || !knownIds.has(target)) return []
    return [{
      id: `edg-comfy-${index}-${source}-${target}`,
      source, target,
      sourceHandle: 'out', targetHandle: 'in',
    }]
  })
}

/** API 格式 inputs 里的 `["上游id", 槽位]` → 边。 */
function apiEdges(nodes: readonly ComfyNodeView[], knownIds: ReadonlySet<string>): WorkflowEdge[] {
  const edges: WorkflowEdge[] = []
  for (const node of nodes) {
    for (const value of Object.values(node.inputs)) {
      if (!Array.isArray(value) || value.length === 0) continue
      const source = String(value[0] ?? '')
      if (!knownIds.has(source) || source === node.id) continue
      const duplicate = edges.some(edge => edge.source === source && edge.target === node.id)
      if (duplicate) continue
      edges.push({ id: `edg-comfy-${source}-${node.id}`, source, target: node.id, sourceHandle: 'out', targetHandle: 'in' })
    }
  }
  return edges
}

/** 识别格式：native 交给 workflow-io，其余两种由本层适配。 */
export function detectExternalFormat(raw: unknown): ExternalWorkflowFormat {
  if (!isObject(raw)) throw new Error('工作流文件必须是 JSON 对象')
  if (raw['format'] === WORKFLOW_FILE_FORMAT) return 'native'
  // 项目包 manifest.json：带 workflows 数组，导入其中第一份工作流。
  if (raw['plugin'] === 'dsh-image-video' && Array.isArray(raw['workflows'])) return 'package'
  if (typeof raw['format'] === 'string' && raw['format'] !== WORKFLOW_FILE_FORMAT) {
    throw new Error(`不支持的工作流格式：${raw['format']}`)
  }
  if (Array.isArray(raw['nodes'])) {
    // 本平台节点用 `kind`，ComfyUI 用 `type`；按节点字段区分，
    // 避免把没有 format 标识的原生文件误判成 ComfyUI。
    const first = raw['nodes'].find(entry => isObject(entry))
    if (isObject(first) && typeof first['kind'] === 'string' && typeof first['type'] !== 'string') return 'native'
    return 'comfy-ui'
  }
  const values = Object.values(raw)
  if (values.length > 0 && values.every(value => isObject(value) && typeof value['class_type'] === 'string')) {
    return 'comfy-api'
  }
  throw new Error('无法识别的工作流格式：需要 dsh 原生格式、ComfyUI UI（nodes/links）或 API（class_type）格式')
}

/**
 * 把 ComfyUI / LiblibAI 工作流适配成本项目图。
 * @param raw - 已 JSON.parse 的文件内容。
 * @throws {Error} 格式无法识别，或适配后的图结构不合法。
 */
export function adaptExternalWorkflow(raw: unknown): AdaptedWorkflow {
  const format = detectExternalFormat(raw)
  if (format === 'native') throw new Error('原生格式请走 parseWorkflowFile，不需要适配')
  if (format === 'package') {
    const source = raw as Record<string, unknown>
    const workflows = source['workflows'] as unknown[]
    const first = workflows.find(entry => isObject(entry)) as Record<string, unknown> | undefined
    if (first === undefined) throw new Error('项目包里没有可导入的工作流')
    const graph = normalizeGraph(first['nodes'], first['edges'])
    const warnings = workflows.length > 1
      ? [`项目包里有 ${workflows.length} 份工作流，已导入第一份「${asText(first['name']) || '未命名'}」`]
      : []
    return {
      ...typeof first['name'] === 'string' ? { name: asText(first['name']) } : {},
      ...graph,
      report: { format: 'package', mapped: [], preserved: [], warnings },
    }
  }
  const source = raw as Record<string, unknown>
  const views = format === 'comfy-ui' ? uiNodes(source) : apiNodes(source)
  if (views.length === 0) throw new Error('工作流里没有节点')

  const mappedSet = new Set<string>()
  const preservedSet = new Set<string>()
  const warnings: string[] = []
  const nodes: WorkflowNode[] = views.map(view => {
    const mapping = mapNode(view)
    if (mapping.kind === 'external') preservedSet.add(view.classType)
    else mappedSet.add(view.classType)
    if (mapping.note !== '无法映射，保留原始节点供查看') {
      warnings.push(`${view.classType} → ${mapping.kind}：${mapping.note}`)
    }
    return {
      id: view.id,
      kind: mapping.kind,
      position: view.position,
      params: mapping.params,
    }
  })
  const knownIds = new Set(nodes.map(node => node.id))
  const edges = format === 'comfy-ui'
    ? uiEdges(source, knownIds)
    : apiEdges(views, knownIds)

  // 统一过一遍宿主的结构校验；适配层不制造宿主不认的图。
  const graph = normalizeGraph(nodes, edges)
  const preserved = [...preservedSet]
  if (preserved.length > 0) {
    warnings.push(`保留 ${preserved.length} 类未映射节点（${preserved.slice(0, 6).join('、')}${preserved.length > 6 ? '…' : ''}），它们可查看、可导回，但本项目不运行`)
  }
  const rawName = source['name'] ?? source['id']
  return {
    ...typeof rawName === 'string' ? { name: rawName } : {},
    nodes: graph.nodes,
    edges: graph.edges,
    report: { format, mapped: [...mappedSet], preserved, warnings },
  }
}
