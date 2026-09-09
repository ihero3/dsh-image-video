/**
 * outputs 媒体路由集成测试：用真实 node:http 服务 + 内置 fetch 验证
 * createOutputsRouteHandler 的流式响应与安全边界，避免 mock ServerResponse
 * 的流式接口。registerOutputsRoute 与纯函数用最小桩件直测。
 *
 * @module dsh-image-video/tests/media-route
 */

import { createServer, type Server } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, sep } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  contentTypeForExtension,
  createOutputsRouteHandler,
  OUTPUTS_ROUTE_PATH,
  parseRange,
  registerOutputsRoute,
  safeOutputFileName,
} from '../src/media-route.ts'

/** 记录注册路由的最小 webServer 桩件。 */
function fakeWebServer(host: string): {
  server: import('../src/media-route.ts').MediaWebServer
  routes: Map<string, { kind: string; path: string }>
} {
  const routes = new Map<string, { kind: string; path: string }>()
  return {
    server: {
      host,
      register(route) {
        const id = `${route.kind}:${route.path}`
        if (routes.has(id)) throw new Error(`duplicate route: ${id}`)
        routes.set(id, { kind: route.kind, path: route.path })
        return () => {
          routes.delete(id)
        }
      },
    },
    routes,
  }
}

let server: Server
let base: string
let outputsDir: string
let secretDir: string

beforeAll(async () => {
  outputsDir = await mkdtemp(join(tmpdir(), 'dsh-media-route-'))
  await writeFile(join(outputsDir, 'clip.mp4'), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]))
  await writeFile(join(outputsDir, 'still.png'), Buffer.from([9, 8, 7]))
  await writeFile(join(outputsDir, 'notes.txt'), Buffer.from('text not allowed'))
  // 目录遍历目标：outputs 同级的真实文件，必须不可达
  secretDir = await mkdtemp(join(tmpdir(), 'dsh-media-secret-'))
  await writeFile(join(secretDir, 'secret.txt'), Buffer.from('secret'))

  server = createServer((req, res) => {
    void createOutputsRouteHandler(outputsDir)(req, res)
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
  await rm(outputsDir, { recursive: true, force: true })
  await rm(secretDir, { recursive: true, force: true })
})

describe('outputs 媒体路由 handler', () => {
  it('GET 白名单媒体返回 200 与正确 Content-Type、字节流', async () => {
    const res = await fetch(`${base}/outputs/clip.mp4`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('video/mp4')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]))

    const image = await fetch(`${base}/outputs/still.png`)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await image.arrayBuffer())).toEqual(Buffer.from([9, 8, 7]))
  })

  it('白名单外扩展名与缺失文件返回 404', async () => {
    expect((await fetch(`${base}/outputs/notes.txt`)).status).toBe(404)
    expect((await fetch(`${base}/outputs/missing.mp4`)).status).toBe(404)
    expect((await fetch(`${base}/outputs`)).status).toBe(404)
    expect((await fetch(`${base}/outputs/`)).status).toBe(404)
  })

  it('目录遍历（含对 outputs 外真实文件的编码路径）返回 404', async () => {
    const rel = `..${sep}${basename(secretDir)}${sep}secret.txt`
    expect((await fetch(`${base}/outputs/${encodeURIComponent(rel)}`)).status).toBe(404)
    expect((await fetch(`${base}/outputs/..%2F..%2Fsecret.txt`)).status).toBe(404)
  })

  it('Range 请求返回 206 分段流', async () => {
    const mid = await fetch(`${base}/outputs/clip.mp4`, { headers: { Range: 'bytes=2-4' } })
    expect(mid.status).toBe(206)
    expect(mid.headers.get('content-range')).toBe('bytes 2-4/8')
    expect(Buffer.from(await mid.arrayBuffer())).toEqual(Buffer.from([2, 3, 4]))

    const suffix = await fetch(`${base}/outputs/clip.mp4`, { headers: { Range: 'bytes=-3' } })
    expect(suffix.status).toBe(206)
    expect(suffix.headers.get('content-range')).toBe('bytes 5-7/8')
    expect(Buffer.from(await suffix.arrayBuffer())).toEqual(Buffer.from([5, 6, 7]))

    const open = await fetch(`${base}/outputs/clip.mp4`, { headers: { Range: 'bytes=5-' } })
    expect(open.status).toBe(206)
    expect(open.headers.get('content-range')).toBe('bytes 5-7/8')
  })

  it('不可满足的 Range 返回 416 与 bytes */size', async () => {
    const res = await fetch(`${base}/outputs/clip.mp4`, { headers: { Range: 'bytes=100-' } })
    expect(res.status).toBe(416)
    expect(res.headers.get('content-range')).toBe('bytes */8')
  })

  it('HEAD 返回与 GET 一致的头且无响应体', async () => {
    const res = await fetch(`${base}/outputs/clip.mp4`, { method: 'HEAD' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-length')).toBe('8')
    expect(res.headers.get('content-type')).toBe('video/mp4')
    expect(await res.arrayBuffer()).toEqual(new ArrayBuffer(0))
  })

  it('非 GET/HEAD 方法返回 405', async () => {
    const res = await fetch(`${base}/outputs/clip.mp4`, { method: 'POST' })
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('GET, HEAD')
  })
})

describe('parseRange', () => {
  it('解析合法单段区间并截断越界末字节', () => {
    expect(parseRange('bytes=0-3', 8)).toEqual({ start: 0, end: 3 })
    expect(parseRange('bytes=2-', 8)).toEqual({ start: 2, end: 7 })
    expect(parseRange('bytes=2-99', 8)).toEqual({ start: 2, end: 7 })
    expect(parseRange('bytes=-3', 8)).toEqual({ start: 5, end: 7 })
  })

  it('拒绝非法头与不可满足区间', () => {
    expect(parseRange(undefined, 8)).toBeUndefined()
    expect(parseRange('items=0-3', 8)).toBeUndefined()
    expect(parseRange('bytes=abc-3', 8)).toBeUndefined()
    expect(parseRange('bytes=8-', 8)).toBeUndefined()
    expect(parseRange('bytes=5-3', 8)).toBeUndefined()
    expect(parseRange('bytes=-0', 8)).toBeUndefined()
  })
})

describe('safeOutputFileName / contentTypeForExtension', () => {
  it('接受单段文件名，拒绝相对段、分隔符与越界解析', () => {
    expect(safeOutputFileName('clip.mp4', outputsDir)).toBe('clip.mp4')
    expect(safeOutputFileName('', outputsDir)).toBeUndefined()
    expect(safeOutputFileName('.', outputsDir)).toBeUndefined()
    expect(safeOutputFileName('..', outputsDir)).toBeUndefined()
    expect(safeOutputFileName('a/b.mp4', outputsDir)).toBeUndefined()
    expect(safeOutputFileName('a\\b.mp4', outputsDir)).toBeUndefined()
    expect(safeOutputFileName(`${sep}abs.mp4`, outputsDir)).toBeUndefined()
  })

  it('扩展名映射白名单，忽略大小写', () => {
    expect(contentTypeForExtension('.mp4')).toBe('video/mp4')
    expect(contentTypeForExtension('.MP4')).toBe('video/mp4')
    expect(contentTypeForExtension('.png')).toBe('image/png')
    expect(contentTypeForExtension('.txt')).toBeUndefined()
    expect(contentTypeForExtension('')).toBeUndefined()
  })
})

describe('registerOutputsRoute', () => {
  it('回环地址注册 prefix 路由，注销函数移除路由', () => {
    const fake = fakeWebServer('127.0.0.1')
    const dispose = registerOutputsRoute(fake.server, outputsDir)
    expect(dispose).toBeTypeOf('function')
    expect(fake.routes.get(`prefix:${OUTPUTS_ROUTE_PATH}`)).toEqual({ kind: 'prefix', path: '/outputs' })
    dispose!()
    expect(fake.routes.size).toBe(0)
  })

  it('非回环地址不注册，媒体不暴露到局域网', () => {
    const fake = fakeWebServer('0.0.0.0')
    expect(registerOutputsRoute(fake.server, outputsDir)).toBeUndefined()
    expect(fake.routes.size).toBe(0)
  })
})
