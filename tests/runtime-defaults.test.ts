/**
 * 运行时默认值测试：store 内存语义、风格后缀拼接、POST 协议校验、
 * 回环路由 handler（真实 node:http + fetch，对齐 media-route.test.ts 模式）
 * 与注册安全边界（非 127.0.0.1 不注册）；另含「用户可见六项永不未设置」的
 * 内置兜底（BUILT_IN_DEFAULTS）与展示字段清单（DISPLAY_DEFAULT_KEYS）。
 *
 * @module dsh-image-video/tests/runtime-defaults
 */

import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  applyImageStyle,
  BUILT_IN_DEFAULTS,
  createDefaultsRouteHandler,
  createRuntimeDefaultsStore,
  DEFAULTS_ROUTE_PATH,
  DISPLAY_DEFAULT_KEYS,
  extractPersistedDefaults,
  IMAGE_SIZE_OPTIONS,
  IMAGE_STYLE_OPTIONS,
  MAX_VIDEO_DURATION,
  MIN_VIDEO_DURATION,
  MODEL_FAMILY_RULES,
  MULTI_FRAME_CAPABLE_MODELS,
  parseDefaultsPatch,
  PROVIDERS,
  registerDefaultsRoute,
  resolveDefaultsSources,
  resolveDefaultsView,
  resolveModelCandidates,
  VIDEO_ASPECT_RATIOS,
} from '../src/runtime-defaults.ts'
import type { Config, Provider } from '../src/config.ts'
import type { PersistedDefaultsView } from '../src/runtime-defaults.ts'
import type { MediaWebServer } from '../src/media-route.ts'

describe('运行时默认值存储', () => {
  it('初始快照为空，get 返回副本', () => {
    const store = createRuntimeDefaultsStore()
    expect(store.get()).toEqual({})
    const snapshot = store.get()
    ;(snapshot as Record<string, unknown>).imageProvider = 'tampered'
    expect(store.get()).toEqual({})
  })

  it('patch 合并写入，null 清除对应字段，其余字段保留', () => {
    const store = createRuntimeDefaultsStore()
    store.patch({ imageProvider: 'wanx', videoDuration: 6 })
    expect(store.get()).toEqual({ imageProvider: 'wanx', videoDuration: 6 })
    store.patch({ imageProvider: null })
    expect(store.get()).toEqual({ videoDuration: 6 })
  })

  it('reset 清空全部覆盖', () => {
    const store = createRuntimeDefaultsStore()
    store.patch({ imageSize: '1280*720', imageStyle: 'anime' })
    store.reset()
    expect(store.get()).toEqual({})
  })
})

describe('内置兜底默认值（BUILT_IN_DEFAULTS）', () => {
  it('六项用户可见字段的内置值与 A4 规格一致', () => {
    expect(BUILT_IN_DEFAULTS).toEqual({
      imageProvider: 'threevideo',
      // A4 写的是 1:1；协议层尺寸串 = IMAGE_SIZE_OPTIONS 里 1:1 的 size
      imageSize: '1024*1024',
      // A4 写的是「摄影」；IMAGE_STYLE_OPTIONS 里 label=摄影 的 id 是 photo
      imageStyle: 'photo',
      videoProvider: 'threevideo',
      videoAspectRatio: '9:16',
      videoDuration: 10,
    })
  })

  it('内置值都能通过协议层校验（不是手写的野值）', () => {
    expect(PROVIDERS).toContain(BUILT_IN_DEFAULTS.imageProvider)
    expect(PROVIDERS).toContain(BUILT_IN_DEFAULTS.videoProvider)
    expect(IMAGE_SIZE_OPTIONS.find((option) => option.id === '1:1')?.size).toBe(BUILT_IN_DEFAULTS.imageSize)
    expect(IMAGE_STYLE_OPTIONS.find((option) => option.id === BUILT_IN_DEFAULTS.imageStyle)?.label).toBe('摄影')
    expect(VIDEO_ASPECT_RATIOS).toContain(BUILT_IN_DEFAULTS.videoAspectRatio)
    expect(BUILT_IN_DEFAULTS.videoDuration).toBeGreaterThanOrEqual(MIN_VIDEO_DURATION)
    expect(BUILT_IN_DEFAULTS.videoDuration).toBeLessThanOrEqual(MAX_VIDEO_DURATION)
    // 六个值原样回灌 POST 协议也必须被接受（否则界面选不回默认值）
    expect(parseDefaultsPatch({ ...BUILT_IN_DEFAULTS }).ok).toBe(true)
  })

  it('无人配置时直接解析出可用组合（六项永不「未设置」）', () => {
    const view = resolveDefaultsView(createRuntimeDefaultsStore())
    for (const key of DISPLAY_DEFAULT_KEYS) {
      expect(view[key], `${key} 不应为 null（未设置）`).not.toBeNull()
      expect(view[key]).toEqual(BUILT_IN_DEFAULTS[key])
    }
    // mediaMode 不参与兜底：null 就是文本模式，不编一个"默认输入模式"
    expect(view.mediaMode).toBeNull()
  })

  it('兜底在最后一级：settings 持久默认与运行时覆盖都优先', () => {
    const store = createRuntimeDefaultsStore()
    const persisted: PersistedDefaultsView = { imageProvider: 'wanx', videoDuration: 6 }
    const fromSettings = resolveDefaultsView(store, persisted)
    expect(fromSettings.imageProvider).toBe('wanx')
    expect(fromSettings.videoDuration).toBe(6)
    expect(fromSettings.imageSize).toBe(BUILT_IN_DEFAULTS.imageSize)
    expect(fromSettings.imageStyle).toBe(BUILT_IN_DEFAULTS.imageStyle)

    store.patch({ imageProvider: 'seedance', imageStyle: 'anime' })
    const overridden = resolveDefaultsView(store, persisted)
    expect(overridden.imageProvider).toBe('seedance')
    expect(overridden.imageStyle).toBe('anime')
    expect(overridden.videoDuration).toBe(6) // 覆盖不影响其它字段
    expect(overridden.videoAspectRatio).toBe(BUILT_IN_DEFAULTS.videoAspectRatio)
  })

  it('DISPLAY_DEFAULT_KEYS = 六项、顺序即界面顺序、不含 mediaMode', () => {
    expect([...DISPLAY_DEFAULT_KEYS]).toEqual([
      'imageProvider',
      'imageSize',
      'imageStyle',
      'videoProvider',
      'videoAspectRatio',
      'videoDuration',
    ])
    // mediaMode 不是用户可配参数（输入形式本来就都合法），只保留字段兼容
    expect((DISPLAY_DEFAULT_KEYS as ReadonlyArray<string>).includes('mediaMode')).toBe(false)
    // 兜底表恰好覆盖展示字段，不多不少：将来加字段却忘了兜底会在这里挂
    expect(Object.keys(BUILT_IN_DEFAULTS).sort()).toEqual([...DISPLAY_DEFAULT_KEYS].sort())
  })
})

describe('视频宽高比白名单（VIDEO_ASPECT_RATIOS）', () => {
  it('含 16:9 / 9:16 / 1:1 / 3:4 / 4:3，顺序固定', () => {
    expect([...VIDEO_ASPECT_RATIOS]).toEqual(['16:9', '9:16', '1:1', '3:4', '4:3'])
  })

  it('3:4 / 4:3 可通过 POST 校验，白名单外仍被拒', () => {
    expect(parseDefaultsPatch({ videoAspectRatio: '3:4' }).ok).toBe(true)
    expect(parseDefaultsPatch({ videoAspectRatio: '4:3' }).ok).toBe(true)
    expect(parseDefaultsPatch({ videoAspectRatio: '21:9' }).ok).toBe(false)
  })
})

describe('图片风格提示词后缀', () => {
  it('未设置 / 自动 / 未知风格原样返回', () => {
    expect(applyImageStyle('a cat', undefined)).toBe('a cat')
    expect(applyImageStyle('a cat', '')).toBe('a cat')
    expect(applyImageStyle('a cat', 'no-such-style')).toBe('a cat')
  })

  it('已知风格拼接英文后缀', () => {
    const result = applyImageStyle('a cat', 'anime')
    expect(result).toBe('a cat, anime style, cel shading, vibrant colors')
    expect(applyImageStyle('山水', 'ink')).toContain('Chinese ink painting style')
  })

  it('末尾已有逗号时不重复', () => {
    expect(applyImageStyle('a cat,', 'photo')).toBe('a cat, photorealistic style, professional photography, high detail')
  })

  it('风格清单含自动与五个具体风格', () => {
    expect(IMAGE_STYLE_OPTIONS.map((o) => o.id)).toEqual(['', 'photo', 'illustration', '3d', 'anime', 'ink'])
  })
})

describe('模型家族候选构建（resolveModelCandidates）', () => {
  /** 全 key 可用的判断器；个别用例覆盖为只认部分服务商。 */
  const allKeys = (): boolean => true
  /** 仅指定服务商有 key。 */
  const keysOf = (...providers: Provider[]): ((p: Provider) => boolean) => (p) => providers.includes(p)

  it('视频固定只走 threevideo，配置链与家族直连商都不参与', () => {
    // 项目约定：视频生成强制 Threevideo，禁止 OpenArt 及其他直连服务商回退。
    expect(resolveModelCandidates('video', 'minimax-h3', 'threevideo', allKeys)).toEqual(['threevideo'])
    expect(resolveModelCandidates('video', 'wan2.7-t2v', 'threevideo', allKeys)).toEqual(['threevideo'])
    expect(resolveModelCandidates('video', 'wan2.7-t2v', 'wanx', allKeys)).toEqual(['threevideo'])
    expect(resolveModelCandidates('video', 'doubao-seedance-1-0-pro-250428', 'minimax', allKeys)).toEqual(['threevideo'])
    // 图片仍保留家族候选逻辑，不受视频锁定影响。
    expect(resolveModelCandidates('image', 'minimax-image-01', 'wanx', allKeys)).toEqual(['wanx', 'minimax', 'threevideo'])
  })

  it('wan 关键词一条规则覆盖 wan* 与 wanx*', () => {
    expect(resolveModelCandidates('video', 'wanx2.1-t2v-turbo', 'threevideo', allKeys)).toEqual(['threevideo'])
    expect(resolveModelCandidates('image', 'wanx2.1-t2i-turbo', 'threevideo', allKeys)).toEqual(['threevideo', 'wanx'])
    expect(resolveModelCandidates('image', 'wan2.1-image', 'threevideo', allKeys)).toEqual(['threevideo', 'wanx'])
  })

  it('minimax 家族参与视频与图片候选（image_generation 支持 t2i + 主体一致性 i2i）', () => {
    // 家族路由按模型名关键词（minimax/hailuo）命中；threevideo 的 minimax 图模型名含 "minimax"
    expect(resolveModelCandidates('image', 'minimax-image-01', 'threevideo', allKeys)).toEqual(['threevideo', 'minimax'])
    expect(resolveModelCandidates('image', 'minimax-image-01', 'wanx', allKeys)).toEqual(['wanx', 'minimax', 'threevideo'])
    expect(resolveModelCandidates('video', 'MiniMax-Hailuo-02', 'wanx', allKeys)).toEqual(['threevideo'])
    // minimax 官方原生模型名 "image-01" 不含家族关键词 → 仅配置链 + 兜底（如实反映，不硬编码特例）
    expect(resolveModelCandidates('image', 'image-01', 'wanx', allKeys)).toEqual(['wanx', 'threevideo'])
  })

  it('未配置 key 的候选自动跳过', () => {
    // 只有 threevideo 有 key：minimax 模型的家族直连商（无 key）被过滤
    expect(resolveModelCandidates('video', 'minimax-h3', 'threevideo', keysOf('threevideo'))).toEqual(['threevideo'])
    // 视频锁定 threevideo：即使只有 wanx 有 key，也没有可用的视频候选
    expect(resolveModelCandidates('video', 'wan2.7-t2v', 'wanx', keysOf('wanx'))).toEqual([])
  })

  it('自定义模型无家族命中：仅配置链 + 聚合器兜底', () => {
    expect(resolveModelCandidates('video', 'gpt-video-9', 'wanx', allKeys)).toEqual(['threevideo'])
    expect(resolveModelCandidates('image', 'my-custom-model', 'threevideo', allKeys)).toEqual(['threevideo'])
  })

  it('未显式指定模型：仅配置链 + 聚合器兜底', () => {
    expect(resolveModelCandidates('video', undefined, 'threevideo', allKeys)).toEqual(['threevideo'])
    expect(resolveModelCandidates('video', undefined, 'wanx', allKeys)).toEqual(['threevideo'])
    expect(resolveModelCandidates('video', undefined, undefined, allKeys)).toEqual(['threevideo'])
  })

  it('全部候选均无 key 时返回空数组（工具层据此响亮报错）', () => {
    expect(resolveModelCandidates('video', undefined, 'wanx', keysOf())).toEqual([])
  })

  it('家族规则清单符合当前厂商事实（wan 一条规则 + minimax 图片视频双能力）', () => {
    expect(MODEL_FAMILY_RULES.map((r) => r.family)).toEqual(['minimax', 'seedance', 'wan'])
    expect(MODEL_FAMILY_RULES.find((r) => r.family === 'wan')?.keywords).toEqual(['wan'])
    expect(MODEL_FAMILY_RULES.find((r) => r.family === 'minimax')?.kinds).toEqual(['video', 'image'])
  })
})

describe('settings 持久默认提取（extractPersistedDefaults）', () => {
  /** 构造测试用插件配置：除显式覆盖字段外全部取 schema 默认值。 */
  function makeConfig(overrides: Partial<Config> = {}): Config {
    return {
      provider: 'threevideo',
      threevideo: { apiKey: 'test-key' },
      wanx: { apiKey: '' },
      minimax: { apiKey: '' },
      seedance: { apiKey: '' },
      defaultImageProvider: '',
      defaultVideoProvider: '',
      defaultImageSize: '1024*1024',
      defaultVideoDuration: 5,
      timeoutMs: 60_000,
      pollIntervalMs: 5_000,
      pollTimeoutMs: 300_000,
      retryTimes: 3,
      outputsDir: './outputs',
      ...overrides,
    }
  }

  it('schema 默认 config：仅提取合法尺寸与时长，空服务商不提取', () => {
    expect(extractPersistedDefaults(makeConfig())).toEqual({
      imageSize: '1024*1024',
      videoDuration: 5,
    })
  })

  it('合法服务商的持久默认被提取', () => {
    const view = extractPersistedDefaults(makeConfig({ defaultImageProvider: 'wanx', defaultVideoProvider: 'seedance' }))
    expect(view.imageProvider).toBe('wanx')
    expect(view.videoProvider).toBe('seedance')
  })

  it('越界遗留值整体忽略：未知服务商 / 非白名单尺寸 / 时长越界', () => {
    const view = extractPersistedDefaults(makeConfig({
      defaultImageProvider: 'bogus' as unknown as Config['defaultImageProvider'],
      defaultVideoProvider: 'also-bogus' as unknown as Config['defaultVideoProvider'],
      defaultImageSize: '999*999',
      defaultVideoDuration: 31,
    }))
    expect(view.imageProvider).toBeUndefined()
    expect(view.videoProvider).toBeUndefined()
    expect(view.imageSize).toBeUndefined()
    expect(view.videoDuration).toBeUndefined()
  })
})

describe('POST 协议校验', () => {
  it('非对象 / 数组拒绝', () => {
    expect(parseDefaultsPatch('x').ok).toBe(false)
    expect(parseDefaultsPatch(null).ok).toBe(false)
    expect(parseDefaultsPatch([1]).ok).toBe(false)
  })

  it('未知字段拒绝', () => {
    const result = parseDefaultsPatch({ nope: 1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('nope')
  })

  it('合法写入并归一化：空串视为 null（自动）', () => {
    const result = parseDefaultsPatch({ imageProvider: 'wanx', imageSize: '', videoDuration: null })
    expect(result).toEqual({
      ok: true,
      patch: { imageProvider: 'wanx', imageSize: null, videoDuration: null },
    })
  })

  it('imageSize 仅接受白名单尺寸', () => {
    expect(parseDefaultsPatch({ imageSize: '1024*1024' }).ok).toBe(true)
    const bad = parseDefaultsPatch({ imageSize: '999*999' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toContain('imageSize')
  })

  it('mediaMode 仅接受 text / image / video；空串清除覆盖', () => {
    expect(parseDefaultsPatch({ mediaMode: 'image' })).toEqual({ ok: true, patch: { mediaMode: 'image' } })
    expect(parseDefaultsPatch({ mediaMode: 'video' })).toEqual({ ok: true, patch: { mediaMode: 'video' } })
    expect(parseDefaultsPatch({ mediaMode: 'text' })).toEqual({ ok: true, patch: { mediaMode: 'text' } })
    // 空串 = 自动（清除覆盖），与其它字段同一口径
    expect(parseDefaultsPatch({ mediaMode: '' })).toEqual({ ok: true, patch: { mediaMode: null } })
    expect(parseDefaultsPatch({ mediaMode: null })).toEqual({ ok: true, patch: { mediaMode: null } })
    const bad = parseDefaultsPatch({ mediaMode: 'audio' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toContain('mediaMode')
    expect(parseDefaultsPatch({ mediaMode: 1 }).ok).toBe(false)
  })

  it('resolveDefaultsView 合并 mediaMode：运行时覆盖优先，且不回落到 settings（纯运行时概念）', () => {
    const store = createRuntimeDefaultsStore()
    expect(resolveDefaultsView(store).mediaMode).toBeNull()
    store.patch({ mediaMode: 'image' })
    expect(resolveDefaultsView(store, { imageProvider: 'wanx' }).mediaMode).toBe('image')
    store.patch({ mediaMode: null })
    expect(resolveDefaultsView(store).mediaMode).toBeNull()
  })

  it('imageSize 白名单覆盖五个比例（3:4 按实测规格 1152*1536）', () => {
    expect(IMAGE_SIZE_OPTIONS.map((o) => o.size)).toEqual(['1024*1024', '1152*864', '1152*1536', '1280*720', '720*1280'])
  })

  it('MULTI_FRAME_CAPABLE_MODELS 首项为 MiniMax-H3，且仍包含 wan3.0-video', () => {
    expect(MULTI_FRAME_CAPABLE_MODELS[0]).toBe('MiniMax-H3')
    expect(MULTI_FRAME_CAPABLE_MODELS).toContain('wan3.0-video')
  })

  it('imageStyle 仅接受白名单风格', () => {
    expect(parseDefaultsPatch({ imageStyle: 'ink' }).ok).toBe(true)
    expect(parseDefaultsPatch({ imageStyle: '' }).ok).toBe(true) // 空 = 自动（清除）
    expect(parseDefaultsPatch({ imageStyle: 'oil' }).ok).toBe(false)
  })

  it('videoAspectRatio 仅接受白名单比例（含 3:4 / 4:3）', () => {
    expect(parseDefaultsPatch({ videoAspectRatio: '16:9' }).ok).toBe(true)
    expect(parseDefaultsPatch({ videoAspectRatio: '3:4' }).ok).toBe(true)
    expect(parseDefaultsPatch({ videoAspectRatio: '4:3' }).ok).toBe(true)
    expect(parseDefaultsPatch({ videoAspectRatio: '21:9' }).ok).toBe(false)
  })

  it('videoDuration 仅接受 1-30 整数', () => {
    expect(parseDefaultsPatch({ videoDuration: 8 }).ok).toBe(true)
    expect(parseDefaultsPatch({ videoDuration: 0 }).ok).toBe(false)
    expect(parseDefaultsPatch({ videoDuration: 31 }).ok).toBe(false)
    expect(parseDefaultsPatch({ videoDuration: 5.5 }).ok).toBe(false)
    expect(parseDefaultsPatch({ videoDuration: '5' }).ok).toBe(false)
  })

  it('服务商字段仅接受白名单值，空串归一化为自动（清除）', () => {
    expect(parseDefaultsPatch({ videoProvider: 'no-such' }).ok).toBe(false)
    expect(parseDefaultsPatch({ imageProvider: 'wanx' }).ok).toBe(true)
    expect(parseDefaultsPatch({ imageProvider: '' }).ok).toBe(true)
  })
})

describe('defaults 路由 handler', () => {
  let server: Server
  let base: string
  const store = createRuntimeDefaultsStore()

  beforeAll(async () => {
    server = createServer((req, res) => {
      void createDefaultsRouteHandler(store)(req, res)
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
  })

  it('GET 初始返回内置兜底视图：六项非 null，mediaMode 仍为 null', async () => {
    const res = await fetch(`${base}${DEFAULTS_ROUTE_PATH}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      mediaMode: null,
      imageProvider: 'threevideo',
      imageSize: '1024*1024',
      imageStyle: 'photo',
      videoProvider: 'threevideo',
      videoAspectRatio: '9:16',
      videoDuration: 10,
    })
  })

  it('POST 合法写入后 GET 读回覆盖值，未覆盖的字段落到内置兜底', async () => {
    const post = await fetch(`${base}${DEFAULTS_ROUTE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageStyle: 'anime', videoDuration: 8 }),
    })
    expect(post.status).toBe(200)
    expect(await post.json()).toEqual({
      mediaMode: null,
      imageProvider: 'threevideo',
      imageSize: '1024*1024',
      imageStyle: 'anime',
      videoProvider: 'threevideo',
      videoAspectRatio: '9:16',
      videoDuration: 8,
    })
  })

  it('POST null 清除覆盖后回落内置兜底（不是「未设置」）', async () => {
    await fetch(`${base}${DEFAULTS_ROUTE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageStyle: null }),
    })
    const res = await fetch(`${base}${DEFAULTS_ROUTE_PATH}`)
    const view = await res.json() as Record<string, unknown>
    expect(view.imageStyle).toBe('photo')
    expect(view.videoDuration).toBe(8)
  })

  it('POST 未知字段 400 且不修改存储', async () => {
    const res = await fetch(`${base}${DEFAULTS_ROUTE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hacker: true }),
    })
    expect(res.status).toBe(400)
    const view = await (await fetch(`${base}${DEFAULTS_ROUTE_PATH}`)).json() as Record<string, unknown>
    expect(view.videoDuration).toBe(8)
  })

  it('POST 非法 JSON 400', async () => {
    const res = await fetch(`${base}${DEFAULTS_ROUTE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    })
    expect(res.status).toBe(400)
  })

  it('PUT 405', async () => {
    const res = await fetch(`${base}${DEFAULTS_ROUTE_PATH}`, { method: 'PUT' })
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('GET, POST')
  })
})

describe('defaults 路由合并视图（override ?? settings 持久默认 ?? 内置兜底）', () => {
  let server: Server
  let base: string
  const store = createRuntimeDefaultsStore()
  const persisted: PersistedDefaultsView = { imageProvider: 'wanx', videoDuration: 6 }

  beforeAll(async () => {
    server = createServer((req, res) => {
      void createDefaultsRouteHandler(store, persisted)(req, res)
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
  })

  it('GET 无覆盖时回落 settings 持久默认，其余字段用内置兜底', async () => {
    const res = await fetch(`${base}${DEFAULTS_ROUTE_PATH}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      mediaMode: null,
      imageProvider: 'wanx',
      imageSize: '1024*1024',
      imageStyle: 'photo',
      videoProvider: 'threevideo',
      videoAspectRatio: '9:16',
      videoDuration: 6,
    })
  })

  it('运行时覆盖优先于持久默认', async () => {
    await fetch(`${base}${DEFAULTS_ROUTE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageProvider: 'seedance' }),
    })
    const view = await (await fetch(`${base}${DEFAULTS_ROUTE_PATH}`)).json() as Record<string, unknown>
    expect(view.imageProvider).toBe('seedance')
    expect(view.videoDuration).toBe(6)
  })

  it('POST 空串清除覆盖后回落持久默认', async () => {
    await fetch(`${base}${DEFAULTS_ROUTE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageProvider: '' }),
    })
    const view = await (await fetch(`${base}${DEFAULTS_ROUTE_PATH}`)).json() as Record<string, unknown>
    expect(view.imageProvider).toBe('wanx')
  })
})

describe('defaults 路由注册安全边界', () => {
  function fakeWebServer(host: string): MediaWebServer & { routes: Map<string, unknown> } {
    const routes = new Map<string, unknown>()
    return {
      host,
      routes,
      register(route) {
        routes.set(`${route.kind}:${route.path}`, route.handler)
        return () => routes.delete(`${route.kind}:${route.path}`)
      },
    }
  }

  it('127.0.0.1 注册 exact 路由并返回注销函数', () => {
    const webServer = fakeWebServer('127.0.0.1')
    const dispose = registerDefaultsRoute(webServer, createRuntimeDefaultsStore())
    expect(dispose).toBeTypeOf('function')
    expect(webServer.routes.has(`exact:${DEFAULTS_ROUTE_PATH}`)).toBe(true)
    dispose?.()
    expect(webServer.routes.size).toBe(0)
  })

  it('0.0.0.0 不注册', () => {
    const webServer = fakeWebServer('0.0.0.0')
    expect(registerDefaultsRoute(webServer, createRuntimeDefaultsStore())).toBeUndefined()
    expect(webServer.routes.size).toBe(0)
  })
})

describe('默认值来源标注（resolveDefaultsSources）', () => {
  it('区分运行时覆盖 / settings 持久默认 / 内置兜底（none）', () => {
    const store = createRuntimeDefaultsStore()
    const persisted: PersistedDefaultsView = { imageProvider: 'wanx', videoDuration: 6 }
    expect(resolveDefaultsSources(store, persisted)).toEqual({
      mediaMode: 'none',
      imageProvider: 'settings',
      imageSize: 'none',
      imageStyle: 'none',
      videoProvider: 'none',
      videoAspectRatio: 'none',
      videoDuration: 'settings',
    })

    store.patch({ mediaMode: 'video', imageProvider: 'seedance', imageSize: '1152*864', videoDuration: 5 })
    expect(resolveDefaultsSources(store, persisted)).toEqual({
      mediaMode: 'override',
      imageProvider: 'override',
      imageSize: 'override',
      imageStyle: 'none',
      videoProvider: 'none',
      videoAspectRatio: 'none',
      videoDuration: 'override',
    })

    // 清除覆盖后来源跟着落回 settings，不能停在上一次的"已覆盖"
    store.patch({ imageProvider: null })
    expect(resolveDefaultsSources(store, persisted).imageProvider).toBe('settings')
  })

  it('与生效视图同源：none 对六项展示字段 = 内置兜底而非「未设置」', () => {
    const store = createRuntimeDefaultsStore()
    const persisted: PersistedDefaultsView = { imageSize: '1024*1024' }
    store.patch({ imageStyle: 'photo', videoAspectRatio: '9:16' })
    const view = resolveDefaultsView(store, persisted)
    const sources = resolveDefaultsSources(store, persisted)

    // mediaMode 没有内置兜底：none ↔ null（文本模式）
    expect(sources.mediaMode).toBe('none')
    expect(view.mediaMode).toBeNull()

    for (const key of DISPLAY_DEFAULT_KEYS) {
      expect(view[key], `${key} 不应为 null（未设置）`).not.toBeNull()
      // 来源只解释层级：none 时值一定等于内置兜底
      if (sources[key] === 'none') expect(view[key]).toEqual(BUILT_IN_DEFAULTS[key])
      if (sources[key] === 'settings') expect(view[key]).toEqual(persisted[key])
      if (sources[key] === 'override') expect(view[key]).not.toBeNull()
    }
  })
})
