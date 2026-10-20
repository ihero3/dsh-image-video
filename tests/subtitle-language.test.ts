/**
 * 多语言字幕轨（Track A / A42）：字幕轨带 language，可按 burnLanguage 只烧一种语言。
 * 兼容性：不设 burnLanguage 时沿用老行为（烧所有字幕轨）。
 */
import { describe, expect, it } from 'vitest'
import { buildRenderArgs, freezeTimeline } from '../src/media/render.ts'
import { validateTimeline } from '../src/workbench/validate.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import type { TimelineRecord, TimelineTrack } from '../src/workbench/timeline.ts'

const subtitleTrack = (id: string, language: string | undefined, text: string): TimelineTrack => ({
  id, kind: 'subtitle',
  ...language === undefined ? {} : { language },
  clips: [{ id: `${id}-clip`, text, startMs: 0, durationMs: 1000 }],
})

function timeline(tracks: TimelineTrack[], burnLanguage?: string): TimelineRecord {
  return {
    schemaVersion: 3, id: 'tml-lang', projectId: 'prj-1', name: '多语言', frameRate: 30, burnSubtitles: true,
    ...burnLanguage === undefined ? {} : { burnLanguage },
    tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }] }, ...tracks],
    createdAt: '', updatedAt: '',
  }
}
const filterOf = (document: TimelineRecord): string => {
  const args = buildRenderArgs(freezeTimeline(document), { outputPath: '/tmp/out.mp4' })
  return args[args.indexOf('-filter_complex') + 1] ?? ''
}

describe('multi-language subtitles (A42)', () => {
  it('burns only the selected language; without burnLanguage it keeps the old behaviour', () => {
    const zh = subtitleTrack('s-zh', 'zh', '中文台词')
    const en = subtitleTrack('s-en', 'en', 'english line')
    const selected = filterOf(timeline([zh, en], 'en'))
    expect(selected).toContain('english')
    expect(selected).not.toContain('中文台词')

    const legacy = filterOf(timeline([zh, en]))
    expect(legacy).toContain('中文台词')
    expect(legacy).toContain('english')
  })

  it('flags a dangling burnLanguage, duplicate languages and overlapping burns', () => {
    expect(validateTimeline(timeline([subtitleTrack('s-zh', 'zh', '中')], 'ja')).map(i => i.code))
      .toContain('dangling-burn-language')

    expect(validateTimeline(timeline([subtitleTrack('a', 'zh', '甲'), subtitleTrack('b', 'zh', '乙')], 'zh')).map(i => i.code))
      .toContain('duplicate-subtitle-language')

    const overlapCodes = validateTimeline(
      timeline([subtitleTrack('a', 'zh', '甲'), subtitleTrack('b', 'en', '乙')]),
    ).map(issue => issue.code)
    expect(overlapCodes).toContain('subtitle-burn-overlap')
  })

  it('round-trips language and burnLanguage through the store', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-lang-'))
    const store = new WorkbenchStore({ directory })
    const project = await store.createProject('多语言')
    await store.saveTimeline({
      projectId: project.id, burnLanguage: 'en',
      tracks: [subtitleTrack('s-en', 'en', 'hello')],
    })
    const reopened = new WorkbenchStore({ directory })
    const saved = (await reopened.listTimelines(project.id))[0]!
    expect(saved.burnLanguage).toBe('en')
    expect(saved.tracks[0]?.language).toBe('en')
  })
})
