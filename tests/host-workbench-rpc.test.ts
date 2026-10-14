/**
 * Workbench host face: the channel answers in the connection's result envelope,
 * carries no credentials, and is lifted with the plugin's fiber.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import {
  createWorkbenchHandler, registerWorkbenchRpc, WORKBENCH_RPC_CHANNEL, type WorkbenchHealth,
} from '../src/host/rpc.ts'
import { PLUGIN_VERSION } from '../src/version.ts'

const DEPS = { provider: 'threerouter', outputsDir: '/tmp/outputs' }
const SIGNAL = new AbortController().signal
const PEER = {} as never

describe('workbench RPC channel', () => {
  it('names a channel the connection transport accepts', () => {
    // 与 `rpc-host.ts` 的 assertChannel 同一条规则（单段、且不得占用 /api）。
    // 曾用 `/image-video/workbench`：宿主注册时抛错、浏览器调用被拒，现场才发现。
    expect(WORKBENCH_RPC_CHANNEL).toMatch(/^\/[A-Za-z0-9._~-]+$/)
    expect(WORKBENCH_RPC_CHANNEL).not.toBe('/api')
  })

  it('answers health with the host facts the client needs', async () => {
    const result = await createWorkbenchHandler(DEPS)('health', undefined, SIGNAL, PEER)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const health = result.value as WorkbenchHealth
    expect(health.plugin).toBe('dsh-image-video')
    expect(health.version).toBe(PLUGIN_VERSION)
    expect(health.channel).toBe(WORKBENCH_RPC_CHANNEL)
    expect(health.provider).toBe('threerouter')
    expect(health.outputsDir).toBe('/tmp/outputs')
    expect(Number.isNaN(Date.parse(health.at))).toBe(false)
    // 不泄漏凭证：健康检查只报事实，任何 key 字段都不该出现
    expect(JSON.stringify(health)).not.toMatch(/apiKey|token/i)
  })

  it('refuses unknown endpoints in the envelope instead of throwing', async () => {
    const result = await createWorkbenchHandler(DEPS)('projects', undefined, SIGNAL, PEER)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('workbench/unknown-endpoint')
    expect(result.error.message).toContain('projects')
  })

  it('registers on the connection and lifts the handler on dispose', () => {
    const remove = vi.fn(async () => {})
    let handler: unknown
    const handle = vi.fn((_channel: string, candidate: unknown) => { handler = candidate; return remove })
    const disposers: Array<() => void> = []
    const ctx = {
      get: (name: string) => (name === 'connection' ? { rpc: { handle } } : undefined),
      effect: (callback: () => unknown) => {
        const dispose = callback()
        if (typeof dispose === 'function') disposers.push(dispose as () => void)
      },
    } as unknown as Context

    registerWorkbenchRpc(ctx, DEPS)

    expect(handle).toHaveBeenCalledOnce()
    expect(handle.mock.calls[0]![0]).toBe(WORKBENCH_RPC_CHANNEL)
    expect(typeof handler).toBe('function')
    expect(disposers).toHaveLength(1)
    disposers[0]!()
    expect(remove).toHaveBeenCalledOnce()
  })

  it('registers nothing when the connection service is absent', () => {
    const disposers: Array<() => void> = []
    const get = vi.fn(() => undefined)
    const ctx = {
      get,
      effect: (callback: () => unknown) => {
        const dispose = callback()
        if (typeof dispose === 'function') disposers.push(dispose as () => void)
      },
    } as unknown as Context

    expect(() => { registerWorkbenchRpc(ctx, DEPS) }).not.toThrow()
    expect(get).toHaveBeenCalledWith('connection')
    // 没有连接时挂一个空 disposer：通道不存在，但 fiber 的清理语义保持一致
    expect(disposers).toHaveLength(1)
    expect(() => { disposers[0]!() }).not.toThrow()
  })
})
