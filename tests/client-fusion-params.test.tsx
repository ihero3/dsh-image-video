// @vitest-environment jsdom
/**
 * `B-3`（A-3）融合生图参数化：姿态 / 镜头 / 风格备注 / 场景裁剪，全部透传给 `media/compose`；
 * 裁剪框非法（越界/过小）时由宿主 `normalizeComposeCrop` 校验，UI 响亮报错且不透传，绝不静默丢参数。
 *
 * 端点由 Track A 的 A-3 落地；本文件只用假宿主验证**界面行为**：参数透传与裁剪兜底。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

/** 造一条资源记录（参考图走 `assetPaths`）。 */
function resource(id: string, kind: 'role' | 'scene' | 'prop', name: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1, id, projectId: 'prj-1', kind, name, scope: 'project',
    createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z',
    ...extra,
  }
}

/** 一个项目 + 一个角色（带参考图），足以让融合面板渲染。 */
function renderFusion() {
  const host = fakeApi()
  host.projects.push({
    schemaVersion: 1, id: 'prj-1', name: '融合',
    createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z',
  })
  host.resources.push(resource('res-role', 'role', '林萧', { assetPaths: ['/tmp/outputs/face-a.png'] }))
  const view = render(<Workbench {...clientProps({ api: host.api })} />)
  return { host, view }
}

/** 等融合面板的素材 chip 出现（资源列表是异步加载的）。 */
async function waitForChips(view: ReturnType<typeof renderFusion>['view']): Promise<void> {
  await waitFor(() => { expect(view.container.querySelector('[data-fusion-pick="res-role"]')).toBeTruthy() })
}

describe('B-3 fusion params (A-3)', () => {
  it('passes pose / lens / style note / valid crop scene to media/compose', async () => {
    const { host, view } = renderFusion()
    await waitForChips(view)

    // 选姿态 + 镜头预设
    fireEvent.click(view.container.querySelector('[data-pose="standing"]') as HTMLElement)
    fireEvent.click(view.container.querySelector('[data-lens="wide"]') as HTMLElement)
    // 风格备注
    fireEvent.change(view.container.querySelector('[data-compose-style="true"]') as HTMLTextAreaElement, {
      target: { value: '电影感冷色调，低饱和' },
    })
    // 开启裁剪（默认框 0.1/0.1/0.8/0.8 合法）
    fireEvent.click(view.container.querySelector('[data-crop-enable="true"]') as HTMLElement)
    fireEvent.change(view.container.querySelector('[data-fusion-prompt="true"]') as HTMLTextAreaElement, {
      target: { value: '林萧站立于雨夜街头' },
    })
    fireEvent.click(view.container.querySelector('[data-fusion-run="true"]') as HTMLElement)

    await waitFor(() => { expect(host.composePayloads).toHaveLength(1) })
    const payload = host.composePayloads[0] as {
      pose?: string; lens?: string; styleNote?: string; cropScene?: { x: number; y: number; width: number; height: number }
    }
    expect(payload).toMatchObject({
      pose: 'standing',
      lens: 'wide',
      styleNote: '电影感冷色调，低饱和',
      cropScene: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    })
    // 成功后完成提示
    await waitFor(() => { expect(screen.getByRole('status').textContent).toContain(en.fusionDone) })
  })

  it('rejects an illegal crop box and does not send media/compose', async () => {
    const { host, view } = renderFusion()
    await waitForChips(view)

    fireEvent.click(view.container.querySelector('[data-crop-enable="true"]') as HTMLElement)
    // 四边全设成 0.01：宽高小于 0.05 下限，应被宿主校验拒绝
    for (const field of ['x', 'y', 'width', 'height'] as const) {
      fireEvent.change(view.container.querySelector(`[data-crop-field="${field}"]`) as HTMLInputElement, {
        target: { value: '0.01' },
      })
    }
    fireEvent.change(view.container.querySelector('[data-fusion-prompt="true"]') as HTMLTextAreaElement, {
      target: { value: '测试裁剪框' },
    })
    fireEvent.click(view.container.querySelector('[data-fusion-run="true"]') as HTMLElement)

    // 不调用合成（参数被守住，没丢掉也没发出）
    expect(host.composePayloads).toHaveLength(0)
    // 报错条出现 + 状态栏复述错误文案
    await waitFor(() => { expect(view.container.querySelector('[data-crop-error="true"]')).toBeTruthy() })
    expect(screen.getByRole('status').textContent).toContain(en.fusionCropInvalid)
  })
})
