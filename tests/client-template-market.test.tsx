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
  const toggle = view.container.querySelector('[data-workflow-template-toggle="true"]') as HTMLElement
  // 真实浏览器里点按钮会先聚焦；jsdom 不会，这里补上，浮层关闭后才有焦点可归还
  toggle.focus()
  fireEvent.click(toggle)
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
    // 画布已有节点：整图替换先确认（防误触），再落库
    const confirm = await screen.findByRole('button', { name: en.canvasReplaceConfirm })
    fireEvent.click(confirm)
    await waitFor(() => {
      expect(host.calls.filter(call => call === 'workflows/save').length).toBeGreaterThan(saved)
    })
  })

  it('replaces this project\u2019s workflow instead of stacking orphan records (F3)', async () => {
    const { host, view } = await openTemplateMarket()

    // 空画布 → 直接套用：应只有一条工作流
    fireEvent.click(view.container.querySelector('[data-workflow-template="quick-image"]') as HTMLElement)
    await waitFor(() => { expect(host.workflows).toHaveLength(1) })
    const workflowId = host.workflows[0]!.id
    expect(host.workflows[0]!.nodes).toHaveLength(2)

    // 再套一张 → 整图替换，复用同一条记录（同 id、不新建）
    fireEvent.click(view.container.querySelector('[data-workflow-template-toggle="true"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-workflow-template-market="true"]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-workflow-template="quick-video"]') as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: en.canvasReplaceConfirm }))

    await waitFor(() => { expect(host.workflows).toHaveLength(1) })
    expect(host.workflows[0]!.id).toBe(workflowId)
    await waitFor(() => { expect(host.workflows[0]!.nodes).toHaveLength(3) })
  })

  it('浮层打开后焦点移入，Tab 在抽屉内循环，Esc 关闭并归还开关（F17）', async () => {
    const { view } = await openTemplateMarket()
    const market = view.container.querySelector('[data-workflow-template-market="true"]') as HTMLElement
    expect(market.getAttribute('role')).toBe('dialog')

    // 打开即把焦点放进抽屉：以前焦点留在背后的画布上，键盘用户 Tab 不进来
    expect(market.contains(document.activeElement)).toBe(true)

    const cards = [...market.querySelectorAll<HTMLElement>('.iv-tpl-card')]
    expect(cards.length).toBeGreaterThan(1)
    // jsdom 不会自己移动焦点，只能断言"边界回绕"这一段（真实浏览器里由 hook 兜住首尾）
    const head = cards[0]!
    const tail = cards[cards.length - 1]!
    tail.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(head)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(tail)

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => { expect(view.container.querySelector('[data-workflow-template-market="true"]')).toBeNull() })
    // 关闭后焦点回到开关按钮，而不是被丢回文档开头
    await waitFor(() => { expect(document.activeElement?.getAttribute('data-workflow-template-toggle')).toBe('true') })
  })
})
