/**
 * 连接弹层：账号登录 与 自带 API Key 两条链路。
 *
 * 只做表单与状态展示，所有副作用都在宿主：
 * - 登录 → 宿主自动创建/复用 Key 并写进凭证缝；
 * - 自带 Key / 本地模型地址写进同一处长期配置；
 * - 界面只拿到余额与 Key 末四位，**不接收也不显示明文**。
 *
 * 文案走独立命名空间 `image-video-auth`（见 `./locales.ts`），服务商名称、注册链接、
 * 本地模型默认地址全部由 `auth/health` 下发，浏览器包不内置任何服务商事实。
 *
 * @module dsh-image-video/client/auth/ConnectDialog
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AuthHealthValue, AuthKeyState, AuthProvider } from '../../host/auth.ts'
import type { WorkbenchApi } from '../api.ts'
import { useAuthStyle } from '../auth-style.ts'
import { useDialogFocus } from '../use-dialog-focus.ts'

/** 弹层属性。 */
export interface ConnectDialogProps {
  /** 宿主 API（`auth/*` 端点）。 */
  readonly api: WorkbenchApi
  /** 已绑定 `image-video-auth` 的翻译函数。 */
  readonly t: (key: string) => string
  /** 关闭弹层。 */
  readonly onClose: () => void
}

/** 弹层内的两条页签。 */
type AuthTab = 'account' | 'apiKey'

/** 一次进行中的动作。 */
type Pending = 'login' | 'logout' | 'save' | 'test' | 'invite' | 'reset'

/** 一条给用户看的结果提示（可含换行）。 */
interface Notice {
  readonly kind: 'ok' | 'error'
  readonly text: string
}

/** 把字典里的占位符换成实际值。 */
function fill(template: string, values: Record<string, string | undefined>): string {
  let text = template
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) text = text.replaceAll(`{${key}}`, value)
  }
  return text
}

/** 把任意异常收敛成一句可读文案（不包含密钥）。 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 余额展示：宿主给的是美元金额。 */
function formatBalance(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  } catch {
    return `$${value.toFixed(2)}`
  }
}

/** 本地地址只接受 http(s)。 */
function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 连接弹层本体。
 * @param props - 宿主 API、翻译函数与关闭回调。
 */
export function ConnectDialog({ api, t, onClose }: ConnectDialogProps): ReactNode {
  useAuthStyle()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [tab, setTab] = useState<AuthTab>('account')
  const [health, setHealth] = useState<AuthHealthValue | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState<Pending | undefined>(undefined)
  const [provider, setProvider] = useState<AuthProvider | undefined>(undefined)
  const [apiKey, setApiKey] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [keyState, setKeyState] = useState<AuthKeyState | undefined>(undefined)
  const [notice, setNotice] = useState<Notice | undefined>(undefined)

  useDialogFocus(true, panelRef, onClose)

  /** 拉一次宿主状态；失败时保留上一次数据，只更新错误提示。 */
  const refresh = useCallback(async (): Promise<AuthHealthValue | undefined> => {
    try {
      const next = await api.authHealth()
      setHealth(next)
      setLoadError(undefined)
      setProvider(current => current ?? next.lastProvider ?? next.providers[0]?.id)
      return next
    } catch (error) {
      setLoadError(messageOf(error))
      return undefined
    }
  }, [api])

  useEffect(() => { void refresh() }, [refresh])

  const activeProvider = provider ?? health?.providers[0]?.id
  const activeInfo = health?.providers.find(entry => entry.id === activeProvider)
  const local = activeProvider === 'local'
  const endpointEditable = local || activeInfo?.endpointEditable === true

  /** 服务商切换后刷新脱敏 Key 状态，并把接口地址预填成宿主当前值。 */
  useEffect(() => {
    if (activeProvider === undefined) return
    const state = health?.providerStates?.find(entry => entry.id === activeProvider)
    setEndpoint(activeProvider === 'local' ? health?.local?.baseUrl ?? state?.baseUrl ?? '' : state?.baseUrl ?? '')
    let cancelled = false
    void api.authKeyState(activeProvider).then(
      next => { if (!cancelled) setKeyState(next) },
      () => { if (!cancelled) setKeyState(undefined) },
    )
    return () => { cancelled = true }
  }, [api, activeProvider, health])

  const run = useCallback(async (
    kind: Pending,
    action: () => Promise<Notice>,
  ): Promise<void> => {
    if (pending !== undefined) return
    setPending(kind)
    setNotice(undefined)
    try {
      setNotice(await action())
    } catch (error) {
      setNotice({ kind: 'error', text: messageOf(error) })
    } finally {
      setPending(undefined)
    }
  }, [pending])

  const signIn = (): void => {
    if (email.trim() === '' || password === '') {
      setNotice({ kind: 'error', text: t('enterCredentials') })
      return
    }
    void run('login', async () => {
      const result = await api.authLogin({ email: email.trim(), password })
      setPassword('')
      await refresh()
      return {
        kind: 'ok',
        text: result.hasKey || result.credentialsWritten ? t('loginSuccess') : t('keyMissing'),
      }
    })
  }

  const signOut = (): void => {
    void run('logout', async () => {
      await api.authLogout()
      await refresh()
      return { kind: 'ok', text: t('logoutSuccess') }
    })
  }

  const saveKey = (): void => {
    const trimmed = apiKey.trim()
    if (trimmed === '' && !local) {
      setNotice({ kind: 'error', text: t('enterApiKey') })
      return
    }
    if (endpointEditable && !isHttpUrl(endpoint)) {
      setNotice({ kind: 'error', text: t('localEndpointInvalid') })
      return
    }
    void run('save', async () => {
      const result = await api.authSetKey({
        apiKey: trimmed,
        ...activeProvider === undefined ? {} : { provider: activeProvider },
        ...endpointEditable ? { baseUrl: endpoint.trim() } : {},
      })
      setApiKey('')
      await refresh()
      setKeyState({ provider: result.provider, configured: true, ...result.keyLast4 === '' ? {} : { last4: result.keyLast4 } })
      return { kind: 'ok', text: local ? t('settingsSaved') : t('keySaved') }
    })
  }

  const testKey = (): void => {
    if (endpointEditable && !isHttpUrl(endpoint)) {
      setNotice({ kind: 'error', text: t('localEndpointInvalid') })
      return
    }
    void run('test', async () => {
      const result = await api.authTestKey({
        ...apiKey.trim() === '' ? {} : { apiKey: apiKey.trim() },
        ...activeProvider === undefined ? {} : { provider: activeProvider },
        ...endpointEditable ? { baseUrl: endpoint.trim() } : {},
      })
      if (!result.valid && result.testable === false) return { kind: 'error', text: t('testUnsupported') }
      if (!result.valid) {
        return { kind: 'error', text: fill(t('testFailed'), { reason: result.reason ?? t('requestFailed') }) }
      }
      const label = result.providerLabel ?? activeInfo?.label ?? ''
      // 宿主把成功结果写进长期配置；重新拉一次，状态行在关闭弹层后也不丢
      await refresh()
      return { kind: 'ok', text: `${label} ${t('testSuccess')}\n${t('testDetail')}` }
    })
  }

  const shareInvite = (): void => {
    void run('invite', async () => {
      const { url } = await api.authInviteLink()
      if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
        return { kind: 'error', text: `${t('copyFailed')}\n${url}` }
      }
      try {
        await navigator.clipboard.writeText(url)
        return { kind: 'ok', text: t('inviteCopied') }
      } catch {
        return { kind: 'error', text: `${t('copyFailed')}\n${url}` }
      }
    })
  }

  const restoreDefaults = (): void => {
    void run('reset', async () => {
      await api.authReset(activeProvider === undefined ? {} : { provider: activeProvider })
      setApiKey('')
      const next = await refresh()
      if (local) setEndpoint(next?.local?.defaultBaseUrl ?? '')
      return { kind: 'ok', text: t('restoreDone') }
    })
  }

  const keyLine = keyState === undefined
    ? undefined
    : keyState.configured
      ? fill(t('keyConfigured'), { last4: keyState.last4 ?? '' })
      : t('keyMissing')

  const providerName = health?.providerLabel ?? activeInfo?.label ?? ''
  const title = providerName === ''
    ? t('dialogTitle')
    : fill(t('brandTitle'), { provider: providerName })

  const statusList = health?.providerStates === undefined || health.providerStates.length === 0
    ? null
    : (
      <div className="iva-status-list" data-auth-status="true">
        <p className="iva-status-heading">{t('providerStatusTitle')}</p>
        {[...health.providerStates]
          // 已连通 > 已配置 > 未配置；连接正常的服务商永远排在最上面
          .sort((left, right) => Number(right.verified === true) - Number(left.verified === true)
            || Number(right.keyConfigured) - Number(left.keyConfigured))
          .map(state => {
            const ok = state.verified === true
            const text = ok
              ? t('statusReady')
              : state.keyConfigured
                ? fill(t('statusConfigured'), { last4: state.last4 ?? '' })
                : t('statusMissing')
            return (
              <div className="iva-status-row" key={state.id}>
                <span className="iva-status-name">{state.label}</span>
                <span className={`iva-status-text${ok ? ' iva-status-text--ok' : ''}`}>{text}</span>
              </div>
            )
          })}
      </div>
    )

  return (
    <div
      className="iva-backdrop"
      data-workbench-connect="true"
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        className="iva"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('dialogTitle')}
      >
        <div className="iva-header">
          <div className="iva-heading">
            <h4 className="iva-title">{title}</h4>
            <p className="iva-subtitle">{t('dialogSubtitle')}</p>
          </div>
          <button
            type="button"
            className="iva-close"
            aria-label={t('close')}
            title={t('close')}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="iva-tabs" role="tablist" aria-label={t('dialogTitle')}>
          {(['account', 'apiKey'] as const).map(candidate => (
            <button
              key={candidate}
              type="button"
              role="tab"
              className="iva-tab"
              aria-selected={candidate === tab}
              data-auth-tab={candidate}
              onClick={() => { setTab(candidate) }}
            >
              {candidate === 'account' ? t('tabAccount') : t('tabApiKey')}
            </button>
          ))}
        </div>

        {loadError !== undefined
          ? <p className="iva-hint" data-auth-error="true">{t('hostUnavailable')} {loadError}</p>
          : health === undefined
            ? <p className="iva-hint">{t('loadingState')}</p>
            : tab === 'account'
              ? (
                <div className="iva-body" role="tabpanel">
                  {health.signedIn
                    ? (
                      <div className="iva-profile">
                        <p className="iva-banner">
                          {fill(health.hasKey ? t('signedInNotice') : t('signedInNoKeyNotice'), { provider: providerName })}
                        </p>
                        <div className="iva-profile-top">
                          <strong className="iva-email">{health.email ?? health.username ?? ''}</strong>
                          <span className="iva-amount">{formatBalance(health.balance)}</span>
                        </div>
                        <div className="iva-profile-meta">
                          <span>{t('balanceLabel')}</span>
                          <span className={health.hasKey ? 'iva-ok-text' : 'iva-muted'}>
                            {health.hasKey ? t('apiKeyReady') : t('apiKeyNotReady')}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="iva-btn iva-btn--block"
                          data-auth-action="settings"
                          onClick={() => { setTab('apiKey') }}
                        >
                          {t('settingsAction')}
                        </button>
                        {statusList}
                        <div className="iva-actions">
                          <button
                            type="button"
                            className="iva-btn iva-btn--ghost"
                            data-auth-action="share-invite"
                            disabled={pending !== undefined}
                            onClick={shareInvite}
                          >
                            {t('shareInvite')}
                          </button>
                          <button
                            type="button"
                            className="iva-btn iva-btn--danger"
                            data-auth-action="logout"
                            disabled={pending !== undefined}
                            onClick={signOut}
                          >
                            {pending === 'logout' ? t('signingOut') : t('signOut')}
                          </button>
                        </div>
                      </div>
                    )
                    : (
                      <div className="iva-form">
                        <label className="iva-field">
                          <span className="iva-label">{t('emailLabel')}</span>
                          <input
                            className="iva-input"
                            type="email"
                            autoComplete="username"
                            aria-label={t('emailLabel')}
                            placeholder={t('emailPlaceholder')}
                            value={email}
                            onChange={event => { setEmail(event.target.value) }}
                          />
                        </label>
                        <label className="iva-field">
                          <span className="iva-label">{t('passwordLabel')}</span>
                          <input
                            className="iva-input"
                            type="password"
                            autoComplete="current-password"
                            aria-label={t('passwordLabel')}
                            placeholder={t('passwordPlaceholder')}
                            value={password}
                            onChange={event => { setPassword(event.target.value) }}
                          />
                        </label>
                        <button
                          type="button"
                          className="iva-btn iva-btn--primary iva-btn--block"
                          data-auth-action="login"
                          disabled={pending !== undefined}
                          onClick={signIn}
                        >
                          {pending === 'login' ? t('signingIn') : t('signIn')}
                        </button>
                        {health.registerUrl === undefined
                          ? null
                          : (
                            <a
                              className="iva-btn iva-btn--block"
                              data-auth-action="register"
                              href={health.registerUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t('registerAccount')}
                            </a>
                          )}
                        <p className="iva-hint">{t('registerHint')}</p>
                      </div>
                    )}
                </div>
              )
              : (
                <div className="iva-body" role="tabpanel">
                  <p className="iva-hint">{t('apiKeyTabHint')}</p>
                  {health.providers.length === 0
                    ? <p className="iva-hint">{t('noProviders')}</p>
                    : (
                      <div className="iva-form">
                        <label className="iva-field">
                          <span className="iva-label">{t('providerLabel')}</span>
                          <select
                            className="iva-select"
                            aria-label={t('providerLabel')}
                            data-auth-provider="true"
                            value={activeProvider ?? ''}
                            onChange={event => { setProvider(event.target.value as AuthProvider) }}
                          >
                            {health.providers.map(entry => (
                              <option key={entry.id} value={entry.id} disabled={!entry.settable}>{entry.label}</option>
                            ))}
                          </select>
                        </label>
                        {endpointEditable
                          ? (
                            <label className="iva-field">
                              <span className="iva-label">{t('localEndpointLabel')}</span>
                              <input
                                className="iva-input iva-input--mono"
                                type="url"
                                inputMode="url"
                                aria-label={t('localEndpointLabel')}
                                placeholder={health.local?.defaultBaseUrl ?? ''}
                                value={endpoint}
                                onChange={event => { setEndpoint(event.target.value) }}
                              />
                              <span className="iva-hint iva-hint--left">{t('localEndpointHint')}</span>
                            </label>
                          )
                          : null}
                        <label className="iva-field">
                          <span className="iva-label">{t('apiKeyLabel')}</span>
                          <input
                            className="iva-input"
                            type="password"
                            autoComplete="off"
                            aria-label={t('apiKeyLabel')}
                            placeholder={t('apiKeyPlaceholder')}
                            value={apiKey}
                            onChange={event => { setApiKey(event.target.value) }}
                          />
                        </label>
                        {keyLine === undefined ? null : <p className="iva-hint iva-hint--left">{keyLine}</p>}
                        <div className="iva-actions">
                          <button
                            type="button"
                            className="iva-btn iva-btn--primary"
                            data-auth-action="save-key"
                            disabled={pending !== undefined}
                            onClick={saveKey}
                          >
                            {pending === 'save' ? t('savingKey') : local ? t('saveSettings') : t('saveKey')}
                          </button>
                          <button
                            type="button"
                            className="iva-btn"
                            data-auth-action="test-key"
                            disabled={pending !== undefined}
                            onClick={testKey}
                          >
                            {pending === 'test' ? t('testingConnection') : t('testConnection')}
                          </button>
                          <button
                            type="button"
                            className="iva-btn iva-btn--ghost"
                            data-auth-action="restore-defaults"
                            disabled={pending !== undefined}
                            onClick={restoreDefaults}
                          >
                            {t('restoreDefaults')}
                          </button>
                        </div>
                        {statusList}
                      </div>
                    )}
                </div>
              )}

        {notice === undefined
          ? null
          : (
            <p
              className={`iva-notice${notice.kind === 'error' ? ' iva-notice--error' : ''}`}
              role="status"
              data-auth-notice={notice.kind}
            >
              {notice.text}
            </p>
          )}
      </div>
    </div>
  )
}
