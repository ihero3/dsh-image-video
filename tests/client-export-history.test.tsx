// @vitest-environment jsdom
/**
 * `B-16` 导出历史面板（`A-11` `exports/list|record|update`）。
 *
 * 端点由 Track A 的 A-11 落地；本文件用假宿主验证界面行为：
 * 四种状态徽标 + 产物链接/字节/耗时/失败原因的渲染、空态、按项目筛选、
 * 失败重试入口（记账 + 重渲）、以及时间轴导出全链路在历史里的记账与回写。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'
import type { ExportRecord } from '../src/client/api.ts'

afterEach(cleanup)

/** 造一条导出记录（缺省字段补全，调用方只覆盖自己关心的）。 */
function exportRecord(id: string, status: ExportRecord['status'], extra: Partial<ExportRecord> = {}): ExportRecord {
  return {
    id, projectId: 'prj-1', timelineId: 'tml-1', status,
    startedAt: '2026-10-23T10:00:00.000Z', updatedAt: '2026-10-23T10:01:00.000Z',
    ...extra,
  }
}

/** 挂载工作台并等导出历史面板拉完初始列表。 */
async function renderExports(options: Parameters<typeof fakeApi>[0] = {}) {
  const host = fakeApi(options)
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  await waitFor(() => { expect(host.calls).toContain('exports/list') })
  return { host, view }
}

describe('B-16 export history panel', () => {
  it('renders the four statuses with output / bytes / elapsed / failure facts', async () => {
    const { view } = await renderExports({
      exports: [
        exportRecord('exp-ok', 'succeeded', { outputPath: '/tmp/outputs/movie.mp4', bytes: 2048, elapsedSeconds: 12 }),
        exportRecord('exp-bad', 'failed', { error: 'ffmpeg exited with 1' }),
        exportRecord('exp-run', 'running'),
        exportRecord('exp-que', 'queued'),
      ],
    })

    const rows = view.container.querySelectorAll('[data-export-record]')
    await waitFor(() => { expect(rows).toHaveLength(4) })

    // 四种状态各有徽标（复用任务状态文案）
    const statusOf = (id: string): string | undefined =>
      view.container.querySelector(`[data-export-record="${id}"]`)?.getAttribute('data-export-status') ?? undefined
    expect(statusOf('exp-ok')).toBe('succeeded')
    expect(statusOf('exp-bad')).toBe('failed')
    expect(statusOf('exp-run')).toBe('running')
    expect(statusOf('exp-que')).toBe('queued')
    const okRow = view.container.querySelector('[data-export-record="exp-ok"]') as HTMLElement
    expect(okRow.textContent).toContain(en.statusSucceeded)
    expect(view.container.querySelector('[data-export-record="exp-bad"]')?.textContent).toContain(en.statusFailed)
    expect(view.container.querySelector('[data-export-record="exp-run"]')?.textContent).toContain(en.statusRunning)
    expect(view.container.querySelector('[data-export-record="exp-que"]')?.textContent).toContain(en.statusQueued)

    // 产物链接走只读 /outputs 路由；字节与耗时按人类可读格式
    const link = okRow.querySelector('a') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/outputs/movie.mp4')
    expect(link.textContent).toBe('movie.mp4')
    expect(okRow.textContent).toContain('2 KB')
    expect(okRow.textContent).toContain('12s')

    // 失败原因原样展示；只有失败行给重试入口
    expect(view.container.querySelector('[data-export-record="exp-bad"]')?.textContent).toContain('ffmpeg exited with 1')
    const retries = view.container.querySelectorAll('[data-export-retry]')
    expect(retries).toHaveLength(1)
    expect(retries[0]?.getAttribute('data-export-retry')).toBe('exp-bad')
  })

  it('shows the empty state before anything was exported', async () => {
    const { view } = await renderExports()
    const empty = view.container.querySelector('[data-exports-empty]') as HTMLElement
    expect(empty.textContent).toBe(en.exportsEmpty)
    expect(view.container.querySelectorAll('[data-export-record]')).toHaveLength(0)
  })

  it('filters by project through exports/list', async () => {
    const host = fakeApi({
      exports: [
        exportRecord('exp-a1', 'succeeded'),
        exportRecord('exp-b1', 'succeeded', { projectId: 'prj-2' }),
      ],
    })
    host.projects.push(
      {
        schemaVersion: 1, id: 'prj-1', name: '项目一',
        createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z',
      },
      {
        schemaVersion: 1, id: 'prj-2', name: '项目二',
        createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z',
      },
    )
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    // 等面板拿到两个项目（筛选下拉才会出现项目选项）
    await waitFor(() => {
      const filter = view.container.querySelector('[data-exports-filter]') as HTMLSelectElement
      expect([...filter.querySelectorAll('option')].map(option => option.value)).toEqual(['all', 'prj-1', 'prj-2'])
    })

    fireEvent.change(view.container.querySelector('[data-exports-filter]') as HTMLSelectElement, {
      target: { value: 'prj-2' },
    })
    await waitFor(() => { expect(view.container.querySelectorAll('[data-export-record]')).toHaveLength(1) })
    const row = view.container.querySelector('[data-export-record]') as HTMLElement
    expect(row.getAttribute('data-export-record')).toBe('exp-b1')
    expect(row.textContent).toContain('项目二')
  })

  it('retries a failed export by recording a fresh attempt and re-rendering', async () => {
    const { host, view } = await renderExports({
      exports: [exportRecord('exp-bad', 'failed', { error: 'ffmpeg exited with 1' })],
    })
    await waitFor(() => { expect(view.container.querySelector('[data-export-retry="exp-bad"]')).toBeTruthy() })

    fireEvent.click(view.container.querySelector('[data-export-retry="exp-bad"]') as HTMLElement)
    await waitFor(() => {
      expect(host.calls).toContain('exports/record')
      expect(host.calls).toContain('timelines/render')
    })
    // 新记账排在最前：queued + 原时间轴/原项目
    expect(host.exports[0]).toMatchObject({ id: 'exp-2', projectId: 'prj-1', timelineId: 'tml-1', status: 'queued' })
  })
})

/** 挂载工作台并进入时间轴模式（带一个视频素材 + 项目）。 */
async function renderTimelineMode() {
  const host = fakeApi({
    assets: [{
      schemaVersion: 1, id: 'ast-v', projectId: 'prj-1', kind: 'video',
      path: '/tmp/outputs/clip.mp4', bytes: 1024, createdAt: '2026-10-16T00:00:00.000Z',
    }],
  })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '导出项目',
    createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeTimeline }))
  await waitFor(() => { expect(view.container.querySelector('[data-timeline-lane="video"]')).toBeTruthy() })
  return { host, view }
}

/** 给视频轨加一个片段，使导出按钮可用。 */
async function addVideoClip(view: ReturnType<typeof render>): Promise<void> {
  const picker = view.container.querySelector('[data-timeline-track="video"] select') as HTMLSelectElement
  fireEvent.change(picker, { target: { value: '/tmp/outputs/clip.mp4' } })
  fireEvent.click(view.container.querySelector('[data-timeline-track="video"] button[aria-label^="Add to track"]') as HTMLElement)
  await waitFor(() => { expect(view.container.querySelectorAll('[data-timeline-clip]')).toHaveLength(1) })
}

describe('B-16 export history wiring', () => {
  // 轮询间隔约 2s，两次跳才到终态；留足超时。
  it('records the attempt when rendering and writes back the terminal status', async () => {
    const { host, view } = await renderTimelineMode()
    await addVideoClip(view)

    fireEvent.click(view.container.querySelector('[data-timeline-export]') as HTMLButtonElement)
    // 1) 点导出先记一笔（queued）
    await waitFor(() => { expect(host.calls).toContain('exports/record') }, { timeout: 5000 })
    expect(host.exports[0]).toMatchObject({ id: 'exp-1', timelineId: expect.any(String), status: 'queued' })

    // 2) 渲染成功（假宿主第二次轮询即终态）后回写：succeeded + 产物 + 字节 + 耗时
    await waitFor(() => { expect(host.calls).toContain('exports/update') }, { timeout: 20000 })
    expect(host.exports[0]).toMatchObject({
      id: 'exp-1',
      status: 'succeeded',
      outputPath: '/tmp/outputs/movie.mp4',
      bytes: 2048,
      elapsedSeconds: 1,
    })
  }, 25000)
})
