/**
 * The workbench channel's phase-2 endpoints, over the real handler and a real
 * store: the payload contract the browser half depends on.
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import type { AssetRecord, ProjectRecord } from '../src/workbench/records.ts'
import type { OutputFile } from '../src/workbench/outputs.ts'

/** Handler over throwaway directories, plus a helper that unwraps the envelope. */
async function makeHandler() {
  const dataDir = await mkdtemp(join(tmpdir(), 'dsh-image-video-rpc-'))
  const outputsDir = await mkdtemp(join(tmpdir(), 'dsh-image-video-out-'))
  await writeFile(join(outputsDir, 'shot.png'), 'png')
  await writeFile(join(outputsDir, 'clip.mp4'), 'mp4')
  await writeFile(join(outputsDir, 'notes.txt'), 'ignored')
  const store = new WorkbenchStore({ directory: dataDir, now: () => new Date('2026-10-14T00:00:00.000Z') })
  const handler = createWorkbenchHandler({ provider: 'threerouter', outputsDir, store })
  /** Call one endpoint and fail the test on a refused envelope. */
  async function ok<T>(endpoint: string, payload?: unknown): Promise<T> {
    const result = await handler(endpoint, payload, new AbortController().signal, {} as never)
    if (!result.ok) throw new Error(`refused: ${result.error.code} ${result.error.message}`)
    return result.value as T
  }
  return { handler, ok, outputsDir }
}

describe('workbench channel endpoints', () => {
  it('reports health unchanged', async () => {
    const { ok } = await makeHandler()
    const health = await ok<{ version: string; provider: string; channel: string }>('health')
    expect(health.channel).toBe('/image-video')
    expect(health.provider).toBe('threerouter')
  })

  it('walks the project and asset lifecycle', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '片子' })
    expect(created.project.name).toBe('片子')

    const listed = await ok<{ projects: ProjectRecord[] }>('projects/list')
    expect(listed.projects.map(project => project.id)).toEqual([created.project.id])

    const attached = await ok<{ asset: AssetRecord }>('assets/attach', {
      projectId: created.project.id, path: '/tmp/x/shot.png', kind: 'image', bytes: 2048,
    })
    expect((await ok<{ assets: AssetRecord[] }>('assets/list', { projectId: created.project.id })).assets)
      .toEqual([attached.asset])

    expect(await ok<{ removed: boolean }>('assets/remove', { id: attached.asset.id })).toEqual({ removed: true })
    expect(await ok<{ removed: boolean }>('projects/remove', { id: created.project.id })).toEqual({ removed: true })
    expect(await ok<{ projects: ProjectRecord[] }>('projects/list')).toEqual({ projects: [] })
  })

  it('lists the newest media files and skips everything else', async () => {
    const { ok, outputsDir } = await makeHandler()
    const listed = await ok<{ outputs: OutputFile[]; directory: string }>('outputs/list', { limit: 10 })
    expect(listed.directory).toBe(outputsDir)
    expect(listed.outputs.map(file => file.name).sort()).toEqual(['clip.mp4', 'shot.png'])
    expect(listed.outputs.every(file => file.bytes > 0 && file.path.startsWith(outputsDir))).toBe(true)
  })

  it('answers a malformed payload and an unknown endpoint in the envelope', async () => {
    const { handler } = await makeHandler()
    const badPayload = await handler('projects/create', {}, new AbortController().signal, {} as never)
    expect(badPayload.ok).toBe(false)
    if (!badPayload.ok) {
      expect(badPayload.error.code).toBe('workbench/invalid-payload')
      expect(badPayload.error.message).toMatch(/name/)
    }
    const unknown = await handler('nope/nope', {}, new AbortController().signal, {} as never)
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe('workbench/unknown-endpoint')
  })
})
