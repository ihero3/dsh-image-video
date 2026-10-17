/**
 * 工作台设计系统 v2（`R-NFR-3` 主题与无障碍的落点）。
 *
 * 客户端产物由 `window.__ModuleLoader__` 以 JS 载入，不经过 Harness 的 CSS 打包链，
 * 所以这里把整张样式表内嵌成字符串，由 {@link useWorkbenchStyle} 在挂载时注入一次
 * （与 `canvas-style.ts` 的 xyflow 官方样式同一机制）。
 *
 * 设计口径（v2 专业排版）：
 * - 层次：14px 品牌名 / 12.5px 正文 / 12px 控件 / 11px 元信息 / 10px 眉题，
 *   行高 1.55，数字用 tabular-nums；同类元素同字号，拒绝“到处一样大”。
 * - 降噪：默认值是**参考资料**不是**控件**——收成一条安静的内联摘要，
 *   编辑时才弹层面板（progressive disclosure）；破坏性操作图标化。
 * - 配色：先取 Harness 设计令牌，取不到退到与文字同源的中间色
 *   （`color-mix(in srgb, currentColor …)`），浅色/深色都成立，
 *   且不把任何部署事实（服务商名、绝对路径）烧进产物。
 */

import { useEffect } from 'react'

/** 注入目标 <style> 的 id，保证重复挂载只注入一次。 */
export const WORKBENCH_STYLE_ID = 'dsh-image-video-workbench-style'

/** 整张工作台样式表（类名统一 `iv-` 前缀，作用域根为 `.iv`）。 */
export const WORKBENCH_STYLE = `
.iv{
  --iv-bg:var(--dsw-alias-bg-base,transparent);
  --iv-surface:var(--dsw-alias-bg-l1,color-mix(in srgb,currentColor 4%,transparent));
  --iv-surface-2:var(--dsw-alias-bg-l2,color-mix(in srgb,currentColor 7%,transparent));
  --iv-surface-3:var(--dsw-alias-bg-layer-3,color-mix(in srgb,currentColor 11%,transparent));
  --iv-line:var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 13%,transparent));
  --iv-line-2:var(--dsw-alias-border-l3,color-mix(in srgb,currentColor 22%,transparent));
  --iv-text:var(--dsw-alias-label-primary,currentColor);
  --iv-text-2:var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 76%,transparent));
  --iv-text-3:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 52%,transparent));
  --iv-accent:var(--dsw-alias-brand-primary,#4d6bfe);
  --iv-accent-2:var(--dsw-alias-button-primary-hover,#3f57d6);
  --iv-on-accent:var(--dsw-alias-brand-primary-invert,#ffffff);
  --iv-ok:var(--dsw-alias-state-success-primary,#2ba471);
  --iv-warn:var(--dsw-alias-state-warn-primary,#c07d00);
  --iv-danger:var(--dsw-alias-state-error-primary,#e5534b);
  --iv-hover:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,currentColor 8%,transparent));
  --iv-active:var(--dsw-alias-interactive-bg-active,color-mix(in srgb,currentColor 13%,transparent));
  --iv-accent-soft:color-mix(in srgb,var(--iv-accent) 10%,transparent);
  --iv-ok-soft:color-mix(in srgb,var(--iv-ok) 10%,transparent);
  --iv-warn-soft:color-mix(in srgb,var(--iv-warn) 10%,transparent);
  --iv-danger-soft:color-mix(in srgb,var(--iv-danger) 9%,transparent);
  --iv-r-sm:6px;--iv-r-md:8px;--iv-r-lg:10px;--iv-r-xl:12px;
  --iv-shadow:0 1px 2px color-mix(in srgb,currentColor 6%,transparent);
  --iv-shadow-md:0 1px 3px color-mix(in srgb,currentColor 10%,transparent),0 10px 32px color-mix(in srgb,currentColor 12%,transparent);
  --iv-ring:0 0 0 2px var(--iv-bg,#fff),0 0 0 4px color-mix(in srgb,var(--iv-accent,#4d6bfe) 55%,transparent);
  --iv-font-code:var(--dsh-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);
  display:flex;flex-direction:column;gap:12px;height:100%;box-sizing:border-box;
  padding:14px;overflow:auto;font:inherit;color:var(--iv-text);font-size:12.5px;line-height:1.55;
}
.iv *,.iv *::before,.iv *::after{box-sizing:border-box}
.iv p{margin:0}
.iv h3{margin:0}
.iv ::-webkit-scrollbar{width:8px;height:8px}
.iv ::-webkit-scrollbar-thumb{background:color-mix(in srgb,currentColor 22%,transparent);border-radius:4px;border:2px solid transparent;background-clip:content-box}
.iv ::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,currentColor 34%,transparent);background-clip:content-box}
.iv ::-webkit-scrollbar-track{background:transparent}
.iv ::selection{background:color-mix(in srgb,var(--iv-accent) 30%,transparent)}
.iv :focus-visible{outline:none;box-shadow:var(--iv-ring)}
.iv-ico{flex:none;display:block}
.iv-hidden{display:none}

/* ============ 顶栏 ============ */
.iv-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.iv-brand{display:flex;align-items:center;gap:9px;min-width:0}
.iv-mark{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:var(--iv-on-accent);
  background:linear-gradient(135deg,var(--iv-accent),var(--iv-accent-2));
  box-shadow:0 2px 8px color-mix(in srgb,var(--iv-accent) 38%,transparent),inset 0 1px 0 color-mix(in srgb,#fff 28%,transparent)}
.iv-brand-text{display:flex;flex-direction:column;min-width:0;line-height:1.3}
.iv-brand-name{font-size:14px;font-weight:650;letter-spacing:.01em;white-space:nowrap}
.iv-brand-sub{font-size:10px;font-weight:500;letter-spacing:.1em;color:var(--iv-text-3);white-space:nowrap}
.iv-head-sep{width:1px;align-self:stretch;min-height:24px;background:var(--iv-line)}
.iv-proj{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.iv-proj-label{font-size:10px;font-weight:600;letter-spacing:.09em;color:var(--iv-text-3);white-space:nowrap}
.iv-select--proj{height:28px;font-size:12.5px;font-weight:500;min-width:132px;max-width:200px}
.iv-newform{display:flex;align-items:center;gap:6px}
.iv-newform .iv-input{width:118px}
.iv-head-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-left:auto}
.iv-kind{font-family:var(--iv-font-code);font-size:9.5px;color:var(--iv-text-3);border:1px solid var(--iv-line);
  border-radius:5px;padding:1px 5px;white-space:nowrap;opacity:.8}

/* ============ 按钮 ============ */
.iv-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:26px;padding:0 10px;
  border-radius:7px;border:1px solid var(--iv-line);background:var(--iv-surface);color:var(--iv-text);
  font:inherit;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;
  transition:background .12s ease,border-color .12s ease,color .12s ease,box-shadow .12s ease,opacity .12s ease}
.iv-btn:hover:not(:disabled){background:var(--iv-hover);border-color:var(--iv-line-2)}
.iv-btn:active:not(:disabled){background:var(--iv-active)}
.iv-btn:disabled{cursor:not-allowed}
.iv-btn:disabled:not(.iv-btn--primary){opacity:.45}
.iv-btn--primary{background:var(--iv-accent);border-color:transparent;color:var(--iv-on-accent);
  box-shadow:0 1px 3px color-mix(in srgb,var(--iv-accent) 35%,transparent)}
.iv-btn--primary:hover:not(:disabled){background:var(--iv-accent-2);border-color:transparent}
.iv-btn--primary:disabled{background:color-mix(in srgb,var(--iv-accent) 26%,transparent);color:color-mix(in srgb,var(--iv-on-accent) 72%,transparent);box-shadow:none}
.iv-btn--danger{color:var(--iv-danger);border-color:color-mix(in srgb,var(--iv-danger) 45%,transparent);
  background:var(--iv-danger-soft)}
.iv-btn--danger:hover:not(:disabled){background:color-mix(in srgb,var(--iv-danger) 16%,transparent);border-color:var(--iv-danger)}
.iv-btn--ghost{background:transparent;border-color:transparent;color:var(--iv-text-2)}
.iv-btn--ghost:hover:not(:disabled){background:var(--iv-hover);color:var(--iv-text)}
.iv-btn--icon{width:26px;padding:0}
.iv-btn--sm{height:22px;padding:0 8px;font-size:11.5px;gap:5px}
.iv-btn--sm.iv-btn--icon{width:22px;padding:0}

/* ============ 输入 ============ */
.iv-input,.iv-select{height:26px;min-width:0;border-radius:7px;border:1px solid var(--iv-line);
  background:var(--iv-surface);color:var(--iv-text);font:inherit;font-size:12px;padding:0 8px;
  transition:border-color .12s ease,box-shadow .12s ease}
.iv-input::placeholder{color:var(--iv-text-3)}
.iv-input:hover,.iv-select:hover{border-color:var(--iv-line-2)}
.iv-input:focus,.iv-select:focus{outline:none;border-color:var(--iv-accent);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--iv-accent) 18%,transparent)}
.iv-select{appearance:none;-webkit-appearance:none;padding-right:24px;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238e96a3' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 7px center}
.iv-textarea{min-height:44px;height:auto;padding:5px 8px;line-height:1.45;resize:vertical}
.iv-check{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--iv-text-2);cursor:pointer;user-select:none}
.iv-check input{accent-color:var(--iv-accent);width:13px;height:13px;margin:0}
.iv-range{width:100%;height:16px;appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer}
.iv-range::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--iv-surface-3)}
.iv-range::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;margin-top:-4px;border-radius:50%;
  background:var(--iv-accent);border:2px solid var(--iv-surface);box-shadow:0 1px 4px color-mix(in srgb,currentColor 25%,transparent)}
.iv-color{width:26px;height:22px;padding:0;border:1px solid var(--iv-line);border-radius:6px;background:var(--iv-surface);cursor:pointer}

/* ============ 徽章 / 状态点 ============ */
.iv-chip{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 9px;border-radius:999px;
  border:1px solid var(--iv-line);background:var(--iv-surface-2);font-size:11px;color:var(--iv-text-2);white-space:nowrap}
.iv-dot{width:7px;height:7px;border-radius:50%;background:currentColor;flex:none}
.iv-dot--ok{color:var(--iv-ok)}
.iv-dot--warn{color:var(--iv-warn)}
.iv-dot--err{color:var(--iv-danger)}
.iv-dot--run{color:var(--iv-accent);animation:iv-pulse 1.2s ease-in-out infinite}
.iv-chip--ok{color:var(--iv-ok);border-color:color-mix(in srgb,var(--iv-ok) 35%,transparent);background:var(--iv-ok-soft)}
.iv-chip--warn{color:var(--iv-warn);border-color:color-mix(in srgb,var(--iv-warn) 35%,transparent);background:var(--iv-warn-soft)}
.iv-chip--err{color:var(--iv-danger);border-color:color-mix(in srgb,var(--iv-danger) 35%,transparent);background:var(--iv-danger-soft)}
.iv-chip--run{color:var(--iv-accent);border-color:color-mix(in srgb,var(--iv-accent) 35%,transparent);background:var(--iv-accent-soft)}
.iv-chip--run .iv-dot{animation:iv-pulse 1.2s ease-in-out infinite}
@keyframes iv-pulse{0%,100%{opacity:1}50%{opacity:.3}}
@media (prefers-reduced-motion:reduce){.iv-chip--run .iv-dot,.iv-dot--run{animation:none}.iv-btn,.iv-row,.iv-clip,.iv-pal-item{transition:none}}
.iv-badge{display:inline-flex;align-items:center;gap:4px;padding:0 7px;height:18px;border-radius:999px;
  border:1px solid var(--iv-line);background:var(--iv-surface-2);font-size:10px;color:var(--iv-text-3);white-space:nowrap}
.iv-eyebrow{font-size:10px;font-weight:600;letter-spacing:.09em;color:var(--iv-text-3);white-space:nowrap}
.iv-meta{font-size:11px;color:var(--iv-text-3)}

/* ============ 提示条 ============ */
.iv-notice{display:flex;align-items:flex-start;gap:8px;padding:8px 11px;border-radius:var(--iv-r-md);
  font-size:12px;border:1px solid var(--iv-line);background:var(--iv-surface-2);color:var(--iv-text-2)}
.iv-notice--error{color:var(--iv-danger);background:var(--iv-danger-soft);
  border-color:color-mix(in srgb,var(--iv-danger) 35%,transparent)}
.iv-notice .iv-ico{margin-top:2px}
.iv-banner{display:flex;align-items:flex-start;gap:7px;padding:7px 10px;border-radius:var(--iv-r-md);
  font-size:11px;line-height:1.5;color:var(--iv-warn);background:var(--iv-warn-soft);
  border:1px solid color-mix(in srgb,var(--iv-warn) 32%,transparent)}
.iv-banner .iv-ico{margin-top:1px}

/* ============ 模式切换 ============ */
.iv-modes{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.iv-seg{display:flex;gap:2px;padding:3px;border-radius:10px;background:var(--iv-surface-2);border:1px solid var(--iv-line)}
.iv-mode{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;color:var(--iv-text-2);
  font:inherit;font-size:12px;font-weight:500;padding:6px 13px;border-radius:8px;cursor:pointer;
  transition:background .12s ease,color .12s ease,box-shadow .12s ease}
.iv-mode:hover{color:var(--iv-text)}
.iv-mode[aria-pressed=true]{background:var(--iv-surface);color:var(--iv-text);font-weight:600;
  box-shadow:var(--iv-shadow),inset 0 0 0 1px var(--iv-line)}
.iv-mode[aria-pressed=true] .iv-ico{color:var(--iv-accent)}

/* ============ 默认值摘要条 + 弹层 ============ */
.iv-defaults{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:6px 10px;border-radius:var(--iv-r-md);
  border:1px solid var(--iv-line);background:var(--iv-surface-2);font-size:11px;color:var(--iv-text-2)}
.iv-def{display:inline-flex;align-items:baseline;gap:5px;white-space:nowrap}
.iv-def i{font-style:normal;color:var(--iv-text-3)}
.iv-def b{font-weight:600;color:var(--iv-text);font-variant-numeric:tabular-nums}
.iv-def+.iv-def::before{content:"";width:1px;height:10px;background:var(--iv-line-2);margin-right:10px;align-self:center}
.iv-pop{position:relative;display:inline-flex}
.iv-pop-panel{position:absolute;top:calc(100% + 6px);left:0;z-index:60;min-width:288px;max-width:min(420px,90vw);
  max-height:min(60vh,420px);overflow:auto;padding:12px;border-radius:var(--iv-r-xl);
  border:1px solid var(--iv-line-2);background:var(--iv-surface);box-shadow:var(--iv-shadow-md)}
.iv-pop-panel::before{content:"";position:absolute;top:-5px;left:18px;width:9px;height:9px;transform:rotate(45deg);
  background:var(--iv-surface);border-left:1px solid var(--iv-line-2);border-top:1px solid var(--iv-line-2)}
.iv-pop-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:7px 12px}
.iv-pop-grid label{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--iv-text-2);white-space:nowrap}
.iv-pop-grid label>span{flex:none;width:76px;overflow:hidden;text-overflow:ellipsis}
.iv-pop-grid .iv-select{flex:1;min-width:0}
.iv-pop-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;padding-top:9px;border-top:1px solid var(--iv-line)}
.iv-pop-foot .iv-meta{margin-right:auto}

/* ============ 面板卡片 ============ */
.iv-pane{display:flex;flex-direction:column;gap:9px;min-width:0;border:1px solid var(--iv-line);
  border-radius:var(--iv-r-xl);background:var(--iv-surface);padding:11px 13px;box-shadow:var(--iv-shadow)}
.iv-pane-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.iv-pane-tile{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;flex:none;
  color:var(--iv-accent);background:var(--iv-accent-soft);border:1px solid color-mix(in srgb,var(--iv-accent) 22%,transparent)}
.iv-pane-title{margin:0;display:inline-flex;align-items:center;font-size:12.5px;font-weight:600;letter-spacing:.01em}
.iv-pane-actions{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.iv-pane-body{display:flex;flex-direction:column;gap:9px;min-width:0}
.iv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(252px,1fr));gap:10px;align-items:start}
.iv-mode-pane{display:flex;flex-direction:column;gap:10px;min-width:0}
.iv-pane img,.iv-pane video{width:100%;border-radius:var(--iv-r-md);display:block;background:#0b0c10}

/* ============ 列表行 ============ */
.iv-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px;overflow:auto;min-height:0}
.iv-row{display:flex;align-items:center;gap:8px;padding:4px 7px;border-radius:var(--iv-r-md);
  border:1px solid transparent;font-size:12px;transition:background .1s ease}
.iv-row:hover{background:var(--iv-hover)}
.iv-row[data-active=true]{background:var(--iv-accent-soft);border-color:color-mix(in srgb,var(--iv-accent) 30%,transparent)}
.iv-row-main{flex:1;min-width:0;display:flex;align-items:center;gap:7px}
.iv-row-btn{flex:1;min-width:0;display:flex;align-items:center;gap:7px;border:0;background:transparent;
  color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer;padding:0}
.iv-row-btn:disabled{cursor:default}
.iv-row-actions{display:flex;align-items:center;gap:4px;flex:none}
.iv-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.iv-tile{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;flex:none;
  border:1px solid var(--iv-line);background:var(--iv-surface-2);color:var(--iv-text-2)}
.iv-tile--image{color:var(--iv-accent);border-color:color-mix(in srgb,var(--iv-accent) 30%,transparent);background:var(--iv-accent-soft)}
.iv-tile--video{color:var(--iv-ok);border-color:color-mix(in srgb,var(--iv-ok) 30%,transparent);background:var(--iv-ok-soft)}
.iv-thumb{width:30px;height:30px;border-radius:7px;object-fit:cover;flex:none;background:#0b0c10;
  border:1px solid var(--iv-line)}

/* ============ 空态 ============ */
.iv-empty{display:flex;flex-direction:column;align-items:center;gap:7px;padding:20px 12px;text-align:center;
  color:var(--iv-text-3);font-size:12px}
.iv-empty-tile{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;
  background:var(--iv-surface-2);border:1px solid var(--iv-line);color:var(--iv-text-3)}
.iv-empty strong{color:var(--iv-text-2);font-size:12px;font-weight:600}

/* ============ 快速创作 Hero ============ */
.iv-hero{display:flex;flex-direction:column;gap:13px}
.iv-hero-top{display:flex;align-items:center;gap:12px}
.iv-hero-icon{width:40px;height:40px;border-radius:var(--iv-r-lg);display:grid;place-items:center;flex:none;
  color:var(--iv-accent);background:var(--iv-accent-soft);
  border:1px solid color-mix(in srgb,var(--iv-accent) 26%,transparent)}
.iv-hero-title{font-size:14px;font-weight:650;letter-spacing:.01em}
.iv-hero-text{font-size:12px;color:var(--iv-text-2);max-width:72ch}
.iv-steps{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.iv-step{display:inline-flex;align-items:center;gap:7px;padding:4px 11px 4px 5px;border-radius:999px;
  border:1px solid var(--iv-line);background:var(--iv-surface-2);font-size:11.5px;color:var(--iv-text-2);white-space:nowrap}
.iv-step-num{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;flex:none;
  font-size:10px;font-weight:700;color:var(--iv-on-accent);background:var(--iv-accent)}
.iv-step-arrow{color:var(--iv-text-3);flex:none}
.iv-stats{display:flex;flex-wrap:wrap;gap:7px}
.iv-stat{display:flex;flex-direction:column;gap:0;min-width:82px;padding:7px 12px;border-radius:var(--iv-r-md);
  border:1px solid var(--iv-line);background:var(--iv-surface-2)}
.iv-stat b{font-size:18px;font-weight:650;line-height:1.2;font-variant-numeric:tabular-nums}
.iv-stat span{font-size:10px;font-weight:500;letter-spacing:.07em;color:var(--iv-text-3)}

/* ============ 时间轴 ============ */
.iv-screen{position:relative;min-height:158px;border-radius:var(--iv-r-lg);overflow:hidden;display:grid;place-items:center;
  background:radial-gradient(130% 130% at 50% 0%,#1c1f27 0%,#0b0c10 72%);
  border:1px solid var(--iv-line-2);box-shadow:inset 0 1px 6px color-mix(in srgb,#000 45%,transparent)}
.iv-screen img,.iv-screen video{max-width:100%;max-height:224px;display:block}
.iv-screen-sub{position:absolute;left:0;right:0;padding:0 10px;text-align:center;pointer-events:none;
  text-shadow:0 1px 3px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.6)}
.iv-screen-bar{display:flex;align-items:center;gap:9px;font-size:11px;color:var(--iv-text-3)}
.iv-screen-bar .iv-ico{color:var(--iv-accent)}
.iv-timecode{font-family:var(--iv-font-code);font-size:11px;color:var(--iv-text-2);font-variant-numeric:tabular-nums;white-space:nowrap}
.iv-tracks{display:flex;flex-direction:column;border:1px solid var(--iv-line);border-radius:var(--iv-r-md);overflow:hidden}
.iv-track{display:grid;grid-template-columns:104px minmax(0,1fr);gap:10px;align-items:start;padding:9px 11px;
  background:var(--iv-surface-2)}
.iv-track+.iv-track{border-top:1px solid var(--iv-line)}
.iv-track-label{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;color:var(--iv-text-2);padding-top:3px}
.iv-track-label .iv-ico{color:var(--iv-text-3)}
.iv-track-count{font-size:9.5px;font-weight:500;color:var(--iv-text-3);font-variant-numeric:tabular-nums}
.iv-track-main{display:flex;flex-direction:column;gap:6px;min-width:0}
.iv-clips{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:6px}
.iv-clip{display:flex;flex-direction:column;gap:5px;min-width:0;padding:6px 8px 6px 10px;border-radius:var(--iv-r-md);
  border:1px solid var(--iv-line);background:var(--iv-surface);font-size:11.5px;position:relative;overflow:hidden}
.iv-clip::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px}
.iv-clip--video::before{background:var(--iv-accent)}
.iv-clip--audio::before{background:var(--iv-ok)}
.iv-clip--subtitle::before{background:var(--iv-warn)}
.iv-clip--video{background:linear-gradient(90deg,var(--iv-accent-soft),transparent 42%),var(--iv-surface)}
.iv-clip--audio{background:linear-gradient(90deg,var(--iv-ok-soft),transparent 42%),var(--iv-surface)}
.iv-clip--subtitle{background:linear-gradient(90deg,var(--iv-warn-soft),transparent 42%),var(--iv-surface)}
.iv-clip-top{display:flex;align-items:center;gap:6px;min-width:0}
.iv-clip-top .iv-ico{color:var(--iv-text-3)}
.iv-clip-dur{margin-left:auto;font-size:10px;color:var(--iv-text-3);font-variant-numeric:tabular-nums;white-space:nowrap}
.iv-clip-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.iv-clip .iv-input{height:21px;font-size:11px;width:64px;padding:0 5px}
.iv-clip .iv-select{height:21px;font-size:11px;width:84px;padding:0 20px 0 6px}
.iv-clip .iv-color{width:26px;height:21px}
.iv-clip .iv-btn{height:21px;width:21px;padding:0;border-color:transparent;background:transparent;color:var(--iv-text-3);margin-left:auto}
.iv-clip .iv-btn:hover:not(:disabled){color:var(--iv-danger);background:var(--iv-danger-soft)}
.iv-add-row{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.iv-add-row .iv-select{flex:1;min-width:120px}
.iv-progress{height:4px;border-radius:2px;background:var(--iv-surface-3);overflow:hidden;min-width:80px;flex:1}
.iv-progress>i{display:block;height:100%;border-radius:2px;background:var(--iv-accent);transition:width .3s ease}
.iv-progress--ok>i{background:var(--iv-ok)}
.iv-progress--err>i{background:var(--iv-danger)}

/* ============ 工作流画布 ============ */
.iv-canvas{display:grid;grid-template-columns:152px minmax(0,1fr);gap:11px;align-items:start}
.iv-palette{display:flex;flex-direction:column;gap:2px;max-height:352px;overflow:auto;padding-right:2px}
.iv-pal-title{position:sticky;top:0;z-index:1;background:var(--iv-surface);padding:2px 0 4px}
.iv-pal-sep{margin:5px 0 3px;border-top:1px dashed var(--iv-line-2)}
.iv-pal-item{display:flex;align-items:center;gap:7px;width:100%;padding:5px 8px;border-radius:var(--iv-r-sm);
  border:1px solid transparent;background:transparent;color:var(--iv-text-2);font:inherit;font-size:11.5px;
  text-align:left;cursor:pointer;transition:background .1s ease,color .1s ease}
.iv-pal-item:hover{background:var(--iv-hover);color:var(--iv-text)}
.iv-pal-item .iv-ico{color:var(--iv-accent)}
.iv-pal-item[data-availability=planned]{border-style:dashed;border-color:var(--iv-line);opacity:.72}
.iv-pal-item[data-availability=planned] .iv-ico{color:var(--iv-text-3)}
.iv-canvas-main{display:flex;flex-direction:column;gap:8px;min-width:0}
.iv-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.iv-count{margin-left:auto;font-size:11px;color:var(--iv-text-3);font-variant-numeric:tabular-nums;white-space:nowrap}
.iv-issues{display:grid;gap:3px;font-size:11px;border-radius:var(--iv-r-md);padding:7px 10px;border:1px solid var(--iv-line)}
.iv-issues strong{font-size:11px;font-weight:600;opacity:.85;display:inline-flex;align-items:center;gap:5px}
.iv-issues[data-ok=true]{color:var(--iv-ok);background:var(--iv-ok-soft);border-color:color-mix(in srgb,var(--iv-ok) 28%,transparent)}
.iv-issues[data-ok=false]{color:var(--iv-danger);background:var(--iv-danger-soft);border-color:color-mix(in srgb,var(--iv-danger) 28%,transparent)}
.iv-issues span{display:inline-flex;align-items:center;gap:5px}
.iv-run{display:grid;gap:6px;font-size:11px;border:1px solid var(--iv-line);border-radius:var(--iv-r-md);padding:8px 10px;background:var(--iv-surface-2)}
.iv-run-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.iv-run-head strong{font-size:11.5px;font-weight:600}
.iv-run-history{display:flex;flex-wrap:wrap;gap:4px}
.iv-run-item{border:1px solid var(--iv-line);background:var(--iv-surface);color:var(--iv-text-2);border-radius:999px;
  font:inherit;font-size:10.5px;padding:2px 9px;cursor:pointer;white-space:nowrap}
.iv-run-item:hover{border-color:var(--iv-line-2);color:var(--iv-text)}
.iv-run-item[data-active=true]{border-color:var(--iv-accent);color:var(--iv-text);background:var(--iv-accent-soft)}
.iv-run-nodes{display:grid;gap:3px}
.iv-node-run{display:flex;align-items:center;gap:7px;font-size:10.5px;color:var(--iv-text-2)}
.iv-node-run .iv-dot{width:6px;height:6px}
.iv-node-run[data-status=succeeded] .iv-dot{color:var(--iv-ok)}
.iv-node-run[data-status=failed] .iv-dot{color:var(--iv-danger)}
.iv-node-run[data-status=running] .iv-dot{color:var(--iv-accent);animation:iv-pulse 1.2s ease-in-out infinite}
.iv-node-run[data-status=cancelled] .iv-dot,.iv-node-run[data-status=skipped] .iv-dot{color:var(--iv-text-3)}
.iv-run-actions{display:flex;flex-wrap:wrap;gap:6px}
.iv-flow{height:268px;border:1px solid var(--iv-line);border-radius:var(--iv-r-md);overflow:hidden;background:var(--iv-surface-2)}
.iv-inspector{display:grid;gap:6px;border:1px solid var(--iv-line);border-radius:var(--iv-r-md);padding:9px 11px;background:var(--iv-surface-2)}
.iv-inspector-head{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:600}
.iv-field{display:grid;grid-template-columns:98px minmax(0,1fr);gap:7px;align-items:center;font-size:11.5px}
.iv-field>span{color:var(--iv-text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-field .iv-input,.iv-field .iv-select{height:23px;font-size:11.5px}
.iv-field textarea.iv-input{height:auto}

/* ---- xyflow 节点卡片 ---- */
.iv-node{min-width:150px;border-radius:10px;border:1px solid var(--iv-line-2);background:var(--iv-surface);
  color:var(--iv-text);box-shadow:var(--iv-shadow);font-size:11.5px;overflow:hidden}
.iv-node[data-workflow-node-selected=true]{border-color:var(--iv-accent);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--iv-accent) 22%,transparent),var(--iv-shadow)}
.iv-node[data-availability=planned]{border-style:dashed}
.iv-node[data-invalid=true]{border-color:var(--iv-danger)}
.iv-node-head{display:flex;align-items:center;gap:6px;padding:6px 9px;background:var(--iv-surface-2);
  border-bottom:1px solid var(--iv-line);font-weight:600}
.iv-node-head .iv-ico{color:var(--iv-accent)}
.iv-node-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-node-planned{margin-left:auto;display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:500;
  color:var(--iv-text-3);white-space:nowrap}
.iv-node-body{padding:6px 9px;display:grid;gap:2px;font-size:10.5px;color:var(--iv-text-2);
  overflow:hidden;text-overflow:ellipsis}

/* ---- xyflow 主题覆盖（特异性高于官方样式表） ---- */
.iv-flow .react-flow{--xy-edge-stroke-default:var(--iv-line-2,#555);--xy-connectionline-stroke-default:var(--iv-accent,#4d6bfe);
  --xy-edge-stroke-selected-default:var(--iv-accent,#4d6bfe);--xy-background-pattern-dots-color-default:var(--iv-line-2,#555);
  --xy-controls-button-background-color-default:var(--iv-surface,#fefefe);
  --xy-controls-button-background-color-hover-default:var(--iv-hover,#f4f4f4);
  --xy-controls-button-color-default:var(--iv-text-2,inherit);
  --xy-controls-button-border-color-default:var(--iv-line,#eee)}
.iv-flow .react-flow .react-flow__handle{width:9px;height:9px;background:var(--iv-accent,#4d6bfe);
  border:2px solid var(--iv-surface,#fff)}
.iv-flow .react-flow__controls{box-shadow:var(--iv-shadow-md);border-radius:var(--iv-r-sm);overflow:hidden;border:1px solid var(--iv-line)}
.iv-flow .react-flow__attribution{background:transparent;color:var(--iv-text-3)}
.iv-flow .react-flow__attribution a{color:var(--iv-text-3)}
`

/**
 * 注入工作台样式表（只注入一次；模块加载器不处理 CSS 文件）。
 * 与 `canvas-style.ts` 同机制：同一 <style> id 幂等。
 */
export function useWorkbenchStyle(): void {
  useEffect(() => {
    if (document.getElementById(WORKBENCH_STYLE_ID) !== null) return
    const style = document.createElement('style')
    style.id = WORKBENCH_STYLE_ID
    style.textContent = WORKBENCH_STYLE
    document.head.append(style)
  }, [])
}
