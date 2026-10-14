/**
 * Generation → ledger wrapper.
 *
 * The wrapper is observational: it must record what happened, and it must never
 * fail an expensive generation because the ledger could not be written.
 */
import { describe, expect, it, vi } from 'vitest'
import { extractOutcome, withTaskLedger } from '../src/workbench/ledger.ts'
import type { TaskInput, WorkbenchStore } from '../src/workbench/store.ts'

/** Store stand-in recording what was filed. */
function fakeStore(fail = false) {
  const recorded: Array<Omit<TaskInput, 'kind'> & { kind: string }> = []
  const store = {
    async recordTask(input: TaskInput) {
      if (fail) throw new Error('disk full')
      recorded.push(input as never)
      return { id: 'tsk-1' }
    },
  } as unknown as WorkbenchStore
  return { store, recorded }
}

/** Minimal tool shaped like `defineTool`'s output. */
function tool(execute: () => Promise<unknown>) {
  return { name: 'generate_image', description: 'test', execute } as never
}

describe('extractOutcome', () => {
  it('reads provider, model, prompt, path and size from a tool result', () => {
    expect(extractOutcome({
      provider: 'threerouter', model: 'minimax-image-01', prompt: '一张图', localPath: '/tmp/outputs/a.jpg', bytes: 1024,
    })).toEqual({ provider: 'threerouter', model: 'minimax-image-01', prompt: '一张图', outputPath: '/tmp/outputs/a.jpg', bytes: 1024 })
  })

  it('accepts alternate path keys and ignores junk', () => {
    expect(extractOutcome({ outputPath: '/tmp/b.mp4', bytes: Number.NaN })).toEqual({ outputPath: '/tmp/b.mp4' })
    expect(extractOutcome('string')).toEqual({})
    expect(extractOutcome(null)).toEqual({})
  })
})

describe('withTaskLedger', () => {
  it('records a succeeded task with the tool outcome', async () => {
    const { store, recorded } = fakeStore()
    const wrapped = withTaskLedger(tool(async () => ({
      provider: 'threerouter', model: 'minimax-h3', localPath: '/tmp/outputs/clip.mp4', bytes: 4096,
    })), { store, kind: 'video' })
    const value = await wrapped.execute({} as never, {} as never)
    expect(value).toMatchObject({ model: 'minimax-h3' })
    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({
      kind: 'video', status: 'succeeded', model: 'minimax-h3', outputPath: '/tmp/outputs/clip.mp4', bytes: 4096,
    })
  })

  it('records a failed task and rethrows the original error', async () => {
    const { store, recorded } = fakeStore()
    const wrapped = withTaskLedger(tool(async () => { throw new Error('provider said no') }), { store, kind: 'image' })
    await expect(wrapped.execute({} as never, {} as never)).rejects.toThrow('provider said no')
    expect(recorded[0]).toMatchObject({ kind: 'image', status: 'failed', error: 'provider said no' })
  })

  it('never fails the generation when the ledger cannot be written', async () => {
    const { store } = fakeStore(true)
    const onError = vi.fn()
    const wrapped = withTaskLedger(tool(async () => ({ provider: 'threerouter' })), { store, kind: 'image', onError })
    await expect(wrapped.execute({} as never, {} as never)).resolves.toEqual({ provider: 'threerouter' })
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('disk full'))
  })
})
