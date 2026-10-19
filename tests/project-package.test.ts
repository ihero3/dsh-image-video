/**
 * 项目包导出（`T8-1`）：清单带格式版本、素材目录、每个文件的 sha256；源文件丢了如实记 missing。
 */
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { PACKAGE_FORMAT_VERSION, exportProjectPackage, importProjectPackage, safeName, sha256File } from '../src/workbench/package.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

describe('project package export (T8-1)', () => {
  it('writes a manifest with format version, asset copies and checksums', async () => {
    const workbenchDir = await temp('dsh-pkg-store-')
    const sources = await temp('dsh-pkg-src-')
    const target = await temp('dsh-pkg-out-')
    const store = new WorkbenchStore({ directory: workbenchDir })
    const project = await store.createProject('打包项目')

    const first = join(sources, 'shot.png')
    await writeFile(first, 'image-bytes')
    await store.attachAsset({ projectId: project.id, path: first, kind: 'image', prompt: '一只猫' })
    const gone = join(sources, 'gone.mp4')
    await store.attachAsset({ projectId: project.id, path: gone, kind: 'video' })
    await store.createResource({ projectId: project.id, kind: 'style', name: '赛博风' })
    await store.saveTimeline({
      projectId: project.id, name: '成片',
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: first, startMs: 0, durationMs: 1000 }] }],
    })
    await store.saveWorkflow({
      projectId: project.id, name: '图', edges: [], nodes: [{ id: 'n1', kind: 'preview', position: { x: 0, y: 0 }, params: {} }],
    })

    const { manifestPath, manifest } = await exportProjectPackage({ store, projectId: project.id, targetDir: target, now: () => new Date('2026-10-16T08:00:00.000Z') })
    expect(manifest.formatVersion).toBe(PACKAGE_FORMAT_VERSION)
    expect(manifest.plugin).toBe('dsh-image-video')
    expect(manifest.exportedAt).toBe('2026-10-16T08:00:00.000Z')
    expect(manifest.project.name).toBe('打包项目')
    expect(manifest.resources).toHaveLength(1)
    expect(manifest.timelines).toHaveLength(1)
    expect(manifest.workflows).toHaveLength(1)

    // 复制进包、校验和正确
    const copied = manifest.assets.find(entry => entry.originPath === first)
    expect(copied?.file).toBeDefined()
    expect(copied?.bytes).toBe('image-bytes'.length)
    expect(copied?.sha256).toBe(await sha256File(first))
    expect((await stat(join(target, copied!.file!))).size).toBe('image-bytes'.length)

    // 源文件不在 → 如实记 missing，不假装成功
    expect(manifest.missing).toEqual([gone])
    const lost = manifest.assets.find(entry => entry.originPath === gone)
    expect(lost?.file).toBeUndefined()
    expect(lost?.sha256).toBeUndefined()

    // 清单本身可解析且落在包里
    const written = JSON.parse(await readFile(manifestPath, 'utf8')) as { formatVersion: number }
    expect(written.formatVersion).toBe(PACKAGE_FORMAT_VERSION)
    expect(manifestPath).toBe(join(target, 'manifest.json'))
  })

  it('refuses unknown projects and sanitizes package directory names', async () => {
    const workbenchDir = await temp('dsh-pkg-store2-')
    const store = new WorkbenchStore({ directory: workbenchDir })
    await expect(exportProjectPackage({ store, projectId: 'nope', targetDir: await temp('dsh-pkg-out2-') }))
      .rejects.toThrow(/unknown project/)
    expect(safeName('验收：资源与改名 / v2')).toBe('验收-资源与改名-v2')
  })
})

describe('project package import (T8-2)', () => {
  it('round-trips a project: files land in outputs, paths are rewritten, tasks become imported-idle', async () => {
    const sourceStore = new WorkbenchStore({ directory: await temp('dsh-imp-store-') })
    const sources = await temp('dsh-imp-src-')
    const pack = await temp('dsh-imp-pack-')
    const project = await sourceStore.createProject('原项目')
    const clip = join(sources, 'clip.mp4')
    await writeFile(clip, 'video-bytes')
    await sourceStore.attachAsset({ projectId: project.id, path: clip, kind: 'video', prompt: '齿轮' })
    await sourceStore.saveTimeline({
      projectId: project.id, name: '成片', burnSubtitles: false,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: clip, startMs: 0, durationMs: 1000 }] }],
    })
    // 账本里留一条"看起来还在跑"的任务，导入后必须变成 imported-idle
    await sourceStore.recordTask({ projectId: project.id, kind: 'video', status: 'running', model: 'minimax-h3', prompt: '齿轮', provider: 'threerouter' })
    await exportProjectPackage({ store: sourceStore, projectId: project.id, targetDir: pack })

    const targetStore = new WorkbenchStore({ directory: await temp('dsh-imp-target-') })
    const outputs = await temp('dsh-imp-out-')
    const result = await importProjectPackage({ store: targetStore, packageDir: pack, outputsDir: outputs })

    expect(result.projectName).toContain('（导入）')
    expect(result.assets).toBe(1)
    expect(result.missing).toEqual([])
    expect(result.tasksImported).toBe(1)

    // 素材落到新 outputs，时间轴里的路径被改写指向它
    const imported = await targetStore.listAssets(result.projectId)
    expect(imported).toHaveLength(1)
    expect(imported[0]?.path.startsWith(outputs)).toBe(true)
    const timeline = (await targetStore.listTimelines(result.projectId))[0]
    expect(timeline?.tracks[0]?.clips[0]?.assetPath).toBe(imported[0]?.path)

    // 活动任务一律 imported-idle，绝不自动续跑
    const tasks = await targetStore.listTasks(50, result.projectId)
    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.status).toBe('imported-idle')
    expect(tasks[0]?.id).not.toBe('') // 重新分配了 id，不覆盖本机账本里的 id
  })

  it('compares checksums and reports tampered copies as missing', async () => {
    const sourceStore = new WorkbenchStore({ directory: await temp('dsh-tamper-store-') })
    const sources = await temp('dsh-tamper-src-')
    const pack = await temp('dsh-tamper-pack-')
    const project = await sourceStore.createProject('被改过的包')
    const file = join(sources, 'a.png')
    await writeFile(file, 'original')
    await sourceStore.attachAsset({ projectId: project.id, path: file, kind: 'image' })
    const { manifest } = await exportProjectPackage({ store: sourceStore, projectId: project.id, targetDir: pack })

    const entry = manifest.assets[0]!
    await writeFile(join(pack, entry.file!), 'tampered')
    const targetStore = new WorkbenchStore({ directory: await temp('dsh-tamper-target-') })
    const result = await importProjectPackage({ store: targetStore, packageDir: pack, outputsDir: await temp('dsh-tamper-out-') })
    expect(result.missing.join(' ')).toMatch(/校验和不符/)
    expect(result.assets).toBe(0)
    await expect(stat(join(pack, entry.file!))).resolves.toBeDefined()
  })

  it('refuses an unknown package format version and supports structure-only import', async () => {
    const sourceStore = new WorkbenchStore({ directory: await temp('dsh-fmt-store-') })
    const sources = await temp('dsh-fmt-src-')
    const pack = await temp('dsh-fmt-pack-')
    const project = await sourceStore.createProject('格式项目')
    const file = join(sources, 'a.png')
    await writeFile(file, 'x')
    await sourceStore.attachAsset({ projectId: project.id, path: file, kind: 'image' })
    await sourceStore.saveTimeline({
      projectId: project.id, name: '成片',
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: file, startMs: 0, durationMs: 500 }] }],
    })
    await exportProjectPackage({ store: sourceStore, projectId: project.id, targetDir: pack })

    // 未来版本必须拒绝并说清支持范围
    const manifestPath = join(pack, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { formatVersion: number }
    await writeFile(manifestPath, JSON.stringify({ ...manifest, formatVersion: 99 }), 'utf8')
    const target = new WorkbenchStore({ directory: await temp('dsh-fmt-target-') })
    await expect(importProjectPackage({ store: target, packageDir: pack, outputsDir: await temp('dsh-fmt-out-') }))
      .rejects.toThrow(/格式版本 99/)

    // 仅结构：不复制文件，全部进 missing，但结构（时间轴）仍在
    await writeFile(manifestPath, JSON.stringify({ ...manifest, formatVersion: 1 }), 'utf8')
    const structure = await importProjectPackage({
      store: target, packageDir: pack, outputsDir: await temp('dsh-fmt-out2-'), mode: 'structure-only',
    })
    expect(structure.structureOnly).toBe(true)
    expect(structure.missing).toHaveLength(1)
    expect(await target.listTimelines(structure.projectId)).toHaveLength(1)
  })
})
