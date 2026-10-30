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
export const WORKBENCH_STYLE_VERSION = '2026-10-30.6'

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
  /* ---- 间距：2px 偶数节奏，6 档。组件内微间距也用同一套，避免"再来一个 7px" ---- */
  --iv-sp-1:2px;--iv-sp-2:4px;--iv-sp-3:6px;--iv-sp-4:8px;--iv-sp-5:10px;--iv-sp-6:12px;
  /* ---- 字号：角色 = 字号 + 字重（行高留给具体排版）。micro=微型标签/时间码，
     tick=刻度专用（等宽数字密集，8px 是唯一允许低于 9px 的位置） ---- */
  --iv-fs-root:12px;--iv-fs-metric:16px;--iv-fs-title:13px;--iv-fs-strong:12px;
  --iv-fs-body:11px;--iv-fs-meta:10.5px;--iv-fs-micro:9px;--iv-fs-tick:8px;
  --iv-fw-regular:400;--iv-fw-medium:600;--iv-fw-bold:700;
  /* ---- 圆角：5px 是默认档（--iv-r），以下为其余五档 ---- */
  --iv-r-xs:3px;--iv-r-sm:4px;--iv-r-lg:6px;--iv-r-xl:10px;--iv-r-pill:999px;
  /* ---- 层级：只在插件自己的层叠上下文内有效（portal 出去要另算） ---- */
  --iv-z-sticky:2;--iv-z-playhead:5;--iv-z-tip:40;--iv-z-overlay:60;
  /* ---- 动效：100/120/300ms 三档；prefers-reduced-motion 下统一关掉 ---- */
  --iv-dur-1:100ms;--iv-dur-2:120ms;--iv-dur-3:300ms;--iv-ease:cubic-bezier(.2,.8,.3,1);
  /* ---- 阴影：acc 两档给主按钮，2/3 给气泡与浮层；
     监视器内嵌阴影与帮助浮层的 tx 色阴影语义不同，保留裸值 ---- */
  --iv-shadow-acc:0 1px 2px color-mix(in srgb,var(--iv-acc) 40%,transparent);
  --iv-shadow-acc-hover:0 2px 6px color-mix(in srgb,var(--iv-acc) 45%,transparent);
  --iv-shadow-2:0 8px 24px color-mix(in srgb,#000 30%,transparent);
  --iv-shadow-3:0 18px 46px color-mix(in srgb,#000 30%,transparent),0 2px 8px color-mix(in srgb,#000 16%,transparent);
  /* 根容器必须自己撑满：宿主把 tab 内容挂进 display:flex + flex-direction:column 的容器，
     中间那层包装是 display:contents（不产生盒子），于是 .iv 直接成为 flex item；
     只写 height:100% 时宽度会收缩到内容最小宽（实测 8px，整个工作台被压成一条竖线，
     看起来就是"插件打不开"）。width:100% + min-width:0 让它在任何宿主布局下都撑满可用宽度。 */
  display:flex;flex-direction:column;width:100%;min-width:0;height:100%;box-sizing:border-box;overflow:hidden;
  font:inherit;color:var(--iv-tx);font-size:var(--iv-fs-root);line-height:1.5;
}
.iv *,.iv *::before,.iv *::after{box-sizing:border-box}
.iv p{margin:0}.iv h3{margin:0}.iv ul{margin:0;padding:0;list-style:none}
/* 滚动条样式必须只命中伪元素。此前把「根选择器」和「后代滚动条伪元素」写进同一个
   分组选择器，结果第一个选择器命中的是**元素本身**——根容器被设成 width/height:8px
   （滚动条尺寸），整个工作台塌缩成一条竖线（真机实测 8×8px，表现为"插件打不开"）。 */
.iv::-webkit-scrollbar,.iv ::-webkit-scrollbar{width:8px;height:8px}
.iv::-webkit-scrollbar-thumb,.iv ::-webkit-scrollbar-thumb{background:color-mix(in srgb,currentColor 22%,transparent);border-radius:var(--iv-r-sm);border:2px solid transparent;background-clip:content-box}
.iv::-webkit-scrollbar-thumb:hover,.iv ::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,currentColor 34%,transparent);background-clip:content-box}
.iv::-webkit-scrollbar-track,.iv ::-webkit-scrollbar-track{background:transparent}
.iv ::selection{background:color-mix(in srgb,var(--iv-acc) 30%,transparent)}
.iv :focus-visible{outline:none;box-shadow:0 0 0 2px var(--iv-panel-2,#fff),0 0 0 4px color-mix(in srgb,var(--iv-acc) 55%,transparent)}
.iv-ico{flex:none;display:block}
.iv-mono{font-family:var(--iv-mono);font-variant-numeric:tabular-nums}
.iv-micro{font-size:var(--iv-fs-micro);font-weight:var(--iv-fw-bold);letter-spacing:.11em;color:var(--iv-tx3);text-transform:uppercase;white-space:nowrap}
.iv-meta{font-size:var(--iv-fs-body);color:var(--iv-tx3)}
.iv-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
/* 仅读屏可见：常驻 live region 用。不能用 display:none / visibility:hidden——
   那样读屏同样读不到，播报会静默失效。 */
.iv-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip-path:inset(50%);white-space:nowrap;border:0}

/* ============ 应用外壳：顶栏 ============ */
.iv-top{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-3) var(--iv-sp-5);padding:7px 10px;
  background:var(--iv-panel);border-bottom:1px solid var(--iv-line);flex:none}
.iv-brand{display:flex;align-items:center;gap:var(--iv-sp-4);min-width:0}
.iv-mark{width:22px;height:22px;border-radius:var(--iv-r);display:grid;place-items:center;color:var(--iv-on-acc);
  background:linear-gradient(135deg,var(--iv-acc),var(--iv-acc-deep))}
.iv-brand-text{display:flex;flex-direction:column;min-width:0;line-height:1.25}
.iv-brand-name{font-size:var(--iv-fs-title);font-weight:var(--iv-fw-medium);letter-spacing:.01em;white-space:nowrap}
.iv-brand-sub{font-size:var(--iv-fs-micro);font-weight:var(--iv-fw-medium);letter-spacing:.11em;color:var(--iv-tx3);white-space:nowrap;text-transform:uppercase}
.iv-top-sep{width:1px;height:18px;background:var(--iv-line-2);flex:none}
.iv-proj{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-3);min-width:0}
.iv-newform{display:flex;align-items:center;gap:var(--iv-sp-2)}
.iv-newform .iv-input{width:108px}
.iv-top-meta{margin-left:auto;display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-2)}
.iv-rename{display:flex;align-items:center;gap:var(--iv-sp-3);padding:6px 10px;background:var(--iv-panel);
  border-bottom:1px solid var(--iv-line);flex:none;color:var(--iv-tx3)}
.iv-rename .iv-input{flex:1;min-width:140px;max-width:340px;color:var(--iv-tx)}
/* 改名行：输入框与两个按钮统一 26px 高，视觉上是一条齐平的编辑带 */
.iv-rename .iv-btn{height:26px;padding:0 11px;font-size:var(--iv-fs-body)}
.iv-rename .iv-btn--acc{min-width:52px}

/* ============ 应用外壳：左图标栏 + 主区 ============ */
.iv-body{display:grid;grid-template-columns:42px minmax(0,1fr);flex:1;min-height:0}
.iv-rail{display:flex;flex-direction:column;align-items:center;gap:var(--iv-sp-2);padding:7px 0;
  background:var(--iv-panel);border-right:1px solid var(--iv-line)}
.iv-rail-btn{width:28px;height:28px;display:grid;place-items:center;border-radius:var(--iv-r);
  border:1px solid transparent;background:transparent;color:var(--iv-tx3);cursor:pointer;position:relative}
.iv-rail-btn:hover{background:var(--iv-panel-3);color:var(--iv-tx2)}
/* 快捷入口（素材/任务/默认值）按下即反馈：即使目标已在视口内，也看得出"点到了" */
.iv-rail-btn:active{transform:scale(.93);color:var(--iv-acc);background:var(--iv-acc-soft)}
.iv-rail-btn:active .iv-rail-tip{opacity:1}
.iv-rail-btn.on{background:var(--iv-panel-3);color:var(--iv-acc)}
.iv-rail-btn.on::before{content:"";position:absolute;left:-7px;top:6px;bottom:6px;width:2px;
  border-radius:var(--iv-r-xs);background:var(--iv-acc)}
.iv-rail-tip{position:absolute;left:34px;top:50%;transform:translateY(-50%);white-space:nowrap;z-index:var(--iv-z-tip);
  background:var(--iv-panel-3);border:1px solid var(--iv-line-2);border-radius:var(--iv-r-sm);padding:2px 8px;
  font-size:var(--iv-fs-meta);color:var(--iv-tx);opacity:0;pointer-events:none;transition:opacity var(--iv-dur-2)}
.iv-rail-btn:hover .iv-rail-tip{opacity:1}
.iv-rail-sep{width:16px;border-top:1px solid var(--iv-line);margin:4px 0;flex:none}
.iv-rail-bottom{margin-top:auto}
.iv-main{min-width:0;overflow:auto;scrollbar-gutter:stable;display:flex;flex-direction:column}

/* ============ 应用外壳：状态栏 ============ */
.iv-status{display:flex;align-items:center;gap:var(--iv-sp-6);height:23px;padding:0 10px;flex:none;
  background:var(--iv-panel);border-top:1px solid var(--iv-line);font-size:var(--iv-fs-meta);color:var(--iv-tx3)}
.iv-status b{color:var(--iv-tx2);font-weight:var(--iv-fw-medium);font-variant-numeric:tabular-nums}
.iv-status .dot{width:6px;height:6px;border-radius:50%;background:var(--iv-ok);flex:none}
.iv-status-right{margin-left:auto;display:flex;gap:var(--iv-sp-6);align-items:center}

/* ============ 控件 ============ */
.iv-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--iv-sp-2);height:23px;padding:0 9px;
  border-radius:var(--iv-r);border:1px solid var(--iv-line-2);background:var(--iv-panel-2);color:var(--iv-tx2);
  font:inherit;font-size:var(--iv-fs-body);cursor:pointer;white-space:nowrap;
  transition:background var(--iv-dur-2) ease,border-color var(--iv-dur-2) ease,color var(--iv-dur-2) ease}
.iv-btn:hover:not(:disabled){border-color:color-mix(in srgb,currentColor 35%,transparent);color:var(--iv-tx);background:var(--iv-panel-3)}
.iv-btn:disabled{opacity:.42;cursor:not-allowed}
.iv-btn--acc{background:var(--iv-acc);border-color:transparent;color:var(--iv-on-acc);font-weight:var(--iv-fw-medium);
  box-shadow:var(--iv-shadow-acc)}
.iv-btn--acc:hover:not(:disabled){background:var(--iv-acc-deep);color:var(--iv-on-acc);border-color:transparent;
  box-shadow:var(--iv-shadow-acc-hover)}
.iv-btn--acc:active:not(:disabled){box-shadow:none}
.iv-btn--acc:disabled{background:color-mix(in srgb,var(--iv-acc) 16%,transparent);box-shadow:none;
  color:color-mix(in srgb,var(--iv-acc) 55%,transparent)}
.iv-btn--danger{color:var(--iv-danger);border-color:color-mix(in srgb,var(--iv-danger) 45%,transparent);background:var(--iv-danger-soft)}
.iv-btn--danger:hover:not(:disabled){background:color-mix(in srgb,var(--iv-danger) 16%,transparent);border-color:var(--iv-danger);color:var(--iv-danger)}
.iv-btn--ghost{background:transparent;border-color:transparent;color:var(--iv-tx3)}
.iv-btn--ghost:hover:not(:disabled){background:var(--iv-panel-3);color:var(--iv-tx)}
.iv-btn--icon{width:23px;padding:0}
.iv-btn--sm{height:20px;padding:0 7px;font-size:var(--iv-fs-meta);gap:var(--iv-sp-2)}
.iv-btn--sm.iv-btn--icon{width:20px;padding:0}
.iv-input,.iv-select{height:23px;min-width:0;border-radius:var(--iv-r);border:1px solid var(--iv-line-2);
  background:var(--iv-panel-2);color:var(--iv-tx);font:inherit;font-size:var(--iv-fs-body);padding:0 8px;
  transition:border-color var(--iv-dur-2) ease}
.iv-input::placeholder{color:var(--iv-tx3)}
.iv-input:hover,.iv-select:hover{border-color:color-mix(in srgb,currentColor 35%,transparent)}
.iv-input:focus,.iv-select:focus{outline:none;border-color:var(--iv-acc)}
.iv-select{appearance:none;-webkit-appearance:none;padding-right:22px;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M1 1l3 3 3-3' fill='none' stroke='%238e96a3' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 7px center}
.iv-textarea{min-height:42px;height:auto;padding:5px 8px;line-height:1.45;resize:vertical}
.iv-select--sm{height:20px;padding:0 18px 0 6px;font-size:var(--iv-fs-meta)}
.iv-toolbar--export .iv-field{grid-template-columns:auto minmax(56px,72px);gap:var(--iv-sp-2)}
.iv-toolbar--export .iv-field-label{font-size:var(--iv-fs-meta)}
.iv-check{display:inline-flex;align-items:center;gap:var(--iv-sp-3);font-size:var(--iv-fs-body);color:var(--iv-tx2);cursor:pointer;user-select:none;white-space:nowrap}
.iv-check input{accent-color:var(--iv-acc);width:12px;height:12px;margin:0}
.iv-scrub{flex:1;height:14px;appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer;min-width:60px}
.iv-scrub::-webkit-slider-runnable-track{height:3px;border-radius:var(--iv-r-xs);background:var(--iv-panel-3)}
.iv-scrub::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;margin-top:-4px;border-radius:50%;
  background:var(--iv-warn);border:2px solid var(--iv-panel)}
.iv-color{width:24px;height:20px;padding:0;border:1px solid var(--iv-line-2);border-radius:var(--iv-r-sm);background:var(--iv-panel-2);cursor:pointer}

/* ============ 徽章 ============ */
.iv-chip{display:inline-flex;align-items:center;gap:var(--iv-sp-2);height:19px;padding:0 8px;border-radius:var(--iv-r-pill);
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);font-size:var(--iv-fs-meta);color:var(--iv-tx2);white-space:nowrap}
.iv-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.iv-chip--ok{color:var(--iv-ok);border-color:color-mix(in srgb,var(--iv-ok) 35%,transparent);background:var(--iv-ok-soft)}
.iv-chip--warn{color:var(--iv-warn);border-color:color-mix(in srgb,var(--iv-warn) 35%,transparent);background:var(--iv-warn-soft)}
.iv-chip--err{color:var(--iv-danger);border-color:color-mix(in srgb,var(--iv-danger) 35%,transparent);background:var(--iv-danger-soft)}
.iv-chip--run{color:var(--iv-acc);border-color:color-mix(in srgb,var(--iv-acc) 35%,transparent);background:var(--iv-acc-soft)}
.iv-chip--run .iv-dot{animation:iv-pulse 1.2s ease-in-out infinite}
@keyframes iv-pulse{0%,100%{opacity:1}50%{opacity:.3}}
@media (prefers-reduced-motion:reduce){.iv-chip--run .iv-dot{animation:none}.iv-btn,.iv-row,.iv-clip{transition:none}}
.iv-badge{display:inline-flex;align-items:center;gap:var(--iv-sp-2);padding:0 7px;height:17px;border-radius:var(--iv-r-pill);
  border:1px solid var(--iv-line);background:var(--iv-panel-2);font-size:var(--iv-fs-micro);color:var(--iv-tx3);white-space:nowrap}
.iv-notice{display:flex;align-items:flex-start;gap:var(--iv-sp-4);padding:7px 11px;border-radius:var(--iv-r);
  font-size:var(--iv-fs-body);border:1px solid var(--iv-line);background:var(--iv-panel-2);color:var(--iv-tx2);flex:none}
.iv-notice--error{color:var(--iv-danger);background:var(--iv-danger-soft);border-color:color-mix(in srgb,var(--iv-danger) 35%,transparent)}
.iv-notice .iv-ico{margin-top:2px}

/* ============ 默认值摘要条 + 弹层 ============ */
/* 摘要条同时是弹层的定位容器：这样弹层宽度按**栏宽**算，窄侧栏里也不会溢出/被裁。 */
.iv-defaults{position:relative;container:iv-defaults/inline-size;
  display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-2) var(--iv-sp-5);padding:5px 10px;flex:none;
  border-bottom:1px solid var(--iv-line);background:var(--iv-panel);font-size:var(--iv-fs-meta);color:var(--iv-tx2)}
.iv-def{display:inline-flex;align-items:baseline;gap:var(--iv-sp-2);white-space:nowrap}
.iv-def i{font-style:normal;color:var(--iv-tx3)}
.iv-def b{font-weight:var(--iv-fw-medium);color:var(--iv-tx);font-variant-numeric:tabular-nums}
.iv-def+.iv-def::before{content:"";width:1px;height:9px;background:var(--iv-line-2);margin-right:10px;align-self:center}
/* 触发按钮本身不建定位上下文：弹层挂到摘要条上，位置只跟栏宽有关 */
.iv-pop{display:inline-flex}
.iv-pop-panel{position:absolute;top:calc(100% + 6px);right:0;left:auto;z-index:var(--iv-z-overlay);
  width:min(560px,100%);max-height:min(64vh,440px);overflow:auto;scrollbar-gutter:stable;overscroll-behavior:contain;padding:0;
  scroll-padding:8px 0 54px;
  border-radius:var(--iv-r-xl);border:1px solid var(--iv-line-2);background:var(--iv-surface);
  box-shadow:var(--iv-shadow-3)}
/* 弹层头部：标题 + 一行说明，给对话框一个明确的"这是什么" */
.iv-pop-head{display:flex;align-items:flex-start;gap:var(--iv-sp-4);padding:9px 14px 8px;
  border-bottom:1px solid var(--iv-line);background:color-mix(in srgb,var(--iv-surface) 94%,var(--iv-tx));
  border-radius:var(--iv-r-xl) var(--iv-r-xl) 0 0;position:sticky;top:0;z-index:var(--iv-z-sticky)}
.iv-pop-head .iv-ico{color:var(--iv-acc);margin-top:1px}
.iv-pop-head-txt{display:flex;flex-direction:column;gap:var(--iv-sp-1);min-width:0}
.iv-pop-head-title{font-size:var(--iv-fs-title);font-weight:var(--iv-fw-medium);color:var(--iv-tx);line-height:1.35}
.iv-pop-head-sub{font-size:var(--iv-fs-meta);color:var(--iv-tx3);line-height:1.45}
/* 分组：媒体类型 / 图像 / 视频，每组一个微型标题 + 两列表单（窄栏自动落成一列） */
.iv-pop-group{padding:8px 14px 9px}
.iv-pop-group+.iv-pop-group{border-top:1px solid var(--iv-line)}
.iv-pop-group-title{display:block;margin-bottom:7px}
.iv-pop-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--iv-sp-4) var(--iv-sp-6)}
/* 只有一个字段的分组（如"媒体类型"）不占半栏留白，整行铺满，读起来才像一段设置 */
.iv-pop-grid:not(:has(>label+label)){grid-template-columns:minmax(0,1fr)}
.iv-pop-grid label{display:flex;flex-direction:column;gap:var(--iv-sp-2);font-size:var(--iv-fs-meta);color:var(--iv-tx3);min-width:0}
.iv-pop-grid label>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-pop-grid .iv-select{width:100%;min-width:0;height:24px;font-size:var(--iv-fs-body);background:var(--iv-surface)}
/* 底部动作区：提示在左、按钮在右；吸底且不透明，滚动时字段不会从按钮缝里透出来 */
.iv-pop-foot{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-4);padding:8px 14px;
  border-top:1px solid var(--iv-line);background:color-mix(in srgb,var(--iv-surface) 94%,var(--iv-tx));
  border-radius:0 0 var(--iv-r-xl) var(--iv-r-xl);position:sticky;bottom:0;z-index:var(--iv-z-sticky)}
.iv-pop-foot .iv-meta{margin-right:auto;font-size:var(--iv-fs-meta);line-height:1.4;max-width:240px}
.iv-pop-foot .iv-btn{height:26px;padding:0 13px;font-size:var(--iv-fs-body)}
/* 栏宽不足 360px 时两列会挤成"标签一列、控件一列"的错位错觉，直接落成一列 */
@container iv-defaults (max-width:360px){.iv-pop-grid{grid-template-columns:minmax(0,1fr)}}

/* ============ 面板 ============ */
.iv-page{display:flex;flex-direction:column;gap:var(--iv-sp-5);padding:10px;flex:none}
.iv-dock{display:grid;grid-template-columns:repeat(auto-fit,minmax(232px,1fr));gap:var(--iv-sp-5);padding:0 10px 10px;align-items:start}
.iv-pane{display:flex;flex-direction:column;gap:var(--iv-sp-4);min-width:0;border:1px solid var(--iv-line);
  border-radius:var(--iv-r-lg);background:var(--iv-panel);padding:var(--iv-sp-4) var(--iv-sp-5);scroll-margin:var(--iv-sp-5)}
/* 左栏快捷入口点击后的确认高亮：一次性脉冲，避免"点了没反应"的错觉 */
.iv-pane--flash{animation:iv-pane-flash 1.5s ease-out}
@keyframes iv-pane-flash{
  0%{border-color:var(--iv-acc);background:var(--iv-acc-soft);box-shadow:0 0 0 3px color-mix(in srgb,var(--iv-acc) 18%,transparent)}
  100%{border-color:var(--iv-line);background:var(--iv-panel);box-shadow:0 0 0 0 transparent}
}
@media (prefers-reduced-motion:reduce){.iv-pane--flash{animation:none;border-color:var(--iv-acc)}}
.iv-pane-head{display:flex;align-items:center;gap:var(--iv-sp-4);flex-wrap:wrap}
.iv-pane-tile{width:22px;height:22px;border-radius:var(--iv-r);display:grid;place-items:center;flex:none;
  color:var(--iv-acc);background:var(--iv-acc-soft);border:1px solid color-mix(in srgb,var(--iv-acc) 24%,transparent)}
.iv-pane-title{margin:0;display:inline-flex;align-items:center;font-size:var(--iv-fs-body);font-weight:var(--iv-fw-medium);letter-spacing:.01em}
.iv-pane-actions{margin-left:auto;display:flex;align-items:center;gap:var(--iv-sp-2);flex-wrap:wrap}
/* 子区块：pane 内的一层分组（介于 pane 与卡片之间）。
   原先 7 个区块各自写一套容器（padding 7/8 不一、底色在 panel 与 surface 之间摇摆），
   现在共享同一组声明；新代码直接写 iv-sub，旧类名保留以免打断既有 JSX。
   注意：整张样式表是模板字符串，注释里不能出现反引号。 */
.iv-sub,.iv-fusion,.iv-prompt-studio,.iv-storyboard,.iv-compose-params,.iv-pipeline-pick{
  display:flex;flex-direction:column;gap:var(--iv-sp-3);padding:var(--iv-sp-4);
  border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-surface);min-width:0}
.iv-sub-head{display:flex;align-items:center;gap:var(--iv-sp-3);flex-wrap:wrap;min-width:0}
/* 子区块标题：比 pane 标题小一档、全大写、字母放开——靠"形"而不是字号拉开层级 */
.iv-sub-title{display:inline-flex;align-items:center;gap:var(--iv-sp-2);font-size:var(--iv-fs-meta);
  font-weight:var(--iv-fw-bold);letter-spacing:.08em;color:var(--iv-tx3);text-transform:uppercase;white-space:nowrap}
.iv-sub-title .iv-ico{color:var(--iv-tx3)}
.iv-sub-actions{margin-left:auto;display:flex;align-items:center;gap:var(--iv-sp-2);flex-wrap:wrap}
/* 卡片：pane 内的主内容卡（无边框、无底色，用于快速创作主流程与配音卡）。
   此前 .iv-card / .iv-card-head / .iv-card-body 三个类名在样式表里**根本没有定义**，
   而图标是 display:block —— 结果是 head 里的图标独占一行、标题与徽章掉到第二行。 */
.iv-card{display:flex;flex-direction:column;gap:var(--iv-sp-3);min-width:0}
.iv-card-head{display:flex;align-items:center;gap:var(--iv-sp-2);flex-wrap:wrap;min-width:0}
.iv-card-head strong{font-size:var(--iv-fs-body);font-weight:var(--iv-fw-medium)}
.iv-card-body,.iv-card-note{min-width:0}
.iv-pane img,.iv-pane video{width:100%;border-radius:var(--iv-r-sm);display:block;background:var(--iv-monitor)}
.iv-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-2)}
.iv-count{margin-left:auto;font-size:var(--iv-fs-meta);color:var(--iv-tx3);font-variant-numeric:tabular-nums;white-space:nowrap}
.iv-progress{height:3px;border-radius:var(--iv-r-xs);background:var(--iv-panel-3);overflow:hidden;min-width:70px;flex:1}
.iv-progress>i{display:block;height:100%;border-radius:var(--iv-r-xs);background:var(--iv-acc);transition:width var(--iv-dur-3) ease}
.iv-progress--ok>i{background:var(--iv-ok)}
.iv-progress--err>i{background:var(--iv-danger)}
/* F3：生成没有百分比——不定进度条（色带往返），配"生成中 · 12s"文案 */
.iv-progress--run>i{width:38%;animation:iv-progress-run 1.15s ease-in-out infinite}
@keyframes iv-progress-run{0%{margin-left:-38%}100%{margin-left:100%}}
.iv-add-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-2)}
.iv-add-row .iv-select{flex:1;min-width:110px}

/* ============ G2 物料库分栏 ============ */
.iv-tabs{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-2)}
.iv-tab{display:inline-flex;align-items:center;gap:var(--iv-sp-2);height:22px;padding:0 9px;border-radius:var(--iv-r);
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);color:var(--iv-tx2);font-size:var(--iv-fs-meta);cursor:pointer}
.iv-tab:hover{color:var(--iv-tx);border-color:color-mix(in srgb,currentColor 35%,transparent)}
.iv-tab .iv-ico{color:var(--iv-tx3)}
.iv-tab.on{color:var(--iv-acc);border-color:color-mix(in srgb,var(--iv-acc) 45%,transparent);background:var(--iv-acc-soft)}
.iv-tab.on .iv-ico{color:var(--iv-acc)}
.iv-tabs .iv-select{width:auto;min-width:64px}

/* ============ 列表 ============ */
.iv-list{display:flex;flex-direction:column;gap:var(--iv-sp-1);overflow:auto;scrollbar-gutter:stable;min-height:0}
.iv-row{display:flex;align-items:center;gap:var(--iv-sp-4);padding:5px 6px;border-radius:var(--iv-r);
  border:1px solid transparent;font-size:var(--iv-fs-title);cursor:pointer;transition:background var(--iv-dur-1) ease}
.iv-row:hover{background:var(--iv-panel-2)}
.iv-row[data-active=true]{background:var(--iv-acc-soft);border-color:color-mix(in srgb,var(--iv-acc) 30%,transparent)}
.iv-row-main{flex:1;min-width:0;display:flex;align-items:center;gap:var(--iv-sp-3)}
.iv-row-btn{flex:1;min-width:0;display:flex;align-items:center;gap:var(--iv-sp-3);border:0;background:transparent;
  color:inherit;font:inherit;font-size:var(--iv-fs-body);text-align:left;cursor:pointer;padding:0}
.iv-row-btn:disabled{cursor:default}
.iv-row-actions{display:flex;align-items:center;gap:var(--iv-sp-2);flex:none}
.iv-tile{width:22px;height:22px;border-radius:var(--iv-r);display:grid;place-items:center;flex:none;
  border:1px solid var(--iv-line);background:var(--iv-panel-2);color:var(--iv-tx2)}
.iv-tile--image{color:var(--iv-acc);border-color:color-mix(in srgb,var(--iv-acc) 30%,transparent);background:var(--iv-acc-soft)}
.iv-tile--video{color:var(--iv-ok);border-color:color-mix(in srgb,var(--iv-ok) 30%,transparent);background:var(--iv-ok-soft)}
.iv-thumb{width:64px;height:44px;border-radius:var(--iv-r-xs);object-fit:cover;flex:none;background:var(--iv-monitor);
  border:1px solid var(--iv-line-2)}
.iv-empty{display:flex;flex-direction:column;align-items:center;gap:var(--iv-sp-3);padding:18px 10px;text-align:center;
  color:var(--iv-tx3);font-size:var(--iv-fs-body)}
.iv-empty-tile{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;
  background:var(--iv-panel-2);border:1px solid var(--iv-line);color:var(--iv-tx3)}
.iv-empty strong{color:var(--iv-tx2);font-size:var(--iv-fs-body);font-weight:var(--iv-fw-medium)}
/* 面板状态块（R6-3b）：加载骨架 / 错误告警 / 刷新中。
   这些形态只在这里定义一次，避免每个面板自己拼一套空态与错误样式。 */
.iv-skel{display:flex;flex-direction:column;gap:var(--iv-sp-2)}
.iv-skel i{display:block;height:10px;border-radius:var(--iv-r-xs);background:var(--iv-panel-3);
  animation:iv-skel-pulse 1.2s ease-in-out infinite}
.iv-skel i:nth-child(2){width:82%}
.iv-skel i:nth-child(3){width:64%}
@keyframes iv-skel-pulse{0%,100%{opacity:.55}50%{opacity:1}}
.iv-alert{display:flex;align-items:flex-start;gap:var(--iv-sp-2);padding:var(--iv-sp-2) var(--iv-sp-3);
  border:1px solid color-mix(in srgb,var(--iv-danger) 35%,transparent);border-radius:var(--iv-r);
  background:var(--iv-danger-soft);color:var(--iv-danger);font-size:var(--iv-fs-meta)}
.iv-alert .iv-ico{margin-top:1px;flex:none}
.iv-alert-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--iv-sp-1)}
.iv-alert-detail{font-size:var(--iv-fs-micro);color:var(--iv-tx3);word-break:break-all}
.iv-refreshing{height:2px;border-radius:var(--iv-r-xs);overflow:hidden;background:var(--iv-panel-3)}
.iv-refreshing>i{display:block;height:100%;width:38%;border-radius:var(--iv-r-xs);background:var(--iv-acc);
  animation:iv-progress-run 1.15s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){
  .iv-skel i{animation:none;opacity:.8}
  .iv-refreshing>i{animation:none;width:100%;opacity:.6}
}

/* ============ 快速生成面板 ============ */
.iv-model-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-3) var(--iv-sp-5)}
.iv-model-pick{display:flex;align-items:center;gap:var(--iv-sp-3);min-width:0}
.iv-create .iv-notice{margin:0}
.iv-asset-search{min-width:120px;max-width:220px;flex:1}
.iv-failure-actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-3) var(--iv-sp-4);
  margin-top:var(--iv-sp-4);padding:var(--iv-sp-4) var(--iv-sp-5);border-radius:var(--iv-r);
  border:1px solid var(--iv-line);background:var(--iv-panel-2)}
.iv-failure-text{display:inline-flex;align-items:center;gap:var(--iv-sp-2);color:var(--iv-tx2)}
.iv-last-result{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-3) var(--iv-sp-5);
  padding:var(--iv-sp-5);border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel-2)}
.iv-last-result-label{font-weight:var(--iv-fw-medium)}
.iv-last-result-media{width:96px;height:96px;object-fit:cover;border-radius:var(--iv-r-sm);
  border:1px solid var(--iv-line);background:var(--iv-panel);flex:none}
.iv-last-result-actions{display:flex;align-items:center;gap:var(--iv-sp-3);margin-left:auto}
.iv-model-pick-note{display:inline-flex;align-items:center;gap:var(--iv-sp-2);color:var(--iv-tx2);
  font-size:var(--iv-fs-meta);min-width:0}

/* 快速生成面板（原 iv-hero）。
   改名原因：hero 是网页设计术语（hero section = 首屏主视觉/门面区），暗示"展示性"；
   而这块装的是标题 + 三步说明 + 提示词 + 参考图 + 视频槽 + 参数 + 生成按钮，是**操作区**。
   叫 hero 会让读代码的人误以为是营销首屏，也会让文档写成"提示词 Hero"这种看不懂的名字。 */
.iv-create{display:flex;flex-direction:column;gap:var(--iv-sp-6)}
.iv-create-head{display:flex;align-items:center;gap:var(--iv-sp-6)}
.iv-create-ico{width:36px;height:36px;border-radius:var(--iv-r-lg);display:grid;place-items:center;flex:none;
  color:var(--iv-acc);background:var(--iv-acc-soft);border:1px solid color-mix(in srgb,var(--iv-acc) 26%,transparent)}
.iv-create-title{font-size:var(--iv-fs-title);font-weight:var(--iv-fw-medium);letter-spacing:.01em}
.iv-create-desc{font-size:var(--iv-fs-body);color:var(--iv-tx2);max-width:70ch}
.iv-steps{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-2)}
.iv-step{display:inline-flex;align-items:center;gap:var(--iv-sp-3);padding:2px 9px 2px 3px;border-radius:var(--iv-r-pill);
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);font-size:var(--iv-fs-meta);color:var(--iv-tx2);white-space:nowrap}
.iv-step-n{width:15px;height:15px;border-radius:50%;display:grid;place-items:center;flex:none;
  font-size:var(--iv-fs-micro);font-weight:var(--iv-fw-bold);color:var(--iv-on-acc);background:var(--iv-acc)}
.iv-step-arrow{color:var(--iv-tx3);flex:none}
.iv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--iv-sp-3)}
.iv-stat{border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel-2);padding:6px 9px}
.iv-stat b{display:block;font-size:var(--iv-fs-metric);font-weight:var(--iv-fw-medium);line-height:1.2;font-variant-numeric:tabular-nums}
.iv-stat span{font-size:var(--iv-fs-micro);letter-spacing:.06em;color:var(--iv-tx3)}

/* ============ F2 多参考图 chips ============ */
.iv-refs{display:grid;gap:var(--iv-sp-2)}
.iv-ref-list{display:flex;flex-wrap:wrap;gap:var(--iv-sp-2)}
.iv-ref-chip{display:inline-flex;align-items:center;gap:var(--iv-sp-2);height:22px;padding:0 3px 0 0;max-width:100%;
  border:1px solid var(--iv-line-2);border-radius:var(--iv-r);background:var(--iv-panel-2);font-size:var(--iv-fs-meta);cursor:grab}
.iv-ref-chip[data-ref-drop=true]{border-color:var(--iv-acc);background:var(--iv-acc-soft)}
.iv-ref-chip .iv-ellipsis{max-width:120px}
.iv-ref-order{width:17px;align-self:stretch;display:grid;place-items:center;border-radius:var(--iv-r) 0 0 var(--iv-r);
  background:var(--iv-panel-3);color:var(--iv-tx2);font-family:var(--iv-mono);font-size:var(--iv-fs-micro)}
.iv-ref-role{font-size:var(--iv-fs-micro);font-weight:var(--iv-fw-medium);letter-spacing:.06em;color:var(--iv-tx3);text-transform:uppercase}
.iv-ref-chip .iv-btn{width:18px;height:18px;padding:0;border-color:transparent;background:transparent;color:var(--iv-tx3)}
.iv-ref-chip .iv-btn:hover:not(:disabled){color:var(--iv-tx);background:var(--iv-panel-3)}
.iv-ref-move--up .iv-ico{transform:rotate(-90deg)}
.iv-ref-move--down .iv-ico{transform:rotate(90deg)}

/* ============ F3 生成进度 ============ */
.iv-genprog{display:flex;align-items:center;gap:var(--iv-sp-4);flex-wrap:wrap}

/* ============ G4 视频槽（尾帧/参考视频/真人） ============ */
.iv-vslots{display:grid;gap:var(--iv-sp-2);padding:7px 9px;border:1px dashed var(--iv-line-2);border-radius:var(--iv-r);
  background:var(--iv-panel-2)}

/* ============ B-7 素材批量操作条 ============ */
.iv-bulk{display:flex;flex-wrap:wrap;align-items:center;gap:var(--iv-sp-2);padding:6px 8px;border:1px solid var(--iv-line-2);
  border-radius:var(--iv-r);background:var(--iv-panel-2)}
.iv-row-check{flex:none;margin-right:2px}

/* ============ B-8 资源多参考图 ============ */
.iv-thumb-wrap{position:relative;flex:none;line-height:0}
.iv-thumb-more{position:absolute;right:2px;bottom:2px;padding:0 3px;border-radius:var(--iv-r-xs);background:var(--iv-monitor);
  color:#cfd3d8;font-family:var(--iv-mono);font-size:var(--iv-fs-micro);line-height:1.4}
.iv-refs-editor{display:grid;gap:var(--iv-sp-3);padding:7px 9px;border:1px solid var(--iv-line-2);border-radius:var(--iv-r);
  background:var(--iv-panel-2)}

/* ============ 时间轴：监视器 / transport / 轨道 ============ */
.iv-monitor{position:relative;min-height:168px;border-radius:var(--iv-r-sm);overflow:hidden;display:grid;place-items:center;
  background:radial-gradient(130% 130% at 50% 0%,#1c1f27 0%,var(--iv-monitor) 72%);
  border:1px solid var(--iv-line-2);box-shadow:inset 0 1px 6px color-mix(in srgb,#000 45%,transparent)}
.iv-monitor img,.iv-monitor video{max-width:100%;max-height:200px;display:block}
.iv-mon-tc{position:absolute;left:8px;top:7px;font-family:var(--iv-mono);font-size:var(--iv-fs-meta);color:#cfd3d8;
  background:color-mix(in srgb,#000 60%,transparent);border:1px solid color-mix(in srgb,#fff 14%,transparent);
  border-radius:var(--iv-r-xs);padding:1px 6px;font-variant-numeric:tabular-nums}
.iv-mon-badge{position:absolute;right:8px;top:7px;font-size:var(--iv-fs-micro);font-weight:var(--iv-fw-medium);letter-spacing:.1em;color:#9aa0a8;
  background:color-mix(in srgb,#000 60%,transparent);border:1px solid color-mix(in srgb,#fff 12%,transparent);
  border-radius:var(--iv-r-xs);padding:2px 6px;text-transform:uppercase}
.iv-mon-sub{position:absolute;left:0;right:0;bottom:9px;padding:0 10px;text-align:center;pointer-events:none;
  color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.7)}
.iv-transport{display:flex;align-items:center;gap:var(--iv-sp-4);padding:5px 7px;border:1px solid var(--iv-line);
  border-radius:var(--iv-r);background:var(--iv-panel-2)}
.iv-tp-btn{width:24px;height:24px;display:grid;place-items:center;border-radius:var(--iv-r);flex:none;
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);color:var(--iv-tx2);cursor:pointer}
.iv-tp-btn:hover{color:var(--iv-tx);background:var(--iv-panel-3)}
.iv-tp-btn--play{color:var(--iv-on-acc);background:var(--iv-acc);border-color:transparent}
.iv-tp-btn--play:hover{background:var(--iv-acc-deep);color:var(--iv-on-acc)}
.iv-tc-now{font-family:var(--iv-mono);font-size:var(--iv-fs-body);color:var(--iv-tx);font-variant-numeric:tabular-nums;white-space:nowrap}
.iv-tc-total{font-family:var(--iv-mono);font-size:var(--iv-fs-meta);color:var(--iv-tx3);white-space:nowrap}
.iv-zoom{display:flex;align-items:center;gap:var(--iv-sp-2);margin-left:auto;font-size:var(--iv-fs-meta);color:var(--iv-tx3);white-space:nowrap}
.iv-zoom .iv-scrub{max-width:64px;flex:none}
.iv-tl{position:relative;border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel-2);overflow:hidden}
.iv-ruler{position:relative;height:16px;margin-left:46px;border-bottom:1px solid var(--iv-line-2);
  background:var(--iv-panel-3)}
.iv-ruler i{position:absolute;top:0;bottom:0;width:1px;background:var(--iv-line-2)}
.iv-ruler b{position:absolute;top:2px;font-family:var(--iv-mono);font-size:var(--iv-fs-tick);font-weight:var(--iv-fw-regular);color:var(--iv-tx3);
  transform:translateX(-50%);font-variant-numeric:tabular-nums}
.iv-tracks{position:relative}
.iv-track{display:grid;grid-template-columns:46px minmax(0,1fr);align-items:stretch;border-bottom:1px solid var(--iv-line)}
.iv-track:last-child{border-bottom:0}
.iv-t-head{display:flex;flex-direction:column;justify-content:center;gap:0;padding:5px 0 5px 8px;
  border-right:1px solid var(--iv-line);background:var(--iv-panel-3)}
.iv-t-head .micro{font-size:var(--iv-fs-micro)}
.iv-t-kind{font-size:var(--iv-fs-micro);color:var(--iv-tx3)}
.iv-t-lane{position:relative;padding:4px 8px;display:flex;flex-direction:column;gap:var(--iv-sp-2);min-height:40px}
/* B5：片段按**时间**绝对定位（left=起点比例、width=时长比例），拖拽/手柄才有"落点即时间" */
.iv-clips{position:relative;display:block;height:58px}
.iv-clip{display:flex;flex-direction:column;gap:var(--iv-sp-2);min-width:16px;flex-basis:auto;min-height:34px;
  padding:3px 7px 3px 9px;border-radius:var(--iv-r-xs);border:1px solid var(--iv-line-2);background:var(--iv-panel);
  font-size:var(--iv-fs-meta);position:absolute;top:0;bottom:0;overflow:hidden;cursor:grab}
.iv-clip:active{cursor:grabbing}
.iv-clip--sel{border-color:var(--iv-acc);box-shadow:0 0 0 2px color-mix(in srgb,var(--iv-acc) 30%,transparent)}
/* B5：左右手柄改起点/时长 */
.iv-clip-h{position:absolute;top:0;bottom:0;width:8px;cursor:col-resize;z-index:var(--iv-z-sticky);border:0;background:transparent;padding:0}
.iv-clip-h--l{left:0}
.iv-clip-h--r{right:0}
.iv-clip-h::after{content:"";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:2px;height:16px;border-radius:var(--iv-r-xs);background:color-mix(in srgb,currentColor 42%,transparent)}
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
.iv-clip-top{display:flex;align-items:center;gap:var(--iv-sp-2);min-width:0}
.iv-clip-top .iv-ico{color:var(--iv-tx3)}
.iv-clip-dur{margin-left:auto;font-family:var(--iv-mono);font-size:var(--iv-fs-micro);color:var(--iv-tx3);white-space:nowrap;font-variant-numeric:tabular-nums}
.iv-clip-row{display:flex;align-items:center;gap:var(--iv-sp-2);flex-wrap:wrap}
.iv-clip .iv-input{height:18px;font-size:var(--iv-fs-meta);width:56px;padding:0 4px}
.iv-clip .iv-select{height:18px;font-size:var(--iv-fs-meta);width:74px;padding:0 16px 0 5px}
.iv-clip .iv-color{width:22px;height:18px}
.iv-clip .iv-btn{height:18px;width:18px;padding:0;border-color:transparent;background:transparent;color:var(--iv-tx3);margin-left:auto}
.iv-clip .iv-btn:hover:not(:disabled){color:var(--iv-danger);background:var(--iv-danger-soft)}
.iv-playhead{position:absolute;top:0;bottom:0;width:2px;background:var(--iv-warn);z-index:var(--iv-z-playhead);pointer-events:none}
.iv-playhead::before{content:"";position:absolute;top:0;left:-4px;border:5px solid transparent;border-top:6px solid var(--iv-warn)}

/* ============ 工作流画布 ============ */
.iv-pal{display:flex;flex-wrap:wrap;gap:var(--iv-sp-2)}
.iv-pal-chip{display:inline-flex;align-items:center;gap:var(--iv-sp-2);height:20px;padding:0 8px;border-radius:var(--iv-r);
  border:1px solid var(--iv-line-2);background:var(--iv-panel-2);color:var(--iv-tx2);font:inherit;font-size:var(--iv-fs-meta);
  cursor:pointer;white-space:nowrap;transition:background var(--iv-dur-1) ease,color var(--iv-dur-1) ease}
.iv-pal-chip:hover{border-color:color-mix(in srgb,currentColor 35%,transparent);color:var(--iv-tx)}
.iv-pal-chip .iv-ico{color:var(--iv-acc)}
.iv-pal-chip[data-availability=planned]{border-style:dashed;opacity:.68}
.iv-pal-chip[data-availability=planned] .iv-ico{color:var(--iv-tx3)}
.iv-pal-sep{width:100%;border-top:1px dashed var(--iv-line-2);margin:2px 0}
.iv-canvas-main{display:flex;flex-direction:column;gap:var(--iv-sp-3);min-width:0}
.iv-flow{height:250px;border:1px solid var(--iv-line);border-radius:var(--iv-r);overflow:hidden;background:var(--iv-panel-2)}
.iv-issues{display:grid;gap:var(--iv-sp-2);font-size:var(--iv-fs-meta);border-radius:var(--iv-r);padding:6px 9px;border:1px solid var(--iv-line)}
.iv-issues strong{font-size:var(--iv-fs-meta);font-weight:var(--iv-fw-bold);letter-spacing:.06em;opacity:.9;display:inline-flex;align-items:center;gap:var(--iv-sp-2);text-transform:uppercase}
.iv-issues[data-ok=true]{color:var(--iv-ok);background:var(--iv-ok-soft);border-color:color-mix(in srgb,var(--iv-ok) 28%,transparent)}
.iv-issues[data-ok=false]{color:var(--iv-danger);background:var(--iv-danger-soft);border-color:color-mix(in srgb,var(--iv-danger) 28%,transparent)}
.iv-issues span{display:inline-flex;align-items:center;gap:var(--iv-sp-2)}
.iv-run{display:grid;gap:var(--iv-sp-2);font-size:var(--iv-fs-meta);border:1px solid var(--iv-line);border-radius:var(--iv-r);padding:6px 9px;background:var(--iv-panel-2)}
.iv-run-head{display:flex;align-items:center;gap:var(--iv-sp-3);flex-wrap:wrap}
.iv-run-head strong{font-size:var(--iv-fs-meta);font-weight:var(--iv-fw-bold);letter-spacing:.08em;color:var(--iv-tx3);text-transform:uppercase}
.iv-run-history{display:flex;flex-wrap:wrap;gap:var(--iv-sp-2)}
.iv-run-item{border:1px solid var(--iv-line-2);background:var(--iv-panel);color:var(--iv-tx2);border-radius:var(--iv-r-pill);
  font:inherit;font-size:var(--iv-fs-meta);padding:1px 8px;cursor:pointer;white-space:nowrap}
.iv-run-item:hover{border-color:color-mix(in srgb,currentColor 35%,transparent);color:var(--iv-tx)}
.iv-run-item[data-active=true]{border-color:var(--iv-acc);color:var(--iv-tx);background:var(--iv-acc-soft)}
.iv-run-nodes{display:grid;gap:var(--iv-sp-1)}
.iv-node-run{display:flex;align-items:center;gap:var(--iv-sp-3);font-size:var(--iv-fs-meta);color:var(--iv-tx2)}
.iv-node-run .iv-dot{width:5px;height:5px}
.iv-node-run[data-status=succeeded] .iv-dot{color:var(--iv-ok)}
.iv-node-run[data-status=failed] .iv-dot{color:var(--iv-danger)}
.iv-node-run[data-status=running] .iv-dot{color:var(--iv-acc);animation:iv-pulse 1.2s ease-in-out infinite}
.iv-node-run[data-status=cancelled] .iv-dot,.iv-node-run[data-status=skipped] .iv-dot{color:var(--iv-tx3)}
.iv-run-actions{display:flex;flex-wrap:wrap;gap:var(--iv-sp-2)}
/* ============ B-6 模板市场（分组卡片） ============ */
.iv-tpl{display:grid;gap:var(--iv-sp-5)}
.iv-tpl-group{display:grid;gap:var(--iv-sp-2)}
.iv-tpl-group-title{display:block}
.iv-tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--iv-sp-3)}
.iv-tpl-card{display:grid;gap:var(--iv-sp-2);padding:8px 10px;text-align:left;border:1px solid var(--iv-line-2);border-radius:var(--iv-r);
  background:var(--iv-panel-2);color:var(--iv-tx2);cursor:pointer;transition:border-color var(--iv-dur-1) ease,background var(--iv-dur-1) ease}
.iv-tpl-card:hover{border-color:color-mix(in srgb,var(--iv-acc) 45%,transparent);background:var(--iv-acc-soft);color:var(--iv-tx)}
.iv-tpl-card .iv-ico{color:var(--iv-acc)}
.iv-tpl-name{display:flex;align-items:center;gap:var(--iv-sp-3);font-size:var(--iv-fs-body);font-weight:var(--iv-fw-medium);color:var(--iv-tx)}
.iv-tpl-desc{font-size:var(--iv-fs-meta);line-height:1.45;color:var(--iv-tx3)}
.iv-inspector{display:grid;gap:var(--iv-sp-2);border:1px solid var(--iv-line);border-radius:var(--iv-r);padding:7px 9px;background:var(--iv-panel-2)}
.iv-inspector-head{display:flex;align-items:center;gap:var(--iv-sp-3);font-size:var(--iv-fs-meta);font-weight:var(--iv-fw-bold);letter-spacing:.06em;
  color:var(--iv-tx3);text-transform:uppercase}
.iv-field{display:grid;grid-template-columns:92px minmax(0,1fr);gap:var(--iv-sp-3);align-items:center;font-size:var(--iv-fs-body)}
.iv-field>span{color:var(--iv-tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-field .iv-input,.iv-field .iv-select{height:21px;font-size:var(--iv-fs-body)}
.iv-field textarea.iv-input{height:auto}

/* ---- xyflow 节点卡片（画布内） ---- */
.iv-node{position:relative;min-width:148px;border-radius:var(--iv-r);border:1px solid var(--iv-line-2);background:var(--iv-panel);
  color:var(--iv-tx);font-size:var(--iv-fs-body)}
.iv-node[data-workflow-node-selected=true]{border-color:var(--iv-acc);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--iv-acc) 20%,transparent)}
.iv-node[data-availability=planned]{border-style:dashed}
.iv-node[data-invalid=true]{border-color:var(--iv-danger)}
.iv-node-head{display:flex;align-items:center;gap:var(--iv-sp-3);padding:5px 8px;background:var(--iv-panel-3);
  border-bottom:1px solid var(--iv-line);font-weight:var(--iv-fw-medium);min-width:0}
.iv-node-head .iv-ico{color:var(--iv-acc)}
.iv-node-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.iv-node-planned{margin-left:auto;display:inline-flex;align-items:center;gap:var(--iv-sp-2);font-size:var(--iv-fs-micro);font-weight:var(--iv-fw-regular);
  color:var(--iv-tx3);white-space:nowrap}
.iv-node-body{padding:5px 8px;display:grid;gap:var(--iv-sp-1);font-size:var(--iv-fs-meta);color:var(--iv-tx2);overflow:hidden;text-overflow:ellipsis}
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
  border:0;border-radius:var(--iv-r-xs);background:var(--iv-danger-soft);color:var(--iv-danger);cursor:pointer}
.iv-node-err:hover{background:color-mix(in srgb,var(--iv-danger) 22%,transparent)}
.iv-node-bubble{position:absolute;left:8px;right:8px;top:calc(100% + 5px);z-index:var(--iv-z-tip);
  background:var(--iv-surface);border:1px solid color-mix(in srgb,var(--iv-danger) 45%,transparent);
  border-radius:var(--iv-r);padding:5px 8px;font-size:var(--iv-fs-meta);line-height:1.45;color:var(--iv-danger);
  box-shadow:var(--iv-shadow-2);white-space:pre-wrap;word-break:break-all}
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
.iv-flow .react-flow__controls{box-shadow:var(--iv-shadow-2);
  border-radius:var(--iv-r);overflow:hidden;border:1px solid var(--iv-line)}
.iv-flow .react-flow__attribution{background:transparent;color:var(--iv-tx3)}
.iv-flow .react-flow__attribution a{color:var(--iv-tx3)}
/* B7：窄窗（<768px）紧凑排版——右侧空间不足时缩小间距/字号，停靠区强制单列可滚，隐藏轨道文字（用悬浮提示代替） */
@media (max-width:768px){
.iv{padding:6px;font-size:var(--iv-fs-body)}
.iv-top{padding:6px 8px;gap:var(--iv-sp-3)}
.iv-rail{width:42px}
.iv-rail-txt{display:none}
.iv-dock{grid-template-columns:1fr;max-height:44vh;overflow:auto}
.iv-pane-head{padding:6px 8px}
.iv-create{padding:10px}
.iv-steps{flex-wrap:wrap}
.iv-toolbar{flex-wrap:wrap}
}
/* B-9 融合生图 / B-10 提示词工坊 */
.iv-fusion-head{display:flex;align-items:center;gap:var(--iv-sp-4);flex-wrap:wrap;justify-content:space-between}
.iv-fusion-group{display:flex;align-items:center;gap:var(--iv-sp-3);flex-wrap:wrap}
.iv-prompt-lib{display:flex;flex-direction:column;gap:var(--iv-sp-2)}
.iv-prompt-row{display:flex;align-items:center;gap:var(--iv-sp-3);padding:3px 0;border-top:1px solid var(--iv-line)}
.iv-prompt-row .iv-ellipsis{flex:1;min-width:0}
/* B-11 素材库体检 */
.iv-health{display:flex;flex-direction:column;gap:var(--iv-sp-3);min-height:0}
.iv-health-tabs{flex:none}
.iv-health-body{display:flex;flex-direction:column;gap:var(--iv-sp-2);min-height:0;overflow:auto}
.iv-size-list,.iv-dupes-list,.iv-stats-list{display:flex;flex-direction:column;gap:var(--iv-sp-2);min-height:0;overflow:auto}
.iv-size-summary{flex:none}
.iv-size-row,.iv-stats-row{display:flex;align-items:center;gap:var(--iv-sp-3);padding:2px 0;border-top:1px solid var(--iv-line)}
.iv-size-row:first-of-type,.iv-stats-row:first-of-type{border-top:0}
.iv-size-name{flex:1;min-width:0}
.iv-size-bytes{flex:none;font-family:var(--iv-mono);font-size:var(--iv-fs-meta);color:var(--iv-tx3)}
.iv-dupes-group{display:flex;flex-direction:column;gap:var(--iv-sp-1);padding:4px 0;border-top:1px solid var(--iv-line)}
.iv-dupes-group-head{display:flex;align-items:center;gap:var(--iv-sp-3);flex-wrap:wrap}
.iv-dupes-item{display:flex;align-items:center;gap:var(--iv-sp-3);padding:1px 0 1px 10px;font-size:var(--iv-fs-body);color:var(--iv-tx2)}
.iv-dupes-item.keep{color:var(--iv-tx)}
.iv-stats-row{flex-direction:column;align-items:flex-start;gap:var(--iv-sp-1)}
.iv-stats-name{max-width:100%;font-size:var(--iv-fs-body)}
.iv-stats-facts{display:flex;gap:var(--iv-sp-4);flex-wrap:wrap;font-size:var(--iv-fs-meta)}
/* B-13 时间轴逐段预览 */
.iv-seg-wrap{flex-wrap:wrap}
.iv-seg-preview{display:flex;flex-direction:column;gap:var(--iv-sp-3);width:100%;min-width:0}
.iv-seg-head{display:flex;align-items:center;gap:var(--iv-sp-3);flex-wrap:wrap}
.iv-seg-video{width:100%;max-height:150px;border-radius:var(--iv-r);background:var(--iv-monitor)}
.iv-seg-bar{display:flex;gap:var(--iv-sp-1);width:100%;min-width:0}
.iv-seg-cell{flex:1 1 0;min-width:6px;height:16px;padding:0;border:1px solid var(--iv-line);border-radius:var(--iv-r-xs);
background:var(--iv-panel-3);cursor:pointer}
.iv-seg-cell.on{border-color:var(--iv-acc);background:var(--iv-acc-soft)}
.iv-seg-cell:focus-visible{outline:2px solid var(--iv-acc);outline-offset:1px}
/* B-15 分镜工坊：剧本输入 + 可编辑镜头表 */
.iv-sb-head{display:flex;align-items:center;gap:var(--iv-sp-4);flex-wrap:wrap;justify-content:space-between}
.iv-sb-count{display:flex;gap:var(--iv-sp-3);flex-wrap:wrap;align-items:center}
.iv-sb-list{display:flex;flex-direction:column;gap:var(--iv-sp-3);min-height:0}
.iv-sb-shot{display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--iv-sp-4);padding:6px;border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel)}
.iv-sb-shot-index{display:grid;place-items:center;min-width:26px;height:26px;border-radius:50%;background:var(--iv-acc-soft);color:var(--iv-acc);font-size:var(--iv-fs-body);font-weight:var(--iv-fw-medium)}
.iv-sb-shot-body{display:flex;flex-direction:column;gap:var(--iv-sp-2);min-width:0}
.iv-sb-row{display:flex;gap:var(--iv-sp-3);flex-wrap:wrap;align-items:flex-end}
.iv-sb-field{display:flex;flex-direction:column;gap:var(--iv-sp-1);min-width:0;flex:1 1 150px}
.iv-sb-field .iv-input{width:100%}
.iv-sb-actions{display:flex;gap:var(--iv-sp-2);flex-wrap:wrap;justify-content:flex-end}
.iv-ico--up{transform:rotate(180deg)}
/* B-16 导出历史面板 */
.iv-exports{display:flex;flex-direction:column;gap:var(--iv-sp-3);min-height:0}
.iv-exports-filter{display:flex;gap:var(--iv-sp-3);flex-wrap:wrap;align-items:center}
.iv-exports-list{display:flex;flex-direction:column;gap:var(--iv-sp-2);min-height:0;overflow:auto;scrollbar-gutter:stable}
.iv-exp-row{display:flex;flex-direction:column;gap:var(--iv-sp-2);padding:5px 6px;border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel)}
.iv-exp-head{display:flex;align-items:center;gap:var(--iv-sp-3);flex-wrap:wrap}
.iv-exp-facts{display:flex;gap:var(--iv-sp-5);flex-wrap:wrap;font-size:var(--iv-fs-meta);color:var(--iv-tx2);font-variant-numeric:tabular-nums}
.iv-exp-facts a{color:var(--iv-acc)}
.iv-exp-actions{display:flex;gap:var(--iv-sp-2);flex-wrap:wrap}
/* B-17 帮助浮层 */
.iv-help-mask{position:fixed;inset:0;z-index:var(--iv-z-overlay);display:grid;place-items:center;padding:16px;background:color-mix(in srgb,var(--iv-tx) 22%,transparent)}
.iv-help{display:flex;flex-direction:column;gap:var(--iv-sp-5);width:min(420px,100%);max-height:80vh;overflow:auto;scrollbar-gutter:stable;padding:14px;border:1px solid var(--iv-line-2);border-radius:var(--iv-r);background:var(--iv-surface);box-shadow:0 10px 32px color-mix(in srgb,var(--iv-tx) 26%,transparent)}
.iv-help h4{margin:0;font-size:var(--iv-fs-strong);color:var(--iv-tx)}
.iv-help-list{display:flex;flex-direction:column;gap:var(--iv-sp-2);margin:0;padding:0;list-style:none}
.iv-help-list li{display:flex;gap:var(--iv-sp-5);justify-content:space-between;font-size:var(--iv-fs-body);color:var(--iv-tx2)}
.iv-help-list b{color:var(--iv-tx);font-weight:var(--iv-fw-medium);text-align:right;font-variant-numeric:tabular-nums}
.iv-help-actions{display:flex;justify-content:flex-end}

/* ============ B-3 融合生图参数化 ============ */
.iv-param-row{display:flex;gap:var(--iv-sp-2);flex-wrap:wrap;align-items:center}
.iv-param-row .iv-meta{flex:none}
.iv-chip--toggle{cursor:pointer;transition:background var(--iv-dur-2),border-color var(--iv-dur-2),color var(--iv-dur-2)}
.iv-chip--toggle:hover{border-color:var(--iv-acc);color:var(--iv-tx)}
.iv-chip--toggle.on{color:var(--iv-acc);border-color:color-mix(in srgb,var(--iv-acc) 45%,transparent);background:var(--iv-acc-soft)}
.iv-crop{display:grid;gap:var(--iv-sp-2)}
.iv-crop-fields{display:flex;gap:var(--iv-sp-4);flex-wrap:wrap;align-items:center}
.iv-crop-field{display:inline-flex;align-items:center;gap:var(--iv-sp-2);font-size:var(--iv-fs-body);color:var(--iv-tx2)}
.iv-crop-field input{font:inherit}
.iv-meta--warn{color:var(--iv-warn)}

/* ============ B-4 续写开关 ============ */
.iv-check label{display:inline-flex;align-items:center;gap:var(--iv-sp-2)}

/* ============ B-5 多比例切片 ============ */
.iv-ratio-picks{display:flex;gap:var(--iv-sp-5);flex-wrap:wrap}
.iv-ratio-result{display:flex;gap:var(--iv-sp-3);flex-wrap:wrap;align-items:center}

/* ============ B-6 模型能力卡 ============ */
.iv-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--iv-sp-4)}
.iv-model-card{display:grid;gap:var(--iv-sp-2);padding:9px;border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel-2)}
.iv-model-card-head{display:flex;justify-content:space-between;align-items:center;gap:var(--iv-sp-3)}
.iv-model-card-name{font-weight:var(--iv-fw-medium);font-size:var(--iv-fs-strong);color:var(--iv-tx)}
.iv-model-card-kinds{display:flex;gap:var(--iv-sp-2);flex-wrap:wrap}
.iv-model-card-row{display:flex;gap:var(--iv-sp-2);font-size:var(--iv-fs-body);color:var(--iv-tx2);align-items:baseline}
.iv-model-card-features{display:flex;gap:var(--iv-sp-3);flex-wrap:wrap}
.iv-feature{display:inline-flex;align-items:center;gap:var(--iv-sp-2);font-size:var(--iv-fs-meta);color:var(--iv-tx3);border:1px solid var(--iv-line-2);border-radius:var(--iv-r-pill);padding:1px 6px}
.iv-feature.on{color:var(--iv-ok);border-color:color-mix(in srgb,var(--iv-ok) 35%,transparent);background:var(--iv-ok-soft)}
.iv-model-card-tips{font-size:var(--iv-fs-meta);color:var(--iv-tx2)}
.iv-model-card-tips ul{margin:2px 0 0;padding-left:16px}

/* ============ B-7 资源分类 + 重绘 ============ */
.iv-folder-bar{display:flex;gap:var(--iv-sp-2);flex-wrap:wrap}
.iv-folder-list{display:grid;gap:var(--iv-sp-3)}
.iv-folder-row{display:grid;gap:var(--iv-sp-2);padding:6px;border:1px solid var(--iv-line-2);border-radius:var(--iv-r-lg);background:var(--iv-panel-2)}
.iv-folder-row-head{display:flex;gap:var(--iv-sp-3);align-items:center;flex-wrap:wrap}
.iv-folder-name{font-size:var(--iv-fs-strong);color:var(--iv-tx);font-weight:var(--iv-fw-medium)}
.iv-redraw-plan{display:grid;gap:var(--iv-sp-2);font-size:var(--iv-fs-body);color:var(--iv-tx2);padding-top:4px;border-top:1px dashed var(--iv-line-2)}

/* ============ B-18 手动挑选物料 ============ */
.iv-pick-list{display:flex;gap:var(--iv-sp-3);flex-wrap:wrap}

/* ============ B-6 风控条 ============ */
.iv-risk{display:flex;gap:var(--iv-sp-3);flex-wrap:wrap;align-items:center}
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
