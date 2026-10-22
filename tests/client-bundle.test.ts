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
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as reactDomClient from 'react-dom/client'
import * as jsxRuntime from 'react/jsx-runtime'
import * as Xyflow from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { inject, WORKBENCH_TAB_ID, WORKBENCH_TAB_KIND } from '../src/client/plugin.ts'

/** The committed artifact under test (vitest runs with the package root as cwd). */
const BUNDLE_PATH = resolve(process.cwd(), 'lib/client/plugin.js')

/** One captured module-loader registration. */
interface Registration {
  id: string
  factory: (require: (request: string) => unknown) => Record<string, unknown>
}

/**
 * The host modules the bundle is allowed to request.
 *
 * react / react-dom / `@xyflow/react` are the real packages: the canvas draws on
 * React Flow, and that library calls React APIs at module scope (createContext …),
 * so hand-written stubs would only test the stub. `@xyflow/react` reached this
 * table by the A-6 externalisation (host `PLATFORM_MODULES`), which is exactly what
 * makes it reachable without being inlined — a stub here would hide a broken
 * `dsh.client.external` declaration. The DSH *service* modules stay stubs because
 * their contract is "the loader provides them", not their behaviour.
 */
const HOST_MODULES: Record<string, unknown> = {
  react: React,
  'react/jsx-runtime': jsxRuntime,
  'react-dom': ReactDOM,
  'react-dom/client': reactDomClient,
  '@xyflow/react': Xyflow,
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
    // 与源码对账，而不是写死清单：加/删服务时这里不会悄悄漂掉
    expect(exports.inject).toEqual(inject)
    expect(exports.WORKBENCH_TAB_ID).toBe(WORKBENCH_TAB_ID)
    expect(exports.WORKBENCH_TAB_KIND).toBe(WORKBENCH_TAB_KIND)
    // 只允许请求宿主模块表里的东西；出现别的请求就是外置清单漏项
    expect(requested.every(request => request in HOST_MODULES)).toBe(true)
    // A-6：画布依赖必须走模块表（`require("@xyflow/react")`），不能又被内联回去。
    // 这条守住体积门禁的根因，而不是只守数字。
    expect(requested).toContain('@xyflow/react')
  })

  it('keeps React Flow out of the artifact (A-6 externalisation)', () => {
    const source = readFileSync(BUNDLE_PATH, 'utf8')
    expect(source).toContain('require("@xyflow/react")')
    // React Flow 的运行时类名只允许出现在画布自己的字符串里，不允许整库内联
    expect(source).not.toContain('@xyflow/system')
    // 外置后实测 427,503 B；硬天花板留 500 KB——把 React Flow 内联回来（+约 400 KB）立刻红。
    // 绝对值这道比"占预算百分比"更抗口径变化（见 docs/A6-BUNDLE-EXTERNALIZE.md）
    expect(Buffer.byteLength(source)).toBeLessThan(500_000)
  })
})
