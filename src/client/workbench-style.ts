/**
 * 工作台设计系统 v3 —— 专业工具风（达芬奇/Premiere DNA）+ Harness 主题自适应。
 *
 * 客户端产物由 `window.__ModuleLoader__` 以 JS 载入，不经过 Harness 的 CSS 打包链，
 * 所以整张样式表内嵌成字符串，由 {@link useWorkbenchStyle} 挂载时注入一次
 * （与 `canvas-style.ts` 的 xyflow 官方样式同一机制）。
 *
 * 设计口径：
 * - **结构专业感**：左图标栏（模式导航）+ 顶栏 + 主区 + 底部状态栏的应用外壳；
 *   1px 发丝线分面板、平面无阴影、圆角收敛 5px、大写微型标签 + 等宽时间码。
 * - **颜色跟随 Harness 主题**（`R-NFR-3`）：所有面色/文字/边框先取 Harness 设计令牌
 *   （`--dsw-alias-*`），取不到退到与文字同源的中间色（`color-mix(currentColor …)`），
 *   浅色/深色都成立；**唯一例外是视频监视器恒深**（媒体惯例：NLE 的节目监视器
 *   在浅色界面里也是黑的，保证调色判断不受 UI 干扰）。
 * - 产物不烧入任何部署事实（服务商名、绝对路径）。
 */

import { useEffect } from 'react'

/** 注入目标 <style> 的 id，保证重复挂载只注入一次。 */
export const WORKBENCH_STYLE_ID = 'dsh-image-video-workbench-style'

/**
 * 样式表版本戳。宿主页面在插件模块热替换/重载时不会卸载文档级 `<style>`，
 * 只要 id 相同就会留下**上一版**样式表；一旦 JSX 已更新、CSS 还是旧的，
 * 界面就会出现"新旧混排"（旧规则给新结构定位，标签和控件错行）。
 * 所以注入时不做"已存在就跳过"，而是比对版本戳、不一致就整表覆盖。
 */
export const WORKBENCH_STYLE_VERSION = '2026-10-18.5'

/** 整张工作台样式表（类名统一 `iv-` 前缀，作用域根为 `.iv`）。 */
export const WORKBENCH_STYLE = `
.iv{
  /* 面色必须**不透明**：浮层叠在内容上时，任何透明底都会把底下的文字透出来。
     Harness 的层级令牌是 bg-layer-1/2/3（不是 bg-l1/bg-l2，写错会静默退到
     "4% 叠色"这种近乎透明的兜底，浮层就变成毛玻璃看穿）。 */
  --iv-panel:var(--dsw-alias-bg-layer-1,color-mix(in srgb,currentColor 4%,transparent));
  /* 抬升面：在不透明底上叠一点文字色，浅色主题得到浅灰、深色主题得到浅一档的灰，
     两个主题都不再依赖"哪一档令牌在浅色主题里其实也是纯白"这种巧合。 */
  --iv-panel-2:color-mix(in srgb,var(--iv-panel) 94%,var(--iv-tx));
  --iv-panel-3:color-mix(in srgb,var(--iv-panel) 88%,var(--iv-tx));
  /* 浮动面（对话框/弹层）：比面板再高一点，且恒不透明。 */
  --iv-surface:color-mix(in srgb,var(--iv-panel) 96%,var(--iv-tx));
  --iv-line:var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 13%,transparent));
  --iv-line-2:var(--dsw-alias-border-l3,color-mix(in srgb,currentColor 22%,transparent));
  --iv-tx:var(--dsw-alias-label-primary,currentColor);
  --iv-tx2:var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 76%,transparent));
  --iv-tx3:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 52%,transparent));
  /* 动作色：Harness 的 brand-primary 在两个主题下都是近中性色（浅色主题=近黑），
     那是它"主按钮=黑底白字"的极简口径；工作台要的是可辨识的蓝色动作色，
     所以取 Harness 为"彩色动作"准备的 info 令牌（浅色=#4176E6 / 深色=#7AAAFF），
     并按主题配前景色（浅色白字 / 深色黑字），保证对比度达标。 */
  --iv-acc:var(--dsw-alias-button-info-fill,#4176e6);
  --iv-acc-deep:var(--dsw-alias-button-info-hover,#3f57d6);
  --iv-on-acc:var(--dsw-alias-label-primary-foreground,#ffffff);
  /* 中性主按钮（黑底白字）单独留一个令牌，供"确认类"次要动作使用。 */
  --iv-solid:var(--dsw-alias-button-primary-fill,#1f1f1f);
  --iv-on-solid:var(--dsw-alias-label-primary-inverted,#ffffff);
  --iv-solid-hover:var(--dsw-alias-button-primary-hover,#3a3a3a);
  --iv-ok:var(--dsw-alias-state-success-primary,#2ba471);
  --iv-warn:var(--dsw-alias-state-warn-primary,#c07d00);
  --iv-danger:var(--dsw-alias-state-error-primary,#e5534b);
  --iv-acc-soft:color-mix(in srgb,var(--iv-acc) 11%,transparent);
  --iv-ok-soft:color-mix(in srgb,var(--iv-ok) 11%,transparent);
  --iv-warn-soft:color-mix(in srgb,var(--iv-warn) 11%,transparent);
  --iv-danger-soft:color-mix(in srgb,var(--iv-danger) 10%,transparent);
  --iv-monitor:#0a0b0d;
  --iv-r:5px;
  --iv-mono:var(--dsh-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);
  display:flex;flex-direction:column;height:100%;box-sizing:border-box;overflow:hidden;
  font:inherit;color:var(--iv-tx);font-size:12px;line-height:1.5;
}
.iv *,.iv *::before,.iv *::after{box-sizing:border-box}
.iv p{margin:0}.iv h3{margin:0}.iv ul{margin:0;padding:0;list-style:none}
.iv ::-webkit-scrollbar{width:8px;height:8px}
.iv ::-webkit-scrollbar-thumb{background:color-mix(in srgb,currentColor 22%,transparent);border-radius:4px;border:2px solid transparent;background-clip:content-box}
.iv ::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,currentColor 34%,transparent);background-clip:content-box}
.iv ::-webkit-scrollbar-track{background:transparent}
.iv ::selection{background:color-mix(in srgb,var(--iv-acc) 30%,transparent)}
.iv :focus-visible{outline:none;box-shadow:0 0 0 2px var(--iv-panel-2,#fff),0 0 0 4px color-mix(in srgb,var(--iv-acc) 55%,transparent)}
.iv-ico{flex:none;display:block}
.iv-mono{font-family:var(--iv-mono);font-variant-numeric:tabular-nums}
.iv-micro{font-size:9.5px;font-weight:700;letter-spacing:.11em;color:var(--iv-tx3);text-transform:uppercase;white-space:nowrap}
.iv-meta{font-size:11px;color:var(--iv-tx3)}
.iv-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}

/* ============ 应用外壳：顶栏 ============ */
.iv-top{display:flex;flex-wrap:wrap;align-items:center;gap:7px 10px;padding:7px 10px;
  background:var(--iv-panel);border-bottom:1px solid var(--iv-line);flex:none}
.iv-brand{display:flex;align-items:center;gap:8px;min-width:0}
.iv-mark{width:22px;height:22px;border-radius:5px;display:grid;place-items:center;color:var(--iv-on-acc);
  background:linear-gradient(135deg,var(--iv-acc),var(--iv-acc-deep))}
.iv-brand-text{display:flex;flex-direction:column;min-width:0;line-height:1.25}
.iv-brand-name{font-size:12.5px;font-weight:650;letter-spacing:.01em;white-space:nowrap}
.iv-brand-sub{font-size:9px;font-weight:600;letter-spacing:.11em;color:var(--iv-tx3);white-space:nowrap;text-transform:uppercase}
.iv-top-sep{width:1px;height:18px;background:var(--iv-line-2);flex:none}
.iv-proj{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.iv-newform{display:flex;align-items:center;gap:5px}
.iv-newform .iv-input{width:108px}
.iv-top-meta{margin-left:auto;display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.iv-rename{display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--iv-panel);
  border-bottom:1px solid var(--iv-line);flex:none;color:var(--iv-tx3)}
.iv-rename .iv-input{flex:1;min-width:140px;max-width:340px;color:var(--iv-tx)}
/* 改名行：输入框与两个按钮统一 26px 高，视觉上是一条齐平的编辑带 */
.iv-rename .iv-btn{height:26px;padding:0 11px;font-size:11px}
.iv-rename .iv-btn--acc{min-width:52px}

/* ============ 应用外壳：左图标栏 + 主区 ============ */
.iv-body{display:grid;grid-template-columns:42px minmax(0,1fr);flex:1;min-height:0}
.iv-rail{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 0;
  background:var(--iv-panel);border-right:1px solid var(--iv-line)}
.iv-rail-btn{width:28px;height:28px;display:grid;place-items:center;border-radius:var(--iv-r);
  border:1px solid transparent;background:transparent;color:var(--iv-tx3);cursor:pointer;position:relative}
.iv-rail-btn:hover{background:var(--iv-panel-3);color:var(--iv-tx2)}
/* 快捷入口（素材/任务/默认值）按下即反馈：即使目标已在视口内，也看得出"点到了" */
.iv-rail-btn:active{transform:scale(.93);color:var(--iv-acc);background:var(--iv-acc-soft)}
.iv-rail-btn:active .iv-rail-tip{opacity:1}
.iv-rail-btn.on{background:var(--iv-panel-3);color:var(--iv-acc)}
.iv-rail-btn.on::before{content:"";position:absolute;left:-7px;top:6px;bottom:6px;width:2px;
  border-radius:2px;background:var(--iv-acc)}
.iv-rail-tip{position:absolute;left:34px;top:50%;transform:translateY(-50%);white-space:nowrap;z-index:40;
  background:var(--iv-panel-3);border:1px solid var(--iv-line-2);border-radius:4px;padding:2px 8px;
  font-size:10.5px;color:var(--iv-tx);opacity:0;pointer-events:none;transition:opacity .12s}
.iv-rail-btn:hover .iv-rail-tip{opacity:1}
.iv-rail-sep{width:16px;border-top:1px solid var(--iv-line);margin:4px 0;flex:none}
.iv-rail-bottom{margin-top:auto}
.iv-main{min-width:0;overflow:auto;display:flex;flex-direction:column}

/* ============ 应用外壳：状态栏 ============ */
.iv-status{display:flex;align-items:center;gap:12px;height:23px;padding:0 10px;flex:none;
  background:var(--iv-panel);border-top:1px solid var(--iv-line);font-size:10px;color:var(--iv-tx3)}
.iv-status b{color:var(--iv-tx2);font-weight:600}
.iv-status .dot{width:6px;height:6px;border-radius:50%;background:var(--iv-ok);flex:none}
.iv-status-right{margin-left:auto;display:flex;gap:12px;align-items:center}

/* ============ 控件 ============ */
.iv-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:23px;padding:0 9px;
  border-radius:var(--iv-r);border:1px solid var(--iv-line-2);background:var(--iv-panel-2);color:var(--iv-tx2);
  font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;
  transition:background .12s ease,border-color .12s ease,color .12s ease}
.iv-btn:hover:not(:disabled){border-color:color-mix(in srgb,currentColor 35%,transparent);color:var(--iv-tx);background:var(--iv-panel-3)}
.iv-btn:disabled{opacity:.42;cursor:not-allowed}
.iv-btn--acc{background:var(--iv-acc);border-color:transparent;color:var(--iv-on-acc);font-weight:600;
  box-shadow:0 1px 2px color-mix(in srgb,var(--iv-acc) 40%,transparent)}
.iv-btn--acc:hover:not(:disabled){background:var(--iv-acc-deep);color:var(--iv-on-acc);border-color:transparent;
  box-shadow:0 2px 6px color-mix(in srgb,var(--iv-acc) 45%,transparent)}
.iv-btn--acc:active:not(:disabled){box-shadow:none}
.iv-btn--acc:disabled{background:color-mix(in srgb,var(--iv-acc) 16%,transparent);box-shadow:none;
  color:color-mix(in srgb,var(--iv-acc) 55%,transparent)}
.iv-btn--danger{color:var(--iv-danger);border-color:color-mix(in srgb,var(--iv-danger) 45%,transparent);background:var(--iv-danger-soft)}
.iv-btn--danger:hover:not(:disabled){background:color-mix(in srgb,var(--iv-danger) 16%,transparent);border-color:var(--iv-danger);color:var(--iv-danger)}
.iv-btn--ghost{background:transparent;border-color:transparent;color:var(--iv-tx3)}
.iv-btn--ghost:hover:not(:disabled){background:var(--iv-panel-3);color:var(--iv-tx)}
.iv-btn--icon{width:23px;padding:0}
.iv-btn--sm{height:20px;padding:0 7px;font-size:10.5px;gap:4px}
.iv-btn--sm.iv-btn--icon{width:20px;padding:0}
.iv-input,.iv-select{height:23px;min-width:0;border-radius:var(--iv-r);border:1px solid var(--iv-line-2);
  background:var(--iv-panel-2);color:var(--iv-tx);font:inherit;font-size:11px;padding:0 8px;
  transition:border-color .12s ease}
.iv-input::placeholder{color:var(--iv-tx3)}
.iv-input:hover,.iv-select:hover{border-color:color-mix(in srgb,currentColor 35%,transparent)}
.iv-input:focus,.iv-select:focus{outline:none;border-color:var(--iv-acc)}
.iv-select{appearance:none;-webkit-appearance:none;padding-right:22px;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M1 1l3 3 3-3' fill='none' stroke='%238e96a3' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 7px center}
.iv-textarea{min-height:42px;height:auto;padding:5px 8px;line-height:1.45;resize:vertical}
.iv-select--sm{height:20px;padding:0 18px 0 6px;font-size:10.5px}
.iv-toolbar--export .iv-field{grid-template-columns:auto minmax(56px,72px);gap:4px}
.iv-toolbar--export .iv-field-label{font-size:10px}
.iv-check{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--iv-tx2);cursor:pointer;user-select:none;white-space:nowrap}
.iv-check input{accent-color:var(--iv-acc);width:12px;height:12px;margin:0}
.iv-scrub{flex:1;height:14px;appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer;min-width:60px}
.iv-scrub::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:var(--iv-panel-3)}
.iv-scrub::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;margin-top:-4px;border-radius:50%;
  background:var(--iv-warn);border:2px solid var(--iv-panel)}
.iv-color{width:24px;height:20px;padding:0;border:1px solid var(--iv-line-2);border-radius:4px;background:var(--iv-panel-2);cursor:pointer}

/* ============ 徽章 ============ */
.iv-chip{display:inline-flex;align-items:center;gap:5px;height:19px;padding:0 8px;border-radius:999px;
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);font-size:10.5px;color:var(--iv-tx2);white-space:nowrap}
.iv-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.iv-chip--ok{color:var(--iv-ok);border-color:color-mix(in srgb,var(--iv-ok) 35%,transparent);background:var(--iv-ok-soft)}
.iv-chip--warn{color:var(--iv-warn);border-color:color-mix(in srgb,var(--iv-warn) 35%,transparent);background:var(--iv-warn-soft)}
.iv-chip--err{color:var(--iv-danger);border-color:color-mix(in srgb,var(--iv-danger) 35%,transparent);background:var(--iv-danger-soft)}
.iv-chip--run{color:var(--iv-acc);border-color:color-mix(in srgb,var(--iv-acc) 35%,transparent);background:var(--iv-acc-soft)}
.iv-chip--run .iv-dot{animation:iv-pulse 1.2s ease-in-out infinite}
@keyframes iv-pulse{0%,100%{opacity:1}50%{opacity:.3}}
@media (prefers-reduced-motion:reduce){.iv-chip--run .iv-dot{animation:none}.iv-btn,.iv-row,.iv-clip{transition:none}}
.iv-badge{display:inline-flex;align-items:center;gap:4px;padding:0 7px;height:17px;border-radius:999px;
  border:1px solid var(--iv-line);background:var(--iv-panel-2);font-size:9.5px;color:var(--iv-tx3);white-space:nowrap}
.iv-notice{display:flex;align-items:flex-start;gap:8px;padding:7px 11px;border-radius:var(--iv-r);
  font-size:11.5px;border:1px solid var(--iv-line);background:var(--iv-panel-2);color:var(--iv-tx2);flex:none}
.iv-notice--error{color:var(--iv-danger);background:var(--iv-danger-soft);border-color:color-mix(in srgb,var(--iv-danger) 35%,transparent)}
.iv-notice .iv-ico{margin-top:2px}

/* ============ 默认值摘要条 + 弹层 ============ */
/* 摘要条同时是弹层的定位容器：这样弹层宽度按**栏宽**算，窄侧栏里也不会溢出/被裁。 */
.iv-defaults{position:relative;container:iv-defaults/inline-size;
  display:flex;flex-wrap:wrap;align-items:center;gap:3px 10px;padding:5px 10px;flex:none;
  border-bottom:1px solid var(--iv-line);background:var(--iv-panel);font-size:10.5px;color:var(--iv-tx2)}
.iv-def{display:inline-flex;align-items:baseline;gap:5px;white-space:nowrap}
.iv-def i{font-style:normal;color:var(--iv-tx3)}
.iv-def b{font-weight:600;color:var(--iv-tx);font-variant-numeric:tabular-nums}
.iv-def+.iv-def::before{content:"";width:1px;height:9px;background:var(--iv-line-2);margin-right:10px;align-self:center}
/* 触发按钮本身不建定位上下文：弹层挂到摘要条上，位置只跟栏宽有关 */
.iv-pop{display:inline-flex}
.iv-pop-panel{position:absolute;top:calc(100% + 6px);right:0;left:auto;z-index:60;
  width:min(560px,100%);max-height:min(64vh,440px);overflow:auto;overscroll-behavior:contain;padding:0;
  scroll-padding:8px 0 54px;
  border-radius:10px;border:1px solid var(--iv-line-2);background:var(--iv-surface);
  box-shadow:0 18px 46px color-mix(in srgb,#000 30%,transparent),0 2px 8px color-mix(in srgb,#000 16%,transparent)}
/* 弹层头部：标题 + 一行说明，给对话框一个明确的"这是什么" */
.iv-pop-head{display:flex;align-items:flex-start;gap:9px;padding:9px 14px 8px;
  border-bottom:1px solid var(--iv-line);background:color-mix(in srgb,var(--iv-surface) 94%,var(--iv-tx));
  border-radius:10px 10px 0 0;position:sticky;top:0;z-index:2}
.iv-pop-head .iv-ico{color:var(--iv-acc);margin-top:1px}
.iv-pop-head-txt{display:flex;flex-direction:column;gap:2px;min-width:0}
.iv-pop-head-title{font-size:12.5px;font-weight:650;color:var(--iv-tx);line-height:1.35}
.iv-pop-head-sub{font-size:10.5px;color:var(--iv-tx3);line-height:1.45}
/* 分组：媒体类型 / 图像 / 视频，每组一个微型标题 + 两列表单（窄栏自动落成一列） */
.iv-pop-group{padding:8px 14px 9px}
.iv-pop-group+.iv-pop-group{border-top:1px solid var(--iv-line)}
.iv-pop-group-title{display:block;margin-bottom:7px}
.iv-pop-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px}
/* 只有一个字段的分组（如"媒体类型"）不占半栏留白，整行铺满，读起来才像一段设置 */
.iv-pop-grid:not(:has(>label+label)){grid-template-columns:minmax(0,1fr)}
.iv-pop-grid label{display:flex;flex-direction:column;gap:3px;font-size:10.5px;color:var(--iv-tx3);min-width:0}
.iv-pop-grid label>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-pop-grid .iv-select{width:100%;min-width:0;height:24px;font-size:11px;background:var(--iv-surface)}
/* 底部动作区：提示在左、按钮在右；吸底且不透明，滚动时字段不会从按钮缝里透出来 */
.iv-pop-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 14px;
  border-top:1px solid var(--iv-line);background:color-mix(in srgb,var(--iv-surface) 94%,var(--iv-tx));
  border-radius:0 0 10px 10px;position:sticky;bottom:0;z-index:2}
.iv-pop-foot .iv-meta{margin-right:auto;font-size:10.5px;line-height:1.4;max-width:240px}
.iv-pop-foot .iv-btn{height:26px;padding:0 13px;font-size:11px}
/* 栏宽不足 360px 时两列会挤成"标签一列、控件一列"的错位错觉，直接落成一列 */
@container iv-defaults (max-width:360px){.iv-pop-grid{grid-template-columns:minmax(0,1fr)}}

/* ============ 面板 ============ */
.iv-page{display:flex;flex-direction:column;gap:10px;padding:10px;flex:none}
.iv-dock{display:grid;grid-template-columns:repeat(auto-fit,minmax(232px,1fr));gap:10px;padding:0 10px 10px;align-items:start}
.iv-pane{display:flex;flex-direction:column;gap:8px;min-width:0;border:1px solid var(--iv-line);
  border-radius:6px;background:var(--iv-panel);padding:9px 11px;scroll-margin:10px}
/* 左栏快捷入口点击后的确认高亮：一次性脉冲，避免"点了没反应"的错觉 */
.iv-pane--flash{animation:iv-pane-flash 1.5s ease-out}
@keyframes iv-pane-flash{
  0%{border-color:var(--iv-acc);background:var(--iv-acc-soft);box-shadow:0 0 0 3px color-mix(in srgb,var(--iv-acc) 18%,transparent)}
  100%{border-color:var(--iv-line);background:var(--iv-panel);box-shadow:0 0 0 0 transparent}
}
@media (prefers-reduced-motion:reduce){.iv-pane--flash{animation:none;border-color:var(--iv-acc)}}
.iv-pane-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.iv-pane-tile{width:22px;height:22px;border-radius:5px;display:grid;place-items:center;flex:none;
  color:var(--iv-acc);background:var(--iv-acc-soft);border:1px solid color-mix(in srgb,var(--iv-acc) 24%,transparent)}
.iv-pane-title{margin:0;display:inline-flex;align-items:center;font-size:11.5px;font-weight:650;letter-spacing:.01em}
.iv-pane-actions{margin-left:auto;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.iv-pane-body{display:flex;flex-direction:column;gap:8px;min-width:0}
.iv-pane img,.iv-pane video{width:100%;border-radius:4px;display:block;background:var(--iv-monitor)}
.iv-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.iv-count{margin-left:auto;font-size:10.5px;color:var(--iv-tx3);font-variant-numeric:tabular-nums;white-space:nowrap}
.iv-progress{height:3px;border-radius:2px;background:var(--iv-panel-3);overflow:hidden;min-width:70px;flex:1}
.iv-progress>i{display:block;height:100%;border-radius:2px;background:var(--iv-acc);transition:width .3s ease}
.iv-progress--ok>i{background:var(--iv-ok)}
.iv-progress--err>i{background:var(--iv-danger)}
.iv-add-row{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.iv-add-row .iv-select{flex:1;min-width:110px}

/* ============ 列表 ============ */
.iv-list{display:flex;flex-direction:column;gap:2px;overflow:auto;min-height:0}
.iv-row{display:flex;align-items:center;gap:9px;padding:5px 6px;border-radius:var(--iv-r);
  border:1px solid transparent;font-size:12.5px;cursor:pointer;transition:background .1s ease}
.iv-row:hover{background:var(--iv-panel-2)}
.iv-row[data-active=true]{background:var(--iv-acc-soft);border-color:color-mix(in srgb,var(--iv-acc) 30%,transparent)}
.iv-row-main{flex:1;min-width:0;display:flex;align-items:center;gap:7px}
.iv-row-btn{flex:1;min-width:0;display:flex;align-items:center;gap:7px;border:0;background:transparent;
  color:inherit;font:inherit;font-size:11.5px;text-align:left;cursor:pointer;padding:0}
.iv-row-btn:disabled{cursor:default}
.iv-row-actions{display:flex;align-items:center;gap:4px;flex:none}
.iv-tile{width:22px;height:22px;border-radius:5px;display:grid;place-items:center;flex:none;
  border:1px solid var(--iv-line);background:var(--iv-panel-2);color:var(--iv-tx2)}
.iv-tile--image{color:var(--iv-acc);border-color:color-mix(in srgb,var(--iv-acc) 30%,transparent);background:var(--iv-acc-soft)}
.iv-tile--video{color:var(--iv-ok);border-color:color-mix(in srgb,var(--iv-ok) 30%,transparent);background:var(--iv-ok-soft)}
.iv-thumb{width:64px;height:44px;border-radius:3px;object-fit:cover;flex:none;background:var(--iv-monitor);
  border:1px solid var(--iv-line-2)}
.iv-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 10px;text-align:center;
  color:var(--iv-tx3);font-size:11.5px}
.iv-empty-tile{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;
  background:var(--iv-panel-2);border:1px solid var(--iv-line);color:var(--iv-tx3)}
.iv-empty strong{color:var(--iv-tx2);font-size:11.5px;font-weight:600}

/* ============ 快速创作 Hero ============ */
.iv-hero{display:flex;flex-direction:column;gap:11px}
.iv-hero-top{display:flex;align-items:center;gap:11px}
.iv-hero-ico{width:36px;height:36px;border-radius:6px;display:grid;place-items:center;flex:none;
  color:var(--iv-acc);background:var(--iv-acc-soft);border:1px solid color-mix(in srgb,var(--iv-acc) 26%,transparent)}
.iv-hero-title{font-size:13.5px;font-weight:650;letter-spacing:.01em}
.iv-hero-text{font-size:11.5px;color:var(--iv-tx2);max-width:70ch}
.iv-steps{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.iv-step{display:inline-flex;align-items:center;gap:6px;padding:2px 9px 2px 3px;border-radius:999px;
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);font-size:10.5px;color:var(--iv-tx2);white-space:nowrap}
.iv-step-n{width:15px;height:15px;border-radius:50%;display:grid;place-items:center;flex:none;
  font-size:8.5px;font-weight:700;color:var(--iv-on-acc);background:var(--iv-acc)}
.iv-step-arrow{color:var(--iv-tx3);flex:none}
.iv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.iv-stat{border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel-2);padding:6px 9px}
.iv-stat b{display:block;font-size:16px;font-weight:650;line-height:1.2;font-variant-numeric:tabular-nums}
.iv-stat span{font-size:9px;letter-spacing:.06em;color:var(--iv-tx3)}

/* ============ 时间轴：监视器 / transport / 轨道 ============ */
.iv-monitor{position:relative;min-height:168px;border-radius:4px;overflow:hidden;display:grid;place-items:center;
  background:radial-gradient(130% 130% at 50% 0%,#1c1f27 0%,var(--iv-monitor) 72%);
  border:1px solid var(--iv-line-2);box-shadow:inset 0 1px 6px color-mix(in srgb,#000 45%,transparent)}
.iv-monitor img,.iv-monitor video{max-width:100%;max-height:200px;display:block}
.iv-mon-tc{position:absolute;left:8px;top:7px;font-family:var(--iv-mono);font-size:10px;color:#cfd3d8;
  background:color-mix(in srgb,#000 60%,transparent);border:1px solid color-mix(in srgb,#fff 14%,transparent);
  border-radius:3px;padding:1px 6px;font-variant-numeric:tabular-nums}
.iv-mon-badge{position:absolute;right:8px;top:7px;font-size:8.5px;font-weight:600;letter-spacing:.1em;color:#9aa0a8;
  background:color-mix(in srgb,#000 60%,transparent);border:1px solid color-mix(in srgb,#fff 12%,transparent);
  border-radius:3px;padding:2px 6px;text-transform:uppercase}
.iv-mon-sub{position:absolute;left:0;right:0;bottom:9px;padding:0 10px;text-align:center;pointer-events:none;
  color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.7)}
.iv-transport{display:flex;align-items:center;gap:8px;padding:5px 7px;border:1px solid var(--iv-line);
  border-radius:var(--iv-r);background:var(--iv-panel-2)}
.iv-tp-btn{width:24px;height:24px;display:grid;place-items:center;border-radius:var(--iv-r);flex:none;
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);color:var(--iv-tx2);cursor:pointer}
.iv-tp-btn:hover{color:var(--iv-tx);background:var(--iv-panel-3)}
.iv-tp-btn--play{color:var(--iv-on-acc);background:var(--iv-acc);border-color:transparent}
.iv-tp-btn--play:hover{background:var(--iv-acc-deep);color:var(--iv-on-acc)}
.iv-tc-now{font-family:var(--iv-mono);font-size:11.5px;color:var(--iv-tx);font-variant-numeric:tabular-nums;white-space:nowrap}
.iv-tc-total{font-family:var(--iv-mono);font-size:10px;color:var(--iv-tx3);white-space:nowrap}
.iv-zoom{display:flex;align-items:center;gap:5px;margin-left:auto;font-size:10px;color:var(--iv-tx3);white-space:nowrap}
.iv-zoom .iv-scrub{max-width:64px;flex:none}
.iv-tl{position:relative;border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel-2);overflow:hidden}
.iv-ruler{position:relative;height:16px;margin-left:46px;border-bottom:1px solid var(--iv-line-2);
  background:var(--iv-panel-3)}
.iv-ruler i{position:absolute;top:0;bottom:0;width:1px;background:var(--iv-line-2)}
.iv-ruler b{position:absolute;top:2px;font-family:var(--iv-mono);font-size:8px;font-weight:500;color:var(--iv-tx3);
  transform:translateX(-50%);font-variant-numeric:tabular-nums}
.iv-tracks{position:relative}
.iv-track{display:grid;grid-template-columns:46px minmax(0,1fr);align-items:stretch;border-bottom:1px solid var(--iv-line)}
.iv-track:last-child{border-bottom:0}
.iv-t-head{display:flex;flex-direction:column;justify-content:center;gap:0;padding:5px 0 5px 8px;
  border-right:1px solid var(--iv-line);background:var(--iv-panel-3)}
.iv-t-head .micro{font-size:9px}
.iv-t-kind{font-size:8.5px;color:var(--iv-tx3)}
.iv-t-lane{position:relative;padding:4px 8px;display:flex;flex-direction:column;gap:5px;min-height:40px}
/* B5：片段按**时间**绝对定位（left=起点比例、width=时长比例），拖拽/手柄才有"落点即时间" */
.iv-clips{position:relative;display:block;height:58px}
.iv-clip{display:flex;flex-direction:column;gap:3px;min-width:16px;flex-basis:auto;min-height:34px;
  padding:3px 7px 3px 9px;border-radius:3px;border:1px solid var(--iv-line-2);background:var(--iv-panel);
  font-size:10.5px;position:absolute;top:0;bottom:0;overflow:hidden;cursor:grab}
.iv-clip:active{cursor:grabbing}
.iv-clip--sel{border-color:var(--iv-acc);box-shadow:0 0 0 2px color-mix(in srgb,var(--iv-acc) 30%,transparent)}
/* B5：左右手柄改起点/时长 */
.iv-clip-h{position:absolute;top:0;bottom:0;width:8px;cursor:col-resize;z-index:2;border:0;background:transparent;padding:0}
.iv-clip-h--l{left:0}
.iv-clip-h--r{right:0}
.iv-clip-h::after{content:"";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:2px;height:16px;border-radius:1px;background:color-mix(in srgb,currentColor 42%,transparent)}
.iv-clip-h:hover::after{background:var(--iv-acc);width:3px}
/* B5：放置落点高亮 */
.iv-t-lane--drop{background:var(--iv-acc-soft);outline:1px dashed var(--iv-acc);outline-offset:-2px}
.iv-clip::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px}
.iv-clip--video{border-color:color-mix(in srgb,var(--iv-acc) 45%,transparent);
  background:linear-gradient(90deg,var(--iv-acc-soft),transparent 46%),var(--iv-panel)}
.iv-clip--video::before{background:var(--iv-acc)}
.iv-clip--audio{border-color:color-mix(in srgb,var(--iv-ok) 45%,transparent);
  background:linear-gradient(90deg,var(--iv-ok-soft),transparent 46%),var(--iv-panel)}
.iv-clip--audio::before{background:var(--iv-ok)}
.iv-clip--subtitle{border-color:color-mix(in srgb,var(--iv-warn) 45%,transparent);
  background:linear-gradient(90deg,var(--iv-warn-soft),transparent 46%),var(--iv-panel)}
.iv-clip--subtitle::before{background:var(--iv-warn)}
.iv-clip-top{display:flex;align-items:center;gap:5px;min-width:0}
.iv-clip-top .iv-ico{color:var(--iv-tx3)}
.iv-clip-dur{margin-left:auto;font-family:var(--iv-mono);font-size:9px;color:var(--iv-tx3);white-space:nowrap;font-variant-numeric:tabular-nums}
.iv-clip-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.iv-clip .iv-input{height:18px;font-size:10px;width:56px;padding:0 4px}
.iv-clip .iv-select{height:18px;font-size:10px;width:74px;padding:0 16px 0 5px}
.iv-clip .iv-color{width:22px;height:18px}
.iv-clip .iv-btn{height:18px;width:18px;padding:0;border-color:transparent;background:transparent;color:var(--iv-tx3);margin-left:auto}
.iv-clip .iv-btn:hover:not(:disabled){color:var(--iv-danger);background:var(--iv-danger-soft)}
.iv-playhead{position:absolute;top:0;bottom:0;width:2px;background:var(--iv-warn);z-index:5;pointer-events:none}
.iv-playhead::before{content:"";position:absolute;top:0;left:-4px;border:5px solid transparent;border-top:6px solid var(--iv-warn)}

/* ============ 工作流画布 ============ */
.iv-pal{display:flex;flex-wrap:wrap;gap:4px}
.iv-pal-chip{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 8px;border-radius:var(--iv-r);
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);color:var(--iv-tx2);font:inherit;font-size:10.5px;
  cursor:pointer;white-space:nowrap;transition:background .1s ease,color .1s ease}
.iv-pal-chip:hover{border-color:color-mix(in srgb,currentColor 35%,transparent);color:var(--iv-tx)}
.iv-pal-chip .iv-ico{color:var(--iv-acc)}
.iv-pal-chip[data-availability=planned]{border-style:dashed;opacity:.68}
.iv-pal-chip[data-availability=planned] .iv-ico{color:var(--iv-tx3)}
.iv-pal-sep{width:100%;border-top:1px dashed var(--iv-line-2);margin:2px 0}
.iv-canvas-main{display:flex;flex-direction:column;gap:7px;min-width:0}
.iv-flow{height:250px;border:1px solid var(--iv-line);border-radius:var(--iv-r);overflow:hidden;background:var(--iv-panel-2)}
.iv-issues{display:grid;gap:3px;font-size:10.5px;border-radius:var(--iv-r);padding:6px 9px;border:1px solid var(--iv-line)}
.iv-issues strong{font-size:10.5px;font-weight:700;letter-spacing:.06em;opacity:.9;display:inline-flex;align-items:center;gap:5px;text-transform:uppercase}
.iv-issues[data-ok=true]{color:var(--iv-ok);background:var(--iv-ok-soft);border-color:color-mix(in srgb,var(--iv-ok) 28%,transparent)}
.iv-issues[data-ok=false]{color:var(--iv-danger);background:var(--iv-danger-soft);border-color:color-mix(in srgb,var(--iv-danger) 28%,transparent)}
.iv-issues span{display:inline-flex;align-items:center;gap:5px}
.iv-run{display:grid;gap:5px;font-size:10.5px;border:1px solid var(--iv-line);border-radius:var(--iv-r);padding:6px 9px;background:var(--iv-panel-2)}
.iv-run-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.iv-run-head strong{font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--iv-tx3);text-transform:uppercase}
.iv-run-history{display:flex;flex-wrap:wrap;gap:4px}
.iv-run-item{border:1px solid var(--iv-line-2);background:var(--iv-panel);color:var(--iv-tx2);border-radius:999px;
  font:inherit;font-size:10px;padding:1px 8px;cursor:pointer;white-space:nowrap}
.iv-run-item:hover{border-color:color-mix(in srgb,currentColor 35%,transparent);color:var(--iv-tx)}
.iv-run-item[data-active=true]{border-color:var(--iv-acc);color:var(--iv-tx);background:var(--iv-acc-soft)}
.iv-run-nodes{display:grid;gap:2px}
.iv-node-run{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--iv-tx2)}
.iv-node-run .iv-dot{width:5px;height:5px}
.iv-node-run[data-status=succeeded] .iv-dot{color:var(--iv-ok)}
.iv-node-run[data-status=failed] .iv-dot{color:var(--iv-danger)}
.iv-node-run[data-status=running] .iv-dot{color:var(--iv-acc);animation:iv-pulse 1.2s ease-in-out infinite}
.iv-node-run[data-status=cancelled] .iv-dot,.iv-node-run[data-status=skipped] .iv-dot{color:var(--iv-tx3)}
.iv-run-actions{display:flex;flex-wrap:wrap;gap:5px}
.iv-inspector{display:grid;gap:5px;border:1px solid var(--iv-line);border-radius:var(--iv-r);padding:7px 9px;background:var(--iv-panel-2)}
.iv-inspector-head{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.06em;
  color:var(--iv-tx3);text-transform:uppercase}
.iv-field{display:grid;grid-template-columns:92px minmax(0,1fr);gap:7px;align-items:center;font-size:11px}
.iv-field>span{color:var(--iv-tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-field .iv-input,.iv-field .iv-select{height:21px;font-size:11px}
.iv-field textarea.iv-input{height:auto}

/* ---- xyflow 节点卡片（画布内） ---- */
.iv-node{position:relative;min-width:148px;border-radius:var(--iv-r);border:1px solid var(--iv-line-2);background:var(--iv-panel);
  color:var(--iv-tx);font-size:11px}
.iv-node[data-workflow-node-selected=true]{border-color:var(--iv-acc);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--iv-acc) 20%,transparent)}
.iv-node[data-availability=planned]{border-style:dashed}
.iv-node[data-invalid=true]{border-color:var(--iv-danger)}
.iv-node-head{display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--iv-panel-3);
  border-bottom:1px solid var(--iv-line);font-weight:600;min-width:0}
.iv-node-head .iv-ico{color:var(--iv-acc)}
.iv-node-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.iv-node-planned{margin-left:auto;display:inline-flex;align-items:center;gap:3px;font-size:8.5px;font-weight:500;
  color:var(--iv-tx3);white-space:nowrap}
.iv-node-body{padding:5px 8px;display:grid;gap:2px;font-size:10px;color:var(--iv-tx2);overflow:hidden;text-overflow:ellipsis}
/* B4：节点运行状态徽章（卡片右上角的小圆点） */
.iv-node-run{margin-left:auto;display:grid;place-items:center;flex:none}
.iv-node-planned+.iv-node-run{margin-left:4px}
.iv-node-run .iv-dot{width:7px;height:7px}
.iv-node-run--running{color:var(--iv-acc)}
.iv-node-run--running .iv-dot{animation:iv-pulse 1.2s ease-in-out infinite}
.iv-node-run--succeeded{color:var(--iv-ok)}
.iv-node-run--failed{color:var(--iv-danger)}
.iv-node-run--cancelled,.iv-node-run--skipped{color:var(--iv-tx3)}
@media (prefers-reduced-motion:reduce){.iv-node-run--running .iv-dot{animation:none}}
/* B4：失败节点的错误开关 + 气泡（气泡要能溢出卡片，故卡片本身不裁切） */
.iv-node-err{margin-left:2px;width:16px;height:16px;display:grid;place-items:center;flex:none;padding:0;
  border:0;border-radius:3px;background:var(--iv-danger-soft);color:var(--iv-danger);cursor:pointer}
.iv-node-err:hover{background:color-mix(in srgb,var(--iv-danger) 22%,transparent)}
.iv-node-bubble{position:absolute;left:8px;right:8px;top:calc(100% + 5px);z-index:40;
  background:var(--iv-surface);border:1px solid color-mix(in srgb,var(--iv-danger) 45%,transparent);
  border-radius:5px;padding:5px 8px;font-size:10px;line-height:1.45;color:var(--iv-danger);
  box-shadow:0 8px 20px color-mix(in srgb,#000 30%,transparent);white-space:pre-wrap;word-break:break-all}
/* B4：画布工具栏分组分隔 */
.iv-toolbar-sep{width:1px;height:15px;background:var(--iv-line-2);flex:none;margin:0 3px}

/* ---- xyflow 主题覆盖（特异性高于官方样式表） ---- */
.iv-flow .react-flow{--xy-edge-stroke-default:var(--iv-line-2,#555);--xy-connectionline-stroke-default:var(--iv-acc,#4d6bfe);
  --xy-edge-stroke-selected-default:var(--iv-acc,#4d6bfe);--xy-background-pattern-dots-color-default:var(--iv-line-2,#555);
  --xy-controls-button-background-color-default:var(--iv-panel,#fefefe);
  --xy-controls-button-background-color-hover-default:var(--iv-panel-3,#f4f4f4);
  --xy-controls-button-color-default:var(--iv-tx2,inherit);
  --xy-controls-button-border-color-default:var(--iv-line,#eee)}
.iv-flow .react-flow .react-flow__handle{width:9px;height:9px;background:var(--iv-acc,#4d6bfe);
  border:2px solid var(--iv-panel,#fff)}
.iv-flow .react-flow__controls{box-shadow:0 8px 24px color-mix(in srgb,#000 30%,transparent);
  border-radius:var(--iv-r);overflow:hidden;border:1px solid var(--iv-line)}
.iv-flow .react-flow__attribution{background:transparent;color:var(--iv-tx3)}
.iv-flow .react-flow__attribution a{color:var(--iv-tx3)}
/* B7：窄窗（<768px）紧凑排版——右侧空间不足时缩小间距/字号，停靠区强制单列可滚，隐藏轨道文字（用悬浮提示代替） */
@media (max-width:768px){
.iv{padding:6px;font-size:11px}
.iv-top{padding:6px 8px;gap:6px}
.iv-rail{width:42px}
.iv-rail-txt{display:none}
.iv-dock{grid-template-columns:1fr;max-height:44vh;overflow:auto}
.iv-pane-head{padding:6px 8px}
.iv-hero{padding:10px}
.iv-steps{flex-wrap:wrap}
.iv-toolbar{flex-wrap:wrap}
}
`

/**
 * 注入工作台样式表（只注入一次；模块加载器不处理 CSS 文件）。
 * 与 `canvas-style.ts` 同机制：同一 <style> id 幂等。
 */
export function useWorkbenchStyle(): void {
  useEffect(() => {
    const existing = document.getElementById(WORKBENCH_STYLE_ID)
    const style = existing instanceof HTMLStyleElement ? existing : document.createElement('style')
    if (existing === null) {
      style.id = WORKBENCH_STYLE_ID
      document.head.append(style)
    }
    // 自愈：同一页面里可能残留上一个模块版本注入的样式表，内容不是当前这一份就覆盖。
    if (style.textContent !== WORKBENCH_STYLE) style.textContent = WORKBENCH_STYLE
    style.dataset.version = WORKBENCH_STYLE_VERSION
  }, [])
}
