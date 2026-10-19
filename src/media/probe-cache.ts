/**
 * 素材探测缓存（Track A / A77）。
 *
 * 问题：`assets/probe` 与 `timelines/validate` 每次都 spawn 一次 ffmpeg ✗ ——
 * 校验一个 20 素材的时间轴要起 20 个进程，同一素材反复校验就反复起进程。
 *
 * 做法：以「绝对路径 + mtime + 字节数」为键缓存探测结果：
 * - 同一素材重复探测 → 直接命中（零进程）
 * - 素材被替换/重编码（mtime 或大小变）→ 键变 → 自动失效，不会拿到旧时长
 * - 超出上限按"最久未用"淘汰，防内存无界增长
 */
import { stat } from 'node:fs/promises'

/** 探测结果（与 `probeMediaSpec` 的返回一致）。 */
export interface ProbedSpec {
  readonly width?: number
  readonly height?: number
  readonly fps?: number
  readonly durationMs?: number
  readonly hasAudio: boolean
}

export interface ProbeCacheOptions {
  /** 真正做探测的函数（测试可注入）。 */
  probe: (file: string) => Promise<ProbedSpec | undefined>
  /** 最多缓存多少条（默认 500）。 */
  maxEntries?: number
  /** 取文件元信息（测试可注入）。 */
  statFile?: (file: string) => Promise<{ mtimeMs: number; size: number } | undefined>
}

/** 缓存统计。 */
export interface ProbeCacheStats {
  readonly hits: number
  readonly misses: number
  readonly size: number
}

async function defaultStat(file: string): Promise<{ mtimeMs: number; size: number } | undefined> {
  try {
    const info = await stat(file)
    return { mtimeMs: info.mtimeMs, size: info.size }
  } catch {
    return undefined
  }
}

export class ProbeCache {
  private readonly entries = new Map<string, { spec: ProbedSpec | undefined; key: string }>()
  private hits = 0
  private misses = 0
  private readonly probe: ProbeCacheOptions['probe']
  private readonly maxEntries: number
  private readonly statFile: NonNullable<ProbeCacheOptions['statFile']>

  constructor(options: ProbeCacheOptions) {
    this.probe = options.probe
    this.maxEntries = Math.max(1, options.maxEntries ?? 500)
    this.statFile = options.statFile ?? defaultStat
  }

  /**
   * 探测一个素材（带缓存）。
   * @param file - 绝对路径。
   * @returns 探测结果；文件不存在或探测失败时 `undefined`（失败**不缓存**，下次会重试）。
   */
  async get(file: string): Promise<ProbedSpec | undefined> {
    const info = await this.statFile(file)
    if (info === undefined) return undefined // 文件不在：不缓存，避免"刚生成的素材永远探测不到"
    const key = `${file}\u0000${info.mtimeMs}\u0000${info.size}`
    const cached = this.entries.get(file)
    if (cached !== undefined && cached.key === key) {
      this.hits += 1
      // 触碰一下，维持 LRU 顺序
      this.entries.delete(file)
      this.entries.set(file, cached)
      return cached.spec
    }
    this.misses += 1
    const spec = await this.probe(file)
    this.entries.delete(file)
    this.entries.set(file, { spec, key })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
    return spec
  }

  /** 缓存统计（诊断用）。 */
  stats(): ProbeCacheStats {
    return { hits: this.hits, misses: this.misses, size: this.entries.size }
  }

  /** 清空缓存（测试与"素材被外部替换"的场景用）。 */
  clear(): void {
    this.entries.clear()
    this.hits = 0
    this.misses = 0
  }
}
