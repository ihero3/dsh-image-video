/**
 * 分镜 → 工作流的确定性映射（集重构 M5）。
 *
 * 每条镜头对应 `image-generate → video-generate` 两个节点，镜头之间顺接，末尾接 `preview`；
 * 节点 id 由镜头 id 推导，因此同一份分镜重复同步得到**完全相同**的图（幂等），
 * 而增删镜头会自然反映到下一次同步结果里。工作流 id 按集固定，重复同步只更新同一份文档。
 *
 * @module dsh-image-video/workbench/storyboard-workflow
 */

import type { EpisodeRecord } from './episodes.ts'
import { defaultParams, WORKFLOW_SOURCE_HANDLE, WORKFLOW_TARGET_HANDLE, type WorkflowEdge, type WorkflowNode } from './workflow.ts'

/** 工作流 id：一集一份，重复同步复用。 */
export function episodeWorkflowId(episodeId: string): string {
  return `wfl-ep-${episodeId}`
}

/** 同步结果：可直接交给 `store.saveWorkflow`。 */
export interface EpisodeWorkflowGraph {
  readonly id: string
  readonly name: string
  readonly nodes: readonly WorkflowNode[]
  readonly edges: readonly WorkflowEdge[]
}

/**
 * 把一集的分镜映射成工作流图。
 * @param episode - 集记录（分镜取自 `storyboards`）。
 * @returns 固定的工作流 id、名称与画布图。
 * @throws {Error} 本集没有镜头时（同步空图没有意义，如实拒绝而不是产出空画布）。
 */
export function buildEpisodeWorkflow(episode: EpisodeRecord): EpisodeWorkflowGraph {
  const shots = episode.storyboards.flatMap(storyboard => [...storyboard.shots].sort((left, right) => left.order - right.order))
  if (shots.length === 0) throw new Error('本集还没有分镜镜头，无法同步到工作流')

  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []
  /** 上一个节点的输出端（镜头串成一条链）。 */
  let previous: string | undefined
  const link = (source: string, target: string): void => {
    edges.push({ id: `edg-${source}-${target}`, source, target, sourceHandle: WORKFLOW_SOURCE_HANDLE, targetHandle: WORKFLOW_TARGET_HANDLE })
    previous = target
  }

  shots.forEach((shot, index) => {
    const imageId = `img-${shot.id}`
    const videoId = `vid-${shot.id}`
    nodes.push({
      id: imageId,
      kind: 'image-generate',
      position: { x: 0, y: index * 200 },
      params: { ...defaultParams('image-generate'), prompt: shot.imagePrompt },
    })
    nodes.push({
      id: videoId,
      kind: 'video-generate',
      position: { x: 280, y: index * 200 },
      params: { ...defaultParams('video-generate'), prompt: shot.videoPrompt, duration: shot.durationSec, compare: false },
    })
    if (previous === undefined) previous = imageId
    else link(previous, imageId)
    link(imageId, videoId)
  })

  const previewId = 'prv-episode'
  nodes.push({ id: previewId, kind: 'preview', position: { x: 560, y: 0 }, params: defaultParams('preview') })
  if (previous !== undefined) link(previous, previewId)

  return {
    id: episodeWorkflowId(episode.id),
    name: `第${episode.no}集 分镜`,
    nodes,
    edges,
  }
}
