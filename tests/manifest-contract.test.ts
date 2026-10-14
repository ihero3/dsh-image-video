/**
 * Manifest ⟷ code contract.
 *
 * The client loader reads `package.json` (`dsh.client`, `exports["./client"]`,
 * `files`) while the code declares its own service list — nothing in TypeScript
 * ties the two together, and every mismatch fails *silently at runtime* rather
 * than at build time. This file is that tie; the classes it covers are the ones
 * this project actually stumbled on (a client export that was declared but not
 * shipped, and a runtime dependency that had drifted into devDependencies).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { inject } from '../src/client/plugin.ts'

interface Manifest {
  exports: Record<string, Record<string, string>>
  files: string[]
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
  peerDependenciesMeta: Record<string, { optional?: boolean }>
  dsh: { bundle: { patch: string }; client: { platform: string; inject: string[] } }
}

const ROOT = process.cwd()
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as Manifest
const clientPackages = manifest.dsh.client.inject

/**
 * Which client package provides each service the browser half injects.
 *
 * A new service must be added here *and* to `dsh.client.inject`: the mapping is
 * deliberately explicit so that forgetting the manifest half fails this test
 * instead of failing in the running app.
 */
const SERVICE_PACKAGES: Record<string, string> = {
  slots: '@deepseek-ai/dsh-client-ui-slots',
  locale: '@deepseek-ai/dsh-client-locale',
  sidebarRightTabs: '@deepseek-ai/dsh-client-ui-sidebar-right',
  connection: '@deepseek-ai/dsh-client-connection',
}

describe('package.json contract', () => {
  it('declares the browser half for the web platform', () => {
    expect(manifest.dsh.client.platform).toBe('web')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.exports['./client']).toEqual({
      types: './lib/types/client/plugin.d.ts',
      default: './lib/client/plugin.js',
    })
    expect(manifest.exports['.']).toEqual({ types: './lib/index.d.ts', default: './lib/index.js' })
  })

  it('lists a client package for every service the browser half injects', () => {
    for (const service of inject as readonly string[]) {
      const provider = SERVICE_PACKAGES[service]
      expect(provider, `service ${service} 没有登记到提供它的客户端包（新增服务时请同时更新本表与 dsh.client.inject）`).toBeDefined()
      expect(clientPackages, `${provider} 未列在 dsh.client.inject 中`).toContain(provider)
    }
  })

  it('declares every injected client package as an optional peer', () => {
    for (const name of clientPackages) {
      expect(manifest.peerDependencies[name], `${name} 缺少 peerDependencies 声明`).toBeDefined()
      expect(manifest.peerDependenciesMeta[name]?.optional, `${name} 的 peer 应为 optional`).toBe(true)
    }
  })

  it('ships both built artifact kinds declared in exports', () => {
    expect(manifest.files).toContain('lib/client/**')
    expect(manifest.files).toContain('lib/types/client/**')
    // 入库产物必须真的存在（缺失时先 `pnpm run build`）
    expect(existsSync(resolve(ROOT, 'lib/client/plugin.js')), 'lib/client/plugin.js 缺失：先跑 pnpm run build').toBe(true)
    expect(existsSync(resolve(ROOT, 'lib/types/client/plugin.d.ts')), 'lib/types/client/plugin.d.ts 缺失：先跑 pnpm run build').toBe(true)
    expect(existsSync(resolve(ROOT, 'lib/index.js'))).toBe(true)
  })

  it('keeps runtime dependencies in dependencies, not devDependencies', () => {
    // 打包/运行时直接 import 的两个包：曾因 pnpm add 误移导致运行时解析失败
    expect(manifest.dependencies['@deepseek-ai/schemastery']).toBeDefined()
    expect(manifest.dependencies.sharp).toBeDefined()
  })
})
