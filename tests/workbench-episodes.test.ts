/**
 * 剧集 → 集 → 分段 → 分镜 的数据层：懒建首集、引用增删移、分段插入与重排、
 * 分镜回填、任务归属与删除规则。
 */
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WorkbenchStore } from '../src/workbench/store.ts'

/** A store over a throwaway directory with a frozen clock. */
async function makeStore() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-image-video-episode-'))
  const store = new WorkbenchStore({ directory, now: () => new Date('2026-11-09T00:00:00.000Z') })
  return { store, directory }
}

describe('workbench episodes', () => {
  it('lazily creates episode #1 and orders episodes by number', async () => {
    const { store } = await makeStore()
    const project = await store.createProject('剧集')
    const episodes = await store.listEpisodes(project.id)
    expect(episodes).toHaveLength(1)
    expect(episodes[0]!.no).toBe(1)
    expect(episodes[0]!.title).toBe('第1集')

    const second = await store.createEpisode(project.id, { title: '第二集' })
    expect(second.no).toBe(2)
    expect(second.title).toBe('第二集')
    await expect(store.createEpisode(project.id, { no: 2 })).rejects.toThrow(/第2集已存在/)
    expect((await store.listEpisodes(project.id)).map(episode => episode.no)).toEqual([1, 2])
    await expect(store.createEpisode('nope')).rejects.toThrow(/未知的剧集/)
  })

  it('updates title, remark and script on one episode', async () => {
    const { store } = await makeStore()
    const project = await store.createProject('剧本')
    const episode = (await store.listEpisodes(project.id))[0]!
    const updated = await store.updateEpisode(episode.id, {
      title: '开场', remark: '  第一幕  ', script: '第一场 日 内',
    })
    expect(updated.title).toBe('开场')
    expect(updated.remark).toBe('第一幕')
    expect(updated.script.text).toBe('第一场 日 内')
    const cleared = await store.updateEpisode(episode.id, { remark: null, script: { text: '' } })
    expect(cleared.remark).toBeUndefined()
    expect(cleared.script.text).toBe('')
  })

  it('keeps episode resource and asset references as ids, with move semantics', async () => {
    const { store } = await makeStore()
    const project = await store.createProject('引用')
    const other = await store.createProject('别的剧集')
    const role = await store.createResource({ projectId: project.id, kind: 'role', name: '主角' })
    const costume = await store.createResource({ projectId: project.id, kind: 'costume', name: '校服' })
    const episode = (await store.listEpisodes(project.id))[0]!

    const added = await store.episodeResources(episode.id, 'add', { resourceId: role.id })
    expect(added).toEqual([{ resourceId: role.id, category: 'role', order: 1 }])

    const both = await store.episodeResources(episode.id, 'add', { resourceId: costume.id, order: 1 })
    expect(both.map(ref => ref.resourceId)).toEqual([costume.id, role.id])
    expect(both.map(ref => ref.order)).toEqual([1, 2])

    const moved = await store.episodeResources(episode.id, 'move', {
      resourceId: role.id, category: 'scene', order: 1,
    })
    expect(moved).toEqual([
      { resourceId: role.id, category: 'scene', order: 1 },
      { resourceId: costume.id, category: 'costume', order: 2 },
    ])

    await expect(store.episodeResources(episode.id, 'add', { resourceId: role.id })).rejects.toThrow(/已在本集引用中/)
    await expect(store.episodeResources(episode.id, 'add', { resourceId: 'nope' })).rejects.toThrow(/本剧集没有该资源/)

    // 全局素材库：别的剧集登记的素材也能进本集
    const attached = await store.attachAsset({ projectId: other.id, path: '/tmp/outputs/x.png', kind: 'image' })
    const assets = await store.episodeAssets(episode.id, 'add', { assetId: attached.asset.id })
    expect(assets).toEqual([{ assetId: attached.asset.id, category: 'ungrouped', order: 1 }])

    const removed = await store.episodeResources(episode.id, 'remove', { resourceId: role.id })
    expect(removed).toEqual([{ resourceId: costume.id, category: 'costume', order: 1 }])
  })

  it('creates, reorders, updates and deletes segments with contiguous order', async () => {
    const { store } = await makeStore()
    const project = await store.createProject('分段')
    const episode = (await store.listEpisodes(project.id))[0]!

    const first = await store.createSegment(episode.id, { promptText: '开场' })
    const second = await store.createSegment(episode.id, { promptText: '冲突', durationSec: 10 })
    expect([first.order, second.order]).toEqual([1, 2])
    expect(second.durationSec).toBe(10)

    const inserted = await store.createSegment(episode.id, { promptText: '插入', order: 2 })
    const listed = await store.listSegments(episode.id)
    expect(listed.map(segment => segment.promptText)).toEqual(['开场', '插入', '冲突'])
    expect(listed.map(segment => segment.order)).toEqual([1, 2, 3])

    const updated = await store.updateSegment(inserted.id, {
      durationSec: 20, imageModel: 'flux', skillId: 'director-default',
    })
    expect(updated.durationSec).toBe(20)
    expect(updated.imageModel).toBe('flux')
    const cleared = await store.updateSegment(inserted.id, { imageModel: null })
    expect(cleared.imageModel).toBeUndefined()

    await expect(store.updateSegment(first.id, { durationSec: 0 })).rejects.toThrow(/分段时长/)
    await expect(store.createSegment(episode.id, { durationSec: 61 })).rejects.toThrow(/分段时长/)

    // 移动到末尾
    await store.updateSegment(first.id, { order: 3 })
    expect((await store.listSegments(episode.id)).map(segment => segment.id))
      .toEqual([inserted.id, second.id, first.id])

    const removed = await store.deleteSegment(second.id)
    expect(removed.id).toBe(second.id)
    expect((await store.listSegments(episode.id)).map(segment => segment.order)).toEqual([1, 2])
  })

  it('saves storyboards per segment, backfills segment.storyboardId and cascades on segment delete', async () => {
    const { store } = await makeStore()
    const project = await store.createProject('分镜')
    const episode = (await store.listEpisodes(project.id))[0]!
    const segment = await store.createSegment(episode.id, { promptText: '打斗' })

    const saved = await store.upsertStoryboard({
      segmentId: segment.id,
      skillId: 'reverse-default',
      shots: [
        { imagePrompt: '镜头一', videoPrompt: '推近', durationSec: 5 },
        { imagePrompt: '镜头二', order: 1 },
      ],
    })
    expect(saved.episodeId).toBe(episode.id)
    expect(saved.shots.map(shot => shot.order)).toEqual([1, 2])
    expect((await store.listSegments(episode.id))[0]!.storyboardId).toBe(saved.id)
    expect((await store.getStoryboard(saved.id)).skillId).toBe('reverse-default')

    const replaced = await store.upsertStoryboard({ id: saved.id, segmentId: segment.id, shots: [{ imagePrompt: '重写' }] })
    expect((await store.getStoryboard(saved.id)).shots).toHaveLength(1)

    // 跨集写入必须拒
    const otherProject = await store.createProject('另一部')
    const otherEpisode = (await store.listEpisodes(otherProject.id))[0]!
    const otherSegment = await store.createSegment(otherEpisode.id)
    await expect(store.upsertStoryboard({ segmentId: otherSegment.id, episodeId: episode.id, shots: [] }))
      .rejects.toThrow(/属于第/)

    const removed = await store.deleteStoryboard(replaced.id)
    expect(removed.id).toBe(replaced.id)
    expect((await store.listSegments(episode.id))[0]!.storyboardId).toBeUndefined()

    // 删段级联删分镜
    const doomed = await store.createSegment(episode.id)
    await store.upsertStoryboard({ segmentId: doomed.id, shots: [{ imagePrompt: 'x' }] })
    await store.deleteSegment(doomed.id)
    expect((await store.listStoryboards(episode.id)).some(storyboard => storyboard.segmentId === doomed.id))
      .toBe(false)
  })

  it('files tasks under an episode, filters them, and keeps episodes across reloads', async () => {
    const { store, directory } = await makeStore()
    const project = await store.createProject('任务')
    const first = (await store.listEpisodes(project.id))[0]!
    const second = await store.createEpisode(project.id, { title: '第二集' })
    const segment = await store.createSegment(first.id)
    const task = await store.recordTask({
      kind: 'image', status: 'succeeded', projectId: project.id,
      episodeId: first.id, segmentId: segment.id, shotId: 'shot-1', prompt: 'x',
    })
    expect(task.episodeId).toBe(first.id)
    expect((await store.listTasks(10, project.id, first.id)).map(item => item.id)).toEqual([task.id])
    expect(await store.listTasks(10, project.id, second.id)).toEqual([])

    await expect(store.deleteEpisode(first.id)).rejects.toThrow(/关联任务/)
    await store.deleteEpisode(first.id, true)
    expect((await store.listEpisodes(project.id)).map(episode => episode.id)).toEqual([second.id])
    // 任务保留为历史，只清掉悬空的集归属
    expect((await store.listTasks(10, project.id))[0]!.episodeId).toBeUndefined()

    // 重开同一目录：集数据仍在
    const reopened = new WorkbenchStore({ directory, now: () => new Date('2026-11-09T00:00:00.000Z') })
    expect((await reopened.listEpisodes(project.id)).map(episode => episode.id)).toEqual([second.id])
    expect(await reopened.listSegments(second.id)).toEqual([])
  })
})
