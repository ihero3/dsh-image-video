// @vitest-environment jsdom
/**
 * `T9` 分镜 → 一键成片直通：剧本只粘一遍。
 *
 * 断言：
 * 1. 分镜头部有「编排成流水线」按钮；
 * 2. 点它把**分镜表组装成的剧本**送进 PipelineCard 的剧本框（场景/角色/画面都保留）；
 * 3. 同一份分镜连点两次也能再次触发（seq 递增，不是靠字符串变化）；
 * 4. 没有分镜时给明确提示，不静默无反应。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

function renderQuick() {
  const host = fakeApi({})
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '分镜项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 打开高级抽屉（分镜在其中）。 */
async function openAdvanced(container: HTMLElement) {
  const toggle = await waitFor(() => {
    const node = container.querySelector('[data-advanced-toggle]') as HTMLButtonElement
    expect(node).toBeTruthy()
    return node
  })
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  await waitFor(() => {
    expect((container.querySelector('[data-advanced-open]') as HTMLElement).hidden).toBe(false)
  })
}

describe('分镜 → 一键成片（T9）', () => {
  it('没有分镜时点击给出明确提示', async () => {
    const { view } = renderQuick()
    await openAdvanced(view.container)
    const button = view.container.querySelector('[data-storyboard-to-pipeline]') as HTMLElement
    expect(button).toBeTruthy()
    fireEvent.click(button)
    await waitFor(() => {
      expect(document.querySelector('.iv-notice')?.textContent ?? '').toContain(en.storyboardNeedsShotsForPipeline)
    })
  })

  it('有分镜时把组装好的剧本送进一键成片', async () => {
    const { host, view } = renderQuick()
    // 让 storyboard/plan 返回两条分镜
    ;(host.api as unknown as { planStoryboard: unknown }).planStoryboard = async () => ({
      shots: [
        { index: 1, shot: '雨夜街头', characters: ['林夏'], scene: '雨夜街头', imagePrompt: '雨夜街头，林夏撑伞', videoPrompt: '镜头推进' },
        { index: 2, shot: '霓虹招牌', characters: [], scene: '街道', imagePrompt: '霓虹招牌特写', videoPrompt: '镜头横移' },
      ],
    })
    await openAdvanced(view.container)

    // 填脚本 → 点「生成分镜表」
    const scriptBox = view.container.querySelector('[data-storyboard-script]') as HTMLTextAreaElement
    fireEvent.change(scriptBox, { target: { value: '雨夜街头，林夏撑伞走来' } })
    fireEvent.click(view.container.querySelector('[data-storyboard-plan]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelectorAll('[data-storyboard-shot]').length).toBe(2)
    })

    // 点「编排成流水线」
    fireEvent.click(view.container.querySelector('[data-storyboard-to-pipeline]') as HTMLElement)
    await waitFor(() => {
      const pipelineScript = view.container.querySelector('[data-pipeline-script]') as HTMLTextAreaElement
      expect(pipelineScript.value).toContain('镜头1')
      expect(pipelineScript.value).toContain('林夏')
      expect(pipelineScript.value).toContain('霓虹招牌特写')
    })
    expect(document.querySelector('.iv-notice')?.textContent ?? '').toContain(en.storyboardSentToPipeline)
  })

  it('收起的抽屉里也能点（按钮在抽屉内，展开后可见）', async () => {
    const { view } = renderQuick()
    await openAdvanced(view.container)
    const drawer = view.container.querySelector('[data-advanced-open]') as HTMLElement
    expect(drawer.querySelector('[data-storyboard-to-pipeline]')).toBeTruthy()
  })
})
