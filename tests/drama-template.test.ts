/**
 * 漫剧/连续剧模板（Track A / A10）：
 * 模板必须**可直接运行**（全部节点 runnable、无校验问题），且能被 Agent 实例化成工作流。
 */
import { describe, expect, it } from 'vitest'
import { DRAMA_SERIES_TEMPLATE, DRAMA_TEMPLATES, instantiateTemplate } from '../src/workbench/drama.ts'
import { NODE_CATALOG, validateWorkflow } from '../src/workbench/workflow.ts'

const fixedNow = () => new Date('2026-10-18T00:00:00.000Z')

describe('drama series template (A10)', () => {
  it('instantiates into a valid, fully runnable workflow', () => {
    const record = instantiateTemplate(DRAMA_SERIES_TEMPLATE, 'prj-drama', () => 'wfl-drama', fixedNow)
    expect(record.nodes).toHaveLength(DRAMA_SERIES_TEMPLATE.nodes.length)
    expect(record.edges).toHaveLength(DRAMA_SERIES_TEMPLATE.edges.length)

    const validation = validateWorkflow(record.nodes, record.edges)
    expect(validation.ok).toBe(true)
    expect(validation.issues).toEqual([])

    // 不许掺 planned 节点：模板里每个节点都得是 runnable（否则会被运行器整次拒绝）
    for (const node of record.nodes) {
      const definition = NODE_CATALOG.find(candidate => candidate.kind === node.kind)
      expect(definition?.availability, `${node.kind} 必须是 runnable`).toBe('runnable')
    }
  })

  it('covers the intended chain: 剧情→剧本→分镜→图→视频→字幕→合成 + 角色基准', () => {
    const kinds = DRAMA_SERIES_TEMPLATE.nodes.map(node => node.kind)
    expect(kinds).toEqual([
      'creative-input', 'script', 'storyboard',
      'image-generate', 'video-generate', 'subtitle', 'render',
    ])
    // 角色基准不进模板（resourceId 必填、需真人选），但说明里必须提示怎么挂
    expect(DRAMA_SERIES_TEMPLATE.describe).toContain('resource-reference')
  })

  it('exposes every data-layer template with a stable id and label key', () => {
    expect(DRAMA_TEMPLATES.length).toBeGreaterThan(0)
    for (const template of DRAMA_TEMPLATES) {
      expect(template.id).toMatch(/^[a-z0-9-]+$/)
      expect(template.labelKey).toMatch(/^template/)
      expect(template.nodes.length).toBeGreaterThan(0)
    }
  })
})
