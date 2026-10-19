/**
 * 版本一致性漂移检查（Track A / A73 + A75）。
 *
 * 发版时版本号散落在四处：package.json / src/version.ts / CHANGELOG 最新条目 / git tag，
 * 历史上前三处一致但 **tag 里的构建产物**是旧版本（真 bug #18）——这里全部钉住。
 */
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLUGIN_VERSION } from '../src/version.ts'

const ROOT = join(import.meta.dirname, '..')

function git(args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
  } catch {
    return undefined
  }
}

describe('version consistency (A73/A75)', () => {
  it('package.json, src/version.ts and the newest CHANGELOG entry agree', async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { version: string }
    const changelog = await readFile(join(ROOT, 'CHANGELOG.md'), 'utf8')
    const newest = /^## \[(\d+\.\d+\.\d+)-workbench-(\d+)\]/m.exec(changelog)

    expect(newest, 'CHANGELOG 里找不到形如 ## [x.y.z-workbench-n] 的条目').not.toBeNull()
    expect(pkg.version).toBe(PLUGIN_VERSION)
    expect(newest![1]).toBe(PLUGIN_VERSION)
  })

  it('each recent tag carries the matching version in BOTH src and built lib', async () => {
    // 钉住真 bug #18：tag 名写 0.3.26，但 tag 里 lib/index.js 是 0.3.25（构建发生在提交之后）
    const listed = git(['tag', '--sort=-creatordate'])
    if (listed === undefined) return // 没有 git 环境（源码打包）时跳过
    const tags = listed.trim().split('\n').filter(Boolean).slice(0, 5)
    expect(tags.length).toBeGreaterThan(0)
    for (const tag of tags) {
      const named = /^v(\d+\.\d+\.\d+)-workbench-\d+$/.exec(tag)
      if (named === null) continue
      const source = git(['show', `${tag}:src/version.ts`]) ?? ''
      const built = git(['show', `${tag}:lib/index.js`]) ?? ''
      expect(/PLUGIN_VERSION = '([^']+)'/.exec(source)?.[1], `${tag} 的 src/version.ts`).toBe(named[1])
      expect(/const PLUGIN_VERSION = "([^"]+)"/.exec(built)?.[1], `${tag} 的 lib/index.js`).toBe(named[1])
    }
  })

  it('changelog entries are contiguous (no missing releases)', async () => {
    const changelog = await readFile(join(ROOT, 'CHANGELOG.md'), 'utf8')
    const patches = [...changelog.matchAll(/^## \[\d+\.\d\.(\d+)-workbench-(\d+)\]/gm)].map(match => Number(match[1]))
    expect(patches.length).toBeGreaterThan(10)
    const sorted = [...patches].sort((left, right) => left - right)
    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index]! - sorted[index - 1]!, `缺了 0.3.${sorted[index - 1]! + 1}`).toBe(1)
    }
  })
})
