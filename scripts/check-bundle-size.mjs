#!/usr/bin/env node
/**
 * 体积门禁 CLI（`T7-1`，CI 里由 `pnpm run check:bundle` 调用）。
 * 用法：`node scripts/check-bundle-size.mjs [bundlePath]`
 */
import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { BUNDLE_BASELINE, BUNDLE_BUDGET, evaluateBundleSize } from './bundle-budget.mjs'

const target = process.argv[2] ?? 'lib/client/plugin.js'
const raw = readFileSync(target)
const sizes = { raw: raw.byteLength, gzip: gzipSync(raw).byteLength }
const verdict = evaluateBundleSize(sizes)

console.log(`产物: ${target}`)
console.log(`  基线（首次可发布）: raw ${BUNDLE_BASELINE.raw} B · gzip ${BUNDLE_BASELINE.gzip} B`)
console.log(`  预算（+20%）      : raw ${BUNDLE_BUDGET.raw} B · gzip ${BUNDLE_BUDGET.gzip} B`)
console.log(`  实测              : raw ${sizes.raw} B（占预算 ${verdict.usedPercent.raw}%）· gzip ${sizes.gzip} B（占预算 ${verdict.usedPercent.gzip}%）`)

if (!verdict.ok) {
  console.error(`\n体积超预算：\n  - ${verdict.over.join('\n  - ')}`)
  console.error('处理方式：先看能否瘦身；确实必要就在 CHANGELOG 里写明原因并同步抬高 BUNDLE_BASELINE。')
  process.exit(1)
}
console.log('\n体积门禁通过。')
