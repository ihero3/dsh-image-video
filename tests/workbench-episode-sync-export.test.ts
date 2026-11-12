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
  it('maps every shot to image → video nodes chained into one preview', async () => {
    const { store } = await makeStore()
    const { episode } = await episodeWithShots(store)
    const graph = buildEpisodeWorkflow(episode)

    expect(graph.id).toBe(episodeWorkflowId(episode.id))
    expect(graph.name).toBe('第1集 分镜')
    // 两镜：图 → 视频 ×2 + 预览
    expect(graph.nodes).toHaveLength(5)
    expect(graph.nodes.filter(node => node.kind === 'image-generate')).toHaveLength(2)
    expect(graph.nodes.filter(node => node.kind === 'video-generate')).toHaveLength(2)
    expect(graph.nodes.at(-1)?.kind).toBe('preview')
    // 镜头串成一条链：img1 → vid1 → img2 → vid2 → preview，共 4 条边
    expect(graph.edges).toHaveLength(4)
    const image = graph.nodes.find(node => node.kind === 'image-generate')!
    expect(image.params.prompt).toBe('雨夜街角')
  })

  it('is idempotent for the same storyboard and reflects added shots', async () => {
    const { store } = await makeStore()
    const { episode } = await episodeWithShots(store)
    const first = await store.syncEpisodeWorkflow(episode.id)
    const second = await store.syncEpisodeWorkflow(episode.id)
    expect(second.id).toBe(first.id)
    expect(second.nodes.map(node => node.id)).toEqual(first.nodes.map(node => node.id))
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
    expect(manifest.episode.no).toBe(1)
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
