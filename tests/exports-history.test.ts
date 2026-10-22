/** Export history (A-11): bounded append-only telemetry, filterable by project. */
import { describe, expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ExportHistory } from '../src/workbench/exports.ts'

async function history() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-exports-'))
  return new ExportHistory({ directory })
}

describe('ExportHistory', () => {
  it('records a queued export, then updates it to succeeded', async () => {
    const lib = await history()
    const started = await lib.start({ projectId: 'p1', timelineId: 't1' })
    expect(started.status).toBe('queued')
    expect(await lib.list()).toHaveLength(1)

    const done = await lib.update(started.id, { status: 'succeeded', outputPath: '/o/out.mp4', bytes: 1234, elapsedSeconds: 8 })
    expect(done?.status).toBe('succeeded')
    const [entry] = await lib.list('p1')
    expect(entry?.outputPath).toBe('/o/out.mp4')
    expect(entry?.bytes).toBe(1234)
  })

  it('filters by project and keeps newest first', async () => {
    const lib = await history()
    await lib.start({ projectId: 'p1', timelineId: 't1' })
    await lib.start({ projectId: 'p2', timelineId: 't2' })
    expect(await lib.list('p1')).toHaveLength(1)
    expect(await lib.list('p2')).toHaveLength(1)
    expect(await lib.list()).toHaveLength(2)
    expect((await lib.list())[0]!.projectId).toBe('p2')
  })

  it('records failures with a reason and tolerates a corrupt file', async () => {
    const lib = await history()
    const started = await lib.start({ projectId: 'p1', timelineId: 't1' })
    const failed = await lib.update(started.id, { status: 'failed', error: 'ffmpeg 超时' })
    expect(failed?.error).toBe('ffmpeg 超时')
    expect(await lib.update('exp-nope', { status: 'failed' })).toBeUndefined()

    const { writeFile } = await import('node:fs/promises')
    const directory = await mkdtemp(join(tmpdir(), 'dsh-exports-'))
    await writeFile(join(directory, 'exports.json'), 'not json')
    expect(await new ExportHistory({ directory }).list()).toEqual([])
  })
})
