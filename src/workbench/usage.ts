/**
 * 素材利用率报告（Track A / A82）。
 *
 * 场景：反复生成、试错会留下大量素材，其中有些**从未被任何时间轴用过**——
 * 用户不知道是哪些，素材库就越来越脏。这里给出清理依据（**只报告，不删除**）。
 */
import type { AssetRecord } from './records.ts'
import type { TimelineRecord } from './timeline.ts'

/** 一个素材的使用情况。 */
export interface AssetUsage {
  readonly assetPath: string
  readonly projectId: string
  readonly kind: string
  readonly bytes?: number
  /** 引用它的时间轴（去重）。 */
  readonly timelines: readonly { readonly timelineId: string; readonly timelineName: string; readonly clips: number }[]
  /** 被引用次数（片段总数）。 */
  readonly timesUsed: number
  /** 是否从未被任何时间轴使用。 */
  readonly unused: boolean
}

export interface AssetUsageSummary {
  readonly total: number
  readonly unused: number
  readonly unusedBytes: number
  readonly totalBytes: number
}

/**
 * 汇总素材使用情况。
 * @param assets - 项目的素材记录（可跨项目）。
 * @param timelines - 时间轴记录（可跨项目）。
 * @returns 每个素材的使用情况 + 汇总。
 */
export function reportAssetUsage(
  assets: readonly AssetRecord[],
  timelines: readonly TimelineRecord[],
): { readonly assets: readonly AssetUsage[]; readonly summary: AssetUsageSummary } {
  // 素材路径 → 引用它的时间轴与片段数
  const references = new Map<string, Array<{ timelineId: string; timelineName: string; clips: number }>>()
  for (const timeline of timelines) {
    const perTimeline = new Map<string, number>()
    for (const track of timeline.tracks) {
      for (const clip of track.clips) {
        if (clip.assetPath === undefined || clip.assetPath === '') continue
        perTimeline.set(clip.assetPath, (perTimeline.get(clip.assetPath) ?? 0) + 1)
      }
    }
    for (const [assetPath, clips] of perTimeline) {
      const list = references.get(assetPath) ?? []
      list.push({ timelineId: timeline.id, timelineName: timeline.name, clips })
      references.set(assetPath, list)
    }
  }

  let unusedBytes = 0
  let totalBytes = 0
  const rows: AssetUsage[] = assets.map(asset => {
    const used = references.get(asset.path) ?? []
    const timesUsed = used.reduce((sum, entry) => sum + entry.clips, 0)
    totalBytes += asset.bytes ?? 0
    if (used.length === 0) unusedBytes += asset.bytes ?? 0
    return {
      assetPath: asset.path,
      projectId: asset.projectId,
      kind: asset.kind,
      ...asset.bytes === undefined ? {} : { bytes: asset.bytes },
      timelines: used,
      timesUsed,
      unused: used.length === 0,
    }
  })
  // 未使用的排前面（清理时最该看的），其次按体积降序
  rows.sort((left, right) => {
    if (left.unused !== right.unused) return left.unused ? -1 : 1
    return (right.bytes ?? 0) - (left.bytes ?? 0)
  })
  return {
    assets: rows,
    summary: {
      total: rows.length,
      unused: rows.filter(row => row.unused).length,
      unusedBytes,
      totalBytes,
    },
  }
}
