/**
 * 宿主侧连接配置：接口地址落盘、无过期、恢复默认，以及 `auth/*` 回包里的
 * 服务商状态 / 注册邀请链接 / 本地模型地址。
 *
 * 这里用真实文件系统（临时目录）验证「重启后仍然有效」，凭证服务用内存假件，
 * 避免把 `auth.ts` 的装配逻辑和 `@deepseek-ai/dsh-credentials` 一起搬进测试。
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuthDispatcher, type AuthHealthValue, type AuthTestKeyValue } from '../src/host/auth.ts'
import { createAuthSettingsStore } from '../src/host/auth-settings.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

/** 临时目录里的 `auth-settings.json` 路径。 */
async function settingsFile(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-image-video-auth-'))
  roots.push(root)
  return join(root, 'auth-settings.json')
}

/** 内存凭证服务：只需要 dispatcher 用到的几个方法。 */
function fakeCredentials() {
  const secrets = new Map<string, string>()
  const records = new Map<string, { kind: string, payload: unknown }>()
  return {
    secrets,
    records,
    async set(ref: string, value: string) { secrets.set(ref, value) },
    async unset(ref: string) { secrets.delete(ref) },
    async resolve(ref: string) {
      const value = secrets.get(ref)
      return value === undefined ? undefined : { value, source: 'file' }
    },
    async readRecord(key: string) { return records.get(key) },
    async modifyRecord(key: string, update: (current: unknown) => Promise<{ kind: string, payload: unknown }>) {
      const next = await update(records.get(key))
      records.set(key, next)
      return next
    },
    async deleteRecord(key: string) { records.delete(key) },
  }
}

/** 组装一个带凭证服务的宿主上下文。 */
function host() {
  const ctx = new Context()
  const credentials = fakeCredentials()
  ctx.provide('credentials', credentials as never)
  return { ctx, credentials }
}

/** 从 `{ ok: true, value }` 里取回包；失败直接让用例失败。 */
function valueOf<T>(result: { ok: boolean, value?: unknown, error?: { message: string } }): T {
  if (!result.ok) throw new Error(result.error?.message ?? 'RPC failed')
  return result.value as T
}

describe('auth settings store', () => {
  it('persists endpoints across store instances with no expiry', async () => {
    const file = await settingsFile()
    const store = createAuthSettingsStore(file)
    await store.setBaseUrl('local', 'http://127.0.0.1:11434/v1///')

    // 新实例模拟宿主重启：仍然读得到，说明没有进程内 TTL
    const reopened = createAuthSettingsStore(file)
    expect(await reopened.baseUrlFor('local')).toBe('http://127.0.0.1:11434/v1')
    const document = JSON.parse(await readFile(file, 'utf8')) as { baseUrls: Record<string, string> }
    expect(document.baseUrls.local).toBe('http://127.0.0.1:11434/v1')
  })

  it('clears one endpoint without touching the others', async () => {
    const file = await settingsFile()
    const store = createAuthSettingsStore(file)
    await store.setBaseUrl('local', 'http://127.0.0.1:11434/v1')
    await store.setBaseUrl('wanx', 'https://proxy.example.com/v1')
    await store.clearBaseUrl('local')
    const reopened = createAuthSettingsStore(file)
    expect(await reopened.baseUrlFor('local')).toBeUndefined()
    expect(await reopened.baseUrlFor('wanx')).toBe('https://proxy.example.com/v1')
  })

  it('treats a missing file as empty settings', async () => {
    const file = join(await settingsFile(), 'not-created', 'auth-settings.json')
    expect(await createAuthSettingsStore(file).load()).toEqual({ version: 1, baseUrls: {} })
  })
})

describe('auth dispatcher connection state', () => {
  it('announces provider states, the local endpoint and the register link', async () => {
    const file = await settingsFile()
    const { ctx } = host()
    const dispatch = createAuthDispatcher(ctx, { settings: createAuthSettingsStore(file) })

    const health = valueOf<AuthHealthValue>(await dispatch('auth/health', {}))
    expect(health.providerLabel).toBe('Threevideo')
    expect(health.registerUrl).toBe('https://www.threevideo.com')
    expect(health.inviteUrl).toBe('https://www.threevideo.com/register')
    expect(health.local?.defaultBaseUrl).toBe('http://127.0.0.1:11434/v1')
    expect(health.providerStates?.map(state => state.id)).toEqual(['threevideo', 'wanx', 'minimax', 'seedance', 'local'])
    expect(health.providers.find(entry => entry.id === 'local')?.endpointEditable).toBe(true)
  })

  it('saves a local endpoint without a key and restores it after a restart', async () => {
    const file = await settingsFile()
    const { ctx } = host()
    const first = createAuthDispatcher(ctx, { settings: createAuthSettingsStore(file) })

    const saved = valueOf<{ baseUrl: string }>(await first('auth/set-key', {
      provider: 'local',
      apiKey: '',
      baseUrl: 'http://192.168.1.5:8000/v1/',
    }))
    expect(saved.baseUrl).toBe('http://192.168.1.5:8000/v1')

    // 第二个 dispatcher 模拟重启：端点与最近服务商都来自磁盘
    const second = createAuthDispatcher(ctx, { settings: createAuthSettingsStore(file) })
    const health = valueOf<AuthHealthValue>(await second('auth/health', {}))
    expect(health.local?.baseUrl).toBe('http://192.168.1.5:8000/v1')
    expect(health.lastProvider).toBe('local')
    const state = health.providerStates?.find(entry => entry.id === 'local')
    expect(state?.baseUrl).toBe('http://192.168.1.5:8000/v1')
  })

  it('tests the given endpoint and reports the provider name', async () => {
    const file = await settingsFile()
    const { ctx } = host()
    const calls: string[] = []
    const dispatch = createAuthDispatcher(ctx, {
      settings: createAuthSettingsStore(file),
      fetch: vi.fn(async (url: string) => {
        calls.push(url)
        return new Response('{}', { status: 200 })
      }),
    })

    const tested = valueOf<AuthTestKeyValue>(await dispatch('auth/test-key', {
      provider: 'local',
      apiKey: 'local-key',
      baseUrl: 'http://127.0.0.1:9999/v1',
    }))
    expect(tested.valid).toBe(true)
    expect(tested.providerLabel).toBe('本地模型（OpenAI 兼容）')
    expect(calls).toEqual(['http://127.0.0.1:9999/v1/models'])

    // 连通成功写入长期状态：重开弹层（新 dispatcher）仍显示「连接正常」
    const reopened = createAuthDispatcher(ctx, { settings: createAuthSettingsStore(file) })
    const health = valueOf<AuthHealthValue>(await reopened('auth/health', {}))
    expect(health.providerStates?.find(entry => entry.id === 'local')?.verified).toBe(true)
  })

  it('restores defaults by clearing the endpoint and the stored key', async () => {
    const file = await settingsFile()
    const { ctx, credentials } = host()
    const dispatch = createAuthDispatcher(ctx, { settings: createAuthSettingsStore(file) })

    await dispatch('auth/set-key', { provider: 'local', apiKey: 'sk-local', baseUrl: 'http://10.0.0.2:8000/v1' })
    expect(credentials.secrets.get('LOCAL_MODEL_API_KEY')).toBe('sk-local')

    const reset = valueOf<{ success: true }>(await dispatch('auth/reset', { provider: 'local' }))
    expect(reset.success).toBe(true)
    expect(credentials.secrets.get('LOCAL_MODEL_API_KEY')).toBeUndefined()
    const health = valueOf<AuthHealthValue>(await dispatch('auth/health', {}))
    expect(health.local?.baseUrl).toBe('http://127.0.0.1:11434/v1')
    expect(health.providerStates?.find(entry => entry.id === 'local')?.verified).toBe(false)
  })

  it('rejects a non-http endpoint', async () => {
    const file = await settingsFile()
    const { ctx } = host()
    const dispatch = createAuthDispatcher(ctx, { settings: createAuthSettingsStore(file) })
    const failed = await dispatch('auth/set-endpoint', { provider: 'local', baseUrl: 'ftp://127.0.0.1/v1' })
    expect(failed.ok).toBe(false)
    if (!failed.ok) expect(failed.error.code).toBe('auth/invalid-endpoint')
  })
})
