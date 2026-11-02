// @vitest-environment jsdom
/**
 * `B-6` 模型能力卡面板：加载 `models/catalog` 并渲染卡片；`consistencyIssues` 非空时照实提示。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { ModelCardsPanel } from '../src/client/panels/ModelCardsPanel.tsx'
import { en } from '../src/client/locales.ts'
import type { WorkbenchLocaleKey } from '../src/client/locales.ts'
import { cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const t = (k: WorkbenchLocaleKey) => en[k]

describe('ModelCardsPanel (B-6)', () => {
  it('loads and renders model cards from the catalog', async () => {
    const host = fakeApi()
    render(<ModelCardsPanel api={host.api} t={t} />)
    await waitFor(() => expect(screen.getByText('Model One')).toBeTruthy())
    expect(screen.getByText('Model Two')).toBeTruthy()
    // 能力矩阵里的特性标签也要出现（图生视频 / 参考视频），两张卡各出现一次
    expect(screen.getAllByText(en.modelCardImageToVideo)).toHaveLength(2)
    expect(screen.getAllByText(en.modelCardReferenceVideo)).toHaveLength(2)
  })

  it('surfaces a drift warning when consistencyIssues is non-empty', async () => {
    const host = fakeApi()
    host.api.modelsCatalog = async () => ({
      cards: [],
      consistencyIssues: ['card X drifted from runtime'],
    })
    render(<ModelCardsPanel api={host.api} t={t} />)
    await waitFor(() => expect(screen.getByText(/drifted from runtime/i)).toBeTruthy())
  })

  it('shows the empty hint when no cards are returned', async () => {
    const host = fakeApi()
    host.api.modelsCatalog = async () => ({ cards: [], consistencyIssues: [] })
    render(<ModelCardsPanel api={host.api} t={t} />)
    await waitFor(() => expect(screen.getByText(en.modelCardsEmpty)).toBeTruthy())
  })
})

describe('ModelCardsPanel 实时可用性（真实校验，不伪造）', () => {
  const probeBase = { attemptedAt: '2026-11-02T10:00:00.000Z', ok: true, ids: ['m1', 'm2'] }

  it('按服务商目录逐卡标注：列出 / 未列出 / 无法校验', async () => {
    const host = fakeApi({
      modelLive: {
        probe: { ...probeBase, ok: false, ids: [], reason: 'HTTP 404' },
        targets: {
          m1: { status: 'available' },
          m2: { status: 'missing', detail: '服务商模型目录里没有这个 id' },
        },
      },
    })
    render(<ModelCardsPanel api={host.api} t={t} />)
    await waitFor(() => expect(screen.getByText(en.modelLiveAvailable)).toBeTruthy())
    expect(screen.getByText(en.modelLiveMissing)).toBeTruthy()
    // 探测失败时如实说明原因，而不是继续显示"已校验"
    expect(screen.getByText(new RegExp(en.modelLiveProbeFailed))).toBeTruthy()
    expect(screen.getByText(/HTTP 404/)).toBeTruthy()
  })

  it('刷新按钮要求宿主现场重探（refresh=true），不是再读静态清单', async () => {
    const host = fakeApi({
      modelLive: { probe: probeBase, targets: { m1: { status: 'available' }, m2: { status: 'available' } } },
    })
    render(<ModelCardsPanel api={host.api} t={t} />)
    await waitFor(() => expect(screen.getAllByText(en.modelLiveAvailable)).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: '↻' }))
    await waitFor(() => expect(host.calls).toContain('models/catalog?refresh'))
  })
})
