/**
 * 对抗性质量扫荡（Track A 持续交付轮）：针对侧链/交叉淡化/校验器的边界与异常注入。
 *
 * 本文件钉住三个真实缺陷（都是"只有真跑 ffmpeg 或细看语义才会暴露"的那种）：
 * ① 自指侧链 → 同一个标签被用两次 → ffmpeg 报错；
 * ② crossfadeMs 大于片段时长 → acrossfade 的 d 超限 → ffmpeg 报错；
 * ③ 缺素材复用了 "empty-subtitle" 问题码 → 调用方无法区分。
 */
import { describe, expect, it } from 'vitest'
import { buildRenderArgs, freezeTimeline } from '../src/media/render.ts'
import { validateTimeline } from '../src/workbench/validate.ts'
import type { TimelineRecord, TimelineTrack } from '../src/workbench/timeline.ts'

const timeline = (tracks: TimelineTrack[]): TimelineRecord => ({
  schemaVersion: 3, id: 'tml-adv', projectId: 'prj-1', name: '扫荡', frameRate: 30, burnSubtitles: false,
  tracks, createdAt: '', updatedAt: '',
})
const video = (): TimelineTrack => ({ id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: '/tmp/v.mp4', startMs: 0, durationMs: 2000 }] })
const filterOf = (document: TimelineRecord): string => {
  const args = buildRenderArgs(freezeTimeline(document), { outputPath: '/tmp/out.mp4' })
  return args[args.indexOf('-filter_complex') + 1] ?? ''
}

describe('adversarial: self-referencing ducking', () => {
  it('skips the sidechain instead of emitting an illegal graph', () => {
    const document = timeline([
      video(),
      { id: 'music', kind: 'audio', duckUnderTrackId: 'music', duckingDb: -12, clips: [
        { id: 'm', assetPath: '/tmp/m.aac', startMs: 0, durationMs: 1000 },
      ] },
    ])
    // 渲染侧：不能出现 sidechaincompress（否则同一标签用两次）
    expect(filterOf(document)).not.toContain('sidechaincompress')
    // 校验侧：要明确告诉用户"指向自己不行"
    expect(validateTimeline(document).map(issue => issue.code)).toContain('self-ducking')
  })

  it('skips ducking when the trigger track is not an audio track', () => {
    const document = timeline([
      video(),
      { id: 'music', kind: 'audio', duckUnderTrackId: 'v1', clips: [{ id: 'm', assetPath: '/tmp/m.aac', startMs: 0, durationMs: 1000 }] },
    ])
    expect(filterOf(document)).not.toContain('sidechaincompress')
  })
})

describe('adversarial: crossfade longer than the clips', () => {
  it('clamps the fade per pair instead of letting ffmpeg reject the graph', () => {
    const document = timeline([
      video(),
      { id: 'a1', kind: 'audio', crossfadeMs: 5000, clips: [
        { id: 'a', assetPath: '/tmp/a.aac', startMs: 0, durationMs: 1000 },
        { id: 'b', assetPath: '/tmp/b.aac', startMs: 1000, durationMs: 1000 },
      ] },
    ])
    const filter = filterOf(document)
    // 5000ms 请求被夹到 min(1000,1000)/2 = 500ms
    expect(filter).toContain('acrossfade=d=0.500')
    expect(filter).not.toContain('acrossfade=d=5.000')
  })
})

describe('adversarial: issue codes stay specific', () => {
  it('reports a missing asset as missing-asset, not as an empty subtitle', () => {
    const document = timeline([
      { id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: '/tmp/ghost.mp4', startMs: 0, durationMs: 1000 }] },
    ])
    const codes = validateTimeline(document, { knownAssetPaths: new Set<string>() }).map(issue => issue.code)
    expect(codes).toContain('missing-asset')
    expect(codes).not.toContain('empty-subtitle')
  })
})
