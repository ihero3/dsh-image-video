/**
 * The workbench channel validated by the transport that actually runs in the
 * app — not by a copied regex.
 *
 * This is the check whose absence let an invalid channel name
 * (`/image-video/workbench`) reach the desktop: the stub-based tests hand the
 * plugin a `handle` that accepts anything, so only the real caller can tell a
 * legal channel from an illegal one. `createWebConnectionRpc` lives in the
 * package's `./src/*` subpath (it is not re-exported from `./client`), which is
 * also how the app itself imports it.
 */
import { createWebConnectionRpc } from '@deepseek-ai/dsh-client-connection/src/client/rpc.ts'
import { describe, expect, it } from 'vitest'
import { WORKBENCH_RPC_CHANNEL } from '../src/workbench-contract.ts'

/** Caller over a transport implemented by this test, recording the routes posted to. */
function recordingCaller(reply = (body: { rpcId: string }) => ({
  type: 'server-response' as const,
  rpcId: body.rpcId,
  result: { ok: true as const, value: { plugin: 'dsh-image-video' } },
})) {
  const routes: string[] = []
  const bodies: unknown[] = []
  const caller = createWebConnectionRpc(async (input, init) => {
    routes.push(String(input))
    const body = JSON.parse(String(init?.body)) as { rpcId: string }
    bodies.push(body)
    return new Response(JSON.stringify(reply(body)), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  return { caller, routes, bodies }
}

describe('workbench RPC through the real browser transport', () => {
  it('accepts the channel and posts the document-relative route', async () => {
    const { caller, routes, bodies } = recordingCaller()
    const result = await caller.call(WORKBENCH_RPC_CHANNEL, 'health', { probe: true })
    expect(result).toEqual({ ok: true, value: { plugin: 'dsh-image-video' } })
    // 页面按文档相对路径提交（宿主按自身 root 解析），不是 /api/… 前缀
    expect(routes).toEqual(['image-video/health'])
    expect(bodies).toEqual([{ type: 'client-request', rpcId: expect.any(String), method: 'health', payload: { probe: true } }])
  })

  it('rejects the multi-segment channel the way it rejected the old name', async () => {
    const { caller } = recordingCaller()
    // 旧名 `/image-video/workbench`：连接层通道必须单段，宿主注册时同样会抛错
    await expect(caller.call('/image-video/workbench', 'health', {})).rejects.toThrow(/invalid RPC target/)
  })

  it('surfaces a transport failure with the channel and endpoint named', async () => {
    const caller = createWebConnectionRpc(async () => new Response(null, { status: 405 }))
    await expect(caller.call(WORKBENCH_RPC_CHANNEL, 'health', {})).rejects.toThrow('transport failure for /image-video/health: HTTP 405')
  })
})
