// @vitest-environment jsdom
/**
 * 剧本生成页的四个分区标签页：剧本分镜 / 素材提取 / 音色 / 轨迹。
 *
 * 素材提取把角色 / 场景 / 服装 / 道具合到一个 tab，用四个并排按钮切换；
 * 音色与轨迹各占一个 tab，页面内容分别为音色卡与轨迹卡。
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
    schemaVersion: 1, id: 'res-existing', projectId: 'prj-1', kind: 'role', name: '老周',
    note: '伞铺老板', scope: 'project', createdAt: stamp, updatedAt: stamp,
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeScript }))
  await waitFor(() => { expect(view.container.querySelector('[data-script-tabs]')).toBeTruthy() })
  return { host, view }
}

/** 在剧本分镜页设置文本模型（提取分区复用它作为回退模型）。 */
async function pickTextModel(view: ReturnType<typeof render>): Promise<void> {
  fireEvent.click(view.container.querySelector('[data-script-tab="split"]') as HTMLElement)
  await waitFor(() => { expect(view.container.querySelector('[data-script-text-model]')).toBeTruthy() })
  fireEvent.change(view.container.querySelector('[data-script-text-model]') as HTMLSelectElement, { target: { value: 'fake::fake-text' } })
}

describe('剧本生成页 · 四个分区', () => {
  it('orders the tabs and opens on the split page', async () => {
    const { view } = await renderScript()
    const tabs = [...view.container.querySelectorAll('[data-script-tab]')]
    expect(tabs.map(tab => tab.getAttribute('data-script-tab'))).toEqual(['split', 'extract', 'voice', 'motion'])
    expect(tabs.map(tab => tab.textContent)).toEqual([
      en.scriptTabSplit, en.scriptTabExtract, en.scriptTabVoice, en.scriptTabMotion,
    ])
    expect(view.container.querySelector('[data-script-tab="split"]')?.getAttribute('aria-selected')).toBe('true')
    expect(view.container.querySelector('[data-module="pipeline"]')).toBeTruthy()
    expect(view.container.querySelector('[data-script-extract]')).toBeNull()

    fireEvent.click(view.container.querySelector('[data-script-tab="extract"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-script-extract="role"]')).toBeTruthy() })
    expect(view.container.querySelector('[data-module="pipeline"]')).toBeNull()
  })

  it('素材提取：四种类型并排按钮切换，默认角色', async () => {
    const { view } = await renderScript()
    fireEvent.click(view.container.querySelector('[data-script-tab="extract"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-extract-kind-picker]')).toBeTruthy() })
    const kinds = [...view.container.querySelectorAll('[data-extract-kind]')]
    expect(kinds.map(button => button.getAttribute('data-extract-kind'))).toEqual(['role', 'scene', 'costume', 'prop'])
    expect(kinds.map(button => button.textContent)).toEqual([
      en.scriptTabRoles, en.scriptTabScenes, en.scriptTabCostumes, en.scriptTabProps,
    ])
    expect(kinds[0]?.getAttribute('aria-pressed')).toBe('true')
    expect(view.container.querySelector('[data-script-extract="role"]')).toBeTruthy()

    fireEvent.click(view.container.querySelector('[data-extract-kind="costume"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-script-extract="costume"]')).toBeTruthy() })
    expect(view.container.querySelector('[data-script-extract="role"]')).toBeNull()
    fireEvent.click(view.container.querySelector('[data-extract-kind="scene"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-script-extract="scene"]')).toBeTruthy() })
  })

  it('extracts characters from the current episode and adds one to the library', async () => {
    const { host, view } = await renderScript()
    const run = (): HTMLButtonElement => view.container.querySelector('[data-extract-run]') as HTMLButtonElement

    fireEvent.click(view.container.querySelector('[data-script-tab="extract"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-extract-needs-model]')).toBeTruthy() })
    expect(run().disabled).toBe(true)

    await pickTextModel(view)

    fireEvent.click(view.container.querySelector('[data-script-tab="extract"]') as HTMLElement)
    await waitFor(() => { expect(run().disabled).toBe(false) })
    fireEvent.click(run())
    await waitFor(() => { expect(view.container.querySelector('[data-extract-add="林夏"]')).toBeTruthy() })
    expect(view.container.querySelector('[data-extract-item="老周"] [data-extract-existing]')).toBeTruthy()

    fireEvent.click(view.container.querySelector('[data-extract-add="林夏"]') as HTMLElement)
    await waitFor(() => { expect(host.resources.some(resource => resource.name === '林夏')).toBe(true) })
    expect(host.resources.find(resource => resource.name === '林夏')?.kind).toBe('role')
    expect(host.calls).toContain('resources/create')
  })

  it('explains an empty script instead of calling the model', async () => {
    const { view } = await renderScript({ script: '' })
    fireEvent.click(view.container.querySelector('[data-script-tab="extract"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-extract-kind-picker]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-extract-kind="scene"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-script-extract="scene"]')).toBeTruthy() })
    expect(view.container.querySelector('[data-extract-source]')?.textContent).toContain(en.extractNeedsScript)
    expect((view.container.querySelector('[data-extract-run]') as HTMLButtonElement).disabled).toBe(true)
  })
})
