/**
 * 项目包 v2（Track A / A26）：新字段入库（特效/转场/音轨淡入淡出/响度/资源使用记录），
 * 且**旧包（formatVersion=1）仍可导入**。
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { PACKAGE_FORMAT_VERSION, exportProjectPackage, importProjectPackage, inspectProjectPackage } from '../src/workbench/package.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })
async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

/** 一个带特效/转场/音轨观感/资源使用记录的项目。 */
async function seed(): Promise<{ store: WorkbenchStore; projectId: string; resourceId: string }> {
  const directory = await temp('dsh-pkg-')
  const store = new WorkbenchStore({ directory })
  const project = await store.createProject('包测试')
  const resource = await store.createResource({ projectId: project.id, kind: 'style', name: '赛博风' })
  await store.saveTimeline({
    projectId: project.id, normalizeLoudness: true,
    exportFormat: { width: 1080, height: 1920, frameRate: 30 },
    tracks: [
      { id: 'v1', kind: 'video', clips: [{
        id: 'c1', assetPath: 'outputs/a.mp4', startMs: 0, durationMs: 1000,
        speed: 1.5, fade: 200, transition: 'fade', transitionDurationMs: 300,
      }] },
      { id: 'a1', kind: 'audio', fadeMs: 500, clips: [] },
    ],
  })
  await store.recordResourceUsage([{
    resourceId: resource.id, projectId: project.id, assetPath: 'outputs/a.mp4',
    runId: 'run-1', nodeId: 'v', at: '2026-10-19T00:00:00.000Z',
  }])
  return { store, projectId: project.id, resourceId: resource.id }
}

describe('package format v2 (A26)', () => {
  it('exports the current format version with resource usage included', async () => {
    const { store, projectId } = await seed()
    const targetDir = await temp('dsh-pkg-out-')
    const { manifestPath, manifest } = await exportProjectPackage({ store, projectId, targetDir })
    expect(manifest.formatVersion).toBe(PACKAGE_FORMAT_VERSION)
    expect(manifest.resourceUsage?.length).toBe(1)
    const onDisk = JSON.parse(await readFile(manifestPath, 'utf8')) as { formatVersion: number }
    expect(onDisk.formatVersion).toBe(PACKAGE_FORMAT_VERSION)
  })

  it('exports formatVersion 3 with custom presets and restores burnLanguage (A53)', async () => {
    expect(PACKAGE_FORMAT_VERSION).toBe(3)
    const { store, projectId } = await seed()
    // 造一条带语言设置的字幕轨 + 一个自定义预设
    const timeline = (await store.listTimelines(projectId))[0]!
    await store.saveTimeline({
      id: timeline.id, projectId, name: timeline.name, tracks: [
        ...timeline.tracks,
        { id: 's-en', kind: 'subtitle', language: 'en', clips: [{ id: 'c', text: 'hello', startMs: 0, durationMs: 500 }] },
      ],
      frameRate: timeline.frameRate, burnSubtitles: true, burnLanguage: 'en',
      exportFormat: timeline.exportFormat, normalizeLoudness: timeline.normalizeLoudness,
    })
    await store.saveExportPreset({ name: '包裹预设', width: 1080, height: 1920, frameRate: 30 })

    const targetDir = await temp('dsh-pkg3-out-')
    const { manifestPath } = await exportProjectPackage({ store, projectId, targetDir })
    const onDisk = JSON.parse(await readFile(manifestPath, 'utf8')) as { formatVersion: number; exportPresets?: unknown[] }
    expect(onDisk.formatVersion).toBe(3)
    expect(onDisk.exportPresets).toHaveLength(1)

    const outputsDir = await temp('dsh-pkg3-io-')
    const fresh = new WorkbenchStore({ directory: await temp('dsh-pkg3-fresh-') })
    const imported = await importProjectPackage({ store: fresh, packageDir: targetDir, outputsDir })
    const reopened = (await fresh.listTimelines(imported.projectId))[0]!
    expect(reopened.burnLanguage).toBe('en')
    expect(reopened.tracks.some(track => track.language === 'en')).toBe(true)
    expect((await fresh.listExportPresets()).map(preset => preset.name)).toContain('包裹预设')
  })

  it('still imports a legacy v2 package (no exportPresets)', async () => {
    const directory = await temp('dsh-pkg-v2-')
    const store = new WorkbenchStore({ directory })
    const targetDir = await temp('dsh-pkg-v2-out-')
    await writeFile(join(targetDir, 'manifest.json'), JSON.stringify({
      formatVersion: 2, plugin: 'dsh-image-video', exportedAt: '2026-10-01T00:00:00.000Z',
      project: { id: 'prj-v2', name: 'v2 老包', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
      assets: [], resources: [], timelines: [], workflows: [], tasks: [], missing: [], resourceUsage: [],
    }), 'utf8')
    await importProjectPackage({ store, packageDir: targetDir, outputsDir: targetDir })
    expect((await store.listProjects())[0]?.name).toContain('v2 老包')
  })

  it('round-trips effects, loudness and usage records into the new project', async () => {
    const { store, projectId } = await seed()
    const targetDir = await temp('dsh-pkg-round-')
    const { manifestPath } = await exportProjectPackage({ store, projectId, targetDir })
    const outputsDir = await temp('dsh-pkg-outputs-')
    await importProjectPackage({ store, packageDir: targetDir, outputsDir })
    const importedProject = (await store.listProjects())[0]!
    const timeline = (await store.listTimelines(importedProject.id))[0]!
    const clip = timeline.tracks[0]!.clips[0]!
    // 片段级转场随 tracks 一起走 ✓
    expect(clip.transition).toBe('fade')
    expect(clip.transitionDurationMs).toBe(300)
    // `A29` 修掉的 bug：numberField 曾对 speed 取整，1.5 被悄悄变成 2 → 现在必须严格相等
    expect(clip.speed).toBe(1.5)
    expect(timeline.tracks[1]!.fadeMs).toBe(500)
    expect(timeline.normalizeLoudness).toBe(true)
    expect(timeline.exportFormat).toMatchObject({ width: 1080, height: 1920 })
    // 使用记录跟着换到新项目
    expect((await store.listResourceUsage({ projectId: importedProject.id })).length).toBe(1)
  })

  it('still imports a legacy v1 package (no resourceUsage field)', async () => {
    const directory = await temp('dsh-pkg-v1-')
    const store = new WorkbenchStore({ directory })
    const targetDir = await temp('dsh-pkg-v1-out-')
    // 手工造一个 v1 包（v1 的清单没有 resourceUsage）
    await writeFile(join(targetDir, 'manifest.json'), JSON.stringify({
      formatVersion: 1, plugin: 'dsh-image-video', exportedAt: '2026-10-01T00:00:00.000Z',
      project: { id: 'prj-old', name: '老包', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
      assets: [], resources: [], timelines: [], workflows: [], tasks: [], missing: [],
    }), 'utf8')
    await importProjectPackage({ store, packageDir: targetDir, outputsDir: targetDir })
    // 同名项目会自动加后缀，避免覆盖已有项目（T8-2 的设计）
    expect((await store.listProjects())[0]?.name).toBe('老包（导入）')
  })

  it('rejects an unknown future format version', async () => {
    const directory = await temp('dsh-pkg-bad-')
    const store = new WorkbenchStore({ directory })
    const targetDir = await temp('dsh-pkg-bad-out-')
    await writeFile(join(targetDir, 'manifest.json'), JSON.stringify({
      formatVersion: 99, plugin: 'dsh-image-video', exportedAt: '', project: { id: 'p', name: 'x', createdAt: '', updatedAt: '' },
      assets: [], resources: [], timelines: [], workflows: [], tasks: [], missing: [],
    }), 'utf8')
    await expect(importProjectPackage({ store, packageDir: targetDir, outputsDir: targetDir })).rejects.toThrow(/不认识/)
  })
})

describe('package sha256 verification (A110)', () => {
  it('verifies delivered files and flags tampered ones', async () => {
    const { store, projectId } = await seed()
    const targetDir = await temp('dsh-pkg-verify-')
    const { manifestPath } = await exportProjectPackage({ store, projectId, targetDir })
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { assets: Array<{ file?: string }> }

    // 干净包：校验通过
    const clean = await inspectProjectPackage({ packageDir: targetDir, store, verifyFiles: true })
    expect(clean.verified).toBe(true)
    expect(clean.tampered).toEqual([])

    // 默认不校验（省时间）
    expect((await inspectProjectPackage({ packageDir: targetDir, store })).verified).toBeUndefined()

    // 改坏一个包内素材 → 哈希对不上
    const entry = manifest.assets.find(asset => asset.file !== undefined)
    if (entry?.file !== undefined) {
      await writeFile(join(targetDir, entry.file), 'corrupted-bytes')
      const dirty = await inspectProjectPackage({ packageDir: targetDir, store, verifyFiles: true })
      expect(dirty.verified).toBe(false)
      expect(dirty.tampered?.length).toBeGreaterThan(0)
      expect(dirty.warnings.join(' ')).toContain('sha256')
    }
  })
})

describe('package self-description (A106)', () => {
  it('writes a summary into the manifest and surfaces it on inspect', async () => {
    const { store, projectId } = await seed()
    const targetDir = await temp('dsh-pkg-summary-')
    const { manifestPath } = await exportProjectPackage({ store, projectId, targetDir })
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { summary?: { projectName: string; pluginVersion: string; timelines: number } }
    expect(manifest.summary?.projectName.length).toBeGreaterThan(0)
    expect(manifest.summary?.pluginVersion.length).toBeGreaterThan(0)
    expect(manifest.summary?.timelines).toBeGreaterThanOrEqual(0)
    const inspection = await inspectProjectPackage({ packageDir: targetDir, store })
    expect(inspection.exportedSummary?.pluginVersion).toBe(manifest.summary?.pluginVersion)
  })
})

describe('inspectProjectPackage (A96)', () => {
  it('reports a real package without touching any data', async () => {
    const { store, projectId } = await seed()
    const before = (await store.listProjects()).length
    const targetDir = await temp('dsh-pkg-inspect-')
    await exportProjectPackage({ store, projectId, targetDir })
    const inspection = await inspectProjectPackage({ packageDir: targetDir, store })
    expect(inspection.compatible).toBe(true)
    expect(inspection.formatVersion).toBe(PACKAGE_FORMAT_VERSION)
    expect(inspection.project.name.length).toBeGreaterThan(0)
    expect(inspection.assets.total).toBeGreaterThanOrEqual(0)
    // 只读：项目数没变
    expect((await store.listProjects()).length).toBe(before)
  })

  it('flags packages from a newer plugin as incompatible', async () => {
    const directory = await temp('dsh-pkg-inspect-v9-')
    await writeFile(join(directory, 'manifest.json'), JSON.stringify({
      formatVersion: PACKAGE_FORMAT_VERSION + 1, project: { name: '未来包' }, assets: [], timelines: [], missing: [],
    }), 'utf8')
    const store = new WorkbenchStore({ directory: await temp('dsh-pkg-inspect-store-') })
    const inspection = await inspectProjectPackage({ packageDir: directory, store })
    expect(inspection.compatible).toBe(false)
    expect(inspection.reason).toContain('高于当前支持')
    expect(inspection.warnings.length).toBeGreaterThanOrEqual(0)
  })
})
