/**
 * 素材利用率报告（Track A / A82）：找出"从未被任何时间轴用过"的素材（只报告不删除）。
 */
import { describe, expect, it } from 'vitest'
import { reportAssetUsage } from '../src/workbench/usage.ts'
import type { AssetRecord } from '../src/workbench/records.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const asset = (id: string, path: string, bytes: number): AssetRecord => ({
  id, projectId: 'prj-1', path, kind: 'video', bytes, createdAt: '2026-10-01T00:00:00.000Z',
} as AssetRecord)
const timeline = (id: string, name: string, paths: string[]): TimelineRecord => ({
  schemaVersion: 4, id, projectId: 'prj-1', name, frameRate: 30, burnSubtitles: false,
  tracks: [{ id: 'v1', kind: 'video', clips: paths.map((path, index) => ({
    id: `c${index}`, assetPath: path, startMs: index * 1000, durationMs: 1000,
  })) }],
  createdAt: '', updatedAt: '',
})

describe('reportAssetUsage (A82)', () => {
  it('marks never-used assets, counts references and sorts unused first', () => {
    const report = reportAssetUsage(
      [asset('a1', 'outputs/used.mp4', 1000), asset('a2', 'outputs/unused.mp4', 5000)],
      [timeline('t1', '第一版', ['outputs/used.mp4']), timeline('t2', '第二版', ['outputs/used.mp4', 'outputs/used.mp4'])],
    )
    expect(report.summary).toEqual({ total: 2, unused: 1, unusedBytes: 5000, totalBytes: 6000 })
    // 未使用的排最前（清理时最该看）
    expect(report.assets[0]).toMatchObject({ assetPath: 'outputs/unused.mp4', unused: true, timesUsed: 0 })
    expect(report.assets[1]).toMatchObject({ assetPath: 'outputs/used.mp4', unused: false, timesUsed: 3 })
    expect(report.assets[1]?.timelines.map(entry => entry.timelineName)).toEqual(['第一版', '第二版'])
  })

  it('handles empty libraries and ignores clips without a path', () => {
    expect(reportAssetUsage([], []).summary).toEqual({ total: 0, unused: 0, unusedBytes: 0, totalBytes: 0 })
    const withEmptyClip: TimelineRecord = { ...timeline('t', 'x', []), tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: '', startMs: 0, durationMs: 1 }] }] }
    expect(reportAssetUsage([asset('a', 'outputs/a.mp4', 10)], [withEmptyClip]).assets[0]?.unused).toBe(true)
  })
})
