// @vitest-environment jsdom
/**
 * M2：本集工作区（剧本 → 分段 → 分镜 → 就地生成）。
 *
 * 覆盖：剧本失焦保存、分段时长快捷、分段提示词拆镜落库、逐镜编辑与按镜生成、
 * 引用 chip 与 `[@n]` 插入。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'
import type { EpisodeRecord, SegmentRecord, ShotRecord, StoryboardRecord } from '../src/workbench/episodes.ts'
import type { AssetRecord, ResourceRecord } from '../src/workbench/records.ts'

afterEach(cleanup)

const STAMP = '2026-11-09T00:00:00.000Z'

/** 一个剧集（工作台要求有 activeProject 才会加载集）。 */
function project(): Record<string, unknown> {
  return { schemaVersion: 1, id: 'prj-1', name: '测试剧', createdAt: STAMP, updatedAt: STAMP }
}

function segment(id: string, order: number, extra: Partial<SegmentRecord> = {}): SegmentRecord {
  return {
    schemaVersion: 1, id, episodeId: 'ep-1', order, durationSec: 5,
    promptText: '开场', refs: [], ...extra,
  }
}

function shot(id: string, order: number, extra: Partial<ShotRecord> = {}): ShotRecord {
  return {
    id, order, durationSec: 3,
    imagePrompt: `图片 ${order}`, videoPrompt: `视频 ${order}`, refs: [], ...extra,
  }
}

function storyboard(segmentId: string, shots: ShotRecord[]): StoryboardRecord {
  return { schemaVersion: 1, id: 'sb-1', episodeId: 'ep-1', segmentId, shots, updatedAt: STAMP }
}

/** 一集；默认一段、可选分镜与引用。 */
function episode(options: {
  segments?: readonly SegmentRecord[]
  storyboards?: readonly StoryboardRecord[]
  resourceRefs?: EpisodeRecord['resourceRefs']
  assetRefs?: EpisodeRecord['assetRefs']
} = {}): EpisodeRecord {
  return {
    schemaVersion: 1, id: 'ep-1', projectId: 'prj-1', no: 1, title: '第1集',
    script: { text: '', updatedAt: STAMP },
    segments: options.segments ?? [segment('seg-1', 1)],
    storyboards: options.storyboards ?? [],
    resourceRefs: options.resourceRefs ?? [],
    assetRefs: options.assetRefs ?? [],
    createdAt: STAMP, updatedAt: STAMP,
  }
}

function resource(id: string, name: string): ResourceRecord {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', kind: 'role', name, scope: 'project',
    createdAt: STAMP, updatedAt: STAMP,
  } as ResourceRecord
}

function asset(id: string, path: string): AssetRecord {
  return {
    schemaVersion: 4, id, projectId: 'prj-1', kind: 'image', path, bytes: 2048,
    createdAt: STAMP,
  } as AssetRecord
}

/** 挂载到「本集工作区」出现为止。 */
async function renderWorkspace(options: Parameters<typeof episode>[0] = {}) {
  const host = fakeApi({
    episodes: [episode(options)],
    assets: [asset('ast-1', '/tmp/outputs/ref.png')],
  })
  host.projects.push(project() as never)
  host.resources.push(resource('res-1', '主角'))
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  await waitFor(() => { expect(view.container.querySelector('[data-episode-workspace="ep-1"]')).toBeTruthy() })
  return { host, view }
}

describe('本集工作区（剧本 → 分段 → 分镜）', () => {
  it('autosaves the episode script on blur and shows the save state', async () => {
    const { host, view } = await renderWorkspace()
    const script = view.container.querySelector('[data-episode-script]') as HTMLTextAreaElement
    fireEvent.change(script, { target: { value: '第一场：雨夜街头' } })
    await waitFor(() => {
      expect(view.container.querySelector('[data-episode-script-state]')?.getAttribute('data-episode-script-state')).toBe('dirty')
    })
    fireEvent.blur(script)
    await waitFor(() => {
      expect(view.container.querySelector('[data-episode-script-state]')?.getAttribute('data-episode-script-state')).toBe('saved')
      expect(host.episodes[0]?.script.text).toBe('第一场：雨夜街头')
    })
  })

  it('changes the segment duration with a preset and keeps 5/10/20/30 available', async () => {
    const { host, view } = await renderWorkspace()
    const preset = view.container.querySelector('[data-segment-duration="10"]') as HTMLElement
    expect(preset.textContent).toBe('10s')
    fireEvent.click(preset)
    await waitFor(() => {
      expect(host.episodes[0]?.segments[0]?.durationSec).toBe(10)
      expect((view.container.querySelector('[data-segment-duration-input="seg-1"]') as HTMLInputElement).value).toBe('10')
    })
  })

  it('plans a storyboard from the segment prompt and lands the shots', async () => {
    const { host, view } = await renderWorkspace()
    fireEvent.click(view.container.querySelector('[data-segment-plan="seg-1"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-segment-storyboard="seg-1"]')).toBeTruthy()
      expect(view.container.querySelectorAll('[data-shot]').length).toBe(2)
    })
    expect(host.storyboardPayloads[0]?.script).toBe('开场')
    expect(host.episodes[0]?.storyboards[0]?.shots.length).toBe(2)
  })

  it('generates a shot image with episode/segment/shot attribution', async () => {
    const { host, view } = await renderWorkspace({
      storyboards: [storyboard('seg-1', [shot('shot-1', 1), shot('shot-2', 2)])],
    })
    fireEvent.click(view.container.querySelector('[data-shot-generate-image="shot-2"]') as HTMLElement)
    await waitFor(() => { expect(host.generatePayloads.length).toBe(1) })
    expect(host.generatePayloads[0]).toMatchObject({
      mediaMode: 'image', prompt: '图片 2', episodeId: 'ep-1', segmentId: 'seg-1', shotId: 'shot-2',
    })
    await waitFor(() => { expect(view.container.textContent).toContain(en.shotImageDone.replace('{n}', '2')) })
  })

  it('saves a shot prompt edit on blur', async () => {
    const { host, view } = await renderWorkspace({
      storyboards: [storyboard('seg-1', [shot('shot-1', 1)])],
    })
    const prompt = view.container.querySelector('[data-shot-image-prompt="shot-1"]') as HTMLTextAreaElement
    fireEvent.change(prompt, { target: { value: '雨夜霓虹，主角回头' } })
    fireEvent.blur(prompt)
    await waitFor(() => {
      expect(host.episodes[0]?.storyboards[0]?.shots[0]?.imagePrompt).toBe('雨夜霓虹，主角回头')
    })
  })

  it('picks an image asset for a single shot and saves it as a shot ref', async () => {
    const { host, view } = await renderWorkspace({
      storyboards: [storyboard('seg-1', [shot('shot-1', 1)])],
    })
    const picker = view.container.querySelector('[data-shot-ref-add="shot-1"]') as HTMLSelectElement
    expect([...picker.options].map(option => option.value)).toContain('asset:ast-1')
    fireEvent.change(picker, { target: { value: 'asset:ast-1' } })
    await waitFor(() => {
      expect(host.episodes[0]?.storyboards[0]?.shots[0]?.refs[0]).toMatchObject({ kind: 'asset', id: 'ast-1', order: 1 })
      // 同一素材不会重复出现在选择器里
      const next = view.container.querySelector('[data-shot-ref-add="shot-1"]') as HTMLSelectElement
      expect([...next.options].map(option => option.value)).not.toContain('asset:ast-1')
    })
  })

  it('syncs the storyboard to one workflow and exports only this episode', async () => {
    const { host, view } = await renderWorkspace({
      storyboards: [storyboard('seg-1', [shot('shot-1', 1)])],
    })
    fireEvent.click(view.container.querySelector('[data-episode-sync-workflow="true"]') as HTMLElement)
    await waitFor(() => { expect(host.workflows.some(item => item.id === 'wfl-ep-ep-1')).toBe(true) })
    await waitFor(() => { expect(view.container.textContent).toContain(en.episodeSyncWorkflowDone.replace('{name}', '第1集 分镜')) })

    // 再点一次仍是同一份工作流（幂等由宿主保证）
    fireEvent.click(view.container.querySelector('[data-episode-sync-workflow="true"]') as HTMLElement)
    await waitFor(() => { expect(host.workflows.filter(item => item.id === 'wfl-ep-ep-1')).toHaveLength(1) })

    fireEvent.click(view.container.querySelector('[data-episode-export="true"]') as HTMLElement)
    await waitFor(() => {
      expect(host.calls).toContain('episodes/export')
      expect(view.container.textContent).toContain(en.episodeExportDone.replace('{path}', '/tmp/outputs/episodes/ep-1/episode.json'))
    })
  })

  it('auto-splits the script with the chosen text model and inherits the module image model', async () => {
    const { host, view } = await renderWorkspace()
    const auto = view.container.querySelector('[data-segment-auto]') as HTMLButtonElement
    // 未选文本模型时不能拆段（宿主没有可用的默认文本模型）
    expect(auto.disabled).toBe(true)

    const textModel = view.container.querySelector('[data-script-text-model]') as HTMLSelectElement
    await waitFor(() => { expect([...textModel.options].map(option => option.value)).toContain('fake::fake-text') })
    fireEvent.change(textModel, { target: { value: 'fake::fake-text' } })

    const imagePicker = view.container.querySelector('[data-script-selectors] [data-model-picker="image"] select') as HTMLSelectElement
    await waitFor(() => { expect([...imagePicker.options].some(option => option.value !== '')).toBe(true) })
    const imageModel = [...imagePicker.options].find(option => option.value !== '')!.value
    fireEvent.change(imagePicker, { target: { value: imageModel } })

    fireEvent.change(view.container.querySelector('[data-episode-script]') as HTMLTextAreaElement, {
      target: { value: '第一场：雨夜街头\n\n第二场：清晨客厅' },
    })
    fireEvent.click(auto)

    await waitFor(() => { expect(host.episodes[0]?.segments).toHaveLength(3) })
    const created = host.episodes[0]?.segments.slice(1) ?? []
    expect(created.map(segment => segment.promptText)).toEqual(['第一场：雨夜街头', '第二场：清晨客厅'])
    expect(created.every(segment => segment.imageModel === imageModel)).toBe(true)
    expect(view.container.textContent).toContain(en.scriptSplitDone.replace('{n}', '2'))
  })

  it('gives a manually added segment the module image model', async () => {
    const { host, view } = await renderWorkspace()
    const imagePicker = view.container.querySelector('[data-script-selectors] [data-model-picker="image"] select') as HTMLSelectElement
    await waitFor(() => { expect([...imagePicker.options].some(option => option.value !== '')).toBe(true) })
    const imageModel = [...imagePicker.options].find(option => option.value !== '')!.value
    fireEvent.change(imagePicker, { target: { value: imageModel } })

    fireEvent.click(view.container.querySelector('[data-segment-add]') as HTMLElement)
    await waitFor(() => { expect(host.episodes[0]?.segments).toHaveLength(2) })
    expect(host.episodes[0]?.segments[1]?.imageModel).toBe(imageModel)
  })

  it('adds an episode reference, inserts [@n] into the prompt, and reorders it', async () => {
    const { host, view } = await renderWorkspace({
      resourceRefs: [{ resourceId: 'res-1', category: 'role', order: 1 }],
      assetRefs: [{ assetId: 'ast-1', category: 'ungrouped', order: 1 }],
    })
    const picker = view.container.querySelector('[data-segment-ref-add="seg-1"]') as HTMLSelectElement
    fireEvent.change(picker, { target: { value: 'resource:res-1' } })
    await waitFor(() => {
      expect(view.container.querySelector('[data-ref-chip="res-1"][data-ref-owner="segment:seg-1"]')).toBeTruthy()
    })
    // 顺序号 chip 点击 → 提示词追加 [@1]
    fireEvent.click(view.container.querySelector('[data-ref-token="1"]') as HTMLElement)
    await waitFor(() => {
      expect((view.container.querySelector('[data-segment-prompt="seg-1"]') as HTMLTextAreaElement).value).toContain('[@1]')
    })
    // 再加素材，并把素材上移成第 1 个引用
    fireEvent.change(view.container.querySelector('[data-segment-ref-add="seg-1"]') as HTMLSelectElement, { target: { value: 'asset:ast-1' } })
    await waitFor(() => {
      expect(view.container.querySelector('[data-ref-chip="ast-1"][data-ref-owner="segment:seg-1"]')).toBeTruthy()
    })
    fireEvent.click(view.container.querySelector('[data-ref-chip="ast-1"] [data-ref-up="1"]') as HTMLElement)
    await waitFor(() => {
      const firstChip = view.container.querySelector('[data-ref-owner="segment:seg-1"]')
      expect(firstChip?.getAttribute('data-ref-chip')).toBe('ast-1')
      expect(host.episodes[0]?.segments[0]?.refs[0]?.id).toBe('ast-1')
    })
  })
})
