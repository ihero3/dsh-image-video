/**
 * Provider 适配器集成测试（vitest + vi.stubGlobal 拦截 fetch）。
 * 覆盖成功路径 + 异常分类（HTTP 500 / 401 / 429），不触发真实网络请求。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { wanxAdapter } from '../src/providers/wanx.ts'
import { seedanceAdapter } from '../src/providers/seedance.ts'
import { threerouterAdapter } from '../src/providers/threerouter.ts'
import { minimaxAdapter } from '../src/providers/minimax.ts'
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

  function captureSubmitBody(): { fetchMock: ReturnType<typeof vi.fn>; body: () => Record<string, unknown> } {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ request_id: 'r', output: { task_id: 'wanx-body-1' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    return {
      fetchMock,
      body: () => JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string),
    }
  }

  it('图生视频：image → input.img_url + 默认 i2v 模型 + 不传 aspect_ratio/audio', async () => {
    const { body } = captureSubmitBody()
    const params: VideoGenParams = { ...videoParams, image: 'data:image/png;base64,QUJD', resolution: '1080P' }
    await wanxAdapter.submitVideo(params, wanxOpts())
    const b = body()
    expect(b.model).toBe('wan2.2-i2v-plus')
    expect(b.input).toMatchObject({ prompt: '海浪拍沙滩', img_url: 'data:image/png;base64,QUJD' })
    expect(b.parameters).toMatchObject({ duration: 5, resolution: '1080P' })
    expect(b.parameters.aspect_ratio).toBeUndefined()
    expect(b.parameters.audio).toBeUndefined()
  })

  it('图生视频：显式 model 优先于 i2v 内置默认', async () => {
    const { body } = captureSubmitBody()
    const params: VideoGenParams = { ...videoParams, model: 'wan2.5-i2v-preview', image: 'https://img.example.com/f.png' }
    await wanxAdapter.submitVideo(params, wanxOpts())
    expect(body().model).toBe('wan2.5-i2v-preview')
  })

  it('文生视频：wan 系默认模型丢弃 duration（能力表），resolution 可选透传', async () => {
    const { body } = captureSubmitBody()
    const r = await wanxAdapter.submitVideo(videoParams, wanxOpts())
    expect(r.droppedDuration).toBe(true)
    const b = body()
    expect(b.model).toBe('wan2.2-t2v-plus')
    expect(b.parameters.duration).toBeUndefined()
    expect(b.parameters.aspect_ratio).toBe('16:9')
    expect(b.parameters.resolution).toBeUndefined()
    const { body: body2 } = captureSubmitBody()
    await wanxAdapter.submitVideo({ ...videoParams, resolution: '480P' }, wanxOpts())
    expect(body2().parameters.resolution).toBe('480P')
  })

  it('文生视频：显式 wan2.7-t2v 同样命中能力表丢弃 duration', async () => {
    const { body } = captureSubmitBody()
    const params: VideoGenParams = { ...videoParams, model: 'wan2.7-t2v' }
    const r = await wanxAdapter.submitVideo(params, wanxOpts())
    expect(r.droppedDuration).toBe(true)
    const b = body()
    expect(b.model).toBe('wan2.7-t2v')
    expect(b.parameters.duration).toBeUndefined()
    expect(b.parameters.aspect_ratio).toBe('16:9')
  })

  it('文生视频：非 wan 系模型保留 duration', async () => {
    const { body } = captureSubmitBody()
    const params: VideoGenParams = { ...videoParams, model: 'wanx2.1-t2v-turbo' }
    const r = await wanxAdapter.submitVideo(params, wanxOpts())
    expect(r.droppedDuration).toBeUndefined()
    expect(body().parameters.duration).toBe(5)
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

  it('图生视频：content 数组追加 image_url 块，resolution 可选透传', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ id: 'seedance-i2v-1' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const params: VideoGenParams = { ...videoParams, image: 'https://img.example.com/first.png', resolution: '720P' }
    const s = await seedanceAdapter.submitVideo(params, seedanceOpts())
    expect(s.taskId).toBe('seedance-i2v-1')
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.content).toEqual([
      { type: 'text', text: '海浪拍沙滩' },
      { type: 'image_url', image_url: { url: 'https://img.example.com/first.png' } },
    ])
    expect(body.duration).toBe('5s')
    expect(body.resolution).toBe('720P')
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

// ============================
// threerouter 适配器测试
// ============================

const threerouterOpts = (): HttpOpts => ({
  apiKey: 'sk-threerouter-test',
  baseURL: 'https://api.threerouter.com/v1',
  timeoutMs: 60000,
  retryTimes: 0,
})

describe('threerouter 适配器', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('submitImage → POST /media/generations，media_kind=image，async=true', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ id: 'mt-img-1', status: 'processing', model: 'wan2.1-image' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const r = await threerouterAdapter.submitImage(imageParams, threerouterOpts())
    expect(r.taskId).toBe('mt-img-1')
    expect(r.async).toBe(true)
    expect(r.mediaType).toBe('image')
    // 验证请求 URL 和 body
    const call = fetchMock.mock.calls[0]
    const reqUrl = String(call[0])
    const req = call[1] as RequestInit
    expect(reqUrl).toContain('/media/generations')
    expect(req.method).toBe('POST')
    const body = JSON.parse(req.body as string)
    expect(body.prompt).toBe('赛博朋克猫')
    expect(body.media_kind).toBe('image')
    expect(body.model).toBe('wan2.1-image')
    expect(body.duration).toBeUndefined()
  })

  it('submitVideo → POST /media/generations，media_kind=video + duration + ratio + 默认注入 768P', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ id: 'mt-vid-1', status: 'processing', model: 'minimax-h3' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const r = await threerouterAdapter.submitVideo(videoParams, threerouterOpts())
    expect(r.taskId).toBe('mt-vid-1')
    expect(r.async).toBe(true)
    expect(r.mediaType).toBe('video')
    const call = fetchMock.mock.calls[0]
    const reqUrl = String(call[0])
    const req = call[1] as RequestInit
    expect(reqUrl).toContain('/media/generations')
    expect(req.method).toBe('POST')
    const body = JSON.parse(req.body as string)
    expect(body.prompt).toBe('海浪拍沙滩')
    expect(body.media_kind).toBe('video')
    // minimax-h3 支持自定义时长，duration 正常携带
    expect(body.duration).toBe(5)
    expect(body.ratio).toBe('16:9')
    // model 未显式传入时使用 threerouter 默认视频模型（minimax-h3，支持 4-15 秒）
    expect(body.model).toBe('minimax-h3')
    // MiniMax 系要求显式 resolution：未指定时注入模型默认档位 768P
    expect(body.resolution).toBe('768P')
    expect(r.droppedDuration).toBeUndefined()
    // 适配器如实回报实际使用的模型，结果层据此透明展示（不再靠配置推断）
    expect(r.model).toBe('minimax-h3')
  })

  it('submitVideo 显式 wan 系模型：丢弃 duration，不注入默认 resolution', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ id: 'mt-vid-wan', status: 'processing' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const params: VideoGenParams = { ...videoParams, model: 'wan2.7-t2v', resolution: undefined }
    const r = await threerouterAdapter.submitVideo(params, threerouterOpts())
    expect(r.droppedDuration).toBe(true)
    expect(r.model).toBe('wan2.7-t2v')
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.model).toBe('wan2.7-t2v')
    expect(body.duration).toBeUndefined()
    expect(body.resolution).toBeUndefined()
    expect(body.ratio).toBe('16:9')
  })

  it('submitVideo 图生视频：body 携带 image + resolution，不再传 ratio', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ id: 'mt-vid-2', status: 'processing' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const params: VideoGenParams = {
      prompt: '让画面动起来', duration: 5, aspectRatio: undefined,
      model: undefined, image: 'data:image/png;base64,QUJD', resolution: '768P',
    }
    const r = await threerouterAdapter.submitVideo(params, threerouterOpts())
    expect(r.taskId).toBe('mt-vid-2')
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.model).toBe('minimax-h3')
    expect(body.image).toBe('data:image/png;base64,QUJD')
    expect(body.resolution).toBe('768P')
    expect(body.ratio).toBeUndefined()
    expect(body.media_kind).toBe('video')
  })

  it('queryTask: processing → running', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ id: 'mt_t', status: 'processing' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const r = await threerouterAdapter.queryTask('mt_t', threerouterOpts())
    expect(r.status).toBe('running')
  })

  it('queryTask: succeeded + url → succeeded + mediaUrl', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ id: 'mt_t', status: 'succeeded', url: 'https://cdn/result.mp4' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const r = await threerouterAdapter.queryTask('mt_t', threerouterOpts())
    expect(r.status).toBe('succeeded')
    if (r.status === 'succeeded') expect(r.mediaUrl).toBe('https://cdn/result.mp4')
  })

  it('queryTask: succeeded 无 url → succeeded + /content 302 端点', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ id: 'mt_t', status: 'succeeded' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const r = await threerouterAdapter.queryTask('mt_t', threerouterOpts())
    expect(r.status).toBe('succeeded')
    if (r.status === 'succeeded') expect(r.mediaUrl).toContain('/media/mt_t/content')
  })

  it('queryTask: failed（error 为对象）→ failed + error message', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ id: 'mt_t', status: 'failed', error: { message: '上游超时' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const r = await threerouterAdapter.queryTask('mt_t', threerouterOpts())
    expect(r.status).toBe('failed')
    if (r.status === 'failed') expect(r.error).toContain('上游超时')
  })

  it('queryTask: failed（error 为字符串）→ failed + 错误文本', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ id: 'mt_t', status: 'failed', error: '内容审核未通过' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const r = await threerouterAdapter.queryTask('mt_t', threerouterOpts())
    expect(r.status).toBe('failed')
    if (r.status === 'failed') expect(r.error).toContain('内容审核未通过')
  })

  it('queryTask: cancelled → failed', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ id: 'mt_t', status: 'cancelled' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const r = await threerouterAdapter.queryTask('mt_t', threerouterOpts())
    expect(r.status).toBe('failed')
  })

  it('submitVideo 401 → auth 不可重试', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ code: 'API_KEY_REQUIRED', message: 'API key is required' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    ))
    await expect(() => threerouterAdapter.submitVideo(videoParams, threerouterOpts())).rejects
      .toSatisfy((e: { kind: string; retryable: boolean }) =>
        e.kind === 'auth' && e.retryable === false)
  })

  it('submitVideo 500 → network 可重试', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ message: 'boom' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    ))
    await expect(() => threerouterAdapter.submitVideo(videoParams, threerouterOpts())).rejects
      .toSatisfy((e: { kind: string; retryable: boolean }) =>
        e.kind === 'network' && e.retryable === true)
  })
})

describe('MiniMax adapter（官方平台 video-generation v2，按文档实现待实测）', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  const minimaxOpts = (retryTimes = 0): HttpOpts => ({
    apiKey: 'sk-minimax-mock',
    baseURL: 'https://api.minimaxi.com/v1',
    timeoutMs: 10_000, retryTimes, signal,
  })

  it('submitVideo：缺省注入 resolution=768P，返回 task_id', async () => {
    vi.stubGlobal('fetch', async (_url: URL | string, init: RequestInit = {}) => {
      const h = init.headers as Record<string, string> || {}
      expect(h.Authorization).toBe('Bearer sk-minimax-mock')
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      expect(body.model).toBe('MiniMax-Hailuo-02')
      expect(body.resolution).toBe('768P')
      expect(body.duration).toBe(5)
      expect(body.first_frame_image).toBeUndefined()
      return new Response(
        JSON.stringify({ task_id: 'mm-1', base_resp: { status_code: 0, status_msg: 'success' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })
    const s = await minimaxAdapter.submitVideo(videoParams, minimaxOpts())
    expect(s.async).toBe(true)
    expect(s.taskId).toBe('mm-1')
    expect(s.mediaType).toBe('video')
    // 未显式传 model 时如实回报官方内置默认模型
    expect(s.model).toBe('MiniMax-Hailuo-02')
  })

  it('submitVideo：显式 resolution / 首帧图透传', async () => {
    vi.stubGlobal('fetch', async (_url: URL | string, init: RequestInit = {}) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      expect(body.resolution).toBe('1080P')
      expect(body.first_frame_image).toBe('data:image/png;base64,AAA')
      expect(body.model).toBe('MiniMax-Hailuo-2.3')
      return new Response(
        JSON.stringify({ task_id: 'mm-2', base_resp: { status_code: 0 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })
    await minimaxAdapter.submitVideo(
      { ...videoParams, duration: 6, resolution: '1080P', image: 'data:image/png;base64,AAA', model: 'MiniMax-Hailuo-2.3' },
      minimaxOpts(),
    )
  })

  it('submitVideo：base_resp 非零状态码 → task 错误（含 status_msg 供分类）', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ base_resp: { status_code: 2013, status_msg: 'invalid params: model not found' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    await expect(() => minimaxAdapter.submitVideo(videoParams, minimaxOpts())).rejects
      .toSatisfy((e: { kind: string; message: string }) =>
        e.kind === 'task' && e.message.includes('model not found'))
  })

  it('queryTask：Queueing/Processing/Success（download_url）状态映射', async () => {
    for (const [status, expected] of [['Queueing', 'pending'], ['Processing', 'running']] as const) {
      vi.stubGlobal('fetch', async () => new Response(
        JSON.stringify({ task_id: 'mm-1', status, base_resp: { status_code: 0 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
      const r = await minimaxAdapter.queryTask('mm-1', minimaxOpts())
      expect(r.status).toBe(expected)
    }
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ task_id: 'mm-1', status: 'Success', file: { download_url: 'https://mm.example.com/v.mp4' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const done = await minimaxAdapter.queryTask('mm-1', minimaxOpts())
    expect(done).toEqual({ status: 'succeeded', mediaUrl: 'https://mm.example.com/v.mp4' })
  })

  it('queryTask：Success 仅带 file_id 时经 files/retrieve 二次换取', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async (url: URL | string) => {
      calls++
      if (calls === 1) {
        expect(String(url)).toContain('/query/video_generation?task_id=mm-3')
        return new Response(
          JSON.stringify({ task_id: 'mm-3', status: 'Success', file_id: 9001 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      expect(String(url)).toContain('/files/retrieve?file_id=9001')
      return new Response(
        JSON.stringify({ file: { download_url: 'https://mm.example.com/v2.mp4' }, base_resp: { status_code: 0 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })
    const r = await minimaxAdapter.queryTask('mm-3', minimaxOpts())
    expect(r).toEqual({ status: 'succeeded', mediaUrl: 'https://mm.example.com/v2.mp4' })
  })

  it('queryTask：Fail → failed（取 base_resp.status_msg）', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ task_id: 'mm-4', status: 'Fail', base_resp: { status_code: 1027, status_msg: 'content violation' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const r = await minimaxAdapter.queryTask('mm-4', minimaxOpts())
    expect(r).toEqual({ status: 'failed', error: 'content violation' })
  })

  it('submitImage：明确报不支持（工具层据此回退聚合器）', async () => {
    await expect(() => minimaxAdapter.submitImage(imageParams, minimaxOpts())).rejects
      .toSatisfy((e: { kind: string; message: string }) =>
        e.kind === 'task' && e.message.includes('不支持图片生成'))
  })
})
