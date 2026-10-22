// @vitest-environment jsdom
/**
 * `B-6`（F4）模板市场卡片：A-1 落地的四个快速模板在界面上的分组、文案与一键新建。
 *
 * 口径：`WORKFLOW_TEMPLATES` 数据层归 Track A（已上线 quick-image/quick-video/
 * storyboard/cover）；界面负责分组（快速上手 / 完整链路）、描述文案
 * （`WorkflowTemplate` 没有 describe 字段，由客户端 TEMPLATE_HINTS 补）与点击实例化。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 进入工作流模式并打开模板市场。 */
async function openTemplateMarket() {
  const host = fakeApi()
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '模板项目',
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeWorkflow }))
  await waitFor(() => { expect(view.container.querySelector('[data-workbench-pane="paneCanvas"]')).toBeTruthy() })
  fireEvent.click(view.container.querySelector('[data-workflow-template-toggle="true"]') as HTMLElement)
  await waitFor(() => { expect(view.container.querySelector('[data-workflow-template-market="true"]')).toBeTruthy() })
  return { host, view }
}

/** 某张模板卡上的文案（名称 + 描述）。 */
function cardText(view: ReturnType<typeof render>, id: string): string {
  return view.container.querySelector(`[data-workflow-template="${id}"]`)?.textContent ?? ''
}

describe('B-6 template market cards (F4)', () => {
  it('groups the four quick templates with names and hints', async () => {
    const { view } = await openTemplateMarket()

    // 四张快速模板卡都在，且带名称 + 描述（描述由客户端 TEMPLATE_HINTS 提供）
    expect(cardText(view, 'quick-image')).toContain(en.templateQuickImage)
    expect(cardText(view, 'quick-image')).toContain(en.templateQuickImageHint)
    expect(cardText(view, 'quick-video')).toContain(en.templateQuickVideo)
    expect(cardText(view, 'quick-video')).toContain(en.templateQuickVideoHint)
    expect(cardText(view, 'storyboard')).toContain(en.templateStoryboard)
    expect(cardText(view, 'storyboard')).toContain(en.templateStoryboardHint)
    expect(cardText(view, 'cover')).toContain(en.templateCover)
    expect(cardText(view, 'cover')).toContain(en.templateCoverHint)

    // 两个分组标题都在；快速模板归「快速上手」，老模板归「完整链路」
    const market = view.container.querySelector('[data-workflow-template-market="true"]') as HTMLElement
    expect(market.textContent).toContain(en.templateQuickGroup)
    expect(market.textContent).toContain(en.templateFullGroup)
    const quickGroup = market.querySelector('.iv-tpl-group') as HTMLElement
    expect(quickGroup.textContent).toContain(en.templateQuickGroup)
    expect(quickGroup.querySelector('[data-workflow-template="quick-image"]')).toBeTruthy()
    expect(quickGroup.querySelector('[data-workflow-template="copy-to-video"]')).toBeNull()
  })

  it('instantiates a quick template into the canvas in one click', async () => {
    const { host, view } = await openTemplateMarket()

    // 点 quick-image（script → image-generate，2 节点）→ 一键新建
    fireEvent.click(view.container.querySelector('[data-workflow-template="quick-image"]') as HTMLElement)
    await waitFor(() => {
      expect(host.calls).toContain('workflows/save')
    })
    // 市场收起，画布进入未保存态
    await waitFor(() => { expect(view.container.querySelector('[data-workflow-template-market="true"]')).toBeNull() })
    const saved = host.calls.filter(call => call === 'workflows/save').length
    expect(saved).toBeGreaterThanOrEqual(1)

    // quick-video 是三节点（script → 首帧图 → 视频）
    fireEvent.click(view.container.querySelector('[data-workflow-template-toggle="true"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-workflow-template-market="true"]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-workflow-template="quick-video"]') as HTMLElement)
    await waitFor(() => {
      expect(host.calls.filter(call => call === 'workflows/save').length).toBeGreaterThan(saved)
    })
  })
})
