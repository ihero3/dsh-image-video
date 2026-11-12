/**
 * 连接弹层：账号登录 与 自带 API Key 两条链路。
 *
 * 只做表单与状态展示，所有副作用都在宿主：
 * - 登录 → 宿主自动创建/复用 Key 并写进凭证缝；
 * - 自带 Key 写进同一处凭证缝；
 * - 界面只拿到余额与 Key 末四位，**不接收也不显示明文**。
 *
 * 文案走独立命名空间 `image-video-auth`（见 `./locales.ts`），服务商名称与探测能力
 * 全部由 `auth/health` 下发，浏览器包不内置任何服务商事实。
 *
 * @module dsh-image-video/client/auth/ConnectDialog
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AuthHealthValue, AuthKeyState, AuthProvider } from '../../host/auth.ts'
import type { WorkbenchApi } from '../api.ts'
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

/** 一条给用户看的结果提示。 */
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

/**
 * 连接弹层本体。
 * @param props - 宿主 API、翻译函数与关闭回调。
 */
export function ConnectDialog({ api, t, onClose }: ConnectDialogProps): ReactNode {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [tab, setTab] = useState<AuthTab>('account')
  const [health, setHealth] = useState<AuthHealthValue | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState<'login' | 'logout' | 'save' | 'test' | undefined>(undefined)
  const [provider, setProvider] = useState<AuthProvider | undefined>(undefined)
  const [apiKey, setApiKey] = useState('')
  const [keyState, setKeyState] = useState<AuthKeyState | undefined>(undefined)
  const [notice, setNotice] = useState<Notice | undefined>(undefined)

  useDialogFocus(true, panelRef, onClose)

  /** 拉一次宿主状态；失败时保留上一次数据，只更新错误提示。 */
  const refresh = useCallback(async (): Promise<AuthHealthValue | undefined> => {
    try {
      const next = await api.authHealth()
      setHealth(next)
      setLoadError(undefined)
      setProvider(current => current ?? next.providers[0]?.id)
      return next
    } catch (error) {
      setLoadError(messageOf(error))
      return undefined
    }
  }, [api])

  useEffect(() => { void refresh() }, [refresh])

  const activeProvider = provider ?? health?.providers[0]?.id

  /** 服务商切换后刷新脱敏 Key 状态（没有 key-state 端点时静默）。 */
  useEffect(() => {
    if (activeProvider === undefined) return
    let cancelled = false
    void api.authKeyState(activeProvider).then(
      state => { if (!cancelled) setKeyState(state) },
      () => { if (!cancelled) setKeyState(undefined) },
    )
    return () => { cancelled = true }
  }, [api, activeProvider, health])

  const run = useCallback(async (
    kind: NonNullable<typeof pending>,
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
    if (apiKey.trim() === '') {
      setNotice({ kind: 'error', text: t('enterApiKey') })
      return
    }
    void run('save', async () => {
      const result = await api.authSetKey({
        apiKey: apiKey.trim(),
        ...activeProvider === undefined ? {} : { provider: activeProvider },
      })
      setApiKey('')
      await refresh()
      setKeyState({ provider: result.provider, configured: true, last4: result.keyLast4 })
      return { kind: 'ok', text: t('keySaved') }
    })
  }

  const testKey = (): void => {
    void run('test', async () => {
      const result = await api.authTestKey({
        ...apiKey.trim() === '' ? {} : { apiKey: apiKey.trim() },
        ...activeProvider === undefined ? {} : { provider: activeProvider },
      })
      if (!result.valid && result.testable === false) return { kind: 'error', text: t('testUnsupported') }
      return result.valid
        ? { kind: 'ok', text: t('testSuccess') }
        : { kind: 'error', text: fill(t('testFailed'), { reason: result.reason ?? t('requestFailed') }) }
    })
  }

  const keyLine = keyState === undefined
    ? undefined
    : keyState.configured
      ? fill(t('keyConfigured'), { last4: keyState.last4 ?? '' })
      : t('keyMissing')

  return (
    <div
      className="iv-help-mask"
      data-workbench-connect="true"
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        className="iv-help iv-connect"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('dialogTitle')}
      >
        <div className="iv-connect-head">
          <div>
            <h4>{t('dialogTitle')}</h4>
            <p className="iv-meta">{t('dialogSubtitle')}</p>
          </div>
          <button
            type="button"
            className="iv-btn iv-btn--icon iv-btn--sm iv-btn--ghost"
            aria-label={t('close')}
            title={t('close')}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="iv-connect-tabs" role="tablist" aria-label={t('dialogTitle')}>
          {(['account', 'apiKey'] as const).map(candidate => (
            <button
              key={candidate}
              type="button"
              role="tab"
              className={`iv-modes-btn${candidate === tab ? ' on' : ''}`}
              aria-selected={candidate === tab}
              data-auth-tab={candidate}
              onClick={() => { setTab(candidate) }}
            >
              {candidate === 'account' ? t('tabAccount') : t('tabApiKey')}
            </button>
          ))}
        </div>

        {loadError !== undefined
          ? <p className="iv-meta" data-auth-error="true">{t('hostUnavailable')} {loadError}</p>
          : health === undefined
            ? <p className="iv-meta">{t('loadingState')}</p>
            : tab === 'account'
              ? (
                <div className="iv-connect-body" role="tabpanel">
                  {health.signedIn
                    ? (
                      <>
                        <p className="iv-connect-status">
                          <strong>{t('signedInLabel')}</strong>
                          <span className="iv-meta">{health.email ?? health.username ?? ''}</span>
                        </p>
                        <dl className="iv-connect-facts">
                          <dt>{t('balanceLabel')}</dt>
                          <dd>{health.balance ?? '—'}</dd>
                          <dt>{t('keyLabel')}</dt>
                          <dd>{health.keyLast4 === undefined ? t('keyMissing') : fill(t('keyConfigured'), { last4: health.keyLast4 })}</dd>
                        </dl>
                        <button
                          type="button"
                          className="iv-btn iv-btn--sm"
                          data-auth-action="logout"
                          disabled={pending !== undefined}
                          onClick={signOut}
                        >
                          {pending === 'logout' ? t('signingOut') : t('signOut')}
                        </button>
                      </>
                    )
                    : (
                      <>
                        <p className="iv-meta">{t('accountTabHint')}</p>
                        <label className="iv-connect-field">
                          <span>{t('emailLabel')}</span>
                          <input
                            className="iv-input"
                            type="email"
                            autoComplete="username"
                            aria-label={t('emailLabel')}
                            placeholder={t('emailPlaceholder')}
                            value={email}
                            onChange={event => { setEmail(event.target.value) }}
                          />
                        </label>
                        <label className="iv-connect-field">
                          <span>{t('passwordLabel')}</span>
                          <input
                            className="iv-input"
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
                          className="iv-btn iv-btn--sm"
                          data-auth-action="login"
                          disabled={pending !== undefined}
                          onClick={signIn}
                        >
                          {pending === 'login' ? t('signingIn') : t('signIn')}
                        </button>
                      </>
                    )}
                </div>
              )
              : (
                <div className="iv-connect-body" role="tabpanel">
                  <p className="iv-meta">{t('apiKeyTabHint')}</p>
                  {health.providers.length === 0
                    ? <p className="iv-meta">{t('noProviders')}</p>
                    : (
                      <>
                        <label className="iv-connect-field">
                          <span>{t('providerLabel')}</span>
                          <select
                            className="iv-input"
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
                        <label className="iv-connect-field">
                          <span>{t('apiKeyLabel')}</span>
                          <input
                            className="iv-input"
                            type="password"
                            autoComplete="off"
                            aria-label={t('apiKeyLabel')}
                            placeholder={t('apiKeyPlaceholder')}
                            value={apiKey}
                            onChange={event => { setApiKey(event.target.value) }}
                          />
                        </label>
                        {keyLine === undefined ? null : <p className="iv-meta">{keyLine}</p>}
                        <div className="iv-connect-actions">
                          <button
                            type="button"
                            className="iv-btn iv-btn--sm"
                            data-auth-action="save-key"
                            disabled={pending !== undefined}
                            onClick={saveKey}
                          >
                            {pending === 'save' ? t('savingKey') : t('saveKey')}
                          </button>
                          <button
                            type="button"
                            className="iv-btn iv-btn--sm iv-btn--ghost"
                            data-auth-action="test-key"
                            disabled={pending !== undefined}
                            onClick={testKey}
                          >
                            {pending === 'test' ? t('testingConnection') : t('testConnection')}
                          </button>
                        </div>
                      </>
                    )}
                </div>
              )}

        {notice === undefined
          ? null
          : (
            <p
              className={`iv-notice${notice.kind === 'error' ? ' iv-notice--error' : ''}`}
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
