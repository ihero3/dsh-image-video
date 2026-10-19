#!/usr/bin/env node
/**
 * B11 视觉回归基线采集脚本（Playwright）。
 *
 * 用法：
 *   DSH_WEB_URL=http://localhost:5173 node scripts/capture-ui-baseline.mjs
 *
 * 前置：
 *   - harness 前端 dev server 已在 DSH_WEB_URL 运行（默认 http://localhost:5173）
 *   - 已安装 playwright + chromium：`npm i -D playwright && npx playwright install chromium`
 *
 * 产物：把各模式/场景截图写入 plugins/dsh-image-video/docs/ui-baseline/*.png
 *
 * 注意：本脚本必须在**带显示**的环境（真实屏幕或 xvfb）运行；无显示 headless
 * 无法对依赖宿主注入的 React 工作台做可靠像素截图。
 */

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../docs/ui-baseline')
const BASE_URL = process.env.DSH_WEB_URL || 'http://localhost:5173'

// 场景定义：name -> 操作函数（在已加载页面上执行）
const SCENES = [
  { file: 'mode-quick.png', label: '快速模式', act: async (page) => {
    await clickMode(page, 'quick')
    await page.waitForTimeout(400)
  }},
  { file: 'mode-advanced.png', label: '高级模式', act: async (page) => {
    await clickMode(page, 'advanced')
    await page.waitForTimeout(600)
  }},
  { file: 'mode-expert.png', label: '专家模式', act: async (page) => {
    const ok = await clickMode(page, 'expert')
    if (!ok) { console.log('  · 无 expert 模式，跳过') ; return false }
    await page.waitForTimeout(600)
    return true
  }},
  { file: 'export-panel.png', label: '导出面板', act: async (page) => {
    await clickMode(page, 'advanced')
    // 选中一条视频片段以展开导出工具条（data-timeline-* 选择器的父级出现）
    const clip = page.locator('[data-timeline-clip]').first()
    if (await clip.count()) { await clip.click(); await page.waitForTimeout(300) }
    const exportToolbar = page.locator('[data-timeline-export-resolution]')
    if (!(await exportToolbar.count())) { console.log('  · 未找到导出面板（需先有视频片段），跳过') ; return false }
    return true
  }},
  { file: 'responsive-narrow.png', label: '窄窗响应式', act: async (page) => {
    await page.setViewportSize({ width: 420, height: 820 })
    await clickMode(page, 'quick')
    await page.waitForTimeout(400)
    return true
  }},
  { file: 'theme-dark.png', label: '暗色主题', act: async (page) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await setTheme(page, 'dark')
    await page.waitForTimeout(300)
    return true
  }},
  { file: 'theme-light.png', label: '明色主题', act: async (page) => {
    await setTheme(page, 'light')
    await page.waitForTimeout(300)
    return true
  }},
]

async function clickMode(page, mode) {
  // 模式切换按钮带 aria-pressed（B8）；优先按 data-mode，其次按文本
  const byData = page.locator(`[data-mode="${mode}"]`)
  if (await byData.count()) { await byData.first().click(); return true }
  const byText = page.getByRole('button', { name: new RegExp(mode, 'i') }).first()
  if (await byText.count()) { await byText.click(); return true }
  return false
}

async function setTheme(page, theme) {
  const sw = page.locator(`[data-theme-switch="${theme}"]`)
  if (await sw.count()) { await sw.first().click(); return }
  // 兜底：直接给根节点加 class（宿主变量在 B7 里读取 --dsw-alias-*）
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t)
  }, theme)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [page error]', m.text()) })

  console.log(`导航到 ${BASE_URL} …`)
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  // 等工作台挂载：右栏/工具条任一出现即可
  await page.waitForSelector('[data-workbench], [data-iv], .iv', { timeout: 20000 })
    .catch(() => console.log('  · 未检测到工作台根节点，可能 dev server 未就绪'))

  for (const scene of SCENES) {
    try {
      const proceed = await scene.act(page)
      if (proceed === false) continue
      const out = resolve(OUT_DIR, scene.file)
      await page.screenshot({ path: out, fullPage: false })
      const { size } = statSync(out)
      console.log(`  ✓ ${scene.label.padEnd(10)} -> ${scene.file} (${size} B)`)
    } catch (e) {
      console.log(`  ✗ ${scene.label} 失败：${e.message}`)
    }
  }

  // TODO(可选): 接入 pixelmatch 做新旧基线 diff，超过阈值时非零退出，便于 CI 卡质量闸门。
  await browser.close()
  console.log(`\n基线已写入 ${OUT_DIR}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
