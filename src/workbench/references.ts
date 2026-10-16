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
  document: { workflows: readonly WorkflowRecord[]; timelines?: readonly TimelineRecord[] },
  resourceId: string,
): ReferenceHit[] {
  const hits: ReferenceHit[] = []
  // `R-PRJ-4` 要求删资源前扫 工作流 / 时间轴 / 项目默认绑定：
  //   工作流 ✓（resource-reference 节点的 resourceId）
  //   时间轴 ✓（任何字段等于该 id 的字符串，含未来可能加的字幕样式/渲染资源绑定）
  //   项目默认绑定 —— V1 的 `ProjectRecord` 没有"默认资源绑定"字段，因此这一项在 V1 为空集；
  //     将来加了默认绑定，必须回到这里补一条扫描（这条注释就是复核锚点）。
  for (const timeline of document.timelines ?? []) {
    for (const track of timeline.tracks) {
      for (const clip of track.clips) {
        const values = new Set<string>()
        collectStrings(clip, values)
        if (values.has(resourceId)) {
          hits.push({
            kind: 'timeline', id: timeline.id, name: timeline.name,
            where: `${track.kind} 轨 · 片段 ${clip.id}`,
          })
        }
      }
    }
  }
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
