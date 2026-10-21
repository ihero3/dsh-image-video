// @vitest-environment jsdom
/**
 * 批量登记最新产物（Track A / A152）：一次登记全部未登记产物，而不是"点一次一个"。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, render } from './client-fake-api.ts'

afterEach(cleanup)

describe('bulk asset registration (A152)', () => {
  it('registers every pending output in a single call', async () => {
    const host = fakeApi({})
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '批量登记',
      createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
    })
    const spy = vi.fn(async () => ({ created: 2, assets: [] }))
    ;(host.api as unknown as { attachAssets: typeof spy }).attachAssets = spy
    render(<Workbench {...clientProps({ api: host.api })} />)

    // 按钮上直接显示"还剩几个未登记"
    const button = await screen.findByRole('button', { name: `${en.attachAll} (2)` })
    fireEvent.click(button)
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    const payload = spy.mock.calls[0]![0] as { projectId: string; items: unknown[] }
    expect(payload.projectId).toBe('prj-1')
    expect(payload.items).toHaveLength(2)
  })
})
