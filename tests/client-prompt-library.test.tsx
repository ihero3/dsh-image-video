// @vitest-environment jsdom
/**
 * `B-10`（G1）提示词工坊 UI：选中图片 → `prompts/extract` → 可编辑 → 存入 `prompts/save`
 * → 库列表 → 一键带入生成表单 / 删除。
 *
 * 端点由 Track A 的 A-5 落地；本文件只用假宿主验证界面行为，重点覆盖
 * "提取不可用时如实报错、不伪造结果"。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import type { PromptRecord } from '../src/client/api.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 一个项目 + 一张图片素材 + 可选提示词库种子。 */
function renderPromptStudio(seed?: readonly PromptRecord[]) {
  const host = fakeApi({
    assets: [{
      schemaVersion: 4, id: 'ast-1', projectId: 'prj-1', kind: 'image',
      path: '/tmp/outputs/shot.png', bytes: 2048, createdAt: '2026-10-22T00:00:00.000Z',
    }] as never,
    prompts: seed === undefined ? undefined : [...seed],
  })
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '提示词',
    createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z',
  })
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 选中某张素材（点素材行主按钮）。 */
async function selectImage(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: `${en.panePreview} ${name}` }))
}

/** 等提示词工坊挂载。 */
async function waitForStudio(view: ReturnType<typeof renderPromptStudio>['view']): Promise<void> {
  await waitFor(() => { expect(view.container.querySelector('[data-prompt-extract="true"]')).toBeTruthy() })
}

describe('B-10 prompt studio (G1)', () => {
  it('extracts a structured prompt from the selected image into an editable draft', async () => {
    const { host, view } = renderPromptStudio()
    await waitForStudio(view)

    await selectImage('shot.png')
    fireEvent.click(view.container.querySelector('[data-prompt-extract="true"]') as HTMLElement)

    await waitFor(() => { expect(host.extractInputs).toHaveLength(1) })
    expect(host.extractInputs[0]).toMatchObject({ projectId: 'prj-1', assetId: 'ast-1' })
    const draft = view.container.querySelector('[data-prompt-draft="true"]') as HTMLTextAreaElement
    // 主体 → 风格 → 材质 → 细节（缺字段跳过）
    await waitFor(() => {
      expect(draft.value).toBe('a courier in the rain, cinematic, neon reflections, shallow depth of field')
    })
  })

  it('saves the edited draft to the library and applies it to the generate form', async () => {
    const { host, view } = renderPromptStudio()
    await waitForStudio(view)

    const draft = view.container.querySelector('[data-prompt-draft="true"]') as HTMLTextAreaElement
    fireEvent.change(draft, { target: { value: '柔和电影感人像' } })
    fireEvent.change(view.container.querySelector('[data-prompt-name="true"]') as HTMLInputElement, {
      target: { value: 'Portrait' },
    })
    fireEvent.click(view.container.querySelector('[data-prompt-save="true"]') as HTMLElement)

    await waitFor(() => { expect(host.prompts).toHaveLength(1) })
    expect(host.prompts[0]).toMatchObject({ name: 'Portrait', text: '柔和电影感人像' })

    // 库里出现这一条，点「带入」写进生成表单的提示词框
    await waitFor(() => { expect(view.container.querySelector('[data-prompt-item]')).toBeTruthy() })
    fireEvent.click(view.container.querySelector('[data-prompt-apply]') as HTMLElement)
    const promptBox = view.container.querySelector('[data-generate-prompt="true"]') as HTMLTextAreaElement
    await waitFor(() => { expect(promptBox.value).toBe('柔和电影感人像') })
  })

  it('loads the library on mount and removes an entry', async () => {
    const { host, view } = renderPromptStudio([{ id: 'prm-seed', name: 'Seed', text: 'seed prompt' }])
    await waitFor(() => { expect(view.container.querySelector('[data-prompt-item="prm-seed"]')).toBeTruthy() })

    fireEvent.click(view.container.querySelector('[data-prompt-remove="prm-seed"]') as HTMLElement)
    await waitFor(() => { expect(host.prompts).toHaveLength(0) })
    await waitFor(() => { expect(view.container.querySelector('[data-prompt-item="prm-seed"]')).toBeNull() })
  })

  it('reports extraction failure honestly and never fabricates a draft', async () => {
    const { host, view } = renderPromptStudio()
    await waitForStudio(view)
    await selectImage('shot.png')
    vi.spyOn(host.api, 'extractPrompt').mockRejectedValueOnce(new Error('vision model unavailable'))

    fireEvent.click(view.container.querySelector('[data-prompt-extract="true"]') as HTMLElement)

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('vision model unavailable')
    })
    const draft = view.container.querySelector('[data-prompt-draft="true"]') as HTMLTextAreaElement
    expect(draft.value).toBe('')
  })
})
