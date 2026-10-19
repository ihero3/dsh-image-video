/**
 * 商用水准的耐用性与安全边界：
 * ① 主文件损坏时自动回退到 `.bak`（并把坏文件留证），不让用户被卡死；
 * ② 任务账本有界（只留最近 MAX_TASKS 条），避免 JSON 无界膨胀；
 * ③ 包导出只允许写到 `packages/` 之下（拒绝任意路径写入）。
 */
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { MAX_TASKS, WorkbenchStore } from '../src/workbench/store.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

describe('store durability (commercial baseline)', () => {
  it('recovers from .bak when the main document is corrupt', async () => {
    const directory = await temp('dsh-durable-')
    const store = new WorkbenchStore({ directory })
    await store.createProject('第一次保存')
    await store.createProject('第二次保存') // 第二次保存会把上一份留成 .bak
    const backup = await readFile(join(directory, 'workbench.json.bak'), 'utf8')
    // .bak 是"最后一次成功保存"的镜像，两次项目都在
    expect(backup).toContain('第一次保存')
    expect(backup).toContain('第二次保存')

    // 主文件写坏 → 新实例应从 .bak 恢复，并把坏文件留证
    await writeFile(join(directory, 'workbench.json'), '{ not json', 'utf8')
    const reopened = new WorkbenchStore({ directory })
    const projects = await reopened.listProjects()
    expect(projects.map(project => project.name).sort()).toEqual(['第一次保存', '第二次保存'])
    // 坏文件被留证（.corrupt-*），便于事后排查
    const names = await readdir(directory)
    expect(names.some(name => name.startsWith('workbench.json.corrupt-'))).toBe(true)
  })

  it('caps the task ledger so the document cannot grow without bound', async () => {
    const directory = await temp('dsh-tasks-cap-')
    // 预置一份超上限的文档，避免用 1000+ 次全量写盘来测
    const seeded = {
      schemaVersion: 1, projects: [], assets: [], resources: [], workflows: [], runs: [], timelines: [], nodeCache: [], resourceUsage: [],
      tasks: Array.from({ length: MAX_TASKS + 5 }, (_, index) => ({
        schemaVersion: 1, id: `tsk-seed-${index}`, kind: 'image', status: 'succeeded',
        createdAt: `2026-10-01T00:00:${String(index % 60).padStart(2, '0')}.000Z`, updatedAt: '2026-10-01T00:00:00.000Z',
      })),
    }
    await writeFile(join(directory, 'workbench.json'), JSON.stringify(seeded), 'utf8')
    const store = new WorkbenchStore({ directory })
    await store.recordTask({ kind: 'video', status: 'succeeded' })
    const rows = await store.listTasks(MAX_TASKS + 100)
    expect(rows.length).toBe(MAX_TASKS)
    // 新的那条必须在（淘汰的是最旧的）
    expect(rows.some(row => row.kind === 'video')).toBe(true)
  })
})
