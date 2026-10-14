/**
 * Cancellation: the registry, and the ledger wrapper honouring it.
 *
 * "Cancel" has to abort the provider call, not just relabel a row — the wrapper
 * hands the tool a signal that combines the tool's own execution signal with the
 * registry's controller, so an in-flight submit/poll unwinds and the ledger ends
 * as `cancelled` rather than `failed`. The ledger also stays observational: a
 * store failure is reported, never turned into a failed generation.
 */
import { describe, expect, it, vi } from 'vitest'
import { GenerationRegistry } from '../src/workbench/cancel.ts'
import { extractOutcome, withTaskLedger } from '../src/workbench/ledger.ts'
import type { TaskInput, TaskPatch, WorkbenchStore } from '../src/workbench/store.ts'

/** Store stand-in that records how the ledger was written. */
function fakeStore(options: { failOpen?: boolean } = {}) {
  const opened: TaskInput[] = []
  const updated: Array<{ id: string; patch: TaskPatch }> = []
  const store = {
    async recordTask(input: TaskInput) {
      if (options.failOpen === true) throw new Error('disk full')
      opened.push(input)
      return { id: 'tsk-1' }
    },
    async updateTask(id: string, patch: TaskPatch) {
      updated.push({ id, patch })
      return { id }
    },
  } as unknown as WorkbenchStore
  return { store, opened, updated }
}

/** Minimal tool shaped like `defineTool`'s output. */
function tool(execute: (args: unknown, exec: unknown) => Promise<unknown>) {
  return { name: 'generate_image', description: 'test', execute } as never
}

describe('GenerationRegistry', () => {
  it('registers, cancels, releases and lists running generations', () => {
    const registry = new GenerationRegistry()
    const controller = registry.register('tsk-1', 'video', '2026-10-15T00:00:00.000Z')
    expect(registry.size).toBe(1)
    expect(registry.list()).toEqual([{ id: 'tsk-1', kind: 'video', startedAt: '2026-10-15T00:00:00.000Z' }])
    expect(controller.signal.aborted).toBe(false)

    expect(registry.cancel('tsk-1')).toBe(true)
    expect(controller.signal.aborted).toBe(true)
    expect(registry.cancel('missing')).toBe(false)

    registry.release('tsk-1')
    expect(registry.size).toBe(0)
    expect(registry.cancel('tsk-1')).toBe(false)
  })
})

describe('withTaskLedger', () => {
  it('opens the record as running and closes it as succeeded', async () => {
    const { store, opened, updated } = fakeStore()
    const registry = new GenerationRegistry()
    const wrapped = withTaskLedger(tool(async () => ({
      provider: 'threerouter', model: 'minimax-h3', localPath: '/tmp/outputs/clip.mp4', bytes: 4096,
    })), { store, registry, kind: 'video' })

    const value = await wrapped.execute({} as never, {} as never)
    expect(value).toMatchObject({ model: 'minimax-h3' })
    expect(opened[0]).toMatchObject({ kind: 'video', status: 'running' })
    expect(updated[0]?.patch).toMatchObject({
      status: 'succeeded', provider: 'threerouter', model: 'minimax-h3', outputPath: '/tmp/outputs/clip.mp4', bytes: 4096,
    })
    expect(registry.size).toBe(0)
  })

  it('closes a thrown call as failed and rethrows', async () => {
    const { store, updated } = fakeStore()
    const wrapped = withTaskLedger(tool(async () => { throw new Error('provider said no') }),
      { store, registry: new GenerationRegistry(), kind: 'image' })
    await expect(wrapped.execute({} as never, {} as never)).rejects.toThrow('provider said no')
    expect(updated[0]?.patch).toMatchObject({ status: 'failed', error: 'provider said no' })
  })

  it('files a call as cancelled when the registry is aborted mid-flight', async () => {
    const { store, updated } = fakeStore()
    const registry = new GenerationRegistry()
    const wrapped = withTaskLedger(tool(async (_args, exec) => {
      const signal = (exec as { signal?: AbortSignal }).signal
      await new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => { reject(new Error('aborted by workbench')) }, { once: true })
      })
      return {}
    }), { store, registry, kind: 'video' })

    const pending = wrapped.execute({} as never, { signal: new AbortController().signal } as never)
    await vi.waitFor(() => { expect(registry.size).toBe(1) })
    expect(registry.cancel('tsk-1')).toBe(true)
    await expect(pending).rejects.toThrow(/aborted by workbench/)
    expect(updated[0]?.patch.status).toBe('cancelled')
    expect(registry.size).toBe(0)
  })

  it('never fails the generation when the ledger cannot be written', async () => {
    const { store, updated } = fakeStore({ failOpen: true })
    const onError = vi.fn()
    const wrapped = withTaskLedger(tool(async () => ({ provider: 'threerouter' })),
      { store, registry: new GenerationRegistry(), kind: 'image', onError })
    await expect(wrapped.execute({} as never, {} as never)).resolves.toEqual({ provider: 'threerouter' })
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('disk full'))
    expect(updated).toEqual([])
  })

  it('keeps extractOutcome tolerant of unknown shapes', () => {
    expect(extractOutcome({ outputPath: '/tmp/b.mp4' })).toEqual({ outputPath: '/tmp/b.mp4' })
    expect(extractOutcome(undefined)).toEqual({})
  })
})
