/**
 * 跨运行的成功结果缓存（`R-FLW-5` 的省钱语义）。
 *
 * 口径：**按节点实际发给工具的参数**（即 `buildArgs` 之后的产物）算指纹，命中就复用
 * 上一次的产物、**不再调外部生成**——同一条提示词反复跑、或整张图重跑时，不该重复付费。
 *
 * 三条边界：
 * - 指纹只看"真正影响产出的东西"（节点种类 + 工具参数），与画布坐标、节点 id 无关；
 * - 缓存里的文件必须先确认**还在**（用户可能删了 outputs），不在就重新生成；
 * - 想强制重跑（例如换 seed 的语义由业务侧决定）时，运行器可 `bypassCache`。
 */
import { createHash } from 'node:crypto'
import type { WorkflowNodeKind } from './workflow.ts'

/** 一条缓存记录。 */
export interface CachedNodeResult {
  readonly key: string
  readonly kind: WorkflowNodeKind
  /** 实际发给工具的参数（审计用，便于人核对为什么命中）。 */
  readonly args: Record<string, unknown>
  readonly outputPath: string
  readonly bytes?: number
  readonly runId: string
  readonly nodeId: string
  readonly at: string
}

/** 缓存最多保留多少条（超过按时间淘汰最旧的）。 */
export const MAX_NODE_CACHE = 200

/** 递归把对象键排序后序列化：指纹不受键序影响。 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
}

/**
 * 算一个节点这次调用的指纹。
 * @param input.kind - 节点种类。
 * @param input.args - `buildArgs` 之后的工具参数。
 * @returns sha256 十六进制串。
 */
export function nodeCacheKey(input: { kind: WorkflowNodeKind; args: Record<string, unknown> }): string {
  return createHash('sha256').update(`${input.kind}|${canonical(input.args)}`).digest('hex')
}
