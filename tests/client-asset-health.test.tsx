// @vitest-environment jsdom
/**
 * `B-11` 素材库体检：体积排行 / 重复文件 / 项目统计。
 *
 * 三份报告都由按钮显式触发，所以每个用例都要先切 tab 再点“跑体检”。
 * 面板只呈现，不提供删除动作——这里也只断言呈现与调用。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { cleanup, clientProps, fakeApi, fireEvent, render, waitFor } from './client-fake-api.ts'
import type { AssetDuplicatesReport, AssetProjectStats, AssetSizeReport } from '../src/client/api.ts'

afterEach(cleanup)

const SIZE: AssetSizeReport = {
  totalBytes: 6144, topBytes: 4096, topShare: 0.66, medianBytes: 1024, count: 3,
  top: [
    { path: '/tmp/outputs/big.png', bytes: 4096, unused: true },
    { path: '/tmp/outputs/used.png', bytes: 1024 },
  ],
}

const DUPES: AssetDuplicatesReport = {
  groups: [{
    paths: ['/tmp/outputs/keep.png', '/tmp/outputs/copy.png'],
    bytes: 2048, keep: '/tmp/outputs/keep.png', reclaimableBytes: 2048,
  }],
  reclaimableBytes: 2048, hashedFiles: 2, skippedFiles: 0,
}

const STATS: AssetProjectStats = {
  totalBytes: 8192, topShare: 0.8,
  projects: [{
    projectId: 'prj-1', name: '雨夜', assets: 2, bytes: 8192, usedBytes: 4096, timelines: 1,
  }],
}

/** 渲染一个常驻体检面板。 */
function renderHealth() {
  const host = fakeApi({ sizeReport: SIZE, duplicates: DUPES, projectStats: STATS })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '雨夜',
    createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 切到某个 tab 并跑一次报告。 */
async function runTab(view: ReturnType<typeof renderHealth>['view'], tab: 'size' | 'dupes' | 'stats'): Promise<void> {
  fireEvent.click(view.container.querySelector(`[data-health-tab="${tab}"]`) as HTMLElement)
  fireEvent.click(view.container.querySelector('[data-health-run="true"]') as HTMLElement)
  await waitFor(() => {
    expect(view.container.querySelector(`[data-health-body="${tab}"]`)?.textContent).not.toBe(en.healthEmptyHint)
  })
}

describe('B-11 asset health', () => {
  it('lists the largest files and flags unused ones', async () => {
    const { host, view } = renderHealth()
    await runTab(view, 'size')

    await waitFor(() => {
      expect(view.container.querySelector('[data-size-path="/tmp/outputs/big.png"]')).toBeTruthy()
    })
    const row = view.container.querySelector('[data-size-path="/tmp/outputs/big.png"]')
    expect(row?.textContent).toContain('big.png')
    expect(row?.querySelector('.iv-chip--warn')?.textContent).toBe(en.healthUnused)
    expect(host.calls).toContain('assets/size-report')
  })

  it('shows duplicate groups with the suggested keep', async () => {
    const { view } = renderHealth()
    await runTab(view, 'dupes')

    await waitFor(() => {
      expect(view.container.querySelectorAll('[data-dupe-path]')).toHaveLength(2)
    })
    const kept = view.container.querySelector('[data-dupe-path="/tmp/outputs/keep.png"]')
    expect(kept?.querySelector('.iv-chip--ok')?.textContent).toBe(en.healthSuggestedKeep)
  })

  it('summarises per-project asset bytes', async () => {
    const { view } = renderHealth()
    await runTab(view, 'stats')

    await waitFor(() => {
      expect(view.container.querySelector('[data-stat-project="prj-1"]')).toBeTruthy()
    })
    const row = view.container.querySelector('[data-stat-project="prj-1"]')
    expect(row?.textContent).toContain('雨夜')
    expect(row?.textContent).toContain('2')
  })
})
