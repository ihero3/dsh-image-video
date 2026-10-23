#!/usr/bin/env node
/**
 * 体积门禁 CLI（`T7-1`，CI 里由 `pnpm run check:bundle` 调用）。
 *
 * 两个口径都守（A-6 修订版：自包含 + 包内惰性 chunk）：
 * 1. 入口 `lib/client/plugin.js` —— 打开工作台前就要下载的体积；
 * 2. 总产物 `lib/client/*.js`（入口 + 全部 chunk）—— 首次打开工作台的完整代价。
 *
 * 用法：`node scripts/check-bundle-size.mjs [entryPath]`
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import {
  BUNDLE_BASELINE, BUNDLE_BUDGET, BUNDLE_TOTAL_BASELINE, BUNDLE_TOTAL_BUDGET, evaluateBundleSize,
} from './bundle-budget.mjs'

const entry = process.argv[2] ?? 'lib/client/plugin.js'
const clientDir = join(entry, '..')
const sizes = (buffer) => ({ raw: buffer.byteLength, gzip: gzipSync(buffer).byteLength })

const entrySizes = sizes(readFileSync(entry))
const chunkFiles = readdirSync(clientDir).filter(name => /^client\..*\.js$/.test(name)).sort()
const chunkSizes = chunkFiles.map(name => ({ name, ...sizes(readFileSync(join(clientDir, name))) }))
const totalSizes = chunkSizes.reduce(
  (sum, chunk) => ({ raw: sum.raw + chunk.raw, gzip: sum.gzip + chunk.gzip }),
  { raw: entrySizes.raw, gzip: entrySizes.gzip },
)

const entryVerdict = evaluateBundleSize(entrySizes, BUNDLE_BUDGET)
const totalVerdict = evaluateBundleSize(totalSizes, BUNDLE_TOTAL_BUDGET)

console.log(`入口：${entry}`)
console.log(`  基线 : raw ${BUNDLE_BASELINE.raw} B · gzip ${BUNDLE_BASELINE.gzip} B`)
console.log(`  预算 : raw ${BUNDLE_BUDGET.raw} B · gzip ${BUNDLE_BUDGET.gzip} B`)
console.log(`  实测 : raw ${entrySizes.raw} B（占预算 ${entryVerdict.usedPercent.raw}%）· gzip ${entrySizes.gzip} B（占预算 ${entryVerdict.usedPercent.gzip}%）`)

console.log('\n包内 chunk（首次打开工作台才下载）：')
for (const chunk of chunkSizes) {
  console.log(`  ${chunk.name}: raw ${chunk.raw} B · gzip ${chunk.gzip} B`)
}

console.log('\n总产物（入口 + chunk）：')
console.log(`  基线 : raw ${BUNDLE_TOTAL_BASELINE.raw} B · gzip ${BUNDLE_TOTAL_BASELINE.gzip} B`)
console.log(`  预算 : raw ${BUNDLE_TOTAL_BUDGET.raw} B · gzip ${BUNDLE_TOTAL_BUDGET.gzip} B`)
console.log(`  实测 : raw ${totalSizes.raw} B（占预算 ${totalVerdict.usedPercent.raw}%）· gzip ${totalSizes.gzip} B（占预算 ${totalVerdict.usedPercent.gzip}%）`)

const problems = [
  ...entryVerdict.over.map(line => `入口 ${line}`),
  ...totalVerdict.over.map(line => `总产物 ${line}`),
]
if (problems.length > 0) {
  console.error(`\n体积超预算：\n  - ${problems.join('\n  - ')}`)
  console.error('处理方式：先看能否瘦身；确实必要就在 CHANGELOG 里写明原因并同步抬高对应基线。')
  process.exit(1)
}
console.log('\n体积门禁通过。')
