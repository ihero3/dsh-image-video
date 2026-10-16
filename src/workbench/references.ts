/**
 * 引用检查（`T2-4` / `T2-5` 的收尾）：删素材/资源前先看谁在用。
 *
 * 口径（`R-MED-2`/`R-MED-6`）：**默认拒绝删除被引用的对象**，并把引用位置说清楚
 * （哪张时间轴的哪条轨哪个片段、哪张流程图的哪个节点），用户确认后才允许 `force`。
 * 这里只做纯函数扫描，读写交给 store。
 */
import type { AssetRecord } from './records.ts'
import type { TimelineRecord } from './timeline.ts'
import type { WorkflowRecord } from './workflow.ts'

/** 一处引用。 */
export interface ReferenceHit {
  readonly kind: 'timeline' | 'workflow'
  readonly id: string
  readonly name: string
  /** 人能照着找过去的位置描述。 */
  readonly where: string
}

/** 把任意值递归展开成字符串集合（节点参数里可能嵌数组/对象）。 */
function collectStrings(value: unknown, found: Set<string>): void {
  if (typeof value === 'string') { found.add(value); return }
  if (Array.isArray(value)) { for (const item of value) collectStrings(item, found); return }
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) collectStrings(item, found)
  }
}

/**
 * 找出一份文档里对某素材的引用。
 * @param document - 时间轴与流程图（`null` 表示该类还没加载）。
 * @param asset - 素材记录。
 * @returns 引用位置；为空表示可以安全删除。
 */
export function findAssetReferences(
  document: { timelines: readonly TimelineRecord[]; workflows: readonly WorkflowRecord[] },
  asset: Pick<AssetRecord, 'id' | 'path'>,
): ReferenceHit[] {
  const hits: ReferenceHit[] = []
  for (const timeline of document.timelines) {
    for (const track of timeline.tracks) {
      for (const clip of track.clips) {
        if (clip.assetPath === asset.path) {
          hits.push({
            kind: 'timeline', id: timeline.id, name: timeline.name,
            where: `${track.kind} 轨 · 片段 ${clip.id}（${clip.startMs}ms 起）`,
          })
        }
      }
    }
  }
  for (const workflow of document.workflows) {
    for (const node of workflow.nodes) {
      const values = new Set<string>()
      collectStrings(node.params, values)
      if (!values.has(asset.path) && !values.has(asset.id)) continue
      hits.push({ kind: 'workflow', id: workflow.id, name: workflow.name, where: `节点 ${node.id}（${node.kind}）` })
    }
  }
  return hits
}

/**
 * 找出一份文档里对某个创作资源的引用（节点参数里出现该资源 id）。
 * @param document - 流程图集合。
 * @param resourceId - 资源 id。
 * @returns 引用位置。
 */
export function findResourceReferences(
  document: { workflows: readonly WorkflowRecord[] },
  resourceId: string,
): ReferenceHit[] {
  const hits: ReferenceHit[] = []
  for (const workflow of document.workflows) {
    for (const node of workflow.nodes) {
      const values = new Set<string>()
      collectStrings(node.params, values)
      if (!values.has(resourceId)) continue
      hits.push({ kind: 'workflow', id: workflow.id, name: workflow.name, where: `节点 ${node.id}（${node.kind}）` })
    }
  }
  return hits
}

/** 把引用位置拼成一句可操作的话。 */
export function describeReferences(hits: readonly ReferenceHit[]): string {
  return hits
    .map(hit => `${hit.kind === 'timeline' ? '时间轴' : '流程图'}「${hit.name}」的 ${hit.where}`)
    .join('；')
}
