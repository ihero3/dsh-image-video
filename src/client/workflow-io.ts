/**
 * 工作流画布的 JSON 导入 / 导出。
 *
 * 借鉴 LiblibAI / ComfyUI 的通行做法（工作流以 JSON 交换、导入先做结构校验、
 * 不支持的节点明确报错而不是静默丢节点），但只认本项目自己的图格式：
 * 上游是 `workflow.ts` 的 `normalizeGraph`，节点种类白名单、坐标、连线端点、
 * 参数类型都复用同一套规则，避免画布与宿主对同一份文件有不同解释。
 *
 * ComfyUI 原生工作流（`nodes` + `links` + `widgets_values` / `type`）不是本项目的
 * 节点目录，导入时按"未知节点种类"拒绝，不尝试猜测映射——猜错比拒绝更糟。
 *
 * @module dsh-image-video/client/workflow-io
 */
import { normalizeGraph, type WorkflowEdge, type WorkflowNode, type WorkflowRecord } from '../workbench/workflow.ts'
import { adaptExternalWorkflow, detectExternalFormat, type AdapterReport } from '../workbench/workflow-adapters.ts'

/** 文件标识与版本（写进导出文件，导入时校验）。 */
export const WORKFLOW_FILE_FORMAT = 'dsh-image-video-workflow'
export const WORKFLOW_FILE_VERSION = 1

/** 导入解析结果。 */
export interface WorkflowImportFile {
  readonly name?: string
  readonly nodes: readonly WorkflowNode[]
  readonly edges: readonly WorkflowEdge[]
  /** 外部格式适配报告；原生格式为 undefined。 */
  readonly report?: AdapterReport
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 导出：当前图 → 可直接下载的 JSON 文本。
 * @param record - 画布事实源。
 * @returns 带格式标识的 JSON（末尾换行）。
 */
export function serializeWorkflow(record: WorkflowRecord): string {
  const file = {
    format: WORKFLOW_FILE_FORMAT,
    version: WORKFLOW_FILE_VERSION,
    name: record.name,
    exportedAt: new Date().toISOString(),
    nodes: record.nodes,
    edges: record.edges,
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

/**
 * 导入：JSON 文本 → 图（结构校验后可直接交给画布）。
 * @param text - 文件原文。
 * @returns 节点 / 连线 / 可选名称。
 * @throws {Error} JSON 非法、格式不符、节点或连线结构不合法时。
 */
export function parseWorkflowFile(text: string): WorkflowImportFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('不是合法的 JSON 文件')
  }
  if (!isObject(raw)) throw new Error('工作流文件必须是 JSON 对象')

  // 自动识别外部格式：ComfyUI UI/LiblibAI（nodes+links）与 ComfyUI API（class_type）。
  const detected = detectExternalFormat(raw)
  if (detected !== 'native') return adaptExternalWorkflow(raw)

  const version = raw['version']
  if (version !== undefined && version !== WORKFLOW_FILE_VERSION) {
    throw new Error(`不支持的工作流文件版本：${String(version)}`)
  }
  const rawNodes = raw['nodes']
  // ComfyUI UI 格式用 links 命名；字段名兼容，节点结构仍走白名单校验。
  const rawEdges = raw['edges'] ?? raw['links']
  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) {
    throw new Error('工作流文件需要 nodes 与 edges 数组')
  }
  const graph = normalizeGraph(rawNodes, rawEdges)
  const rawName = raw['name']
  const name = typeof rawName === 'string' && rawName.trim() !== '' ? rawName.trim().slice(0, 80) : undefined
  return { ...name === undefined ? {} : { name }, ...graph }
}

/** 浏览器下载一个 JSON 文件（仅客户端调用）。 */
export function downloadWorkflowFile(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
