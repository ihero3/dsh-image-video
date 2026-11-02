#!/usr/bin/env node
/**
 * 强调层级检查（R7-6）：把「该大的要大、该明显的要明显」从肉眼判断变成可复跑清单。
 *
 * 为什么需要它：Round 7 的核心命题是"主次"。但"主次"很容易在后续迭代里被悄悄抹平——
 * 有人把主按钮从 `lg` 改回默认、有人把 block 又套回琥珀色、有人给提示词加回 `height`。
 * 这些都是**一个 className 的倒退**，代码评审未必看得出，截图对照也未必复现得了同一状态。
 *
 * 所以这里不去点业务按钮，而是：
 *   1. 在真实页面里插入一组**探针元素**（离屏 + visibility:hidden），量它们的计算样式。
 *      好处：不依赖任何业务状态（有没有项目、有没有素材），结论稳定、可复跑。
 *   2. 再对**真实 DOM** 做少量结构断言（主创提示词实高、面板标题字号）。
 *
 * 用法：
 *   DSH_WEB_URL=http://localhost:5173 node scripts/check-emphasis.mjs
 *   DSH_WEB_URL=http://localhost:5173 node scripts/check-emphasis.mjs --theme dark
 *   DSH_WEB_URL=http://localhost:5173 node scripts/check-emphasis.mjs --json .tmp/emphasis.json
 *
 * 前置：playwright + chromium（与 check-contrast.mjs 共用）：
 *   npm i -D playwright && npx playwright install chromium
 *
 * 判定分层（如实写在输出里）：
 *   - 硬断言（fail）：尺寸阶梯、字号阶梯、busy 不透明度、block 红条、chip 语义色、
 *     提示词实高、面板标题字号。任一不满足 => exit 1。
 *   - 软提示（warn）：每个 pane 的 accent 按钮数 / lg 按钮数。它们是**设计意图**
 *     （计划 §2「每屏 W1 ≤ 1」），但"什么算一屏"需要人来判，脚本只把数字摊开。
 *
 * 已知局限：
 *   1. 探针量的是"类名组合应有的样子"，不能证明业务里那个按钮真用了这个类名。
 *      类名是否正确由 `tests/client-design-system.test.tsx` 的结构契约负责，两者互补。
 *   2. 只量可见 pane 内的按钮；折叠/未激活模式的面板不计入软提示的计数。
 *   3. 动画中间态（busy 旋转角度）不检查，只检查环是否存在与其尺寸。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE_URL = process.env.DSH_WEB_URL || 'http://localhost:5173'

/** 解析命令行参数（不引第三方依赖，与 check-contrast.mjs 保持一致的手感）。 */
function parseArgs(argv) {
  const options = { theme: 'both', json: '', url: BASE_URL }
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    const value = argv[i + 1]
    if (key === '--theme') { options.theme = value ?? 'both'; i += 1 }
    else if (key === '--json') { options.json = value ?? ''; i += 1 }
    else if (key === '--url') { options.url = value ?? BASE_URL; i += 1 }
  }
  return options
}

/**
 * 在页面上下文里执行全部检查。**不能引用外部变量**（会被序列化进浏览器）。
 * @returns {{ hard: Array<object>, soft: Array<object> }}
 */
function runEmphasisChecks() {
  const hard = []
  const soft = []
  const add = (id, group, title, expected, actual, pass, hint) => {
    hard.push({ id, group, title, expected, actual, pass: Boolean(pass), hint: hint ?? '' })
  }
  const warn = (id, group, title, actual, hint) => {
    soft.push({ id, group, title, actual, hint: hint ?? '' })
  }

  const root = document.querySelector('.iv') || document.body

  // 探针容器：离屏且不可见，但不影响计算样式；结束时会移除
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:360px;visibility:hidden;pointer-events:none'
  root.appendChild(probe)

  const make = (tag, className, text) => {
    const el = document.createElement(tag)
    if (className) el.className = className
    if (text != null) el.textContent = text
    probe.appendChild(el)
    return el
  }
  const styleOf = (el, pseudo) => getComputedStyle(el, pseudo || null)
  const num = (el, prop, pseudo) => parseFloat(styleOf(el, pseudo)[prop]) || 0
  const tokenOf = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0

  // ---------- A. 按钮尺寸阶梯 ----------
  const lg = make('button', 'iv-btn iv-btn--acc iv-btn--lg', '生成图片')
  const md = make('button', 'iv-btn iv-btn--acc', '生成视频')
  const sm = make('button', 'iv-btn iv-btn--sm', '取消')
  const hLg = num(lg, 'height')
  const hMd = num(md, 'height')
  const hSm = num(sm, 'height')

  add(
    'scale-btn', '尺寸阶梯', '按钮三档必须真的分得开（lg > 默认 > sm）',
    'lg ≥ 28px 且 lg > 默认 > sm',
    `lg ${hLg}px / 默认 ${hMd}px / sm ${hSm}px`,
    hLg >= 28 && hLg > hMd && hMd > hSm,
    'R7-3：旧版把主按钮压在 sm（20px），比默认还小——这正是"主次不分"的根源',
  )

  add(
    'cta-shadow', '尺寸阶梯', 'lg 主按钮带投影（不只是变大）',
    'box-shadow 不是 none',
    styleOf(lg).boxShadow === 'none' ? 'none' : '有投影',
    styleOf(lg).boxShadow !== 'none',
    'R7-3：尺寸之外再给一层强调，窄栏下也压得住',
  )

  // ---------- B. 字号阶梯 ----------
  const fsLead = tokenOf('--iv-fs-lead')
  const fsTitle = tokenOf('--iv-fs-title')
  const fsStrong = tokenOf('--iv-fs-strong')
  const fsBody = tokenOf('--iv-fs-body')

  add(
    'scale-font', '字号阶梯', '字号档位无断档且逐级递减',
    'lead > title > strong > body，且 lead ≥ 14',
    `lead ${fsLead} / title ${fsTitle} / strong ${fsStrong} / body ${fsBody}`,
    fsLead >= 14 && fsLead > fsTitle && fsTitle > fsStrong && fsStrong > fsBody,
    'R7-1：原来 13 直接跳到 16，中间缺一档，"引导"级无处安放',
  )

  const paneTitle = document.querySelector('.iv-pane-title')
  const titleSize = paneTitle ? parseFloat(styleOf(paneTitle).fontSize) : 0
  add(
    'pane-title', '字号阶梯', '面板标题必须比正文大一档',
    `≥ ${fsTitle}px 且 > body ${fsBody}px`,
    paneTitle ? `${titleSize}px` : '未找到 .iv-pane-title',
    titleSize > fsBody && titleSize >= fsTitle,
    'R7-1：旧版 pane-title 是 11px/500，与正文 11px/400 同字号，结构骨架看不见',
  )

  const createTitle = document.querySelector('.iv-create-title')
  const createSize = createTitle ? parseFloat(styleOf(createTitle).fontSize) : 0
  add(
    'create-title', '字号阶梯', '主创标题比面板标题再高一档（W1 压住 W2）',
    `≥ ${fsLead}px 且 > pane-title ${titleSize}px`,
    createTitle ? `${createSize}px` : '未找到 .iv-create-title（不在快速模式？）',
    createSize >= fsLead && createSize > titleSize,
    'R7-1：主创是英雄区，标题不能和别的面板标题一样大',
  )

  // ---------- C. busy 态：在跑 ≠ 坏了 ----------
  const busyBtn = make('button', 'iv-btn iv-btn--acc iv-btn--lg iv-btn--busy', '生成中')
  busyBtn.disabled = true
  const busyOpacity = parseFloat(styleOf(busyBtn).opacity)
  const ringWidth = num(busyBtn, 'width', '::before')

  add(
    'busy-opacity', '进行中', 'busy 按钮不被 disabled 的 42% 灰吃掉',
    'opacity ≥ 0.9',
    String(busyOpacity),
    busyOpacity >= 0.9,
    'R7-3 / F8：原来生成中只换文字 + 变灰，看起来像"坏了"而不是"在跑"',
  )
  add(
    'busy-ring', '进行中', 'busy 按钮有旋转环（且尺寸合理）',
    '::before 宽度 10–14px',
    `${ringWidth}px`,
    ringWidth >= 10 && ringWidth <= 14,
    '环太大撑破 20px 的 sm 按钮，太小在 380px 栏里看不见',
  )

  // ---------- D. 告警四级：block 要像"停" ----------
  const blockBar = make('p', 'iv-notice iv-notice--block', '已阻止生成')
  const blockLeft = num(blockBar, 'border-left-width')
  add(
    'block-bar', '告警分级', 'blocking 级有左侧粗红条',
    'border-left-width = 3px',
    `${blockLeft}px`,
    blockLeft === 3,
    'R7-4：形状是最快的语义（比读文字快得多）',
  )

  const warnChip = make('span', 'iv-chip iv-chip--warn', '警告')
  const errChip = make('span', 'iv-chip iv-chip--err', '阻塞')
  const warnColor = styleOf(warnChip).color
  const errColor = styleOf(errChip).color
  add(
    'block-color', '告警分级', '阻塞色与警告色必须不同',
    'warn 与 err 的 color 不相等',
    `${warnColor} vs ${errColor}`,
    warnColor !== errColor,
    'R7-3/F7：内容合规 block 原来走琥珀 warn，和软警告同色——"停"信号不像"停"',
  )

  // ---------- E. 真实 DOM：主创提示词 ----------
  const prompt = document.querySelector('.iv-create textarea')
  if (prompt) {
    const rect = prompt.getBoundingClientRect()
    const minHeight = num(prompt, 'minHeight')
    add(
      'prompt-height', '核心输入', '主创提示词不是单行条',
      '实高 ≥ 80px',
      `${Math.round(rect.height)}px（min-height ${minHeight}px）`,
      rect.height >= 80,
      'R7-2 / F2：原来 .iv-input{height:23px} 会把 rows 盖掉，提示词只剩一条缝',
    )
  } else {
    add(
      'prompt-height', '核心输入', '主创提示词不是单行条',
      '实高 ≥ 80px', '未找到 .iv-create textarea（工作台未渲染 / 不在快速模式）',
      false,
      '先切到快速模式再跑；若仍找不到，说明结构选择器漂了',
    )
  }

  // ---------- F. 软提示：强调配额 ----------
  const panes = [...document.querySelectorAll('[data-workbench-pane]')]
    .filter((pane) => {
      const rect = pane.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && styleOf(pane).display !== 'none'
    })

  for (const pane of panes) {
    const name = pane.getAttribute('data-workbench-pane')
    const accCount = pane.querySelectorAll('.iv-btn--acc').length
    const lgCount = pane.querySelectorAll('.iv-btn--lg').length
    if (lgCount > 1) {
      warn('quota-lg', '强调配额', `${name}：lg 主按钮 ${lgCount} 个`, `${lgCount} 个`,
        '计划 §2「每屏 W1 ≤ 1」；一个 pane 里两个 lg 会互相抵消（若确实分属不同子区块，可忽略）')
    }
    if (accCount > 3) {
      warn('quota-acc', '强调配额', `${name}：accent 按钮 ${accCount} 个`, `${accCount} 个`,
        '蓝色一多就没有重点；考虑把行内动作降为 ghost / 默认按钮')
    }
  }

  probe.remove()
  return { hard, soft }
}

const THEMES = ['light', 'dark']

/** 切换主题：优先宿主开关，兜底给根节点打 data-theme（与 check-contrast.mjs 同口径）。 */
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

  console.log(`导航到 ${options.url} …`)
  await page.goto(options.url, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-workbench-pane], .iv', { timeout: 20_000 })
    .catch(() => console.log('  · 未检测到工作台根节点，可能 dev server 未就绪'))

  const report = { url: options.url, generatedAt: new Date().toISOString(), results: [] }
  let failures = 0

  for (const theme of themes) {
    await setTheme(page, theme)
    await page.waitForTimeout(400)

    const { hard, soft } = await page.evaluate(runEmphasisChecks)
    const bad = hard.filter((row) => !row.pass)
    failures += bad.length

    console.log(`\n=== ${theme} === 硬断言 ${hard.length} 条，不通过 ${bad.length} 条；软提示 ${soft.length} 条`)
    for (const row of hard) {
      const mark = row.pass ? '✓' : '✗'
      console.log(`  ${mark} [${row.group}] ${row.title}`)
      console.log(`      期望 ${row.expected} · 实测 ${row.actual}`)
      if (!row.pass) console.log(`      → ${row.hint}`)
    }
    for (const row of soft) {
      console.log(`  · [${row.group}] ${row.title}（${row.actual}）`)
      console.log(`      → ${row.hint}`)
    }

    report.results.push({ theme, hard, soft, failed: bad.length })
  }

  await browser.close()

  if (options.json) {
    const out = resolve(process.cwd(), options.json)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`\n明细已写入 ${out}`)
  }

  if (failures > 0) {
    console.log(`\n共 ${failures} 条硬断言不通过。优先级：① 主行动尺寸 ② 提示词高度 ③ 告警语义色 ④ busy 态`)
    process.exit(1)
  }
  console.log('\n全部硬断言通过。软提示需要人工判断"是否真的太多"。')
}

main().catch((error) => { console.error(error); process.exit(1) })
