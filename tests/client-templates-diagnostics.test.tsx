// @vitest-environment jsdom
/**
 * B15 新面板（客户端半边）：字幕批量铺轨、模板市场（含 drama-series）、诊断面板。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

async function renderTimeline(preloaded?: TimelineRecord[]) {
  const host = fakeApi({ timelines: preloaded })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '项目',
    createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
  await waitFor(() => { expect(view.container.querySelector('[data-timeline-lane="subtitle"]')).toBeTruthy() })
  return { host, view }
}

/** 预置一个带 10s 视频片段时间轴，让时间窗足够铺开多条字幕。 */
function preloadedTimeline(): TimelineRecord[] {
  return [{
    schemaVersion: 1, id: 'tml-1', projectId: 'prj-1', name: '成片', frameRate: 30,
    tracks: [
      { id: 'track-video', kind: 'video', clips: [{ id: 'clip-v', assetPath: '/tmp/clip.mp4', startMs: 0, durationMs: 10_000 }] },
      { id: 'track-audio', kind: 'audio', clips: [] },
      { id: 'track-subtitle', kind: 'subtitle', clips: [] },
    ],
    burnSubtitles: true, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z',
  }]
}

describe('B15 subtitles batch', () => {
  it('splits a pasted script into timed subtitle clips on the subtitle track', async () => {
    const { host, view } = await renderTimeline(preloadedTimeline())
    const input = view.container.querySelector('[data-timeline-subtitles-batch-input="true"]') as HTMLTextAreaElement
    expect(input).toBeTruthy()
    fireEvent.change(input, { target: { value: '第一句。第二句。第三句。' } })
    fireEvent.click(view.container.querySelector('[data-timeline-subtitles-batch-apply="true"]') as HTMLElement)
    await waitFor(() => {
      const clips = view.container.querySelectorAll('[data-timeline-clip-kind="subtitle"]')
      expect(clips.length).toBeGreaterThanOrEqual(3)
    })
    // 落库后字幕轨有对应的 clip 文本
    await waitFor(() => { expect(host.timelines[0]!.tracks.find(track => track.kind === 'subtitle')?.clips.length).toBeGreaterThanOrEqual(3) }, { timeout: 3000 })
    const subtitleClips = host.timelines[0]!.tracks.find(track => track.kind === 'subtitle')?.clips ?? []
    expect(subtitleClips.map(clip => clip.text)).toEqual(['第一句', '第二句', '第三句'])
  })
})

describe('B15 template market', () => {
  it('shows templates including drama-series and instantiates one into the canvas', async () => {
    const host = fakeApi()
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '项目',
      createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
    })
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    fireEvent.click(await screen.findByRole('button', { name: en.modeWorkflow }))
    await waitFor(() => { expect(view.container.querySelector('[data-workbench-pane="paneCanvas"]')).toBeTruthy() })
    // 打开模板市场
    fireEvent.click(view.container.querySelector('[data-workflow-template-toggle="true"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-workflow-template-market="true"]')).toBeTruthy() })
    // 含 drama-series 模板
    expect(view.container.querySelector('[data-workflow-template="drama-series"]')).toBeTruthy()
    // 实例化一个基础模板
    fireEvent.click(view.container.querySelector('[data-workflow-template="copy-to-video"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelectorAll('.react-flow__node, [data-id]').length).toBeGreaterThan(0)
    })
  })
})

describe('B15 diagnostics panel', () => {
  it('renders output usage and render stats from the host snapshot', async () => {
    const host = fakeApi()
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '项目',
      createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
    })
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    const panel = await waitFor(() => view.container.querySelector('[data-diagnostics-panel="true"]'), { timeout: 3000 })
    expect(panel).toBeTruthy()
    expect(host.calls).toContain('diagnostics')
    // 输出占用与渲染耗时都显示出来
    expect(panel!.textContent).toContain('files')
    expect(panel!.textContent).toContain('1000ms')
  })
})
