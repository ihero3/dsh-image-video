// @vitest-environment jsdom
/**
 * `B-6` 模型能力卡面板：加载 `models/catalog` 并渲染卡片；`consistencyIssues` 非空时照实提示。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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
