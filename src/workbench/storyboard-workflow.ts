/**
 * 分镜 → 工作流的确定性映射（集重构 M5）。
 *
 * 每条镜头对应 `image-generate → video-generate` 两个节点，**每镜独立成一支**，
 * 各自的 `video-generate` 汇聚到同一个 `preview`。
 *
 * 早期版本把镜头串成 `img1 → vid1 → img2 → vid2 → preview`，但 `video-generate` 的输出是
 * `media`，`image-generate` 的输入是 `text`，端口不兼容 → `validateWorkflow` 产出
 * `port-mismatch` → 画布运行按钮禁用（评审清单 B1）。镜头本就是"逐镜独立生成"的语义，
 * 改成并行分支既消除不匹配，也不会把上一镜的成片误当下一镜的生图提示词。
 *
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
  const videoIds: string[] = []
  const link = (source: string, target: string): void => {
    edges.push({ id: `edg-${source}-${target}`, source, target, sourceHandle: WORKFLOW_SOURCE_HANDLE, targetHandle: WORKFLOW_TARGET_HANDLE })
  }

  shots.forEach((shot, index) => {
    const imageId = `img-${shot.id}`
    const videoId = `vid-${shot.id}`
    // 按镜引用与模型写进节点参数：不改变图结构、不制造端口不匹配的连线，
    // 但也让同步过去的工作流能看到每镜用的是哪个模型和哪些素材/资源。
    const refText = shot.refs.length === 0 ? '' : JSON.stringify(shot.refs)
    nodes.push({
      id: imageId,
      kind: 'image-generate',
      position: { x: 0, y: index * 200 },
      params: {
        ...defaultParams('image-generate'),
        prompt: shot.imagePrompt,
        ...shot.imageModel === undefined ? {} : { model: shot.imageModel },
        refs: refText,
      },
    })
    nodes.push({
      id: videoId,
      kind: 'video-generate',
      position: { x: 280, y: index * 200 },
      params: {
        ...defaultParams('video-generate'),
        prompt: shot.videoPrompt,
        duration: shot.durationSec,
        compare: false,
        ...shot.videoModel === undefined ? {} : { model: shot.videoModel },
        refs: refText,
      },
    })
    // 只在镜头内部连 image → video；镜头之间不连线，避免 media → text 的端口不匹配。
    link(imageId, videoId)
    videoIds.push(videoId)
  })

  const previewId = 'prv-episode'
  // 预览放在所有分支的纵向中点，多镜头时连线不会一边倒。
  nodes.push({
    id: previewId,
    kind: 'preview',
    position: { x: 560, y: Math.round((shots.length - 1) * 100) },
    params: defaultParams('preview'),
  })
  // media → media，端口兼容；每个镜头各自产出一路预览输入。
  for (const videoId of videoIds) link(videoId, previewId)

  return {
    id: episodeWorkflowId(episode.id),
    name: `第${episode.no}集 分镜`,
    nodes,
    edges,
  }
}
