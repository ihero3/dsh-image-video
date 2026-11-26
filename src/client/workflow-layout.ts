/**
 * 画布侧纯函数：自动排版 + 节点库过滤。
 *
 * 与 `WorkflowCanvas.tsx` 分开是为了可单测（jsdom 里跑 d3-drag 不可靠），
 * 也与 `workbench/workflow.ts` 分开是为了守住边界：Catalog/校验属于**共用事实**，
 * 排版与检索只属于画布这一侧的呈现（`R-FLW-1`：画布只做交互）。
 */

/** 自动排版只关心的节点形状（`WorkflowNode` 的结构子集）。 */
export interface LayoutNode {
  readonly id: string
  readonly position: { readonly x: number; readonly y: number }
}

/** 自动排版只关心的连线形状。 */
export interface LayoutEdge {
  readonly source: string
  readonly target: string
}

/** 列宽：节点宽度 188 + 一条折线的横向余量（ComfyUI 的默认节奏）。 */
export const LAYOUT_COLUMN_GAP = 236
/** 行高：两张卡片 + 间距。 */
export const LAYOUT_ROW_GAP = 132
/** 左上角留白。 */
export const LAYOUT_PAD = 32

/**
 * 按「深度分列」重排节点（`A-9` 自动排列）。
 *
 * 口径：
 * - 一列 = 一条链上相同的深度，从左到右推进（读图方向与连线的数据流向一致）；
 * - 深度取**最长路径**而不是最短：菱形依赖（两个节点都要等同一个上游）不会叠到同一列；
 * - 同列内保持用户原来的上下顺序（按 y，再按 x），自动排列不该把原本的顺序打乱；
 * - 环（导入的畸形图）不阻断排版：参与不了拓扑序的节点排到最右侧一列。
 *
 * 纯函数、不改入参——画布拿返回值一次性 `setNodes`。
 * @param nodes - 图里的节点。
 * @param edges - 图里的连线（两端不在图里的边忽略）。
 * @returns 节点 id → 新坐标。
 */
export function autoLayout(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map(node => [node.id, node]))
  const incoming = new Map<string, string[]>(nodes.map(node => [node.id, []]))
  const outgoing = new Map<string, string[]>(nodes.map(node => [node.id, []]))
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue
    if (edge.source === edge.target) continue
    outgoing.get(edge.source)?.push(edge.target)
    incoming.get(edge.target)?.push(edge.source)
  }

  // 最长路径分层：Kahn 拓扑序，一边出队一边把深度推给下游
  const indegree = new Map<string, number>(nodes.map(node => [node.id, incoming.get(node.id)?.length ?? 0]))
  const depth = new Map<string, number>(nodes.map(node => [node.id, 0]))
  const queue = nodes.filter(node => (indegree.get(node.id) ?? 0) === 0).map(node => node.id)
  const ordered: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    ordered.push(id)
    for (const next of outgoing.get(id) ?? []) {
      depth.set(next, Math.max(depth.get(next) ?? 0, (depth.get(id) ?? 0) + 1))
      const left = (indegree.get(next) ?? 1) - 1
      indegree.set(next, left)
      if (left === 0) queue.push(next)
    }
  }
  // 环里的节点排不进拓扑序：给它们一列，避免"原地不动"看起来像没生效
  const maxDepth = Math.max(0, ...ordered.map(id => depth.get(id) ?? 0))
  for (const node of nodes) if (!ordered.includes(node.id)) depth.set(node.id, maxDepth + 1)

  const columns = new Map<number, LayoutNode[]>()
  for (const node of nodes) {
    const column = depth.get(node.id) ?? 0
    const bucket = columns.get(column)
    if (bucket === undefined) columns.set(column, [node])
    else bucket.push(node)
  }

  const positions = new Map<string, { x: number; y: number }>()
  for (const [column, bucket] of columns) {
    const sorted = [...bucket].sort((left, right) => (
      left.position.y - right.position.y
      || left.position.x - right.position.x
      || left.id.localeCompare(right.id)
    ))
    sorted.forEach((node, row) => {
      positions.set(node.id, {
        x: LAYOUT_PAD + column * LAYOUT_COLUMN_GAP,
        y: LAYOUT_PAD + row * LAYOUT_ROW_GAP,
      })
    })
  }
  return positions
}

/** 过滤用的最小形状：节点库一项（种类 + 已本地化的名字）。 */
export interface SearchableItem {
  readonly kind: string
  readonly label: string
}

/**
 * 节点库 / 快速添加的检索。
 *
 * 口径（对齐 ComfyUI 的节点搜索、但更宽松）：空格分词，**每个词都要命中**，
 * 命中范围是本地化名字或种类 id；大小写不敏感。中文名可以直接按字搜。
 * @param items - 候选。
 * @param query - 用户输入（空白视为不过滤）。
 * @returns 命中的子集，保持原顺序。
 */
export function filterItems<T extends SearchableItem>(items: readonly T[], query: string): T[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return [...items]
  return items.filter(item => {
    const haystack = `${item.label} ${item.kind}`.toLowerCase()
    return tokens.every(token => haystack.includes(token))
  })
}
