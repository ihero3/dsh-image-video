// @vitest-environment jsdom
/**
 * Client-bundle smoke: the emitted `lib/client/plugin.js` must be a valid
 * module-loader artifact — one `window.__ModuleLoader__.load({ id, factory })`
 * registration whose factory materializes with the host's module table and
 * exports the plugin's `apply` / `inject`.
 *
 * This is the check that catches a broken banner/footer, a changed package name,
 * or a module the loader cannot answer (which is a runtime throw, not a
 * degradation) — without needing the desktop app.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WORKBENCH_TAB_ID, WORKBENCH_TAB_KIND } from '../src/client/plugin.ts'

/** The committed artifact under test (vitest runs with the package root as cwd). */
const BUNDLE_PATH = resolve(process.cwd(), 'lib/client/plugin.js')

/** One captured module-loader registration. */
interface Registration {
  id: string
  factory: (require: (request: string) => unknown) => Record<string, unknown>
}

/** The host modules the bundle is allowed to request, as minimal stubs. */
const HOST_MODULES: Record<string, unknown> = {
  react: { useState: () => [undefined, () => {}], createElement: () => null },
  'react/jsx-runtime': { jsx: () => null, jsxs: () => null, Fragment: Symbol('fragment') },
  'react-dom': {},
  'react-dom/client': {},
}

function loadBundle(): Registration {
  if (!existsSync(BUNDLE_PATH)) {
    throw new Error(`客户端产物缺失：${BUNDLE_PATH}（先跑 \`pnpm run build\`；lib/ 是入库产物）`)
  }
  const source = readFileSync(BUNDLE_PATH, 'utf8')
  let registration: Registration | undefined
  const loader = { load: (candidate: Registration) => { registration = candidate } }
  // 以 `window` 为参数求值：bundle 只用它取 __ModuleLoader__，不需要真的宿主环境。
  const run = new Function('window', source) as (window: unknown) => void
  run({ __ModuleLoader__: loader })
  if (registration === undefined) throw new Error('bundle 没有调用 window.__ModuleLoader__.load')
  return registration
}

describe('client bundle (module-loader contract)', () => {
  it('registers one factory under the package name', () => {
    const registration = loadBundle()
    expect(registration.id).toBe('dsh-image-video')
    expect(typeof registration.factory).toBe('function')
  })

  it('materializes with the host module table and exports apply / inject', () => {
    const registration = loadBundle()
    const requested: string[] = []
    const exports = registration.factory((request: string) => {
      requested.push(request)
      if (request in HOST_MODULES) return HOST_MODULES[request]
      throw new Error(`模块表没有应答 require(${request})`)
    })
    expect(typeof exports.apply).toBe('function')
    expect(exports.inject).toEqual(['slots', 'locale', 'sidebarRightTabs'])
    expect(exports.WORKBENCH_TAB_ID).toBe(WORKBENCH_TAB_ID)
    expect(exports.WORKBENCH_TAB_KIND).toBe(WORKBENCH_TAB_KIND)
    // 只允许请求宿主模块表里的东西；出现别的请求就是外置清单漏项
    expect(requested.every(request => request in HOST_MODULES)).toBe(true)
  })
})
