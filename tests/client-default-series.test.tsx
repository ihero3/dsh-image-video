// @vitest-environment jsdom
/**
 * `A1`：没有任何剧集时，自动建一部默认剧集（默认名「三视剧集」）。
 *
 * 用户原话：「没有剧集时给一个默认剧集，默认名字就叫"三视剧集"」。
 * 空表单对新人不友好——打开就该能直接写提示词，而不是先想"我要不要建项目"。
 *
 * 注意：测试里默认 `autoCreateSeries: false`（用例自己摆项目状态），
 * 所以这里显式打开，专门验这条路径。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

describe('A1 默认剧集', () => {
  it('creates 三视剧集 automatically when the host has no series yet', async () => {
    const host = fakeApi()
    const view = render(<Workbench {...clientProps({ api: host.api })} autoCreateSeries />)
    // 自动建剧集：宿主收到 createProject('三视剧集')，并且它以被选中状态出现
    await waitFor(() => { expect(host.calls).toContain('projects/create') })
    await waitFor(() => {
      const select = view.container.querySelector(`select[aria-label="${en.sectionProject}"]`) as HTMLSelectElement | null
      expect(select?.textContent ?? '').toContain(en.defaultSeriesName)
    })
  })

  it('does not create one when a series already exists', async () => {
    const host = fakeApi()
    host.projects.push({
      schemaVersion: 1, id: 'prj-existing', name: '已有剧集',
      createdAt: '2026-11-05T00:00:00.000Z', updatedAt: '2026-11-05T00:00:00.000Z',
    } as never)
    render(<Workbench {...clientProps({ api: host.api })} autoCreateSeries />)
    await waitFor(() => { expect(host.calls).toContain('projects/list') })
    expect(host.calls.filter(entry => entry === 'projects/create')).toHaveLength(0)
  })
})
