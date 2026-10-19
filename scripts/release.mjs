#!/usr/bin/env node
/**
 * 发版脚本（Track A / A74）。
 *
 * 根因：以前每次发版都用"手工替换 CHANGELOG 里的最新条目"的办法，替换链会把中间版本覆盖掉
 * （实测奇数版本 0.3.13/15/17/19/21/23 的条目全丢了）。这里统一处理三处，避免再手工拼。
 *
 * 用法：
 *   node scripts/release.mjs <version> <workbenchNo> "<changelog 正文>"
 * 例：
 *   node scripts/release.mjs 0.3.26 26 "### 批次二十八\n- ..."
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const [version, workbenchNo, body] = process.argv.slice(2)
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('第 1 个参数必须是 x.y.z 版本号')
if (!/^\d+$/.test(workbenchNo ?? '')) throw new Error('第 2 个参数必须是 workbench 序号（整数）')
if (body === undefined || body.trim() === '') throw new Error('第 3 个参数是 CHANGELOG 正文')

const root = join(import.meta.dirname, '..')
const date = new Date().toISOString().slice(0, 10)

// 1) src/version.ts
const versionFile = join(root, 'src', 'version.ts')
let versionSource = await readFile(versionFile, 'utf8')
versionSource = versionSource.replace(/export const PLUGIN_VERSION = '[^']*'/, `export const PLUGIN_VERSION = '${version}'`)
await writeFile(versionFile, versionSource)

// 2) package.json
const packageFile = join(root, 'package.json')
const pkg = JSON.parse(await readFile(packageFile, 'utf8'))
pkg.version = version
await writeFile(packageFile, `${JSON.stringify(pkg, null, 2)}\n`)

// 3) CHANGELOG：新条目插在 [Unreleased] 块之后（必须保持时间倒序）
const changelogFile = join(root, 'CHANGELOG.md')
const changelog = await readFile(changelogFile, 'utf8')
const heading = `## [${version}-workbench-${workbenchNo}] - ${date}`
if (changelog.includes(heading)) throw new Error(`CHANGELOG 已有 ${heading}`)
const anchor = /## \[Unreleased\][\s\S]*?\n(?=## \[)/.exec(changelog)
if (anchor === null) throw new Error('CHANGELOG 里找不到紧跟 [Unreleased] 的插入点')
const insertion = `${heading}\n\n${body.trim()}\n\n`
const next = changelog.slice(0, anchor.index + anchor[0].length) + insertion + changelog.slice(anchor.index + anchor[0].length)
await writeFile(changelogFile, next)

console.log(`版本已更新到 ${version}（workbench ${workbenchNo}）`)
// 必须**先构建再提交**：lib/ 是入库产物，提交后才构建会把旧版本号的 lib 打进 tag（实测踩过）
console.log(`下一步（顺序很重要）：`)
console.log(`  1. pnpm run build                      # 先把 lib/ 重建好（lib 是入库产物）`)
console.log(`  2. bash scripts/gate.sh                # 五道门全绿才能继续`)
console.log(`  3. git add -A && git commit -m "chore(release): ${version}-workbench-${workbenchNo} 定稿"`)
console.log(`  4. git tag -a v${version}-workbench-${workbenchNo} -m "..."`)
console.log(`  5. git push origin main && git push origin v${version}-workbench-${workbenchNo}`)
