// @vitest-environment jsdom
/**
 * M2：本集工作区（剧本 → 分段 → 分镜 → 就地生成）。
 *
 * 覆盖：剧本失焦保存、分段时长快捷、分段提示词拆镜落库、逐镜编辑与按镜生成、
 * 分段折叠/展开、引用选择面板（图片/视频 + 缩略图 + 搜索）、引用 chip 与 `[@n]` 插入、
 * 一键生成图片/视频、镜头级模型选择与生成按钮。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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

function asset(id: string, path: string, kind: AssetRecord['kind'] = 'image'): AssetRecord {
  return {
    schemaVersion: 4, id, projectId: 'prj-1', kind, path, bytes: 2048,
    createdAt: STAMP,
  } as AssetRecord
}

/** 挂载到「剧本生成」页的「本集工作区」出现为止。 */
async function renderWorkspace(options: Parameters<typeof episode>[0] = {}) {
  const host = fakeApi({
    episodes: [episode(options)],
    assets: [asset('ast-1', '/tmp/outputs/ref.png'), asset('ast-2', '/tmp/outputs/clip.mp4', 'video')],
  })
  host.projects.push(project() as never)
  host.resources.push(resource('res-1', '主角'))
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeScript }))
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

  it('changes the segment duration with a preset and keeps 30/60/180 available', async () => {
    const { host, view } = await renderWorkspace()
    const preset = view.container.querySelector('[data-segment-duration="60"]') as HTMLElement
    expect(preset.textContent).toBe('60s')
    fireEvent.click(preset)
    await waitFor(() => {
      expect(host.episodes[0]?.segments[0]?.durationSec).toBe(60)
      expect((view.container.querySelector('[data-segment-duration-input="seg-1"]') as HTMLInputElement).value).toBe('60')
    })
    expect([...view.container.querySelectorAll('[data-segment-duration]')].map(button => button.textContent))
      .toEqual(['30s', '60s', '180s'])
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
    fireEvent.click(view.container.querySelector('[data-shot-ref-add="shot-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-ref-picker="shot-1"]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-ref-picker="shot-1"] [data-ref-option="asset:ast-1"]') as HTMLElement)
    await waitFor(() => {
      expect(host.episodes[0]?.storyboards[0]?.shots[0]?.refs[0]).toMatchObject({ kind: 'asset', id: 'ast-1', order: 1 })
      // 同一素材不会重复出现在选择器里
      expect(view.container.querySelector('[data-ref-picker="shot-1"] [data-ref-option="asset:ast-1"]')).toBeNull()
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

  it('adds references from the asset-only picker, inserts [@n] into the prompt, and reorders them', async () => {
    const { host, view } = await renderWorkspace()
    // 选择器常驻，但只列素材库里的图片与视频；剧集资源（角色/场景）不再混进来
    fireEvent.click(view.container.querySelector('[data-segment-ref-add="seg-1"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-ref-picker="seg-1"]')).toBeTruthy()
      expect(view.container.querySelector('[data-ref-option="resource:res-1"]')).toBeNull()
      expect(view.container.querySelector('[data-ref-option="asset:ast-1"]')).toBeTruthy()
      expect(view.container.querySelector('[data-ref-option="asset:ast-2"]')).toBeTruthy()
    })
    // 分组与缩略图：图片用 <img>、视频用 <video> 抽帧，自动命名的文件靠画面辨认
    expect(view.container.textContent).toContain(en.segmentRefImages)
    expect(view.container.textContent).toContain(en.segmentRefVideos)
    expect(view.container.querySelector('[data-ref-option="asset:ast-1"] img')?.getAttribute('src')).toBe('/outputs/ref.png')
    expect(view.container.querySelector('[data-ref-option="asset:ast-2"] video')?.getAttribute('src')).toBe('/outputs/clip.mp4#t=0.1')
    fireEvent.click(view.container.querySelector('[data-ref-option="asset:ast-1"]') as HTMLElement)
    fireEvent.click(view.container.querySelector('[data-ref-option="asset:ast-2"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-ref-chip="ast-1"][data-ref-owner="segment:seg-1"]')).toBeTruthy()
      expect(view.container.querySelector('[data-ref-chip="ast-2"][data-ref-owner="segment:seg-1"]')).toBeTruthy()
      // 选过的项从候选消失
      expect(view.container.querySelector('[data-ref-option="asset:ast-1"]')).toBeNull()
      expect(view.container.querySelector('[data-ref-option="asset:ast-2"]')).toBeNull()
    })
    // 顺序号 chip 点击 → 提示词追加 [@1]
    fireEvent.click(view.container.querySelector('[data-ref-token="1"]') as HTMLElement)
    await waitFor(() => {
      expect((view.container.querySelector('[data-segment-prompt="seg-1"]') as HTMLTextAreaElement).value).toContain('[@1]')
    })
    // 视频上移成第 1 个引用，顺序号重新编号并落库
    fireEvent.click(view.container.querySelector('[data-ref-chip="ast-2"] [data-ref-up="1"]') as HTMLElement)
    await waitFor(() => {
      const firstChip = view.container.querySelector('[data-ref-owner="segment:seg-1"]')
      expect(firstChip?.getAttribute('data-ref-chip')).toBe('ast-2')
      expect(host.episodes[0]?.segments[0]?.refs[0]?.id).toBe('ast-2')
      expect(view.container.querySelector('[data-ref-chip="ast-2"] [data-ref-token="1"]')?.textContent).toBe('[@1]')
      expect(view.container.querySelector('[data-ref-chip="ast-1"] [data-ref-token="2"]')?.textContent).toBe('[@2]')
    })
  })

  it('collapses a segment to a prompt preview and expands it back, keeping delete last', async () => {
    const { view } = await renderWorkspace()
    // 行内动作顺序：上移、下移、折叠切换，删除在最右
    const actions = view.container.querySelector('.iv-sb-seg-actions') as HTMLElement
    const order = [...actions.querySelectorAll('button')].map(button => {
      if (button.getAttribute('data-segment-toggle') !== null) return 'toggle'
      if (button.getAttribute('data-segment-remove') !== null) return 'remove'
      return 'move'
    })
    expect(order).toEqual(['move', 'move', 'toggle', 'remove'])

    fireEvent.click(view.container.querySelector('[data-segment-toggle="seg-1"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-segment-preview="seg-1"]')?.textContent).toBe('开场')
      expect(view.container.querySelector('[data-segment-prompt="seg-1"]')).toBeNull()
      expect(view.container.querySelector('[data-segment-toggle="seg-1"]')?.getAttribute('aria-expanded')).toBe('false')
    })

    fireEvent.click(view.container.querySelector('[data-segment-toggle="seg-1"]') as HTMLElement)
    await waitFor(() => {
      expect(view.container.querySelector('[data-segment-preview="seg-1"]')).toBeNull()
      expect(view.container.querySelector('[data-segment-prompt="seg-1"]')).toBeTruthy()
    })
  })

  it('filters picker candidates by search and closes on Escape or outside click', async () => {
    const { view } = await renderWorkspace()
    fireEvent.click(view.container.querySelector('[data-segment-ref-add="seg-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-ref-picker-search="seg-1"]')).toBeTruthy() })
    const search = view.container.querySelector('[data-ref-picker-search="seg-1"]') as HTMLInputElement

    fireEvent.change(search, { target: { value: 'ref' } })
    await waitFor(() => {
      expect(view.container.querySelector('[data-ref-option="asset:ast-1"]')).toBeTruthy()
      expect(view.container.querySelector('[data-ref-option="asset:ast-2"]')).toBeNull()
      expect(view.container.querySelector('[data-ref-option="resource:res-1"]')).toBeNull()
    })
    fireEvent.change(search, { target: { value: 'zzz' } })
    await waitFor(() => { expect(view.container.querySelector('[data-ref-picker-empty="seg-1"]')).toBeTruthy() })
    fireEvent.change(search, { target: { value: 'mp4' } })
    await waitFor(() => {
      expect(view.container.querySelector('[data-ref-option="asset:ast-2"]')).toBeTruthy()
      expect(view.container.querySelector('[data-ref-option="asset:ast-1"]')).toBeNull()
    })

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => { expect(view.container.querySelector('[data-ref-picker="seg-1"]')).toBeNull() })

    fireEvent.click(view.container.querySelector('[data-segment-ref-add="seg-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-ref-picker="seg-1"]')).toBeTruthy() })
    fireEvent.mouseDown(document.body)
    await waitFor(() => { expect(view.container.querySelector('[data-ref-picker="seg-1"]')).toBeNull() })
  })

  it('generates every shot at once — images from the image button, videos queued from the video button', async () => {
    const { host, view } = await renderWorkspace({
      storyboards: [storyboard('seg-1', [
        shot('shot-1', 1, { imageModel: 'fake-image@fake' }),
        shot('shot-2', 2),
      ])],
    })
    fireEvent.click(view.container.querySelector('[data-segment-generate-all-images="seg-1"]') as HTMLElement)
    await waitFor(() => { expect(host.generatePayloads.filter(payload => payload.mediaMode === 'image')).toHaveLength(2) })
    const images = host.generatePayloads.filter(payload => payload.mediaMode === 'image')
    expect(images.map(payload => payload.shotId)).toEqual(['shot-1', 'shot-2'])
    // 镜头自己的模型优先，没选就跟随模块默认
    expect(images[0]?.model).toBe('fake-image@fake')
    expect(images[1]?.model).toBeUndefined()
    await waitFor(() => {
      expect(view.container.textContent)
        .toContain(en.segmentGenerateAllImagesDone.replace('{done}', '2').replace('{total}', '2'))
    })

    fireEvent.click(view.container.querySelector('[data-segment-generate-all-videos="seg-1"]') as HTMLElement)
    await waitFor(() => { expect(host.generatePayloads.filter(payload => payload.mediaMode === 'video')).toHaveLength(2) })
    expect(host.generatePayloads.filter(payload => payload.mediaMode === 'video').map(payload => payload.shotId))
      .toEqual(['shot-1', 'shot-2'])
  })

  it('lets one shot override the image model and regenerate just that shot', async () => {
    const { host, view } = await renderWorkspace({
      storyboards: [storyboard('seg-1', [shot('shot-1', 1), shot('shot-2', 2)])],
    })
    const modelPicker = view.container.querySelector('[data-shot-image-model="shot-2"]') as HTMLSelectElement
    await waitFor(() => { expect([...modelPicker.options].some(option => option.value !== '')).toBe(true) })
    const value = [...modelPicker.options].map(option => option.value).find(option => option !== '') as string
    fireEvent.change(modelPicker, { target: { value } })
    await waitFor(() => { expect(host.episodes[0]?.storyboards[0]?.shots[1]?.imageModel).toBe(value) })
    fireEvent.click(view.container.querySelector('[data-shot-generate-image="shot-2"]') as HTMLElement)
    await waitFor(() => { expect(host.generatePayloads).toHaveLength(1) })
    expect(host.generatePayloads[0]).toMatchObject({ shotId: 'shot-2', mediaMode: 'image', model: value })
    fireEvent.change(view.container.querySelector('[data-shot-video-model="shot-1"]') as HTMLSelectElement, { target: { value: '' } })
    await waitFor(() => { expect(host.episodes[0]?.storyboards[0]?.shots[0]?.videoModel).toBeUndefined() })
  })
})
