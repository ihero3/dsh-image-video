/**
 * 示例项目包验收（P1）：`examples/hello-workbench` 必须**真能导入**，不是一份摆看的 JSON。
 *
 * 两条断言分工：
 * 1. 清单自洽：版本号认得出、`files/` 里的副本 sha256 与清单一致、声称的 summary 与实际相符；
 * 2. 端到端导入：真的走 `importProjectPackage` 进一个空工作台，项目/素材/资源/工作流/
 *    时间轴都要落地，且 `missing` 为空——示例包一旦缺件，这条会立刻红。
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { importProjectPackage, PACKAGE_FORMAT_VERSION, sha256File, type ProjectPackageManifest } from '../src/workbench/package.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

const EXAMPLE = join(import.meta.dirname, '..', 'examples', 'hello-workbench')

async function exampleManifest(): Promise<ProjectPackageManifest> {
  return JSON.parse(await readFile(join(EXAMPLE, 'manifest.json'), 'utf8')) as ProjectPackageManifest
}

describe('example project package (examples/hello-workbench)', () => {
  it('is a current-format package whose file copies match their checksums', async () => {
    const manifest = await exampleManifest()
    expect(manifest.plugin).toBe('dsh-image-video')
    expect(manifest.formatVersion).toBe(PACKAGE_FORMAT_VERSION)
    expect(manifest.missing).toEqual([])
    expect(manifest.assets).toHaveLength(1)
    const asset = manifest.assets[0]!
    expect(asset.file).toBeDefined()
    // 清单里的字节数与副本完全一致；sha256 也对得上（缺一不可）
    expect(await sha256File(join(EXAMPLE, asset.file!))).toBe(asset.sha256)
    // 自描述摘要不能和实际交付打架
    expect(manifest.summary?.assets).toBe(manifest.assets.length)
    expect(manifest.summary?.timelines).toBe(manifest.timelines.length)
    expect(manifest.summary?.workflows).toBe(manifest.workflows.length)
    expect(manifest.summary?.missing).toBe(0)
    // 示例包不泄漏生成它的本机路径
    expect(asset.originPath).toBe('sample-cover.png')
  })

  it('imports into an empty workbench: project, asset, resource, workflow, timeline', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-example-store-') })
    const outputsDir = await temp('dsh-example-outputs-')
    const imported = await importProjectPackage({ store, packageDir: EXAMPLE, outputsDir })

    expect(imported.projectId).toBeTruthy()
    expect(imported.projectName).toContain('Hello Workbench')
    expect(imported.assets).toBe(1)
    expect(imported.missing).toEqual([])
    expect(imported.structureOnly).toBe(false)

    const assets = await store.listAssets(imported.projectId)
    expect(assets).toHaveLength(1)
    expect(assets[0]!.kind).toBe('image')
    // 素材文件真的被复制到 outputs，而不是只写了一条记录
    expect(await sha256File(assets[0]!.path)).toBe((await exampleManifest()).assets[0]!.sha256)

    expect(await store.listResources(imported.projectId)).toHaveLength(1)

    const workflows = await store.listWorkflows(imported.projectId)
    expect(workflows).toHaveLength(1)
    expect(workflows[0]!.nodes).toHaveLength(3)
    expect(workflows[0]!.edges).toHaveLength(2)
    // 三节点是一条链：creative-input → image-generate → video-generate
    expect(workflows[0]!.nodes.map(node => node.kind)).toEqual(['creative-input', 'image-generate', 'video-generate'])

    const timelines = await store.listTimelines(imported.projectId)
    expect(timelines).toHaveLength(1)
    expect(timelines[0]!.tracks).toHaveLength(2)
    expect(timelines[0]!.tracks.map(track => track.kind)).toEqual(['video', 'subtitle'])
  })
})
