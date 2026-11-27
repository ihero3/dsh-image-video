// @vitest-environment jsdom
/**
 * 剧本生成页新增的「音色」与「轨迹」两个 tab。
 *
 * 音色参考 ComfyUI 零样本克隆节点：说话人卡 + 预设音色 + 语速/音调/情绪 + 参考音频，
 * 能存进资源库与本集引用；TTS 未接入时合成按钮禁用且显示原因，不假装成功。
 * 轨迹参考 OmniCam / Camera H3：运镜预设一键生成关键帧、逐帧编辑、编译提示词、入库。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { switchPipelineEpisode } from '../src/client/workbench-store.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const stamp = '2026-11-25T00:00:00.000Z'

async function renderScript() {
  const host = fakeApi({
    episodes: [{
      schemaVersion: 1, id: 'ep-1', projectId: 'prj-1', no: 0, title: '第0集',
      script: { text: '雨夜街头，林夏撑伞走来。镜头缓缓推进。', updatedAt: stamp },
      segments: [], storyboards: [], resourceRefs: [], assetRefs: [], createdAt: stamp, updatedAt: stamp,
    }],
  })
  host.projects.push({ schemaVersion: 1, id: 'prj-1', name: '剧', createdAt: stamp, updatedAt: stamp } as never)
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeScript }))
  await waitFor(() => { expect(view.container.querySelector('[data-script-tabs]')).toBeTruthy() })
  fireEvent.click(view.container.querySelector('[data-script-tab="split"]') as HTMLElement)
  fireEvent.change(view.container.querySelector('[data-script-text-model]') as HTMLSelectElement, { target: { value: 'fake::fake-text' } })
  return { host, view }
}

describe('音色 tab', () => {
  it('从剧本提取说话人生成音色卡；TTS 未接入时合成禁用并说明原因', async () => {
    const { view } = await renderScript()
    fireEvent.click(view.container.querySelector('[data-script-tab="voice"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-voice-panel]')).toBeTruthy() })

    // 共享剧本输入在这里同样可见；音色状态来自 voice/status（夹具为未接入）
    expect(view.container.querySelector('[data-voice-panel] [data-pipeline-script]')).toBeTruthy()
    expect(view.container.querySelector('[data-voice-status="unavailable"]')).toBeTruthy()
    expect((view.container.querySelector('[data-voice-reason]')?.textContent ?? '')).toContain('TTS')

    fireEvent.click(view.container.querySelector('[data-voice-extract-run]') as HTMLButtonElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-voice-card-item]').length).toBeGreaterThan(0) })
    const cardId = view.container.querySelector('[data-voice-card-item]')!.getAttribute('data-voice-card-item')!

    // ComfyUI 风格参数：预设音色 / 语速 / 音调 / 情绪 / 参考音频
    expect(view.container.querySelector(`[data-voice-card-voice="${cardId}"]`)).toBeTruthy()
    expect(view.container.querySelector(`[data-voice-card-speed="${cardId}"]`)).toBeTruthy()
    expect(view.container.querySelector(`[data-voice-card-pitch="${cardId}"]`)).toBeTruthy()
    expect(view.container.querySelector(`[data-voice-card-emotion="${cardId}"]`)).toBeTruthy()
    expect(view.container.querySelector(`[data-voice-card-ref-audio="${cardId}"]`)).toBeTruthy()

    const synth = view.container.querySelector(`[data-voice-card-synthesize="${cardId}"]`) as HTMLButtonElement
    expect(synth.disabled).toBe(true)
    expect(synth.title).toContain('TTS')
  })

  it('音色卡可编辑参数、存入资源库并加入本集引用；重复保存走更新', async () => {
    const { host, view } = await renderScript()
    fireEvent.click(view.container.querySelector('[data-script-tab="voice"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-voice-panel]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-voice-extract-run]') as HTMLButtonElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-voice-card-item]').length).toBeGreaterThan(0) })
    const cardId = view.container.querySelector('[data-voice-card-item]')!.getAttribute('data-voice-card-item')!

    fireEvent.change(view.container.querySelector(`[data-voice-card-name="${cardId}"]`) as HTMLInputElement, { target: { value: '林夏' } })
    fireEvent.change(view.container.querySelector(`[data-voice-card-voice="${cardId}"]`) as HTMLSelectElement, { target: { value: 'v-female' } })
    fireEvent.change(view.container.querySelector(`[data-voice-card-speed="${cardId}"]`) as HTMLInputElement, { target: { value: '1.2' } })
    fireEvent.click(view.container.querySelector(`[data-voice-card-emotions="${cardId}"] button`) as HTMLElement)
    fireEvent.click(view.container.querySelector(`[data-voice-card-save="${cardId}"]`) as HTMLButtonElement)
    await waitFor(() => { expect(host.resources.some(resource => resource.kind === 'voice' && resource.name === '林夏')).toBe(true) })
    const saved = host.resources.find(resource => resource.kind === 'voice' && resource.name === '林夏')!
    expect(saved.note).toContain('v-female')
    expect(saved.note).toContain('1.20')
    // 情绪标签随语言切换（`F14`）：英文界面下点第一个预设应填入 'calm'，不是硬编码的「平静」
    expect(saved.note).toContain(en.voiceEmotionCalm)
    expect(host.episodes[0]?.resourceRefs.some(ref => ref.resourceId === saved.id)).toBe(true)

    const creates = host.calls.filter(call => call === 'resources/create').length
    fireEvent.click(view.container.querySelector(`[data-voice-card-save="${cardId}"]`) as HTMLButtonElement)
    await waitFor(() => { expect(host.calls.filter(call => call === 'resources/update').length).toBeGreaterThan(0) })
    expect(host.calls.filter(call => call === 'resources/create').length).toBe(creates)
  })

  it('音色卡按剧集保存，切集后互不串台', async () => {
    const { host, view } = await renderScript()
    fireEvent.click(view.container.querySelector('[data-script-tab="voice"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-voice-panel]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-voice-extract-run]') as HTMLButtonElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-voice-card-item]').length).toBeGreaterThan(0) })
    act(() => { switchPipelineEpisode(host.api, 'ep-2') })
    await waitFor(() => { expect(view.container.querySelectorAll('[data-voice-card-item]').length).toBe(0) })
    act(() => { switchPipelineEpisode(host.api, 'ep-1') })
    await waitFor(() => { expect(view.container.querySelectorAll('[data-voice-card-item]').length).toBeGreaterThan(0) })
  })
})

describe('轨迹 tab', () => {
  it('运镜预设生成关键帧，逐帧可改，并编译成可读提示词', async () => {
    const { view } = await renderScript()
    fireEvent.click(view.container.querySelector('[data-script-tab="motion"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-motion-panel]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-motion-card-add]') as HTMLButtonElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-motion-card-item]').length).toBe(1) })
    const cardId = view.container.querySelector('[data-motion-card-item]')!.getAttribute('data-motion-card-item')!

    // 预设：推进 → 关键帧缩放从 1 到 1.35
    fireEvent.click(view.container.querySelector(`[data-motion-presets="${cardId}"] [data-motion-preset="push"]`) as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector(`[data-motion-card-preset="${cardId}"]`)?.textContent).toBe(en.motionPresetPush) })
    expect(view.container.querySelectorAll(`[data-motion-frames="${cardId}"] [data-motion-frame]`).length).toBe(2)
    const compiled = (): string => (view.container.querySelector(`[data-motion-compiled="${cardId}"]`) as HTMLTextAreaElement).value
    expect(compiled()).toContain('缩放')

    // 逐帧编辑坐标 → 标记自定义；加一帧 / 删一帧
    fireEvent.change(view.container.querySelector(`[data-motion-frames="${cardId}"] [data-motion-frame-x="0"]`) as HTMLInputElement, { target: { value: '0.3' } })
    await waitFor(() => { expect(view.container.querySelector(`[data-motion-card-preset="${cardId}"]`)?.textContent).toBe(en.motionPresetCustom) })
    expect(compiled()).toContain('画面中左')
    fireEvent.click(view.container.querySelector(`[data-motion-frame-add="${cardId}"]`) as HTMLButtonElement)
    await waitFor(() => { expect(view.container.querySelectorAll(`[data-motion-frames="${cardId}"] [data-motion-frame]`).length).toBe(3) })
    fireEvent.click(view.container.querySelector(`[data-motion-frames="${cardId}"] [data-motion-frame-remove="2"]`) as HTMLElement)
    await waitFor(() => { expect(view.container.querySelectorAll(`[data-motion-frames="${cardId}"] [data-motion-frame]`).length).toBe(2) })
  })

  it('轨迹卡存为 motion-track 资源（带关键帧）并加入本集引用', async () => {
    const { host, view } = await renderScript()
    fireEvent.click(view.container.querySelector('[data-script-tab="motion"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-motion-panel]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-motion-card-add]') as HTMLButtonElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-motion-card-item]').length).toBe(1) })
    const cardId = view.container.querySelector('[data-motion-card-item]')!.getAttribute('data-motion-card-item')!
    fireEvent.change(view.container.querySelector(`[data-motion-card-name="${cardId}"]`) as HTMLInputElement, { target: { value: '推进镜头' } })
    fireEvent.click(view.container.querySelector(`[data-motion-presets="${cardId}"] [data-motion-preset="push"]`) as HTMLElement)
    fireEvent.click(view.container.querySelector(`[data-motion-card-save="${cardId}"]`) as HTMLButtonElement)
    await waitFor(() => { expect(host.resources.some(resource => resource.kind === 'motion-track' && resource.name === '推进镜头')).toBe(true) })
    const saved = host.resources.find(resource => resource.kind === 'motion-track' && resource.name === '推进镜头')!
    expect(saved.keyframes).toHaveLength(2)
    expect(saved.keyframes?.[1]?.scale).toBe(1.35)
    expect(host.episodes[0]?.resourceRefs.some(ref => ref.resourceId === saved.id)).toBe(true)
  })

  it('从剧本提取运镜候选也能生成轨迹卡', async () => {
    const { view } = await renderScript()
    fireEvent.click(view.container.querySelector('[data-script-tab="motion"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-motion-panel]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-motion-extract-run]') as HTMLButtonElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-motion-card-item]').length).toBeGreaterThan(0) })
    expect(view.container.querySelector('[data-motion-card-item]')?.textContent).toContain('推进镜头')
  })
})
