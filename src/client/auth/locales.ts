/**
 * 连接弹层的文案字典（命名空间 `image-video-auth`）。
 *
 * 单独挂在自有命名空间下，不改 `src/client/locales.ts`：工作台字典是另一个
 * 并行任务的范围，登录弹层只注册自己这一份，互不冲突。
 *
 * 注意：浏览器包**不内置服务商名/地址/路径**（`tests/client-no-hardcoding.test.ts`
 * 会扫描产物），所以这里的文案只说「服务商」「账号」，具体名字由宿主
 * `auth/health` 下发。
 *
 * @module dsh-image-video/client/auth/locales
 */

/** 连接弹层的 locale 命名空间。入口注册字典时用它。 */
export const AUTH_NS = 'image-video-auth'

/** 连接弹层用到的全部文案键。 */
export type AuthLocaleKey =
  | 'dialogTitle'
  | 'dialogSubtitle'
  | 'tabAccount'
  | 'tabApiKey'
  | 'close'
  | 'loadingState'
  | 'hostUnavailable'
  | 'signedOut'
  | 'signedInLabel'
  | 'balanceLabel'
  | 'keyLabel'
  | 'keyConfigured'
  | 'keyMissing'
  | 'emailLabel'
  | 'emailPlaceholder'
  | 'passwordLabel'
  | 'passwordPlaceholder'
  | 'enterCredentials'
  | 'signIn'
  | 'signingIn'
  | 'signOut'
  | 'signingOut'
  | 'loginSuccess'
  | 'logoutSuccess'
  | 'providerLabel'
  | 'apiKeyLabel'
  | 'apiKeyPlaceholder'
  | 'enterApiKey'
  | 'saveKey'
  | 'savingKey'
  | 'keySaved'
  | 'testConnection'
  | 'testingConnection'
  | 'testSuccess'
  | 'testFailed'
  | 'testUnsupported'
  | 'requestFailed'
  | 'invalidResponse'
  | 'noProviders'
  | 'accountTabHint'
  | 'apiKeyTabHint'

/** 中文文案。 */
export const authZh: Record<AuthLocaleKey, string> = {
  dialogTitle: '连接服务',
  dialogSubtitle: '登录账号可自动开通 API Key，也可以直接填一把已有 Key。',
  tabAccount: '账号登录',
  tabApiKey: '填 API Key',
  close: '关闭',
  loadingState: '正在读取连接状态…',
  hostUnavailable: '宿主通道不可用，暂时无法读取连接状态。',
  signedOut: '未登录',
  signedInLabel: '已登录',
  balanceLabel: '余额',
  keyLabel: 'API Key',
  keyConfigured: '已配置（末四位 {last4}）',
  keyMissing: '尚未配置',
  emailLabel: '邮箱',
  emailPlaceholder: 'you@example.com',
  passwordLabel: '密码',
  passwordPlaceholder: '••••••••',
  enterCredentials: '请先填写邮箱和密码。',
  signIn: '登录',
  signingIn: '登录中…',
  signOut: '退出登录',
  signingOut: '退出中…',
  loginSuccess: '登录成功，API Key 已写入凭证缝。',
  logoutSuccess: '已退出登录。',
  providerLabel: '服务商',
  apiKeyLabel: 'API Key',
  apiKeyPlaceholder: '粘贴你的 API Key',
  enterApiKey: '请先填写 API Key。',
  saveKey: '保存 Key',
  savingKey: '保存中…',
  keySaved: 'API Key 已保存。',
  testConnection: '测试连接',
  testingConnection: '测试中…',
  testSuccess: '连接正常，Key 可用。',
  testFailed: '连接失败：{reason}',
  testUnsupported: '该服务商暂不支持连通性测试。',
  requestFailed: '请求失败。',
  invalidResponse: '宿主返回了无法识别的结果。',
  noProviders: '宿主还没有下发可用的服务商。',
  accountTabHint: '登录后会按当前服务商自动创建或复用一把 Key，并写入凭证缝。',
  apiKeyTabHint: 'Key 只写进宿主凭证缝，界面不会回显或保存明文。',
}

/** 英文文案。 */
export const authEn: Record<AuthLocaleKey, string> = {
  dialogTitle: 'Connect a service',
  dialogSubtitle: 'Sign in to have an API key provisioned automatically, or paste an existing key.',
  tabAccount: 'Sign in',
  tabApiKey: 'API key',
  close: 'Close',
  loadingState: 'Reading connection status…',
  hostUnavailable: 'The host channel is unavailable, so the connection status cannot be read.',
  signedOut: 'Not signed in',
  signedInLabel: 'Signed in',
  balanceLabel: 'Balance',
  keyLabel: 'API key',
  keyConfigured: 'Configured (ends in {last4})',
  keyMissing: 'Not configured',
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  passwordLabel: 'Password',
  passwordPlaceholder: '••••••••',
  enterCredentials: 'Enter your email and password first.',
  signIn: 'Sign in',
  signingIn: 'Signing in…',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  loginSuccess: 'Signed in — the API key was stored in the credential seam.',
  logoutSuccess: 'Signed out.',
  providerLabel: 'Provider',
  apiKeyLabel: 'API key',
  apiKeyPlaceholder: 'Paste your API key',
  enterApiKey: 'Enter an API key first.',
  saveKey: 'Save key',
  savingKey: 'Saving…',
  keySaved: 'API key saved.',
  testConnection: 'Test connection',
  testingConnection: 'Testing…',
  testSuccess: 'Connection OK — the key works.',
  testFailed: 'Connection failed: {reason}',
  testUnsupported: 'Connectivity testing is not available for this provider.',
  requestFailed: 'The request failed.',
  invalidResponse: 'The host returned an unexpected result.',
  noProviders: 'The host has not announced any usable provider yet.',
  accountTabHint: 'After sign-in the host creates or reuses a key for the current provider and stores it in the credential seam.',
  apiKeyTabHint: 'The key is written into the host credential seam only; the UI never echoes or keeps the plaintext.',
}

// 把本命名空间并进 locale 的类型表：入口可 `ctx.locale.register(AUTH_NS, { zh: authZh, en: authEn })`，
// 并 `ctx.locale.bind(AUTH_NS)` 得到带类型（TranslateNS<'image-video-auth'>）的 t。
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 连接弹层文案。 */
    'image-video-auth': AuthLocaleKey
  }
}
