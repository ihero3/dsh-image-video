/**
 * M3：双技能库（导演库 / 逆向库）。
 *
 * 覆盖内置种子、用户技能落盘、启用/禁用、删除备份、导入（JSON / 目录 / zip）与
 * 导入安全（zip 路径穿越、http 拒绝），以及 7 个 `skills/*` RPC 端点。
 */
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import {
  MAX_SKILL_IMPORT_BYTES, SkillLibrary, normalizeSkillId, normalizeSkillKind, normalizeSkillPrompt,
} from '../src/workbench/skills.ts'

const roots: string[] = []

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

/** 建一个临时工作台目录。 */
async function workbenchRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-skills-'))
  roots.push(root)
  return root
}

/** 最小的 stored（不压缩）zip 写入器：只给测试造包用。 */
function makeZip(entries: readonly { name: string; text: string }[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const data = Buffer.from(entry.text, 'utf8')
    const local = Buffer.alloc(30 + name.length + data.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(0, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    name.copy(local, 30)
    data.copy(local, 30 + name.length)
    locals.push(local)

    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(0, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    name.copy(central, 46)
    centrals.push(central)
    offset += local.length
  }
  const directory = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(directory.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, directory, eocd])
}

function manifestText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    id: 'user-skill',
    kind: 'director',
    name: '用户导演技能',
    description: '来自本地',
    prompt: '把提示词拆成三段镜头。',
    ...overrides,
  })
}

describe('SkillLibrary', () => {
  it('seeds built-in director and reverse skills as read-only', async () => {
    const root = await workbenchRoot()
    const library = new SkillLibrary({ directory: root })
    const director = await library.list({ kind: 'director' })
    const reverse = await library.list({ kind: 'reverse' })
    expect(director.length).toBeGreaterThanOrEqual(2)
    expect(reverse.length).toBeGreaterThanOrEqual(2)
    expect(director.every(skill => skill.builtin && skill.enabled)).toBe(true)
    expect(reverse.every(skill => skill.builtin && skill.enabled)).toBe(true)
    // 清单落盘：skills/<kind>/<id>/skill.json
    const stored = JSON.parse(await readFile(join(root, 'skills', 'director', director[0]!.id, 'skill.json'), 'utf8'))
    expect(stored.id).toBe(director[0]!.id)
    expect(stored.prompt).toContain('分镜')
  })

  it('saves a user skill, persists it, and rejects built-in edits', async () => {
    const root = await workbenchRoot()
    const library = new SkillLibrary({ directory: root })
    const saved = await library.save({ kind: 'director', name: '新技能', prompt: '按广告节奏拆镜。' })
    expect(saved.builtin).toBe(false)
    expect((await library.list({ kind: 'director' })).some(skill => skill.id === saved.id)).toBe(true)
    const index = JSON.parse(await readFile(join(root, 'skills', 'index.json'), 'utf8'))
    expect(index.entries.some((entry: { id: string; enabled: boolean }) => entry.id === saved.id && entry.enabled)).toBe(true)
    await expect(library.save({
      id: 'builtin-director-cinema', kind: 'director', name: '改名', prompt: '覆盖',
    })).rejects.toThrow('内置技能只读')
  })

  it('toggles built-ins and filters disabled skills', async () => {
    const root = await workbenchRoot()
    const library = new SkillLibrary({ directory: root })
    const disabled = await library.toggle('builtin-director-cinema', false)
    expect(disabled.enabled).toBe(false)
    const enabled = await library.list({ kind: 'director', enabledOnly: true })
    expect(enabled.some(skill => skill.id === 'builtin-director-cinema')).toBe(false)
    expect((await library.toggle('builtin-director-cinema', true)).enabled).toBe(true)
  })

  it('backs up a user skill before removal and refuses built-in removal', async () => {
    const root = await workbenchRoot()
    const library = new SkillLibrary({ directory: root })
    const saved = await library.save({ kind: 'reverse', name: '逆向技能', prompt: '提取镜头语言。' })
    await expect(library.remove('builtin-reverse-shot')).rejects.toThrow('内置技能只读')
    expect(await library.remove(saved.id)).toBe(true)
    const backups = await readdir(join(root, 'skills', '_backup', 'reverse'))
    expect(backups.some(name => name.startsWith(saved.id))).toBe(true)
    await expect(library.get(saved.id)).rejects.toThrow('未知的技能')
  })

  it('imports a JSON manifest, a local directory and a zip', async () => {
    const root = await workbenchRoot()
    const source = join(root, 'source.json')
    await writeFile(source, manifestText())
    const library = new SkillLibrary({ directory: root })
    const imported = await library.import({ kind: 'director', source })
    expect(imported.name).toBe('用户导演技能')

    const directory = join(root, 'bundle')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'skill.json'), manifestText({ id: 'dir-skill', name: '目录技能' }))
    expect((await library.import({ kind: 'director', source: directory })).name).toBe('目录技能')

    const zipPath = join(root, 'bundle.zip')
    await writeFile(zipPath, makeZip([{ name: 'skill.json', text: manifestText({ id: 'zip-skill', name: '压缩包技能' }) }]))
    const zipped = await library.import({ kind: 'director', source: zipPath })
    expect(zipped.name).toBe('压缩包技能')
    expect(zipped.source).toBe(zipPath)
  })

  it('rejects zip traversal, http sources and mismatched kinds', async () => {
    const root = await workbenchRoot()
    const library = new SkillLibrary({ directory: root })
    const zipPath = join(root, 'evil.zip')
    await writeFile(zipPath, makeZip([
      { name: '../escape.json', text: '{}' },
      { name: 'skill.json', text: manifestText() },
    ]))
    await expect(library.import({ kind: 'director', source: zipPath })).rejects.toThrow('zip 条目名不安全')
    await expect(library.import({ kind: 'director', source: 'http://example.com/skill.json' }))
      .rejects.toThrow('只支持 https://')
    const wrongKind = join(root, 'reverse.json')
    await writeFile(wrongKind, manifestText({ kind: 'reverse', id: 'wrongkind' }))
    await expect(library.import({ kind: 'director', source: wrongKind })).rejects.toThrow('kind 必须是 director')
  })
})

describe('skills RPC endpoints', () => {
  /** 最小 host deps：只要有数据目录（技能库不碰生成能力）。 */
  function handlerFor(root: string) {
    const deps = {
      store: { directory: root },
      revealPath: async (directory: string) => ({ ok: true, path: directory }),
    }
    return createWorkbenchHandler(deps as never)
  }

  it('lists, saves, imports, toggles, reveals and removes via the channel', async () => {
    const root = await workbenchRoot()
    const handle = handlerFor(root)
    const listed = await handle('skills/list', { kind: 'director', enabled: true })
    expect(listed.ok).toBe(true)
    expect((listed.value as { skills: unknown[] }).skills.length).toBeGreaterThanOrEqual(2)

    const saved = await handle('skills/save', {
      kind: 'reverse', name: '通道技能', prompt: '把短片拆成节拍。',
    })
    expect(saved.ok).toBe(true)
    const id = (saved.value as { skill: { id: string } }).skill.id

    const toggled = await handle('skills/toggle', { id, enabled: false })
    expect((toggled.value as { skill: { enabled: boolean } }).skill.enabled).toBe(false)
    const got = await handle('skills/get', { id })
    expect((got.value as { skill: { enabled: boolean } }).skill.enabled).toBe(false)
    const revealed = await handle('skills/reveal', { id })
    expect((revealed.value as { reveal: { ok: boolean } }).reveal.ok).toBe(true)
    expect((await handle('skills/remove', { id })).ok).toBe(true)

    const source = join(root, 'imported.json')
    await writeFile(source, manifestText({ id: 'rpc-import' }))
    const imported = await handle('skills/import', { kind: 'director', source })
    expect(imported.ok).toBe(true)
    expect((imported.value as { skill: { name: string } }).skill.name).toBe('用户导演技能')

    const builtinRemove = await handle('skills/remove', { id: 'builtin-director-cinema' })
    expect(builtinRemove.ok).toBe(false)
  })

  it('rejects invalid payloads with the invalid-payload code', async () => {
    const root = await workbenchRoot()
    const handle = handlerFor(root)
    const missing = await handle('skills/save', { kind: 'director', name: '', prompt: '' })
    expect(missing.ok).toBe(false)
    expect((missing.error as { message: string }).message).toContain('non-empty string')
  })
})

describe('skill validation', () => {
  it('keeps ids path-safe and prompts non-empty', () => {
    expect(normalizeSkillKind('director')).toBe('director')
    expect(normalizeSkillId('skl-ok_1')).toBe('skl-ok_1')
    expect(() => normalizeSkillId('../escape')).toThrow('路径字符')
    expect(() => normalizeSkillPrompt('')).toThrow('不能为空')
    expect(MAX_SKILL_IMPORT_BYTES).toBe(20 * 1024 * 1024)
  })
})
