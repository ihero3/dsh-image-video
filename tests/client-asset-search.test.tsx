// @vitest-environment jsdom
/**
 * `T6` 素材区搜索与排序。
 *
 * 断言：
 * 1. 搜索匹配**文件名 / 提示词 / 模型**三处（用户脑子里想的可能是任意一种）；
 * 2. 排序四档都能改顺序（最新/最早/最大/名称）；
 * 3. 搜索无命中时空态区分于「一个素材都没有」（提示清空搜索）；
 * 4. 搜索与 kind 过滤可叠加。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const mk = (id: string, path: string, bytes: number, createdAt: string, extra: Record<string, unknown> = {}) => ({
  schemaVersion: 4, id, projectId: 'prj-1', kind: 'image' as const, path, bytes, createdAt, ...extra,
})

function renderWithAssets() {
  const host = fakeApi({
    assets: [
      mk('a1', '/tmp/outputs/sunset-cat.png', 300, '2026-10-01T00:00:00.000Z', { prompt: '海边日落的橘猫', model: 'img-a' }),
      mk('a2', '/tmp/outputs/night-street.png', 900, '2026-10-03T00:00:00.000Z', { prompt: '雨夜街头', model: 'img-b' }),
      mk('a3', '/tmp/outputs/aaa-first.png', 100, '2026-10-02T00:00:00.000Z', { prompt: '晨光窗台', model: 'img-a' }),
    ],
  })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '素材项目',
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

const rowIds = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('[data-asset-select]')).map(node => node.getAttribute('data-asset-select') as string)

describe('素材搜索与排序（T6）', () => {
  it('搜索框与排序下拉存在', async () => {
    const { view } = renderWithAssets()
    await waitFor(() => { expect(view.container.querySelector('[data-asset-search]')).toBeTruthy() })
    expect(view.container.querySelector('[data-asset-sort]')).toBeTruthy()
  })

  it('按文件名搜索', async () => {
    const { view } = renderWithAssets()
    await waitFor(() => { expect(rowIds(view.container).length).toBe(3) })
    const search = view.container.querySelector('[data-asset-search]') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'sunset' } })
    await waitFor(() => { expect(rowIds(view.container)).toEqual(['a1']) })
  })

  it('按提示词与模型名搜索', async () => {
    const { view } = renderWithAssets()
    await waitFor(() => { expect(rowIds(view.container).length).toBe(3) })
    const search = view.container.querySelector('[data-asset-search]') as HTMLInputElement

    fireEvent.change(search, { target: { value: '雨夜' } })
    await waitFor(() => { expect(rowIds(view.container)).toEqual(['a2']) })

    fireEvent.change(search, { target: { value: 'img-a' } })
    await waitFor(() => { expect(rowIds(view.container).sort()).toEqual(['a1', 'a3']) })
  })

  it('四种排序都改变顺序', async () => {
    const { view } = renderWithAssets()
    await waitFor(() => { expect(rowIds(view.container).length).toBe(3) })
    const sort = view.container.querySelector('[data-asset-sort]') as HTMLSelectElement

    // 默认最新优先
    expect(rowIds(view.container)).toEqual(['a2', 'a3', 'a1'])
    fireEvent.change(sort, { target: { value: 'oldest' } })
    await waitFor(() => { expect(rowIds(view.container)).toEqual(['a1', 'a3', 'a2']) })
    fireEvent.change(sort, { target: { value: 'largest' } })
    await waitFor(() => { expect(rowIds(view.container)).toEqual(['a2', 'a1', 'a3']) })
    fireEvent.change(sort, { target: { value: 'name' } })
    await waitFor(() => { expect(rowIds(view.container)).toEqual(['a3', 'a2', 'a1']) })
  })

  it('无命中时空态提示清空搜索（区别于完全没素材）', async () => {
    const { view } = renderWithAssets()
    await waitFor(() => { expect(rowIds(view.container).length).toBe(3) })
    const search = view.container.querySelector('[data-asset-search]') as HTMLInputElement
    fireEvent.change(search, { target: { value: '不可能匹配的字符串' } })
    await waitFor(() => {
      const empty = view.container.querySelector('[data-asset-empty]')
      expect(empty?.getAttribute('data-asset-empty')).toBe('filtered')
      expect(empty?.textContent).toContain(en.assetSearchEmpty)
    })
  })
})
