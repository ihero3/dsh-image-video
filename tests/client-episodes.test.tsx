// @vitest-environment jsdom
/**
 * M1：集选择器与「本集已选 / 剧集全部资源」双视图。
 *
 * 覆盖：默认打开第一集、切换集、新建集自动选中、把剧集资源加入本集并移除。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'
import type { EpisodeRecord } from '../src/workbench/episodes.ts'
import type { ResourceRecord } from '../src/workbench/records.ts'

afterEach(cleanup)

const STAMP = '2026-11-09T00:00:00.000Z'

/** 一个剧集（工作台要求有 activeProject 才会加载集）。 */
function project(): Record<string, unknown> {
  return { schemaVersion: 1, id: 'prj-1', name: '测试剧', createdAt: STAMP, updatedAt: STAMP }
}

/** 一集；默认没有分段、分镜与引用。 */
function episode(id: string, no: number): EpisodeRecord {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', no, title: `第${no}集`,
    script: { text: '', updatedAt: STAMP },
    segments: [], storyboards: [], resourceRefs: [], assetRefs: [],
    createdAt: STAMP, updatedAt: STAMP,
  }
}

/** 一个剧集级创作资源。 */
function resource(id: string, name: string, kind: ResourceRecord['kind'] = 'role'): ResourceRecord {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', kind, name, scope: 'project',
    createdAt: STAMP, updatedAt: STAMP,
  } as ResourceRecord
}

describe('集选择器与集内引用', () => {
  it('opens the first episode and switches to another one', async () => {
    const host = fakeApi({ episodes: [episode('ep-1', 1), episode('ep-2', 2)] })
    host.projects.push(project() as never)
    const view = render(<Workbench {...clientProps({ api: host.api })} />)

    await waitFor(() => { expect(view.container.querySelector('[data-episode-select]')).toBeTruthy() })
    const select = view.container.querySelector('[data-episode-select]') as HTMLSelectElement
    expect(select.value).toBe('ep-1')
    expect(view.container.querySelector('[data-workbench-episodes]')?.getAttribute('data-workbench-episodes')).toBe('2')
    expect(view.container.querySelector('[data-workbench-episode]')?.getAttribute('data-workbench-episode')).toBe('ep-1')

    fireEvent.change(select, { target: { value: 'ep-2' } })
    await waitFor(() => {
      expect(view.container.querySelector('[data-workbench-episode]')?.getAttribute('data-workbench-episode')).toBe('ep-2')
    })
  })

  it('creates a new episode and selects it', async () => {
    const host = fakeApi({ episodes: [episode('ep-1', 1)] })
    host.projects.push(project() as never)
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    await waitFor(() => { expect(view.container.querySelector('[data-episode-create]')).toBeTruthy() })

    fireEvent.click(view.container.querySelector('[data-episode-create]') as HTMLElement)
    await waitFor(() => {
      const select = view.container.querySelector('[data-episode-select]') as HTMLSelectElement
      expect(select.options.length).toBe(2)
      expect(select.value).toBe('ep-2')
    })
  })

  it('adds a series resource to the episode and removes it again', async () => {
    const host = fakeApi({ episodes: [episode('ep-1', 1)] })
    host.projects.push(project() as never)
    host.resources.push(resource('res-1', '主角'))
    const view = render(<Workbench {...clientProps({ api: host.api })} />)

    await waitFor(() => { expect(view.container.querySelector('[data-episode-resource-view="all"]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-episode-resource-view="all"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-episode-add-resource="res-1"]')).toBeTruthy() })

    fireEvent.click(view.container.querySelector('[data-episode-add-resource="res-1"]') as HTMLElement)
    fireEvent.click(view.container.querySelector('[data-episode-resource-view="selected"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-episode-resource-ref="res-1"]')).toBeTruthy() })

    fireEvent.click(view.container.querySelector('[data-episode-remove-resource="res-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-episode-resource-ref="res-1"]')).toBeNull() })
  })
})
