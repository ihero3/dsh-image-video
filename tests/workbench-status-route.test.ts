/**
 * `/image-video/status`: the readable version of what the browser half cannot see.
 *
 * It travels the same exact-Fetch-route mechanism as `/image-video/defaults`
 * (verified live), which is why it can report the RPC registration outcome even
 * when the RPC channel itself is missing.
 */
import { describe, expect, it } from 'vitest'
import {
  createWorkbenchStatusHandler, registerWorkbenchStatusRoute, WORKBENCH_STATUS_ROUTE_PATH,
  type WorkbenchStatus,
} from '../src/host/status-route.ts'
import { registerWorkbenchRpc, workbenchRpcStatus } from '../src/host/rpc.ts'
import { WORKBENCH_RPC_CHANNEL } from '../src/workbench-contract.ts'
import { PLUGIN_VERSION } from '../src/version.ts'

const DEPS = { provider: 'threerouter', outputsDir: '/tmp/outputs' }

/** Capture one Node response without a socket. */
function fakeResponse() {
  let status = 0
  let headers: Record<string, string> = {}
  let body = ''
  return {
    writeHead(code: number, next?: Record<string, string>) { status = code; headers = next ?? {} },
    end(chunk?: string) { body = chunk ?? '' },
    read: () => ({ status, headers, body: JSON.parse(body) as WorkbenchStatus }),
  }
}

describe('workbench status route', () => {
  it('registers an exact route, loopback only', () => {
    const routes: Array<{ kind: string; path: string }> = []
    const webServer = { host: '127.0.0.1', register: (route: { kind: string; path: string }) => { routes.push(route); return () => {} } }
    const dispose = registerWorkbenchStatusRoute(webServer as never, DEPS)
    expect(routes).toEqual([{ kind: 'exact', path: WORKBENCH_STATUS_ROUTE_PATH, handler: expect.any(Function) }])
    expect(typeof dispose).toBe('function')
    expect(registerWorkbenchStatusRoute({ host: '0.0.0.0', register: () => () => {} } as never, DEPS)).toBeUndefined()
  })

  it('answers with the plugin facts and the RPC registration state', () => {
    const response = fakeResponse()
    createWorkbenchStatusHandler(DEPS)({} as never, response as never)
    const { status, headers, body } = response.read()
    expect(status).toBe(200)
    expect(headers['content-type']).toBe('application/json')
    expect(headers['cache-control']).toBe('no-store')
    expect(body.plugin).toBe('dsh-image-video')
    expect(body.version).toBe(PLUGIN_VERSION)
    expect(body.channel).toBe(WORKBENCH_RPC_CHANNEL)
    expect(body.provider).toBe('threerouter')
    expect(body.outputsDir).toBe('/tmp/outputs')
    // 未注册时如实报告 false（现场排错靠这一行）
    expect(body.rpc.registered).toBe(false)
    expect(body.rpc.channel).toBe(WORKBENCH_RPC_CHANNEL)
    expect(Number.isNaN(Date.parse(body.at))).toBe(false)
  })
})
