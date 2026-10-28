#!/usr/bin/env node
/**
 * 对比度检查（R6-4）：把「这些字读不读得清」从肉眼判断变成可复跑的清单。
 *
 * 为什么需要它：工作台里 9px / 10.5px 的小字大量配 `--iv-tx3`（52% 透明混合）与
 * `--iv-warn` / `--iv-danger` 这类语义色，纯看截图很难判断某一行是不是刚好踩线。
 * 而 WCAG 的判定只跟「前景色、底色、字号、字重」有关，完全可以用浏览器算出来。
 *
 * 用法：
 *   DSH_WEB_URL=http://localhost:5173 node scripts/check-contrast.mjs
 *   DSH_WEB_URL=http://localhost:5173 node scripts/check-contrast.mjs --theme dark
 *   DSH_WEB_URL=http://localhost:5173 node scripts/check-contrast.mjs --json .tmp/contrast.json
 *
 * 前置：playwright + chromium（与 capture-ui-baseline.mjs 共用，按需安装）：
 *   npm i -D playwright && npx playwright install chromium
 *
 * 判定口径（WCAG 2.1 AA）：
 *   - 正文（字号 < 24px，且不满足「≥18.66px 且 bold」）：4.5:1
 *   - 大字号（≥ 24px，或 ≥ 18.66px 且字重 ≥ 700）：3:1
 *
 * 已知局限（如实写在输出里，不假装完整）：
 *   1. 只取「第一个不透明祖先背景」；半透明叠层（渐变、图片、canvas 背景）无法准确取值，
 *      这类节点会标 `bg≈` 并单独列出，需要人工确认。
 *   2. 只检查渲染后可见的文本节点；需要交互才出现的浮层请先手动打开再跑（见 --keep-open）。
 *   3. 不检查非文本对比（图标、边框、焦点环），那些走视觉走查。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE_URL = process.env.DSH_WEB_URL || 'http://localhost:5173'

/** 解析命令行参数（不引第三方依赖）。 */
function parseArgs(argv) {
  const options = { theme: 'both', json: '', url: BASE_URL, minRatio: undefined }
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    const value = argv[i + 1]
    if (key === '--theme') { options.theme = value ?? 'both'; i += 1 }
    else if (key === '--json') { options.json = value ?? ''; i += 1 }
    else if (key === '--url') { options.url = value ?? BASE_URL; i += 1 }
    else if (key === '--min-ratio') { options.minRatio = Number(value); i += 1 }
  }
  return options
}

/**
 * 在页面上下文里执行：收集所有可见文本节点的前景/底色与字号。
 * 这个函数会被序列化到浏览器里，**不能引用外部变量**。
 * @returns {Array<object>} 采样结果。
 */
function collectSamplesInPage() {
  const toRgba = (value) => {
    if (!value) return null
    const text = String(value).trim()
    // rgb() / rgba()
    let match = /^rgba?\(([^)]+)\)$/.exec(text)
    if (match) {
      const parts = match[1].split(/[,/\s]+/).filter(Boolean).map(Number)
      const [r, g, b] = parts
      const a = parts.length > 3 ? parts[3] : 1
      return { r, g, b, a: Number.isFinite(a) ? a : 1 }
    }
    // color(srgb r g b / a) —— 现代 Chrome 对 color-mix() 的求值结果
    match = /^color\(srgb\s+([^)]+)\)$/.exec(text)
    if (match) {
      const parts = match[1].split(/[\s/]+/).filter(Boolean).map(Number)
      return { r: parts[0] * 255, g: parts[1] * 255, b: parts[2] * 255, a: parts.length > 3 ? parts[3] : 1 }
    }
    return null
  }

  const selectorOf = (el) => {
    const parts = []
    let node = el
    let depth = 0
    while (node && node.nodeType === 1 && depth < 4) {
      let part = node.tagName.toLowerCase()
      if (node.id) { part += `#${node.id}` }
      else if (node.classList && node.classList.length) { part += `.${[...node.classList].slice(0, 2).join('.')}` }
      parts.unshift(part)
      node = node.parentElement
      depth += 1
    }
    return parts.join('>')
  }

  const isVisible = (el) => {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  const samples = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    if (text.trim().length === 0) continue
    const el = node.parentElement
    if (!el || seen.has(el)) continue
    const tag = el.tagName.toLowerCase()
    if (tag === 'script' || tag === 'style' || tag === 'noscript') continue
    if (!isVisible(el)) continue
    seen.add(el)

    const style = getComputedStyle(el)
    const fg = toRgba(style.color)
    if (!fg) continue

    // 往上找第一个「基本不透明」的背景
    let bg = null
    let bgApprox = false
    let cursor = el
    while (cursor) {
      const bgValue = toRgba(getComputedStyle(cursor).backgroundColor)
      if (bgValue && bgValue.a >= 0.9) { bg = bgValue; break }
      if (bgValue && bgValue.a > 0.05) bgApprox = true
      cursor = cursor.parentElement
    }
    if (!bg) {
      const rootBg = toRgba(getComputedStyle(document.body).backgroundColor)
      bg = rootBg && rootBg.a >= 0.9 ? rootBg : { r: 255, g: 255, b: 255, a: 1 }
      bgApprox = true
    }

    samples.push({
      text: text.trim().slice(0, 40),
      selector: selectorOf(el),
      color: fg,
      background: bg,
      bgApprox,
      fontSize: parseFloat(style.fontSize),
      fontWeight: Number(style.fontWeight) || 400,
      opacity: Number(style.opacity) || 1,
    })
  }
  return samples
}

/** sRGB 相对亮度（WCAG 2.1 定义）。 */
function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const s = value / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** 两个颜色的对比度（1..21）。 */
function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg)
  const b = relativeLuminance(bg)
  const [light, dark] = a > b ? [a, b] : [b, a]
  return (light + 0.05) / (dark + 0.05)
}

/** 该字号/字重下 WCAG AA 要求的阈值。 */
function requiredRatio(fontSize, fontWeight) {
  const large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700)
  return large ? 3 : 4.5
}

/** 把 rgba 合成到不透明底色上（处理文字自身透明度）。 */
function flatten(fg, bg) {
  const a = fg.a
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  }
}

const THEMES = ['light', 'dark']

/** 切换主题：优先宿主开关，兜底给根节点打 data-theme。 */
async function setTheme(page, theme) {
  const sw = page.locator(`[data-theme-switch="${theme}"]`)
  if (await sw.count()) { await sw.first().click(); return }
  await page.evaluate((value) => { document.documentElement.setAttribute('data-theme', value) }, theme)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  let chromium
  try {
    ({ chromium } = await import('playwright'))
  } catch {
    console.error('缺少 playwright。先安装：\n  npm i -D playwright && npx playwright install chromium')
    process.exit(2)
  }

  const themes = options.theme === 'both' ? THEMES : [options.theme]
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [page error]', m.text()) })

  console.log(`导航到 ${options.url} …`)
  await page.goto(options.url, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-workbench], [data-iv], .iv', { timeout: 20_000 })
    .catch(() => console.log('  · 未检测到工作台根节点，可能 dev server 未就绪'))

  const report = { url: options.url, generatedAt: new Date().toISOString(), results: [] }
  let failures = 0

  for (const theme of themes) {
    await setTheme(page, theme)
    await page.waitForTimeout(400)

    const samples = await page.evaluate(collectSamplesInPage)
    const rows = samples.map((sample) => {
      const fg = flatten(sample.color, sample.background)
      const ratio = contrastRatio(fg, sample.background)
      const need = options.minRatio ?? requiredRatio(sample.fontSize, sample.fontWeight)
      return { ...sample, ratio: Number(ratio.toFixed(2)), need, pass: ratio >= need }
    }).sort((a, b) => a.ratio - b.ratio)

    const bad = rows.filter(row => !row.pass)
    const approx = rows.filter(row => row.bgApprox)
    failures += bad.length

    console.log(`\n=== ${theme} === 采样 ${rows.length} 个文本节点，不达标 ${bad.length} 个`)
    if (bad.length > 0) {
      console.log('  最低的 15 个：')
      for (const row of bad.slice(0, 15)) {
        console.log(`  ✗ ${String(row.ratio).padStart(5)} < ${row.need}  ${String(row.fontSize).padStart(5)}px/${row.fontWeight}  "${row.text}"`)
        console.log(`      ${row.selector}${row.bgApprox ? '  (底色为近似值)' : ''}`)
      }
    }
    if (approx.length > 0) {
      console.log(`  · ${approx.length} 个节点的底色是近似值（半透明叠层），需要人工确认`)
    }

    report.results.push({ theme, total: rows.length, failed: bad.length, rows })
  }

  await browser.close()

  if (options.json) {
    const out = resolve(process.cwd(), options.json)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`\n明细已写入 ${out}`)
  }

  if (failures > 0) {
    console.log(`\n共 ${failures} 处不达标。修法优先级：① 提高语义色对比（实色 token）② 字号上调一档 ③ 该字本就不该用 tx3`)
    process.exit(1)
  }
  console.log('\n全部达标。')
}

main().catch((error) => { console.error(error); process.exit(1) })
