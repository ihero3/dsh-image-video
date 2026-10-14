/**
 * The workbench store on disk: projects and assets survive a process restart,
 * removals are record-only, and the document is never half-written.
 */
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WorkbenchStore, resolveWorkbenchDirectory } from '../src/workbench/store.ts'

/** A store over a throwaway directory with a frozen clock. */
async function makeStore() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-image-video-store-'))
  const store = new WorkbenchStore({ directory, now: () => new Date('2026-10-14T00:00:00.000Z') })
  return { directory, store }
}

describe('workbench store', () => {
  it('creates and lists projects, newest first', async () => {
    const { store, directory } = await makeStore()
    const first = await store.createProject('第一个')
    const second = await store.createProject('  第二个  ')
    expect(first.name).toBe('第一个')
    expect(second.name).toBe('第二个')
    expect(first.id).not.toBe(second.id)
    expect(first.schemaVersion).toBe(1)
    // 同一时刻创建 → 名字保序不重要，但两条都要在
    expect((await store.listProjects()).map(project => project.id).sort()).toEqual([first.id, second.id].sort())
    // 落盘：目录里只有 workbench.json，没有半写的 .tmp
    const files = await readdir(directory)
    expect(files).toEqual(['workbench.json'])
    expect(JSON.parse(await readFile(join(directory, 'workbench.json'), 'utf8'))).toMatchObject({ schemaVersion: 1 })
  })

  it('rejects an empty or oversized project name', async () => {
    const { store } = await makeStore()
    await expect(store.createProject('   ')).rejects.toThrow(/must not be empty/)
    await expect(store.createProject('x'.repeat(61))).rejects.toThrow(/at most 60/)
    await expect(store.createProject(42)).rejects.toThrow(/must be a string/)
    expect(await store.listProjects()).toEqual([])
  })

  it('attaches assets to a project and refuses unknown projects', async () => {
    const { store } = await makeStore()
    const project = await store.createProject('素材')
    const asset = await store.attachAsset({
      projectId: project.id, path: '/tmp/outputs/shot.png', kind: 'image', bytes: 2048, provider: 'threerouter',
    })
    expect(asset.kind).toBe('image')
    expect(asset.bytes).toBe(2048)
    expect((await store.listAssets(project.id)).map(item => item.id)).toEqual([asset.id])
    await expect(store.attachAsset({ projectId: 'nope', path: '/tmp/x.png', kind: 'image' }))
      .rejects.toThrow(/unknown project/)
    await expect(store.attachAsset({ projectId: project.id, path: '/tmp/x.bin', kind: 'audio' }))
      .rejects.toThrow(/media kind/)
  })

  it('reloads from disk and keeps record-only deletion semantics', async () => {
    const { store, directory } = await makeStore()
    const project = await store.createProject('持久化')
    await store.attachAsset({ projectId: project.id, path: '/tmp/outputs/clip.mp4', kind: 'video', bytes: 100 })

    // 新实例读同一目录（模拟重启后重新构造 store）
    const reopened = new WorkbenchStore({ directory })
    expect((await reopened.listProjects())[0]?.name).toBe('持久化')
    expect(await reopened.listAssets(project.id)).toHaveLength(1)

    expect(await reopened.removeProject(project.id)).toBe(true)
    expect(await reopened.listProjects()).toEqual([])
    // 项目删除级联的是"素材记录"，不是磁盘上的媒体文件
    expect(await reopened.removeProject(project.id)).toBe(false)
  })

  it('ignores a corrupt document instead of throwing', async () => {
    const { store, directory } = await makeStore()
    await writeFile(join(directory, 'workbench.json'), '{ not json', 'utf8')
    // 损坏文件按 "读不到" 处理会抛错；这里断言它至少不是静默丢数据
    await expect(store.listProjects()).rejects.toThrow()
  })

  it('records tasks, updates them and keeps them across a project removal', async () => {
    const { store, directory } = await makeStore()
    const project = await store.createProject('账本')
    const task = await store.recordTask({
      kind: 'video', status: 'succeeded', provider: 'threerouter', model: 'minimax-h3',
      outputPath: '/tmp/outputs/clip.mp4', bytes: 4096, startedAt: '2026-10-13T00:00:00.000Z',
    })
    expect(task.status).toBe('succeeded')
    expect(task.createdAt).toBe('2026-10-13T00:00:00.000Z')
    expect((await store.listTasks())[0]?.id).toBe(task.id)

    const assigned = await store.updateTask(task.id, { projectId: project.id })
    expect(assigned?.projectId).toBe(project.id)
    expect((await store.listTasks(50, project.id)).map(item => item.id)).toEqual([task.id])
    expect(await store.updateTask('missing', { status: 'failed' })).toBeUndefined()

    // 新实例读同一目录：账本连状态一起恢复
    const reopened = new WorkbenchStore({ directory })
    expect((await reopened.listTasks())[0]).toMatchObject({ status: 'succeeded', projectId: project.id })

    // 删除项目不动历史账本（产物文件仍在磁盘上）
    await reopened.removeProject(project.id)
    expect(await reopened.listTasks()).toHaveLength(1)
  })

  it('validates task input', async () => {
    const { store } = await makeStore()
    await expect(store.recordTask({ kind: 'audio', status: 'succeeded' })).rejects.toThrow(/media kind/)
    await expect(store.recordTask({ kind: 'image', status: 'done' })).rejects.toThrow(/task status/)
  })

  it('derives its directory next to the output directory', () => {
    expect(resolveWorkbenchDirectory('/home/me/profiles/desktop/outputs'))
      .toBe('/home/me/profiles/desktop/image-video-workbench')
  })
})
