/**
 * The workbench channel registered through the **real** `HostConnectionService`.
 *
 * Stub-based tests hid a field failure: `connection.rpc.handle()` registers its web
 * route on the context that *read* the service (`HostConnectionService.callerCtx`),
 * so reading `connection` from a context that cannot see `webServer` makes
 * `owner.webServer.register` throw and the route silently never exists — the
 * browser half then only ever sees `HTTP 405`. Both the working wiring and that
 * failure mode are pinned here.
 */
import { Context } from '@deepseek-ai/cordis'
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection'
import { describe, expect, it, vi } from 'vitest'
import { registerWorkbenchRpc, workbenchRpcStatus } from '../src/host/rpc.ts'
import { WORKBENCH_RPC_CHANNEL } from '../src/workbench-contract.ts'

const DEPS = { provider: 'threerouter', outputsDir: '/tmp/outputs' }

/** Minimal browser-auth seam: this test never admits a request. */
const AUTH = {
  isAuthenticated: () => true,
  authorizeIndex: () => true,
  authenticatedUrl: (url: string) => url,
}

/** Real channel service over a stub web server, recording registered routes. */
function hostWith(services: { webServer: boolean }) {
  const routes: Array<{ kind: string; path: string }> = []
  const ctx = new Context()
  if (services.webServer) {
    ctx.provide('webServer', {
      host: '127.0.0.1',
      register: (route: { kind: string; path: string }) => { routes.push(route); return () => {} },
    } as never)
  }
  new HostConnectionService(ctx, ['127.0.0.1'], AUTH as never)
  return { ctx, routes }
}

describe('workbench channel over the real HostConnectionService', () => {
  it('registers a prefix route on webServer when the reading context can see it', async () => {
    const { ctx, routes } = hostWith({ webServer: true })
    registerWorkbenchRpc(ctx, DEPS)
    await vi.waitFor(() => { expect(routes.length).toBe(1) }, { timeout: 2_000 })
    expect(routes[0]).toMatchObject({ kind: 'prefix', path: WORKBENCH_RPC_CHANNEL })
    expect(workbenchRpcStatus()).toMatchObject({ channel: WORKBENCH_RPC_CHANNEL, registered: true, awaiting: false })
    await ctx.fiber.dispose()
    expect(workbenchRpcStatus().registered).toBe(false)
  })

  it('records — instead of silently serving 405 — when webServer is not visible', async () => {
    const { ctx, routes } = hostWith({ webServer: false })
    registerWorkbenchRpc(ctx, DEPS)
    await vi.waitFor(() => { expect(workbenchRpcStatus().awaiting).toBe(false) }, { timeout: 2_000 })
    expect(routes).toHaveLength(0)
    const status = workbenchRpcStatus()
    expect(status.registered).toBe(false)
    // 现场现象就是这条：路由不存在 → 浏览器只看到 HTTP 405；现在它可被读取
    expect(status.error).toBeDefined()
    expect(String(status.error)).toMatch(/register|webServer|undefined/i)
    await ctx.fiber.dispose()
  })
})
