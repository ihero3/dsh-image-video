import { describe, it, expect } from 'vitest'
import { Config, resolveActiveProvider } from '../src/config.ts'

describe('Config Schema', () => {
  it('空对象 → 全部使用默认值（默认 provider=threerouter）', () => {
    const cfg = Config({})
    expect(cfg.provider).toBe('threerouter')
    expect(cfg.defaultImageSize).toBe('3:4')
    expect(cfg.defaultVideoDuration).toBe(5)
    expect(cfg.timeoutMs).toBe(60_000)
    expect(cfg.pollIntervalMs).toBe(5_000)
    expect(cfg.pollTimeoutMs).toBe(600_000)
    expect(cfg.retryTimes).toBe(3)
    expect(cfg.outputsDir).toBe('./outputs')
    expect(cfg.threerouter.apiKey).toBe('')
    expect(cfg.wanx.apiKey).toBe('')
    expect(cfg.seedance.apiKey).toBe('')
  })

  it('生图传输与水印的新增字段：默认值符合「保守 + 品牌水印开启」', () => {
    const cfg = Config({})
    // auto：优先异步（幂等 + 超时找回），端点不可用时自动降级同步，不阻断出图
    expect(cfg.imageTransport).toBe('auto')
    // fail：提交状态未知时默认不自动重提（最保守，绝不重复扣费）
    expect(cfg.imageUnknownStatePolicy).toBe('fail')
    expect(cfg.watermark).toEqual({
      enabled: true,
      text: 'Threerouter',
      opacity: 0.68,
      position: 'bottom-right',
      fontSizeRatio: 0.032,
      marginXRatio: 0.028,
      marginYRatio: 0.012,
      glowEnabled: true,
      glowColor: '#ffffff',
      glowBlurRatio: 0.18,
    })
  })

  it('新增字段的取值域校验：非法传输/策略/水印位置一律报错', () => {
    expect(Config({ imageTransport: 'async' }).imageTransport).toBe('async')
    expect(Config({ imageTransport: 'sync' }).imageTransport).toBe('sync')
    expect(() => Config({ imageTransport: 'turbo' })).toThrow()
    expect(Config({ imageUnknownStatePolicy: 'resubmit-same-key' }).imageUnknownStatePolicy).toBe('resubmit-same-key')
    expect(() => Config({ imageUnknownStatePolicy: 'retry' })).toThrow()
    expect(Config({ watermark: { position: 'top-left' } }).watermark.position).toBe('top-left')
    expect(Config({ watermark: { position: 'top-left' } }).watermark.text).toBe('Threerouter')
    expect(() => Config({ watermark: { position: 'center' } })).toThrow()
    expect(() => Config({ watermark: { opacity: 1.5 } })).toThrow()
    expect(Config({ watermark: { enabled: false } }).watermark.enabled).toBe(false)
  })

  it('provider 接受四家服务商，非法值报错', () => {
    expect(() => Config({ provider: 'threerouter' })).not.toThrow()
    expect(() => Config({ provider: 'wanx' })).not.toThrow()
    expect(() => Config({ provider: 'seedance' })).not.toThrow()
    expect(() => Config({ provider: 'minimax' })).not.toThrow()
    expect(() => Config({ provider: 'other' })).toThrow()
    expect(() => Config({ provider: 123 as unknown as string })).toThrow()
  })

  it('defaultVideoDuration 范围校验：1 ≤ x ≤ 30', () => {
    expect(Config({ defaultVideoDuration: 1 }).defaultVideoDuration).toBe(1)
    expect(Config({ defaultVideoDuration: 10 }).defaultVideoDuration).toBe(10)
    expect(() => Config({ defaultVideoDuration: 0 })).toThrow()
    expect(Config({ defaultVideoDuration: 30 }).defaultVideoDuration).toBe(30)
    expect(() => Config({ defaultVideoDuration: 31 })).toThrow()
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
  it('provider=threerouter → 使用 threerouter 凭证 + 默认 baseURL', () => {
    const cfg = Config({ provider: 'threerouter', threerouter: { apiKey: 'sk-threerouter' } })
    const r = resolveActiveProvider(cfg)
    expect(r.provider).toBe('threerouter')
    expect(r.apiKey).toBe('sk-threerouter')
    expect(r.baseURL).toBe('https://api.threerouter.com/v1')
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

  it('provider=minimax → 使用 minimax 凭证 + 官方平台默认 baseURL；defaultVideoProvider 联合含 minimax', () => {
    const cfg = Config({ provider: 'minimax', minimax: { apiKey: 'sk-mm' }, defaultVideoProvider: 'minimax' })
    const r = resolveActiveProvider(cfg)
    expect(r.provider).toBe('minimax')
    expect(r.baseURL).toBe('https://api.minimaxi.com/v1')
    expect(cfg.defaultVideoProvider).toBe('minimax')
    expect(cfg.minimax.apiKey).toBe('sk-mm')
    expect(Config({ provider: 'minimax', minimax: { apiKey: 'sk-mm' }, defaultImageProvider: 'minimax' }).defaultImageProvider).toBe('minimax')
  })

  it('自定义 baseURL 覆盖默认端点', () => {
    const cfg = Config({ provider: 'wanx', wanx: { apiKey: 'sk', baseURL: 'https://proxy/wanx' } })
    expect(resolveActiveProvider(cfg).baseURL).toBe('https://proxy/wanx')
  })

  it('未配置 API Key 时抛错，含中文友好提示', () => {
    const cfgT = Config({ provider: 'threerouter', threerouter: { apiKey: '' } })
    expect(() => resolveActiveProvider(cfgT)).toThrow(/threerouter.*未配置 API Key/)
    const cfgW = Config({ provider: 'wanx', wanx: { apiKey: '' } })
    expect(() => resolveActiveProvider(cfgW)).toThrow(/wanx.*未配置 API Key/)
    const cfgS = Config({ provider: 'seedance', seedance: { apiKey: '   ' } })
    expect(() => resolveActiveProvider(cfgS)).toThrow(/seedance.*未配置 API Key/)
  })
})
