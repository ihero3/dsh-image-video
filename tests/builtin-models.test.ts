/**
 * 内置默认模型解析：界面要知道"不选模型时到底会用哪个"。
 *
 * 断言只比**同源常量**，不在这里复制模型名——复制一份就等于给漂移开了口子。
 */
import { describe, expect, it } from 'vitest'
import { builtinModels, resolveEffectiveModel } from '../src/media/builtin-models.ts'
import { DEFAULT_IMAGE_MODEL as THREEVIDEO_IMAGE, DEFAULT_VIDEO_MODEL as THREEVIDEO_VIDEO } from '../src/providers/threevideo.ts'
import { DEFAULT_IMAGE_MODEL as MINIMAX_IMAGE, DEFAULT_VIDEO_MODEL as MINIMAX_VIDEO } from '../src/providers/minimax.ts'

describe('builtinModels', () => {
  it('把服务商映射到适配器的默认模型（与适配器同源）', () => {
    expect(builtinModels('threevideo')).toEqual({ image: THREEVIDEO_IMAGE, video: THREEVIDEO_VIDEO })
    expect(builtinModels('minimax')).toEqual({ image: MINIMAX_IMAGE, video: MINIMAX_VIDEO })
  })

  it('大小写与首尾空白不影响解析', () => {
    expect(builtinModels(' ThreeVideo ')?.image).toBe(THREEVIDEO_IMAGE)
  })

  it('旧 id threerouter 仍能解析（配置加载会归一，但测试/旧存档可能绕过）', () => {
    expect(builtinModels('threerouter')?.image).toBe(THREEVIDEO_IMAGE)
  })

  it('未知 / 空服务商返回 undefined，不编造名字', () => {
    expect(builtinModels('nope')).toBeUndefined()
    expect(builtinModels('')).toBeUndefined()
    expect(builtinModels(undefined)).toBeUndefined()
  })
})

describe('resolveEffectiveModel', () => {
  it('配置里显式指定的默认模型优先于服务商内置默认', () => {
    expect(resolveEffectiveModel('threevideo', 'my-model', 'image')).toBe('my-model')
  })

  it('未配置时回落到服务商内置默认', () => {
    expect(resolveEffectiveModel('threevideo', '', 'image')).toBe(THREEVIDEO_IMAGE)
    expect(resolveEffectiveModel('threevideo', '   ', 'video')).toBe(THREEVIDEO_VIDEO)
  })

  it('服务商与配置都缺失时返回 undefined（界面退回「自动」）', () => {
    expect(resolveEffectiveModel(undefined, '', 'video')).toBeUndefined()
  })
})
