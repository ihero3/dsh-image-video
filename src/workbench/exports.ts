/**
 * Export history (A-11).
 *
 * Every export attempt is appended to a small JSON file next to the workbench
 * data, so the UI can show "what did I export, for which project, did it fail".
 * Kept out of the project document on purpose: export history is operational
 * telemetry, not project content (and must not trigger schema migrations).
 *
 * @module dsh-image-video/workbench/exports
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** One export attempt. */
export interface ExportRecord {
  readonly id: string
  readonly projectId: string
  readonly timelineId: string
  /** Finished file path (absent while queued/running). */
  readonly outputPath?: string
  readonly bytes?: number
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed'
  readonly error?: string
  /** Wall-clock seconds spent, when known. */
  readonly elapsedSeconds?: number
  readonly startedAt: string
  readonly updatedAt: string
}

/** On-disk shape. */
interface ExportFile {
  readonly version: 1
  readonly exports: ExportRecord[]
}

/** Keep the history bounded (newest first). */
const MAX_EXPORTS = 500

/**
 * Append-only export history backed by a JSON file.
 */
export class ExportHistory {
  readonly #file: string
  readonly #now: () => Date

  /**
   * @param options - `directory` is the workbench data dir; `now` injectable for tests.
   */
  constructor(options: { directory: string; now?: () => Date }) {
    this.#file = join(options.directory, 'exports.json')
    this.#now = options.now ?? (() => new Date())
  }

  /** List history, newest first; optionally filtered by project. */
  async list(projectId?: string): Promise<ExportRecord[]> {
    const all = await this.#read()
    return projectId === undefined ? all : all.filter(entry => entry.projectId === projectId)
  }

  /** Record a new export attempt (status `queued`). */
  async start(input: { projectId: string; timelineId: string }): Promise<ExportRecord> {
    const stamp = this.#now().toISOString()
    const record: ExportRecord = {
      id: `exp-${stamp.replace(/[-:.TZ]/gu, '')}-${String(Math.random()).slice(2, 8)}`,
      projectId: input.projectId,
      timelineId: input.timelineId,
      status: 'queued',
      startedAt: stamp,
      updatedAt: stamp,
    }
    const next = [record, ...await this.#read()].slice(0, MAX_EXPORTS)
    await this.#write(next)
    return record
  }

  /** Update one export attempt; returns the updated record or `undefined`. */
  async update(id: string, patch: Partial<Pick<ExportRecord, 'status' | 'outputPath' | 'bytes' | 'error' | 'elapsedSeconds'>>): Promise<ExportRecord | undefined> {
    const entries = await this.#read()
    const index = entries.findIndex(entry => entry.id === id)
    if (index === -1) return undefined
    const current = entries[index]!
    const next: ExportRecord = {
      ...current,
      ...patch,
      updatedAt: this.#now().toISOString(),
    }
    const cleaned = { ...next } as Record<string, unknown>
    if (cleaned.outputPath === undefined) delete cleaned.outputPath
    if (cleaned.bytes === undefined) delete cleaned.bytes
    if (cleaned.error === undefined) delete cleaned.error
    if (cleaned.elapsedSeconds === undefined) delete cleaned.elapsedSeconds
    entries[index] = cleaned as unknown as ExportRecord
    await this.#write(entries)
    return entries[index]
  }

  async #read(): Promise<ExportRecord[]> {
    try {
      const raw = await readFile(this.#file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<ExportFile>
      if (!Array.isArray(parsed.exports)) return []
      return parsed.exports.filter((entry): entry is ExportRecord =>
        typeof entry === 'object' && entry !== null
        && typeof (entry as ExportRecord).id === 'string'
        && typeof (entry as ExportRecord).projectId === 'string'
        && typeof (entry as ExportRecord).status === 'string')
    } catch {
      return []
    }
  }

  async #write(exports_: readonly ExportRecord[]): Promise<void> {
    await mkdir(dirname(this.#file), { recursive: true })
    const payload: ExportFile = { version: 1, exports: [...exports_] }
    await writeFile(this.#file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  }
}
