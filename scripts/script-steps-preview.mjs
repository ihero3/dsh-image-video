#!/usr/bin/env node
/**
 * 剧本页步进条 / 主按钮权重预览（开发辅助）。
 *
 * 把真实的 workbench-style / modern-theme 样式表套到手写的剧本页 DOM 上，
 * 输出静态 HTML，用无头浏览器截图核对三件事：
 *   1. 步进条三种状态（下一步在 1/2/3、以及全部完成）的视觉区分是否够；
 *   2. 三个动作按钮（写剧本 / 分段 / 分镜）是否**每次只有一个**实心主按钮；
 *   3. 窄档（容器查询）下步进条提示文案是否换行正常。
 *
 * 用法：
 *   node scripts/script-steps-preview.mjs            # 1440 宽
 *   FRAME=820 node scripts/script-steps-preview.mjs  # 指定容器宽度（无头视口有 ~504px 下限，靠它验窄档）
 *
 * 截图：
 *   "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new \
 *     --screenshot=out.png --window-size=1440,1200 \
 *     file:///<abs>/.screenshots/.tmp/script-steps.html
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
const I = {
  sparkles: icon('<path d="M8 2l1.4 3.6L13 7l-3.6 1.4L8 12l-1.4-3.6L3 7l3.6-1.4z"/>'),
  plus: icon('<path d="M8 3v10M3 8h10"/>'),
  image: icon('<rect x="2" y="3" width="12" height="10" rx="1"/><path d="M5 9l2-2 2 2 2-3 2 3"/>'),
  video: icon('<rect x="2" y="4" width="8" height="8" rx="1"/><path d="M10 7l4-2v6l-4-2z"/>'),
  script: icon('<path d="M4 2h6l2 2v10H4z"/><path d="M6 6h4M6 9h4"/>'),
  layers: icon('<path d="M8 2l6 3-6 3-6-3z"/><path d="M2 8l6 3 6-3"/>'),
}

const STEPS = [
  { no: 1, label: '写剧本' },
  { no: 2, label: '分段' },
  { no: 3, label: '生成分镜' },
]
const HINTS = {
  1: '先写好或粘贴全文，再点「生成剧本」。',
  2: '点「开始分段」把剧本拆成段，每段对应一组镜头。',
  3: '逐段点「规划分镜」，再批量生图、生视频。',
  0: '三步都已完成：分镜可同步到工作流，素材可加入时间轴。',
}

const stepper = next => `
<div class="iv-steps" role="group" aria-label="剧本流程">
${STEPS.map((step, index) => {
  const done = next === 0 || step.no < next
  const now = next === step.no
  const state = now ? 'now' : done ? 'done' : 'todo'
  return `  <span class="iv-steps-item">${index === 0 ? '' : '<span class="iv-step-sep" aria-hidden="true">›</span>'}
    <button type="button" class="iv-step iv-step--${state}">
      <span class="iv-step-idx" aria-hidden="true">${done ? '✓' : step.no}</span>
      <span class="iv-step-txt">${step.label}</span>${now ? '<span class="iv-step-tag">下一步</span>' : ''}
    </button>
  </span>`
}).join('\n')}
  <span class="iv-steps-hint">${HINTS[next]}</span>
</div>`

const btn = (text, kind, ic) => `<button type="button" class="iv-btn iv-btn--action iv-btn--action--${kind}">${ic ? I[ic] : ''}${text}</button>`

const pipelineAction = primary => `
  <div class="iv-plan-row">
    ${btn('生成剧本', primary, 'sparkles')}
  </div>`

const segmentActions = (split, plan) => `
  <div class="iv-sb-row iv-sb-selector-row">
    <label class="iv-sb-field"><span class="iv-meta">文本模型</span><select class="iv-select iv-select--sm"><option>默认规则</option></select></label>
    <span class="iv-sb-count iv-sb-selector-actions">
      ${btn('开始分段', split, 'sparkles')}
      <button type="button" class="iv-btn iv-btn--action">${I.plus}新增分段</button>
    </span>
  </div>
  <div class="iv-sb-actions">
    ${btn('规划分镜', plan, 'sparkles')}
    ${btn('生成本段图片', plan === 'primary' ? 'soft' : 'soft', 'image')}
    ${btn('生成本段视频', 'soft', 'video')}
  </div>`

/** 一组：步进条 + 真实区块（用真实类名，但不含交互逻辑）。 */
const block = (title, next, opts = {}) => `
<section class="blk">
  <p class="blk-title">${title}</p>
  ${stepper(next)}
  ${opts.showSections === false ? '' : `
  <div class="iv-card">
    <div class="iv-card-head"><h4 class="iv-card-title">${I.script}剧本</h4></div>
    ${pipelineAction(next === 1 ? 'primary' : 'soft')}
  </div>
  <div class="iv-sc-divider"><span>本集工作区</span></div>
  ${segmentActions(next === 2 ? 'primary' : 'soft', next === 3 ? 'primary' : 'soft')}`}
</section>`

/** 权重矩阵：四种状态下三个按钮各自的实心/柔色，一屏看全。 */
const matrix = `
<section class="blk">
  <p class="blk-title">主按钮权重矩阵（四种状态，每行只有一个实心）</p>
  <table class="matrix">
    <thead><tr><th>当前状态</th><th>生成剧本</th><th>开始分段</th><th>规划分镜</th></tr></thead>
    <tbody>
      ${[[1, '未生成剧本'], [2, '已有剧本'], [3, '已有分段'], [0, '三步完成']].map(([next, label]) => `
      <tr>
        <td>${label}</td>
        <td>${btn('生成剧本', next === 1 ? 'primary' : 'soft', 'sparkles')}</td>
        <td>${btn('开始分段', next === 2 ? 'primary' : 'soft', 'sparkles')}</td>
        <td>${btn('规划分镜', next === 3 ? 'primary' : 'soft', 'sparkles')}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</section>`

const frame = process.env.FRAME ? `${process.env.FRAME}px` : '100%'

/** `MODE=before`：还原改动前「三个同级主按钮、没有步进条」的样子，用来做前后对比。 */
const beforeHtml = `
<section class="blk">
  <p class="blk-title">改动前：三个同级实心主按钮，没有进度指示</p>
  <div class="iv-card">
    <div class="iv-card-head"><h4 class="iv-card-title">剧本</h4></div>
    ${pipelineAction('primary')}
  </div>
  <div class="iv-sc-divider"><span>本集工作区</span></div>
  ${segmentActions('primary', 'primary')}
</section>`

const body = process.env.MODE === 'before'
  ? beforeHtml
  : process.env.MODE === 'after'
    ? `${block('改动后（已有剧本）：步进条指出下一步，「开始分段」是唯一实心主按钮', 2)}`
    : `${block('① 未生成剧本 —— 只有「生成剧本」实心，分段与分镜是柔色', 1)}
${block('② 已有剧本 —— 「开始分段」接棒实心，生成剧本降为柔色', 2)}
${block('③ 已有分段 —— 「规划分镜」接棒实心', 3, { showSections: false })}
${block('④ 三步完成 —— 没有实心主按钮，提示下一步去画布/时间轴', 0, { showSections: false })}
${matrix}`

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>script steps preview</title>
<style>
${base}
${modern}
html,body{margin:0;background:#eef0f3;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
#frame{width:${frame};margin:0 auto;background:#fff}
.iv{height:auto!important;overflow:visible!important}
.pad{padding:18px 20px 26px;display:flex;flex-direction:column;gap:22px}
.blk{display:flex;flex-direction:column;gap:10px}
.blk-title{margin:0;font-size:12px;font-weight:700;color:#5a6069;letter-spacing:.02em}
.matrix{border-collapse:separate;border-spacing:0;font-size:12px}
.matrix th,.matrix td{padding:7px 10px;border-bottom:1px solid #e4e7ec;text-align:left;vertical-align:middle}
.matrix th{font-weight:600;color:#5a6069;background:#f7f8fa}
</style></head>
<body><div id="frame"><div class="iv"><div class="pad">
${body}
</div></div></div></body></html>`

mkdirSync(resolve(root, '.screenshots/.tmp'), { recursive: true })
const suffix = process.env.MODE === 'before' ? 'before' : 'after'
const out = resolve(root, `.screenshots/.tmp/script-steps-${suffix}.html`)
writeFileSync(out, html, 'utf8')
console.log(out)
