/**
 * 工作流文档与台账本维护（`T4-1` 的持久化半边 + 幂等上线前的重复数据清理）。
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkbenchStore } from '../src/workbench/store.ts'

const dirs: string[] = []

async function makeStore(): Promise<{ store: WorkbenchStore; directory: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-workbench-flow-'))
  dirs.push(directory)
  return { store: new WorkbenchStore({ directory, now: () => new Date('2026-10-15T00:00:00.000Z') }), directory }
}

afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

describe('workflow documents', () => {
  it('saves, updates, lists and removes a workflow', async () => {
    const { store } = await makeStore()
    const project = await store.createProject('流程')
    const created = await store.saveWorkflow({
      projectId: project.id, name: '模板 A',
      nodes: [{ id: 'n1', kind: 'script', position: { x: 1.4, y: 2.6 }, params: { text: '第一句' } }],
      edges: [],
    })
    expect(created.id).toMatch(/^wfl-/)
    expect(created.nodes[0]).toMatchObject({ kind: 'script', position: { x: 1, y: 3 }, params: { text: '第一句' } })

    const updated = await store.saveWorkflow({
      id: created.id, projectId: project.id, name: '模板 B', nodes: [], edges: [],
    })
    expect(updated.id).toBe(created.id)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.name).toBe('模板 B')
    expect(await store.listWorkflows(project.id)).toHaveLength(1)

    expect(await store.removeWorkflow(created.id)).toBe(true)
    expect(await store.removeWorkflow(created.id)).toBe(false)
  })

  it('fills catalog defaults for missing parameters and rejects malformed graphs', async () => {
    const { store } = await makeStore()
    const project = await store.createProject('校验')
    const saved = await store.saveWorkflow({
      projectId: project.id, nodes: [{ id: 'n1', kind: 'video-generate', position: { x: 0, y: 0 }, params: {} }], edges: [],
    })
    // 缺省参数按目录补齐（`T4-2` 的默认值）
    expect(saved.nodes[0]?.params).toMatchObject({ duration: 5, compare: false, ratio: '16:9' })

    await expect(store.saveWorkflow({
      projectId: project.id, nodes: [{ id: 'x', kind: 'nope', position: { x: 0, y: 0 } }], edges: [],
    })).rejects.toThrow(/unknown workflow node kind/)
    await expect(store.saveWorkflow({
      projectId: project.id,
      nodes: [{ id: 'a', kind: 'script', position: { x: 0, y: 0 } }],
      edges: [{ source: 'a', target: 'ghost' }],
    })).rejects.toThrow(/must connect two nodes/)
    await expect(store.saveWorkflow({
      projectId: project.id,
      nodes: [{ id: 'a', kind: 'script', position: { x: 0, y: 0 } }],
      edges: [{ source: 'a', target: 'a' }],
    })).rejects.toThrow(/loops onto itself/)
    await expect(store.saveWorkflow({
      projectId: project.id, nodes: [{ id: 'a', kind: 'script', position: { x: 'x', y: 0 } }], edges: [],
    })).rejects.toThrow(/finite coordinates/)
    await expect(store.saveWorkflow({ projectId: 'nope', nodes: [], edges: [] })).rejects.toThrow(/unknown project/)
  })

  it('cascades workflow documents with their project', async () => {
    const { store } = await makeStore()
    const project = await store.createProject('级联')
    await store.saveWorkflow({ projectId: project.id, nodes: [], edges: [] })
    await store.removeProject(project.id)
    expect(await store.listWorkflows(project.id)).toEqual([])
  })

  it('compacts duplicate asset records into the earliest one, idempotently', async () => {
    const { store, directory } = await makeStore()
    const project = await store.createProject('去重')
    // 幂等登记上线前写入的历史数据：同一（项目, 文件）三条记录
    const document = {
      schemaVersion: 1,
      projects: [{ schemaVersion: 1, id: project.id, name: '去重', createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z' }],
      assets: [0, 1, 2].map(index => ({
        schemaVersion: 1, id: `ast-${index}`, projectId: project.id, kind: 'image',
        path: '/tmp/dup.png', bytes: 10, createdAt: `2026-10-14T00:00:0${index}.000Z`,
      })),
      tasks: [], resources: [], workflows: [],
    }
    await writeFile(join(directory, 'workbench.json'), JSON.stringify(document))
    // 重新打开：宿主的缓存不会看到外部改动，维护动作必须在进程内跑
    const reopened = new WorkbenchStore({ directory })
    expect(await reopened.compactAssets()).toBe(2)
    const left = await reopened.listAssets(project.id)
    expect(left).toHaveLength(1)
    expect(left[0]?.id).toBe('ast-0')
    expect(await reopened.compactAssets()).toBe(0)
  })
})
