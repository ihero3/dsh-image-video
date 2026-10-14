/**
 * Read-only status route for the workbench (`GET /image-video/status`, loopback only).
 *
 * The browser half can always reach this route — it is an ordinary exact Fetch
 * route, the same mechanism as `/image-video/defaults` — so it reports the one
 * thing the page otherwise cannot see: whether the host half managed to register
 * its RPC channel, and if not, why. Clients only observed `HTTP 405` before.
 */
import type { ServerResponse } from 'node:http'
import type { IncomingMessage } from 'node:http'
import { PLUGIN_VERSION } from '../version.ts'
import type { MediaWebServer } from '../media-route.ts'
import { workbenchRpcStatus, type WorkbenchRpcStatus } from './rpc.ts'
import { WORKBENCH_RPC_CHANNEL } from '../workbench-contract.ts'

/** Exact route the status is served from. */
export const WORKBENCH_STATUS_ROUTE_PATH = '/image-video/status'

/** Host facts the status answer reports. */
export interface WorkbenchStatusDeps {
  /** Configured provider name. */
  provider: string
  /** Resolved absolute output directory. */
  outputsDir: string
}

/** The status document, shaped for both humans and the client half. */
export interface WorkbenchStatus {
  plugin: 'dsh-image-video'
  version: string
  channel: string
  rpc: WorkbenchRpcStatus
  provider: string
  outputsDir: string
  at: string
}

/**
 * Build the status handler.
 * @param deps - host facts to report.
 * @returns a Node request handler writing one JSON document.
 */
export function createWorkbenchStatusHandler(deps: WorkbenchStatusDeps) {
  return (_request: IncomingMessage, response: ServerResponse): void => {
    const body: WorkbenchStatus = {
      plugin: 'dsh-image-video',
      version: PLUGIN_VERSION,
      channel: WORKBENCH_RPC_CHANNEL,
      rpc: workbenchRpcStatus(),
      provider: deps.provider,
      outputsDir: deps.outputsDir,
      at: new Date().toISOString(),
    }
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    response.end(JSON.stringify(body))
  }
}

/**
 * Register the status route; loopback deployments only, like every other route here.
 * @param webServer - host web server.
 * @param deps - host facts to report.
 * @returns the disposer, or `undefined` when the host is not loopback.
 */
export function registerWorkbenchStatusRoute(
  webServer: MediaWebServer,
  deps: WorkbenchStatusDeps,
): (() => void) | undefined {
  if (webServer.host !== '127.0.0.1') return undefined
  return webServer.register({
    kind: 'exact',
    path: WORKBENCH_STATUS_ROUTE_PATH,
    handler: createWorkbenchStatusHandler(deps),
  })
}
