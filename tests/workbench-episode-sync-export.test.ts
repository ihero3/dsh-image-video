/**
 * M5：分镜 ↔ 工作流的确定性映射与单集导出。
 *
 * 重点覆盖幂等（同一份分镜重复同步出同一张图）、增删镜头会反映到下一次同步、
 * 空分镜如实拒绝，以及导出只看本集、缺失文件进 `missing` 而非静默跳过。
 */
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { buildEpisodeWorkflow, episodeWorkflowId } from '../src/workbench/storyboard-workflow.ts'
import { validateWorkflow, WORKFLOW_SOURCE_HANDLE, WORKFLOW_TARGET_HANDLE } from '../src/workbench/workflow.ts'
import { exportEpisode, EPISODE_EXPORT_VERSION } from '../src/workbench/episode-export.ts'

const STAMP = '2026-11-09T00:00:00.000Z'

/** 临时 store（冻结时钟）。 */
async function makeStore() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-episode-sync-'))
  const store = new WorkbenchStore({ directory, now: () => new Date(STAMP) })
  return { store, directory }
}

/** 建一集并写入两条分镜镜头。 */
async function episodeWithShots(store: WorkbenchStore) {
  const project = await store.createProject('剧集')
  const episode = (await store.listEpisodes(project.id))[0]!
  const segment = await store.createSegment(episode.id, { promptText: '开场', durationSec: 10 })
  await store.upsertStoryboard({
    episodeId: episode.id,
    segmentId: segment.id,
    shots: [
      { order: 1, durationSec: 5, imagePrompt: '雨夜街角', videoPrompt: '镜头推进' },
      { order: 2, durationSec: 5, imagePrompt: '特写眼神', videoPrompt: '缓慢拉近' },
    ],
  })
  return { project, episode: await store.getEpisode(episode.id) }
}

describe('buildEpisodeWorkflow', () => {
  it('maps every shot to an independent image → video branch converging on preview', async () => {
    const { store } = await makeStore()
    const { episode } = await episodeWithShots(store)
    const graph = buildEpisodeWorkflow(episode)

    expect(graph.id).toBe(episodeWorkflowId(episode.id))
    expect(graph.name).toBe('第0集 分镜')
    // 两镜：图 → 视频 ×2 + 预览
    expect(graph.nodes).toHaveLength(5)
    expect(graph.nodes.filter(node => node.kind === 'image-generate')).toHaveLength(2)
    expect(graph.nodes.filter(node => node.kind === 'video-generate')).toHaveLength(2)
    expect(graph.nodes.at(-1)?.kind).toBe('preview')
    // B1：每镜独立一支，两镜共 4 条边（img→vid ×2 + vid→preview ×2），
    // 不允许出现 vid1 → img2 这种 media → text 的跨镜连线。
    expect(graph.edges).toHaveLength(4)
    expect(graph.edges.map(edge => [edge.source, edge.target])).toEqual([
      [`img-${episode.storyboards[0]!.shots[0]!.id}`, `vid-${episode.storyboards[0]!.shots[0]!.id}`],
      [`img-${episode.storyboards[0]!.shots[1]!.id}`, `vid-${episode.storyboards[0]!.shots[1]!.id}`],
      [`vid-${episode.storyboards[0]!.shots[0]!.id}`, 'prv-episode'],
      [`vid-${episode.storyboards[0]!.shots[1]!.id}`, 'prv-episode'],
    ])
    // 这张图必须能被画布校验通过，否则同步后运行按钮是禁用的
    expect(validateWorkflow(graph.nodes, graph.edges).ok).toBe(true)
    const image = graph.nodes.find(node => node.kind === 'image-generate')!
    expect(image.params.prompt).toBe('雨夜街角')
  })

  it('rejects the old cross-shot edge so the B1 mistake cannot come back', async () => {
    const { store } = await makeStore()
    const { episode } = await episodeWithShots(store)
    const graph = buildEpisodeWorkflow(episode)
    const [first, second] = episode.storyboards[0]!.shots
    // 反向证明：把上一镜的 video 输出（media）接回下一镜的 image 输入（text），必须报端口不匹配
    const oldEdge = {
      id: 'edg-b1-old',
      source: `vid-${first!.id}`, target: `img-${second!.id}`,
      sourceHandle: WORKFLOW_SOURCE_HANDLE, targetHandle: WORKFLOW_TARGET_HANDLE,
    }
    const validation = validateWorkflow(graph.nodes, [...graph.edges, oldEdge])
    expect(validation.ok).toBe(false)
    expect(validation.issues.some(issue => issue.code === 'port-mismatch')).toBe(true)
  })

  it('stays runnable for one shot and three shots', async () => {
    const { store } = await makeStore()
    const { episode } = await episodeWithShots(store)
    const storyboard = episode.storyboards[0]!

    for (const count of [1, 3]) {
      const shots = storyboard.shots.slice(0, count).concat(
        count === 3 ? [{ ...storyboard.shots[0]!, order: 3, imagePrompt: '远景', videoPrompt: '拉远' }] : [],
      )
      await store.upsertStoryboard({
        id: storyboard.id, episodeId: episode.id, segmentId: storyboard.segmentId, shots,
      })
      const graph = buildEpisodeWorkflow(await store.getEpisode(episode.id))
      const validation = validateWorkflow(graph.nodes, graph.edges)
      expect(validation.ok, `${count} shots: ${validation.issues.map(issue => issue.message).join('; ')}`).toBe(true)
      expect(graph.edges).toHaveLength(count * 2)
    }
  })

  it('is idempotent for the same storyboard and reflects added shots', async () => {
    const { store } = await makeStore()
    const { episode } = await episodeWithShots(store)
    const first = await store.syncEpisodeWorkflow(episode.id)
    const second = await store.syncEpisodeWorkflow(episode.id)
    expect(second.id).toBe(first.id)
    expect(second.nodes.map(node => node.id)).toEqual(first.nodes.map(node => node.id))
    // 存下来的那份也必须可运行——画布禁用运行按钮用的就是这份图
    expect(validateWorkflow(second.nodes, second.edges).ok).toBe(true)
    expect((await store.listWorkflows(episode.projectId)).filter(item => item.id === first.id)).toHaveLength(1)

    // 再加一镜 → 同一个工作流文档变成 7 个节点
    const storyboard = episode.storyboards[0]!
    await store.upsertStoryboard({
      id: storyboard.id,
      episodeId: episode.id,
      segmentId: storyboard.segmentId,
      shots: [...storyboard.shots, { order: 3, durationSec: 4, imagePrompt: '远景', videoPrompt: '拉远' }],
    })
    const third = await store.syncEpisodeWorkflow(episode.id)
    expect(third.id).toBe(first.id)
    expect(third.nodes.filter(node => node.kind === 'video-generate')).toHaveLength(3)
  })

  it('carries per-shot model and refs into the synced nodes', async () => {
    const { store } = await makeStore()
    const { episode } = await episodeWithShots(store)
    const storyboard = episode.storyboards[0]!
    await store.upsertStoryboard({
      id: storyboard.id,
      episodeId: episode.id,
      segmentId: storyboard.segmentId,
      shots: [{
        ...storyboard.shots[0]!,
        imageModel: 'img-model-x', videoModel: 'vid-model-y',
        refs: [{ kind: 'asset', id: 'ast-7', order: 1 }],
      }],
    })
    const graph = buildEpisodeWorkflow(await store.getEpisode(episode.id))
    const image = graph.nodes.find(node => node.kind === 'image-generate')!
    const video = graph.nodes.find(node => node.kind === 'video-generate')!
    expect(image.params.model).toBe('img-model-x')
    expect(video.params.model).toBe('vid-model-y')
    expect(JSON.parse(String(image.params.refs))).toEqual([{ kind: 'asset', id: 'ast-7', order: 1 }])
    expect(video.params.refs).toBe(image.params.refs)
  })

  it('refuses to sync an episode without shots', async () => {
    const { store } = await makeStore()
    const project = await store.createProject('空集')
    const episode = (await store.listEpisodes(project.id))[0]!
    await expect(store.syncEpisodeWorkflow(episode.id)).rejects.toThrow('还没有分镜')
  })
})

describe('exportEpisode', () => {
  it('writes one episode manifest and copies only assets it references', async () => {
    const { store } = await makeStore()
    const { episode, project } = await episodeWithShots(store)
    const shotId = episode.storyboards[0]!.shots[0]!.id

    // 两张素材：一张被镜头引用，一张与本题无关
    const mediaDir = await mkdtemp(join(tmpdir(), 'dsh-episode-media-'))
    const usedPath = join(mediaDir, 'used.png')
    const otherPath = join(mediaDir, 'other.png')
    await writeFile(usedPath, 'png')
    await writeFile(otherPath, 'png')
    const used = (await store.attachAsset({ projectId: project.id, kind: 'image', path: usedPath })).asset
    const other = (await store.attachAsset({ projectId: project.id, kind: 'image', path: otherPath })).asset
    await store.upsertStoryboard({
      id: episode.storyboards[0]!.id,
      episodeId: episode.id,
      segmentId: episode.storyboards[0]!.segmentId,
      shots: [{
        id: shotId, order: 1, durationSec: 5, imagePrompt: '雨夜', videoPrompt: '推进',
        refs: [{ kind: 'asset', id: used.id, order: 1 }],
      }],
    })

    const targetDir = join(await mkdtemp(join(tmpdir(), 'dsh-episode-export-')), 'ep')
    const result = await exportEpisode({ store, episodeId: episode.id, targetDir, now: () => new Date(STAMP) })
    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8')) as {
      formatVersion: number
      episode: { no: number; durationSec: number }
      segments: unknown[]
      files: { assetId: string }[]
      missing: string[]
    }
    expect(manifest.formatVersion).toBe(EPISODE_EXPORT_VERSION)
    expect(manifest.episode.no).toBe(0)
    expect(manifest.episode.durationSec).toBe(10)
    expect(manifest.segments).toHaveLength(1)
    expect(manifest.files.map(file => file.assetId)).toEqual([used.id])
    expect(manifest.files.some(file => file.assetId === other.id)).toBe(false)
    expect(manifest.missing).toEqual([])
    expect((await readdir(join(targetDir, 'files'))).length).toBe(1)
  })

  it('records missing asset files instead of skipping them silently', async () => {
    const { store } = await makeStore()
    const { episode, project } = await episodeWithShots(store)
    const storyboard = episode.storyboards[0]!
    const gone = join(tmpdir(), 'dsh-not-there', 'gone.png')
    const asset = (await store.attachAsset({ projectId: project.id, kind: 'image', path: gone })).asset
    await store.upsertStoryboard({
      id: storyboard.id,
      episodeId: episode.id,
      segmentId: storyboard.segmentId,
      shots: storyboard.shots.map(shot => ({
        ...shot,
        refs: [{ kind: 'asset' as const, id: asset.id, order: 1 }],
      })),
    })
    const targetDir = join(await mkdtemp(join(tmpdir(), 'dsh-episode-export-')), 'ep')
    const result = await exportEpisode({ store, episodeId: episode.id, targetDir, now: () => new Date(STAMP) })
    expect(result.manifest.missing).toContain(gone)
    expect(result.manifest.files).toEqual([])
  })
})
