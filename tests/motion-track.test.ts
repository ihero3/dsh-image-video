/**
 * 轨迹资源（`T2-6`，`R-MED-4`）：关键帧越界被拒、序列化往返、轨迹转约束文本可断言。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { MAX_MOTION_KEYFRAMES, describeMotionTrack, normalizeKeyframes } from '../src/workbench/records.ts'
import { nodeSpec } from '../src/workbench/workflow.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function store(): Promise<{ workbench: WorkbenchStore; directory: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-motion-'))
  dirs.push(directory)
  return { workbench: new WorkbenchStore({ directory }), directory }
}

const track = [
  { tMs: 0, x: 0.1, y: 0.5 },
  { tMs: 2000, x: 0.9, y: 0.5, scale: 1.15 },
]

describe('motion track resources (T2-6)', () => {
  it('rejects out-of-range and unordered keyframes instead of truncating', () => {
    expect(normalizeKeyframes(track)).toEqual(track)
    expect(() => normalizeKeyframes([])).toThrow(/at least one keyframe/)
    expect(() => normalizeKeyframes([{ tMs: -1, x: 0, y: 0 }])).toThrow(/tMs must be between 0 and 600000/)
    expect(() => normalizeKeyframes([{ tMs: 0, x: 1.5, y: 0 }])).toThrow(/x must be between 0 and 1/)
    expect(() => normalizeKeyframes([{ tMs: 0, x: 0, y: 0 }, { tMs: -5, x: 0, y: 0 }])).toThrow(/must be between/)
    expect(() => normalizeKeyframes([{ tMs: 100, x: 0, y: 0 }, { tMs: 50, x: 0, y: 0 }])).toThrow(/must not go backwards/)
    expect(() => normalizeKeyframes([{ tMs: 0, x: 0, y: 0, scale: 99 }])).toThrow(/scale must be between/)
    expect(() => normalizeKeyframes(Array.from({ length: MAX_MOTION_KEYFRAMES + 1 }, (_, index) => ({ tMs: index, x: 0.5, y: 0.5 }))))
      .toThrow(/at most 120 keyframes/)
  })

  it('turns keyframes into an assertable motion constraint text', () => {
    const text = describeMotionTrack(track)
    expect(text).toContain('0.0s 起：主体位于画面中左')
    expect(text).toContain('2.0s')
    expect(text).toContain('画面中右')
    expect(text).toContain('缩放 1.15x')
    expect(describeMotionTrack([])).toBe('无轨迹约束')
  })

  it('round-trips a motion track through the store and binds it from the canvas node', async () => {
    const { workbench, directory } = await store()
    const project = await workbench.createProject('轨迹项目')
    const created = await workbench.createResource({
      projectId: project.id, kind: 'motion-track', name: '镜头 A 轨迹', keyframes: track,
    })
    expect(created.kind).toBe('motion-track')
    expect(created.keyframes).toEqual(track)

    // 轨迹资源必须带关键帧
    await expect(workbench.createResource({ projectId: project.id, kind: 'motion-track', name: '空的' }))
      .rejects.toThrow(/keyframes must be an array/)

    // 重开（新实例读同一份 JSON）后关键帧逐字段还在
    const reopened = new WorkbenchStore({ directory })
    const restored = (await reopened.listResources(project.id)).find(resource => resource.id === created.id)
    expect(restored?.keyframes).toEqual(track)

    // 画布节点能绑定轨迹资源
    const field = nodeSpec('motion-track').params.find(candidate => candidate.id === 'trackId')
    expect(field).toBeDefined()
    expect(field?.type).toBe('text')
  })
})
