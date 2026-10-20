/**
 * 对抗性扫荡 R6：A44–A53 新代码的边界与契约。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { estimateEtaSec } from '../src/media/render-registry.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })
async function store(): Promise<WorkbenchStore> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-r6-'))
  dirs.push(directory)
  return new WorkbenchStore({ directory })
}

describe('custom preset update contract (R6)', () => {
  it('rejects an unknown id instead of silently creating a preset', async () => {
    const workbench = await store()
    await expect(workbench.saveExportPreset({
      id: 'preset-does-not-exist', name: '幽灵预设', width: 1080, height: 1920, frameRate: 30,
    })).rejects.toThrow(/找不到要更新的导出预设/)
    expect(await workbench.listExportPresets()).toHaveLength(0) // 没有偷偷造数据
  })
})

describe('ETA extremes (R6)', () => {
  it('handles the exact boundaries without absurd numbers', () => {
    // 恰好 5% 会给估计（这是刻意的最低线）
    expect(estimateEtaSec(5, 5000)).toBe(95)
    // 99.9% 时剩余不足 1 秒 → 四舍五入为 0
    expect(estimateEtaSec(99.9, 100_000)).toBe(0)
    // 极大耗时也不产生 NaN/负值
    const huge = estimateEtaSec(50, 1e12)
    expect(huge).toBeGreaterThan(0)
    expect(Number.isFinite(huge)).toBe(true)
  })
})
