/**
 * Workbench host face: the one RPC channel the browser half calls.
 *
 * The channel carries the connection's result envelope — structured refusals
 * instead of thrown errors — and every answer stays free of credentials and of
 * paths beyond the configured output directory. Today it answers only the
 * health check; the project / asset / task endpoints join the same channel in
 * later phases, which is why the channel is defined here rather than inline in
 * the plugin entry.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the host connection merge (`ctx.connection`) and the handler signature.
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { PLUGIN_VERSION } from '../version.ts'

/**
 * Channel of the workbench RPC. The browser half hardcodes the same string
 * (cross-repo code cannot share a runtime constant), so the pair is asserted by
 * `tests/host-workbench-rpc.test.ts` on this side and by the client lifecycle
 * test on the other.
 */
export const WORKBENCH_RPC_CHANNEL = '/image-video/workbench'

/** Facts a freshly mounted workbench needs before it can show anything. */
export interface WorkbenchHealth {
  /** Stable plugin identity (the package name). */
  plugin: 'dsh-image-video'
  /** Plugin version, from {@link PLUGIN_VERSION}. */
  version: string
  /** The channel these facts came from, so the client can log the pair. */
  channel: string
  /** Active generation provider as configured for this deployment. */
  provider: string
  /** Absolute directory generated media lands in (already resolved by the entry). */
  outputsDir: string
  /** Answer timestamp (ISO 8601), for staleness checks in the client. */
  at: string
}

/** Host facts the health check reports. */
export interface WorkbenchRpcDeps {
  /** Configured provider name (`threerouter` | `wanx` | `minimax` | `seedance`). */
  provider: string
  /** Resolved absolute output directory. */
  outputsDir: string
}

/**
 * Build the channel handler.
 * @param deps - host facts the answers are built from.
 * @returns the connection RPC handler.
 */
export function createWorkbenchHandler(deps: WorkbenchRpcDeps): ConnectionRpcHandler {
  return async (endpoint) => {
    if (endpoint === 'health') {
      const value: WorkbenchHealth = {
        plugin: 'dsh-image-video',
        version: PLUGIN_VERSION,
        channel: WORKBENCH_RPC_CHANNEL,
        provider: deps.provider,
        outputsDir: deps.outputsDir,
        at: new Date().toISOString(),
      }
      return { ok: true, value }
    }
    return {
      ok: false,
      error: {
        code: 'workbench/unknown-endpoint',
        message: `unknown workbench endpoint: ${endpoint}`,
        details: {},
      },
    }
  }
}

/**
 * Register the channel on this plugin's fiber: the disposer lifts it on unload,
 * so a disabled plugin leaves no callable endpoint behind.
 * @param ctx - host context already carrying the `connection` service.
 * @param deps - host facts the answers are built from.
 */
export function registerWorkbenchRpc(ctx: Context, deps: WorkbenchRpcDeps): void {
  ctx.effect(() => {
    const connection = ctx.get('connection')
    // Effect callbacks must hand back a disposer; with no connection there is
    // nothing to lift, so the channel simply never exists.
    if (connection === undefined) return () => {}
    const remove = connection.rpc.handle(WORKBENCH_RPC_CHANNEL, createWorkbenchHandler(deps))
    return () => { void remove() }
  }, 'dsh-image-video: workbench RPC channel')
}
