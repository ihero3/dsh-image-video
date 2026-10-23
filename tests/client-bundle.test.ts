// @vitest-environment jsdom
/**
 * Client-bundle 契约：自包含的「入口 + 包内惰性 chunk」。
 *
 * 三条不可退让的性质（A-6 修订版）：
 * 1. **入口包很小**（~45 KB）：只做注册，界面（含 React Flow + d3 闭包）不在里面；
 * 2. **界面按需加载**：入口里是 `require.async("./client.Workbench.js")`，不是内联也不是
 *    指向宿主平台词——所以任何 DSH 装了这个插件就有画布，不需要宿主管 `@xyflow/react`；
 * 3. **chunk 只用宿主基线词**（react / react-dom / jsx-runtime）：不许偷偷要求新平台词。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as reactDomClient from 'react-dom/client'
import * as jsxRuntime from 'react/jsx-runtime'
import { describe, expect, it } from 'vitest'
import { inject, WORKBENCH_TAB_ID, WORKBENCH_TAB_KIND } from '../src/client/plugin.ts'

/** 入口产物（注册壳）。 */
const ENTRY_PATH = resolve(process.cwd(), 'lib/client/plugin.js')
/** 界面 chunk（含 React Flow）。 */
const CHUNK_NAME = 'client.Workbench.js'
const CHUNK_PATH = resolve(process.cwd(), 'lib/client', CHUNK_NAME)

/** 宿主模块表的**基线词**：任何 DSH 宿主都有，插件不许要求更多。 */
const HOST_MODULES: Record<string, unknown> = {
  react: React,
  'react/jsx-runtime': jsxRuntime,
  'react-dom': ReactDOM,
  'react-dom/client': reactDomClient,
}

/** One captured module-loader registration. */
interface Registration {
  id: string
  chunk?: string
  factory: (require: RequireLike) => Record<string, unknown>
}

/** 工厂收到的 require：同步查表 + 异步取包内 chunk。 */
interface RequireLike {
  (request: string): unknown
  async: (request: string) => Promise<unknown>
}

function evaluateBundle(path: string): Registration {
  if (!existsSync(path)) {
    throw new Error(`客户端产物缺失：${path}（先跑 \`pnpm run build\`；lib/ 是入库产物）`)
  }
  const source = readFileSync(path, 'utf8')
  let registration: Registration | undefined
  const loader = { load: (candidate: Registration) => { registration = candidate } }
  // 以 `window` 为参数求值：bundle 只用它取 __ModuleLoader__，不需要真的宿主环境。
  const run = new Function('window', source) as (window: unknown) => void
  run({ __ModuleLoader__: loader })
  if (registration === undefined) throw new Error(`${path} 没有调用 window.__ModuleLoader__.load`)
  return registration
}

/** 只应答基线词；越界就抛（等于宿主的 `require(...) missed the module table`）。 */
function baselineRequire(requested: string[]): RequireLike {
  const require = ((request: string) => {
    requested.push(request)
    if (request in HOST_MODULES) return HOST_MODULES[request]
    throw new Error(`模块表没有应答 require(${request})`)
  }) as RequireLike
  require.async = async (request: string) => {
    requested.push(`async:${request}`)
    throw new Error(`测试未实现 chunk 取回：${request}`)
  }
  return require
}

describe('client entry bundle (注册壳)', () => {
  it('registers one factory under the package name and needs no chunk at materialization', () => {
    const registration = evaluateBundle(ENTRY_PATH)
    expect(registration.id).toBe('dsh-image-video')
    expect(registration.chunk).toBeUndefined()
    const requested: string[] = []
    const exports = registration.factory(baselineRequire(requested))
    expect(typeof exports.apply).toBe('function')
    // 与源码对账，而不是写死清单：加/删服务时这里不会悄悄漂掉
    expect(exports.inject).toEqual(inject)
    expect(exports.WORKBENCH_TAB_ID).toBe(WORKBENCH_TAB_ID)
    expect(exports.WORKBENCH_TAB_KIND).toBe(WORKBENCH_TAB_KIND)
    // 入口只允许请求基线词：出现别的就是"偷偷要宿主平台词"
    expect(requested.every(request => request in HOST_MODULES)).toBe(true)
    expect(requested).not.toContain('@xyflow/react')
  })

  it('loads the UI through require.async (self-contained, no host platform word)', () => {
    const source = readFileSync(ENTRY_PATH, 'utf8')
    expect(source).toContain(`require.async("./${CHUNK_NAME}")`)
    // 入口里不得内联 React Flow（类名），也不得向宿主**索要**它（注释里提到没关系）
    expect(source).not.toContain('react-flow__')
    expect(source).not.toContain('require("@xyflow/react")')
    expect(source).not.toContain("require('@xyflow/react')")
    // 入口体积：~45 KB。留 120 KB 的天花板防回退
    expect(Buffer.byteLength(source)).toBeLessThan(120_000)
  })

  it('declares no dsh.client.external (nothing beyond the baseline table)', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      dsh?: { client?: { external?: string[] } }
    }
    expect(manifest.dsh?.client?.external ?? []).toEqual([])
  })
})

describe('UI chunk (client.Workbench.js)', () => {
  it('registers itself as <package>/<bare file name>', () => {
    const registration = evaluateBundle(CHUNK_PATH)
    expect(registration.id).toBe('dsh-image-video')
    expect(registration.chunk).toBe(CHUNK_NAME)
  })

  it('materializes with the baseline table only, and exports the workbench component', () => {
    const registration = evaluateBundle(CHUNK_PATH)
    const requested: string[] = []
    const exports = registration.factory(baselineRequire(requested))
    expect(typeof exports.Workbench).toBe('function')
    // chunk 也必须只用基线词——它自带 React Flow，不再向宿主伸手
    expect(requested.every(request => request in HOST_MODULES)).toBe(true)
  })

  it('carries React Flow inside the plugin (installs work on any DSH host)', () => {
    const source = readFileSync(CHUNK_PATH, 'utf8')
    expect(source).toContain('react-flow__')
    // 838 KB 总量里的主体；只守"确实在这里"，不锁死字节数
    expect(Buffer.byteLength(source)).toBeGreaterThan(500_000)
  })
})
