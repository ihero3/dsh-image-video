/**
 * R9 收尾端到端（Track A）：把"单点都测过了、但串起来没测过"的路径补上。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { RenderService } from '../src/media/render.ts'
import { RenderRegistry } from '../src/media/render-registry.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { exportProjectPackage, importProjectPackage, inspectProjectPackage } from '../src/workbench/package.ts'

const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}
async function makeVideo(directory: string): Promise<string> {
  const out = join(directory, 'src.mp4')
  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
      '-i', 'testsrc=size=320x240:rate=30:duration=2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', out],
      error => { error === null ? resolve() : reject(error) })
  })
  return out
}

describe('one export produces the full quartet (R9)', () => {
  it('emits video + sidecar subtitles + thumbnail + summary together', async () => {
    const work = await temp('dsh-e2e-work-')
    const outputs = await temp('dsh-e2e-out-')
    const source = await makeVideo(work)
    const service = new RenderService({ outputsDir: outputs })
    const timeline = {
      schemaVersion: 4, id: 'tml-e2e', projectId: 'prj-1', name: '四件套', frameRate: 30, burnSubtitles: true,
      exportFormat: { width: 1080, height: 1920, frameRate: 30, bitrateKbps: 4000 },
      tracks: [
        { id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: source, startMs: 0, durationMs: 2000 }] },
        { id: 's1', kind: 'subtitle', language: 'zh', clips: [{ id: 's', text: '四件套测试', startMs: 0, durationMs: 900 }] },
      ],
      createdAt: '', updatedAt: '',
    } as never
    const result = await service.render(timeline, { subtitleFormat: 'vtt' })
    // ① 成片 ② 随片字幕 ③ 缩略图
    expect(result.outputPath.endsWith('.mp4')).toBe(true)
    expect(result.subtitlePath?.endsWith('.vtt')).toBe(true)
    expect(result.thumbnailPath?.endsWith('-thumb.jpg')).toBe(true)
    // ④ 摘要（经 registry 走一遍真实任务）
    const registry = new RenderRegistry({ render: service })
    const job = registry.start(timeline as never)
    await new Promise<void>((resolve, reject) => {
      const timer = setInterval(() => {
        const current = registry.get(job.id)
        if (current === undefined) return
        if (current.status === 'succeeded' || current.status === 'failed') { clearInterval(timer); resolve() }
      }, 50)
      setTimeout(() => { clearInterval(timer); reject(new Error('导出超时')) }, 30_000)
    })
    const finished = registry.get(job.id)!
    expect(finished.status).toBe('succeeded')
    expect(finished.summary?.thumbnailFile).toContain('-thumb.jpg')
    // 经 registry 的这次导出用的是默认格式（srt）；vtt 由上面直接调用 render 验证
    expect(finished.summary?.subtitleFile).toContain('.srt')
    expect(finished.summary?.format).toMatchObject({ width: 1080, height: 1920 })
  }, 90_000)
})

describe('package round-trip: export → inspect → verify → import (R9)', () => {
  it('survives the whole chain and lands in a fresh store', async () => {
    const dataDir = await temp('dsh-e2e-pkg-')
    const store = new WorkbenchStore({ directory: dataDir })
    const project = await store.createProject('端到端项目')
    await store.saveTimeline({
      projectId: project.id, tracks: [{ id: 'v1', kind: 'video', clips: [] }], burnLanguage: 'zh',
    })
    const targetDir = await temp('dsh-e2e-pkg-out-')
    await exportProjectPackage({ store, projectId: project.id, targetDir })

    const plain = await inspectProjectPackage({ packageDir: targetDir, store })
    expect(plain.compatible).toBe(true)
    const verified = await inspectProjectPackage({ packageDir: targetDir, store, verifyFiles: true })
    expect(verified.verified).toBe(true)

    const fresh = new WorkbenchStore({ directory: await temp('dsh-e2e-fresh-') })
    const imported = await importProjectPackage({ store: fresh, packageDir: targetDir, outputsDir: await temp('dsh-e2e-imp-out-') })
    const reopened = await fresh.listTimelines(imported.projectId)
    expect(reopened.length).toBe(1)
    expect(reopened[0]?.burnLanguage).toBe('zh') // A53 修过的字段，端到端再验一次
  }, 60_000)
})

describe('concurrent queue states stay consistent (R9)', () => {
  it('keeps running/queued/cancelled mutually consistent', async () => {
    const outputs = await temp('dsh-e2e-queue-')
    const gates: Array<{ resolve: (value: { outputPath: string; bytes: number; durationMs: number }) => void }> = []
    const service = {
      render: () => new Promise<{ outputPath: string; bytes: number; durationMs: number }>(resolve => { gates.push({ resolve }) }),
    } as unknown as RenderService
    const registry = new RenderRegistry({ render: service, maxConcurrent: 1 })
    const timeline = {
      schemaVersion: 4, id: 't', projectId: 'p', name: 'q', frameRate: 30, burnSubtitles: false,
      tracks: [{ id: 'v', kind: 'video', clips: [{ id: 'c', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1 }] }],
      createdAt: '', updatedAt: '',
    } as never
    const first = registry.start(timeline)
    const second = registry.start(timeline)
    const third = registry.start(timeline)
    // 状态互斥：只有 first 在跑，另两个排队
    expect(registry.get(first.id)?.status).toBe('running')
    expect(registry.get(first.id)?.queued).toBeFalsy()
    expect(registry.get(second.id)?.queued).toBe(true)
    expect(registry.get(third.id)?.queued).toBe(true)
    // 取消排队中的 second → 它变 cancelled，队列里不再有它
    expect(registry.cancel(second.id)).toBe(true)
    expect(registry.get(second.id)?.status).toBe('cancelled')
    expect(registry.get(third.id)?.queuePosition).toBe(1)
    // 放行 first → third 被拉起
    gates[0]!.resolve({ outputPath: join(outputs, 'x.mp4'), bytes: 1, durationMs: 1 })
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(registry.get(first.id)?.status).toBe('succeeded')
    expect(registry.get(third.id)?.status).toBe('running')
  }, 30_000)
})
