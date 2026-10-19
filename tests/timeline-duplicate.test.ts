/**
 * 时间轴整条复制为副本（Track A / A86）。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { duplicateTimeline } from '../src/workbench/timeline.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function store(): Promise<WorkbenchStore> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-dup-'))
  dirs.push(directory)
  return new WorkbenchStore({ directory })
}

const source: TimelineRecord = {
  schemaVersion: 4, id: 'tml-src', projectId: 'prj-1', name: '第一版', frameRate: 30, burnSubtitles: true,
  burnLanguage: 'zh', normalizeLoudness: true,
  exportFormat: { width: 1080, height: 1920, frameRate: 30, bitrateKbps: 8000 },
  tracks: [
    { id: 'v1', kind: 'video', volume: 1, clips: [
      { id: 'v-a', assetPath: 'outputs/a.mp4', startMs: 0, durationMs: 1000, speed: 1.5, fade: 200 },
      { id: 'v-b', assetPath: 'outputs/b.mp4', startMs: 1000, durationMs: 1000, transition: 'fade', transitionDurationMs: 300 },
    ] },
    { id: 's1', kind: 'subtitle', language: 'zh', clips: [{ id: 's-a', text: '台词', startMs: 0, durationMs: 500 }] },
  ],
  createdAt: '', updatedAt: '',
}

describe('duplicateTimeline (A86)', () => {
  it('copies everything but regenerates ids and shares assets', () => {
    const copy = duplicateTimeline(source, {
      newId: 'tml-copy', newName: '副本',
      newClipId: (prefix, index) => `${prefix}-new-${index}`,
    })
    expect(copy.id).toBe('tml-copy')
    expect(copy.name).toBe('副本')
    // 设置原样保留
    expect(copy).toMatchObject({ burnLanguage: 'zh', normalizeLoudness: true, burnSubtitles: true })
    expect(copy.exportFormat).toEqual(source.exportFormat)
    // 片段 id 全新、其它内容（含速度/转场/语言）保留
    expect(copy.tracks[0]?.clips.map(clip => clip.id)).toEqual(['v0-new-0', 'v0-new-1'])
    expect(copy.tracks[0]?.clips[0]).toMatchObject({ assetPath: 'outputs/a.mp4', speed: 1.5, fade: 200 })
    expect(copy.tracks[0]?.clips[1]).toMatchObject({ transition: 'fade', transitionDurationMs: 300 })
    expect(copy.tracks[1]?.language).toBe('zh')
    // 原时间轴没被改动
    expect(source.tracks[0]?.clips.map(clip => clip.id)).toEqual(['v-a', 'v-b'])
  })

  it('saves a copy with a deduplicated name', async () => {
    const workbench = await store()
    const project = await workbench.createProject('复制')
    const saved = await workbench.saveTimeline({ projectId: project.id, tracks: source.tracks, name: '第一版' })
    const first = await workbench.duplicateTimeline(saved.id)
    const second = await workbench.duplicateTimeline(saved.id)
    expect(first.name).toBe('第一版 副本')
    expect(second.name).toBe('第一版 副本 2')
    expect(first.id).not.toBe(saved.id)
    // 副本可再读、片段 id 不撞
    const reopened = await workbench.findTimeline(first.id)
    expect(reopened?.tracks[0]?.clips.length).toBe(2)
    await expect(workbench.duplicateTimeline('tml-nope')).rejects.toThrow(/找不到时间轴/)
  })
})
