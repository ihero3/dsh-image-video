/**
 * 资源库闭环（`B-7`）：扁平分类（folder）+ 参考图→提示词→重绘 的零花费计划。
 *
 * 断言：
 * 1. 分类可建/可改/可清/可过滤，且**旧数据（无 folder）自动归为未分类**；
 * 2. schema v4→v5 迁移不丢数据（只升版本，旧资源无需改写）；
 * 3. `resources/plan-redraw` 只做计划：不调模型、缺参考图/缺备注都如实提醒。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { migrateDocument } from '../src/workbench/migrate.ts'
import { WORKBENCH_SCHEMA_VERSION } from '../src/workbench/records.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

async function harness() {
  const store = new WorkbenchStore({ directory: await temp('dsh-folder-store-') })
  const outputsDir = await temp('dsh-folder-out-')
  const call = createWorkbenchHandler({
    provider: 'threevideo', outputsDir, store,
    registry: {} as never, runner: {} as never, renders: {} as never,
  })
  const project = await store.createProject('资源闭环')
  return { call, store, project }
}

describe('资源分类（folder）', () => {
  it('可建/可改/可清，列表可按分类过滤并返回分类清单', async () => {
    const { call, project } = await harness()
    await call('resources/create', { projectId: project.id, kind: 'role', name: '林夏', folder: '主角' },
      new AbortController().signal, {} as never)
    const created = await call('resources/create', { projectId: project.id, kind: 'scene', name: '雨夜街头', folder: ' 场景组  ' },
      new AbortController().signal, {} as never)
    expect(created.ok).toBe(true)
    if (created.ok) {
      expect((created.value as { resource: { folder: string } }).resource.folder).toBe('场景组')
    }
    // 过滤
    const filtered = await call('resources/list', { projectId: project.id, folder: '主角' }, new AbortController().signal, {} as never)
    expect(filtered.ok).toBe(true)
    if (filtered.ok) {
      const value = filtered.value as { resources: Array<{ name: string }>; folders: string[] }
      expect(value.resources.map(resource => resource.name)).toEqual(['林夏'])
      expect(value.folders).toEqual(['场景组', '主角'].sort((left, right) => left.localeCompare(right, 'zh')))
    }
    // 改 + 清
    const { store } = await harness()
    void store
    const all = await call('resources/list', { projectId: project.id }, new AbortController().signal, {} as never)
    if (!all.ok) return
    const role = (all.value as { resources: Array<{ id: string; name: string }> }).resources.find(resource => resource.name === '林夏')!
    const moved = await call('resources/update', { id: role.id, folder: '配角' }, new AbortController().signal, {} as never)
    expect(moved.ok).toBe(true)
    if (moved.ok) expect((moved.value as { resource: { folder: string } }).resource.folder).toBe('配角')
    const cleared = await call('resources/update', { id: role.id, folder: null }, new AbortController().signal, {} as never)
    expect(cleared.ok).toBe(true)
    if (cleared.ok) expect((cleared.value as { resource: { folder?: string } }).resource.folder).toBeUndefined()
  })

  it('分类超长/非字符串被拒绝（可操作错误）', async () => {
    const { call, project } = await harness()
    const tooLong = await call('resources/create', {
      projectId: project.id, kind: 'role', name: '角色甲', folder: 'x'.repeat(41),
    }, new AbortController().signal, {} as never)
    expect(tooLong.ok).toBe(false)
    if (!tooLong.ok) expect(tooLong.error.message).toContain('资源分类最多')
  })
})

describe('schema v4 → v5', () => {
  it('迁移只升版本，旧资源原样保留（无 folder = 未分类）', () => {
    expect(WORKBENCH_SCHEMA_VERSION).toBe(5)
    const legacy = {
      schemaVersion: 4,
      projects: [{ id: 'prj-1', name: '旧项目' }],
      resources: [{ id: 'res-1', projectId: 'prj-1', kind: 'role', name: '旧角色', scope: 'project' }],
    }
    const migrated = migrateDocument(legacy)
    expect(migrated.fromVersion).toBe(4)
    expect(migrated.toVersion).toBe(5)
    expect(migrated.document.schemaVersion).toBe(5)
    expect((migrated.document.resources as Array<{ id: string; folder?: string }>)[0]!.folder).toBeUndefined()
  })
})

describe('resources/plan-redraw（零花费计划）', () => {
  it('返回提示词/参考图/建议，并如实提醒缺失', async () => {
    const { call, store, project } = await harness()
    const withRefs = await store.createResource({
      projectId: project.id, kind: 'role', name: '林夏', note: '短发，米色风衣，冷静',
      assetPaths: ['/tmp/ref-1.png', '/tmp/ref-2.png'],
    })
    const planed = await call('resources/plan-redraw', { resourceId: withRefs.id }, new AbortController().signal, {} as never)
    expect(planed.ok).toBe(true)
    if (!planed.ok) return
    const value = planed.value as { prompt: string; images: string[]; referenceCount: number; warnings: string[] }
    expect(value.prompt).toBe('短发，米色风衣，冷静')
    expect(value.images).toHaveLength(2)
    expect(value.referenceCount).toBe(2)
    expect(value.warnings).toEqual([])

    const bare = await store.createResource({ projectId: project.id, kind: 'scene', name: '雨夜街头' })
    const barePlan = await call('resources/plan-redraw', { resourceId: bare.id }, new AbortController().signal, {} as never)
    expect(barePlan.ok).toBe(true)
    if (!barePlan.ok) return
    const bareValue = barePlan.value as { prompt: string; images: string[]; warnings: string[] }
    expect(bareValue.prompt).toContain('雨夜街头')
    expect(bareValue.images).toEqual([])
    expect(bareValue.warnings.join('\n')).toContain('参考图')
    expect(bareValue.warnings.join('\n')).toContain('备注')
  })

  it('未知资源报错', async () => {
    const { call } = await harness()
    const result = await call('resources/plan-redraw', { resourceId: 'res-x' }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('unknown resource')
  })
})
