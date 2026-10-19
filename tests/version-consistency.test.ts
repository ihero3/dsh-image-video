/**
 * 版本一致性漂移检查（Track A / A73）。
 *
 * 发版时版本号散落在四处：package.json / src/version.ts / CHANGELOG 最新条目 / git tag。
 * 任何一处漏改都会造成"发出去的版本自相矛盾"（界面显示 0.3.25、CHANGELOG 停在 0.3.24…）。
 */
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLUGIN_VERSION } from '../src/version.ts'

const ROOT = join(import.meta.dirname, '..')

describe('version consistency (A73)', () => {
  it('package.json, src/version.ts and the newest CHANGELOG entry agree', async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { version: string }
    const changelog = await readFile(join(ROOT, 'CHANGELOG.md'), 'utf8')
    const newest = /^## \[(\d+\.\d+\.\d+)-workbench-(\d+)\]/m.exec(changelog)

    expect(newest, 'CHANGELOG 里找不到形如 ## [x.y.z-workbench-n] 的条目').not.toBeNull()
    expect(pkg.version).toBe(PLUGIN_VERSION)
    expect(newest![1]).toBe(PLUGIN_VERSION)
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

  it('the newest git tag matches the version and the changelog number', async () => {
    const changelog = await readFile(join(ROOT, 'CHANGELOG.md'), 'utf8')
    const newest = /^## \[(\d+\.\d+\.\d+)-workbench-(\d+)\]/m.exec(changelog)!
    let tag: string
    try {
      tag = execFileSync('git', ['describe', '--tags', '--abbrev=0'], { cwd: ROOT, encoding: 'utf8' }).trim()
    } catch {
      return // 没有 git 环境（如源码打包）时跳过这条
    }
    expect(tag).toBe(`v${PLUGIN_VERSION}-workbench-${newest[2]}`)
  })
})
