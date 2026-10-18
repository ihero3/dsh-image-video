#!/usr/bin/env node
/**
 * 轨道越界自检（`A11`）：确认本次改动只落在自己那条轨道的文件范围内。
 *
 * 用法：
 *   node scripts/check-scope.mjs --track=a [--base=origin/main]
 *   node scripts/check-scope.mjs --track=b [--base=origin/main]
 *
 * 退出码：0 = 没越界；1 = 越界（会列出具体文件）；2 = 用法错误。
 */
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const get = name => {
  const hit = args.find(argument => argument.startsWith(`--${name}=`))
  return hit === undefined ? undefined : hit.slice(name.length + 3)
}
const track = get('track')
const base = get('base') ?? 'origin/main'
if (track !== 'a' && track !== 'b') {
  console.error('用法: node scripts/check-scope.mjs --track=a|b [--base=origin/main]')
  process.exit(2)
}

// 文件所有权矩阵（与 docs/COLLABORATION.md 保持一致）
const scopes = {
  // Track A 拥有 src 下除 client 之外的一切（host/workbench/media/tools/入口与配置）
  a: [/^src\/(?!client\/)/,
    /^lib\//, /^scripts\//, /^vitest\.config\.ts$/, /^\.gitignore$/, /^package\.json$/, /^pnpm-lock\.yaml$/, /^docs\/TASKS-TRACK-A\.md$/, /^docs\/PERF\.md$/,
    /^docs\/API-SURFACE\.md$/, /^docs\/COLLABORATION\.md$/, /^docs\/REQUIREMENTS\.md$/, /^docs\/EXECUTION\.md$/,
    /^docs\/RELEASE\.md$/, /^CHANGELOG\.md$/, /^tests\/(?!.*client)/],
  b: [/^src\/client\//, /^tests\/.*client.*\.(test|spec)\.(ts|tsx)$/, /^docs\/TASKS-TRACK-B\.md$/, /^docs\/UI-/, /^docs\/ui-baseline\//],
}
const shared = [/^FORK-FEATURES\.md$/, /^docs\/GATE-/, /^docs\/TASKS\.md$/, /^docs\/DESIGN-AUDIT\.md$/, /^docs\/IMPLEMENTATION-PLAN\.md$/]

let changed = []
try {
  changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' })
    .split('\n').map(line => line.trim()).filter(Boolean)
} catch (error) {
  console.error(`读取改动失败（base=${base}）：${error.message}`)
  process.exit(2)
}

const own = scopes[track]
const violations = changed.filter(file =>
  !own.some(pattern => pattern.test(file)) && !shared.some(pattern => pattern.test(file)))

if (violations.length === 0) {
  console.log(`✓ Track ${track.toUpperCase()} 未越界（对比 ${base}，共 ${changed.length} 个改动文件）`)
  process.exit(0)
}
console.error(`✗ Track ${track.toUpperCase()} 越界 ${violations.length} 个文件（对比 ${base}）：`)
for (const file of violations) console.error(`  - ${file}`)
console.error('如果确实需要动，先看 docs/COLLABORATION.md 的契约/协商规则。')
process.exit(1)
