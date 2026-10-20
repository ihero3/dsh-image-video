/**
 * 资源包导出/导入与去重（`T8-3`）+ 跨机器口径（`T8-4`）。
 *
 * 去重口径：**默认绝不覆盖同名资源**；冲突按 `skip`/`rename`/`replace` 处理并逐条报出来。
 * 跨机器口径：包在**另一台机器/另一套目录**上导入后自包含——素材落在本机 outputs、
 * 时间轴与节点里的路径都指回来，不再引用源机器上的临时路径。
 */
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { PACKAGE_FORMAT_VERSION, exportProjectPackage, exportResourcePackage, importProjectPackage, importResourcePackage } from '../src/workbench/package.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

const track = [{ tMs: 0, x: 0.1, y: 0.5 }, { tMs: 1500, x: 0.8, y: 0.4, scale: 1.2 }]

describe('resource packages (T8-3)', () => {
  it('never overwrites same-name resources by default, and offers rename / replace', async () => {
    const source = new WorkbenchStore({ directory: await temp('dsh-rp-src-') })
    const sourceProject = await source.createProject('素材库')
    await source.createResource({ projectId: sourceProject.id, kind: 'style', name: '赛博风', note: '冷色调' })
    await source.createResource({ projectId: sourceProject.id, kind: 'motion-track', name: '镜头 A', keyframes: track })
    const pack = await temp('dsh-rp-pack-')
    const { manifestPath, manifest } = await exportResourcePackage({ store: source, projectId: sourceProject.id, targetDir: pack })
    expect(manifest.formatVersion).toBe(PACKAGE_FORMAT_VERSION)
    expect(manifest.resources).toHaveLength(2)
    expect(manifest.resources.find(item => item.kind === 'motion-track')?.keyframes).toEqual(track)
    expect(JSON.parse(await readFile(manifestPath, 'utf8'))).toBeDefined()

    // 目标项目里已有同名同 kind 的资源
    const target = new WorkbenchStore({ directory: await temp('dsh-rp-target-') })
    const project = await target.createProject('目标')
    const existing = await target.createResource({ projectId: project.id, kind: 'style', name: '赛博风', note: '本机的' })

    const skipped = await importResourcePackage({ store: target, projectId: project.id, packageDir: pack })
    expect(skipped.imported).toBe(1) // 只有"镜头 A"是新名字
    expect(skipped.skipped).toEqual(['赛博风'])
    const afterSkip = await target.listResources(project.id)
    expect(afterSkip.find(item => item.id === existing.id)?.note).toBe('本机的')

    const renamed = await importResourcePackage({ store: target, projectId: project.id, packageDir: pack, strategy: 'rename' })
    expect(renamed.renamed.join(' ')).toContain('赛博风 → 赛博风 (2)')
    expect((await target.listResources(project.id)).some(item => item.name === '赛博风 (2)')).toBe(true)

    const replaced = await importResourcePackage({ store: target, projectId: project.id, packageDir: pack, strategy: 'replace' })
    // 上一轮 rename 已把"镜头 A"导进来，所以这次两个同名都被替换（行为正确）
    expect([...replaced.replaced].sort()).toEqual(['镜头 A', '赛博风'].sort())
    const afterReplace = await target.listResources(project.id).then(rows => rows.filter(item => item.name === '赛博风'))
    expect(afterReplace).toHaveLength(1)
    expect(afterReplace[0]?.note).toBe('冷色调') // 已被包里的版本替换
  })

  it('refuses an unknown resource package version', async () => {
    const pack = await temp('dsh-rp-bad-')
    await writeFile(join(pack, 'resources.json'), JSON.stringify({
      formatVersion: 99, plugin: 'dsh-image-video', exportedAt: '', source: { projectId: 'p', projectName: 'p' }, resources: [],
    }), 'utf8')
    const store = new WorkbenchStore({ directory: await temp('dsh-rp-bad-target-') })
    const project = await store.createProject('x')
    await expect(importResourcePackage({ store, projectId: project.id, packageDir: pack })).rejects.toThrow(/格式版本 99/)
  })
})

describe('cross-machine import (T8-4)', () => {
  it('imports a package copied to another directory and stays self-contained', async () => {
    // 机器 A：造项目 + 素材 + 时间轴 + 资源，导出包
    const machineA = new WorkbenchStore({ directory: await temp('dsh-xa-store-') })
    const machineAFiles = await temp('dsh-xa-files-')
    const projectA = await machineA.createProject('跨机器项目')
    const clip = join(machineAFiles, 'clip.mp4')
    await writeFile(clip, 'video-bytes')
    await machineA.attachAsset({ projectId: projectA.id, path: clip, kind: 'video' })
    await machineA.saveTimeline({
      projectId: projectA.id, name: '成片',
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: clip, startMs: 0, durationMs: 1000 }] }],
    })
    await machineA.createResource({ projectId: projectA.id, kind: 'style', name: '风格 A' })
    const exported = await exportProjectPackage({ store: machineA, projectId: projectA.id, targetDir: await temp('dsh-xa-pack-') })

    // 把包"搬"到另一个目录（模拟拷到另一台机器），断网也不影响：整条链只用文件系统
    const movedPack = await temp('dsh-xb-pack-')
    await cp(join(exported.manifestPath, '..'), movedPack, { recursive: true })

    const machineB = new WorkbenchStore({ directory: await temp('dsh-xb-store-') })
    const machineBOutputs = await temp('dsh-xb-outputs-')
    const result = await importProjectPackage({ store: machineB, packageDir: movedPack, outputsDir: machineBOutputs })
    expect(result.missing).toEqual([])

    // 自包含：素材与时间轴都指向本机 outputs，源码器上的临时路径不再出现
    const assets = await machineB.listAssets(result.projectId)
    expect(assets[0]?.path.startsWith(machineBOutputs)).toBe(true)
    const timeline = (await machineB.listTimelines(result.projectId))[0]
    expect(timeline?.tracks[0]?.clips[0]?.assetPath).toBe(assets[0]?.path)
    const serialized = JSON.stringify(await machineB.listTimelines(result.projectId))
    expect(serialized).not.toContain(machineAFiles)

    // 资源包同样不覆盖同名（默认 skip）
    const target = await machineB.createProject('机器 B 已有同名资源')
    await machineB.createResource({ projectId: target.id, kind: 'style', name: '风格 A', note: '本机版本' })
    await exportResourcePackage({ store: machineA, projectId: projectA.id, targetDir: await temp('dsh-xb-res-pack-') })
    const pack2 = await temp('dsh-xb-res-pack2-')
    await exportResourcePackage({ store: machineA, projectId: projectA.id, targetDir: pack2 })
    const importedResources = await importResourcePackage({ store: machineB, projectId: target.id, packageDir: pack2 })
    expect(importedResources.skipped).toEqual(['风格 A'])
    expect((await machineB.listResources(target.id)).find(item => item.name === '风格 A')?.note).toBe('本机版本')
  }, 30_000)
})
