/**
 * threerouter 异步图片契约测试（vi.stubGlobal 拦截 fetch，不发真实请求）。
 * 断言的重点是**契约细节**：走哪个端点、请求体里有没有多余字段、幂等键怎么带、
 * 202/409/404 与轮询状态怎么映射——这些是「不重复生成」的地基。
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { threerouterAdapter } from '../src/providers/threerouter.ts'
import { CODE_IDEMPOTENCY_IN_PROGRESS, GenerationError, isAsyncImageUnavailableError } from '../src/http-client.ts'
import type { HttpOpts, ImageGenParams } from '../src/providers/types.ts'

const BASE = 'https://api.threerouter.com/v1'
const opts: HttpOpts = {
  apiKey: 'sk-test-key',
  baseURL: BASE,
  timeoutMs: 10_000,
  retryTimes: 3,
  signal: new AbortController().signal,
}
const params: ImageGenParams = {
  prompt: '一只赛博朋克猫',
  size: '1024*1024',
  model: 'qwen-image-3.0',
  requestId: 'req-abc',
}

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: Record<string, unknown> | undefined
}

/** 安装 fetch 桩：按顺序返回给定响应，并记录每次调用的请求详情。 */
function stubFetch(...responses: Array<Response | (() => Response)>): Call[] {
  const calls: Call[] = []
  let index = 0
  vi.stubGlobal('fetch', async (url: URL | string, init: RequestInit = {}) => {
    const rawBody = typeof init.body === 'string' ? init.body : undefined
    calls.push({
      url: String(url),
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: rawBody === undefined ? undefined : JSON.parse(rawBody) as Record<string, unknown>,
    })
    const next = responses[Math.min(index, responses.length - 1)]
    index += 1
    return typeof next === 'function' ? next() : next
  })
  return calls
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('异步提交：POST /images/generations/async', () => {
  it('202 接受 → 端点/请求体/幂等键/Retry-After 全部符合契约', async () => {
    const calls = stubFetch(json(
      { id: 'imgtask_0123456789abcdef', task_id: 'imgtask_0123456789abcdef', object: 'image.generation.task', status: 'processing', request_id: 'req-abc' },
      202,
      { 'location': `${BASE}/images/tasks/imgtask_0123456789abcdef`, 'retry-after': '3', 'cache-control': 'no-store' },
    ))
    const accepted = await threerouterAdapter.imageAsync!.submit(params, opts)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${BASE}/images/generations/async`)
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.headers.Authorization).toBe('Bearer sk-test-key')
    expect(calls[0]?.headers['Idempotency-Key']).toBe('req-abc')
    // 契约要点：幂等键只走请求头。同步端点的请求体会原样转发上游，
    // 而 OpenAI 系上游对未知顶层参数严格拒绝（Unrecognized request argument）。
    expect(calls[0]?.body).not.toHaveProperty('request_id')
    expect(calls[0]?.body.n).toBe(1)
    expect(calls[0]?.body.response_format).toBe('url')
    expect(accepted.taskId).toBe('imgtask_0123456789abcdef')
    expect(accepted.retryAfterSec).toBe(3)
    expect(accepted.model).toBe('qwen-image-3.0')
  })

  it('多参考图：首图走 image，完整顺序走 image_urls', async () => {
    const calls = stubFetch(json({ task_id: 'imgtask_multi', status: 'processing' }, 202))
    await threerouterAdapter.imageAsync!.submit({
      prompt: '只替换脸部，保持底图构图、服装和背景不变',
      size: '1024*1024',
      model: 'qwen-image-3.0-pro',
      images: ['data:image/jpeg;base64,BASE', 'data:image/jpeg;base64,FACE'],
      requestId: 'req-multi',
    }, opts)
    expect(calls[0]?.body.image).toBe('data:image/jpeg;base64,BASE')
    expect(calls[0]?.body.image_urls).toEqual([
      'data:image/jpeg;base64,BASE',
      'data:image/jpeg;base64,FACE',
    ])
  })

  it('X-Idempotency-Replayed → 标记回放（本次没有新建任务）', async () => {
    stubFetch(json({ task_id: 'imgtask_old', status: 'processing' }, 202, { 'x-idempotency-replayed': 'true' }))
    const accepted = await threerouterAdapter.imageAsync!.submit(params, opts)
    expect(accepted.replayed).toBe(true)
  })

  it('202 但没有 task_id → 响亮失败（无法轮询的响应不可接受）', async () => {
    stubFetch(json({ status: 'processing' }, 202))
    await expect(threerouterAdapter.imageAsync!.submit(params, opts)).rejects.toThrow(/未包含 task_id/)
  })

  it('404 not enabled → 可被识别为「异步端点不可用」，供调用方降级同步', async () => {
    stubFetch(json({ error: { type: 'not_found_error', code: 'not_found_error', message: 'async image tasks are not enabled' } }, 404))
    const err = await threerouterAdapter.imageAsync!.submit(params, opts).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GenerationError)
    expect((err as GenerationError).status).toBe(404)
    expect(isAsyncImageUnavailableError(err)).toBe(true)
  })

  it('404 平台不支持 → 同样可被识别为异步不可用', async () => {
    stubFetch(json({ error: { code: 'not_found_error', message: 'Images API is not supported for this platform' } }, 404))
    const err = await threerouterAdapter.imageAsync!.submit(params, opts).catch((e: unknown) => e)
    expect(isAsyncImageUnavailableError(err)).toBe(true)
  })

  it('409 进行中 → 带出 IDEMPOTENCY_IN_PROGRESS 与 Retry-After（任务已存在，应去反查）', async () => {
    stubFetch(json(
      { error: { type: 'IDEMPOTENCY_IN_PROGRESS', code: 'IDEMPOTENCY_IN_PROGRESS', message: 'request with this idempotency key is in progress' } },
      409,
      { 'retry-after': '2' },
    ))
    const err = await threerouterAdapter.imageAsync!.submit(params, opts).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GenerationError)
    expect((err as GenerationError).code).toBe(CODE_IDEMPOTENCY_IN_PROGRESS)
    expect((err as GenerationError).status).toBe(409)
    expect((err as GenerationError).retryAfterMs).toBe(2_000)
  })

  it('提交永不自动重试：503 只打一次请求（写操作不能藏在 HTTP 重试里）', async () => {
    const calls = stubFetch(json({ error: { code: 'capacity_error', message: 'No available media generation channels' } }, 503))
    await expect(threerouterAdapter.imageAsync!.submit(params, opts)).rejects.toThrow()
    expect(calls).toHaveLength(1)
  })

  it('图生图：参考图经 image 字段提交，模型默认走 Pro 编辑模型', async () => {
    const calls = stubFetch(json({ task_id: 'imgtask_edit', status: 'processing' }, 202))
    await threerouterAdapter.imageAsync!.submit({ prompt: '改成夜景', size: '3:4', image: 'data:image/png;base64,QUJD', requestId: 'req-img' }, opts)
    expect(calls[0]?.body.image).toBe('data:image/png;base64,QUJD')
    expect(calls[0]?.body.model).toBe('qwen-image-3.0-pro')
    // qwen 系尺寸按上游要求换算为 宽*高
    expect(calls[0]?.body.size).toBe('1152*1536')
  })
})

describe('任务查询：GET /images/tasks/{task_id}', () => {
  it('processing → running', async () => {
    const calls = stubFetch(json({ task_id: 't1', status: 'processing' }))
    const result = await threerouterAdapter.imageAsync!.query('t1', opts)
    expect(result.status).toBe('running')
    expect(calls[0]?.url).toBe(`${BASE}/images/tasks/t1`)
    expect(calls[0]?.method).toBe('GET')
  })

  it('succeeded + image_url → 取顶层 URL', async () => {
    stubFetch(json({ task_id: 't2', status: 'succeeded', legacy_status: 'completed', image_url: 'https://cdn.example.com/a.png' }))
    const result = await threerouterAdapter.imageAsync!.query('t2', opts)
    expect(result).toEqual({ status: 'succeeded', mediaUrl: 'https://cdn.example.com/a.png' })
  })

  it('completed（旧状态名）+ result.data[0].url → 同样取到结果', async () => {
    stubFetch(json({ task_id: 't3', status: 'completed', legacy_status: 'completed', result: { data: [{ url: 'https://cdn.example.com/b.png' }] } }))
    const result = await threerouterAdapter.imageAsync!.query('t3', opts)
    expect(result).toEqual({ status: 'succeeded', mediaUrl: 'https://cdn.example.com/b.png' })
  })

  it('failed → 带出 code/message 与上游 HTTP 状态', async () => {
    stubFetch(json({
      task_id: 't4',
      status: 'failed',
      legacy_status: 'failed',
      http_status: 502,
      error: { type: 'api_error', code: 'api_error', message: 'Upstream request failed' },
    }))
    const result = await threerouterAdapter.imageAsync!.query('t4', opts)
    expect(result.status).toBe('failed')
    expect(result.status === 'failed' ? result.error : '').toBe('api_error: Upstream request failed（上游 HTTP 502）')
  })

  it('成功但缺 URL → 判定失败而不是空等', async () => {
    stubFetch(json({ task_id: 't5', status: 'succeeded' }))
    const result = await threerouterAdapter.imageAsync!.query('t5', opts)
    expect(result.status).toBe('failed')
  })

  it('未知状态 → 判定失败（不空等；服务端不会产生 accepted/queued/cancelled）', async () => {
    stubFetch(json({ task_id: 't6', status: 'weird' }))
    const result = await threerouterAdapter.imageAsync!.query('t6', opts)
    expect(result.status).toBe('failed')
    expect(result.status === 'failed' ? result.error : '').toContain('未知图片任务状态')
  })
})

describe('凭幂等键找回：GET /images/generations/by-request/{request_id}', () => {
  it('200 → 返回 task_id（提交响应丢失后唯一的自救通道）', async () => {
    const calls = stubFetch(json({ task_id: 'imgtask_found', request_id: 'req-abc', status: 'processing' }))
    const found = await threerouterAdapter.imageAsync!.findByRequest('req-abc', opts)
    expect(found).toEqual({ taskId: 'imgtask_found' })
    expect(calls[0]?.url).toBe(`${BASE}/images/generations/by-request/req-abc`)
    expect(calls[0]?.headers.Authorization).toBe('Bearer sk-test-key')
  })

  it('404 → undefined（该键无记录，不是异常）', async () => {
    stubFetch(json({ error: { code: 'IMAGE_TASK_NOT_FOUND', message: 'image task not found' } }, 404))
    await expect(threerouterAdapter.imageAsync!.findByRequest('req-none', opts)).resolves.toBeUndefined()
  })

  it('500 → 抛错（查不到状态 ≠ 任务不存在，不能据此断定没提交）', async () => {
    stubFetch(json({ error: { message: 'boom' } }, 500))
    // retryTimes=0 只为让测试瞬时返回；生产上读取类查询按配置重试（幂等 GET，安全）
    await expect(threerouterAdapter.imageAsync!.findByRequest('req-x', { ...opts, retryTimes: 0 })).rejects.toThrow()
  })

  it('200 但缺 task_id → undefined', async () => {
    stubFetch(json({ status: 'processing' }))
    await expect(threerouterAdapter.imageAsync!.findByRequest('req-y', opts)).resolves.toBeUndefined()
  })
})

describe('同步提交：POST /images/generations（降级路径）', () => {
  it('请求头带幂等键、请求体不带 request_id、永不自动重试', async () => {
    const calls = stubFetch(json({ data: [{ url: 'https://cdn.example.com/sync.png' }] }))
    const result = await threerouterAdapter.submitImage(params, opts)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${BASE}/images/generations`)
    expect(calls[0]?.headers['Idempotency-Key']).toBe('req-abc')
    expect(calls[0]?.body).not.toHaveProperty('request_id')
    expect(result.mediaUrl).toBe('https://cdn.example.com/sync.png')
    expect(result.async).toBe(false)
  })

  it('503 只打一次（同步生图同样不允许自动重试）', async () => {
    const calls = stubFetch(json({ error: { message: 'boom' } }, 503))
    await expect(threerouterAdapter.submitImage(params, opts)).rejects.toThrow()
    expect(calls).toHaveLength(1)
  })

  it('顶层 urls 形态兼容', async () => {
    stubFetch(json({ urls: ['https://cdn.example.com/legacy.png'] }))
    const result = await threerouterAdapter.submitImage(params, opts)
    expect(result.mediaUrl).toBe('https://cdn.example.com/legacy.png')
  })

  it('失败形态（status: failed + error 字符串）→ 抛出带原因的错', async () => {
    stubFetch(json({ id: 'x', status: 'failed', error: 'minimax 1026: input new_sensitive' }))
    await expect(threerouterAdapter.submitImage(params, opts)).rejects.toThrow(/input new_sensitive/)
  })
})
