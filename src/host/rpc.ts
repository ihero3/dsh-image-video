/**
 * Workbench host face: the one RPC channel the browser half calls.
 *
 * The channel carries the connection's result envelope — structured refusals
 * instead of thrown errors — and every answer stays free of credentials and of
 * paths beyond the configured output directory. Today it answers only the
 * health check; the project / asset / task endpoints join the same channel in
 * later phases. The channel name and the health shape live in
 * `src/workbench-contract.ts`, which both halves import, so the browser bundle
 * carries them without pulling in any host code.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the host connection merge (`ctx.connection`) and the handler signature.
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { PLUGIN_VERSION } from '../version.ts'
import { WORKBENCH_RPC_CHANNEL, type WorkbenchHealth } from '../workbench-contract.ts'

export { WORKBENCH_RPC_CHANNEL }
export type { WorkbenchHealth }

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
