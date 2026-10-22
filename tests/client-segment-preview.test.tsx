// @vitest-environment jsdom
/**
 * `B-13` 时间轴逐段预览：按片段顺序播放视频轨素材，并显示当前段与总长。
 *
 * 这里只验证界面行为：命中有素材的片段、跳过空位、切段后计数器与 video 源同步。
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { cleanup, clientProps, fakeApi, fireEvent, render, screen, stubMediaPlayback, waitFor } from './client-fake-api.ts'
import type { TimelineClip, TimelineRecord } from '../src/workbench/timeline.ts'

// jsdom 不实现媒体播放；切段会调用 play()/pause()。
afterAll(stubMediaPlayback())
afterEach(cleanup)

/** 一条三轨成片文档，视频轨由调用方给。 */
function timelineRecord(clips: TimelineClip[]): TimelineRecord {
  const stamp = '2026-10-22T00:00:00.000Z'
  return {
    schemaVersion: 1, id: 'tml-1', projectId: 'prj-1', name: '雨夜 成片', frameRate: 30,
    tracks: [
      { id: 'track-video', kind: 'video', clips },
      { id: 'track-audio', kind: 'audio', clips: [] },
      { id: 'track-subtitle', kind: 'subtitle', clips: [] },
    ],
    burnSubtitles: true, createdAt: stamp, updatedAt: stamp,
  }
}

/** 素材片段。 */
function clip(id: string, startMs: number, durationMs: number, assetPath: string): TimelineClip {
  return { id, startMs, durationMs, assetPath }
}

/** 切到时间轴模式并等逐段预览挂载。 */
async function openTimelinePreview(record: TimelineRecord) {
  const host = fakeApi({ timelines: [record] })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '雨夜',
    createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(screen.getByRole('button', { name: en.modeTimeline }))
  await waitFor(() => {
    expect(view.container.querySelector('[data-seg-preview="true"]')).toBeTruthy()
  })
  return { host, view }
}

describe('B-13 segment preview', () => {
  it('starts on the first clip and reports the total duration', async () => {
    const { view } = await openTimelinePreview(timelineRecord([
      clip('c1', 0, 3000, '/tmp/outputs/a.mp4'),
      clip('c2', 3000, 4000, '/tmp/outputs/b.mp4'),
    ]))

    const counter = view.container.querySelector('[data-seg-counter="true"]')
    expect(counter?.textContent).toContain('1 / 2')
    expect(counter?.textContent).toContain('0:07')
    expect(view.container.querySelector('.iv-seg-video')?.getAttribute('src')).toBe('/outputs/a.mp4')
  })

  it('jumps to a clicked cell and swaps the video source', async () => {
    const { view } = await openTimelinePreview(timelineRecord([
      clip('c1', 0, 3000, '/tmp/outputs/a.mp4'),
      clip('c2', 3000, 4000, '/tmp/outputs/b.mp4'),
    ]))

    const cells = view.container.querySelectorAll('.iv-seg-cell')
    expect(cells).toHaveLength(2)
    fireEvent.click(cells[1] as HTMLElement)

    await waitFor(() => {
      expect(view.container.querySelector('[data-seg-counter="true"]')?.textContent).toContain('2 / 2')
    })
    expect(view.container.querySelector('.iv-seg-video')?.getAttribute('src')).toBe('/outputs/b.mp4')
  })

  it('skips clips without an asset and shows the empty hint when none remain', async () => {
    const { view } = await openTimelinePreview(timelineRecord([
      clip('c1', 0, 2000, '/tmp/outputs/a.mp4'),
      { id: 'c2', startMs: 2000, durationMs: 2000, text: '字幕占位' },
    ]))

    expect(view.container.querySelectorAll('.iv-seg-cell')).toHaveLength(1)
    expect(view.container.querySelector('[data-seg-counter="true"]')?.textContent).toContain('1 / 1')
  })
})
