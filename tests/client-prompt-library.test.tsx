// @vitest-environment jsdom
/**
 * M4「提示词·分镜」标签页：本集素材（≤8 张图）→ 逆向 Skill 提取 → 可编辑 → 存入本集提示词库
 * → 一键带入生成表单 / 删除。
 *
 * 只用假宿主验证界面行为，重点覆盖「提取不可用时如实报错、不伪造结果」与
 * 「只列本集提示词」两条契约。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import type { PromptRecord } from '../src/client/api.ts'
import type { EpisodeRecord } from '../src/workbench/episodes.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const STAMP = '2026-11-09T00:00:00.000Z'

/** 一集 + 两张图片素材 + 可选本集提示词种子。 */
function renderStudio(seed?: readonly PromptRecord[]) {
  const episode: EpisodeRecord = {
    schemaVersion: 1, id: 'ep-1', projectId: 'prj-1', no: 1, title: '第1集',
    script: { text: '', updatedAt: STAMP }, segments: [], storyboards: [],
    resourceRefs: [], assetRefs: [], createdAt: STAMP, updatedAt: STAMP,
  }
  const host = fakeApi({
    episodes: [episode],
    assets: [
      { schemaVersion: 4, id: 'ast-1', projectId: 'prj-1', kind: 'image', path: '/tmp/outputs/shot.png', bytes: 2048, createdAt: STAMP },
      { schemaVersion: 4, id: 'ast-2', projectId: 'prj-1', kind: 'image', path: '/tmp/outputs/wide.png', bytes: 2048, createdAt: STAMP },
    ] as never,
    prompts: seed === undefined ? undefined : [...seed],
  })
  host.projects.push({ schemaVersion: 1, id: 'prj-1', name: '提示词', createdAt: STAMP, updatedAt: STAMP } as never)
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 切到「提示词·分镜」标签页并等它挂载。 */
async function openStudio(view: ReturnType<typeof renderStudio>['view']): Promise<void> {
  await waitFor(() => { expect(view.container.querySelector('[data-quick-tab="prompt"]')).toBeTruthy() })
  fireEvent.click(view.container.querySelector('[data-quick-tab="prompt"]') as HTMLElement)
  await waitFor(() => { expect(view.container.querySelector('[data-prompt-studio="true"]')).toBeTruthy() })
}

describe('提示词·分镜标签页', () => {
  it('extracts prompts from the selected images into one editable draft', async () => {
    const { host, view } = renderStudio()
    await openStudio(view)

    fireEvent.click(view.container.querySelector('[data-studio-image="ast-1"]') as HTMLElement)
    fireEvent.click(view.container.querySelector('[data-studio-image="ast-2"]') as HTMLElement)
    expect(view.container.querySelector('[data-studio-image="ast-1"]')?.getAttribute('data-studio-active')).toBe('true')

    fireEvent.click(view.container.querySelector('[data-studio-extract="true"]') as HTMLElement)
    await waitFor(() => { expect(host.extractInputs).toHaveLength(2) })
    expect(host.extractInputs[0]).toMatchObject({ path: '/tmp/outputs/shot.png' })

    // 每张图拼成一段，按选择顺序用空行分隔
    const draft = view.container.querySelector('[data-studio-draft="true"]') as HTMLTextAreaElement
    await waitFor(() => {
      expect(draft.value.split('\n\n')).toHaveLength(2)
      expect(draft.value).toContain('a courier in the rain')
    })
  })

  it('saves the draft into the episode prompt library and applies it to the generate form', async () => {
    const { host, view } = renderStudio()
    await openStudio(view)

    const draft = view.container.querySelector('[data-studio-draft="true"]') as HTMLTextAreaElement
    fireEvent.change(draft, { target: { value: '柔和电影感人像' } })
    fireEvent.change(view.container.querySelector('[data-studio-name="true"]') as HTMLInputElement, {
      target: { value: 'Portrait' },
    })
    fireEvent.click(view.container.querySelector('[data-studio-save="true"]') as HTMLElement)

    await waitFor(() => { expect(host.prompts).toHaveLength(1) })
    expect(host.prompts[0]).toMatchObject({ name: 'Portrait', text: '柔和电影感人像', projectId: 'prj-1', episodeId: 'ep-1' })

    await waitFor(() => { expect(view.container.querySelector('[data-studio-prompt]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-studio-prompt-apply]') as HTMLElement)
    const promptBox = view.container.querySelector('[data-generate-prompt="true"]') as HTMLTextAreaElement
    await waitFor(() => { expect(promptBox.value).toBe('柔和电影感人像') })
  })

  it('only lists prompts belonging to the current episode and removes one', async () => {
    const { host, view } = renderStudio([
      { id: 'prm-ep', name: '本集', text: '本集提示词', episodeId: 'ep-1' },
      { id: 'prm-other', name: '别的集', text: '别的集提示词', episodeId: 'ep-2' },
    ])
    await openStudio(view)

    await waitFor(() => { expect(view.container.querySelector('[data-studio-prompt="prm-ep"]')).toBeTruthy() })
    expect(view.container.querySelector('[data-studio-prompt="prm-other"]')).toBeNull()

    fireEvent.click(view.container.querySelector('[data-studio-prompt-remove="prm-ep"]') as HTMLElement)
    await waitFor(() => { expect(host.prompts.some(record => record.id === 'prm-ep')).toBe(false) })
    await waitFor(() => { expect(view.container.querySelector('[data-studio-prompt="prm-ep"]')).toBeNull() })
  })

  it('reports extraction failure honestly and never fabricates a draft', async () => {
    const { host, view } = renderStudio()
    await openStudio(view)

    fireEvent.click(view.container.querySelector('[data-studio-image="ast-1"]') as HTMLElement)
    vi.spyOn(host.api, 'extractPrompt').mockRejectedValueOnce(new Error('vision model unavailable'))
    fireEvent.click(view.container.querySelector('[data-studio-extract="true"]') as HTMLElement)

    await waitFor(() => {
      expect((document.querySelector('.iv-notice')?.textContent ?? '')).toContain('vision model unavailable')
    })
    const draft = view.container.querySelector('[data-studio-draft="true"]') as HTMLTextAreaElement
    expect(draft.value).toBe('')
  })

  it('caps the input sources at eight images', async () => {
    const { view } = renderStudio()
    await openStudio(view)
    expect(view.container.querySelector('[data-studio-sources]')).toBeTruthy()
    // 假宿主只有两张图，上限提示只校验选择计数文案
    fireEvent.click(view.container.querySelector('[data-studio-image="ast-1"]') as HTMLElement)
    expect(screen.getByText(/1\/8/)).toBeTruthy()
  })
})
