/**
 * RPC 契约漂移检查（Track A / A71）。
 *
 * `docs/API-SURFACE.md` 是 Track B（同事）对接的唯一依据：新增端点却忘了写进文档，
 * 等于这个能力对同事不存在。这条测试把「rpc.ts 的 case 分支」和「文档」钉在一起。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RPC_SOURCE = join(import.meta.dirname, '..', 'src', 'host', 'rpc.ts')
const API_DOC = join(import.meta.dirname, '..', 'docs', 'API-SURFACE.md')

describe('rpc endpoints are documented (A71)', () => {
  it('every endpoint implemented in rpc.ts appears in API-SURFACE.md', async () => {
    const source = await readFile(RPC_SOURCE, 'utf8')
    const doc = await readFile(API_DOC, 'utf8')
    // 只取"端点 case"（4 空格缩进 + xx/yy 形式），排除内部 switch
    const endpoints = [...new Set(
      [...source.matchAll(/^ {4}case '([a-z][a-z-]*\/[a-z-]+)':/gm)].map(match => match[1]!),
    )]
    expect(endpoints.length).toBeGreaterThan(20) // 兜底：正则本身别失效
    const missing = endpoints.filter(endpoint => !doc.includes(endpoint))
    expect(missing, `以下端点没写进 docs/API-SURFACE.md：${missing.join('、')}`).toEqual([])
  })
})
