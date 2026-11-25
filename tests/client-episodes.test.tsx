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

  it('edits the episode number from the rename row', async () => {
    const host = fakeApi({ episodes: [episode('ep-1', 0)] })
    host.projects.push(project() as never)
    const view = render(<Workbench {...clientProps({ api: host.api })} />)

    await waitFor(() => { expect(view.container.querySelector('[data-episode-rename]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-episode-rename]') as HTMLElement)
    const noInput = await waitFor(() => {
      const input = view.container.querySelector('[data-episode-no]') as HTMLInputElement
      expect(input).toBeTruthy()
      return input
    })
    // 默认值就是当前集号（从 0 起）
    expect(noInput.value).toBe('0')
    fireEvent.change(noInput, { target: { value: '7' } })
    fireEvent.click(view.container.querySelector('[data-episode-rename-save]') as HTMLElement)

    await waitFor(() => { expect(host.episodes?.[0]?.no).toBe(7) })
  })

  it('本集已选列表精简、按当前 tab 搜索，图片点击进预览', async () => {
    const ep = {
      ...episode('ep-1', 1),
      resourceRefs: [{ resourceId: 'res-1', category: 'ungrouped' as const, order: 1 }],
    }
    const host = fakeApi({ episodes: [ep] })
    host.projects.push(project() as never)
    host.resources.push({ ...resource('res-1', '主角定妆照'), assetPath: '/tmp/outputs/hero.png' } as never)
    const view = render(<Workbench {...clientProps({ api: host.api })} />)
    await waitFor(() => { expect(view.container.querySelector('[data-episode-resource-ref="res-1"]')).toBeTruthy() })

    const row = view.container.querySelector('[data-episode-resource-ref="res-1"]') as HTMLElement
    // 只显示名称 + 可改的分类下拉；不要「Role · 」这类类型前缀、上下箭头与高级整块
    expect(row.textContent).toContain('主角定妆照')
    expect(row.textContent).not.toContain('Role ·')
    const categorySelect = row.querySelector('select') as HTMLSelectElement
    expect(categorySelect).toBeTruthy()
    expect(row.querySelectorAll('button').length).toBe(3)
    expect(view.container.querySelector('[data-resource-folders-toggle]')).toBeNull()

    fireEvent.change(categorySelect, { target: { value: 'scene' } })
    await waitFor(() => {
      expect(host.episodes[0]?.resourceRefs[0]?.category).toBe('scene')
    })

    // 右上角搜索在本集已选里匹配
    const filter = view.container.querySelector('[data-resource-filter]') as HTMLInputElement
    fireEvent.change(filter, { target: { value: '不存在' } })
    await waitFor(() => { expect(view.container.querySelector('[data-episode-resource-ref="res-1"]')).toBeNull() })
    fireEvent.change(filter, { target: { value: '定妆' } })
    await waitFor(() => { expect(view.container.querySelector('[data-episode-resource-ref="res-1"]')).toBeTruthy() })

    fireEvent.click(view.container.querySelector('[data-episode-preview-resource="res-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-preview-actions="image"]')).toBeTruthy() })
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
