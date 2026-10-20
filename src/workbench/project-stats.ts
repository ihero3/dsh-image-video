/**
 * 素材库按项目统计（Track A / A132）。
 *
 * 清理空间时需要知道"哪个项目最占地方"，才能决定归档/清理哪个。只报告，不删除。
 */
import type { AssetRecord } from './records.ts'
import type { TimelineRecord } from './timeline.ts'

/** 单个项目的占用。 */
export interface ProjectStat {
  readonly projectId: string
  readonly name: string
  readonly assets: number
  readonly bytes: number
  /** 实际被时间轴引用到的字节（其余是"登记了但没用上"）。 */
  readonly usedBytes: number
  readonly timelines: number
}

export interface ProjectStatsReport {
  readonly totalBytes: number
  readonly projects: readonly ProjectStat[]
  /** 占用最大的项目占比（0–1）。 */
  readonly topShare: number
}

/**
 * 统计每个项目的素材占用。
 * @param projects - 项目列表。
 * @param assets - 全部素材。
 * @param timelines - 全部时间轴（用于算 usedBytes）。
 * @returns 报告（按占用降序）。
 */
export function projectStats(
  projects: ReadonlyArray<{ id: string; name: string }>,
  assets: readonly AssetRecord[],
  timelines: readonly TimelineRecord[],
): ProjectStatsReport {
  // 项目内被引用到的素材路径
  const referenced = new Map<string, Set<string>>()
  for (const timeline of timelines) {
    const set = referenced.get(timeline.projectId) ?? new Set<string>()
    for (const track of timeline.tracks) for (const clip of track.clips) if (clip.assetPath !== undefined) set.add(clip.assetPath)
    referenced.set(timeline.projectId, set)
  }
  const stats: ProjectStat[] = projects.map(project => {
    const own = assets.filter(asset => asset.projectId === project.id)
    const used = referenced.get(project.id) ?? new Set<string>()
    return {
      projectId: project.id,
      name: project.name,
      assets: own.length,
      bytes: own.reduce((sum, asset) => sum + (asset.bytes ?? 0), 0),
      usedBytes: own.filter(asset => used.has(asset.path)).reduce((sum, asset) => sum + (asset.bytes ?? 0), 0),
      timelines: timelines.filter(timeline => timeline.projectId === project.id).length,
    }
  })
  stats.sort((left, right) => right.bytes - left.bytes)
  const totalBytes = stats.reduce((sum, stat) => sum + stat.bytes, 0)
  return {
    totalBytes,
    projects: stats,
    topShare: totalBytes === 0 ? 0 : Math.round(((stats[0]?.bytes ?? 0) / totalBytes) * 1000) / 1000,
  }
}
