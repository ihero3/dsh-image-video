/**
 * 节点目录（`T4-2` + `R-FLW-2`）。
 *
 * 目录是画布与宿主共用的静态事实：V1 十个节点 + `subtitle`/`render` 本方案实现，
 * `lip-sync`/`face-swap`/`voice-synthesize` 必须是 `planned`（可见、不可运行、带原因）。
 * 模型名等部署值不得出现在这里（`T2-11`）。
 */
import { describe, expect, it } from 'vitest'
import {
  NODE_CATALOG, catalogSummary, defaultParams, isRunnable, nodeSpec, validateWorkflow,
  type NodeParamValue, type WorkflowEdge, type WorkflowNode, type WorkflowNodeKind,
} from '../src/workbench/workflow.ts'

const V1: WorkflowNodeKind[] = [
  'creative-input', 'script', 'storyboard', 'asset-reference', 'resource-reference',
  'motion-track', 'image-generate', 'video-generate', 'preview', 'publish-asset',
]

describe('node catalog', () => {
  it('keeps the R-FLW-2 split', () => {
    expect(catalogSummary()).toEqual({ runnable: 12, planned: 3 })
    for (const kind of V1) expect(isRunnable(kind)).toBe(true)
    expect(isRunnable('subtitle')).toBe(true)
    expect(isRunnable('render')).toBe(true)
    for (const kind of ['lip-sync', 'face-swap', 'voice-synthesize'] as const) {
      expect(isRunnable(kind)).toBe(false)
      expect(nodeSpec(kind).reasonKey).toBeTruthy()
    }
  })

  it('gives every runnable node at least a label and a port pair', () => {
    for (const spec of NODE_CATALOG) {
      expect(spec.labelKey.startsWith('node')).toBe(true)
      expect(spec.input).toBeTruthy()
      expect(spec.output).toBeTruthy()
      expect(spec.params.length).toBeGreaterThanOrEqual(0)
    }
  })

  it('gives video-generate the D7 reference-video and compare fields', () => {
    const ids = nodeSpec('video-generate').params.map(field => field.id)
    expect(ids).toContain('referenceVideo')
    expect(ids).toContain('compare')
    expect(defaultParams('video-generate')).toMatchObject({ duration: 5, compare: false })
  })

  it('keeps deployment values out of the catalog', () => {
    const masthead = JSON.stringify(NODE_CATALOG)
    for (const needle of ['threerouter', 'minimax', 'wanx', 'qwen']) expect(masthead).not.toContain(needle)
  })

  it('rejects an unknown kind loudly', () => {
    expect(() => nodeSpec('nope' as WorkflowNodeKind)).toThrow(/unknown workflow node kind/)
  })
})

/** 造一个节点。 */
function node(id: string, kind: WorkflowNodeKind, params: Record<string, NodeParamValue> = {}): WorkflowNode {
  return { id, kind, position: { x: 0, y: 0 }, params }
}

/** 造一条连线。 */
function edge(source: string, target: string): WorkflowEdge {
  return { id: `${source}->${target}`, source, target }
}

describe('graph validation (T4-3)', () => {
  it('accepts a well-formed chain', () => {
    const result = validateWorkflow(
      [node('a', 'script', { text: '开场白' }), node('b', 'image-generate', { prompt: '一只猫' })],
      [edge('a', 'b')],
    )
    expect(result).toEqual({ ok: true, issues: [] })
  })

  it('flags empty required parameters', () => {
    const result = validateWorkflow([node('a', 'image-generate', { prompt: '' })], [])
    expect(result.issues.map(issue => issue.code)).toContain('missing-required')
    expect(result.issues[0]?.nodeId).toBe('a')
  })

  it('flags port mismatches (media into text)', () => {
    const result = validateWorkflow(
      [node('a', 'storyboard', { shots: 3 }), node('b', 'script', { text: 'x' })],
      [edge('a', 'b')],
    )
    expect(result.issues.some(issue => issue.code === 'port-mismatch')).toBe(true)
  })

  it('detects a cycle and names the loop', () => {
    const result = validateWorkflow(
      [node('a', 'script', { text: 'x' }), node('b', 'script', { text: 'y' })],
      [edge('a', 'b'), edge('b', 'a')],
    )
    const cycle = result.issues.find(issue => issue.code === 'cycle')
    expect(cycle?.message).toMatch(/a -> b -> a/)
  })

  it('flags self loops and dangling edges', () => {
    const result = validateWorkflow(
      [node('a', 'preview')],
      [edge('a', 'a'), { id: 'ghost', source: 'a', target: 'missing' }],
    )
    const codes = result.issues.map(issue => issue.code)
    expect(codes).toContain('self-loop')
    expect(codes).toContain('dangling-edge')
  })

  it('marks planned nodes as not runnable so nothing can pretend to succeed', () => {
    const result = validateWorkflow([node('a', 'lip-sync')], [])
    expect(result.issues.map(issue => issue.code)).toEqual(['not-runnable'])
    expect(result.ok).toBe(false)
  })
})
