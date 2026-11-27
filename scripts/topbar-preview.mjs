#!/usr/bin/env node
/**
 * 顶栏排版预览（开发辅助）：把真实的 workbench-style / modern-theme 样式表套到手写的
 * 顶栏 DOM 上，输出静态 HTML，便于用无头浏览器截图核对排版。改顶栏 CSS 时用它替代
 * 「改完凭想象」——Playwright 基线脚本需要 dev server，这个不需要。
 *
 * 用法（FRAME 可固定容器宽度，用于验证窄档；无头浏览器视口有 ~504px 下限，必须靠它）：
 *   node scripts/topbar-preview.mjs before|after
 *   FRAME=420 node scripts/topbar-preview.mjs after
 *
 * 截图（Edge 无头）：
 *   "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new \
 *     --screenshot=out.png --window-size=1440,150 file:///<abs>/\.screenshots/.tmp/topbar-after.html
 *
 * 注意：before 变体只换了旧标记，样式表仍是当前的——只能看结构差异；
 * 要对比「改动前」的真实观感，得在改动前采过图。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const variant = process.argv[2] === 'after' ? 'after' : 'before'

function extractCss(file, name) {
  const source = readFileSync(resolve(root, file), 'utf8')
  const match = source.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\``))
  if (!match) throw new Error(`cannot extract ${name}`)
  return match[1]
}

const base = extractCss('src/client/workbench-style.ts', 'WORKBENCH_STYLE')
const modern = extractCss('src/client/modern-theme.ts', 'MODERN_THEME_STYLE')

const icon = (d) => `<svg class="iv-ico" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const I = {
  pencil: icon('<path d="M11 2l3 3-8 8H3v-3z"/>'),
  trash: icon('<path d="M3 4h10M6 4V2h4v2M5 4l1 10h4l1-10"/>'),
  refresh: icon('<path d="M13 8a5 5 0 1 1-2-4"/><path d="M13 2v4h-4"/>'),
  help: icon('<circle cx="8" cy="8" r="6"/><path d="M6 6a2 2 0 1 1 2.6 1.9c-.4.2-.6.6-.6 1.1"/>'),
  layers: icon('<path d="M8 2l6 3-6 3-6-3z"/><path d="M2 8l6 3 6-3"/>'),
  plus: icon('<path d="M8 3v10M3 8h10"/>'),
  bolt: icon('<path d="M9 2L4 9h3l-1 5 5-7H8z"/>'),
  script: icon('<path d="M4 2h6l2 2v10H4z"/><path d="M6 6h4M6 9h4"/>'),
  flow: icon('<rect x="2" y="2" width="5" height="4" rx="1"/><rect x="9" y="10" width="5" height="4" rx="1"/><path d="M4.5 6v4a1 1 0 0 0 1 1h3.5"/>'),
  film: icon('<rect x="2" y="3" width="12" height="10" rx="1"/><path d="M6 3v10M10 3v10"/>'),
  link: icon('<path d="M7 9a3 3 0 0 0 4 0l2-2a3 3 0 0 0-4-4l-1 1"/><path d="M9 7a3 3 0 0 0-4 0L3 9a3 3 0 0 0 4 4l1-1"/>'),
}

const ctx = {
  series: '云南人工智能 + 海关数据合规',
  episode: '第 1 集 · 开篇与背景',
}

const headerBefore = `
<header class="iv-top">
  <div class="iv-brand">
    <span class="iv-brand-mark"></span>
    <span class="iv-brand-text">
      <span class="iv-brand-name">Three Video</span>
      <span class="iv-brand-sub">Media production workbench</span>
    </span>
  </div>
  <span class="iv-top-sep"></span>
  <div class="iv-proj">
    <span class="iv-micro">剧集</span>
    <select class="iv-select" style="max-width:180px"><option>${ctx.series}</option></select>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm">${I.pencil}</button>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm">${I.trash}</button>
    <span class="iv-newform">
      <input class="iv-input" placeholder="剧集名称">
      <button class="iv-btn iv-btn--acc iv-btn--sm">创建</button>
    </span>
  </div>
  <span class="iv-top-sep"></span>
  <div class="iv-episode">
    <span class="iv-micro">集</span>
    <select class="iv-select" style="max-width:150px"><option>${ctx.episode}</option></select>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm">${I.pencil}</button>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm">${I.trash}</button>
    <button class="iv-btn iv-btn--sm">${I.plus}新建集</button>
  </div>
  <span class="iv-top-sep"></span>
  <nav class="iv-modes" aria-label="工作台">
    <button class="iv-modes-btn">${I.bolt}快速创作</button>
    <button class="iv-modes-btn on">${I.script}剧本生成</button>
    <button class="iv-modes-btn">${I.flow}专业工作流</button>
    <button class="iv-modes-btn">${I.film}时间轴精剪</button>
  </nav>
  <div class="iv-top-meta">
    <span class="iv-chip"><i class="iv-dot"></i>已保存</span>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm">${I.refresh}</button>
  </div>
  <div class="iv-top-tools">
    <button class="iv-btn iv-btn--sm iv-btn--ghost">${I.link}<span class="iv-tools-txt">登录三视</span></button>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm">${I.help}</button>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm">${I.layers}</button>
  </div>
</header>`

const headerAfter = `
<header class="iv-top">
  <div class="iv-brand" title="Media production workbench">
    <span class="iv-brand-mark"></span>
    <span class="iv-brand-text">
      <span class="iv-brand-name">Three Video</span>
      <span class="iv-brand-sub">Media production workbench</span>
    </span>
  </div>
  <span class="iv-top-sep"></span>
  <div class="iv-proj">
    <span class="iv-micro">剧集</span>
    <select class="iv-select" style="max-width:180px"><option>${ctx.series}</option></select>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm" title="重命名">${I.pencil}</button>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm" title="删除">${I.trash}</button>
    <span class="iv-newform">
      <input class="iv-input" placeholder="剧集名称">
      <button class="iv-btn iv-btn--sm">创建</button>
    </span>
  </div>
  <span class="iv-top-sep"></span>
  <div class="iv-episode">
    <span class="iv-micro">集</span>
    <select class="iv-select" style="max-width:150px"><option>${ctx.episode}</option></select>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm" title="重命名">${I.pencil}</button>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm" title="删除">${I.trash}</button>
    <button class="iv-btn iv-btn--sm" title="新建集">${I.plus}<span class="iv-btn-txt">新建集</span></button>
  </div>
  <div class="iv-top-end">
  <div class="iv-top-meta">
    <span class="iv-chip iv-chip--ok"><i class="iv-dot"></i>已保存</span>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm" title="刷新">${I.refresh}</button>
  </div>
  <div class="iv-top-tools">
    <button class="iv-btn iv-btn--sm iv-btn--ghost">${I.link}<span class="iv-tools-txt">登录三视</span></button>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm" title="帮助">${I.help}</button>
    <button class="iv-btn iv-btn--icon iv-btn--ghost iv-btn--sm" title="工作台">${I.layers}</button>
  </div>
  </div>
  <span class="iv-top-sep iv-top-sep--stacked"></span>
  <nav class="iv-modes" aria-label="工作台">
    <button class="iv-modes-btn">${I.bolt}<span class="iv-modes-txt">快速创作</span></button>
    <button class="iv-modes-btn on">${I.script}<span class="iv-modes-txt">剧本生成</span></button>
    <button class="iv-modes-btn">${I.flow}<span class="iv-modes-txt">专业工作流</span></button>
    <button class="iv-modes-btn">${I.film}<span class="iv-modes-txt">时间轴精剪</span></button>
  </nav>
</header>`

const body = `
<div class="iv-body">
  <main class="iv-main">
    <div style="padding:18px 20px">
      <p id="probe" style="margin:0 0 10px;font:600 22px/1.4 ui-monospace,monospace;color:#111"></p>
      <div class="iv-pane-head"><b class="iv-pane-title">剧本生成</b><span class="iv-meta">当前集：${ctx.episode}</span></div>
      <p class="iv-meta" style="margin-top:10px">下面的内容只用于示意顶栏在真实页面里的比例关系，不是实际页面。</p>
    </div>
  </main>
  <aside class="iv-dock-col">
    <div style="padding:12px"><span class="iv-micro">素材</span><p class="iv-meta">展示列</p></div>
  </aside>
</div>`

const html = `<!DOCTYPE html>
<html data-theme="${process.env.THEME === 'dark' ? 'dark' : 'light'}">
<head>
<meta charset="utf-8">
<style>
${base}
${modern}
html,body{margin:0;padding:0;background:#ffffff}
body[data-theme="dark"] .iv{color:#e8e8ea}
body{font-family:"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif}
/* 仅示意：品牌方块占位 */
.iv-brand-mark{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#2b2b2b,#6a6a6a);display:inline-block;flex:none}
#stage{width:100%;height:100vh}
</style>
</head>
<body>
<div id="frame" style="width:${process.env.FRAME ? process.env.FRAME + 'px' : '100%'};height:100vh;overflow:hidden">
<div class="iv" style="height:100%">
${variant === 'after' ? headerAfter : headerBefore}
${body}
</div>
</div>
<script>
  const top = document.querySelector('.iv-top')
  document.getElementById('probe').textContent = '顶栏 ' + Math.round(top.getBoundingClientRect().height) + 'px @ ' + innerWidth + 'px'
</script>
</body>
</html>`

// 变更前没有额外样式
writeFileSync(resolve(root, `.screenshots/.tmp/topbar-${variant}.html`), html)
console.log('written', resolve(root, `.screenshots/.tmp/topbar-${variant}.html`))
