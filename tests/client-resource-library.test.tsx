// @vitest-environment jsdom
/**
 * 创作资源库的交互修正（用户反馈 2026-11-03）：
 *
 * - 「按名称筛选」只匹配名称，备注里的"外观描述"搜不到 → 现在名称与备注都匹配，且空态区分「没资源」与「筛选没命中」；
 * - 「用选中素材」在没选素材时只有禁用态、没有说明 → 补旁注提示；
 * - 参考图 chips 只有文件名，看不出是哪张图 → 加缩略图，点击在预览面板打开；
 * - 资源建好后名称/备注改不了（重绘计划让"补一句外观描述"却无处可补）→ 行内编辑。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'
import type { ResourceRecord } from '../src/workbench/records.ts'

afterEach(cleanup)

/** 一个项目（资源列表要求有 activeProject 才会加载）。 */
function project(): Record<string, unknown> {
  return {
    schemaVersion: 1, id: 'prj-1', name: '项目',
    createdAt: '2026-11-03T00:00:00.000Z', updatedAt: '2026-11-03T00:00:00.000Z',
  }
}

/** 一个创作资源；`assetPaths` = 定妆参考图（首图=底图）。 */
function resource(id: string, name: string, extra: Partial<ResourceRecord> = {}): ResourceRecord {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', kind: 'role', name, scope: 'project',
    createdAt: '2026-11-03T00:00:00.000Z', updatedAt: '2026-11-03T00:00:00.000Z',
    ...extra,
  } as ResourceRecord
}

/** 挂载工作台并等资源行出现。 */
async function renderLibrary() {
  const host = fakeApi()
  host.projects.push(project() as never)
  host.resources.push(resource('res-1', '女主', {
    note: '短发，红裙',
    assetPaths: ['/tmp/outputs/a.png', '/tmp/outputs/b.png'],
  } as Partial<ResourceRecord>))
  host.resources.push(resource('res-2', '路人', { note: '长发' } as Partial<ResourceRecord>))
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  await waitFor(() => { expect(view.container.querySelector('[data-resource-row="res-1"]')).toBeTruthy() })
  return { host, view }
}

describe('创作资源库交互（用户反馈 2026-11-03）', () => {
  it('filters by note as well as name, and says when the filter matched nothing', async () => {
    const { view } = await renderLibrary()
    const filter = view.container.querySelector('[data-resource-filter]') as HTMLInputElement
    expect(filter.getAttribute('aria-label')).toBe(en.resourceFilterPlaceholder)

    // 备注里的「短发」是筛选词：能命中 res-1，且 res-2 消失
    fireEvent.change(filter, { target: { value: '短发' } })
    await waitFor(() => { expect(view.container.querySelector('[data-resource-row="res-2"]')).toBeNull() })
    expect(view.container.querySelector('[data-resource-row="res-1"]')).toBeTruthy()

    // 没命中：不是「没有资源」，而是「筛选没命中」并可一键清空
    fireEvent.change(filter, { target: { value: '不存在的人' } })
    await waitFor(() => { expect(view.container.querySelector('[data-resource-empty="filtered"]')).toBeTruthy() })
    expect(view.container.textContent).toContain(en.resourceFilterEmpty)
    fireEvent.click(view.container.querySelector('[data-resource-filter-clear]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-resource-row="res-2"]')).toBeTruthy() })
  })

  it('tells the user where to pick an asset before “use selected asset” can work', async () => {
    const { view } = await renderLibrary()
    const hint = view.container.querySelector('[data-resource-use-hint]')
    expect(hint?.textContent).toContain(en.resourceUseSelectedHint)
    expect((view.container.querySelector('[data-resource-use-selected]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows a thumbnail per reference image and previews it on click', async () => {
    const { view } = await renderLibrary()
    fireEvent.click(view.container.querySelector('[data-resource-refs-manage="res-1"]') as HTMLElement)
    const first = await waitFor(() => {
      const thumb = view.container.querySelector('[data-resource-ref-preview]') as HTMLElement
      expect(thumb).toBeTruthy()
      return thumb
    })
    // 缩略图真的指向那张图（不再只有一个认不出的文件名）
    expect(first.querySelector('img')?.getAttribute('src')).toContain('a.png')
    fireEvent.click(first)
    await waitFor(() => {
      const preview = view.container.querySelector('[data-workbench-pane="panePreview"] img') as HTMLImageElement
      expect(preview.getAttribute('src')).toContain('a.png')
    })
  })

  it('lets the user edit the name and note, so “add an appearance description” is actionable', async () => {
    const { host, view } = await renderLibrary()
    fireEvent.click(view.container.querySelector('[data-resource-edit="res-1"]') as HTMLElement)
    const note = await waitFor(() => {
      const editor = view.container.querySelector('[data-resource-meta-editor="res-1"]') as HTMLElement
      expect(editor).toBeTruthy()
      return editor.querySelectorAll('input')[1] as HTMLInputElement
    })
    fireEvent.change(note, { target: { value: '短发，红裙，戴眼镜' } })
    fireEvent.click(view.container.querySelector('[data-resource-meta-save="res-1"]') as HTMLElement)
    await waitFor(() => { expect(host.calls).toContain('resources/update') })
    // 备注写回可见（资源行会显示 note），编辑器收起
    await waitFor(() => {
      expect(view.container.querySelector('[data-resource-row="res-1"]')?.textContent).toContain('戴眼镜')
    })
    expect(view.container.querySelector('[data-resource-meta-editor="res-1"]')).toBeNull()
  })
})
