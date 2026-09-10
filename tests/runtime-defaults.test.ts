/**
 * 运行时默认值测试：store 内存语义、风格后缀拼接、POST 协议校验、
 * 回环路由 handler（真实 node:http + fetch，对齐 media-route.test.ts 模式）
 * 与注册安全边界（非 127.0.0.1 不注册）。
 *
 * @module dsh-image-video/tests/runtime-defaults
 */

import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  applyImageStyle,
  createDefaultsRouteHandler,
  createRuntimeDefaultsStore,
  DEFAULTS_ROUTE_PATH,
  IMAGE_SIZE_OPTIONS,
  IMAGE_STYLE_OPTIONS,
  parseDefaultsPatch,
  registerDefaultsRoute,
  resolveModelProvider,
} from '../src/runtime-defaults.ts'
import type { MediaWebServer } from '../src/media-route.ts'

describe('运行时默认值存储', () => {
  it('初始快照为空，get 返回副本', () => {
    const store = createRuntimeDefaultsStore()
    expect(store.get()).toEqual({})
    const snapshot = store.get()
    snapshot.imageModel = 'tampered'
    expect(store.get()).toEqual({})
  })

  it('patch 合并写入，null 清除对应字段，其余字段保留', () => {
    const store = createRuntimeDefaultsStore()
    store.patch({ imageModel: 'wan2.1-image', videoDuration: 6 })
    expect(store.get()).toEqual({ imageModel: 'wan2.1-image', videoDuration: 6 })
    store.patch({ imageModel: null })
    expect(store.get()).toEqual({ videoDuration: 6 })
  })

  it('reset 清空全部覆盖', () => {
    const store = createRuntimeDefaultsStore()
    store.patch({ imageSize: '1280*720', imageStyle: 'anime' })
    store.reset()
    expect(store.get()).toEqual({})
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

describe('模型 → 服务商映射', () => {
  it('图像模型命中各服务商', () => {
    expect(resolveModelProvider('image', 'wan2.1-image')).toBe('threerouter')
    expect(resolveModelProvider('image', 'wanx2.1-t2i-turbo')).toBe('wanx')
    expect(resolveModelProvider('image', 'doubao-seedream-3-0-t2i-250415')).toBe('seedance')
    expect(resolveModelProvider('image', 'doubao-seedream-4-0-250828')).toBe('seedance')
  })

  it('视频模型命中各服务商（wan2.2-t2v-plus 固定路由 Threerouter）', () => {
    expect(resolveModelProvider('video', 'wan2.2-t2v-plus')).toBe('threerouter')
    expect(resolveModelProvider('video', 'doubao-seedance-1-0-pro-250428')).toBe('seedance')
    expect(resolveModelProvider('video', 'doubao-seedance-1-0-lite-t2v-250428')).toBe('seedance')
  })

  it('自定义模型 / 空串 / 跨类型查询返回 undefined', () => {
    expect(resolveModelProvider('image', 'my-custom-model')).toBeUndefined()
    expect(resolveModelProvider('video', 'my-custom-model')).toBeUndefined()
    expect(resolveModelProvider('image', '')).toBeUndefined()
    expect(resolveModelProvider('video', 'wan2.1-image')).toBeUndefined()
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
    const result = parseDefaultsPatch({ imageModel: 'wan2.1-image', imageSize: '', videoDuration: null })
    expect(result).toEqual({
      ok: true,
      patch: { imageModel: 'wan2.1-image', imageSize: null, videoDuration: null },
    })
  })

  it('imageSize 仅接受白名单尺寸', () => {
    expect(parseDefaultsPatch({ imageSize: '1024*1024' }).ok).toBe(true)
    const bad = parseDefaultsPatch({ imageSize: '999*999' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toContain('imageSize')
  })

  it('imageSize 白名单覆盖五个比例', () => {
    expect(IMAGE_SIZE_OPTIONS.map((o) => o.size)).toEqual(['1024*1024', '1152*864', '864*1152', '1280*720', '720*1280'])
  })

  it('imageStyle 仅接受白名单风格', () => {
    expect(parseDefaultsPatch({ imageStyle: 'ink' }).ok).toBe(true)
    expect(parseDefaultsPatch({ imageStyle: '' }).ok).toBe(true) // 空 = 自动（清除）
    expect(parseDefaultsPatch({ imageStyle: 'oil' }).ok).toBe(false)
  })

  it('videoAspectRatio 仅接受 16:9 / 9:16 / 1:1', () => {
    expect(parseDefaultsPatch({ videoAspectRatio: '16:9' }).ok).toBe(true)
    expect(parseDefaultsPatch({ videoAspectRatio: '4:3' }).ok).toBe(false)
  })

  it('videoDuration 仅接受 1-10 整数', () => {
    expect(parseDefaultsPatch({ videoDuration: 8 }).ok).toBe(true)
    expect(parseDefaultsPatch({ videoDuration: 0 }).ok).toBe(false)
    expect(parseDefaultsPatch({ videoDuration: 11 }).ok).toBe(false)
    expect(parseDefaultsPatch({ videoDuration: 5.5 }).ok).toBe(false)
    expect(parseDefaultsPatch({ videoDuration: '5' }).ok).toBe(false)
  })

  it('模型字段拒绝空串与超长', () => {
    expect(parseDefaultsPatch({ videoModel: '  ' }).ok).toBe(false)
    expect(parseDefaultsPatch({ imageModel: 'x'.repeat(101) }).ok).toBe(false)
    expect(parseDefaultsPatch({ imageModel: 'wan2.1-image' }).ok).toBe(true)
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

  it('GET 初始返回六字段全 null 视图', async () => {
    const res = await fetch(`${base}${DEFAULTS_ROUTE_PATH}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      imageModel: null,
      imageSize: null,
      imageStyle: null,
      videoModel: null,
      videoAspectRatio: null,
      videoDuration: null,
    })
  })

  it('POST 合法写入后 GET 读回覆盖值', async () => {
    const post = await fetch(`${base}${DEFAULTS_ROUTE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageStyle: 'anime', videoDuration: 8 }),
    })
    expect(post.status).toBe(200)
    expect(await post.json()).toEqual({
      imageModel: null,
      imageSize: null,
      imageStyle: 'anime',
      videoModel: null,
      videoAspectRatio: null,
      videoDuration: 8,
    })
  })

  it('POST null 清除覆盖', async () => {
    await fetch(`${base}${DEFAULTS_ROUTE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageStyle: null }),
    })
    const res = await fetch(`${base}${DEFAULTS_ROUTE_PATH}`)
    const view = await res.json() as Record<string, unknown>
    expect(view.imageStyle).toBeNull()
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
