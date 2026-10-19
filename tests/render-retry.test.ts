/**
 * 渲染失败自动重试（Track A / A114）：opt-in、仅瞬时失败、最多一次。
 */
import { describe, expect, it } from 'vitest'
import { RenderRegistry } from '../src/media/render-registry.ts'
import { MAX_AUTO_RETRIES, isTransientRenderFailure } from '../src/media/retry-policy.ts'
import { RenderError, type RenderService } from '../src/media/render.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const timeline = (): TimelineRecord => ({
  schemaVersion: 4, id: 'tml-retry', projectId: 'prj-1', name: '重试', frameRate: 30, burnSubtitles: false,
  tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: '/tmp/a.mp4', startMs: 0, durationMs: 1000 }] }],
  createdAt: '', updatedAt: '',
})
const ok = { outputPath: '/tmp/outputs/x.mp4', bytes: 1024, durationMs: 1000 }

/** 前 N 次抛指定错误，之后成功。 */
function flakyService(failures: number, code: string) {
  let calls = 0
  const service = {
    async render() {
      calls += 1
      if (calls <= failures) throw new RenderError(code, `boom ${calls}`)
      return ok
    },
  } as unknown as RenderService
  return { service, calls: () => calls }
}

describe('render retry policy (A114)', () => {
  it('classifies only genuinely transient failures as retryable', () => {
    expect(isTransientRenderFailure('MEDIA_OUTPUT_INVALID')).toBe(true)
    expect(isTransientRenderFailure('MEDIA_RENDER_FAILED')).toBe(true)
    expect(isTransientRenderFailure('MEDIA_RENDER_TIMEOUT')).toBe(true)
    // 重试也不会改变结果的
    expect(isTransientRenderFailure('MEDIA_ASSET_MISSING')).toBe(false)
    expect(isTransientRenderFailure('MEDIA_TIMELINE_OVERLAP')).toBe(false)
    expect(isTransientRenderFailure('MEDIA_FFMPEG_UNAVAILABLE')).toBe(false)
    expect(isTransientRenderFailure('MEDIA_RENDER_CANCELLED')).toBe(false)
    expect(isTransientRenderFailure('SOMETHING_NEW')).toBe(false)
    expect(isTransientRenderFailure(undefined)).toBe(false)
    expect(MAX_AUTO_RETRIES).toBe(1)
  })

  it('retries a transient failure once when opted in, and succeeds', async () => {
    const { service, calls } = flakyService(1, 'MEDIA_OUTPUT_INVALID')
    const registry = new RenderRegistry({ render: service })
    const job = registry.start(timeline(), { retryTransient: true })
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(calls()).toBe(2) // 第一次失败 → 自动重试一次
    expect(registry.get(job.id)?.status).toBe('succeeded')
    expect(registry.get(job.id)?.attempt).toBe(2)
  })

  it('does not retry without opt-in, nor for permanent failures', async () => {
    const optedOut = flakyService(1, 'MEDIA_OUTPUT_INVALID')
    const registryA = new RenderRegistry({ render: optedOut.service })
    const jobA = registryA.start(timeline()) // 未 opt-in
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(optedOut.calls()).toBe(1)
    expect(registryA.get(jobA.id)?.status).toBe('failed')

    const permanent = flakyService(1, 'MEDIA_ASSET_MISSING')
    const registryB = new RenderRegistry({ render: permanent.service })
    const jobB = registryB.start(timeline(), { retryTransient: true })
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(permanent.calls()).toBe(1) // 非瞬时：即使 opt-in 也不重试
    expect(registryB.get(jobB.id)?.status).toBe('failed')
    expect(registryB.get(jobB.id)?.diagnosis?.code).toBe('MEDIA_ASSET_MISSING')
  })
})
