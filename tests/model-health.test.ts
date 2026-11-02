/**
 * 模型能力卡的实时可用性（`media/model-health`）：探测、解析、逐卡片结论。
 *
 * 这一组断言守的是"不伪造"：探测失败必须返回 `ok:false` + 人话原因，
 * 卡片结论必须是 `unknown` 而不是 `available`；服务商目录里没有的必须是 `missing`。
 *
 * @module dsh-image-video/tests/model-health
 */
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { compareCardsAgainstRegistry, extractModelIds, probeModelRegistry, type ModelRegistryProbe } from '../src/media/model-health.ts'
import { modelCards } from '../src/media/model-catalog.ts'

const servers: Server[] = []

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections() })
  }
})

/** Start a one-route server and return its base URL. */
async function serve(status: number, body: string): Promise<string> {
  const server = createServer((_req, res) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(body)
  })
  servers.push(server)
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', () => resolve()) })
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
}

/** Probe fixture the compare function only reads. */
function probe(overrides: Partial<ModelRegistryProbe> = {}): ModelRegistryProbe {
  return { attemptedAt: '2026-11-02T00:00:00.000Z', ok: true, ids: [], ...overrides }
}

describe('服务商目录解析（extractModelIds）', () => {
  it('接受 OpenAI 标准、models、ids 三种形状并去重', () => {
    expect(extractModelIds({ data: [{ id: 'qwen-image-3.0' }, { id: 'minimax-h3' }] })).toEqual(['qwen-image-3.0', 'minimax-h3'])
    expect(extractModelIds({ models: ['wan3.0-video', { id: 'wan2.2-t2v-plus' }] })).toEqual(['wan3.0-video', 'wan2.2-t2v-plus'])
    expect(extractModelIds({ ids: ['minimax-image-01', 'minimax-image-01'] })).toEqual(['minimax-image-01'])
  })

  it('形状不认识时返回空数组（不当成"全部可用"）', () => {
    expect(extractModelIds({ unexpected: true })).toEqual([])
    expect(extractModelIds(null)).toEqual([])
    expect(extractModelIds('nope')).toEqual([])
  })
})

describe('逐卡片结论（compareCardsAgainstRegistry）', () => {
  it('目录里列出的 available、没列出的 missing，且 id 归一化后比较', () => {
    const cards = modelCards()
    const targets = compareCardsAgainstRegistry(cards, probe({ ids: ['Qwen-Image-3.0', 'MiniMax-H3'] }))
    expect(targets['qwen-image-3.0']?.status).toBe('available')
    expect(targets['minimax-h3']?.status).toBe('available')
    // 目录里没有 → missing（附原因），不是 available
    expect(targets['minimax-image-01']?.status).toBe('missing')
    expect(targets['minimax-image-01']?.detail).toContain('目录')
  })

  it('探测失败时所有卡片 unknown 并带同一条原因（绝不猜成可用）', () => {
    const cards = modelCards()
    const targets = compareCardsAgainstRegistry(cards, probe({ ok: false, ids: [], reason: 'HTTP 404' }))
    for (const card of cards) {
      expect(targets[card.id]?.status).toBe('unknown')
      expect(targets[card.id]?.detail).toBe('HTTP 404')
    }
  })
})

describe('现场探测（probeModelRegistry）', () => {
  it('200 + data[] → ok，并带回服务商列出的 id', async () => {
    const baseUrl = await serve(200, JSON.stringify({ data: [{ id: 'qwen-image-3.0' }, { id: 'minimax-image-01' }] }))
    const result = await probeModelRegistry({ baseUrl, apiKey: 'k' })
    expect(result.ok).toBe(true)
    expect(result.ids).toEqual(['qwen-image-3.0', 'minimax-image-01'])
    expect(result.reason).toBeUndefined()
  })

  it('401 明确说鉴权失败，404 明确说没有目录端点', async () => {
    const unauthorized = await probeModelRegistry({ baseUrl: await serve(401, '{}'), apiKey: 'k' })
    expect(unauthorized.ok).toBe(false)
    expect(unauthorized.reason).toContain('鉴权失败')
    const missing = await probeModelRegistry({ baseUrl: await serve(404, '{}'), apiKey: 'k' })
    expect(missing.reason).toContain('HTTP 404')
  })

  it('坏 JSON / 空目录 / 无凭证都如实失败', async () => {
    expect((await probeModelRegistry({ baseUrl: await serve(200, 'not json'), apiKey: 'k' })).ok).toBe(false)
    expect((await probeModelRegistry({ baseUrl: await serve(200, JSON.stringify({ data: [] })), apiKey: 'k' })).reason).toContain('空')
    const noKey = await probeModelRegistry({ baseUrl: 'http://127.0.0.1:1/v1', apiKey: undefined })
    expect(noKey.ok).toBe(false)
    expect(noKey.reason).toContain('未配置')
  })

  it('连不上服务商时不抛错，只给原因', async () => {
    const result = await probeModelRegistry({ baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'k' })
    expect(result.ok).toBe(false)
    expect(result.reason?.length ?? 0).toBeGreaterThan(0)
  })
})
