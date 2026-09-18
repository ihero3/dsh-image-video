/**
 * 线上契约测试（默认跳过，需要显式开启）。
 *
 * 目的：单元测试用的是 fetch 桩，只能证明「客户端按契约发了请求」；本文件真的
 * 打 api.threerouter.com，证明**服务端确实按契约回应**——尤其是「同一幂等键
 * 重复提交只创建一个任务」这条不重复扣费的地基。
 *
 * 运行方式（会真实扣费，每次运行最多 1-2 张图）：
 *   DSH_IMAGE_VIDEO_LIVE=1 THREEROUTER_MEDIA_API_KEY=sk-… npx vitest run tests/live-image-contract.test.ts
 *
 * 可选环境变量：
 *   DSH_IMAGE_VIDEO_LIVE_BASE      接口地址，默认 https://api.threerouter.com/v1
 *   DSH_IMAGE_VIDEO_LIVE_MODEL     生图模型，默认 qwen-image-3.0
 *
 * 异步端点在「未开启对象存储」或「分组平台不支持」时返回 404：此时本文件会把
 * 异步用例标记为跳过并在日志里说明原因，同步单次提交用例仍然照跑——这与客户端
 * `imageTransport: auto` 的实际降级行为一致。
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'

const LIVE = process.env.DSH_IMAGE_VIDEO_LIVE === '1'
const API_KEY = process.env.THREEROUTER_MEDIA_API_KEY ?? ''
const BASE = (process.env.DSH_IMAGE_VIDEO_LIVE_BASE ?? 'https://api.threerouter.com/v1').replace(/\/$/, '')
const MODEL = process.env.DSH_IMAGE_VIDEO_LIVE_MODEL ?? 'qwen-image-3.0'

/** 线上出图可能耗时数分钟（千问图像思考模式实测约 5 分钟），轮询上限放宽。 */
const POLL_TIMEOUT_MS = 420_000
const POLL_INTERVAL_MS = 5_000

interface GatewayError { error?: { code?: string; type?: string; message?: string } }

/** 异步端点是否可用（未配置对象存储时为 false）。 */
let asyncAvailable = false
let asyncProbeReason = '未探测'

function headers(requestId?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    ...(requestId === undefined ? {} : { 'Idempotency-Key': requestId }),
  }
}

/** 提交异步任务（返回原始响应，便于断言状态码与响应头）。 */
async function submitAsync(body: Record<string, unknown>, requestId: string): Promise<Response> {
  return await fetch(`${BASE}/images/generations/async`, {
    method: 'POST',
    headers: headers(requestId),
    body: JSON.stringify(body),
  })
}

/** 同步提交（当前线上唯一可用的生图路径）。 */
async function submitSync(body: Record<string, unknown>, requestId: string): Promise<Response> {
  return await fetch(`${BASE}/images/generations`, {
    method: 'POST',
    headers: headers(requestId),
    body: JSON.stringify(body),
  })
}

/** 轮询任务直到终态或超时。 */
async function pollTask(taskId: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE}/images/tasks/${taskId}`, { headers: headers() })
    const body = await res.json() as Record<string, unknown>
    const status = String(body.status ?? '')
    if (status === 'succeeded' || status === 'completed' || status === 'failed') return body
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  throw new Error(`轮询任务 ${taskId} 超时（${POLL_TIMEOUT_MS}ms）`)
}

/** 从任务/同步响应里取图片 URL。 */
function imageUrlOf(body: Record<string, unknown>): string | undefined {
  const top = body.image_url
  if (typeof top === 'string' && top !== '') return top
  const result = body.result as { data?: Array<{ url?: string }> } | undefined
  const fromResult = result?.data?.[0]?.url
  if (typeof fromResult === 'string' && fromResult !== '') return fromResult
  const data = body.data as Array<{ url?: string }> | undefined
  const fromData = data?.[0]?.url
  if (typeof fromData === 'string' && fromData !== '') return fromData
  const urls = body.urls
  if (Array.isArray(urls) && typeof urls[0] === 'string') return urls[0]
  return undefined
}

/** 下载图片并返回字节数（证明 URL 真的可取到内容）。本机 DNS 偶发 SERVFAIL，带 3 次重试。 */
async function downloadBytes(url: string): Promise<{ bytes: number; contentType: string }> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buffer = await res.arrayBuffer()
      return { bytes: buffer.byteLength, contentType: res.headers.get('content-type') ?? '' }
    } catch (err) {
      lastError = err
      await new Promise((resolve) => setTimeout(resolve, 2_000))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('下载失败')
}

describe.skipIf(!LIVE || API_KEY === '')('线上契约：threerouter 生图', () => {
  beforeAll(async () => {
    // 零成本探测：空请求体在创建任务前就会被拒（400），而已关闭时是 404。
    const res = await fetch(`${BASE}/images/generations/async`, {
      method: 'POST',
      headers: headers(randomUUID()),
      body: JSON.stringify({}),
    })
    const body = await res.json().catch(() => ({})) as GatewayError
    if (res.status === 404) {
      asyncAvailable = false
      asyncProbeReason = body.error?.message ?? '异步端点不可用'
    } else {
      asyncAvailable = true
      asyncProbeReason = `HTTP ${res.status}（端点已启用）`
    }
    console.log(`[live] 异步图片端点探测：${asyncAvailable ? '可用' : '不可用'} —— ${asyncProbeReason}`)
  }, 30_000)

  it('同步单次提交可用（当前线上路径；带幂等键头也无副作用）', async () => {
    const requestId = randomUUID()
    const res = await submitSync({ model: MODEL, prompt: '一只坐着的橘猫，纯色背景，简洁明亮', n: 1, response_format: 'url', size: '1024*1024' }, requestId)
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    const url = imageUrlOf(body)
    expect(typeof url).toBe('string')
    const downloaded = await downloadBytes(url as string)
    expect(downloaded.bytes).toBeGreaterThan(10_000)
    console.log(`[live] 同步出图成功：${url}（${(downloaded.bytes / 1024).toFixed(1)} KB）`)
  }, 700_000)

  it('异步提交 → 幂等重放 → 按 request_id 找回（同一任务，不重复生成）', async () => {
    if (!asyncAvailable) {
      console.log(`[live] 跳过异步用例：${asyncProbeReason}（服务端上线并在 Admin 开启对象存储后自动生效）`)
      return
    }
    const requestId = randomUUID()
    const payload = { model: MODEL, prompt: '一只坐着的橘猫，纯色背景，简洁明亮', n: 1, response_format: 'url', size: '1024*1024' }

    // 1) 首次提交 → 202 + task_id
    const first = await submitAsync(payload, requestId)
    expect(first.status).toBe(202)
    const firstBody = await first.json() as Record<string, unknown>
    const taskId = String(firstBody.task_id ?? firstBody.id ?? '')
    expect(taskId).not.toBe('')
    expect(first.headers.get('location')).toContain(taskId)

    // 2) 同一幂等键 + 同一请求体再提交 → 回放同一个 task_id（不新建任务）
    const second = await submitAsync(payload, requestId)
    expect([200, 202]).toContain(second.status)
    const secondBody = await second.json() as Record<string, unknown>
    expect(String(secondBody.task_id ?? secondBody.id ?? '')).toBe(taskId)
    expect(second.headers.get('x-idempotency-replayed')).toBe('true')

    // 3) 按 request_id 找回 → 同一个 task_id（提交响应丢失时的自救通道）
    const byRequest = await fetch(`${BASE}/images/generations/by-request/${requestId}`, { headers: headers() })
    expect(byRequest.status).toBe(200)
    const byRequestBody = await byRequest.json() as Record<string, unknown>
    expect(String(byRequestBody.task_id ?? byRequestBody.id ?? '')).toBe(taskId)

    // 4) 同一幂等键 + 不同请求体 → 409 冲突（防止键被复用于另一个请求）
    const conflict = await submitAsync({ ...payload, prompt: '完全不同的提示词' }, requestId)
    expect(conflict.status).toBe(409)

    // 5) 轮询拿到结果并确认图片可取
    const done = await pollTask(taskId)
    expect(['succeeded', 'completed']).toContain(String(done.status))
    const url = imageUrlOf(done)
    expect(typeof url).toBe('string')
    const downloaded = await downloadBytes(url as string)
    expect(downloaded.bytes).toBeGreaterThan(10_000)
    console.log(`[live] 异步出图成功：task=${taskId} url=${url}（${(downloaded.bytes / 1024).toFixed(1)} KB）`)
  }, 700_000)

  it('未知 request_id 反查 → 404（不误判为「任务不存在即可重提」以外的任何结论）', async () => {
    if (!asyncAvailable) {
      console.log(`[live] 跳过反查用例：${asyncProbeReason}`)
      return
    }
    const res = await fetch(`${BASE}/images/generations/by-request/${randomUUID()}`, { headers: headers() })
    expect(res.status).toBe(404)
  }, 30_000)
})
