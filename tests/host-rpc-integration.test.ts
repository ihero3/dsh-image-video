/**
 * Host half on a **real cordis context**: the plugin's declared dependencies,
 * the deferred `ctx.inject(['connection'])` wiring, and disposal are exercised
 * through the framework rather than through hand-rolled stubs.
 *
 * The stubbed-context tests next door pin *what* the plugin registers; this file
 * pins that cordis's own inject/effect/dispose semantics accept that usage —
 * the failure mode we hit once already on the client half (an effect scope that
 * silently never runs).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { Config } from '../src/config.ts'
import { WORKBENCH_RPC_CHANNEL } from '../src/host/rpc.ts'
import { apply } from '../src/index.ts'

/** A host context carrying the required `tools` seam plus the `connection` seam under test. */
function hostContext({ withConnection = true } = {}) {
  const remove = vi.fn(async () => {})
  const handle = vi.fn((_channel: string, _handler: unknown) => remove)
  const unregisterTool = vi.fn()
  const ctx = new Context()
  // `tools` 是插件声明的必需服务（`inject = ['tools']`），所以在真实宿主里必然存在；
  // 其余可选服务（webServer / attachments / agents）缺失时插件按设计跳过各自那段。
  ctx.provide('tools', { register: vi.fn(() => unregisterTool) } as never)
  if (withConnection) ctx.provide('connection', { rpc: { handle } } as never)
  return { ctx, handle, remove, unregisterTool }
}

describe('host half on a real cordis context', () => {
  it('registers the workbench channel once the connection service is provided', async () => {
    const { ctx, handle } = hostContext()
    apply(ctx, Config({}))
    await vi.waitFor(() => { expect(handle).toHaveBeenCalled() }, { timeout: 2_000 })
    expect(handle.mock.calls[0]![0]).toBe(WORKBENCH_RPC_CHANNEL)
    expect(typeof handle.mock.calls[0]![1]).toBe('function')
    await ctx.fiber.dispose()
  })

  it('lifts the channel when the plugin fiber is disposed', async () => {
    const { ctx, handle, remove } = hostContext()
    apply(ctx, Config({}))
    await vi.waitFor(() => { expect(handle).toHaveBeenCalled() }, { timeout: 2_000 })
    await ctx.fiber.dispose()
    expect(remove).toHaveBeenCalledOnce()
  })

  it('applies and disposes cleanly without the optional connection service', async () => {
    const { ctx, handle } = hostContext({ withConnection: false })
    expect(() => { apply(ctx, Config({})) }).not.toThrow()
    // 没有 connection → 通道注册不发生；dispose 必须干净结束而不是挂住
    await expect(ctx.fiber.dispose()).resolves.toBeUndefined()
    expect(handle).not.toHaveBeenCalled()
  })
})
