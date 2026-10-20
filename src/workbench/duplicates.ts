/**
 * 素材内容去重检测（Track A / A112）。
 *
 * 场景：同一份素材被反复登记到不同路径（复制/导入/重命名），占两份空间且难看出是同一份。
 * 策略：**先按字节数分组**（便宜），只对"同大小"的组算 sha256 确认（避免全库哈希）。
 * 只报告，不删除。
 */

/** 一个重复组。 */
export interface DuplicateGroup {
  /** 内容相同的素材路径（第一个是建议保留的）。 */
  readonly paths: readonly string[]
  /** 单份字节数。 */
  readonly bytes: number
  /** 建议保留哪一个（路径最短/最早的那个）。 */
  readonly keep: string
  /** 去掉重复后可回收的字节数。 */
  readonly reclaimableBytes: number
}

export interface DuplicateReport {
  readonly groups: readonly DuplicateGroup[]
  readonly reclaimableBytes: number
  /** 为了确认重复实际算了多少个哈希（诊断/成本可见）。 */
  readonly hashedFiles: number
  /** 因超出哈希上限而未检查的候选文件数。 */
  readonly skippedFiles: number
}

/**
 * 找内容重复的素材。
 * @param assets - 素材（path + bytes）。
 * @param hashOf - 计算一个素材内容哈希（读文件）；可返回 undefined 表示读不到。
 * @param options - `maxHashFiles` 限制最多算多少次哈希（默认 200，防全库扫描）。
 * @returns 重复报告（组按可回收字节降序）。
 */
export async function findDuplicateAssets(
  assets: ReadonlyArray<{ path: string; bytes?: number }>,
  hashOf: (path: string) => Promise<string | undefined>,
  options: { maxHashFiles?: number } = {},
): Promise<DuplicateReport> {
  const maxHashFiles = Math.max(2, options.maxHashFiles ?? 200)
  // 1) 按大小分组：只有 >=2 个同大小文件才值得算哈希
  const bySize = new Map<number, string[]>()
  for (const asset of assets) {
    if (asset.bytes === undefined || asset.bytes <= 0) continue
    const list = bySize.get(asset.bytes) ?? []
    list.push(asset.path)
    bySize.set(asset.bytes, list)
  }
  const candidates = [...bySize.entries()].filter(([, paths]) => paths.length >= 2)
  const groups: DuplicateGroup[] = []
  let hashedFiles = 0
  let skippedFiles = 0
  for (const [bytes, paths] of candidates) {
    const byHash = new Map<string, string[]>()
    for (const path of paths) {
      if (hashedFiles >= maxHashFiles) { skippedFiles += 1; continue }
      const hash = await hashOf(path)
      hashedFiles += 1
      if (hash === undefined) continue
      const list = byHash.get(hash) ?? []
      list.push(path)
      byHash.set(hash, list)
    }
    for (const sameContent of byHash.values()) {
      if (sameContent.length < 2) continue
      // 建议保留路径最短的那个（通常是原始短名），其余可视为重复
      const sorted = [...sameContent].sort((left, right) => left.length - right.length || left.localeCompare(right))
      groups.push({
        paths: sorted,
        bytes,
        keep: sorted[0]!,
        reclaimableBytes: bytes * (sorted.length - 1),
      })
    }
  }
  groups.sort((left, right) => right.reclaimableBytes - left.reclaimableBytes)
  return {
    groups,
    reclaimableBytes: groups.reduce((sum, group) => sum + group.reclaimableBytes, 0),
    hashedFiles,
    skippedFiles,
  }
}
