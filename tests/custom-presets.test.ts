/**
 * 自定义导出预设（Track A / A48）：全局库 + schema v4 迁移。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { WORKBENCH_SCHEMA_VERSION } from '../src/workbench/records.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })
async function store(): Promise<WorkbenchStore> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-preset-'))
  dirs.push(directory)
  return new WorkbenchStore({ directory })
}

describe('custom export presets (A48)', () => {
  it('saves, lists, updates and removes presets with validation', async () => {
    const workbench = await store()
    const created = await workbench.saveExportPreset({ name: '我的竖屏', width: 1080, height: 1920, frameRate: 30 })
    expect(created).toMatchObject({ name: '我的竖屏', width: 1080, height: 1920, frameRate: 30 })
    expect((await workbench.listExportPresets())).toHaveLength(1)

    // 重名拒绝
    await expect(workbench.saveExportPreset({ name: '我的竖屏', width: 720, height: 1280, frameRate: 30 }))
      .rejects.toThrow(/同名/)
    // 非法规格拒绝（奇数宽）
    await expect(workbench.saveExportPreset({ name: '坏的', width: 641, height: 360, frameRate: 30 }))
      .rejects.toThrow(/even number/)
    // 空名拒绝
    await expect(workbench.saveExportPreset({ name: '   ', width: 640, height: 360, frameRate: 30 }))
      .rejects.toThrow(/1–40/)

    // 覆盖更新（同 id 改名）
    const updated = await workbench.saveExportPreset({ id: created.id, name: '我的竖屏 4K', width: 2160, height: 3840, frameRate: 60 })
    expect(updated.id).toBe(created.id)
    expect(updated).toMatchObject({ name: '我的竖屏 4K', width: 2160, height: 3840, frameRate: 60 })

    expect(await workbench.removeExportPreset(created.id)).toBe(true)
    expect(await workbench.removeExportPreset(created.id)).toBe(false)
    expect((await workbench.listExportPresets())).toHaveLength(0)
  })

  it('persists presets and survives a reopen at the current schema version', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-preset-persist-'))
    dirs.push(directory)
    const workbench = new WorkbenchStore({ directory })
    await workbench.saveExportPreset({ name: '持久化', width: 1080, height: 1080, frameRate: 30 })
    const reopened = new WorkbenchStore({ directory })
    const presets = await reopened.listExportPresets()
    expect(presets).toHaveLength(1)
    expect(presets[0]?.name).toBe('持久化')
    expect(WORKBENCH_SCHEMA_VERSION).toBe(5)
  })
})
