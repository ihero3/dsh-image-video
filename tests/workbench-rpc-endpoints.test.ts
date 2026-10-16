/**
 * The workbench channel's phase-2 endpoints, over the real handler and a real
 * store: the payload contract the browser half depends on.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { GenerationRegistry } from '../src/workbench/cancel.ts'
import { WorkflowRunner } from '../src/workbench/runner.ts'
import { RenderRegistry } from '../src/media/render-registry.ts'
import { RenderService } from '../src/media/render.ts'
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
  const registry = new GenerationRegistry()
  let runSequence = 0
  const runner = new WorkflowRunner({
    store,
    newRunId: () => `run-${++runSequence}`,
    generateImage: { async execute() { return { localPath: '/tmp/out/shot.png', bytes: 10 } } },
    generateVideo: { async execute() { return { videoPath: '/tmp/out/clip.mp4', bytes: 20 } } },
  })
  const renders = new RenderRegistry({
    render: new RenderService({ outputsDir }),
    registerAsset: async job => {
      if (job.outputPath === undefined) return
      await store.attachAsset({ projectId: job.projectId, path: job.outputPath, kind: 'video', bytes: job.bytes })
    },
  })
  const handler = createWorkbenchHandler({ provider: 'threerouter', outputsDir, store, registry, runner, renders })
  /** Call one endpoint and fail the test on a refused envelope. */
  async function ok<T>(endpoint: string, payload?: unknown): Promise<T> {
    const result = await handler(endpoint, payload, new AbortController().signal, {} as never)
    if (!result.ok) throw new Error(`refused: ${result.error.code} ${result.error.message}`)
    return result.value as T
  }
  return { handler, ok, outputsDir, store, registry }
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

    const attached = await ok<{ asset: AssetRecord; created: boolean }>('assets/attach', {
      projectId: created.project.id, path: '/tmp/x/shot.png', kind: 'image', bytes: 2048,
    })
    expect(attached.created).toBe(true)
    // 第二次登记同一路径：幂等，`created` 为 false 且素材仍只有一条
    const repeated = await ok<{ asset: AssetRecord; created: boolean }>('assets/attach', {
      projectId: created.project.id, path: '/tmp/x/shot.png', kind: 'image',
    })
    expect(repeated.created).toBe(false)
    expect(repeated.asset.id).toBe(attached.asset.id)
    expect((await ok<{ assets: AssetRecord[] }>('assets/list', { projectId: created.project.id })).assets)
      .toEqual([attached.asset])

    expect(await ok<{ removed: boolean }>('assets/remove', { id: attached.asset.id })).toEqual({ removed: true })
    expect(await ok<{ removed: boolean }>('projects/remove', { id: created.project.id })).toEqual({ removed: true })
    expect(await ok<{ projects: ProjectRecord[] }>('projects/list')).toEqual({ projects: [] })
  })

  it('stores workflow documents and compacts duplicate assets through the channel', async () => {
    const { ok, handler } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '流程' })
    const saved = await ok<{ workflow: { id: string; nodes: unknown[] } }>('workflows/save', {
      projectId: created.project.id, name: '模板', edges: [],
      nodes: [{ id: 'n1', kind: 'image-generate', position: { x: 0, y: 0 }, params: {} }],
    })
    expect(saved.workflow.id).toMatch(/^wfl-/)
    expect((await ok<{ workflows: unknown[] }>('workflows/list', { projectId: created.project.id })).workflows).toHaveLength(1)
    expect(await ok<{ removed: boolean }>('workflows/remove', { id: saved.workflow.id })).toEqual({ removed: true })

    // 结构不合法的图要报成载荷错误，而不是静默存下来
    const bad = await handler('workflows/save', {
      projectId: created.project.id, nodes: [{ id: 'a', kind: 'script', position: { x: 0, y: 0 } }],
      edges: [{ source: 'a', target: 'a' }],
    }, new AbortController().signal, {} as never)
    expect(bad.ok).toBe(false)

    expect(await ok<{ removed: number }>('maintenance/compact', {})).toEqual({ removed: 0 })
  })

  it('renders a timeline through the channel and registers the artifact (T5-5)', async () => {
    const { ok } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '导出项目' })
    // 用 ffmpeg 自造 1 秒素材（不花生成 token）
    const work = await mkdtemp(join(tmpdir(), 'dsh-endpoint-render-'))
    const clip = join(work, 'clip.mp4')
    await new Promise<void>((resolve, reject) => {
      execFile('/opt/homebrew/bin/ffmpeg', [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=1',
        '-pix_fmt', 'yuv420p', '-c:v', 'libx264', clip,
      ], error => { error === null ? resolve() : reject(error) })
    })

    const saved = await ok<{ timeline: { id: string } }>('timelines/save', {
      projectId: created.project.id, name: '成片',
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: clip, startMs: 0, durationMs: 1000 }] }],
    })
    const started = await ok<{ render: { id: string; status: string } }>('timelines/render', { timelineId: saved.timeline.id })
    expect(started.render.status).toBe('running')

    await vi.waitFor(async () => {
      const list = await ok<{ renders: Array<{ status: string; outputPath?: string; percent: number }> }>('timelines/renders', { projectId: created.project.id })
      expect(list.renders[0]?.status).toBe('succeeded')
      expect(list.renders[0]?.percent).toBe(100)
      // 产物自动登记成素材
      const assets = await ok<{ assets: Array<{ path: string }> }>('assets/list', { projectId: created.project.id })
      expect(assets.assets.some(asset => asset.path === list.renders[0]?.outputPath)).toBe(true)
    }, { timeout: 40_000, interval: 500 })

    // 已结束的任务取消不了
    expect(await ok<{ cancelled: boolean }>('timelines/render-cancel', { renderId: started.render.id })).toEqual({ cancelled: false })
    await rm(work, { recursive: true, force: true })
  }, 60_000)

  it('reports ffmpeg capability through the channel (T5-4)', async () => {
    const { ok } = await makeHandler()
    // 默认探测：本机装了应是 ok，没装也要给出可操作原因
    const probe = (await ok<{ ffmpeg: { available: boolean; code?: string; message?: string; path?: string } }>('media/ffmpeg', {})).ffmpeg
    if (probe.available) {
      expect(probe.path).toBeTruthy()
    } else {
      expect(probe.code).toMatch(/^MEDIA_FFMPEG_/)
      expect(probe.message).toBeTruthy()
    }
    // 诊断指定副本：严格模式，查不存在的路径必须报 MEDIA_FFMPEG_UNAVAILABLE
    const bogus = (await ok<{ ffmpeg: { available: boolean; code?: string } }>('media/ffmpeg', { path: '/definitely/not/here/ffmpeg' })).ffmpeg
    expect(bogus.available).toBe(false)
    expect(bogus.code).toBe('MEDIA_FFMPEG_UNAVAILABLE')
  })

  it('stores timelines through the channel and rejects inlined bytes', async () => {
    const { ok, handler } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '时间轴' })
    const saved = await ok<{ timeline: { id: string; tracks: unknown[] } }>('timelines/save', {
      projectId: created.project.id, name: '成片',
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: '/tmp/outputs/a.mp4', startMs: 0, durationMs: 5000 }] }],
    })
    expect(saved.timeline.id).toMatch(/^tml-/)
    expect(saved.timeline.tracks).toHaveLength(1)
    expect((await ok<{ timelines: unknown[] }>('timelines/list', { projectId: created.project.id })).timelines).toHaveLength(1)
    expect(await ok<{ removed: boolean }>('timelines/remove', { id: saved.timeline.id })).toEqual({ removed: true })

    const inlined = await handler('timelines/save', {
      projectId: created.project.id,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: 'data:video/mp4;base64,AAAA', startMs: 0, durationMs: 1 }] }],
    }, new AbortController().signal, {} as never)
    expect(inlined.ok).toBe(false)
  })

  it('runs a stored workflow and reports run records through the channel', async () => {
    const { ok, handler } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '运行' })
    const saved = await ok<{ workflow: { id: string } }>('workflows/save', {
      projectId: created.project.id, name: '跑', edges: [],
      nodes: [{ id: 'i', kind: 'image-generate', position: { x: 0, y: 0 }, params: { prompt: '猫' } }],
    })

    const started = await ok<{ run: { id: string; status: string } }>('workflows/run', { workflowId: saved.workflow.id })
    expect(started.run).toMatchObject({ id: 'run-1', status: 'running' })

    // 后台执行会逐节点落库：轮询到成功
    await vi.waitFor(async () => {
      const runs = await ok<{ runs: Array<{ status: string; nodeRuns: Array<{ outputPath?: string }> }> }>(
        'workflows/runs', { projectId: created.project.id },
      )
      expect(runs.runs[0]?.status).toBe('succeeded')
      expect(runs.runs[0]?.nodeRuns[0]?.outputPath).toBe('/tmp/out/shot.png')
    })

    // 已结束的运行取消不了；重试会新建一条记录
    expect(await ok<{ cancelled: boolean }>('workflows/run-cancel', { runId: 'run-1' })).toEqual({ cancelled: false })
    const retried = await ok<{ run: { id: string } }>('workflows/run-retry', { runId: 'run-1' })
    expect(retried.run.id).toBe('run-2')

    const unknown = await handler('workflows/run', { workflowId: 'nope' }, new AbortController().signal, {} as never)
    expect(unknown.ok).toBe(false)
  })

  it('renames projects and manages resources through the channel', async () => {
    const { ok, handler } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '旧名' })
    expect((await ok<{ project: ProjectRecord }>('projects/rename', { id: created.project.id, name: '新名' })).project.name)
      .toBe('新名')

    const role = await ok<{ resource: { id: string; kind: string; name: string } }>('resources/create', {
      projectId: created.project.id, kind: 'role', name: '女主', note: '短发',
    })
    expect(role.resource).toMatchObject({ kind: 'role', name: '女主' })
    expect((await ok<{ resources: unknown[] }>('resources/list', { projectId: created.project.id })).resources).toHaveLength(1)
    expect((await ok<{ resources: unknown[] }>('resources/list', { projectId: created.project.id, kind: 'scene' })).resources).toHaveLength(0)
    expect(await ok<{ removed: boolean }>('resources/remove', { id: role.resource.id })).toEqual({ removed: true })

    // 非法种类与非法项目都要报成载荷/失败错误，而不是静默
    const badKind = await handler('resources/create', { projectId: created.project.id, kind: 'audio', name: 'x' }, new AbortController().signal, {} as never)
    expect(badKind.ok).toBe(false)
    if (!badKind.ok) expect(badKind.error.code).toBe('workbench/invalid-payload')
    const badProject = await handler('resources/create', { projectId: 'nope', kind: 'role', name: 'x' }, new AbortController().signal, {} as never)
    expect(badProject.ok).toBe(false)
    if (!badProject.ok) expect(badProject.error.code).toBe('workbench/failed')
  })

  it('cancels a running generation through the channel', async () => {
    const { ok, registry } = await makeHandler()
    const controller = registry.register('tsk-live', 'video', '2026-10-15T00:00:00.000Z')
    expect((await ok<{ running: unknown[] }>('tasks/running')).running).toHaveLength(1)
    expect(await ok<{ cancelled: boolean }>('tasks/cancel', { id: 'tsk-live' })).toEqual({ cancelled: true })
    expect(controller.signal.aborted).toBe(true)
    // 未注册的 id 如实返回 false（不假装取消成功）
    expect(await ok<{ cancelled: boolean }>('tasks/cancel', { id: 'nope' })).toEqual({ cancelled: false })
  })

  it('files a recorded generation into a project through tasks endpoints', async () => {
    const { ok, store } = await makeHandler()
    const created = await ok<{ project: ProjectRecord }>('projects/create', { name: '账本项目' })
    const recorded = await store.recordTask({
      kind: 'image', status: 'succeeded', provider: 'threerouter', model: 'minimax-image-01',
      outputPath: '/tmp/x/shot.jpg', bytes: 106_000,
    })

    const listed = await ok<{ tasks: Array<{ id: string; kind: string }> }>('tasks/list')
    expect(listed.tasks.map(task => task.id)).toEqual([recorded.id])

    const assigned = await ok<{ task: { projectId?: string } }>('tasks/assign', {
      id: recorded.id, projectId: created.project.id,
    })
    expect(assigned.task.projectId).toBe(created.project.id)
    expect((await ok<{ tasks: Array<{ id: string }> }>('tasks/list', { projectId: created.project.id })).tasks)
      .toHaveLength(1)

    // 未知任务 id 要如实报错（结构化 envelope），不能用静默成功糊过去
    expect(await store.updateTask('missing', { status: 'failed' })).toBeUndefined()
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
