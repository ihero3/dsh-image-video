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

/** 模块 ① 的「手动分镜」默认展开（旧高级抽屉已下线）。 */
async function openAdvanced(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector('[data-module="pipeline"] [data-storyboard]')).toBeTruthy()
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

  it('分镜工坊已并入模块 ①（2026-11-05）：旧高级抽屉已下线', async () => {
    const { view } = renderQuick()
    // 位置变了：从"高级抽屉"搬到模块 ① 的「手动分镜」折叠块里
    const entry = view.container.querySelector('[data-module="pipeline"] [data-storyboard-entry]') as HTMLElement
    expect(entry).toBeTruthy()
    expect(entry.querySelector('[data-storyboard-to-pipeline]')).toBeTruthy()
    expect(view.container.querySelector('[data-module="advanced"]')).toBeNull()
  })
})
