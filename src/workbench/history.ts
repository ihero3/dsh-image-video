/**
 * 撤销/重做的领域支撑（Track A / A3，对应总任务书 §6.2、§7.1 的 undo/redo）。
 *
 * 为什么放在 workbench 层而不是客户端组件里：撤销栈的语义（合并、去重、上限、
 * 新编辑是否冲掉 redo）是**业务规则**，两个编辑面（画布、时间轴）必须完全一致。
 * 这里给一个纯逻辑的 {@link HistoryStack}，客户端只需包一层 React hook：
 *
 * ```ts
 * const history = new HistoryStack(record)
 * history.commitWith(next => ({ ...next, nodes: movedNodes }), '移动节点')
 * history.undo() // → 上一份 record
 * ```
 *
 * 约定：
 * - **相同状态不产生历史**（用 `equals` 判断，默认按 JSON 比较——画布/时间轴文档都很小）；
 * - **新编辑清空 redo**（标准编辑器行为）；
 * - **有上限**（默认 50 步），超了丢最旧的；
 * - 保存**不**清空历史（保存后仍可撤销，文档随之变脏——这是主流编辑器的行为）。
 */
import type { TimelineRecord } from './timeline.ts'
import type { WorkflowRecord } from './workflow.ts'

/** 历史栈选项。 */
export interface HistoryStackOptions<T> {
  /** 最多保留多少步（默认 50）。 */
  readonly limit?: number
  /** 相等判断（默认按 JSON 字符串比较）。 */
  readonly equals?: (left: T, right: T) => boolean
}

/** 一次历史条目的元信息（供 UI 显示"撤销 移动节点"）。 */
export interface HistoryEntryInfo {
  readonly label: string
  readonly at: string
}

/** 通用撤销/重做栈（不可变数据：每次 commit 存一份新状态）。 */
export class HistoryStack<T> {
  private readonly limit: number
  private readonly equals: (left: T, right: T) => boolean
  private past: T[] = []
  private future: T[] = []
  private state: T
  private labels: HistoryEntryInfo[] = []
  private futureLabels: HistoryEntryInfo[] = []

  constructor(initial: T, options: HistoryStackOptions<T> = {}) {
    this.state = initial
    this.limit = Math.max(1, options.limit ?? 50)
    this.equals = options.equals ?? ((left, right) => JSON.stringify(left) === JSON.stringify(right))
  }

  /** 当前状态。 */
  get current(): T {
    return this.state
  }

  /** 是否可撤销。 */
  get canUndo(): boolean {
    return this.past.length > 0
  }

  /** 是否可重做。 */
  get canRedo(): boolean {
    return this.future.length > 0
  }

  /** 可撤销步数。 */
  get undoSize(): number {
    return this.past.length
  }

  /** 可重做步数。 */
  get redoSize(): number {
    return this.future.length
  }

  /** 下一次撤销会撤销什么（UI 拿来显示"撤销：移动节点"）。 */
  peekUndo(): HistoryEntryInfo | undefined {
    return this.labels[this.labels.length - 1]
  }

  /** 下一次重做会重做什么。 */
  peekRedo(): HistoryEntryInfo | undefined {
    return this.futureLabels[this.futureLabels.length - 1]
  }

  /**
   * 提交一个新状态。
   * @param next - 新状态；与当前相等时**不产生历史**。
   * @param label - 这次编辑的名字（供 UI 展示）。
   * @param now - 时间戳来源（测试可注入）。
   * @returns 是否真的记入历史。
   */
  commit(next: T, label = '编辑', now: () => Date = () => new Date()): boolean {
    if (this.equals(this.state, next)) return false
    this.past.push(this.state)
    this.labels.push({ label, at: now().toISOString() })
    if (this.past.length > this.limit) {
      this.past.shift()
      this.labels.shift()
    }
    this.state = next
    // 新编辑清空 redo（标准行为）
    this.future = []
    this.futureLabels = []
    return true
  }

  /**
   * 用更新函数提交（拿当前状态算下一个），省去调用方手写旧值。
   * @param updater - 生成新状态的函数。
   * @param label - 编辑名。
   * @returns 是否真的记入历史。
   */
  commitWith(updater: (current: T) => T, label = '编辑'): boolean {
    return this.commit(updater(this.state), label)
  }

  /**
   * 撤销一步。
   * @returns 撤销后的状态；没有可撤销步骤时返回 `undefined`。
   */
  undo(): T | undefined {
    const previous = this.past.pop()
    if (previous === undefined) return undefined
    const info = this.labels.pop()
    this.future.push(this.state)
    if (info !== undefined) this.futureLabels.push(info)
    this.state = previous
    return this.state
  }

  /**
   * 重做一步。
   * @returns 重做后的状态；没有可重做步骤时返回 `undefined`。
   */
  redo(): T | undefined {
    const next = this.future.pop()
    if (next === undefined) return undefined
    const info = this.futureLabels.pop()
    this.past.push(this.state)
    if (info !== undefined) this.labels.push(info)
    this.state = next
    return this.state
  }

  /**
   * 丢弃全部历史，以给定状态作为新基线（例如"重新加载项目"）。
   * @param next - 新基线。
   */
  reset(next: T): void {
    this.state = next
    this.past = []
    this.future = []
    this.labels = []
    this.futureLabels = []
  }
}

/** 画布工作流历史的便捷类型。 */
export type WorkflowHistory = HistoryStack<WorkflowRecord>
/** 时间轴历史的便捷类型。 */
export type TimelineHistory = HistoryStack<TimelineRecord>
