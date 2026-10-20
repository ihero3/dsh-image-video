/**
 * 工作台数据完整性巡检（Track A / A104）。
 */
import { describe, expect, it } from 'vitest'
import { inspectIntegrity } from '../src/workbench/integrity.ts'

const document = (overrides: Record<string, unknown> = {}) => ({
  projects: [{ id: 'prj-1' }],
  assets: [{ id: 'a1', projectId: 'prj-1', path: 'outputs/a.mp4' }],
  timelines: [{ id: 't1', projectId: 'prj-1', tracks: [{ id: 'v1', clips: [{ id: 'c1', assetPath: 'outputs/a.mp4' }] }] }],
  workflows: [{ id: 'w1', projectId: 'prj-1' }],
  resources: [{ id: 'r1', projectId: 'prj-1' }],
  resourceUsage: [{ resourceId: 'r1', projectId: 'prj-1' }],
  ...overrides,
} as never)

describe('inspectIntegrity (A104)', () => {
  it('reports a clean document as healthy', () => {
    const report = inspectIntegrity(document())
    expect(report.healthy).toBe(true)
    expect(report.counts).toEqual({ total: 0, dangling: 0, orphans: 0 })
  })

  it('finds dangling asset references, orphans and dangling usage', () => {
    const report = inspectIntegrity(document({
      timelines: [
        { id: 't1', projectId: 'prj-1', tracks: [{ id: 'v1', clips: [{ id: 'c1', assetPath: 'outputs/ghost.mp4' }] }] },
        { id: 't-orphan', projectId: 'prj-dead', tracks: [] },
      ],
      assets: [
        { id: 'a1', projectId: 'prj-1', path: 'outputs/a.mp4' },
        { id: 'a-orphan', projectId: 'prj-dead', path: 'outputs/zombie.mp4' },
      ],
      resourceUsage: [{ resourceId: 'r-missing', projectId: 'prj-1' }],
    }))
    expect(report.healthy).toBe(false)
    const kinds = report.issues.map(issue => issue.kind)
    expect(kinds).toContain('dangling-asset')
    expect(kinds).toContain('orphan-timeline')
    expect(kinds).toContain('orphan-asset')
    expect(kinds).toContain('dangling-resource-usage')
    expect(report.counts.dangling).toBe(2) // 悬空素材引用 + 悬空资源使用
    expect(report.counts.orphans).toBe(2) // 孤儿时间轴 + 孤儿素材
    // 详情要能指到具体记录
    expect(report.issues.find(issue => issue.kind === 'dangling-asset')?.id).toBe('c1')
  })
})
