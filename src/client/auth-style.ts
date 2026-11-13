/**
 * 连接弹层的整张样式表。
 *
 * 与 `workbench-style.ts` 同一机制：客户端产物由 `window.__ModuleLoader__` 以 JS 载入，
 * 不走 Harness 的 CSS 打包链，所以样式内嵌成字符串、由 {@link useAuthStyle} 注入一次。
 * 单独成文件（不并进工作台样式表）是为了让登录弹层独立于右栏工作台存在。
 *
 * 视觉参照：白色卡片、16px 圆角、黑色主按钮、绿色成功条、宽松留白。
 * 颜色优先复用工作台 `--iv-*` 变量；工作台未加载时退回宿主令牌，浅色/深色主题都成立。
 *
 * @module dsh-image-video/client/auth-style
 */
import { useEffect } from 'react'

/** 注入目标 <style> 的 id（重复挂载只保留一份）。 */
export const AUTH_STYLE_ID = 'dsh-image-video-auth-style'

/** 样式表版本戳：同 id 但版本不同就整表覆盖，避免热替换后旧规则给新结构定位。 */
export const AUTH_STYLE_VERSION = '2026-11-13.1'

/** 连接弹层样式表（类名统一 `iva-` 前缀，作用域根为 `.iva`）。 */
export const AUTH_STYLE = `
.iva-backdrop{
  --iva-panel:var(--iv-panel,var(--dsw-alias-bg-layer-1,#fff));
  --iva-surface:var(--iv-panel,var(--dsw-alias-bg-layer-1,#fff));
  --iva-fill:color-mix(in srgb,currentColor 4%,transparent);
  --iva-line:var(--iv-line,var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 12%,transparent)));
  --iva-line-strong:var(--iv-line-2,var(--dsw-alias-border-l3,color-mix(in srgb,currentColor 20%,transparent)));
  --iva-tx:var(--iv-tx,var(--dsw-alias-label-primary,currentColor));
  --iva-tx2:var(--iv-tx2,var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 72%,transparent)));
  --iva-tx3:var(--iv-tx3,var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 50%,transparent)));
  --iva-solid:var(--iv-solid,var(--dsw-alias-label-primary,currentColor));
  --iva-on-solid:var(--iv-on-solid,var(--dsw-alias-label-primary-foreground,#fff));
  --iva-acc:var(--iv-acc,var(--dsw-alias-button-info-fill,#4176e6));
  --iva-ok:var(--iv-ok,var(--dsw-alias-state-success-primary,#12a150));
  --iva-ok-soft:var(--iv-ok-soft,color-mix(in srgb,var(--iva-ok) 12%,transparent));
  --iva-danger:var(--iv-danger,var(--dsw-alias-state-error-primary,#e5534b));
  --iva-danger-soft:var(--iv-danger-soft,color-mix(in srgb,var(--iva-danger) 10%,transparent));
  --iva-r:10px;
  --iva-mono:var(--iv-mono,var(--dsh-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace));
  position:fixed;
  inset:0;
  z-index:var(--iv-z-overlay,60);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:16px;
  background:color-mix(in srgb,#0b0d12 34%,transparent);
  backdrop-filter:blur(2px);
}
.iva{
  box-sizing:border-box;
  width:min(392px,100%);
  max-height:min(680px,calc(100vh - 32px));
  overflow:auto;
  display:flex;
  flex-direction:column;
  gap:14px;
  padding:22px;
  border:1px solid var(--iva-line);
  border-radius:18px;
  background:var(--iva-surface);
  color:var(--iva-tx);
  font-size:13px;
  line-height:1.5;
  box-shadow:0 24px 60px color-mix(in srgb,#0b0d12 22%,transparent),0 2px 6px color-mix(in srgb,#0b0d12 8%,transparent);
}
.iva *{box-sizing:border-box}
.iva-header{display:flex;align-items:flex-start;gap:10px}
.iva-heading{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.iva-title{margin:0;font-size:17px;font-weight:650;line-height:1.35}
.iva-subtitle{margin:0;font-size:12px;color:var(--iva-tx3);line-height:1.55}
.iva-close{
  flex:none;
  width:28px;height:28px;
  display:inline-flex;align-items:center;justify-content:center;
  margin:-2px -2px 0 0;
  border:1px solid transparent;border-radius:8px;
  background:transparent;color:var(--iva-tx3);
  font-size:16px;line-height:1;cursor:pointer;
}
.iva-close:hover{background:var(--iva-fill);color:var(--iva-tx)}
.iva-close:focus-visible{outline:2px solid var(--iva-acc);outline-offset:1px}
.iva-tabs{display:flex;gap:3px;padding:3px;border-radius:11px;background:var(--iva-fill)}
.iva-tab{
  flex:1;min-width:0;
  height:32px;padding:0 8px;
  border:0;border-radius:8px;
  background:transparent;color:var(--iva-tx2);
  font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;
}
.iva-tab:hover{color:var(--iva-tx)}
.iva-tab[aria-selected="true"]{background:var(--iva-surface);color:var(--iva-tx);box-shadow:0 1px 3px color-mix(in srgb,#0b0d12 12%,transparent)}
.iva-tab:focus-visible{outline:2px solid var(--iva-acc);outline-offset:1px}
.iva-body{display:flex;flex-direction:column;gap:14px}
.iva-form{display:flex;flex-direction:column;gap:12px}
.iva-field{display:flex;flex-direction:column;gap:6px}
.iva-label{font-size:12px;font-weight:600;color:var(--iva-tx2)}
.iva-input,.iva-select{
  width:100%;
  height:40px;
  padding:0 12px;
  border:1px solid var(--iva-line-strong);
  border-radius:10px;
  background:var(--iva-panel);
  color:var(--iva-tx);
  font-size:13px;
  font-family:inherit;
}
.iva-input::placeholder{color:var(--iva-tx3)}
.iva-input:focus-visible,.iva-select:focus-visible{outline:2px solid color-mix(in srgb,var(--iva-acc) 55%,transparent);outline-offset:0;border-color:var(--iva-acc)}
.iva-input--mono{font-family:var(--iva-mono);letter-spacing:.02em}
.iva-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.iva-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  height:38px;padding:0 14px;
  border:1px solid var(--iva-line-strong);border-radius:10px;
  background:var(--iva-panel);color:var(--iva-tx);
  font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;
  text-decoration:none;
}
.iva-btn:hover:not(:disabled){background:var(--iva-fill)}
.iva-btn:focus-visible{outline:2px solid var(--iva-acc);outline-offset:1px}
.iva-btn:disabled{opacity:.55;cursor:not-allowed}
.iva-btn--primary{border-color:transparent;background:var(--iva-solid);color:var(--iva-on-solid)}
.iva-btn--primary:hover:not(:disabled){background:color-mix(in srgb,var(--iva-solid) 88%,transparent)}
.iva-btn--block{width:100%;height:42px}
.iva-btn--ghost{border-color:transparent;background:transparent;color:var(--iva-tx2)}
.iva-btn--danger{color:var(--iva-danger);border-color:transparent;background:transparent}
.iva-btn--danger:hover:not(:disabled){background:var(--iva-danger-soft)}
.iva-hint{margin:0;color:var(--iva-tx3);font-size:11.5px;line-height:1.6;text-align:center}
.iva-hint--left{text-align:left}
.iva-muted{color:var(--iva-tx3)}
.iva-banner{
  display:flex;align-items:flex-start;gap:8px;
  margin:0;padding:11px 12px;
  border-radius:10px;
  background:var(--iva-ok-soft);
  color:var(--iva-ok);
  font-size:12.5px;font-weight:600;line-height:1.5;
}
.iva-banner::before{content:"✓";flex:none;font-weight:700}
.iva-profile{display:flex;flex-direction:column;gap:14px}
.iva-profile-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.iva-email{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:650}
.iva-amount{flex:none;font-size:22px;font-weight:650;letter-spacing:-.01em}
.iva-profile-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;color:var(--iva-tx3)}
.iva-ok-text{color:var(--iva-ok);font-weight:600}
.iva-status-list{display:flex;flex-direction:column;gap:2px;padding-top:12px;border-top:1px solid var(--iva-line)}
.iva-status-heading{margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:.02em;color:var(--iva-tx3)}
.iva-status-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:4px 0;font-size:12px}
.iva-status-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.iva-status-text{flex:none;color:var(--iva-tx3);text-align:right}
.iva-status-text--ok{color:var(--iva-ok);font-weight:600}
.iva-notice{
  margin:0;padding:9px 11px;
  border:1px solid color-mix(in srgb,var(--iva-ok) 28%,transparent);
  border-radius:9px;
  background:var(--iva-ok-soft);
  color:var(--iva-tx);
  font-size:12px;line-height:1.65;
  white-space:pre-line;
}
.iva-notice--error{border-color:color-mix(in srgb,var(--iva-danger) 30%,transparent);background:var(--iva-danger-soft);color:var(--iva-danger)}
.iva-spinner{width:12px;height:12px;border-radius:50%;border:2px solid color-mix(in srgb,currentColor 30%,transparent);border-top-color:currentColor;animation:iva-spin .8s linear infinite}
@keyframes iva-spin{to{transform:rotate(360deg)}}
@media (max-width:480px){
  .iva-backdrop{padding:0}
  .iva{width:100%;max-height:100vh;border-radius:0;border-left:0;border-right:0}
}
`

/**
 * 注入连接弹层样式（幂等：同 id 已存在就只比对内容，版本不一致整表覆盖）。
 */
export function useAuthStyle(): void {
  useEffect(() => {
    const existing = document.getElementById(AUTH_STYLE_ID)
    const style = existing instanceof HTMLStyleElement ? existing : document.createElement('style')
    if (existing === null) {
      style.id = AUTH_STYLE_ID
      document.head.append(style)
    }
    if (style.textContent !== AUTH_STYLE) style.textContent = AUTH_STYLE
    style.dataset.version = AUTH_STYLE_VERSION
  }, [])
}
