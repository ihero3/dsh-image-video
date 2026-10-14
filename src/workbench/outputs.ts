/**
 * Listing the output directory, so the workbench can offer "register the file I
 * just generated" without going through the generation tools — the smallest
 * honest step from a placeholder pane to something that works.
 *
 * Reading is bounded and tolerant: unknown extensions are skipped, a missing
 * directory is an empty list, and unreadable entries never fail the whole list.
 */
import { readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { MediaKind } from './records.ts'

/** Extension → media kind, for the kinds the plugin can produce today. */
const MEDIA_EXTENSIONS: Readonly<Record<string, MediaKind>> = {
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image',
  '.mp4': 'video', '.mov': 'video', '.webm': 'video', '.mkv': 'video',
}

/** One file found under the output directory. */
export interface OutputFile {
  /** File name (no directory). */
  readonly name: string
  /** Absolute path. */
  readonly path: string
  /** Media kind derived from the extension. */
  readonly kind: MediaKind
  /** Size in bytes. */
  readonly bytes: number
  /** Last modification time (ISO 8601). */
  readonly modifiedAt: string
}

/** Default page size for the listing. */
export const DEFAULT_OUTPUT_LIMIT = 40

/**
 * List the newest media files in a directory.
 * @param directory - absolute output directory.
 * @param limit - maximum entries to return (newest first).
 * @returns the listing; empty when the directory does not exist.
 */
export async function listOutputs(directory: string, limit = DEFAULT_OUTPUT_LIMIT): Promise<OutputFile[]> {
  let names: string[]
  try {
    names = await readdir(directory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const found: OutputFile[] = []
  for (const name of names) {
    const kind = MEDIA_EXTENSIONS[extname(name).toLowerCase()]
    if (kind === undefined) continue
    const path = join(directory, name)
    try {
      const info = await stat(path)
      if (!info.isFile()) continue
      found.push({ name, path, kind, bytes: info.size, modifiedAt: info.mtime.toISOString() })
    } catch {
      // 单个条目读不到（权限/竞态）不该让整张清单失败
    }
  }
  return found
    .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
    .slice(0, Math.max(0, limit))
}
