/**
 * 对抗性扫荡 R2：钩子超时不拖慢渲染、校验器在大时间轴下仍可用、项目包重复导入安全。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { RenderRegistry } from '../src/media/render-registry.ts'
import type { RenderService } from '../src/media/render.ts'
import { validateTimeline } from '../src/workbench/validate.ts'
import { exportProjectPackage, importProjectPackage } from '../src/workbench/package.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import type { TimelineClip, TimelineRecord, TimelineTrack } from '../src/workbench/timeline.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

const timelineOf = (tracks: TimelineTrack[]): TimelineRecord => ({
  schemaVersion: 3, id: 'tml-r2', projectId: 'prj-1', name: 'r2', frameRate: 30, burnSubtitles: false,
  tracks, createdAt: '', updatedAt: '',
})

describe('retention hook must never stall render completion (R2)', () => {
  it('still marks the render succeeded when the hook hangs', async () => {
    const fakeService = {
      async render() { return { outputPath: '/tmp/outputs/x.mp4', bytes: 2048, durationMs: 1000 } },
    } as unknown as RenderService
    const logs: Array<Record<string, unknown>> = []
    const registry = new RenderRegistry({
      render: fakeService,
      retentionTimeoutMs: 200,
      log: entry => { logs.push(entry) },
      retention: () => new Promise(() => undefined), // 永不 resolve，模拟磁盘扫描卡住
    })
    const started = Date.now()
    const job = registry.start(timelineOf([{ id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }] }]))
    await vi.waitFor(() => { expect(registry.get(job.id)?.status).toBe('succeeded') }, { timeout: 10_000 })
    expect(Date.now() - started).toBeLessThan(5000)
    expect(registry.get(job.id)?.summary?.retention).toBeUndefined()
    expect(logs.some(entry => entry.event === 'render-retention-timeout')).toBe(true)
  })
})

describe('validator at scale (R2)', () => {
  it('handles 500 clips quickly and still reports the real problems', () => {
    const clips: TimelineClip[] = Array.from({ length: 500 }, (_, index) => ({
      id: `c${index}`, assetPath: '/tmp/a.mp4', startMs: index * 1000, durationMs: 1000,
      // 每 50 个埋一个重叠
      ...index % 50 === 49 ? { startMs: index * 1000 - 500 } : {},
    }))
    const document = timelineOf([{ id: 'v1', kind: 'video', clips }])
    const started = performance.now()
    const issues = validateTimeline(document)
    const elapsed = performance.now() - started
    expect(elapsed).toBeLessThan(500)
    expect(issues.filter(issue => issue.code === 'overlap').length).toBeGreaterThanOrEqual(9)
  })
})

describe('package import is repeatable (R2)', () => {
  // R3 定位结论：导入**每次都建新项目**（行为正确）；此前"只多 1 个"是我上一轮测试自身的问题。
  // 真问题是**同名**（两个「重复导入（导入）」），已修为自动去重命名（`（导入） 2`…）。
  it('importing the same package twice creates unique-named independent projects', async () => {
    const directory = await temp('dsh-r2-store-')
    const store = new WorkbenchStore({ directory })
    const project = await store.createProject('重复导入')
    await store.saveTimeline({ projectId: project.id, tracks: [{ id: 'v1', kind: 'video', clips: [] }] })
    const target = await temp('dsh-r2-pkg-')
    const { manifestPath } = await exportProjectPackage({ store, projectId: project.id, targetDir: target })
    const packageDir = join(manifestPath, '..')
    const outputs = await temp('dsh-r2-out-')
    await importProjectPackage({ store, packageDir, outputsDir: outputs })
    await importProjectPackage({ store, packageDir, outputsDir: outputs })
    const names = (await store.listProjects()).map(candidate => candidate.name)
    expect(names.length).toBe(3) // 原始 + 两次导入
    expect(new Set(names).size).toBe(3) // 名字不撞（第二次自动加序号）
  })
})
