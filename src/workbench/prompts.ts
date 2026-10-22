/**
 * Prompt library (A-5).
 *
 * Stores reusable prompt entries next to the workbench data (a small JSON file),
 * so the feature ships without a schema migration: the project document keeps
 * its v4 shape and only gains a sibling file.
 *
 * @module dsh-image-video/workbench/prompts
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** One saved prompt. */
export interface PromptRecord {
  readonly id: string
  /** Short label shown in the UI. */
  readonly name: string
  /** Prompt text (editable). */
  readonly text: string
  /** Where it came from: manual entry, image extraction, or a template. */
  readonly source: 'manual' | 'extract' | 'template'
  /** Optional structure captured by extraction (style/subject/material/detail). */
  readonly fields?: Readonly<Record<string, string>>
  readonly createdAt: string
  readonly updatedAt: string
}

/** File format of the prompt library. */
interface PromptFile {
  readonly version: 1
  readonly prompts: PromptRecord[]
}

/** Bounded library size — prompts are small, but keep the file sane. */
const MAX_PROMPTS = 500

/**
 * Prompt library backed by a JSON file.
 */
export class PromptLibrary {
  readonly #file: string
  readonly #now: () => Date

  /**
   * @param options - `directory` is the workbench data dir; `now` is injectable for tests.
   */
  constructor(options: { directory: string; now?: () => Date }) {
    this.#file = join(options.directory, 'prompts.json')
    this.#now = options.now ?? (() => new Date())
  }

  /** Read the library (missing/corrupt file reads as empty). */
  async list(): Promise<PromptRecord[]> {
    try {
      const raw = await readFile(this.#file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<PromptFile>
      if (!Array.isArray(parsed.prompts)) return []
      return parsed.prompts.filter((entry): entry is PromptRecord =>
        typeof entry === 'object' && entry !== null
        && typeof (entry as PromptRecord).id === 'string'
        && typeof (entry as PromptRecord).name === 'string'
        && typeof (entry as PromptRecord).text === 'string')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    } catch {
      return []
    }
  }

  /** Insert or update one prompt; `id` is generated when omitted. */
  async save(input: {
    id?: string
    name: string
    text: string
    source?: PromptRecord['source']
    fields?: Readonly<Record<string, string>>
  }): Promise<PromptRecord> {
    const prompts = await this.list()
    const name = input.name.trim()
    const text = input.text.trim()
    if (name === '') throw new Error('提示词名称不能为空')
    if (text === '') throw new Error('提示词内容不能为空')
    const stamp = this.#now().toISOString()
    const existing = input.id === undefined ? undefined : prompts.find(entry => entry.id === input.id)
    const record: PromptRecord = {
      id: existing?.id ?? input.id ?? `prm-${stamp.replace(/[-:.TZ]/gu, '')}-${String(Math.random()).slice(2, 8)}`,
      name,
      text,
      source: input.source ?? existing?.source ?? 'manual',
      ...input.fields === undefined ? (existing?.fields === undefined ? {} : { fields: existing.fields }) : { fields: input.fields },
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
    }
    const next = [...prompts.filter(entry => entry.id !== record.id), record]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, MAX_PROMPTS)
    await this.#write(next)
    return record
  }

  /** Remove one prompt; returns whether it existed. */
  async remove(id: string): Promise<boolean> {
    const prompts = await this.list()
    const next = prompts.filter(entry => entry.id !== id)
    if (next.length === prompts.length) return false
    await this.#write(next)
    return true
  }

  async #write(prompts: readonly PromptRecord[]): Promise<void> {
    await mkdir(dirname(this.#file), { recursive: true })
    const payload: PromptFile = { version: 1, prompts: [...prompts] }
    await writeFile(this.#file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  }
}
