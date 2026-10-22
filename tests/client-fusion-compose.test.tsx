// @vitest-environment jsdom
/**
 * `B-9`（G3）融合生图 UI：选角色 / 场景 / 物品 → 本地参考图预览 → 调 `media/compose`。
 *
 * 端点由 Track A 的 A-4 落地；本文件只用假宿主验证**界面行为**：
 * 分组下发资源 id、参考图预览去重封顶、空选降级提示、宿主未实现时如实报错。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 造一条资源记录（参考图走 `assetPaths`）。 */
function resource(
  id: string,
  kind: 'role' | 'scene' | 'prop',
  name: string,
  extra: Record<string, unknown> = {},
) {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', kind, name, scope: 'project',
    createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z',
    ...extra,
  }
}

/** 一个项目 + 角色（2 图）/ 场景（与角色共 1 图 + 自身 1 图）/ 物品（无图）。 */
function renderFusion() {
  const host = fakeApi()
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '融合',
    createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z',
  })
  host.resources.push(
    resource('res-role', 'role', '林萧', { assetPaths: ['/tmp/outputs/face-a.png', '/tmp/outputs/face-b.png'] }),
    resource('res-scene', 'scene', '雨夜街道', { assetPaths: ['/tmp/outputs/face-a.png', '/tmp/outputs/scene.png'] }),
    resource('res-prop', 'prop', '雨伞', {}),
  )
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 等融合面板的 chip 出现（资源列表是异步加载的）。 */
async function waitForChips(view: ReturnType<typeof renderFusion>['view']): Promise<void> {
  await waitFor(() => { expect(view.container.querySelector('[data-fusion-pick="res-role"]')).toBeTruthy() })
}

describe('B-9 fusion compose (G3)', () => {
  it('sends roles / scenes / props resource ids plus the prompt to media/compose', async () => {
    const { host, view } = renderFusion()
    await waitForChips(view)

    for (const id of ['res-role', 'res-scene', 'res-prop']) {
      fireEvent.click(view.container.querySelector(`[data-fusion-pick="${id}"]`) as HTMLElement)
    }
    // 选中态同步到 aria-pressed（键盘/读屏可用）
    expect(view.container.querySelector('[data-fusion-pick="res-role"]')?.getAttribute('aria-pressed')).toBe('true')

    fireEvent.change(view.container.querySelector('[data-fusion-prompt="true"]') as HTMLTextAreaElement, {
      target: { value: '林萧撑着伞站在雨夜街头' },
    })
    fireEvent.click(view.container.querySelector('[data-fusion-run="true"]') as HTMLElement)

    await waitFor(() => { expect(host.composePayloads).toHaveLength(1) })
    const payload = host.composePayloads[0] as { resourceIds?: readonly string[] }
    expect(host.composePayloads[0]).toMatchObject({
      projectId: 'prj-1',
      prompt: '林萧撑着伞站在雨夜街头',
    })
    expect([...(payload.resourceIds ?? [])].sort()).toEqual(['res-prop', 'res-role', 'res-scene'])
    // 成功后确认：素材刷新 + 完成提示
    await waitFor(() => { expect(screen.getByRole('status').textContent).toContain(en.fusionDone) })
    expect(host.assets.some(asset => asset.id === 'ast-composed')).toBe(true)
  })

  it('counts unique reference images across the selection (dedupe, ignore ref-less resources)', async () => {
    const { view } = renderFusion()
    await waitForChips(view)

    // 角色 2 张（face-a/face-b），场景 2 张（face-a/scene）——face-a 重复，去重后 3 张
    fireEvent.click(view.container.querySelector('[data-fusion-pick="res-role"]') as HTMLElement)
    fireEvent.click(view.container.querySelector('[data-fusion-pick="res-scene"]') as HTMLElement)
    fireEvent.click(view.container.querySelector('[data-fusion-pick="res-prop"]') as HTMLElement)

    await waitFor(() => {
      expect(view.container.querySelector('[data-fusion-preview="true"]')?.textContent)
        .toBe(en.fusionPreview.replace('{n}', '3'))
    })
  })

  it('says it will fall back to text-to-image when nothing carries a reference image', async () => {
    const { view } = renderFusion()
    await waitForChips(view)
    expect(view.container.querySelector('[data-fusion-preview="true"]')?.textContent).toBe(en.fusionPreviewNone)
  })

  it('surfaces the host error verbatim when media/compose is not available yet', async () => {
    const { host, view } = renderFusion()
    await waitForChips(view)
    vi.spyOn(host.api, 'composeMedia').mockRejectedValueOnce(new Error('unknown endpoint media/compose'))

    fireEvent.change(view.container.querySelector('[data-fusion-prompt="true"]') as HTMLTextAreaElement, {
      target: { value: '雨夜' },
    })
    fireEvent.click(view.container.querySelector('[data-fusion-run="true"]') as HTMLElement)

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('unknown endpoint media/compose')
    })
    // 不伪造成功：合成素材没有被登记
    expect(host.assets.some(asset => asset.id === 'ast-composed')).toBe(false)
  })
})
