/**
 * Provider 适配器集成测试（vitest + vi.stubGlobal 拦截 fetch）。
 * 覆盖成功路径 + 异常分类（HTTP 500 / 401 / 429），不触发真实网络请求。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { wanxAdapter } from '../src/providers/wanx.ts'
import { seedanceAdapter } from '../src/providers/seedance.ts'
import type { ImageGenParams, VideoGenParams, HttpOpts } from '../src/providers/types.ts'

// Seedance 图片是同步接口 `/images/generations`，视频走 `/contents/generations/tasks`
// 万象（wanx）图/视频都走异步 DashScope 接口
const IMG_SIZE = '1024*1024'
const imageParams: ImageGenParams = { prompt: '赛博朋克猫', size: IMG_SIZE, model: undefined }
const videoParams: VideoGenParams = { prompt: '海浪拍沙滩', duration: 5, aspectRatio: '16:9', model: undefined }
const signal = new AbortController().signal

const wanxOpts = (retryTimes = 0): HttpOpts => ({
  apiKey: 'sk-wanx-mock',
  baseURL: 'https://dashscope.aliyuncs.com/api/v1',
  timeoutMs: 10_000, retryTimes, signal,
})
const seedanceOpts = (retryTimes = 0): HttpOpts => ({
  apiKey: 'sk-ark-mock',
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  timeoutMs: 10_000, retryTimes, signal,
})

describe('Wanx adapter', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  function installHappy(opts: { isVideo: boolean }) {
    let calls = 0
    vi.stubGlobal('fetch', async (_url: URL | string, init: RequestInit = {}) => {
      calls++
      const step = calls === 1 ? 'submit' : 'query'
      const h = init.headers as Record<string, string> || {}
      expect(h.Authorization).toBe('Bearer sk-wanx-mock')
      if (step === 'submit') {
        return new Response(
          JSON.stringify({ request_id: 'r', output: { task_id: 'wanx-42' }, task_status: 'PENDING' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      const output = opts.isVideo
        ? { task_status: 'SUCCEEDED', video_url: 'https://wanx.example.com/out.mp4' }
        : { task_status: 'SUCCEEDED', results: [{ url: 'https://wanx.example.com/out.png' }] }
      return new Response(JSON.stringify({ request_id: 'r', output }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    })
  }

  it('文生图 submit → query 成功路径', async () => {
    installHappy({ isVideo: false })
    const s = await wanxAdapter.submitImage(imageParams, wanxOpts())
    expect(s.async).toBe(true)
    expect(s.taskId).toBe('wanx-42')
    const q = await wanxAdapter.queryTask(s.taskId, wanxOpts())
    expect(q.status).toBe('succeeded')
    expect(q.status === 'succeeded' ? q.mediaUrl : '').toContain('.png')
  })

  it('文生视频 submit → query 成功路径', async () => {
    installHappy({ isVideo: true })
    const s = await wanxAdapter.submitVideo(videoParams, wanxOpts())
    expect(s.async).toBe(true)
    const q = await wanxAdapter.queryTask(s.taskId, wanxOpts())
    expect(q.status).toBe('succeeded')
    expect(q.status === 'succeeded' ? q.mediaUrl : '').toContain('.mp4')
  })

  it('query PENDING / RUNNING → pending / running', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ output: { task_status: 'PENDING' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const q1 = await wanxAdapter.queryTask('t', wanxOpts())
    expect(q1.status).toBe('pending')

    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ output: { task_status: 'RUNNING' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const q2 = await wanxAdapter.queryTask('t', wanxOpts())
    expect(q2.status).toBe('running')
  })

  it('submit HTTP 500 → GenerationError(kind=network, retryable=true)', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ message: 'server down' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    ))
    await expect(() => wanxAdapter.submitImage(imageParams, wanxOpts())).rejects
      .toSatisfy((e: { kind: string; retryable: boolean }) =>
        e.kind === 'network' && e.retryable === true)
  })

  it('鉴权 401 → auth 不可重试', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ message: 'Invalid API Key' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    ))
    await expect(() => wanxAdapter.submitImage(imageParams, wanxOpts())).rejects
      .toSatisfy((e: { kind: string; retryable: boolean }) =>
        e.kind === 'auth' && e.retryable === false)
  })

  it('429 → quota 不可重试', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ message: 'Rate limit' }),
      { status: 429, headers: { 'content-type': 'application/json' } },
    ))
    await expect(() => wanxAdapter.submitVideo(videoParams, wanxOpts())).rejects
      .toSatisfy((e: { kind: string; retryable: boolean }) =>
        e.kind === 'quota' && e.retryable === false)
  })
})

describe('Seedance adapter', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  function installHappy() {
    let calls = 0
    vi.stubGlobal('fetch', async (url: URL | string, init: RequestInit = {}) => {
      calls++
      const step = calls === 1 ? 'submit' : 'query'
      const h = init.headers as Record<string, string> || {}
      expect(h.Authorization).toBe('Bearer sk-ark-mock')
      const u = String(url)
      // 文生图：同步接口 /images/generations，一步返回 URL
      if (u.includes('/images/generations')) {
        return new Response(JSON.stringify({
          created: 1, data: [{ url: 'https://seedance.example.com/out.png' }],
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      // 文生视频：提交 /contents/generations/tasks → taskId
      if (u.includes('/tasks') && step === 'submit') {
        return new Response(JSON.stringify({ id: 'seedance-77' }), {
          status: 200, headers: { 'content-type': 'application/json' },
        })
      }
      // 文生视频：查询 /contents/generations/tasks/{id}
      if (u.includes('/tasks/seedance-77')) {
        return new Response(JSON.stringify({
          id: 'seedance-77', status: 'succeeded',
          content: { video_url: { url: 'https://seedance.example.com/out.mp4' } },
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({}), { status: 404, headers: { 'content-type': 'application/json' } })
    })
  }

  it('文生图 submitImage 同步返回 URL', async () => {
    installHappy()
    const s = await seedanceAdapter.submitImage(imageParams, seedanceOpts())
    expect(s.async).toBe(false)
    expect(s.mediaUrl).toContain('.png')
  })

  it('文生视频 submit → query 成功路径', async () => {
    installHappy()
    const s = await seedanceAdapter.submitVideo(videoParams, seedanceOpts())
    expect(s.async).toBe(true)
    expect(s.taskId).toBe('seedance-77')
    const q = await seedanceAdapter.queryTask(s.taskId, seedanceOpts())
    expect(q.status).toBe('succeeded')
    expect(q.status === 'succeeded' ? q.mediaUrl : '').toContain('.mp4')
  })

  it('视频 query queued / running → pending / running', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ status: 'queued' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const q1 = await seedanceAdapter.queryTask('t', seedanceOpts())
    expect(q1.status).toBe('pending')

    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ status: 'running' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const q2 = await seedanceAdapter.queryTask('t', seedanceOpts())
    expect(q2.status).toBe('running')
  })

  it('submitVideo 500 → network 可重试', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ message: 'boom' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    ))
    await expect(() => seedanceAdapter.submitVideo(videoParams, seedanceOpts())).rejects
      .toSatisfy((e: { kind: string; retryable: boolean }) =>
        e.kind === 'network' && e.retryable === true)
  })

  it('鉴权 401 → auth 不可重试', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ message: 'Invalid Token' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    ))
    await expect(() => seedanceAdapter.submitImage(imageParams, seedanceOpts())).rejects
      .toSatisfy((e: { kind: string; retryable: boolean }) =>
        e.kind === 'auth' && e.retryable === false)
  })
})
