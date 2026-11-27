#!/usr/bin/env node
/**
 * 「当前生效参数」条排版预览（开发辅助）。
 *
 * 把真实的 workbench-style / modern-theme 样式表套到同构 DOM 上，输出静态 HTML，
 * 用无头浏览器截图核对：标题是否与参数区分、图像/视频/文本是否分组、
 * 来源徽章是否可分、窄档是否整组换行。
 *
 * 用法：
 *   MODE=before node scripts/defaults-strip-preview.mjs   # 改动前（平铺）
 *   MODE=after  node scripts/defaults-strip-preview.mjs   # 改动后（分组）
 *   FRAME=900 MODE=after node scripts/defaults-strip-preview.mjs
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

const icon = (d, size = 12) => `<svg class="iv-ico" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const sliders = icon('<path d="M2 4h12M2 8h12M2 12h12"/><circle cx="6" cy="4" r="1.6" fill="currentColor"/><circle cx="10" cy="8" r="1.6" fill="currentColor"/><circle cx="5" cy="12" r="1.6" fill="currentColor"/>')

const PARAMS = [
  { key: '图片服务商', value: 'threevideo', src: '内置默认', kind: 'none' },
  { key: '图片尺寸', value: '1:1', src: '来自设置', kind: 'settings' },
  { key: '图片风格', value: '摄影', src: '内置默认', kind: 'none' },
  { key: '视频服务商', value: 'threevideo', src: '内置默认', kind: 'none' },
  { key: '视频比例', value: '9:16', src: '内置默认', kind: 'none' },
  { key: '视频时长', value: '5', src: '来自设置', kind: 'settings' },
]

const def = p => `<span class="iv-def" data-default-source="${p.kind}"><i>${p.key}</i><b>${p.value}</b><em class="iv-def-src" data-default-source-label="${p.kind}">${p.src}</em></span>`
const textModel = `<span class="iv-def iv-def--select" data-default-source="none"><i>文本模型</i><select class="iv-select iv-select--sm"><option>默认规则</option></select></span>`
const edit = `<button type="button" class="iv-btn iv-btn--ghost iv-btn--sm">${sliders}编辑</button>`
const details = `<button type="button" class="iv-btn iv-btn--ghost iv-btn--sm" style="margin-left:auto">${sliders}模型详情 <span aria-hidden="true" style="font-size:10px">▾</span></button>`

const before = `
<div class="iv-defaults" data-workbench-defaults="true">
  <span class="iv-micro">当前生效参数</span>
  ${PARAMS.map(def).join('\n  ')}
  ${textModel}
  ${edit}
  ${details}
</div>`

const after = `
<div class="iv-defaults" data-workbench-defaults="true">
  <div class="iv-defaults-head">
    ${sliders}
    <span class="iv-defaults-title">当前生效参数</span>
    <span class="iv-defaults-hint">生成时自动套用</span>
  </div>
  <div class="iv-defaults-body">
    <div class="iv-def-group" data-defaults-group="image">
      <span class="iv-def-group-label">图像</span>
      <div class="iv-def-group-items">${PARAMS.slice(0, 3).map(def).join('')}</div>
    </div>
    <div class="iv-def-group" data-defaults-group="video">
      <span class="iv-def-group-label">视频</span>
      <div class="iv-def-group-items">${PARAMS.slice(3).map(def).join('')}</div>
    </div>
    <div class="iv-def-group" data-defaults-group="text">
      <span class="iv-def-group-label">文本</span>
      <div class="iv-def-group-items">${textModel}</div>
    </div>
  </div>
  <div class="iv-defaults-actions">
    ${edit}
    ${details}
  </div>
</div>`

// 改动前的 CSS 还原（覆盖新版规则），让 before 真正是旧排版，而不是旧 DOM 套新样式
const beforeCss = `
.iv-defaults-head,.iv-defaults-body,.iv-defaults-actions,.iv-def-group{display:contents}
.iv-defaults{padding:5px 10px;gap:var(--iv-sp-2) var(--iv-sp-5)}
.iv-def-src{border:1px solid var(--iv-line-2);background:transparent;color:var(--iv-tx3)}
.iv-def+.iv-def::before{height:9px;margin-right:10px}
`

const mode = process.env.MODE === 'before' ? 'before' : 'after'
const frame = process.env.FRAME ? `${process.env.FRAME}px` : '100%'
const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>defaults strip preview</title>
<style>
${base}
${modern}
${mode === 'before' ? beforeCss : ''}
html,body{margin:0;background:#eef0f3;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
#frame{width:${frame};margin:0 auto;background:var(--iv-panel,#fff)}
.iv{height:auto!important;overflow:visible!important}
.note{padding:8px 10px;font:12px/1.5 system-ui;color:#5a6069;background:#fff}
</style></head>
<body><div id="frame"><div class="iv"><div class="note">${mode === 'before' ? 'BEFORE · 改动前：标题 + 六个参数 + 两个入口平铺' : 'AFTER · 改动后：标题独立 / 三组参数 / 入口靠右'}</div>
${mode === 'before' ? before : after}
</div></div></body></html>`

mkdirSync(resolve(root, '.screenshots/.tmp'), { recursive: true })
const out = resolve(root, `.screenshots/.tmp/defaults-strip-${mode}.html`)
writeFileSync(out, html, 'utf8')
console.log(out)
