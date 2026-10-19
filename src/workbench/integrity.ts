/**
 * 工作台数据完整性巡检（Track A / A104）。
 *
 * 场景：工作台文档里有多种交叉引用（时间轴片段→素材路径、资源使用→资源、素材/时间轴/工作流→项目）。
 * 长期使用 + 归档/导入之后可能出现**悬空引用**与**孤儿记录**——界面会显示空占位或"找不到"。
 * 这里只**报告**，不修复（修复属于用户决策）。
 */

/** 一条完整性问题。 */
export interface IntegrityIssue {
  readonly kind: 'dangling-asset' | 'orphan-asset' | 'orphan-timeline' | 'orphan-workflow' | 'orphan-resource' | 'dangling-resource-usage'
  /** 出问题的记录 id（片段 / 素材 / 时间轴 / 工作流 / 资源 / 使用记录）。 */
  readonly id: string
  readonly projectId?: string
  readonly detail: string
}

export interface IntegrityReport {
  readonly healthy: boolean
  readonly counts: { readonly total: number; readonly dangling: number; readonly orphans: number }
  readonly issues: readonly IntegrityIssue[]
}

interface DocumentLike {
  readonly projects: ReadonlyArray<{ id: string }>
  readonly assets: ReadonlyArray<{ id: string; projectId: string; path: string }>
  readonly timelines: ReadonlyArray<{ id: string; projectId: string; tracks: ReadonlyArray<{ id: string; clips: ReadonlyArray<{ id: string; assetPath?: string }> }> }>
  readonly workflows?: ReadonlyArray<{ id: string; projectId?: string }>
  readonly resources?: ReadonlyArray<{ id: string; projectId?: string }>
  readonly resourceUsage?: ReadonlyArray<{ resourceId?: string; projectId?: string }>
}

/**
 * 巡检文档完整性。
 * @param document - 工作台文档（或其片段）。
 * @returns 报告（healthy = 没有问题）。
 */
export function inspectIntegrity(document: DocumentLike): IntegrityReport {
  const projectIds = new Set(document.projects.map(project => project.id))
  const assetPathsByProject = new Map<string, Set<string>>()
  for (const asset of document.assets) {
    const set = assetPathsByProject.get(asset.projectId) ?? new Set<string>()
    set.add(asset.path)
    assetPathsByProject.set(asset.projectId, set)
  }
  const resourceIds = new Set((document.resources ?? []).map(resource => resource.id))
  const issues: IntegrityIssue[] = []

  // 1) 时间轴片段引用了本项目素材库里不存在的素材
  for (const timeline of document.timelines) {
    const known = assetPathsByProject.get(timeline.projectId) ?? new Set<string>()
    for (const track of timeline.tracks) {
      for (const clip of track.clips) {
        if (clip.assetPath === undefined || clip.assetPath === '') continue
        if (!known.has(clip.assetPath)) {
          issues.push({
            kind: 'dangling-asset', id: clip.id, projectId: timeline.projectId,
            detail: `时间轴 ${timeline.id} 的片段 ${clip.id} 引用了不在素材库的素材 ${clip.assetPath}`,
          })
        }
      }
    }
  }

  // 2) 孤儿记录：挂在已删项目上的素材/时间轴/工作流/资源
  const orphan = (kind: IntegrityIssue['kind'], record: { id: string; projectId?: string }) => {
    if (record.projectId === undefined || projectIds.has(record.projectId)) return
    issues.push({ kind, id: record.id, projectId: record.projectId, detail: `${record.id} 属于已不存在的项目 ${record.projectId}` })
  }
  for (const asset of document.assets) orphan('orphan-asset', asset)
  for (const timeline of document.timelines) orphan('orphan-timeline', timeline)
  for (const workflow of document.workflows ?? []) orphan('orphan-workflow', workflow)
  for (const resource of document.resources ?? []) orphan('orphan-resource', resource)

  // 3) 资源使用记录指向不存在的资源
  for (const usage of document.resourceUsage ?? []) {
    if (usage.resourceId === undefined || usage.resourceId === '') continue
    if (!resourceIds.has(usage.resourceId)) {
      issues.push({
        kind: 'dangling-resource-usage', id: usage.resourceId, ...usage.projectId === undefined ? {} : { projectId: usage.projectId },
        detail: `资源使用记录指向不存在的资源 ${usage.resourceId}`,
      })
    }
  }

  const dangling = issues.filter(issue => issue.kind === 'dangling-asset' || issue.kind === 'dangling-resource-usage').length
  return {
    healthy: issues.length === 0,
    counts: { total: issues.length, dangling, orphans: issues.length - dangling },
    issues,
  }
}
