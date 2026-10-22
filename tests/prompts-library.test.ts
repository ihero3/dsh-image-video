/** Prompt library (A-5): CRUD over a sibling JSON file, no schema migration. */
import { describe, expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PromptLibrary } from '../src/workbench/prompts.ts'

async function library() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-prompts-'))
  return new PromptLibrary({ directory })
}

describe('PromptLibrary', () => {
  it('starts empty and saves, lists, updates and removes prompts', async () => {
    const lib = await library()
    expect(await lib.list()).toEqual([])

    const created = await lib.save({ name: '雨夜霓虹', text: '雨夜霓虹街头，电影感' })
    expect(created.source).toBe('manual')
    expect(await lib.list()).toHaveLength(1)

    const updated = await lib.save({ id: created.id, name: '雨夜霓虹（改）', text: '雨夜霓虹街头，浅景深' })
    expect(updated.id).toBe(created.id)
    expect(await lib.list()).toHaveLength(1)
    expect((await lib.list())[0]!.name).toBe('雨夜霓虹（改）')

    expect(await lib.remove(updated.id)).toBe(true)
    expect(await lib.list()).toEqual([])
    expect(await lib.remove('prm-nope')).toBe(false)
  })

  it('persists across instances (same file)', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-prompts-'))
    const first = new PromptLibrary({ directory })
    await first.save({ name: '封面', text: '竖版封面，主体偏右' })
    const second = new PromptLibrary({ directory })
    expect(await second.list()).toHaveLength(1)
  })

  it('rejects empty name/text and survives a corrupt file', async () => {
    const lib = await library()
    await expect(lib.save({ name: '  ', text: 'x' })).rejects.toThrow('名称不能为空')
    await expect(lib.save({ name: 'x', text: '  ' })).rejects.toThrow('内容不能为空')

    const { writeFile } = await import('node:fs/promises')
    const directory = await mkdtemp(join(tmpdir(), 'dsh-prompts-'))
    await writeFile(join(directory, 'prompts.json'), '{not json')
    expect(await new PromptLibrary({ directory }).list()).toEqual([])
  })
})
