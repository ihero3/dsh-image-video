/**
 * 宿主侧登录闭环：账号登录、自动 provisioning API Key、自带 Key 写入凭证缝、
 * 余额 / Key 末四位脱敏回显。
 *
 * 这段能力原来只住在兄弟插件里；本模块把它搬进 dsh-image-video，使插件独立安装
 * 也能完成「登录 → 拿 Key → 写凭证缝」与「自带 Key → 写凭证缝」两条主链路。
 *
 * 设计口径：
 * - **Key 只进凭证缝**：登录拿到的 Key 写进 `THREEVIDEO_API_KEY` 引用（生成工具按
 *   `apiKeyEnv` 引用解析），本模块的所有回包都**不含 Key 明文**，只给末四位。
 * - **会话记录独立命名空间**：跨重启的登录态写本插件自己的
 *   `credentialKey('image-video', 'auth')`，不读也不覆盖兄弟插件的
 *   `threevideo-integration/session`。
 * - **只导出 dispatcher**：`auth/*` 端点的 RPC 通道注册由插件入口负责（见
 *   `src/host/rpc.ts`）；本模块不碰通道，便于单测与入口接线。
 *
 * 端点一览（全部以 `auth/` 前缀，入口按前缀路由即可）：
 * - `auth/health`    宿主状态（凭证服务是否可用、是否已登录、余额、Key 末四位、服务商清单）
 * - `auth/login`     `{ email, password, turnstileToken? }` → 登录并自动创建/复用 Key、写凭证缝
 * - `auth/logout`    清会话记录并撤销本插件写入的 Key
 * - `auth/profile`   刷新并返回已登录账号资料（余额 / Key 末四位）
 * - `auth/set-key`   `{ apiKey, provider?, test? }` → 自带 Key 写凭证缝
 * - `auth/test-key`  `{ apiKey?, provider? }` → 只做连通性测试，不写盘
 * - `auth/key-state` `{ provider? }` → 脱敏的 Key 状态（有没有、末四位、来源层）
 *
 * @module dsh-image-video/host/auth
 */
import type { Context } from '@deepseek-ai/cordis'
import { credentialKey, credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CredentialKey } from '@deepseek-ai/dsh-credentials'

/** Threevideo 站点根地址。 */
export const THREEVIDEO_BASE_URL = 'https://www.threevideo.com'

/** Threevideo 的 OpenAI 兼容根地址（连通性测试与模型目录在这条线后面）。 */
export const THREEVIDEO_OPENAI_BASE = `${THREEVIDEO_BASE_URL}/v1`

/** 生成工具按引用名解析的 Key 引用（默认服务商 threevideo）。 */
export const THREEVIDEO_API_KEY_ENV = 'THREEVIDEO_API_KEY'

/**
 * 本插件的登录会话记录。`scope` 必须是本插件注册名，`id` 由本插件自选，
 * 与兄弟插件的 `threevideo-integration/session` 互不相干。
 */
export const IMAGE_VIDEO_AUTH_SESSION_KEY = credentialKey('image-video', 'auth')

/** 本插件支持的服务商标识（与 `Config.provider` 同一套枚举）。 */
export type AuthProvider = 'threevideo' | 'wanx' | 'minimax' | 'seedance'

/**
 * 服务商默认凭证引用。部署若把 `Config.*.apiKeyEnv` 指向别的名字，入口可用
 * {@link AuthDispatcherOptions.providerRefs} 覆盖，保证「写进去的引用」就是「生成时解析的引用」。
 */
export const DEFAULT_PROVIDER_API_KEY_REFS: Readonly<Record<AuthProvider, string>> = {
  threevideo: 'THREEVIDEO_API_KEY',
  wanx: 'DASHSCOPE_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  seedance: 'ARK_API_KEY',
}

/** 服务商在「自带 Key」页签里的展示信息。 */
export interface AuthProviderInfo {
  /** 服务商标识，随 `auth/set-key` / `auth/test-key` 回传。 */
  id: AuthProvider
  /** 展示名（宿主下发，浏览器包因此不内置任何服务商名）。 */
  label: string
  /** 是否能写入凭证缝（该服务商配置了凭证引用）。 */
  settable: boolean
  /** 是否支持连通性测试（有已知的探测端点）。 */
  testable: boolean
}

/** 一次 RPC 的失败形状（入口会补 `details: {}`）。 */
export interface AuthError {
  /** 机器可读错误码，统一 `auth/` 前缀。 */
  code: string
  /** 面向用户的错误说明（不含任何密钥）。 */
  message: string
}

/** dispatcher 的统一返回包络。 */
export type AuthResult =
  | { ok: true, value: unknown }
  | { ok: false, error: AuthError }

/** `auth/*` 的 dispatcher 签名（入口按前缀把请求转进来）。 */
export type AuthDispatcher = (endpoint: string, payload: unknown) => Promise<AuthResult>

/** 可注入的 fetch（测试注入假实现；宿主默认用全局 fetch）。 */
export type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>

/** dispatcher 的可选装配项。 */
export interface AuthDispatcherOptions {
  /** 网络实现；缺省用全局 fetch（测试可注入）。 */
  fetch?: AuthFetch
  /** Threevideo API 根（缺省 {@link THREEVIDEO_BASE_URL}）。 */
  baseUrl?: string
  /** Threevideo OpenAI 兼容根（缺省 {@link THREEVIDEO_OPENAI_BASE}）。 */
  openaiBaseUrl?: string
  /** 会话记录地址；缺省 {@link IMAGE_VIDEO_AUTH_SESSION_KEY}（测试可隔离）。 */
  sessionKey?: CredentialKey
  /** 服务商列（缺省内置四项）；入口可据此投递部署侧已知的服务商。 */
  providers?: readonly Omit<AuthProviderInfo, 'settable' | 'testable'>[]
  /** 服务商 → 凭证引用名覆盖（应与 `Config.*.apiKeyEnv` 保持一致）。 */
  providerRefs?: Partial<Record<AuthProvider, string>>
  /** 服务商 → 连通性探测 URL 覆盖（缺省 threevideo / wanx / seedance 有值）。 */
  probeUrls?: Partial<Record<AuthProvider, string>>
  /** 「自带 Key」页签的默认服务商（缺省 `threevideo`）。 */
  defaultProvider?: AuthProvider
  /** 单次上游请求超时（毫秒，缺省 20 秒）。 */
  timeoutMs?: number
}

// ---------------------------------------------------------------------------
// 上游响应形状
// ---------------------------------------------------------------------------

/** Threevideo Go 后端统一响应包络。 */
interface ThreevideoEnvelope<T> {
  code: number
  message?: string
  data: T
}

/** 登录接口返回（snake_case）。由下面的解析函数按需取字段。 */
export interface RawLoginData {
  access_token: string
  refresh_token?: string
  user?: unknown
}

/** 凭证缝里保存的跨重启会话（本插件自己的格式）。 */
interface StoredAuthSession {
  accessToken: string
  refreshToken: string
  profile: UserProfile
  affCode: string
}

/** 已登录账号资料（camelCase，回包用）。 */
interface UserProfile {
  id: number
  email: string
  username: string
  role: string
  balance: number
  allowedGroups: number[]
}

/** `auth/key-state` 的返回。 */
export interface AuthKeyState {
  provider: AuthProvider
  configured: boolean
  /** Key 末四位；未配置时缺省。 */
  last4?: string
  /** 凭证来源层（file / env / …）；缺省表示未配置。 */
  source?: string
}

/** `auth/health` 的返回。 */
export interface AuthHealthValue {
  ready: true
  /** 宿主是否提供凭证服务（false 时登录/写 Key 会明确拒绝）。 */
  credentials: boolean
  signedIn: boolean
  email?: string
  username?: string
  balance?: number
  hasKey: boolean
  /** Key 末四位（脱敏，明文永不出宿主）。 */
  keyLast4?: string
  /** 默认服务商。 */
  provider: AuthProvider
  /** 「自带 Key」下拉的选项（宿主下发，浏览器包不内置服务商名）。 */
  providers: AuthProviderInfo[]
}

/** `auth/login` 的返回。 */
export interface AuthLoginValue {
  success: true
  email: string
  username: string
  balance: number
  hasKey: boolean
  keyLast4?: string
  /** Key 是否成功写入凭证缝（凭证服务缺失时会话仍可建立，但这里为 false）。 */
  credentialsWritten: boolean
  affCode?: string
}

/** `auth/profile` 的返回。 */
export interface AuthProfileValue {
  signedIn: true
  email: string
  username: string
  balance: number
  hasKey: boolean
  keyLast4?: string
  affCode?: string
}

/** `auth/set-key` 的返回。 */
export interface AuthSetKeyValue {
  success: true
  provider: AuthProvider
  keyLast4: string
  configured: true
}

/** `auth/test-key` 的返回。 */
export interface AuthTestKeyValue {
  valid: boolean
  /** false 表示该服务商没有已知探测端点（界面把它当「无法测试」而不是「Key 错」）。 */
  testable: boolean
  reason?: string
}

// ---------------------------------------------------------------------------
// 小型形状守卫 / 工具
// ---------------------------------------------------------------------------

/** 是不是普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 把未知错误收敛成一句可读文本。 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 只保留 Key 末四位——脱敏的唯一出口。 */
export function keyLast4(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4)
}

/** 结构化业务失败（dispatcher 把它翻成 `ok:false`）。 */
class AuthFailure extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'AuthFailure'
  }
}

/** 上游 fetch 不可用 / 网络异常的统一错误。 */
function upstreamFailure(detail: string): AuthFailure {
  return new AuthFailure('auth/upstream', detail)
}

/** 校验载荷是对象（缺省 `undefined` 也接受，客户端可能传 `{}`）。 */
function asEmptyRequest(payload: unknown): void {
  if (payload !== undefined && payload !== null && !isRecord(payload)) {
    throw new AuthFailure('auth/invalid-payload', '请求载荷必须是对象')
  }
}

/** 读取服务商 id。 */
function asProvider(value: unknown): AuthProvider {
  if (value === 'threevideo' || value === 'wanx' || value === 'minimax' || value === 'seedance') return value
  throw new AuthFailure('auth/invalid-provider', `未知服务商：${String(value)}`)
}

/** 把上游原始用户对象映射成回包资料；形状不认识就返回 undefined。 */
function mapUser(raw: unknown): UserProfile | undefined {
  if (!isRecord(raw)) return undefined
  const { id, email, username, role, balance } = raw
  if (typeof id !== 'number' || typeof email !== 'string' || typeof username !== 'string') return undefined
  if (typeof role !== 'string' || typeof balance !== 'number') return undefined
  const allowedGroups = Array.isArray(raw.allowed_groups)
    ? raw.allowed_groups.filter((entry): entry is number => typeof entry === 'number')
    : []
  return { id, email, username, role, balance, allowedGroups }
}

/** 从上游 Key 条目里读 Key 明文（只在宿主内部流转）。 */
function rawApiKey(value: unknown): { key: string, status?: string } | undefined {
  if (!isRecord(value) || typeof value.key !== 'string' || value.key === '') return undefined
  return { key: value.key, ...typeof value.status === 'string' ? { status: value.status } : {} }
}

/** 读取跨重启会话记录；形状不认识就当作没登录。 */
function asStoredSession(value: unknown): StoredAuthSession | undefined {
  if (!isRecord(value)) return undefined
  const { accessToken, refreshToken, affCode, profile } = value
  if (typeof accessToken !== 'string' || accessToken === '') return undefined
  if (typeof refreshToken !== 'string' || typeof affCode !== 'string') return undefined
  const restoredProfile = mapUser(profile)
  if (restoredProfile === undefined) return undefined
  return { accessToken, refreshToken, profile: restoredProfile, affCode }
}

/** 载荷守卫：登录请求。 */
function asLoginRequest(payload: unknown): { email: string, password: string, turnstileToken?: string } {
  if (!isRecord(payload)) throw new AuthFailure('auth/invalid-payload', '登录请求必须是对象')
  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (email === '' || password === '') throw new AuthFailure('auth/invalid-payload', '邮箱和密码不能为空')
  return {
    email,
    password,
    ...typeof payload.turnstileToken === 'string' && payload.turnstileToken !== ''
      ? { turnstileToken: payload.turnstileToken }
      : {},
  }
}

/** 载荷守卫：写 Key 请求。 */
function asSetKeyRequest(payload: unknown): { apiKey: string, provider?: AuthProvider, test: boolean } {
  if (!isRecord(payload)) throw new AuthFailure('auth/invalid-payload', '写 Key 请求必须是对象')
  const apiKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : ''
  if (apiKey === '') throw new AuthFailure('auth/invalid-payload', 'API Key 不能为空')
  return {
    apiKey,
    ...payload.provider === undefined || payload.provider === '' ? {} : { provider: asProvider(payload.provider) },
    test: payload.test === true,
  }
}

// ---------------------------------------------------------------------------
// dispatcher 工厂
// ---------------------------------------------------------------------------

/** 内置服务商清单（只含展示所需的静态事实，sett-able/testable 由装配时计算）。 */
const BUILTIN_PROVIDERS: readonly Omit<AuthProviderInfo, 'settable' | 'testable'>[] = [
  { id: 'threevideo', label: 'Threevideo' },
  { id: 'wanx', label: 'Wanx' },
  { id: 'minimax', label: 'MiniMax' },
  { id: 'seedance', label: 'Seedance' },
]

/**
 * 内置探测端点：只登记已知的 OpenAI 兼容 `/models` 线。
 * 没登记的（如 minimax）会被标成 `testable: false`，界面按「无法测试」处理，
 * 而不是把网络/端点问题误报成「Key 无效」。
 */
const BUILTIN_PROBE_URLS: Partial<Record<AuthProvider, string>> = {
  threevideo: `${THREEVIDEO_OPENAI_BASE}/models`,
  wanx: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
  seedance: 'https://ark.cn-beijing.volces.com/api/v3/models',
}

/**
 * 创建 `auth/*` 的 dispatcher。
 *
 * 每次调用先尝试从凭证缝恢复跨重启会话（只尝试一次）；随后按端点分发，
 * 上游/网络/校验失败一律翻成 `{ ok: false, error }`，不让异常穿透成 HTTP 500。
 *
 * @param ctx - 宿主上下文（只读取 `credentials` 与 `logger`）。
 * @param options - 可注入的装配项（fetch / 地址 / 引用名 / 服务商清单）。
 * @returns 端点分发函数。
 */
export function createAuthDispatcher(ctx: Context, options: AuthDispatcherOptions = {}): AuthDispatcher {
  const baseUrl = (options.baseUrl ?? THREEVIDEO_BASE_URL).replace(/\/+$/, '')
  const openaiBaseUrl = (options.openaiBaseUrl ?? THREEVIDEO_OPENAI_BASE).replace(/\/+$/, '')
  const sessionKey = options.sessionKey ?? IMAGE_VIDEO_AUTH_SESSION_KEY
  const defaultProvider = options.defaultProvider ?? 'threevideo'
  const timeoutMs = options.timeoutMs ?? 20_000
  const fetchImpl: AuthFetch | undefined = options.fetch ?? (globalThis as { fetch?: AuthFetch }).fetch
  const providerRefs: Partial<Record<AuthProvider, string>> = { ...DEFAULT_PROVIDER_API_KEY_REFS, ...options.providerRefs }
  // 探测端点：threevideo 跟随可注入的 OpenAI 兼容根，其余沿用内置表；显式 probeUrls 最后覆盖
  const probeUrls: Partial<Record<AuthProvider, string>> = {
    ...BUILTIN_PROBE_URLS,
    threevideo: `${openaiBaseUrl}/models`,
    ...options.probeUrls,
  }

  const providers: AuthProviderInfo[] = (options.providers ?? BUILTIN_PROVIDERS).map(info => ({
    id: info.id,
    label: info.label,
    settable: providerRefName(info.id) !== undefined,
    testable: probeUrlFor(info.id) !== undefined,
  }))

  /** 进程内的登录态；`restoreSession` 会在任何「视为未登录」的判断之前重建它。 */
  let session: StoredAuthSession | null = null

  /** 是否已经尝试过从凭证缝恢复（一次进程只读一次记录）。 */
  let restoreAttempted = false

  /** 该服务商写哪个凭证引用；未配置返回 undefined。 */
  function providerRefName(provider: AuthProvider): string | undefined {
    const ref = providerRefs[provider]
    return ref === undefined || ref.trim() === '' ? undefined : ref.trim()
  }

  /** 该服务商的连通性探测 URL；未登记返回 undefined。 */
  function probeUrlFor(provider: AuthProvider): string | undefined {
    return probeUrls[provider]
  }

  /** 读取凭证服务；缺失时返回 undefined（调用方决定是否拒绝）。 */
  function credentialsService() {
    return ctx.get('credentials')
  }

  /** 要求凭证服务存在，否则明确拒绝（不会假装写成功）。 */
  function requireCredentials() {
    const credentials = credentialsService()
    if (credentials === undefined) {
      throw new AuthFailure('auth/no-credentials-service', '宿主未提供凭证服务，无法保存 API Key')
    }
    return credentials
  }

  /** 重建登录态；缺记录/坏记录都当作未登录。 */
  async function restoreSession(): Promise<void> {
    if (restoreAttempted) return
    const credentials = credentialsService()
    if (credentials === undefined) return
    restoreAttempted = true
    try {
      const record = await credentials.readRecord(sessionKey)
      if (record?.kind !== 'grant') return
      const restored = asStoredSession(record.payload)
      if (restored === undefined) return
      session = restored
      ctx.logger.info('image-video auth: restored the stored session')
    } catch (error) {
      ctx.logger.warn('image-video auth: could not restore the stored session', error)
    }
  }

  /** 把登录态写进凭证缝（跨重启）。 */
  async function persistSession(): Promise<void> {
    const credentials = credentialsService()
    if (credentials === undefined || session === null) return
    const current = session
    await credentials.modifyRecord(sessionKey, async () => ({ kind: 'grant', payload: current }))
  }

  /** 删除跨重启会话记录。 */
  async function forgetSession(): Promise<void> {
    const credentials = credentialsService()
    if (credentials === undefined) return
    await credentials.deleteRecord(sessionKey)
  }

  /** 超时信号（Node 22 有 AbortSignal.timeout；测试注入的 fetch 会忽略它）。 */
  function requestSignal(): AbortSignal | undefined {
    try {
      return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined
    } catch {
      return undefined
    }
  }

  /** 发一次 JSON 请求；HTTP/网络/JSON 错误都翻成结构化失败。 */
  async function requestJson<T>(url: string, init: {
    method?: 'GET' | 'POST'
    token?: string
    body?: unknown
  } = {}): Promise<T> {
    if (fetchImpl === undefined) throw upstreamFailure('当前运行时没有 fetch，无法访问服务端')
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (init.body !== undefined) headers['Content-Type'] = 'application/json'
    if (init.token !== undefined && init.token !== '') headers.Authorization = `Bearer ${init.token}`
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: init.method ?? 'GET',
        headers,
        ...init.body === undefined ? {} : { body: JSON.stringify(init.body) },
        ...requestSignal() === undefined ? {} : { signal: requestSignal() },
      })
    } catch (error) {
      throw upstreamFailure(`无法连接服务端：${messageOf(error)}`)
    }
    let text = ''
    try {
      text = await response.text()
    } catch {
      text = ''
    }
    let parsed: unknown
    if (text.trim() !== '') {
      try {
        parsed = JSON.parse(text)
      } catch {
        throw upstreamFailure(`服务端返回了非 JSON 响应（HTTP ${response.status}）`)
      }
    }
    if (!response.ok) {
      const detail = isRecord(parsed) && typeof parsed.message === 'string' ? parsed.message : text.slice(0, 200)
      throw upstreamFailure(`服务端返回 HTTP ${response.status}${detail === '' ? '' : `：${detail}`}`)
    }
    return parsed as T
  }

  /**
   * 发一次 Threevideo 业务请求并拆包络。`code !== 0` 用上游 message 作为错误说明
   * （账号密码错误的可读原因就在那里）。
   */
  async function threevideoRequest<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
    const envelope = await requestJson<ThreevideoEnvelope<T>>(`${baseUrl}/api/v1${path}`, {
      method,
      ...session?.accessToken === undefined ? {} : { token: session.accessToken },
      ...body === undefined ? {} : { body },
    })
    if (!isRecord(envelope) || typeof envelope.code !== 'number') {
      throw upstreamFailure('服务端响应格式异常（缺少 code/data 包络）')
    }
    if (envelope.code !== 0) {
      const message = typeof envelope.message === 'string' && envelope.message !== ''
        ? envelope.message
        : `服务端错误码 ${envelope.code}`
      throw upstreamFailure(message)
    }
    return envelope.data
  }

  /** 确保账号至少有一把可用 Key（列出现有 → 没有就自动创建），返回 Key 明文。 */
  async function ensureApiKeyExists(): Promise<string | undefined> {
    const listed = await threevideoRequest<unknown>('/keys')
    const items = isRecord(listed) && Array.isArray(listed.items) ? listed.items : []
    const active = items
      .map(rawApiKey)
      .find((entry): entry is { key: string, status?: string } => entry !== undefined && (entry.status ?? 'active') === 'active')
    if (active !== undefined) {
      ctx.logger.info('image-video auth: reusing the existing active API key')
      return active.key
    }
    ctx.logger.info('image-video auth: no active API key, creating one')
    const groupId = session?.profile.allowedGroups[0]
    const created = await threevideoRequest<unknown>('/keys', 'POST', {
      name: 'DeepSeek Harness image/video desktop',
      ...groupId === undefined ? {} : { group_id: groupId },
    })
    const mapped = rawApiKey(created)
    if (mapped === undefined) throw upstreamFailure('创建 API Key 的响应里没有 key 字段')
    return mapped.key
  }

  /** 把 Key 写进指定服务商的凭证引用（唯一的写盘入口）。 */
  async function writeApiKey(provider: AuthProvider, apiKey: string): Promise<void> {
    const refName = providerRefName(provider)
    if (refName === undefined) {
      throw new AuthFailure('auth/not-configured', `服务商 ${provider} 未配置凭证引用，无法保存 Key`)
    }
    const credentials = requireCredentials()
    await credentials.set(credentialRef(refName), apiKey)
  }

  /** 读某个服务商的 Key 状态（脱敏；不含明文）。 */
  async function readKeyState(provider: AuthProvider): Promise<AuthKeyState> {
    const refName = providerRefName(provider)
    const credentials = credentialsService()
    if (refName === undefined || credentials === undefined) return { provider, configured: false }
    try {
      const resolved = await credentials.resolve(credentialRef(refName))
      if (resolved === undefined || resolved.value === '') return { provider, configured: false }
      const last4 = keyLast4(resolved.value)
      return {
        provider,
        configured: true,
        ...last4 === undefined ? {} : { last4 },
        ...resolved.source === undefined || resolved.source === '' ? {} : { source: resolved.source },
      }
    } catch (error) {
      // 读凭证失败只影响状态展示，不该让健康检查整体失败
      ctx.logger.warn('image-video auth: could not read the stored API key state', error)
      return { provider, configured: false }
    }
  }

  /** 读某个服务商的 Key 明文（仅供宿主内部做连通性测试，绝不回包）。 */
  async function readKeyValue(provider: AuthProvider): Promise<string | undefined> {
    const refName = providerRefName(provider)
    const credentials = credentialsService()
    if (refName === undefined || credentials === undefined) return undefined
    try {
      const resolved = await credentials.resolve(credentialRef(refName))
      return resolved === undefined || resolved.value === '' ? undefined : resolved.value
    } catch (error) {
      ctx.logger.warn('image-video auth: could not read the stored API key', error)
      return undefined
    }
  }

  /** 只用一次 GET `/models` 判断 Key 是否可用；网络问题与 Key 问题分开说明。 */
  async function testApiKey(provider: AuthProvider, apiKey: string): Promise<AuthTestKeyValue> {
    const probeUrl = probeUrlFor(provider)
    if (probeUrl === undefined) {
      return { valid: false, testable: false, reason: '该服务商暂不支持连通性测试' }
    }
    if (fetchImpl === undefined) {
      return { valid: false, testable: true, reason: '当前运行时没有 fetch，无法测试连接' }
    }
    try {
      const response = await fetchImpl(probeUrl, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
        ...requestSignal() === undefined ? {} : { signal: requestSignal() },
      })
      if (response.ok) return { valid: true, testable: true }
      if (response.status === 401 || response.status === 403) {
        return { valid: false, testable: true, reason: `Key 无效或已过期（HTTP ${response.status}）` }
      }
      return { valid: false, testable: true, reason: `服务端返回 HTTP ${response.status}` }
    } catch (error) {
      return { valid: false, testable: true, reason: `无法连接服务端：${messageOf(error)}` }
    }
  }

  /** 把当前会话资料整理成 `auth/health` 需要的字段。 */
  async function sessionFields(): Promise<{
    signedIn: boolean
    email?: string
    username?: string
    balance?: number
  }> {
    if (session === null) return { signedIn: false }
    return {
      signedIn: true,
      email: session.profile.email,
      username: session.profile.username,
      balance: session.profile.balance,
    }
  }

  /** 按端点分发；所有异常在这里收敛成回包络。 */
  async function dispatch(endpoint: string, payload: unknown): Promise<AuthResult> {
    try {
      await restoreSession()
      switch (endpoint) {
        case 'auth/health': {
          asEmptyRequest(payload)
          const state = await readKeyState(defaultProvider)
          const fields = await sessionFields()
          const value: AuthHealthValue = {
            ready: true,
            credentials: credentialsService() !== undefined,
            ...fields,
            hasKey: state.configured,
            ...state.last4 === undefined ? {} : { keyLast4: state.last4 },
            provider: defaultProvider,
            providers,
          }
          return { ok: true, value }
        }

        case 'auth/login': {
          const { email, password, turnstileToken } = asLoginRequest(payload)
          // 凭证服务缺失时必然无法完成闭环（Key 存不下来），先明确拒绝，避免白登录一趟
          requireCredentials()
          ctx.logger.info(`image-video auth: login attempt for ${email}`)
          const loginData = await threevideoRequest<unknown>('/auth/login', 'POST', {
            email,
            password,
            ...turnstileToken === undefined ? {} : { turnstile_token: turnstileToken },
          })
          if (!isRecord(loginData) || typeof loginData.access_token !== 'string' || loginData.access_token === '') {
            throw upstreamFailure('登录响应缺少 access_token')
          }
          const mappedProfile = mapUser(loginData.user)
          if (mappedProfile === undefined) throw upstreamFailure('登录响应缺少用户资料')
          session = {
            accessToken: loginData.access_token,
            refreshToken: typeof loginData.refresh_token === 'string' ? loginData.refresh_token : '',
            profile: mappedProfile,
            affCode: '',
          }

          // 资料 + 邀请码：失败不影响登录本身（权限/网络抖动时仍算登录成功）
          try {
            const [me, aff] = await Promise.all([
              threevideoRequest<unknown>('/auth/me'),
              threevideoRequest<unknown>('/user/aff'),
            ])
            const refreshed = mapUser(me)
            if (refreshed !== undefined) session.profile = refreshed
            if (isRecord(aff) && typeof aff.aff_code === 'string') session.affCode = aff.aff_code
          } catch (error) {
            ctx.logger.warn('image-video auth: profile refresh failed after login (non-fatal)', error)
          }

          // Key provisioning：失败不让登录失败，只是这次没拿到 Key（界面如实显示未配置）
          let provisionedKey: string | undefined
          try {
            provisionedKey = await ensureApiKeyExists()
            if (provisionedKey !== undefined) {
              await writeApiKey(defaultProvider, provisionedKey)
              ctx.logger.info('image-video auth: injected the provisioned API key into credentials')
            }
          } catch (error) {
            ctx.logger.warn('image-video auth: API key provisioning failed (non-fatal)', error)
          }

          try {
            await persistSession()
          } catch (error) {
            // 会话在本进程内仍可用，只是重启后要重新登录
            ctx.logger.warn('image-video auth: could not persist the session', error)
          }

          const last4 = provisionedKey === undefined ? undefined : keyLast4(provisionedKey)
          const storedState = await readKeyState(defaultProvider)
          const value: AuthLoginValue = {
            success: true,
            email: session.profile.email,
            username: session.profile.username,
            balance: session.profile.balance,
            hasKey: last4 !== undefined || storedState.configured,
            ...last4 === undefined ? {} : { keyLast4: last4 },
            credentialsWritten: last4 !== undefined,
            ...session.affCode === '' ? {} : { affCode: session.affCode },
          }
          ctx.logger.info(`image-video auth: login successful for ${email}`)
          return { ok: true, value }
        }

        case 'auth/logout': {
          asEmptyRequest(payload)
          // 先删记录再清内存：删失败时保持「仍登录」，避免两边不一致
          await forgetSession()
          session = null
          restoreAttempted = true
          const refName = providerRefName(defaultProvider)
          const credentials = credentialsService()
          if (refName !== undefined && credentials !== undefined) {
            try {
              await credentials.unset(credentialRef(refName))
            } catch (error) {
              ctx.logger.warn('image-video auth: could not unset the stored API key on logout', error)
            }
          }
          return { ok: true, value: { success: true } }
        }

        case 'auth/profile': {
          asEmptyRequest(payload)
          if (session === null) throw new AuthFailure('auth/not-signed-in', '尚未登录')
          const [me, aff] = await Promise.all([
            threevideoRequest<unknown>('/auth/me'),
            threevideoRequest<unknown>('/user/aff'),
          ])
          const profile = mapUser(me)
          if (profile === undefined) throw upstreamFailure('用户资料响应格式异常')
          session.profile = profile
          if (isRecord(aff) && typeof aff.aff_code === 'string') session.affCode = aff.aff_code
          try {
            await persistSession()
          } catch (error) {
            ctx.logger.warn('image-video auth: could not persist the refreshed session', error)
          }
          const state = await readKeyState(defaultProvider)
          const value: AuthProfileValue = {
            signedIn: true,
            email: profile.email,
            username: profile.username,
            balance: profile.balance,
            hasKey: state.configured,
            ...state.last4 === undefined ? {} : { keyLast4: state.last4 },
            ...session.affCode === '' ? {} : { affCode: session.affCode },
          }
          return { ok: true, value }
        }

        case 'auth/set-key': {
          const request = asSetKeyRequest(payload)
          const provider = request.provider ?? defaultProvider
          requireCredentials()
          // `test: true` 时先验一次；只在「能测且确实无效」时拒绝，无法测试的服务商照常保存
          if (request.test) {
            const probed = await testApiKey(provider, request.apiKey)
            if (probed.testable && !probed.valid) {
              throw new AuthFailure('auth/invalid-key', probed.reason ?? 'API Key 校验失败')
            }
          }
          await writeApiKey(provider, request.apiKey)
          const last4 = keyLast4(request.apiKey)
          if (last4 === undefined) throw new AuthFailure('auth/invalid-payload', 'API Key 不能为空')
          ctx.logger.info(`image-video auth: stored a user-provided API key for ${provider} (ends in ${last4})`)
          const value: AuthSetKeyValue = { success: true, provider, keyLast4: last4, configured: true }
          return { ok: true, value }
        }

        case 'auth/test-key': {
          if (payload !== undefined && payload !== null && !isRecord(payload)) {
            throw new AuthFailure('auth/invalid-payload', '请求载荷必须是对象')
          }
          const request = isRecord(payload) ? payload : {}
          const provider = request.provider === undefined || request.provider === ''
            ? defaultProvider
            : asProvider(request.provider)
          const provided = typeof request.apiKey === 'string' ? request.apiKey.trim() : ''
          const apiKey = provided !== '' ? provided : await readKeyValue(provider)
          if (apiKey === undefined || apiKey === '') {
            return { ok: true, value: { valid: false, testable: probeUrlFor(provider) !== undefined, reason: '还没有可测试的 API Key' } satisfies AuthTestKeyValue }
          }
          return { ok: true, value: await testApiKey(provider, apiKey) }
        }

        case 'auth/key-state': {
          if (payload !== undefined && payload !== null && !isRecord(payload)) {
            throw new AuthFailure('auth/invalid-payload', '请求载荷必须是对象')
          }
          const request = isRecord(payload) ? payload : {}
          const provider = request.provider === undefined || request.provider === ''
            ? defaultProvider
            : asProvider(request.provider)
          return { ok: true, value: await readKeyState(provider) }
        }

        default:
          throw new AuthFailure('auth/unknown-endpoint', `未知的 auth 端点：${endpoint}`)
      }
    } catch (error) {
      const failure = error instanceof AuthFailure
        ? error
        : new AuthFailure('auth/upstream', messageOf(error))
      ctx.logger.error(`image-video auth: RPC "${endpoint}" failed: ${failure.message}`)
      return { ok: false, error: { code: failure.code, message: failure.message } }
    }
  }

  return dispatch
}

/**
 * 把 dispatcher 包成连接通道可直接挂的 handler 形状（补 `details: {}`）。
 *
 * 入口可以把这条 handler 与工作台 handler 合并，也可以按 `auth/` 前缀分流；
 * 两者共享同一份 dispatcher 状态（服务商清单、登录态）。
 *
 * @param ctx - 宿主上下文。
 * @param options - 同 {@link createAuthDispatcher}。
 * @returns 连接 RPC handler（成功/失败包络与 `rpc.ts` 一致）。
 */
export function createAuthRpcHandler(ctx: Context, options: AuthDispatcherOptions = {}) {
  const dispatch = createAuthDispatcher(ctx, options)
  return async (endpoint: string, payload: unknown): Promise<
    { ok: true, value: unknown } | { ok: false, error: { code: string, message: string, details: object } }
  > => {
    const result = await dispatch(endpoint, payload)
    return result.ok ? result : { ok: false, error: { ...result.error, details: {} } }
  }
}
