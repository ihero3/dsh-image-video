#!/usr/bin/env node
/**
 * 视觉基线像素对比（R6-4）。
 *
 * 用 `sharp`（项目已有运行时依赖，**不新增包**）做逐像素比较，替代原先 TODO 里的
 * pixelmatch —— 我们只需要「差异像素占比 + 一张标红图」，不需要它的抗锯齿启发式。
 *
 * 目录约定（避免一采集就把基线覆盖掉）：
 *   docs/ui-baseline/*.png          基线（入库）
 *   docs/ui-baseline/current/*.png  新采集（不入库，由采集脚本 DSH_BASELINE_OUT 指定）
 *
 * 用法：
 *   # 1) 首次采集基线（入库）
 *   DSH_BASELINE_OUT=docs/ui-baseline node scripts/capture-ui-baseline.mjs
 *   # 2) 改完样式后采到 current，再比对
 *   DSH_BASELINE_OUT=docs/ui-baseline/current node scripts/capture-ui-baseline.mjs
 *   node scripts/diff-ui-baseline.mjs
 *   # 3) 看标红图（只输出超阈值的那些）
 *   node scripts/diff-ui-baseline.mjs --write-diff
 *
 * 判定：
 *   - 单通道绝对差 > `--pixel-tolerance`（默认 20）算「这个像素变了」——低于它的属于
 *     字体 hinting / 抗锯齿噪声；
 *   - 差异像素占比 > `--threshold`（默认 0.1%）判为不一致。
 *   这两个值都可以按需传参，但**不要为了让 CI 变绿而调高**：那等于取消门禁。
 *
 * 限制（如实说明）：跨机器/跨 OS 的字体渲染差异会让几乎每张图都超阈，所以
 * **只在同一环境内比**。换机器后要重新采基线，并把"为什么重采"写进 PR 描述。
 */

import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

/** 解析命令行参数。 */
function parseArgs(argv) {
  const options = {
    baseline: resolve(ROOT, 'docs/ui-baseline'),
    current: resolve(ROOT, 'docs/ui-baseline/current'),
    diffDir: resolve(ROOT, 'docs/ui-baseline/diff'),
    threshold: 0.001,
    pixelTolerance: 20,
    writeDiff: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    const value = argv[i + 1]
    if (key === '--baseline') { options.baseline = resolve(process.cwd(), value); i += 1 }
    else if (key === '--current') { options.current = resolve(process.cwd(), value); i += 1 }
    else if (key === '--threshold') { options.threshold = Number(value); i += 1 }
    else if (key === '--pixel-tolerance') { options.pixelTolerance = Number(value); i += 1 }
    else if (key === '--write-diff') { options.writeDiff = true }
    else if (key === '--help' || key === '-h') {
      console.log('用法: node scripts/diff-ui-baseline.mjs [--baseline 目录] [--current 目录] [--threshold 0.001] [--pixel-tolerance 20] [--write-diff]')
      process.exit(0)
    }
  }
  return options
}

/** 列出目录下的一级 PNG（不含子目录）。 */
function listPng(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(name => extname(name).toLowerCase() === '.png')
    .map(name => join(dir, name))
    .filter(path => statSync(path).isFile())
}

/**
 * 比较两张同尺寸 PNG。
 * @returns {{ ratio: number, total: number, changed: number, diffBuffer: Buffer|null }}
 */
async function compare(sharp, leftPath, rightPath, pixelTolerance, wantDiff) {
  const left = await sharp(leftPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const right = await sharp(rightPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = left.info
  if (right.info.width !== width || right.info.height !== height) {
    return { ratio: 1, total: width * height, changed: width * height, diffBuffer: null, sizeMismatch: true }
  }

  const total = width * height
  const diff = wantDiff ? Buffer.alloc(total * 4) : null
  let changed = 0

  for (let i = 0; i < total; i += 1) {
    const offset = i * 4
    const dr = Math.abs(left.data[offset] - right.data[offset])
    const dg = Math.abs(left.data[offset + 1] - right.data[offset + 1])
    const db = Math.abs(left.data[offset + 2] - right.data[offset + 2])
    const isChanged = dr > pixelTolerance || dg > pixelTolerance || db > pixelTolerance
    if (isChanged) changed += 1
    if (diff) {
      // 变了的像素标红，没变的压暗成浅灰，便于一眼看出位置
      const red = isChanged
      diff[offset] = red ? 255 : 200
      diff[offset + 1] = red ? 40 : 200
      diff[offset + 2] = red ? 40 : 200
      diff[offset + 3] = red ? 255 : 90
    }
  }

  return { ratio: total === 0 ? 0 : changed / total, total, changed, diffBuffer: diff }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    console.error('缺少 sharp。它是本包运行时依赖，先 `pnpm install`。')
    process.exit(2)
  }

  const baselines = listPng(options.baseline)
  if (baselines.length === 0) {
    console.error(`基线目录没有 PNG：${options.baseline}\n先采集基线：DSH_BASELINE_OUT=docs/ui-baseline node scripts/capture-ui-baseline.mjs`)
    process.exit(2)
  }

  const currents = listPng(options.current)
  if (currents.length === 0) {
    console.error(`新图目录没有 PNG：${options.current}\n先采集新图：DSH_BASELINE_OUT=docs/ui-baseline/current node scripts/capture-ui-baseline.mjs`)
    process.exit(2)
  }

  if (options.writeDiff) mkdirSync(options.diffDir, { recursive: true })

  const rows = []
  for (const baselinePath of baselines) {
    const name = basename(baselinePath)
    const currentPath = join(options.current, name)
    if (!existsSync(currentPath)) {
      rows.push({ name, status: 'missing', ratio: 1, changed: 0, total: 0 })
      console.log(`  ✗ ${name.padEnd(24)} 新图缺失`)
      continue
    }

    const wantDiff = options.writeDiff
    const result = await compare(sharp, baselinePath, currentPath, options.pixelTolerance, wantDiff)
    const ok = result.ratio <= options.threshold
    rows.push({ name, status: result.sizeMismatch ? 'size-mismatch' : ok ? 'ok' : 'changed', ratio: result.ratio, changed: result.changed, total: result.total })

    const percent = (result.ratio * 100).toFixed(3)
    const mark = result.sizeMismatch ? '✗' : ok ? '✓' : '✗'
    console.log(`  ${mark} ${name.padEnd(24)} 差异 ${percent}%  (${result.changed}/${result.total} 像素)`)

    if (result.diffBuffer && (!ok || result.sizeMismatch)) {
      const out = join(options.diffDir, name.replace(/\.png$/i, '.diff.png'))
      writeFileSync(out, await sharp(result.diffBuffer, {
        raw: { width: (await sharp(baselinePath).metadata()).width, height: (await sharp(baselinePath).metadata()).height, channels: 4 },
      }).png().toBuffer())
      console.log(`      标红图 -> ${out}`)
    }
  }

  const bad = rows.filter(row => row.status !== 'ok')
  console.log(`\n比对 ${rows.length} 张：一致 ${rows.length - bad.length}，超阈/缺失 ${bad.length}（阈值 ${(options.threshold * 100).toFixed(3)}%）`)

  if (bad.length > 0) {
    console.log('处理方式：① 确认差异是预期的（读 diff 图）→ 重采基线并在 PR 里写明为什么可以变；② 非预期 → 回退样式。')
    process.exit(1)
  }
}

main().catch((error) => { console.error(error); process.exit(1) })
