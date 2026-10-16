/**
 * 时间轴模型与持久化（`T5-1`）。
 *
 * 两条硬口径：① 三轨各 ≥3 clip **保存后重开完整恢复**；② 文档里**不允许内联字节**
 * （素材只能是路径引用，`R-TML-1`）。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkbenchStore } from '../src/workbench/store.ts'
import {
  MAX_TIMELINE_CLIPS, SUBTITLE_FONT_SIZE_RANGE, looksInlinedBytes, normalizeSubtitleStyle,
  normalizeTimelineTracks, timelineDurationMs, type TimelineTrack,
} from '../src/workbench/timeline.ts'

const dirs: string[] = []

async function makeStore(): Promise<{ store: WorkbenchStore; directory: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-workbench-timeline-'))
  dirs.push(directory)
  return { store: new WorkbenchStore({ directory, now: () => new Date('2026-10-16T00:00:00.000Z') }), directory }
}

afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })

/** 三轨各 3 clip 的样例（满足 T5-1 的验收规模）。 */
function threeTracks(): TimelineTrack[] {
  return [
    {
      id: 'v1', kind: 'video',
      clips: [0, 1, 2].map(index => ({
        id: `v-${index}`, assetPath: `/tmp/outputs/clip-${index}.mp4`,
        startMs: index * 5000, durationMs: 5000, ...index === 1 ? { inMs: 500 } : {},
      })),
    },
    {
      id: 'a1', kind: 'audio',
      clips: [0, 1, 2].map(index => ({
        id: `a-${index}`, assetPath: `/tmp/outputs/bgm-${index}.mp3`, startMs: index * 5000, durationMs: 5000,
      })),
    },
    {
      id: 's1', kind: 'subtitle',
      clips: [0, 1, 2].map(index => ({
        id: `s-${index}`, text: `第 ${index + 1} 句字幕`, startMs: index * 5000, durationMs: 3000,
      })),
    },
  ]
}

describe('timeline model (T5-1)', () => {
  it('normalizes a three-track timeline and reports its duration', () => {
    const tracks = normalizeTimelineTracks(threeTracks())
    expect(tracks).toHaveLength(3)
    expect(tracks.map(track => track.clips.length)).toEqual([3, 3, 3])
    expect(timelineDurationMs(tracks)).toBe(15_000)
  })

  it('refuses inlined bytes and keeps the document reference-only', () => {
    expect(looksInlinedBytes('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(looksInlinedBytes(`/tmp/${'A'.repeat(600)}.mp4`)).toBe(true)
    expect(looksInlinedBytes('/tmp/outputs/clip.mp4')).toBe(false)
    expect(() => normalizeTimelineTracks([
      { id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: 'data:video/mp4;base64,AAAA', startMs: 0, durationMs: 1000 }] },
    ])).toThrow(/inlined bytes/)
  })

  it('rejects malformed clips with actionable messages', () => {
    expect(() => normalizeTimelineTracks([{ id: 'x', kind: 'slideshow', clips: [] }])).toThrow(/video\/audio\/subtitle/)
    expect(() => normalizeTimelineTracks([{ id: 'v', kind: 'video', clips: [{ id: 'c', assetPath: '/a.mp4', startMs: -1, durationMs: 100 }] }]))
      .toThrow(/startMs must be between/)
    expect(() => normalizeTimelineTracks([{ id: 'v', kind: 'video', clips: [{ id: 'c', assetPath: '/a.mp4', startMs: 0, durationMs: 0 }] }]))
      .toThrow(/durationMs must be between/)
    expect(() => normalizeTimelineTracks([{ id: 'v', kind: 'video', clips: [{ id: 'c', startMs: 0, durationMs: 100 }] }]))
      .toThrow(/needs an assetPath/)
    expect(() => normalizeTimelineTracks([{ id: 's', kind: 'subtitle', clips: [{ id: 'c', text: '  ', startMs: 0, durationMs: 100 }] }]))
      .toThrow(/needs text/)
    expect(() => normalizeTimelineTracks([
      { id: 'v', kind: 'video', clips: [{ id: 'dup', assetPath: '/a.mp4', startMs: 0, durationMs: 1 }] },
      { id: 'a', kind: 'audio', clips: [{ id: 'dup', assetPath: '/b.mp3', startMs: 0, durationMs: 1 }] },
    ])).toThrow(/duplicate timeline clip id/)
    expect(() => normalizeTimelineTracks([{
      id: 'v', kind: 'video',
      clips: Array.from({ length: MAX_TIMELINE_CLIPS + 1 }, (_, index) => ({
        id: `c-${index}`, assetPath: '/a.mp4', startMs: 0, durationMs: 1,
      })),
    }])).toThrow(/more than/)
  })
})

describe('subtitle style and burn switch (T5-3)', () => {
  it('normalizes a valid style and rejects out-of-range values', () => {
    expect(normalizeSubtitleStyle({ fontSize: 48, color: '#ffcc00', position: 'top' }, 'c1'))
      .toEqual({ fontSize: 48, color: '#ffcc00', position: 'top' })
    expect(normalizeSubtitleStyle(undefined, 'c1')).toEqual({})
    expect(() => normalizeSubtitleStyle({ fontSize: 4 }, 'c1')).toThrow(new RegExp(`between ${SUBTITLE_FONT_SIZE_RANGE.min}`))
    expect(() => normalizeSubtitleStyle({ fontSize: 500 }, 'c1')).toThrow(/fontSize must be between/)
    expect(() => normalizeSubtitleStyle({ color: 'red' }, 'c1')).toThrow(/#rrggbb/)
    expect(() => normalizeSubtitleStyle({ position: 'left' }, 'c1')).toThrow(/top\/middle\/bottom/)
  })

  it('round-trips the burn switch through the store', async () => {
    const { store, directory } = await makeStore()
    const project = await store.createProject('烧录')
    const saved = await store.saveTimeline({
      projectId: project.id,
      tracks: [{ id: 's1', kind: 'subtitle', clips: [{ id: 'c1', text: '字幕', startMs: 0, durationMs: 1000, style: { fontSize: 40, color: '#00ff88', position: 'middle' } }] }],
    })
    expect(saved.burnSubtitles).toBe(true)
    const off = await store.saveTimeline({ id: saved.id, projectId: project.id, tracks: saved.tracks, burnSubtitles: false })
    expect(off.burnSubtitles).toBe(false)
    // 关掉烧录后字幕数据仍在（只是不烧进画面）
    expect(off.tracks[0]?.clips[0]?.text).toBe('字幕')
    const reopened = new WorkbenchStore({ directory })
    const restored = (await reopened.listTimelines(project.id))[0]
    expect(restored?.burnSubtitles).toBe(false)
    expect(restored?.tracks[0]?.clips[0]?.style).toEqual({ fontSize: 40, color: '#00ff88', position: 'middle' })
  })
})

describe('timeline persistence (T5-1)', () => {
  it('restores a three-track timeline completely after reopening the store', async () => {
    const { store, directory } = await makeStore()
    const project = await store.createProject('时间轴项目')
    const saved = await store.saveTimeline({ projectId: project.id, name: '成片 v1', tracks: threeTracks() })
    expect(saved.id).toMatch(/^tml-/)

    const reopened = new WorkbenchStore({ directory })
    const restored = (await reopened.listTimelines(project.id))[0]
    expect(restored?.tracks).toEqual(saved.tracks)
    expect(restored?.frameRate).toBe(30)

    // 更新保留 createdAt，改名生效
    const updated = await reopened.saveTimeline({ id: saved.id, projectId: project.id, name: '成片 v2', tracks: threeTracks() })
    expect(updated.createdAt).toBe(saved.createdAt)
    expect(updated.name).toBe('成片 v2')
    expect(await reopened.listTimelines(project.id)).toHaveLength(1)

    expect(await reopened.removeTimeline(saved.id)).toBe(true)
    expect(await reopened.removeTimeline(saved.id)).toBe(false)
  })

  it('cascades timelines with their project', async () => {
    const { store } = await makeStore()
    const project = await store.createProject('级联')
    await store.saveTimeline({ projectId: project.id, tracks: [] })
    await store.removeProject(project.id)
    expect(await store.listTimelines(project.id)).toEqual([])
  })
})
