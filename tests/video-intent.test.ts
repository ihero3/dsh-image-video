/**
 * 视频意图（`B-4`）：续写是显式语义，不靠参数组合猜。
 *
 * 四条不变式：
 * 1. 模式推导优先级：续写 > 参考视频编辑 > 图生视频 > 文生视频；
 * 2. 声明续写却没有参考视频 → 响亮报错，**不静默降级**成普通生成；
 * 3. 续写缺省时长 = -1（沿用原片时长），显式时长优先；
 * 4. 续写提示词自动补"保持一致、不要重新起镜"，用户已写续写字样时不重复。
 */
import { describe, expect, it } from 'vitest'
import { assertContinuation, composeVideoPrompt, resolveVideoDuration, videoMode } from '../src/media/video-intent.ts'

describe('videoMode 推导', () => {
  it('优先级：续写 > 编辑 > 图生 > 文生', () => {
    expect(videoMode({ continuation: true, hasRefVideo: true, hasImage: false })).toBe('video-continue')
    expect(videoMode({ continuation: false, hasRefVideo: true, hasImage: true })).toBe('video-edit')
    expect(videoMode({ continuation: false, hasRefVideo: false, hasImage: true })).toBe('image-to-video')
    expect(videoMode({ continuation: false, hasRefVideo: false, hasImage: false })).toBe('text-to-video')
  })
})

describe('assertContinuation', () => {
  it('续写必须有参考视频；缺了就给出可操作的报错', () => {
    expect(() => assertContinuation({ continuation: false, hasRefVideo: false })).not.toThrow()
    expect(() => assertContinuation({ continuation: true, hasRefVideo: true })).not.toThrow()
    expect(() => assertContinuation({ continuation: true, hasRefVideo: false })).toThrowError(/续写需要参考视频/)
    expect(() => assertContinuation({ continuation: true, hasRefVideo: false })).toThrowError(/reference_video/)
  })
})

describe('resolveVideoDuration', () => {
  it('续写缺省 -1（沿用原片），显式时长优先', () => {
    expect(resolveVideoDuration({ continuation: true, fallback: 5 })).toBe(-1)
    expect(resolveVideoDuration({ continuation: true, explicit: 8, fallback: 5 })).toBe(8)
    expect(resolveVideoDuration({ continuation: false, fallback: 5 })).toBe(5)
  })
})

describe('composeVideoPrompt', () => {
  it('续写时追加一致性要求，且不重复用户已写的续写字样', () => {
    const appended = composeVideoPrompt({ prompt: '镜头拉远，雨势变大', continuation: true })
    expect(appended).toContain('镜头拉远')
    expect(appended).toContain('续写要求')
    expect(appended).toContain('一致')
    expect(appended).toContain('不要重新起镜')
    // 用户自己写了"继续"就不再追加固定要求
    expect(composeVideoPrompt({ prompt: '继续刚才的镜头', continuation: true })).toBe('继续刚才的镜头')
    // 非续写原样返回
    expect(composeVideoPrompt({ prompt: '一段海浪', continuation: false })).toBe('一段海浪')
  })
})
