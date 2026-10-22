/**
 * `A-1`：四个"2 秒上手"模板的数据必须自洽（节点种类合法、连线索引合法、至少一个生成节点）。
 */
import { describe, expect, it } from 'vitest'
import { WORKFLOW_TEMPLATES, nodeSpec } from '../src/workbench/workflow.ts'

const REQUIRED = ['quick-image', 'quick-video', 'storyboard', 'cover', 'production-line'] as const

describe('quick-start templates (A-1)', () => {
  it('ships the four templates', () => {
    for (const id of REQUIRED) {
      expect(WORKFLOW_TEMPLATES.some(template => template.id === id), `模板 ${id} 缺失`).toBe(true)
    }
  })

  it.each(REQUIRED)('%s is wired coherently and can actually generate', id => {
    const template = WORKFLOW_TEMPLATES.find(candidate => candidate.id === id)!
    expect(template.nodes.length).toBeGreaterThan(0)

    // 每个节点种类都必须存在于节点目录（拼错种类会在运行时才炸）
    for (const node of template.nodes) {
      expect(() => nodeSpec(node.kind)).not.toThrow()
    }

    // 连线必须指向真实节点下标，且不重复
    const seen = new Set<string>()
    for (const [from, to] of template.edges) {
      expect(from).toBeGreaterThanOrEqual(0)
      expect(to).toBeGreaterThanOrEqual(0)
      expect(from).toBeLessThan(template.nodes.length)
      expect(to).toBeLessThan(template.nodes.length)
      const key = `${String(from)}->${String(to)}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }

    // 至少一个真正会调外部生成的节点（否则"一键出图"名不副实）
    const generative = template.nodes.filter(node => node.kind === 'image-generate' || node.kind === 'video-generate')
    expect(generative.length).toBeGreaterThan(0)
    // 生成节点必须带非空 prompt（运行时靠它出东西）
    for (const node of generative) {
      expect(String(node.params.prompt ?? '').trim().length).toBeGreaterThan(0)
    }
  })
})
