/**
 * 连接弹层的整张样式表。
 *
 * 与 `workbench-style.ts` 同一机制：客户端产物由 `window.__ModuleLoader__` 以 JS 载入，
 * 不走 Harness 的 CSS 打包链，所以样式内嵌成字符串、由 {@link useAuthStyle} 注入一次。
 * 单独成文件（不并进工作台样式表）是为了让登录弹层独立于右栏工作台存在。
 *
 * 颜色全部取自宿主设计令牌（`--dsw-alias-*`），取不到时退到与文字同源的
 * `color-mix(currentColor …)`，浅色/深色主题都成立；若工作台样式表已在页面上，
 * 则优先复用它的 `--iv-*` 变量，保证两个浮层观感一致。
 *
 * @module dsh-image-video/client/auth-style
 */
import { useEffect } from 'react'

/** 注入目标 <style> 的 id（重复挂载只保留一份）。 */
export const AUTH_STYLE_ID = 'dsh-image-video-auth-style'

/** 样式表版本戳：同 id 但版本不同就整表覆盖，避免热替换后旧规则给新结构定位。 */
export const AUTH_STYLE_VERSION = '2026-11-11.1'

/** 连接弹层样式表（类名统一 `iva-` 前缀，作用域根为 `.iva`）。 */
export const AUTH_STYLE = `
.iva-backdrop{
  --iva-panel:var(--iv-panel,var(--dsw-alias-bg-layer-1,color-mix(in srgb,currentColor 6%,transparent)));
  --iva-surface:var(--iv-surface,color-mix(in srgb,var(--dsw-alias-bg-layer-2,color-mix(in srgb,currentColor 8%,transparent)) 96%,currentColor));
  --iva-line:var(--iv-line,var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 14%,transparent)));
  --iva-line-strong:var(--iv-line-2,var(--dsw-alias-border-l3,color-mix(in srgb,currentColor 24%,transparent)));
  --iva-tx:var(--iv-tx,var(--dsw-alias-label-primary,currentColor));
  --iva-tx2:var(--iv-tx2,var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 76%,transparent)));
  --iva-tx3:var(--iv-tx3,var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 52%,transparent)));
  --iva-acc:var(--iv-acc,var(--dsw-alias-button-info-fill,#4176e6));
  --iva-acc-hover:var(--iv-acc-deep,var(--dsw-alias-button-info-hover,#3f57d6));
  --iva-on-acc:var(--iv-on-acc,var(--dsw-alias-label-primary-foreground,#fff));
  --iva-ok:var(--iv-ok,var(--dsw-alias-state-success-primary,#2ba471));
  --iva-danger:var(--iv-danger,var(--dsw-alias-state-error-primary,#e5534b));
  --iva-danger-soft:var(--iv-danger-soft,color-mix(in srgb,var(--iva-danger) 10%,transparent));
  --iva-r:var(--iv-r,6px);
  --iva-mono:var(--iv-mono,var(--dsh-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace));
  position:fixed;
  inset:0;
  z-index:var(--iv-z-overlay,60);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:16px;
  background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#000) 42%,transparent);
}
.iva{
  box-sizing:border-box;
  width:min(420px,100%);
  max-height:min(640px,calc(100vh - 32px));
  overflow:auto;
  display:flex;
  flex-direction:column;
  gap:10px;
  padding:14px;
  border:1px solid var(--iva-line-strong);
  border-radius:calc(var(--iva-r) + 2px);
  background:var(--iva-surface);
  color:var(--iva-tx);
  font-size:13px;
  line-height:1.45;
  box-shadow:0 18px 48px color-mix(in srgb,#000 26%,transparent);
}
.iva *{box-sizing:border-box}
.iva-header{display:flex;align-items:flex-start;gap:8px}
.iva-heading{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.iva-title{margin:0;font-size:15px;font-weight:600}
.iva-subtitle{margin:0;font-size:12px;color:var(--iva-tx2)}
.iva-close{
  flex:none;
  width:24px;height:24px;
  display:inline-flex;align-items:center;justify-content:center;
  border:1px solid transparent;border-radius:var(--iva-r);
  background:transparent;color:var(--iva-tx3);
  font-size:14px;line-height:1;cursor:pointer;
}
.iva-close:hover{background:color-mix(in srgb,currentColor 8%,transparent);color:var(--iva-tx)}
.iva-tabs{display:flex;gap:4px;padding:3px;border:1px solid var(--iva-line);border-radius:var(--iva-r);background:color-mix(in srgb,currentColor 4%,transparent)}
.iva-tab{
  flex:1;min-width:0;
  padding:6px 8px;
  border:0;border-radius:calc(var(--iva-r) - 2px);
  background:transparent;color:var(--iva-tx2);
  font-size:12px;font-weight:600;cursor:pointer;
}
.iva-tab:hover{color:var(--iva-tx)}
.iva-tab[aria-selected="true"]{background:var(--iva-surface);color:var(--iva-tx);box-shadow:0 1px 2px color-mix(in srgb,#000 18%,transparent)}
.iva-tab:focus-visible{outline:2px solid var(--iva-acc);outline-offset:1px}
.iva-body{display:flex;flex-direction:column;gap:10px}
.iva-form{display:flex;flex-direction:column;gap:8px}
.iva-field{display:flex;flex-direction:column;gap:4px}
.iva-label{font-size:12px;font-weight:600;color:var(--iva-tx2)}
.iva-input,.iva-select{
  width:100%;
  height:30px;
  padding:0 8px;
  border:1px solid var(--iva-line-strong);
  border-radius:var(--iva-r);
  background:var(--iva-panel);
  color:var(--iva-tx);
  font-size:13px;
  font-family:inherit;
}
.iva-input:focus-visible,.iva-select:focus-visible{outline:2px solid var(--iva-acc);outline-offset:0;border-color:var(--iva-acc)}
.iva-input--mono{font-family:var(--iva-mono);letter-spacing:.02em}
.iva-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.iva-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  height:30px;padding:0 12px;
  border:1px solid var(--iva-line-strong);border-radius:var(--iva-r);
  background:var(--iva-panel);color:var(--iva-tx);
  font-size:12.5px;font-weight:600;cursor:pointer;
}
.iva-btn:hover:not(:disabled){background:color-mix(in srgb,currentColor 7%,transparent)}
.iva-btn:focus-visible{outline:2px solid var(--iva-acc);outline-offset:1px}
.iva-btn:disabled{opacity:.55;cursor:not-allowed}
.iva-btn--primary{border-color:transparent;background:var(--iva-acc);color:var(--iva-on-acc)}
.iva-btn--primary:hover:not(:disabled){background:var(--iva-acc-hover)}
.iva-btn--ghost{border-color:transparent;background:transparent;color:var(--iva-tx2)}
.iva-btn--danger{color:var(--iva-danger);border-color:color-mix(in srgb,var(--iva-danger) 36%,transparent)}
.iva-btn--danger:hover:not(:disabled){background:var(--iva-danger-soft)}
.iva-status{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:8px 10px;
  border:1px solid var(--iva-line);border-radius:var(--iva-r);
  background:color-mix(in srgb,currentColor 4%,transparent);
}
.iva-status-main{display:flex;flex-direction:column;gap:1px;min-width:0}
.iva-status-label{font-size:11px;color:var(--iva-tx3)}
.iva-status-value{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iva-status-key{font-family:var(--iva-mono);font-size:11.5px;color:var(--iva-tx2);text-align:right;white-space:nowrap}
.iva-keyline{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--iva-tx2)}
.iva-dot{width:7px;height:7px;border-radius:50%;background:var(--iva-tx3);flex:none}
.iva-dot--on{background:var(--iva-ok)}
.iva-error,.iva-notice,.iva-hint{border-radius:var(--iva-r);font-size:12px}
.iva-error{padding:7px 9px;border:1px solid color-mix(in srgb,var(--iva-danger) 34%,transparent);background:var(--iva-danger-soft);color:var(--iva-danger)}
.iva-notice{padding:7px 9px;border:1px solid color-mix(in srgb,var(--iva-ok) 32%,transparent);background:color-mix(in srgb,var(--iva-ok) 10%,transparent);color:var(--iva-tx)}
.iva-hint{margin:0;color:var(--iva-tx3);line-height:1.5}
.iva-muted{color:var(--iva-tx3)}
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
