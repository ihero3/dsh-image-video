/**
 * 诊断与可观测（Track A / A9）：一个**有界**的错误环形缓冲 + 快照。
 *
 * 只记"最近发生了什么错"，不落盘、不带用户数据（提示词/路径不记，避免隐私问题）。
 * 由 RPC 的 `diagnostics` 端点暴露，出问题时不用翻日志也能看到最近错误。
 */
/** 一条错误记录。 */
export interface DiagnosticsError {
  /** 来源：rpc / runner / render / tool。 */
  readonly source: string
  /** 机器码或短分类（例如 `MEDIA_FFMPEG_UNAVAILABLE`）。 */
  readonly code?: string
  /** 面向人的一句话（由各层保证不含敏感内容）。 */
  readonly message: string
  readonly at: string
}

/** 诊断快照。 */
export interface DiagnosticsSnapshot {
  readonly errors: readonly DiagnosticsError[]
  /** 从进程启动到现在累计记录的错误数（环形缓冲会丢旧的，这个不会）。 */
  readonly errorCount: number
}

const MAX_ERRORS = 50
/** 单条消息上限，防止把整段堆栈/大对象塞进快照。 */
const MAX_MESSAGE = 300

export class DiagnosticsCollector {
  private readonly ring: DiagnosticsError[] = []
  private total = 0
  private readonly now: () => Date

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now ?? (() => new Date())
  }

  /**
   * 记一条错误。
   * @param source - 来源分类。
   * @param message - 面向人的一句话（超长会截断）。
   * @param code - 可选机器码。
   */
  recordError(source: string, message: string, code?: string): void {
    this.total += 1
    const trimmed = message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE)}…` : message
    this.ring.push({
      source: source.slice(0, 40),
      message: trimmed,
      at: this.now().toISOString(),
      ...code === undefined ? {} : { code: code.slice(0, 60) },
    })
    if (this.ring.length > MAX_ERRORS) this.ring.shift()
  }

  /** 取快照（最新在前）。 */
  snapshot(): DiagnosticsSnapshot {
    return { errors: [...this.ring].reverse(), errorCount: this.total }
  }
}
