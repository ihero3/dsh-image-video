/**
 * 素材库按项目统计（Track A / A132）。
 */
import { describe, expect, it } from 'vitest'
import { projectStats } from '../src/workbench/project-stats.ts'
import type { AssetRecord } from '../src/workbench/records.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const asset = (id: string, projectId: string, path: string, bytes: number) =>
  ({ id, projectId, path, kind: 'video', bytes } as AssetRecord)
const timeline = (id: string, projectId: string, paths: string[]): TimelineRecord => ({
  schemaVersion: 4, id, projectId, name: id, frameRate: 30, burnSubtitles: false,
  tracks: [{ id: 'v', kind: 'video', clips: paths.map((assetPath, index) => ({ id: `c${index}`, assetPath, startMs: index, durationMs: 1 })) }],
  createdAt: '', updatedAt: '',
} as TimelineRecord)

describe('projectStats (A132)', () => {
  it('ranks projects by size and separates used from unused bytes', () => {
    const report = projectStats(
      [{ id: 'a', name: 'A 项目' }, { id: 'b', name: 'B 项目' }, { id: 'c', name: '空项目' }],
      [
        asset('1', 'a', 'outputs/a1.mp4', 1000),
        asset('2', 'a', 'outputs/a2.mp4', 500),   // 未被引用
        asset('3', 'b', 'outputs/b1.mp4', 300),
      ],
      [timeline('t1', 'a', ['outputs/a1.mp4']), timeline('t2', 'b', ['outputs/b1.mp4'])],
    )
    expect(report.projects.map(stat => stat.projectId)).toEqual(['a', 'b', 'c'])
    expect(report.projects[0]).toMatchObject({ bytes: 1500, usedBytes: 1000, assets: 2, timelines: 1 })
    expect(report.projects[1]).toMatchObject({ bytes: 300, usedBytes: 300 })
    expect(report.projects[2]).toMatchObject({ bytes: 0, usedBytes: 0, timelines: 0 })
    expect(report.totalBytes).toBe(1800)
    expect(report.topShare).toBe(0.833) // 1500/1800
  })

  it('handles an empty library', () => {
    expect(projectStats([], [], [])).toEqual({ totalBytes: 0, projects: [], topShare: 0 })
  })
})
