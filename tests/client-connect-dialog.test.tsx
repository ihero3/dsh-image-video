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
})
