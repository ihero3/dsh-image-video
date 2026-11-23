// @vitest-environment jsdom
/**
 * 剧本生成页的四个分区标签页（`B-23`）：剧本分段 / 角色 / 场景 / 道具·服装。
 *
 * 分区只换内容、不换模式：剧本分段保留原来的「剧本 → 成片」卡与本集工作区，
 * 三个提取分区共用一套「当前集剧本 → 文本模型 → 候选 → 逐条入库」的流程。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const stamp = '2026-11-20T00:00:00.000Z'

/** 挂载到剧本生成页：一集有剧本的集 + 一条已有角色资源。 */
async function renderScript(options: { script?: string } = {}) {
  const host = fakeApi({
    episodes: [{
      schemaVersion: 1, id: 'ep-1', projectId: 'prj-1', no: 0, title: '第0集',
      script: { text: options.script ?? '雨夜街头，林夏撑伞走来。老周在屋檐下等她。', updatedAt: stamp },
      segments: [], storyboards: [], resourceRefs: [], assetRefs: [], createdAt: stamp, updatedAt: stamp,
    }],
  })
  host.projects.push({ schemaVersion: 1, id: 'prj-1', name: '剧', createdAt: stamp, updatedAt: stamp } as never)
  host.resources.push({
    schemaVersion: 1, id: 'res-1', projectId: 'prj-1', kind: 'role', name: '老周',
    note: '伞铺老板', scope: 'project', createdAt: stamp, updatedAt: stamp,
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeScript }))
  await waitFor(() => { expect(view.container.querySelector('[data-script-tabs]')).toBeTruthy() })
  return { host, view }
}

describe('剧本生成页 · 四个分区', () => {
  it('orders the tabs and opens on the split page', async () => {
    const { view } = await renderScript()
    const tabs = [...view.container.querySelectorAll('[data-script-tab]')]
    expect(tabs.map(tab => tab.getAttribute('data-script-tab'))).toEqual(['split', 'roles', 'scenes', 'props'])
    expect(tabs.map(tab => tab.textContent)).toEqual([
      en.scriptTabSplit, en.scriptTabRoles, en.scriptTabScenes, en.scriptTabProps,
    ])
    expect(view.container.querySelector('[data-script-tab="split"]')?.getAttribute('aria-selected')).toBe('true')
    // 默认是剧本分段：原来的成片卡还在，提取面板不出现
    expect(view.container.querySelector('[data-module="pipeline"]')).toBeTruthy()
    expect(view.container.querySelector('[data-script-extract]')).toBeNull()

    fireEvent.click(view.container.querySelector('[data-script-tab="roles"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-script-extract="role"]')).toBeTruthy() })
    // 提取分区不渲染成片卡，内容不重叠
    expect(view.container.querySelector('[data-module="pipeline"]')).toBeNull()
  })

  it('extracts characters from the current episode and adds one to the library', async () => {
    const { host, view } = await renderScript()
    const run = (): HTMLButtonElement => view.container.querySelector('[data-extract-run]') as HTMLButtonElement

    // 还没选文本模型：按钮禁用并说明原因
    fireEvent.click(view.container.querySelector('[data-script-tab="roles"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-extract-needs-model]')).toBeTruthy() })
    expect(run().disabled).toBe(true)

    // 到剧本分段页选文本模型
    fireEvent.click(view.container.querySelector('[data-script-tab="split"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-script-text-model]')).toBeTruthy() })
    fireEvent.change(view.container.querySelector('[data-script-text-model]') as HTMLSelectElement, { target: { value: 'fake::fake-text' } })

    // 回到角色分区提取
    fireEvent.click(view.container.querySelector('[data-script-tab="roles"]') as HTMLElement)
    await waitFor(() => { expect(run().disabled).toBe(false) })
    fireEvent.click(run())
    await waitFor(() => { expect(view.container.querySelector('[data-extract-add="林夏"]')).toBeTruthy() })
    // 已经在资源库的名字标出来，不再给「加入」按钮
    expect(view.container.querySelector('[data-extract-item="老周"] [data-extract-existing]')).toBeTruthy()

    fireEvent.click(view.container.querySelector('[data-extract-add="林夏"]') as HTMLElement)
    await waitFor(() => { expect(host.resources.some(resource => resource.name === '林夏')).toBe(true) })
    expect(host.resources.find(resource => resource.name === '林夏')?.kind).toBe('role')
    expect(host.calls).toContain('resources/create')
  })

  it('explains an empty script instead of calling the model', async () => {
    const { view } = await renderScript({ script: '' })
    fireEvent.click(view.container.querySelector('[data-script-tab="scenes"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-script-extract="scene"]')).toBeTruthy() })
    expect(view.container.querySelector('[data-extract-source]')?.textContent).toContain(en.extractNeedsScript)
    expect((view.container.querySelector('[data-extract-run]') as HTMLButtonElement).disabled).toBe(true)
  })
})
