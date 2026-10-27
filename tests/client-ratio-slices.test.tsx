// @vitest-environment jsdom
/**
 * `B-5` 成片多比例切片面板：选画幅 → 调 `timelines/render-ratios` → 展示各比例尺寸与 jobs。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { RatioSlicesPanel } from '../src/client/panels/RatioSlicesPanel.tsx'
import { en } from '../src/client/locales.ts'
import type { WorkbenchLocaleKey } from '../src/client/locales.ts'
import { cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

const t = (k: WorkbenchLocaleKey) => en[k]

describe('RatioSlicesPanel (B-5)', () => {
  it('renders a hint when no timeline is selected', () => {
    const host = fakeApi()
    render(<RatioSlicesPanel api={host.api} t={t} timelineId={undefined} />)
    expect(screen.getByText(en.ratioSlicesNeedsTimeline)).toBeTruthy()
  })

  it('exports the picked ratios and shows resulting dimensions', async () => {
    const host = fakeApi()
    render(<RatioSlicesPanel api={host.api} t={t} timelineId="tml-1" projectId="prj-1" />)
    // 默认已勾选 9:16；再勾 1:1 与 4:3
    fireEvent.click(screen.getByLabelText(en.ratioSquare1x1))
    fireEvent.click(screen.getByLabelText(en.ratioClassic4x3))
    fireEvent.click(screen.getByText(en.ratioSlicesRun))
    await waitFor(() => expect(host.ratioPayloads).toHaveLength(1))
    expect(host.ratioPayloads[0]!.ratios).toEqual(['9:16', '1:1', '4:3'])
    // 短边不变：9:16=720×1280、1:1=720×720、4:3=960×720
    expect(screen.getByText('9:16 · 720×1280')).toBeTruthy()
    expect(screen.getByText('1:1 · 720×720')).toBeTruthy()
    expect(screen.getByText('4:3 · 960×720')).toBeTruthy()
  })

  it('refuses to run with no ratio picked', async () => {
    const host = fakeApi()
    render(<RatioSlicesPanel api={host.api} t={t} timelineId="tml-1" projectId="prj-1" />)
    // 默认就勾了 9:16；点一次取消唯一勾选 → picked 为空 → 守卫拦截
    fireEvent.click(screen.getByLabelText(en.ratioPortrait9x16))
    fireEvent.click(screen.getByText(en.ratioSlicesRun))
    expect(host.ratioPayloads).toHaveLength(0)
  })
})
