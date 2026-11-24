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
import type { SkillRecord } from '../src/workbench/skills.ts'

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
async function renderWorkspace(options: Parameters<typeof episode>[0] & { skills?: readonly SkillRecord[] } = {}) {
  const host = fakeApi({
    episodes: [episode(options)],
    assets: [asset('ast-1', '/tmp/outputs/ref.png'), asset('ast-2', '/tmp/outputs/clip.mp4', 'video')],
    ...options.skills === undefined ? {} : { skills: options.skills },
  })
  host.projects.push(project() as never)
  host.resources.push(resource('res-1', '主角'))
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  fireEvent.click(await screen.findByRole('button', { name: en.modeScript }))
  await waitFor(() => { expect(view.container.querySelector('[data-episode-workspace="ep-1"]')).toBeTruthy() })
  return { host, view }
}

describe('本集工作区（剧本 → 分段 → 分镜）', () => {
  it('separates the segment action row from the model and skill selectors', async () => {
    const { view } = await renderWorkspace()
    expect(view.container.querySelector('[data-script-selectors] + .iv-sb-segment-head')).toBeTruthy()
  })

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

  it('keeps the episode total equal to the sum of all segment durations, including new segments', async () => {
    const { host, view } = await renderWorkspace()
    const total = () => Number((view.container.querySelector('[data-episode-duration]') as HTMLElement)
      .getAttribute('data-episode-total-seconds'))
    expect(total()).toBe(5)

    fireEvent.click(view.container.querySelector('[data-segment-duration="60"]') as HTMLElement)
    await waitFor(() => { expect(total()).toBe(60) })

    fireEvent.click(view.container.querySelector('[data-segment-add]') as HTMLElement)
    await waitFor(() => {
      const durations = host.episodes[0]?.segments.map(candidate => candidate.durationSec) ?? []
      expect(total()).toBe(durations.reduce((sum, value) => sum + value, 0))
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

  it('splits storyboard shots so their durations sum exactly to the segment duration', async () => {
    const { host, view } = await renderWorkspace({ segments: [segment('seg-1', 1, { durationSec: 5 })] })
    fireEvent.click(view.container.querySelector('[data-segment-plan="seg-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelectorAll('[data-shot]').length).toBe(2) })
    const durations = host.episodes[0]?.storyboards[0]?.shots.map(shot => shot.durationSec) ?? []
    expect(durations.reduce((sum, value) => sum + value, 0)).toBe(5)
    expect(durations).toEqual([3, 2]) // 余数给靠前镜头
  })

  it('changing segment duration redistributes shot durations and keeps the sum equal', async () => {
    const { host, view } = await renderWorkspace({
      segments: [segment('seg-1', 1, { durationSec: 5 })],
      storyboards: [storyboard('seg-1', [shot('shot-1', 1), shot('shot-2', 2)])],
    })
    fireEvent.click(view.container.querySelector('[data-segment-duration="60"]') as HTMLElement)
    await waitFor(() => {
      const durations = host.episodes[0]?.storyboards[0]?.shots.map(item => item.durationSec) ?? []
      expect(durations.reduce((sum, value) => sum + value, 0)).toBe(60)
      expect(host.episodes[0]?.segments[0]?.durationSec).toBe(60)
    })
    // 两个镜头平分 60 → 各 30
    expect(host.episodes[0]?.storyboards[0]?.shots.map(item => item.durationSec)).toEqual([30, 30])
  })

  it('changing one shot duration makes the segment duration follow the sum of all shots', async () => {
    const { host, view } = await renderWorkspace({
      segments: [segment('seg-1', 1, { durationSec: 6 })],
      storyboards: [storyboard('seg-1', [shot('shot-1', 1, { durationSec: 3 }), shot('shot-2', 2, { durationSec: 3 })])],
    })
    const input = view.container.querySelector('[data-shot-duration="shot-1"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.blur(input)
    await waitFor(() => {
      expect(host.episodes[0]?.segments[0]?.durationSec).toBe(13) // 10 + 3
      const durations = host.episodes[0]?.storyboards[0]?.shots.map(item => item.durationSec) ?? []
      expect(durations.reduce((sum, value) => sum + value, 0)).toBe(13)
    })
  })

  it('adding or removing a shot redistributes durations so sum stays equal to the segment', async () => {
    const { host, view } = await renderWorkspace({
      segments: [segment('seg-1', 1, { durationSec: 6 })],
      storyboards: [storyboard('seg-1', [shot('shot-1', 1, { durationSec: 3 }), shot('shot-2', 2, { durationSec: 3 })])],
    })
    // 加一镜：6 秒 / 3 = 各 2 秒
    fireEvent.click(view.container.querySelector('[data-shot-add="seg-1"]') as HTMLElement)
    await waitFor(() => {
      const durations = host.episodes[0]?.storyboards[0]?.shots.map(item => item.durationSec) ?? []
      expect(durations).toEqual([2, 2, 2])
    })
    // 删一镜（删掉原来的 shot-1）：剩 2 镜，6 秒重新平分 → 各 3 秒
    fireEvent.click(view.container.querySelector('[data-shot-remove="shot-1"]') as HTMLElement)
    await waitFor(() => {
      const durations = (host.episodes[0]?.storyboards[0]?.shots ?? []).map(item => item.durationSec)
      expect(durations).toEqual([3, 3])
      const sum = durations.reduce((total, value) => total + value, 0)
      expect(sum).toBe(host.episodes[0]?.segments[0]?.durationSec)
      expect(sum).toBe(6)
    })
  })

  it('generates a shot image with episode/segment/shot attribution', async () => {
    const { host, view } = await renderWorkspace({
      storyboards: [storyboard('seg-1', [shot('shot-1', 1), shot('shot-2', 2)])],
    })
    // 逐镜生成按钮与分段操作按钮共用同一套 action 样式
    for (const selector of ['[data-shot-generate-image="shot-1"]', '[data-shot-generate-video="shot-1"]']) {
      const button = view.container.querySelector(selector) as HTMLElement
      expect(button.classList.contains('iv-btn--action')).toBe(true)
      expect(button.classList.contains('iv-btn--action--soft')).toBe(true)
    }
    fireEvent.click(view.container.querySelector('[data-shot-generate-image="shot-2"]') as HTMLElement)
    await waitFor(() => { expect(host.generatePayloads.length).toBe(1) })
    expect(host.generatePayloads[0]).toMatchObject({
      mediaMode: 'image', prompt: '图片 2', episodeId: 'ep-1', segmentId: 'seg-1', shotId: 'shot-2',
    })
    await waitFor(() => { expect(view.container.textContent).toContain(en.shotImageDone.replace('{n}', '2')) })
  })

  it('分镜的模型标签、下拉、生成按钮同处一行容器（标签不再独占一行）', async () => {
    const { view } = await renderWorkspace({
      storyboards: [storyboard('seg-1', [shot('shot-1', 1)])],
    })
    // 图像模型与视频模型各自是一个紧凑行容器，标签 span 与下拉、按钮都在其中
    for (const [selectSel, buttonSel, label] of [
      ['[data-shot-image-model="shot-1"]', '[data-shot-generate-image="shot-1"]', en.generateImageModel],
      ['[data-shot-video-model="shot-1"]', '[data-shot-generate-video="shot-1"]', en.generateVideoModel],
    ] as const) {
      const select = view.container.querySelector(selectSel) as HTMLElement
      const button = view.container.querySelector(buttonSel) as HTMLElement
      const row = select.closest('.iv-shot-tool-row') as HTMLElement
      expect(row, selectSel).not.toBeNull()
      expect(row.contains(button)).toBe(true)
      expect(row.textContent).toContain(label)
      // 旧结构里把标签包成 iv-sb-field 导致独占一行，新结构不再有
      expect(row.querySelector('.iv-sb-field')).toBeNull()
    }
  })

  it('分镜提示词与模型行按「图片提示词→图像模型→视频提示词→视频模型」交替排列', async () => {
    const { view } = await renderWorkspace({
      storyboards: [storyboard('seg-1', [shot('shot-1', 1)])],
    })
    const main = view.container.querySelector('.iv-shot-prompt-main') as HTMLElement
    expect(main).not.toBeNull()
    const order = Array.from(main.children).map(child => (
      child.classList.contains('iv-sb-field') ? 'field'
        : child.classList.contains('iv-shot-tool-row') ? 'tool' : 'other'
    ))
    // 每组提示词输入紧跟着自己的模型/生成按钮行，不出现标签独占一行或两组间距不一致
    expect(order).toEqual(['field', 'tool', 'field', 'tool'])
    expect(main.querySelectorAll(':scope > .iv-sb-field')).toHaveLength(2)
    expect(main.querySelectorAll(':scope > .iv-shot-tool-row')).toHaveLength(2)
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
    // 无引用时右侧只保留添加按钮，不占额外宽度
    const promptRow = view.container.querySelector('.iv-shot-prompt-row') as HTMLElement
    expect(promptRow.classList.contains('iv-shot-prompt-row--with-refs')).toBe(false)
    expect(view.container.querySelector('[data-shot-refs="shot-1"]')).toBeNull()
    expect(promptRow.querySelector('[data-shot-image-prompt="shot-1"]')).toBeTruthy()
    expect(promptRow.querySelector('[data-shot-video-prompt="shot-1"]')).toBeTruthy()

    fireEvent.click(view.container.querySelector('[data-shot-ref-add="shot-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-ref-picker="shot-1"]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-ref-picker="shot-1"] [data-ref-option="asset:ast-1"]') as HTMLElement)
    await waitFor(() => {
      expect(host.episodes[0]?.storyboards[0]?.shots[0]?.refs[0]).toMatchObject({ kind: 'asset', id: 'ast-1', order: 1 })
      // 有引用后列表出现在添加按钮下方，和两段提示词同处一行
      const row = view.container.querySelector('.iv-shot-prompt-row') as HTMLElement
      const addButton = view.container.querySelector('[data-shot-ref-add="shot-1"]') as HTMLElement
      const refsBlock = view.container.querySelector('[data-shot-refs="shot-1"]') as HTMLElement
      expect(row.classList.contains('iv-shot-prompt-row--with-refs')).toBe(true)
      expect(refsBlock?.closest('.iv-shot-ref-side')).toBeTruthy()
      expect(addButton.compareDocumentPosition(refsBlock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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

  it('imports an episode.json into a new episode without touching the current one', async () => {
    const { host, view } = await renderWorkspace()
    const input = view.container.querySelector('[data-episode-import-file="true"]') as HTMLInputElement
    const manifest = {
      plugin: 'dsh-image-video', formatVersion: 2, exportedAt: STAMP, projectId: 'prj-1',
      episode: { id: 'ep-source', no: 0, title: '导入的集', script: '导入剧本', durationSec: 0 },
      segments: [], storyboards: [], resourceRefs: [], assetRefs: [], files: [], missing: [],
    }
    const file = new File([JSON.stringify(manifest)], 'episode.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(host.calls).toContain('episodes/import')
      expect(host.episodes.some(item => item.title === '导入的集')).toBe(true)
      expect(view.container.textContent).toContain(en.episodeImportDone.replace('{no}', '2').replace('{title}', '导入的集'))
    })
  })

  it('starts splitting by default rules without needing a text model', async () => {
    const { host, view } = await renderWorkspace({ segments: [] })
    const auto = view.container.querySelector('[data-segment-auto]') as HTMLButtonElement
    // 剧本为空时不能分段
    expect(auto.disabled).toBe(true)
    fireEvent.change(view.container.querySelector('[data-episode-script]') as HTMLTextAreaElement, {
      target: { value: '第一场：雨夜街头\n\n第二场：清晨客厅' },
    })
    // 默认按规则分段：没有文本模型也能开始分段
    expect(auto.disabled).toBe(false)
    fireEvent.click(auto)

    await waitFor(() => { expect(host.episodes[0]?.segments).toHaveLength(2) })
    const created = host.episodes[0]?.segments ?? []
    expect(created.map(segment => segment.promptText)).toEqual(['第一场：雨夜街头', '第二场：清晨客厅'])
    expect(view.container.textContent).toContain(en.scriptSplitDone.replace('{n}', '2'))
  })

  it('重新分段是重建而非追加：再点一次不会复制内容、不会多出分段', async () => {
    const { host, view } = await renderWorkspace({ segments: [] })
    const script = () => view.container.querySelector('[data-episode-script]') as HTMLTextAreaElement
    const auto = () => view.container.querySelector('[data-segment-auto]') as HTMLButtonElement
    // 用户现场：一段多行的剧本（没有空行分隔），不应凭空多出内容
    const source = '等等阿斯特拉和希芬爆旦法\n可以啊，可以啊。'
    fireEvent.change(script(), { target: { value: source } })
    fireEvent.blur(script())
    await waitFor(() => { expect(host.episodes[0]?.script.text).toContain('阿斯特拉') })

    // 第一次分段：得到 1 段
    fireEvent.click(auto())
    await waitFor(() => { expect(host.episodes[0]?.segments).toHaveLength(1) })
    const first = (host.episodes[0]?.segments ?? [])[0]?.promptText

    // 再点一次「开始分段」：仍是 1 段，内容不翻倍
    fireEvent.click(auto())
    await waitFor(() => {
      expect(host.episodes[0]?.segments).toHaveLength(1)
      expect((host.episodes[0]?.segments ?? [])[0]?.promptText).toBe(first)
    })
    // 剧本框展示的分段文本也不重复
    const editor = script().value
    expect(editor.split('阿斯特拉').length - 1).toBe(1)
    expect(editor).not.toContain('可以啊，可以啊。\n\n等等阿斯特拉')
    expect(host.episodes[0]?.script.text?.split('阿斯特拉').length).toBe(2)
  })

  it('splits with the chosen text model when a real model replaces default rules', async () => {
    const { host, view } = await renderWorkspace({ segments: [] })
    const auto = () => view.container.querySelector('[data-segment-auto]') as HTMLButtonElement
    expect(auto().disabled).toBe(true)
    // 分段方式和文本模型合并成一个下拉：默认规则不调 AI，选真实模型才调模型。
    expect(view.container.querySelector('[data-script-split-mode]')).toBeNull()
    const modelSelect = view.container.querySelector('[data-script-text-model]') as HTMLSelectElement
    expect([...modelSelect.options].map(option => option.value)).toContain('rules')
    await waitFor(() => { expect([...modelSelect.options].map(option => option.value)).toContain('fake::fake-text') })

    fireEvent.change(view.container.querySelector('[data-episode-script]') as HTMLTextAreaElement, {
      target: { value: '第一场：雨夜街头\n\n第二场：清晨客厅' },
    })
    fireEvent.change(modelSelect, { target: { value: 'fake::fake-text' } })
    expect(auto().disabled).toBe(false)

    fireEvent.click(auto())
    await waitFor(() => { expect(host.episodes[0]?.segments).toHaveLength(2) })
    expect(view.container.textContent).toContain(en.scriptSplitDone.replace('{n}', '2'))
  })

  it('shows all segment prompts in the large editor and syncs edits back, creating a new segment', async () => {
    const { host, view } = await renderWorkspace({
      segments: [
        segment('seg-1', 1, { promptText: '第一场' }),
        segment('seg-2', 2, { promptText: '第二场', durationSec: 10 }),
      ],
    })
    const script = view.container.querySelector('[data-episode-script]') as HTMLTextAreaElement
    expect(script.rows).toBe(10)
    expect(script.value).toBe('第一场\n\n第二场')
    const jump = view.container.querySelector('[data-episode-script-jump]') as HTMLSelectElement
    expect([...jump.options].map(option => option.value)).toContain('seg-2')

    fireEvent.change(script, { target: { value: '改第一场\n\n改第二场\n\n新第三场' } })
    await waitFor(() => {
      expect((view.container.querySelector('[data-segment-prompt="seg-1"]') as HTMLTextAreaElement).value).toBe('改第一场')
      expect((view.container.querySelector('[data-segment-prompt="seg-2"]') as HTMLTextAreaElement).value).toBe('改第二场')
    })
    fireEvent.blur(script)
    await waitFor(() => {
      expect(host.episodes[0]?.segments.map(candidate => candidate.promptText))
        .toEqual(['改第一场', '改第二场', '新第三场'])
      expect(host.episodes[0]?.script.text).toBe('改第一场\n\n改第二场\n\n新第三场')
    })
  })

  it('inserts a director skill into the text area and restores it to the dropdown when deleted', async () => {
    const skill: SkillRecord = {
      schemaVersion: 1, id: 'skl-1', kind: 'director', name: '电影感分镜',
      description: '', prompt: '用电影镜头语言拆解', builtin: false, enabled: true,
      createdAt: STAMP, updatedAt: STAMP,
    }
    const { host, view } = await renderWorkspace({ skills: [skill] })
    const select = () => view.container.querySelector('[data-script-skill]') as HTMLSelectElement
    const script = () => view.container.querySelector('[data-episode-script]') as HTMLTextAreaElement
    expect([...select().options].map(option => option.value)).toContain('skl-1')

    fireEvent.change(select(), { target: { value: 'skl-1' } })
    await waitFor(() => {
      expect(script().value).toContain('【@电影感分镜】')
      expect([...select().options].map(option => option.value)).not.toContain('skl-1')
    })
    // token 不进模型正文，只作为界面里的技能标记
    fireEvent.click(view.container.querySelector('[data-segment-plan="seg-1"]') as HTMLElement)
    await waitFor(() => { expect(host.storyboardPayloads[0]?.script).toBe('开场') })

    fireEvent.change(script(), { target: { value: '开场' } })
    await waitFor(() => { expect([...select().options].map(option => option.value)).toContain('skl-1') })
  })

  it('picks the image model on the segment, not at module level', async () => {
    const { host, view } = await renderWorkspace()
    fireEvent.click(view.container.querySelector('[data-segment-add]') as HTMLElement)
    await waitFor(() => { expect(host.episodes[0]?.segments).toHaveLength(2) })
    const created = host.episodes[0]?.segments[1]
    expect(created?.imageModel).toBeUndefined()

    // 段级图像模型选择器直接落库到该分段
    const picker = view.container.querySelector(`[data-segment-image-model="${created?.id}"]`) as HTMLSelectElement
    await waitFor(() => { expect([...picker.options].some(option => option.value !== '')).toBe(true) })
    const imageModel = [...picker.options].find(option => option.value !== '')!.value
    fireEvent.change(picker, { target: { value: imageModel } })
    await waitFor(() => { expect(host.episodes[0]?.segments[1]?.imageModel).toBe(imageModel) })
  })

  it('adds references from the asset-only picker, inserts [@n] into the prompt, and reorders them', async () => {
    const { host, view } = await renderWorkspace()
    // 没有引用时不占右侧空间，分段提示词保持原宽度
    expect(view.container.querySelector('.iv-seg-prompt-row')?.classList.contains('iv-seg-prompt-row--with-refs')).toBe(false)
    expect(view.container.querySelector('[data-segment-refs="seg-1"]')).toBeNull()
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
      // 有引用后列表出现在「添加引用」下方，并与提示词同处一行
      const row = view.container.querySelector('.iv-seg-prompt-row') as HTMLElement
      const addButton = view.container.querySelector('[data-segment-ref-add="seg-1"]') as HTMLElement
      const refsBlock = view.container.querySelector('[data-segment-refs="seg-1"]') as HTMLElement
      expect(row.classList.contains('iv-seg-prompt-row--with-refs')).toBe(true)
      expect(refsBlock).toBeTruthy()
      expect(refsBlock.closest('.iv-seg-ref-side')).toBeTruthy()
      expect(addButton.compareDocumentPosition(refsBlock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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

  it('点击整条分段标题行都能折叠/展开，行内按钮不误触', async () => {
    const { view } = await renderWorkspace()
    const head = () => view.container.querySelector('[data-segment-head="seg-1"]') as HTMLElement
    const name = () => view.container.querySelector('[data-segment-name="seg-1"]') as HTMLElement
    const collapsed = () => view.container.querySelector('[data-segment-preview="seg-1"]') !== null

    expect(view.container.querySelector('[data-segment-toggle="seg-1"]')?.getAttribute('aria-expanded')).toBe('true')
    // 点名称（行内空白处同样在标题行上）→ 收起
    fireEvent.click(name())
    await waitFor(() => { expect(collapsed()).toBe(true) })
    expect(view.container.querySelector('[data-segment-toggle="seg-1"]')?.getAttribute('aria-expanded')).toBe('false')
    // 再点整行 → 展开
    fireEvent.click(head())
    await waitFor(() => { expect(collapsed()).toBe(false) })

    // 折叠按钮点一次只切换一次（不因冒泡到整行再切一次）
    fireEvent.click(view.container.querySelector('[data-segment-toggle="seg-1"]') as HTMLElement)
    expect(collapsed()).toBe(true)
    // 点标题行里的动作簇空白处（非按钮）仍属于整行，可切换
    fireEvent.click(view.container.querySelector('.iv-sb-seg-actions') as HTMLElement)
    expect(collapsed()).toBe(false)
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

describe('引用列表 → 右侧预览面板', () => {
  it('点分段引用的缩略图或名称，右侧直接展示图片', async () => {
    const { view } = await renderWorkspace({
      segments: [segment('seg-1', 1, { refs: [{ kind: 'asset', id: 'ast-1', order: 1 }] })],
    })
    fireEvent.click(view.container.querySelector('[data-ref-thumb="ast-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-preview-actions="image"]')).toBeTruthy() })
    expect((view.container.querySelector('.iv-dock-preview img') as HTMLImageElement).getAttribute('src'))
      .toBe('/outputs/ref.png')
    // 不再弹局部放大浮层，统一落到右侧预览
    expect(view.container.querySelector('.iv-ref-zoom')).toBeNull()

    fireEvent.click(view.container.querySelector('[data-ref-preview="asset:ast-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('.iv-dock-preview img')).toBeTruthy() })
  })

  it('点分镜的视频引用先出缩略图，点播放才在预览里播放', async () => {
    const { view } = await renderWorkspace({
      storyboards: [storyboard('seg-1', [shot('shot-1', 1, {
        refs: [{ kind: 'asset', id: 'ast-2', order: 1 }],
      })])],
    })
    fireEvent.click(view.container.querySelector('[data-ref-thumb="ast-2"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-preview-video-thumb]')).toBeTruthy() })
    expect((view.container.querySelector('[data-preview-video-thumb] video') as HTMLVideoElement).getAttribute('src'))
      .toBe('/outputs/clip.mp4#t=0.1')
    expect(view.container.querySelector('[data-preview-actions="video"]')).toBeTruthy()

    fireEvent.click(view.container.querySelector('[data-preview-play]') as HTMLElement)
    await waitFor(() => {
      const player = view.container.querySelector('.iv-dock-preview video') as HTMLVideoElement
      expect(player).toBeTruthy()
      expect(player.hasAttribute('controls')).toBe(true)
      expect(player.getAttribute('src')).toBe('/outputs/clip.mp4')
    })
  })

  it('选择器里的预览按钮只看不引用，且会收起选择器', async () => {
    const { host, view } = await renderWorkspace({
      storyboards: [storyboard('seg-1', [shot('shot-1', 1)])],
    })
    fireEvent.click(view.container.querySelector('[data-shot-ref-add="shot-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-ref-preview-option="asset:ast-1"]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-ref-preview-option="asset:ast-1"]') as HTMLElement)
    await waitFor(() => { expect(view.container.querySelector('[data-preview-actions="image"]')).toBeTruthy() })
    expect(view.container.querySelector('[data-ref-picker="shot-1"]')).toBeNull()
    expect(host.episodes[0]?.storyboards[0]?.shots[0]?.refs).toHaveLength(0)
  })
})
