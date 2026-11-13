/**
 * Listing the output directory, so the workbench can offer "register the file I
 * just generated" without going through the generation tools — the smallest
 * honest step from a placeholder pane to something that works.
 *
 * Reading is bounded and tolerant: unknown extensions are skipped, a missing
 * directory is an empty list, and unreadable entries never fail the whole list.
 */
import { readdir, rename, stat } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
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

/** 生成产物的命名上下文：剧集名 + 集数（无选中集数时只按剧集名编号）。 */
export interface OutputNaming {
  /** 当前剧集（项目）名。 */
  readonly projectName: string
  /** 当前集数（`EpisodeRecord.no`）。 */
  readonly episodeNo?: number
}

/** 把名称里会破坏路径的字符换成连字符，并限制长度；空名回退「剧集」。 */
function safeName(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|\n\r\t]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return cleaned === '' ? '剧集' : cleaned
}

/** 目录内同前缀文件的最大序号（旧的时间戳命名不匹配，因此新规则从 001 起）。 */
async function nextSequence(directory: string, prefix: string): Promise<number> {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.[^.]*$`)
  let max = 0
  for (const entry of await readdir(directory).catch(() => [] as string[])) {
    const match = pattern.exec(entry)
    if (match !== null) max = Math.max(max, Number(match[1]))
  }
  return max + 1
}

/**
 * 把刚生成的文件重命名为 `<剧集名>-E<集数>-<序号><扩展名>`（无集数时省略 E 段）。
 * 序号取输出目录里同前缀文件的最大值 +1，因此每集独立从 001 递增；
 * 旧的时间戳命名文件不参与计数，也不改名。
 * @param path - 生成工具落盘的绝对路径。
 * @param naming - 命名上下文。
 * @returns 重命名后的绝对路径。
 * @throws 目标名连续冲突或改名失败时原样抛出 fs 错误，调用方退回旧路径。
 */
export async function renameGeneratedOutput(path: string, naming: OutputNaming): Promise<string> {
  const directory = dirname(path)
  const ext = extname(path)
  const prefix = naming.episodeNo === undefined
    ? safeName(naming.projectName)
    : `${safeName(naming.projectName)}-E${String(naming.episodeNo).padStart(2, '0')}`
  let sequence = await nextSequence(directory, prefix)
  for (; sequence < 10_000; sequence += 1) {
    const candidate = join(directory, `${prefix}-${String(sequence).padStart(3, '0')}${ext}`)
    const taken = await stat(candidate).then(() => true, () => false)
    if (taken) continue
    await rename(path, candidate)
    return candidate
  }
  throw new Error(`输出目录里 ${prefix} 的序号已用尽，无法为 ${path} 生成新文件名`)
}
