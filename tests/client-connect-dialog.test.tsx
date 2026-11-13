// @vitest-environment jsdom
/**
 * 连接弹层的行为：两条链路（账号登录 / 自带 Key）各自把请求交给宿主，界面只显示
 * 宿主回传的脱敏信息（余额、Key 末四位）。
 *
 * 断言刻意停在「用户看得见什么」：按 aria 角色找控件，按文案找结果，不碰内部 state。
 * 宿主侧真实网络与凭证缝见 `tests/host-auth.test.ts`。
 */
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectDialog } from '../src/client/auth/ConnectDialog.tsx'
import { authEn, type AuthLocaleKey } from '../src/client/auth/locales.ts'
import type { WorkbenchApi } from '../src/client/api.ts'
import { fakeApi, fireEvent, render, screen, waitFor } from './client-fake-api.ts'

afterEach(cleanup)

const t = (key: string): string => authEn[key as AuthLocaleKey] ?? key

/** 用假宿主拼一个可覆盖 `auth/*` 的 API。 */
function apiWith(overrides: Partial<WorkbenchApi> = {}): WorkbenchApi {
  return { ...fakeApi().api, ...overrides }
}

/** 渲染弹层。 */
function renderDialog(api: WorkbenchApi) {
  return render(<ConnectDialog api={api} t={t} onClose={() => {}} />)
}

describe('connect dialog', () => {
  it('shows the account form when signed out', async () => {
    renderDialog(apiWith())
    expect(await screen.findByRole('tab', { name: authEn.tabAccount })).toBeTruthy()
    expect(await screen.findByLabelText(authEn.emailLabel)).toBeTruthy()
    expect(screen.getByLabelText(authEn.passwordLabel)).toBeTruthy()
    expect(screen.getByRole('button', { name: authEn.signIn })).toBeTruthy()
  })

  it('refuses an empty login without calling the host', async () => {
    const authLogin = vi.fn()
    renderDialog(apiWith({ authLogin }))
    fireEvent.click(await screen.findByRole('button', { name: authEn.signIn }))
    expect(await screen.findByText(authEn.enterCredentials)).toBeTruthy()
    expect(authLogin).not.toHaveBeenCalled()
  })

  it('signs in through auth/login and reports the provisioned key', async () => {
    const authLogin = vi.fn(async () => ({
      success: true as const, email: 'a@b.c', username: 'tester', balance: 7,
      hasKey: true, keyLast4: 'abcd', credentialsWritten: true,
    }))
    renderDialog(apiWith({ authLogin }))
    fireEvent.change(await screen.findByLabelText(authEn.emailLabel), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText(authEn.passwordLabel), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: authEn.signIn }))
    expect(await screen.findByText(authEn.loginSuccess)).toBeTruthy()
    expect(authLogin).toHaveBeenCalledWith({ email: 'a@b.c', password: 'secret' })
  })

  it('saves a pasted key through auth/set-key and shows only the last four digits', async () => {
    const authSetKey = vi.fn(async () => ({
      success: true as const, provider: 'threevideo' as const, keyLast4: 'wxyz', configured: true as const,
    }))
    // 保存成功后宿主再查 key-state 会回「已配置」，弹层据此刷新末四位
    const authKeyState = async () => ({ provider: 'threevideo' as const, configured: true, last4: 'wxyz' })
    renderDialog(apiWith({ authSetKey, authKeyState }))
    fireEvent.click(await screen.findByRole('tab', { name: authEn.tabApiKey }))
    fireEvent.change(await screen.findByLabelText(authEn.apiKeyLabel), { target: { value: 'sk-secret-value' } })
    fireEvent.click(screen.getByRole('button', { name: authEn.saveKey }))
    expect(await screen.findByText(authEn.keySaved)).toBeTruthy()
    expect(authSetKey).toHaveBeenCalledWith({ apiKey: 'sk-secret-value', provider: 'threevideo' })
    await waitFor(() => expect(screen.getByText(authEn.keyConfigured.replace('{last4}', 'wxyz'))).toBeTruthy())
  })

  it('reports a failed connectivity test with the host reason', async () => {
    const authTestKey = vi.fn(async () => ({ valid: false, testable: true, reason: 'bad key' }))
    renderDialog(apiWith({ authTestKey }))
    fireEvent.click(await screen.findByRole('tab', { name: authEn.tabApiKey }))
    fireEvent.click(await screen.findByRole('button', { name: authEn.testConnection }))
    expect(await screen.findByText(authEn.testFailed.replace('{reason}', 'bad key'))).toBeTruthy()
  })

  it('explains when the host channel is unavailable', async () => {
    renderDialog(apiWith({ authHealth: async () => { throw new Error('no channel') } }))
    expect(await screen.findByText(new RegExp(authEn.hostUnavailable))).toBeTruthy()
  })

  it('offers registration and the auto-provision hint when signed out', async () => {
    renderDialog(apiWith({
      authHealth: async () => ({
        ready: true, credentials: true, signedIn: false, hasKey: false, provider: 'threevideo',
        providerLabel: 'Threevideo',
        providers: [{ id: 'threevideo', label: 'Threevideo', settable: true, testable: true }],
        registerUrl: 'https://example.com/register',
      }),
    }))
    const register = await screen.findByRole('link', { name: authEn.registerAccount })
    expect(register.getAttribute('href')).toBe('https://example.com/register')
    expect(screen.getByText(authEn.registerHint)).toBeTruthy()
  })

  it('lists provider names with their key status on separate lines', async () => {
    renderDialog(apiWith({
      authHealth: async () => ({
        ready: true, credentials: true, signedIn: false, hasKey: true, provider: 'threevideo',
        providerLabel: 'Threevideo', keyLast4: 'abcd',
        providers: [
          { id: 'threevideo', label: 'Threevideo', settable: true, testable: true },
          { id: 'wanx', label: 'Wanx', settable: true, testable: true },
          { id: 'minimax', label: 'MiniMax', settable: true, testable: false },
        ],
        providerStates: [
          { id: 'threevideo', label: 'Threevideo', keyConfigured: true, last4: 'abcd', testable: true, verified: true, baseUrl: 'https://example.com/v1' },
          { id: 'wanx', label: 'Wanx', keyConfigured: true, last4: 'wxyz', testable: true, baseUrl: 'https://example.com/wanx' },
          { id: 'minimax', label: 'MiniMax', keyConfigured: false, testable: false, baseUrl: '' },
        ],
      }),
    }))
    fireEvent.click(await screen.findByRole('tab', { name: authEn.tabApiKey }))
    expect((await screen.findAllByText('Threevideo')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('MiniMax').length).toBeGreaterThan(0)
    // 已验证连通的服务商重开弹层仍然显示「连接正常」，并排在已配置项之前
    expect(screen.getByText(authEn.statusReady)).toBeTruthy()
    expect(screen.getByText(authEn.statusConfigured.replace('{last4}', 'wxyz'))).toBeTruthy()
    expect(screen.getAllByText(authEn.statusMissing).length).toBeGreaterThan(0)
  })

  it('saves the editable local endpoint without requiring a key', async () => {
    const authSetKey = vi.fn(async () => ({
      success: true as const, provider: 'local' as const, keyLast4: '', configured: true as const,
      baseUrl: 'http://192.168.1.5:8000/v1',
    }))
    renderDialog(apiWith({
      authSetKey,
      authHealth: async () => ({
        ready: true, credentials: true, signedIn: false, hasKey: false, provider: 'threevideo',
        providerLabel: 'Threevideo',
        providers: [
          { id: 'threevideo', label: 'Threevideo', settable: true, testable: true },
          { id: 'local', label: 'Local model', settable: true, testable: true, endpointEditable: true },
        ],
        providerStates: [
          { id: 'threevideo', label: 'Threevideo', keyConfigured: false, testable: true, baseUrl: 'https://example.com/v1' },
          { id: 'local', label: 'Local model', keyConfigured: false, testable: true, baseUrl: 'http://127.0.0.1:11434/v1' },
        ],
        local: { baseUrl: 'http://127.0.0.1:11434/v1', defaultBaseUrl: 'http://127.0.0.1:11434/v1' },
      }),
    }))
    fireEvent.click(await screen.findByRole('tab', { name: authEn.tabApiKey }))
    fireEvent.change(await screen.findByLabelText(authEn.providerLabel), { target: { value: 'local' } })
    const endpoint = await screen.findByLabelText(authEn.localEndpointLabel)
    await waitFor(() => expect((endpoint as HTMLInputElement).value).toBe('http://127.0.0.1:11434/v1'))
    fireEvent.change(endpoint, { target: { value: 'http://192.168.1.5:8000/v1' } })
    fireEvent.click(screen.getByRole('button', { name: authEn.saveSettings }))
    expect(await screen.findByText(authEn.settingsSaved)).toBeTruthy()
    expect(authSetKey).toHaveBeenCalledWith({
      apiKey: '', provider: 'local', baseUrl: 'http://192.168.1.5:8000/v1',
    })
  })

  it('renders the signed-in profile card with balance, settings and sign out', async () => {
    renderDialog(apiWith({
      authHealth: async () => ({
        ready: true, credentials: true, signedIn: true, hasKey: true, provider: 'threevideo',
        providerLabel: 'Threevideo', email: 'user@example.com', balance: 148.92, keyLast4: 'abcd',
        providers: [{ id: 'threevideo', label: 'Threevideo', settable: true, testable: true }],
        providerStates: [
          { id: 'threevideo', label: 'Threevideo', keyConfigured: true, last4: 'abcd', testable: true, baseUrl: 'https://example.com/v1' },
        ],
      }),
    }))
    expect(await screen.findByText('user@example.com')).toBeTruthy()
    expect(screen.getByText('$148.92')).toBeTruthy()
    expect(screen.getByText(authEn.signedInNotice.replace('{provider}', 'Threevideo'))).toBeTruthy()
    expect(screen.getByText(authEn.apiKeyReady)).toBeTruthy()
    expect(screen.getByRole('button', { name: authEn.settingsAction })).toBeTruthy()
    expect(screen.getByRole('button', { name: authEn.shareInvite })).toBeTruthy()
    expect(screen.getByRole('button', { name: authEn.signOut })).toBeTruthy()
  })
})
