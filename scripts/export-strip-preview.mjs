#!/usr/bin/env node
/**
 * 时间轴导出条排版预览（开发辅助，`B2`）。
 *
 * 把真实的 workbench-style / modern-theme 样式表套到同构 DOM 上，输出静态 HTML，
 * 用无头浏览器截图核对：新增的规格标签（`[data-timeline-export-spec]`）是否与
 * 三个下拉、两个开关、主按钮同排不打架，窄档是否整行换行而非被裁。
 *
 * 用法：
 *   node scripts/export-strip-preview.mjs
 *   FRAME=900 node scripts/export-strip-preview.mjs
 *   SPEC="480×854" FPS=24 node scripts/export-strip-preview.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

function extractCss(file, name) {
  const source = readFileSync(resolve(root, file), 'utf8')
  const match = source.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\``))
  if (!match) throw new Error(`cannot extract ${name}`)
  return match[1]
}

const base = extractCss('src/client/workbench-style.ts', 'WORKBENCH_STYLE')
const modern = extractCss('src/client/modern-theme.ts', 'MODERN_THEME_STYLE')

const frame = process.env.FRAME ? `${process.env.FRAME}px` : '100%'
const spec = process.env.SPEC ?? '1440×2560'
const fps = process.env.FPS ?? '60'

const field = (label, options, selected) => `
  <label class="iv-field">
    <span class="iv-field-label">${label}</span>
    <select class="iv-select iv-select--sm">${options.map(name => `<option${name === selected ? ' selected' : ''}>${name}</option>`).join('')}</select>
  </label>`

const bar = `
<div class="iv-toolbar iv-toolbar--export iv-tl-export" data-timeline-export-busy="false">
  <div class="iv-tl-params">
    ${field('分辨率', ['模型默认', '480P', '768P', '2K'], '2K')}
    ${field('帧率', ['24', '25', '30', '60'], fps)}
    ${field('画幅', ['16:9', '9:16', '1:1', '3:4'], '9:16')}
    <label class="iv-check"><input type="checkbox" checked>烧录字幕</label>
    <label class="iv-check"><input type="checkbox">响度归一</label>
  </div>
  <span class="iv-tl-spec" data-timeline-export-spec="true"><b>${spec}</b><i>${fps}fps</i></span>
  <button type="button" class="iv-btn iv-btn--acc iv-btn--lg">导出成片</button>
  <button type="button" class="iv-btn iv-btn--sm">取消导出</button>
</div>`

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>export strip preview</title>
<style>
${base}
${modern}
html,body{margin:0;background:#eef0f3;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
#frame{width:${frame};margin:0 auto;background:var(--iv-bg);padding:14px 16px 20px}
.iv{height:auto!important;overflow:visible!important}
</style></head>
<body><div id="frame"><div class="iv">${bar}</div></div></body></html>`

mkdirSync(resolve(root, '.screenshots/.tmp'), { recursive: true })
const out = resolve(root, '.screenshots/.tmp/export-strip.html')
writeFileSync(out, html, 'utf8')
console.log(out)
