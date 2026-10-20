/**
 * 资源使用记录（`R-QCK-3`）与作用域字段（`R-COL-1`）。
 *
 * 口径：产物由某张工作流跑出来时，该图里的 `resource-reference` 节点就算"用到了"这些资源；
 * 资源库据此显示「被哪些素材用过」。同 (资源, 产物) 只留最新一条，项目删除时级联清理。
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { WorkflowRunner, type GenerationTool } from '../src/workbench/runner.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function store(): Promise<WorkbenchStore> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-usage-'))
  dirs.push(directory)
  return new WorkbenchStore({ directory })
}

describe('resource usage records (R-QCK-3)', () => {
  it('records which artifacts used a resource, dedupes and cascades with the project', async () => {
    const workbench = await store()
    const project = await workbench.createProject('用法项目')
    const other = await workbench.createProject('别的项目')
    const resource = await workbench.createResource({ projectId: project.id, kind: 'style', name: '赛博风' })

    const base = { resourceId: resource.id, projectId: project.id, runId: 'run-1', nodeId: 'v' }
    expect(await workbench.recordResourceUsage([
      { ...base, assetPath: '/tmp/outputs/a.mp4', at: '2026-10-16T00:00:00.000Z' },
      { ...base, assetPath: '/tmp/outputs/b.mp4', at: '2026-10-16T00:01:00.000Z' },
    ])).toBe(2)
    expect((await workbench.listResourceUsage({ resourceId: resource.id })).map(entry => entry.assetPath))
      .toEqual(['/tmp/outputs/b.mp4', '/tmp/outputs/a.mp4'])

    // 同一 (资源, 产物) 再记一次 → 只留最新
    await workbench.recordResourceUsage([
      { ...base, assetPath: '/tmp/outputs/a.mp4', runId: 'run-2', at: '2026-10-16T00:02:00.000Z' },
    ])
    const rows = await workbench.listResourceUsage({ resourceId: resource.id })
    expect(rows).toHaveLength(2)
    expect(rows.find(entry => entry.assetPath === '/tmp/outputs/a.mp4')?.runId).toBe('run-2')

    // 项目删除 → 级联
    await workbench.recordResourceUsage([
      { resourceId: 'res-x', projectId: other.id, assetPath: '/tmp/outputs/c.mp4', runId: 'r', nodeId: 'n', at: '2026-10-16T00:03:00.000Z' },
    ])
    await workbench.removeProject(project.id)
    expect(await workbench.listResourceUsage({ projectId: project.id })).toEqual([])
    expect(await workbench.listResourceUsage({ projectId: other.id })).toHaveLength(1)
  })

  it('records usage when a workflow with a resource-reference node produces an artifact', async () => {
    const workbench = await store()
    const outputs = await mkdtemp(join(tmpdir(), 'dsh-usage-out-'))
    dirs.push(outputs)
    const project = await workbench.createProject('跑图项目')
    const resource = await workbench.createResource({ projectId: project.id, kind: 'style', name: '赛博风' })

    const tool: GenerationTool = {
      async execute() {
        const path = join(outputs, 'clip.mp4')
        await writeFile(path, 'bytes')
        return { videoPath: path, bytes: 5 }
      },
    }
    const runner = new WorkflowRunner({
      store: workbench, newRunId: () => 'run-usage', generateImage: tool, generateVideo: tool, retryDelayMs: 1,
    })
    await runner.begin({
      schemaVersion: 1, id: 'wfl-usage', projectId: project.id, name: '用资源', edges: [],
      nodes: [
        { id: 'style', kind: 'resource-reference', position: { x: 0, y: 0 }, params: { resourceId: resource.id } },
        { id: 'v', kind: 'video-generate', position: { x: 200, y: 0 }, params: { prompt: '齿轮' } },
      ],
      createdAt: '', updatedAt: '',
    })
    await vi.waitFor(async () => {
      expect((await workbench.listRuns(project.id))[0]?.status).toBe('succeeded')
    }, { timeout: 5000 })

    const usage = await workbench.listResourceUsage({ resourceId: resource.id })
    expect(usage).toHaveLength(1)
    expect(usage[0]).toMatchObject({ projectId: project.id, runId: 'run-usage', nodeId: 'v' })
    expect(usage[0]?.assetPath).toContain('clip.mp4')
  })
})

describe('resource scope (R-COL-1)', () => {
  it('defaults to project and keeps the field for later team/public work', async () => {
    const workbench = await store()
    const project = await workbench.createProject('作用域')
    const created = await workbench.createResource({ projectId: project.id, kind: 'role', name: '小美' })
    expect(created.scope).toBe('project')

    const explicit = await workbench.createResource({ projectId: project.id, kind: 'role', name: '小刚', scope: 'team' })
    expect(explicit.scope).toBe('team')
    await expect(workbench.createResource({ projectId: project.id, kind: 'role', name: 'x', scope: 'galaxy' }))
      .rejects.toThrow(/project\/team\/public/)
  })
})
