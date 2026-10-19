/**
 * 引用检查（`T2-4`/`T2-5` 收尾）：删素材/资源前先看谁在用，默认拒绝并指出位置。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { describeReferences, findAssetReferences, findResourceReferences } from '../src/workbench/references.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function store(): Promise<WorkbenchStore> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-workbench-refs-'))
  dirs.push(directory)
  return new WorkbenchStore({ directory })
}

describe('reference scanning', () => {
  it('finds timeline clips and workflow nodes that use an asset', () => {
    const hits = findAssetReferences({
      timelines: [{
        schemaVersion: 1, id: 'tml-1', projectId: 'prj-1', name: '成片', frameRate: 30, burnSubtitles: true,
        tracks: [
          { id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }] },
          { id: 's1', kind: 'subtitle', clips: [] },
        ],
        createdAt: '', updatedAt: '',
      }],
      workflows: [{
        schemaVersion: 1, id: 'wfl-1', projectId: 'prj-1', name: '图', createdAt: '', updatedAt: '',
        nodes: [
          { id: 'n1', kind: 'video-generate', position: { x: 0, y: 0 }, params: { prompt: 'x', referenceVideo: '/tmp/a.mp4' } },
          { id: 'n2', kind: 'image-generate', position: { x: 0, y: 0 }, params: { prompt: 'y' } },
        ],
        edges: [],
      }],
    }, { id: 'ast-1', path: '/tmp/a.mp4' })
    expect(hits).toHaveLength(2)
    expect(hits[0]).toMatchObject({ kind: 'timeline', where: 'video 轨 · 片段 c1（0ms 起）' })
    expect(hits[1]).toMatchObject({ kind: 'workflow', where: '节点 n1（video-generate）' })
    expect(describeReferences(hits)).toContain('时间轴「成片」')
    expect(describeReferences(hits)).toContain('流程图「图」')
    expect(findResourceReferences({ workflows: [] }, 'res-1')).toEqual([])
  })
})

describe('store guards', () => {
  it('refuses to delete a referenced asset unless forced', async () => {
    const workbench = await store()
    const project = await workbench.createProject('引用')
    const asset = (await workbench.attachAsset({ projectId: project.id, path: '/tmp/used.mp4', kind: 'video' })).asset
    await workbench.saveTimeline({
      projectId: project.id, name: '用了它',
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: '/tmp/used.mp4', startMs: 0, durationMs: 1000 }] }],
    })
    await expect(workbench.removeAsset(asset.id)).rejects.toThrow(/正被引用/)
    await expect(workbench.removeAsset(asset.id)).rejects.toThrow(/时间轴「用了它」/)
    expect(await workbench.listAssets(project.id)).toHaveLength(1)

    expect(await workbench.removeAsset(asset.id, { force: true })).toBe(true)
    expect(await workbench.listAssets(project.id)).toHaveLength(0)
  })

  it('also scans timelines for resource references (R-PRJ-4)', async () => {
    const workbench = await store()
    const project = await workbench.createProject('时间轴引用资源')
    const resource = await workbench.createResource({ projectId: project.id, kind: 'style', name: '夜景' })
    // 时间轴文档里出现该资源 id（未来可能来自字幕样式/渲染绑定的字段）
    await workbench.saveTimeline({
      projectId: project.id, name: '成片',
      tracks: [{ id: 's1', kind: 'subtitle', clips: [{ id: 'c1', text: '字幕', startMs: 0, durationMs: 1000, style: { color: '#ffffff' } }] }],
    })
    const timeline = (await workbench.listTimelines(project.id))[0]!
    // 直接把资源 id 写进时间轴（模拟将来的资源绑定字段），确认扫描覆盖到
    await workbench.saveTimeline({
      id: timeline.id, projectId: project.id, name: timeline.name,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: resource.id, startMs: 0, durationMs: 1000 }] }],
    })
    await expect(workbench.removeResource(resource.id)).rejects.toThrow(/时间轴/)
  })

  it('refuses to delete a resource referenced by a workflow node unless forced', async () => {
    const workbench = await store()
    const project = await workbench.createProject('资源引用')
    const resource = await workbench.createResource({ projectId: project.id, kind: 'style', name: '赛博风' })
    await workbench.saveWorkflow({
      projectId: project.id, name: '用资源', edges: [],
      // 用真正的资源引用节点：插件对节点参数有白名单，塞进 image-generate 会被规范化丢掉
      nodes: [{ id: 'n1', kind: 'resource-reference', position: { x: 0, y: 0 }, params: { resourceId: resource.id } }],
    })
    await expect(workbench.removeResource(resource.id)).rejects.toThrow(/正被引用/)
    await expect(workbench.removeResource(resource.id)).rejects.toThrow(/流程图「用资源」/)
    await expect(workbench.removeResource(resource.id)).rejects.toThrow(/force/)
    expect(await workbench.removeResource(resource.id, { force: true })).toBe(true)
  })
})
