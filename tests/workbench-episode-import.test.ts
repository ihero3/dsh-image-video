/**
 * 单集导出 → 导入往返：导入必须还原分镜（v1 清单不含，v2 补齐），
 * 并且只新建集、不覆盖现有内容；id 全量重发，避免跨项目撞车。
 */
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { exportEpisode } from '../src/workbench/episode-export.ts'

const STAMP = '2026-11-09T00:00:00.000Z'

async function makeStore() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-episode-import-'))
  return new WorkbenchStore({ directory, now: () => new Date(STAMP) })
}

async function seed(store: WorkbenchStore) {
  const project = await store.createProject('剧集')
  const episode = (await store.listEpisodes(project.id))[0]!
  await store.updateEpisode(episode.id, { title: '雨夜篇', script: '这是一集剧本' })
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

describe('单集导入', () => {
  it('roundtrip 还原剧本 / 分段 / 分镜，并新建一集而不覆盖源集', async () => {
    const store = await makeStore()
    const { project, episode } = await seed(store)
    const exported = await exportEpisode({
      store, episodeId: episode.id, targetDir: join(await mkdtemp(join(tmpdir(), 'dsh-ep-exp-')), 'ep'),
    })

    const manifest = JSON.parse(await readFile(exported.manifestPath, 'utf8')) as Record<string, unknown>
    const result = await store.importEpisode({ projectId: project.id, manifest })

    expect(result.warnings).toEqual([])
    expect(result.episode.id).not.toBe(episode.id)
    expect(result.episode.no).toBe(episode.no + 1)
    expect(result.episode.title).toBe('雨夜篇')
    expect(result.episode.script.text).toBe('这是一集剧本')
    expect(result.episode.segments).toHaveLength(1)
    expect(result.episode.segments[0]?.promptText).toBe('开场')
    expect(result.episode.segments[0]?.id).not.toBe(episode.segments[0]?.id)
    expect(result.episode.segments[0]?.storyboardId).toBe(result.episode.storyboards[0]?.id)
    expect(result.episode.storyboards[0]?.shots.map(shot => shot.imagePrompt)).toEqual(['雨夜街角', '特写眼神'])
    expect(result.episode.storyboards[0]?.shots[0]?.id).not.toBe(episode.storyboards[0]?.shots[0]?.id)
    // 源集原样保留
    expect(await store.getEpisode(episode.id)).toEqual(episode)
  })

  it('v1 清单按只有分段导入，给出分镜缺失提示', async () => {
    const store = await makeStore()
    const { project, episode } = await seed(store)
    const exported = await exportEpisode({
      store, episodeId: episode.id, targetDir: join(await mkdtemp(join(tmpdir(), 'dsh-ep-exp-')), 'ep'),
    })
    const legacy = JSON.parse(await readFile(exported.manifestPath, 'utf8')) as Record<string, unknown>
    legacy['formatVersion'] = 1
    delete legacy['storyboards']

    const result = await store.importEpisode({ projectId: project.id, manifest: legacy })
    expect(result.warnings.some(text => text.includes('v1'))).toBe(true)
    expect(result.episode.storyboards).toEqual([])
    expect(result.episode.segments).toHaveLength(1)
  })

  it('拒绝非法清单：插件不匹配 / 版本不支持 / 结构损坏', async () => {
    const store = await makeStore()
    const { project } = await seed(store)
    await expect(store.importEpisode({ projectId: project.id, manifest: { plugin: 'other' } }))
      .rejects.toThrow('不是 dsh-image-video')
    await expect(store.importEpisode({ projectId: project.id, manifest: { plugin: 'dsh-image-video', formatVersion: 999 } }))
      .rejects.toThrow('不支持的清单版本')
    await expect(store.importEpisode({ projectId: project.id, manifest: { plugin: 'dsh-image-video', formatVersion: 2, episode: { script: '' } } }))
      .rejects.toThrow('segments')
  })
})
