/**
 * 调用前预检查测试：只做「本地可判定」的拦截——尺寸写法、明显是视频模型的模型名、
 * 异步传输与服务商能力是否匹配。保证任何确定失败的输入都在提交之前报错。
 */

import { describe, it, expect } from 'vitest'
import { Config as ConfigSchema } from '../src/config.ts'
import type { Config } from '../src/config.ts'
import { formatPreflightNote, looksLikeVideoModel, resolveImagePreflight } from '../src/image-preflight.ts'
import { GenerationError } from '../src/http-client.ts'

/** 用真实 schema 生成默认配置，避免测试里的配置与生产形态漂移。 */
function defaultConfig(patch: Partial<Config> = {}): Config {
  return { ...ConfigSchema({}), ...patch } as Config
}

const baseInput = {
  provider: 'threerouter' as const,
  model: 'qwen-image-3.0' as const,
  size: '3:4',
  hasReferenceImage: false,
  transport: 'async' as const,
  adapterSupportsAsync: true,
}

describe('预检查：尺寸', () => {
  it('接受 宽*高 / 宽x高 / 比例 / 档位别名', () => {
    for (const size of ['1024*1024', '1024x1024', '3:4', '1K', '2K', 'auto']) {
      const preflight = resolveImagePreflight({ ...baseInput, size, config: defaultConfig() })
      expect(preflight.size).toBe(size)
    }
  })

  it('空尺寸 / 无法识别的写法 → 提交前就报错', () => {
    expect(() => resolveImagePreflight({ ...baseInput, size: '   ', config: defaultConfig() }))
      .toThrow(/尺寸为空/)
    expect(() => resolveImagePreflight({ ...baseInput, size: '很大', config: defaultConfig() }))
      .toThrow(/无法识别的尺寸写法/)
    expect(() => resolveImagePreflight({ ...baseInput, size: '1920*1080*4', config: defaultConfig() }))
      .toThrow(GenerationError)
  })
})

describe('预检查：模型', () => {
  it('视频模型被拦下（等于配置 defaultVideoModel）', () => {
    const config = defaultConfig({ defaultVideoModel: 'minimax-h3' })
    expect(() => resolveImagePreflight({ ...baseInput, model: 'minimax-h3', config }))
      .toThrow(/是视频模型/)
  })

  it('命中视频模型命名规则（t2v / i2v / video 词段）被拦下', () => {
    const config = defaultConfig()
    for (const model of ['wan2.7-t2v', 'wan2.2-i2v-plus', 'doubao-seedance-1-0-pro-i2v', 'kling-video']) {
      expect(looksLikeVideoModel(model, config)).toBe(true)
    }
  })

  it('图片模型 / 空模型名不受影响', () => {
    const config = defaultConfig({ defaultVideoModel: 'minimax-h3' })
    for (const model of ['qwen-image-3.0', 'qwen-image-3.0-pro', 'doubao-seedream-3-0-t2i', 'gpt-image-1']) {
      expect(looksLikeVideoModel(model, config)).toBe(false)
    }
    expect(looksLikeVideoModel('', config)).toBe(false)
  })

  it('用户把该模型显式设为 defaultImageModel 时不再拦截（显式配置胜过启发式）', () => {
    const config = defaultConfig({ defaultImageModel: 'minimax-h3' })
    expect(looksLikeVideoModel('minimax-h3', config)).toBe(false)
    const preflight = resolveImagePreflight({ ...baseInput, model: 'minimax-h3', config })
    expect(preflight.model).toBe('minimax-h3')
  })
})

describe('预检查：传输能力', () => {
  it('imageTransport=async 但服务商无异步能力 → 提交前报错并给出可执行建议', () => {
    expect(() => resolveImagePreflight({ ...baseInput, adapterSupportsAsync: false, config: defaultConfig() }))
      .toThrow(/不支持异步图片传输/)
    try {
      resolveImagePreflight({ ...baseInput, adapterSupportsAsync: false, config: defaultConfig() })
    } catch (err) {
      expect((err as Error).message).toContain('改为 auto/sync')
    }
  })
})

describe('预检查：结论快照与透明告知', () => {
  it('结论包含服务商/模型/模式/尺寸/传输/水印，供结果层原样回显', () => {
    const preflight = resolveImagePreflight({
      ...baseInput,
      hasReferenceImage: true,
      config: defaultConfig(),
    })
    expect(preflight.mode).toBe('image-to-image')
    expect(preflight.transport).toBe('async')
    expect(preflight.watermark).toEqual({ enabled: true, text: 'Threerouter' })
    const note = formatPreflightNote(preflight)
    expect(note).toContain('预检查通过')
    expect(note).toContain('模型=qwen-image-3.0')
    expect(note).toContain('模式=图生图')
    expect(note).toContain('传输=async')
    expect(note).toContain('品牌水印=开（Threerouter）')
  })

  it('关闭水印时告知里如实写「关」', () => {
    const config = defaultConfig({ watermark: { ...defaultConfig().watermark, enabled: false } })
    const note = formatPreflightNote(resolveImagePreflight({ ...baseInput, config }))
    expect(note).toContain('品牌水印=关')
  })
})
