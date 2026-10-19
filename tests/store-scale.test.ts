/**
 * 存储规模化基线（Track A / A8）：一万素材量级的读/写延迟。
 *
 * 断言用**宽松上限**（防 CI 抖动误报），真实数字打印出来供 `docs/PERF.md` 记录。
 * 关键收益来自 `A8` 的按项目索引：`listAssets` 从"每次全表扫描"变成"建一次索引 O(n) + O(1) 读取"。
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { WorkbenchStore } from '../src/workbench/store.ts'

const ASSETS = 10_000
const PROJECTS = 20
const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })
async function temp(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-scale-'))
  dirs.push(directory)
  return directory
}

function seedDocument() {
  const now = Date.UTC(2026, 9, 1)
  const projects = Array.from({ length: PROJECTS }, (_, index) => ({
    schemaVersion: 2, id: `prj-${index}`, name: `项目 ${index}`,
    createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
  }))
  const assets = Array.from({ length: ASSETS }, (_, index) => ({
    schemaVersion: 2, id: `ast-${index}`, projectId: `prj-${index % PROJECTS}`,
    name: `素材 ${index}`, path: `outputs/asset-${index}.mp4`, kind: index % 2 === 0 ? 'image' : 'video',
    bytes: 1024, createdAt: new Date(now + index).toISOString(),
  }))
  return {
    schemaVersion: 2, projects, assets, tasks: [] as never[], resources: [] as never[],
    workflows: [] as never[], runs: [] as never[], timelines: [] as never[], nodeCache: [] as never[], resourceUsage: [] as never[],
  }
}

describe(`store scale (A8, ${ASSETS} assets / ${PROJECTS} projects)`, () => {
  it('loads, queries and writes within generous budgets', async () => {
    const directory = await temp()
    const seeded = JSON.stringify(seedDocument())
    await writeFile(join(directory, 'workbench.json'), seeded, 'utf8')
    console.log(`[scale] 文档大小: ${(seeded.length / 1024 / 1024).toFixed(2)} MB`)

    const store = new WorkbenchStore({ directory })
    const coldStart = performance.now()
    expect((await store.listProjects()).length).toBe(PROJECTS)
    const coldLoad = performance.now() - coldStart
    console.log(`[scale] 冷加载: ${coldLoad.toFixed(1)} ms`)

    // 索引正确性：与"手工过滤"的结果必须一致
    const projectId = 'prj-3'
    const viaStore = await store.listAssets(projectId)
    const expected = (seedDocument().assets as Array<{ projectId: string; id: string }>)
      .filter(asset => asset.projectId === projectId).map(asset => asset.id).sort()
    expect(viaStore.map(asset => asset.id).sort()).toEqual(expected)

    const firstQuery = performance.now()
    await store.listAssets(projectId)
    const firstQueryMs = performance.now() - firstQuery
    const repeatedStart = performance.now()
    for (let round = 0; round < 20; round += 1) await store.listAssets(projectId)
    const repeatedMs = (performance.now() - repeatedStart) / 20
    console.log(`[scale] listAssets 首次: ${firstQueryMs.toFixed(1)} ms · 后续均值: ${repeatedMs.toFixed(2)} ms`)

    // 写一次：一万素材文档的全量重写
    const writeStart = performance.now()
    const before = store.writeCount
    await store.attachAsset({ projectId, path: 'outputs/scale-new.mp4', name: '新增素材', kind: 'video' })
    const writeMs = performance.now() - writeStart
    expect(store.writeCount).toBe(before + 1)
    console.log(`[scale] 追加素材并落盘: ${writeMs.toFixed(1)} ms`)

    // 宽松预算（本地实测的 ~10 倍，避免 CI 抖动误报；真正劣化会突破）
    expect(coldLoad).toBeLessThan(3000)
    expect(firstQueryMs).toBeLessThan(300)
    expect(repeatedMs).toBeLessThan(50)
    expect(writeMs).toBeLessThan(3000)
  }, 60_000)
})
