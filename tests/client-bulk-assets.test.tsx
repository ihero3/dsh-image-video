// @vitest-environment jsdom
/**
 * 素材面刷新（Track A / A152）：一次把 outputs 目录里的产物全部登记进来，
 * 并顺带合并重复记录，而不是让用户分三个按钮各做一半。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Workbench } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import { clientProps, cleanup, fakeApi, refreshAssets, render } from './client-fake-api.ts'

afterEach(cleanup)

describe('asset pane refresh (A152)', () => {
  it('registers every pending output and merges duplicates in one click', async () => {
    const host = fakeApi({})
    host.projects.push({
      schemaVersion: 1, id: 'prj-1', name: '批量登记',
      createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
    })
    const spy = vi.fn(async (input: { items: readonly unknown[] }) => ({ created: input.items.length, assets: [] }))
    ;(host.api as unknown as { attachAssets: typeof spy }).attachAssets = spy
    const view = render(<Workbench {...clientProps({ api: host.api })} />)

    fireEvent.click(await refreshAssets(view.container))
    await waitFor(() => { expect(spy).toHaveBeenCalledTimes(1) })
    const payload = spy.mock.calls[0]![0] as { projectId: string; items: unknown[] }
    expect(payload.projectId).toBe('prj-1')
    expect(payload.items).toHaveLength(2)
    expect(host.calls).toContain('maintenance/compact')
  })
})
