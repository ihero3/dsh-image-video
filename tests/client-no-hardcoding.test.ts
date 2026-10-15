/**
 * Configuration comes from the host, not from the browser bundle.
 *
 * `T2-11`: the client must read the provider/output directory/model choices from
 * the host answer (`/image-video` channel) instead of baking any of them in. A
 * stale absolute path in the shipped bundle is the kind of bug that only shows up
 * on someone else's machine, so it is asserted here.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const BUNDLE = resolve(process.cwd(), 'lib/client/plugin.js')
const source = readFileSync(BUNDLE, 'utf8')

describe('client bundle carries no deployment configuration', () => {
  it('has no absolute filesystem path', () => {
    expect(source).not.toMatch(/\/Users\/|\/home\/[a-z]|\/var\/folders\//)
  })

  it('has no provider or model name baked in', () => {
    for (const needle of ['threerouter', 'wanx', 'minimax', 'seedance', 'qwen-image']) {
      expect(source.toLowerCase()).not.toContain(needle)
    }
  })

  it('reads provider output facts from the host answer instead', () => {
    // 健康检查端点与 provider 字段只能作为"从宿主取"的键出现
    expect(source).toContain('/image-video')
  })
})
