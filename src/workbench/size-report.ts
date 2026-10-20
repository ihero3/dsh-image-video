/**
 * 素材体积排行（Track A / A116）。
 *
 * 清理空间时最需要知道"从哪下手"：通常少数几个大文件（长视频/4K 原始素材）占掉大部分空间。
 * 只报告，不删除。
 */

/** 排行中的一项。 */
export interface SizeEntry {
  readonly path: string
  readonly bytes: number
  /** 是否从未被任何时间轴使用（与 `A112/A82` 的结论呼应，便于一次决策）。 */
  readonly unused?: boolean
}

export interface SizeReport {
  readonly totalBytes: number
  /** Top N 总字节（看"少数文件是否吃掉空间"）。 */
  readonly topBytes: number
  /** Top N 占总量的比例（0–1，保留三位小数）。 */
  readonly topShare: number
  /** 所有素材大小的中位数（与 Top 对比判断离群程度）。 */
  readonly medianBytes: number
  readonly count: number
  readonly top: readonly SizeEntry[]
}

/**
 * 生成体积排行。
 * @param assets - 素材（path + bytes + 可选 unused 标记）。
 * @param options - `topN`（默认 10）。
 * @returns 体积报告（top 按大小降序）。
 */
export function sizeReport(
  assets: ReadonlyArray<{ path: string; bytes?: number; unused?: boolean }>,
  options: { topN?: number } = {},
): SizeReport {
  const withSize = assets
    .filter((asset): asset is { path: string; bytes: number; unused?: boolean } => typeof asset.bytes === 'number' && asset.bytes > 0)
    .sort((left, right) => right.bytes - left.bytes)
  const topN = Math.max(1, options.topN ?? 10)
  const top = withSize.slice(0, topN).map(asset => ({
    path: asset.path,
    bytes: asset.bytes,
    ...asset.unused === undefined ? {} : { unused: asset.unused },
  }))
  const totalBytes = withSize.reduce((sum, asset) => sum + asset.bytes, 0)
  const topBytes = top.reduce((sum, entry) => sum + entry.bytes, 0)
  const sizes = withSize.map(asset => asset.bytes).sort((left, right) => left - right)
  const medianBytes = sizes.length === 0 ? 0 : sizes[Math.floor(sizes.length / 2)]!
  return {
    totalBytes,
    topBytes,
    topShare: totalBytes === 0 ? 0 : Math.round((topBytes / totalBytes) * 1000) / 1000,
    medianBytes,
    count: withSize.length,
    top,
  }
}
