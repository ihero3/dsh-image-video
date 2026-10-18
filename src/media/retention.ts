/**
 * 输出目录保留策略（Track A / A15）：给 outputs 定上限，按"最旧优先"清理。
 *
 * 三条安全底线：
 * 1. **只删没被引用的**：调用方传入当前项目/素材库引用的文件名（`protect`），一律不动；
 * 2. **至少保留最新 N 个**（`keepNewest`，默认 20），避免把刚生成的东西删掉；
 * 3. **可预演**：`dryRun` 只算不删，先给用户看要删哪些。
 *
 * 纯函数：不做 IO，删除由调用方执行（便于测试与审计）。
 */
/** 一个待评估的输出文件。 */
export interface RetentionFile {
  readonly name: string
  readonly bytes: number
  /** 修改时间（毫秒时间戳）。 */
  readonly mtimeMs: number
}

/** 保留策略。 */
export interface RetentionPolicy {
  /** 目录总字节上限（可选）。 */
  readonly maxBytes?: number
  /** 目录文件数上限（可选）。 */
  readonly maxFiles?: number
  /** 无条件保留最新的几个（默认 20）。 */
  readonly keepNewest?: number
  /** 受保护（被引用）的文件名，一律不删。 */
  readonly protect?: Iterable<string>
}

/** 一次清理计划。 */
export interface RetentionPlan {
  /** 建议删除的文件（最旧优先）。 */
  readonly removed: readonly RetentionFile[]
  /** 删除后剩余文件数。 */
  readonly keptFiles: number
  /** 删除后剩余字节数。 */
  readonly keptBytes: number
  /** 删除总计字节数。 */
  readonly freedBytes: number
  /** 是否因为受保护/保留策略而无法满足上限。 */
  readonly overQuota: boolean
}

const DEFAULT_KEEP_NEWEST = 20

/**
 * 计算清理计划（不执行删除）。
 * @param files - 目录里的文件。
 * @param policy - 上限与保护名单。
 * @returns 计划。
 */
export function planRetention(files: readonly RetentionFile[], policy: RetentionPolicy = {}): RetentionPlan {
  const keepNewest = Math.max(0, Math.floor(policy.keepNewest ?? DEFAULT_KEEP_NEWEST))
  const protect = new Set(policy.protect ?? [])
  const sorted = [...files].sort((left, right) => right.mtimeMs - left.mtimeMs) // 新 → 旧
  const protectedNewest = new Set(sorted.slice(0, keepNewest).map(file => file.name))

  let totalBytes = sorted.reduce((sum, file) => sum + Math.max(0, file.bytes), 0)
  let totalFiles = sorted.length
  const removed: RetentionFile[] = []
  for (const file of [...sorted].reverse()) { // 从最旧的开始
    const overBytes = policy.maxBytes !== undefined && totalBytes > policy.maxBytes
    const overFiles = policy.maxFiles !== undefined && totalFiles > policy.maxFiles
    if (!overBytes && !overFiles) break
    if (protect.has(file.name) || protectedNewest.has(file.name)) continue
    removed.push(file)
    totalBytes -= Math.max(0, file.bytes)
    totalFiles -= 1
  }
  const overQuota = (policy.maxBytes !== undefined && totalBytes > policy.maxBytes)
    || (policy.maxFiles !== undefined && totalFiles > policy.maxFiles)
  return {
    removed,
    keptFiles: totalFiles,
    keptBytes: totalBytes,
    freedBytes: removed.reduce((sum, file) => sum + Math.max(0, file.bytes), 0),
    overQuota,
  }
}
