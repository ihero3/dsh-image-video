/**
 * 数据迁移框架（Track A / A7）：
 * 按 schemaVersion 逐级升级、只升不降、找不到路径明确拒绝；
 * store 集成：迁移前自动备份 `.pre-migrate-v<N>`，迁移结果自动落盘。
 */
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { migrateDocument, type WorkbenchMigration } from '../src/workbench/migrate.ts'
import { WORKBENCH_SCHEMA_VERSION } from '../src/workbench/records.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })
async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

const v1ToV2: WorkbenchMigration = {
  from: 1, to: 2, describe: '测试迁移：给项目补 color 字段（注入版，替换默认链）',
  migrate: document => ({
    ...document, schemaVersion: 2,
    projects: (document.projects as Array<Record<string, unknown>> | undefined ?? [])
      .map(project => ({ ...project, color: '#4176e6' })),
  }),
}

const v2ToV3: WorkbenchMigration = {
  from: 2, to: 3, describe: '测试迁移：v2→v3 标记', migrate: document => ({ ...document, schemaVersion: 3 }),
}

const v3ToV4: WorkbenchMigration = {
  from: 3, to: 4, describe: '测试迁移：v3→v4 标记', migrate: document => ({ ...document, schemaVersion: 4 }),
}

const v4ToV5: WorkbenchMigration = {
  from: 4, to: 5, describe: '测试迁移：v4→v5 标记', migrate: document => ({ ...document, schemaVersion: 5 }),
}

describe('migrateDocument (A7)', () => {
  it('applies the chain step by step', () => {
    const result = migrateDocument({ schemaVersion: 1, projects: [{ id: 'p1' }] }, [v1ToV2, v2ToV3, v3ToV4, v4ToV5])
    expect(result.fromVersion).toBe(1)
    expect(result.applied).toHaveLength(4) // 1→2→3→4→5 四步
    expect(result.toVersion).toBe(WORKBENCH_SCHEMA_VERSION)
    expect((result.document.projects as Array<Record<string, unknown>>)[0]).toMatchObject({ id: 'p1', color: '#4176e6' })
  })

  it('treats a missing schemaVersion as v1 and refuses to downgrade', () => {
    // 缺 schemaVersion 视为 v1 → 走默认链升到当前版本
    expect(migrateDocument({ projects: [] }).fromVersion).toBe(1)
    expect(() => migrateDocument({ schemaVersion: 99 }, [])).toThrow(/更新的版本/)
  })

  it('refuses when there is no upgrade path (no guessing)', () => {
    expect(() => migrateDocument({ schemaVersion: 0 }, [])).toThrow(/升级路径/)
  })
})

describe('store migration integration (A7)', () => {
  it('backs up the original file, migrates, and persists the new version', async () => {
    const directory = await temp('dsh-migrate-')
    const legacy = {
      schemaVersion: 1, assets: [], tasks: [], resources: [], workflows: [], runs: [], timelines: [], nodeCache: [], resourceUsage: [],
      projects: [{ id: 'prj-legacy', name: '老项目', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }],
    }
    await writeFile(join(directory, 'workbench.json'), JSON.stringify(legacy), 'utf8')

    // 注入链：验证"迁移前备份 + 自动落盘"的机制（真实链 1→2 见 setup 里的默认迁移）
    const store = new WorkbenchStore({ directory, migrations: [v1ToV2, v2ToV3, v3ToV4, v4ToV5] })
    const projects = await store.listProjects()
    expect(projects[0]).toMatchObject({ id: 'prj-legacy', name: '老项目' })

    const files = await readdir(directory)
    // 迁移前备份
    expect(files.some(name => name === 'workbench.json.pre-migrate-v1')).toBe(true)
    // 迁移结果已落盘（版本变成 2，且补上了新字段）
    const onDisk = JSON.parse(await readFile(join(directory, 'workbench.json'), 'utf8')) as {
      schemaVersion: number; projects: Array<{ color?: string }>
    }
    expect(onDisk.schemaVersion).toBe(WORKBENCH_SCHEMA_VERSION)
    expect(onDisk.projects[0]?.color).toBe('#4176e6')
  })
})
