// @vitest-environment jsdom
/**
 * 剧本生成页的角色分区：共享输入 + 角色提取配置 + 角色卡生成落库。
 *
 * 钉住产品口径：
 * - 四个分区共用同一份剧本文本与导入文件，按剧集保存；
 * - 角色提取有自己的文本模型、Skill 与提示词输入框，Skill token 不会发给模型；
 * - 提取结果变成可折叠的角色卡，卡上能改提示词 / 选生图模型 / Skill / 尺寸 / 风格 / 默认值；
 * - 「生成角色图」写素材库、本剧资源库与本集资源引用，点缩略图进右侧预览。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { switchPipelineEpisode } from '../src/client/workbench-store.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const stamp = '2026-11-25T00:00:00.000Z'

async function renderRoles() {
  const host = fakeApi({
    episodes: [{
      schemaVersion: 1, id: 'ep-1', projectId: 'prj-1', no: 0, title: '第0集',
      script: { text: '雨夜街头，林夏撑伞走来。老周在屋檐下等她。', updatedAt: stamp },
      segments: [], storyboards: [], resourceRefs: [], assetRefs: [], createdAt: stamp, updatedAt: stamp,
    }],
  })
  host.projects.push({ schemaVersion: 1, id: 'prj-1', name: '剧', createdAt: stamp, updatedAt: stamp } as never)
  host.resources.push({
    schemaVersion: 1, id: 'res-existing', projectId: 'prj-1', kind: 'role', name: '老周',
    note: '伞铺老板', scope: 'project', createdAt: stamp, updatedAt: stamp,
  })
  host.skills.push({
    schemaVersion: 1, id: 'skl-role', kind: 'director', name: '导演技能',
    description: '', prompt: '导演提示词', builtin: false, enabled: true,
    createdAt: stamp, updatedAt: stamp,
  } as never)
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeScript }))
  await waitFor(() => { expect(view.container.querySelector('[data-script-tabs]')).toBeTruthy() })
  fireEvent.click(view.container.querySelector('[data-script-tab="extract"]') as HTMLElement)
  await waitFor(() => { expect(view.container.querySelector('[data-script-extract="role"]')).toBeTruthy() })
  return { host, view }
}

/** 选模型 → 填角色提取提示词 → 提取出角色卡。 */
async function extractRoles(view: { container: HTMLElement }, instructions = '只提取有台词的人物') {
  fireEvent.change(view.container.querySelector('[data-role-extract-model]') as HTMLSelectElement, {
    target: { value: 'fake::fake-text' },
  })
  const prompt = view.container.querySelector('[data-role-extract-prompt]') as HTMLTextAreaElement
  fireEvent.change(prompt, { target: { value: instructions } })
  fireEvent.click(view.container.querySelector('[data-extract-run]') as HTMLButtonElement)
  await waitFor(() => { expect(view.container.querySelectorAll('[data-role-card]').length).toBeGreaterThan(0) })
}

describe('剧本生成页 · 角色提取与角色卡', () => {
  it('四个分区共用一套剧本输入；角色提取模型和 Skill 独立配置，token 不发给模型', async () => {
    const { host, view } = await renderRoles()
    const rolePanel = (): HTMLElement =>
      view.container.querySelector('[data-script-extract="role"]') as HTMLElement
    // 四个分区渲染的是同一份输入：写进去的内容切到场景分区再回来还在
    expect(rolePanel().querySelector('[data-shared-script-input] [data-pipeline-script]')).toBeTruthy()
    fireEvent.change(rolePanel().querySelector('[data-pipeline-script]') as HTMLTextAreaElement, {
      target: { value: '共享剧本正文' },
    })
    fireEvent.click(view.container.querySelector('[data-extract-kind="scene"]') as HTMLElement)
    await waitFor(() => {
      expect((view.container.querySelector('[data-script-extract="scene"] [data-pipeline-script]') as HTMLTextAreaElement)?.value)
        .toBe('共享剧本正文')
    })
    fireEvent.click(view.container.querySelector('[data-extract-kind="role"]') as HTMLElement)
    await waitFor(() => { expect(rolePanel()).toBeTruthy() })
    expect((rolePanel().querySelector('[data-pipeline-script]') as HTMLTextAreaElement).value).toBe('共享剧本正文')
    expect(rolePanel().querySelector('[data-role-extract-prompt]')).toBeTruthy()
    expect(rolePanel().querySelector('[data-role-extract-model]')).toBeTruthy()

    await extractRoles(view, '只提取有台词的人物')
    fireEvent.change(rolePanel().querySelector('[data-role-extract-skill]') as HTMLSelectElement, {
      target: { value: '' },
    })
    // Skill 通过统一的 token 插入到提取提示词
    fireEvent.change(rolePanel().querySelector('[data-role-extract-skill]') as HTMLSelectElement, {
      target: { value: 'skl-role' },
    })
    expect((rolePanel().querySelector('[data-role-extract-prompt]') as HTMLTextAreaElement).value)
      .toContain('【@导演技能】')
    fireEvent.click(rolePanel().querySelector('[data-extract-run]') as HTMLButtonElement)
    await waitFor(() => { expect(host.entityExtractInputs.length).toBe(2) })
    expect(host.entityExtractInputs[0]).toMatchObject({ category: 'role', provider: 'fake', model: 'fake-text' })
    expect(host.entityExtractInputs[0]?.instructions).toBe('只提取有台词的人物')
    expect(host.entityExtractInputs[1]?.instructions).toBe('只提取有台词的人物')
    expect(host.entityExtractInputs[1]?.instructions).not.toContain('【@导演技能】')
    expect(host.entityExtractInputs[1]?.skillId).toBe('skl-role')
    // 提取结果直接变成角色卡，默认值取自提取说明
    expect(view.container.querySelectorAll('[data-role-card]').length).toBe(2)
  })

  it('角色卡可折叠编辑；生成角色图写入素材库、本剧资源库与本集引用，并可预览', async () => {
    const { host, view } = await renderRoles()
    await extractRoles(view)
    const head = view.container.querySelector('[data-role-card] [data-role-card-head]') as HTMLElement
    const cardId = head.getAttribute('data-role-card-head')!
    const prompt = (): HTMLTextAreaElement =>
      view.container.querySelector(`[data-role-card-prompt="${cardId}"]`) as HTMLTextAreaElement
    expect(prompt()).toBeTruthy()

    // 整行折叠 / 展开
    fireEvent.click(head)
    await waitFor(() => { expect(prompt()).toBeNull() })
    fireEvent.click(view.container.querySelector(`[data-role-card-head="${cardId}"]`) as HTMLElement)
    await waitFor(() => { expect(prompt()).toBeTruthy() })

    // 图像模型候选来自 models/catalog 的真实模型 id，不能是 provider（threevideo 会触发 400）
    const modelSelect = view.container.querySelector(`[data-role-card-image-model="${cardId}"]`) as HTMLSelectElement
    await waitFor(() => {
      expect([...modelSelect.options].map(option => option.value)).toEqual(['', 'm1', 'm2'])
    })

    // 默认值回填 + 提示词、模型、尺寸、风格都可改
    fireEvent.change(prompt(), { target: { value: '林夏，撑红伞的短发女孩' } })
    fireEvent.change(view.container.querySelector(`[data-role-card-image-model="${cardId}"]`) as HTMLSelectElement, {
      target: { value: 'm1' },
    })
    fireEvent.change(view.container.querySelector(`[data-role-card-size="${cardId}"]`) as HTMLSelectElement, {
      target: { value: '1024*1024' },
    })
    fireEvent.change(view.container.querySelector(`[data-role-card-style="${cardId}"]`) as HTMLSelectElement, {
      target: { value: 'photo' },
    })
    fireEvent.click(view.container.querySelector(`[data-role-card-generate="${cardId}"]`) as HTMLButtonElement)
    await waitFor(() => { expect(host.generatePayloads.length).toBe(1) })
    expect(host.generatePayloads[0]).toMatchObject({
      mediaMode: 'image', model: 'm1', size: '1024*1024',
      projectId: 'prj-1', episodeId: 'ep-1',
    })
    expect(host.generatePayloads[0]?.prompt).toContain('林夏，撑红伞的短发女孩')
    expect(host.generatePayloads[0]?.prompt).toContain('风格：photo')

    // 图片进素材库 + 本剧资源库 + 本集资源引用
    await waitFor(() => { expect(host.resources.some(item => item.name === '林夏')).toBe(true) })
    const created = host.resources.find(item => item.name === '林夏')!
    expect(created.kind).toBe('role')
    expect(created.assetPath).toBe('/tmp/outputs/generated.png')
    await waitFor(() => {
      expect(host.episodes[0]?.resourceRefs.some(ref => ref.resourceId === created.id)).toBe(true)
    })

    // 点卡片缩略图 → 右侧预览
    fireEvent.click(view.container.querySelector(`[data-role-card-preview="${cardId}"]`) as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-preview-actions="image"]')).toBeTruthy() })
  })

  it('角色卡的姿态/镜头/风格备注/场景裁剪作为融合生图参数生效', async () => {
    const { host, view } = await renderRoles()
    await extractRoles(view)
    const head = view.container.querySelector('[data-role-card] [data-role-card-head]') as HTMLElement
    const cardId = head.getAttribute('data-role-card-head')!
    fireEvent.click(view.container.querySelector(`[data-role-card-pose="${cardId}"][data-pose="standing"]`) as HTMLElement)
    fireEvent.click(view.container.querySelector(`[data-role-card-lens="${cardId}"][data-lens="closeup"]`) as HTMLElement)
    fireEvent.change(view.container.querySelector(`[data-role-card-style-note="${cardId}"]`) as HTMLTextAreaElement, {
      target: { value: '电影感光影' },
    })
    fireEvent.click(view.container.querySelector(`[data-role-card-crop-enable="${cardId}"]`) as HTMLInputElement)
    const widthField = (): HTMLInputElement =>
      view.container.querySelector(`[data-role-card-compose="${cardId}"] [data-role-card-crop-field="width"]`) as HTMLInputElement
    await waitFor(() => { expect(widthField()).toBeTruthy() })
    fireEvent.change(widthField(), { target: { value: '0.5' } })
    fireEvent.click(view.container.querySelector(`[data-role-card-generate="${cardId}"]`) as HTMLButtonElement)

    await waitFor(() => { expect(host.composePayloads.length).toBe(1) })
    expect(host.generatePayloads.length).toBe(0)
    expect(host.composePayloads[0]).toMatchObject({
      projectId: 'prj-1',
      pose: 'standing',
      lens: 'closeup',
      styleNote: '电影感光影',
      cropScene: { x: 0.1, y: 0.1, width: 0.5, height: 0.8 },
    })
    expect(host.composePayloads[0]?.resourceIds).toHaveLength(1)
    // 融合结果同样写进本剧资源库与本集引用
    await waitFor(() => {
      expect(host.resources.find(item => item.name === '林夏')?.assetPath).toBe('/tmp/outputs/composed.png')
    })
    const created = host.resources.find(item => item.name === '林夏')!
    expect(host.episodes[0]?.resourceRefs.some(ref => ref.resourceId === created.id)).toBe(true)
  })

  it('角色卡与提取配置按剧集保存，切集后互不串台', async () => {
    const { host, view } = await renderRoles()
    await extractRoles(view)
    expect(view.container.querySelectorAll('[data-role-card]').length).toBe(2)
    act(() => { switchPipelineEpisode(host.api, 'ep-2') })
    await waitFor(() => { expect(view.container.querySelectorAll('[data-role-card]').length).toBe(0) })
    act(() => { switchPipelineEpisode(host.api, 'ep-1') })
    await waitFor(() => { expect(view.container.querySelectorAll('[data-role-card]').length).toBe(2) })
  })
})
