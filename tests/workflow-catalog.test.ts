/**
 * 节点目录（`T4-2` + `R-FLW-2`）。
 *
 * 目录是画布与宿主共用的静态事实：V1 十个节点 + `subtitle`/`render` 本方案实现，
 * `lip-sync`/`face-swap`/`voice-synthesize` 必须是 `planned`（可见、不可运行、带原因）。
 * 模型名等部署值不得出现在这里（`T2-11`）。
 */
import { describe, expect, it } from 'vitest'
import {
  NODE_CATALOG, catalogSummary, defaultParams, isRunnable, nodeSpec,
  type WorkflowNodeKind,
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
