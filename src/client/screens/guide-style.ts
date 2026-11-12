/**
 * 首次使用引导覆盖层的样式表（类名统一 `ivg-` 前缀，作用域根为 `.ivg-mask`）。
 *
 * 机制与 `workbench-style.ts` 完全一致：客户端产物由模块加载器以 JS 载入、不走 CSS
 * 打包链，所以整张表内嵌成字符串，组件挂载时注入一次。
 *
 * 与主样式表的关系：
 * - **独立 id / 独立版本戳**：引导层可能在主工作台样式之前或之后挂载，混进同一张表会
 *   让热更新时「一处旧一处新」更难排查；独立表可以各自被覆盖。
 * - **优先复用工作台令牌**：颜色先取 `--iv-*`（工作台已注入的语义色），取不到再退到
 *   宿主 `--dsw-alias-*` 设计令牌，最后才给裸色兜底——即宿主换了主题（浅/深色）引导层
 *   自动跟随，不写死任何部署事实。
 * - 圆角/发丝线与原型一致：弹层 28px 圆角、内层 20px、控件 10px，边框一律 `.5px`。
 *
 * 注意：样式表是模板字符串，**注释与 CSS 里都不能出现反引号**（会提前终止字符串）。
 *
 * @module dsh-image-video/client/screens/guide-style
 */

import { useEffect } from 'react'

/** 注入目标 `<style>` 的 id，保证重复挂载只注入一次。 */
export const GUIDE_STYLE_ID = 'dsh-image-video-guide-style'

/**
 * 样式表版本戳。宿主页面在模块热替换/重载时不会卸载文档级 `<style>`，只按 id 跳过
 * 会留下上一版规则；注入时比对版本戳、不一致就整表覆盖（同主样式表做法）。
 */
export const GUIDE_STYLE_VERSION = '2026-11-11.1'

/** 整张引导层样式表（类名统一 `ivg-` 前缀）。 */
export const GUIDE_STYLE = `
.ivg-mask{
  /* ---- 颜色：工作台语义令牌优先，其次宿主设计令牌，最后裸色兜底 ---- */
  --ivg-bg:var(--iv-surface,var(--dsw-alias-bg-layer-1,#ffffff));
  --ivg-bg-2:var(--iv-panel-2,color-mix(in srgb,var(--ivg-bg) 94%,var(--ivg-tx)));
  --ivg-bg-3:var(--iv-panel-3,color-mix(in srgb,var(--ivg-bg) 88%,var(--ivg-tx)));
  --ivg-line:var(--iv-line,var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 13%,transparent)));
  --ivg-line-2:var(--iv-line-2,var(--dsw-alias-border-l3,color-mix(in srgb,currentColor 22%,transparent)));
  --ivg-tx:var(--iv-tx,var(--dsw-alias-label-primary,currentColor));
  --ivg-tx-2:var(--iv-tx2,var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 76%,transparent)));
  --ivg-tx-3:var(--iv-tx3,var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 52%,transparent)));
  --ivg-acc:var(--iv-acc,var(--dsw-alias-button-info-fill,#4176e6));
  --ivg-on-acc:var(--iv-on-acc,var(--dsw-alias-label-primary-foreground,#ffffff));
  --ivg-ok:var(--iv-ok,var(--dsw-alias-state-success-primary,#2ba471));
  --ivg-warn:var(--iv-warn,var(--dsw-alias-state-warn-primary,#c07d00));
  --ivg-acc-soft:color-mix(in srgb,var(--ivg-acc) 11%,transparent);
  --ivg-ok-soft:color-mix(in srgb,var(--ivg-ok) 12%,transparent);
  --ivg-warn-soft:color-mix(in srgb,var(--ivg-warn) 13%,transparent);
  --ivg-mono:var(--iv-mono,var(--dsh-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace));
  --ivg-r-panel:28px;
  --ivg-r-lg:20px;
  --ivg-r-md:12px;
  --ivg-r-sm:10px;
  --ivg-dur:160ms;
  --ivg-shadow:0 24px 70px color-mix(in srgb,#000 30%,transparent),inset 0 0 0 .5px var(--ivg-line);

  position:absolute;inset:0;z-index:300;display:grid;place-items:center;padding:20px;
  background:color-mix(in srgb,#000 34%,transparent);backdrop-filter:blur(2px);
  animation:ivg-mask-in var(--ivg-dur) ease-out;
  font:inherit;color:var(--ivg-tx);
  box-sizing:border-box;
}
.ivg-mask *,.ivg-mask *::before,.ivg-mask *::after{box-sizing:border-box}
.ivg-mask p,.ivg-mask h3{margin:0}
.ivg-mask ul,.ivg-mask ol{margin:0;padding:0;list-style:none}

/* ============ 弹层卡片 ============ */
.ivg-modal{
  width:min(520px,100%);max-height:100%;overflow:auto;padding:24px 24px 20px;
  border-radius:var(--ivg-r-panel);background:var(--ivg-bg);color:var(--ivg-tx);
  box-shadow:var(--ivg-shadow);outline:none;
  animation:ivg-modal-in var(--ivg-dur) cubic-bezier(.2,.8,.3,1);
}
.ivg-modal:focus-visible{outline:none}
.ivg-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:4px}
.ivg-title{font-size:17px;font-weight:600;line-height:1.35;letter-spacing:.01em;flex:1;min-width:0}
.ivg-esc{font-family:var(--ivg-mono);font-size:10px;color:var(--ivg-tx-3);white-space:nowrap;padding-top:3px}
.ivg-sub{font-size:12px;line-height:1.65;color:var(--ivg-tx-2);margin-bottom:18px}

/* ============ 三步检查表 ============ */
.ivg-steps{display:flex;flex-direction:column}
.ivg-step{display:grid;grid-template-columns:26px minmax(0,1fr);gap:12px;align-items:start;padding:12px 0}
.ivg-step + .ivg-step{border-top:.5px solid var(--ivg-line)}
.ivg-step:first-child{padding-top:2px}
.ivg-n{
  width:26px;height:26px;border-radius:999px;display:grid;place-items:center;flex:none;
  font-size:12px;font-weight:700;line-height:1;
  background:var(--ivg-bg-2);color:var(--ivg-tx-3);
  box-shadow:inset 0 0 0 .5px var(--ivg-line);
}
.ivg-step[data-done="true"] .ivg-n{background:var(--ivg-ok-soft);color:var(--ivg-ok);box-shadow:none}
.ivg-step[data-current="true"] .ivg-n{background:var(--ivg-acc-soft);color:var(--ivg-acc);box-shadow:none}
.ivg-step-body{min-width:0}
.ivg-step-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px}
.ivg-step-t{font-size:12.5px;font-weight:600;line-height:1.4}
.ivg-step-d{font-size:11.5px;line-height:1.55;color:var(--ivg-tx-3);margin-bottom:8px}
.ivg-step:last-child .ivg-step-d{margin-bottom:10px}

/* ============ 状态 chip ============ */
.ivg-chip{
  display:inline-flex;align-items:center;gap:4px;height:18px;padding:0 7px;border-radius:999px;
  font-size:10px;font-weight:600;line-height:1;white-space:nowrap;
  background:var(--ivg-bg-2);color:var(--ivg-tx-2);
}
.ivg-chip[data-tone="ok"]{background:var(--ivg-ok-soft);color:var(--ivg-ok)}
.ivg-chip[data-tone="warn"]{background:var(--ivg-warn-soft);color:var(--ivg-warn)}
.ivg-chip[data-tone="acc"]{background:var(--ivg-acc-soft);color:var(--ivg-acc)}

/* ============ 行 / 按钮 / 字段 ============ */
.ivg-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ivg-row + .ivg-row{margin-top:8px}
.ivg-row .ivg-grow{flex:1;min-width:0}
.ivg-note{font-size:10.5px;line-height:1.5;color:var(--ivg-tx-3);margin-top:6px}
.ivg-note[data-tone="warn"]{color:var(--ivg-warn)}
.ivg-mono{font-family:var(--ivg-mono);font-size:10.5px;color:var(--ivg-tx-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.ivg-label{font-size:10.5px;color:var(--ivg-tx-3);white-space:nowrap}
.ivg-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:5px;height:30px;padding:0 12px;
  border:0;border-radius:var(--ivg-r-sm);cursor:pointer;font:inherit;font-size:12px;line-height:1;
  background:transparent;color:var(--ivg-tx-2);box-shadow:inset 0 0 0 .5px var(--ivg-line-2);
  transition:background var(--ivg-dur) ease,color var(--ivg-dur) ease;
}
.ivg-btn:hover{background:var(--ivg-bg-2);color:var(--ivg-tx)}
.ivg-btn:focus-visible{outline:2px solid var(--ivg-acc);outline-offset:2px}
.ivg-btn--acc{background:var(--ivg-acc);color:var(--ivg-on-acc);box-shadow:none;font-weight:600}
.ivg-btn--acc:hover{background:var(--ivg-acc);color:var(--ivg-on-acc);filter:brightness(1.06)}
.ivg-btn--sm{height:22px;padding:0 8px;font-size:11px;border-radius:8px}
.ivg-btn--ghost{box-shadow:none;background:transparent;color:var(--ivg-tx-3)}
.ivg-btn--ghost:hover{background:var(--ivg-bg-2);color:var(--ivg-tx)}

/* ============ 第三步：三个下拉 ============ */
.ivg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px}
.ivg-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.ivg-field > span{font-size:10.5px;color:var(--ivg-tx-3)}
.ivg-select{
  width:100%;height:30px;padding:0 8px;border-radius:var(--ivg-r-sm);
  border:.5px solid var(--ivg-line-2);background:var(--ivg-bg-2);color:var(--ivg-tx);
  font:inherit;font-size:11.5px;outline:none;cursor:pointer;
}
.ivg-select:focus-visible{border-color:var(--ivg-acc);box-shadow:0 0 0 3px var(--ivg-acc-soft)}
.ivg-select:disabled{opacity:.55;cursor:default}

/* ============ 底部 ============ */
.ivg-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:18px}
.ivg-foot .ivg-btn{height:32px;padding:0 16px;font-size:12.5px}

@keyframes ivg-mask-in{from{opacity:0}to{opacity:1}}
@keyframes ivg-modal-in{from{opacity:0;transform:translateY(6px) scale(.99)}to{opacity:1;transform:none}}

@media (prefers-reduced-motion:reduce){
  .ivg-mask,.ivg-modal{animation:none}
  .ivg-btn{transition:none}
}
`

/**
 * 注入引导层样式表（只注入一次；按版本戳自愈，热更新不留旧规则）。
 */
export function useGuideStyle(): void {
  useEffect(() => {
    const existing = document.getElementById(GUIDE_STYLE_ID)
    const style = existing instanceof HTMLStyleElement ? existing : document.createElement('style')
    if (existing === null) {
      style.id = GUIDE_STYLE_ID
      document.head.append(style)
    }
    // 自愈：页面可能残留上一版模块注入的样式表，内容不一致就整表覆盖。
    if (style.textContent !== GUIDE_STYLE) style.textContent = GUIDE_STYLE
    style.dataset.version = GUIDE_STYLE_VERSION
  }, [])
}
