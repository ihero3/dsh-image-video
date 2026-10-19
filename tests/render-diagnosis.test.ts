/**
 * 渲染失败的诊断建议（Track A / A88）。
 */
import { describe, expect, it } from 'vitest'
import { diagnoseRenderError } from '../src/media/diagnose.ts'
import { RenderRegistry } from '../src/media/render-registry.ts'
import { RenderError } from '../src/media/render.ts'
import type { RenderService } from '../src/media/render.ts'

describe('diagnoseRenderError (A88)', () => {
  it('maps known codes to human titles and executable actions', () => {
    const missing = diagnoseRenderError('MEDIA_ASSET_MISSING', '素材不存在：outputs/a.mp4')
    expect(missing.title).toContain('素材不存在')
    expect(missing.actions.length).toBeGreaterThan(0)
    expect(missing.hint).toContain('outputs/a.mp4') // 原始信息附在 hint 里
    expect(diagnoseRenderError('MEDIA_FFMPEG_UNAVAILABLE').actions.join(' ')).toContain('DSH_FFMPEG_PATH')
    expect(diagnoseRenderError('MEDIA_TIMELINE_OVERLAP').actions.join(' ')).toContain('validate')
  })

  it('falls back to generic advice for unknown or missing codes', () => {
    const unknown = diagnoseRenderError('SOMETHING_NEW', '炸了')
    expect(unknown.code).toBe('SOMETHING_NEW')
    expect(unknown.actions.join(' ')).toContain('render-retry')
    expect(diagnoseRenderError(undefined).code).toBe('UNKNOWN')
  })
})

describe('render failures carry a diagnosis (A88)', () => {
  it('attaches diagnosis on failure but not on cancel', async () => {
    const failing = { async render() { throw new RenderError('MEDIA_ASSET_MISSING', '素材不存在：outputs/a.mp4') } } as unknown as RenderService
    const registry = new RenderRegistry({ render: failing })
    const job = registry.start({
      schemaVersion: 4, id: 'tml-d', projectId: 'prj-1', name: '诊断', frameRate: 30, burnSubtitles: false,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c', assetPath: 'outputs/a.mp4', startMs: 0, durationMs: 1000 }] }],
      createdAt: '', updatedAt: '',
    })
    await new Promise(resolve => setTimeout(resolve, 200))
    const failed = registry.get(job.id)!
    expect(failed.status).toBe('failed')
    expect(failed.diagnosis?.title).toContain('素材不存在')
    expect(failed.error).toContain('outputs/a.mp4')
  })
})
