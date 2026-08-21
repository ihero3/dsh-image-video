import { describe, it, expect } from 'vitest'
import { Config, resolveActiveProvider } from '../src/config.ts'

describe('Config Schema', () => {
  it('空对象 → 全部使用默认值（默认 provider=bxinle）', () => {
    const cfg = Config({})
    expect(cfg.provider).toBe('bxinle')
    expect(cfg.defaultImageSize).toBe('1024*1024')
    expect(cfg.defaultVideoDuration).toBe(5)
    expect(cfg.timeoutMs).toBe(60_000)
    expect(cfg.pollIntervalMs).toBe(5_000)
    expect(cfg.pollTimeoutMs).toBe(300_000)
    expect(cfg.retryTimes).toBe(3)
    expect(cfg.outputsDir).toBe('./outputs')
    expect(cfg.bxinle.apiKey).toBe('')
    expect(cfg.wanx.apiKey).toBe('')
    expect(cfg.seedance.apiKey).toBe('')
  })

  it('provider 仅接受 bxinle / wanx / seedance，非法值报错', () => {
    expect(() => Config({ provider: 'bxinle' })).not.toThrow()
    expect(() => Config({ provider: 'wanx' })).not.toThrow()
    expect(() => Config({ provider: 'seedance' })).not.toThrow()
    expect(() => Config({ provider: 'other' })).toThrow()
    expect(() => Config({ provider: 123 as unknown as string })).toThrow()
  })

  it('defaultVideoDuration 范围校验：1 ≤ x ≤ 10', () => {
    expect(Config({ defaultVideoDuration: 1 }).defaultVideoDuration).toBe(1)
    expect(Config({ defaultVideoDuration: 10 }).defaultVideoDuration).toBe(10)
    expect(() => Config({ defaultVideoDuration: 0 })).toThrow()
    expect(() => Config({ defaultVideoDuration: 11 })).toThrow()
    expect(() => Config({ defaultVideoDuration: '5' as unknown as number })).toThrow()
  })

  it('timeoutMs 最小 1000，retryTimes 范围 0-10', () => {
    expect(() => Config({ timeoutMs: 500 })).toThrow()
    expect(() => Config({ pollIntervalMs: 100 })).toThrow()
    expect(() => Config({ pollTimeoutMs: 100 })).toThrow()
    expect(() => Config({ retryTimes: -1 })).toThrow()
    expect(() => Config({ retryTimes: 11 })).toThrow()
    expect(Config({ retryTimes: 0 }).retryTimes).toBe(0)
    expect(Config({ retryTimes: 10 }).retryTimes).toBe(10)
  })

  it('自定义凭证与 baseURL 保留', () => {
    const cfg = Config({
      provider: 'seedance',
      seedance: { apiKey: 'sk-xxx', baseURL: 'https://custom.ark.example.com' },
      wanx: { apiKey: '' },
    })
    expect(cfg.provider).toBe('seedance')
    expect(cfg.seedance.apiKey).toBe('sk-xxx')
    expect(cfg.seedance.baseURL).toBe('https://custom.ark.example.com')
  })
})

describe('resolveActiveProvider 凭证解析', () => {
  it('provider=bxinle → 使用 bxinle 凭证 + 默认 baseURL', () => {
    const cfg = Config({ provider: 'bxinle', bxinle: { apiKey: 'sk-bxinle' } })
    const r = resolveActiveProvider(cfg)
    expect(r.provider).toBe('bxinle')
    expect(r.apiKey).toBe('sk-bxinle')
    expect(r.baseURL).toBe('https://bxinle.com/v1')
  })

  it('provider=wanx → 使用 wanx 凭证 + 默认 baseURL', () => {
    const cfg = Config({ provider: 'wanx', wanx: { apiKey: 'sk-wanx' } })
    const r = resolveActiveProvider(cfg)
    expect(r.provider).toBe('wanx')
    expect(r.apiKey).toBe('sk-wanx')
    expect(r.baseURL).toBe('https://dashscope.aliyuncs.com/api/v1')
  })

  it('provider=seedance → 使用 seedance 凭证 + 默认 baseURL', () => {
    const cfg = Config({ provider: 'seedance', seedance: { apiKey: 'sk-seed' } })
    const r = resolveActiveProvider(cfg)
    expect(r.provider).toBe('seedance')
    expect(r.baseURL).toBe('https://ark.cn-beijing.volces.com/api/v3')
  })

  it('自定义 baseURL 覆盖默认端点', () => {
    const cfg = Config({ provider: 'wanx', wanx: { apiKey: 'sk', baseURL: 'https://proxy/wanx' } })
    expect(resolveActiveProvider(cfg).baseURL).toBe('https://proxy/wanx')
  })

  it('未配置 API Key 时抛错，含中文友好提示', () => {
    const cfgB = Config({ provider: 'bxinle', bxinle: { apiKey: '' } })
    expect(() => resolveActiveProvider(cfgB)).toThrow(/bxinle.*未配置 API Key/)
    const cfgW = Config({ provider: 'wanx', wanx: { apiKey: '' } })
    expect(() => resolveActiveProvider(cfgW)).toThrow(/wanx.*未配置 API Key/)
    const cfgS = Config({ provider: 'seedance', seedance: { apiKey: '   ' } })
    expect(() => resolveActiveProvider(cfgS)).toThrow(/seedance.*未配置 API Key/)
  })
})
