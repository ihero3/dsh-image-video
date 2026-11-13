/**
 * 连接弹层视觉语言的全插件主题层（纯增量覆盖，不改动既有样式表）。
 *
 * 背景：auth/ConnectDialog 使用的 auth-style.ts 已经是白卡片 / 黑白灰 / 分段 tab /
 * 38px 黑底主按钮 / 40px 描边输入框的极简风格，而 workbench-style.ts 仍是 11px 基准、
 * 蓝色强调、发丝线平面面板的密集工具风。本文件把前者的视觉语言推广到 .iv（工作台、
 * 画布、全部面板）与 .ivg-mask（首次使用引导层）。
 *
 * 约定：
 * - 只覆盖表现，不新增、不删除、不重命名任何 --iv-* 令牌与 iv-* 类名，让
 *   tests/client-design-system.test.tsx 的令牌 / 骨架 / 图标契约继续成立。
 * - 颜色一律经 --iv-* → --dsw-alias-* → currentColor 兜底，浅色深色主题都成立；
 *   主按钮沿用 --iv-solid / --iv-on-solid，深色主题自动反相。
 * - 选择器统一带 .iv / .ivg-mask 前缀以提高特异性，因此不依赖注入顺序；样式表仍被
 *   append 到 head 末尾，热替换后保持单一节点。
 * - CSS 字符串内不放注释与多余空白（这是被打进客户端 chunk 的体积），说明写在 TS 注释里。
 * - 模板字符串内不能出现反引号。
 *
 * @module dsh-image-video/client/modern-theme
 */
import { useEffect } from 'react'

/** 注入目标 style 的 id（重复挂载只保留一份）。 */
export const MODERN_THEME_STYLE_ID = 'dsh-image-video-modern-theme'

/** 样式表版本戳：同 id 但内容不同时整表覆盖，避免热替换后残留旧规则。 */
export const MODERN_THEME_VERSION = '2026-11-13.2'

/** 主题层样式表：令牌 + 控件 + 容器 + 引导层，布局规则（grid / flex / 定位）一律不动。 */
export const MODERN_THEME_STYLE = `
.iv{
--iv-fs-root:13px;--iv-fs-body:12.5px;--iv-fs-strong:13px;--iv-fs-title:15px;--iv-fs-lead:17px;
--iv-fs-metric:20px;--iv-fs-meta:12px;--iv-fs-micro:11px;--iv-fs-tick:10px;
--iv-r:10px;--iv-r-xs:6px;--iv-r-sm:8px;--iv-r-lg:14px;--iv-r-xl:18px;
--iv-sp-1:3px;--iv-sp-2:6px;--iv-sp-3:8px;--iv-sp-4:10px;--iv-sp-5:14px;--iv-sp-6:18px;
--iv-acc:var(--iv-solid);--iv-acc-deep:var(--iv-solid-hover);--iv-on-acc:var(--iv-on-solid);
--iv-acc-soft:color-mix(in srgb,var(--iv-tx) 6%,transparent);
--iv-shadow-2:0 8px 24px color-mix(in srgb,#0b0d12 14%,transparent);
--iv-shadow-3:0 18px 46px color-mix(in srgb,#0b0d12 18%,transparent),0 2px 8px color-mix(in srgb,#0b0d12 8%,transparent);
font-size:var(--iv-fs-root);line-height:1.55;
}
.iv .iv-top{padding:10px 14px;gap:8px 14px}
.iv .iv-brand-name{font-size:15px;font-weight:650;letter-spacing:0}
.iv .iv-brand-sub{font-size:10px;letter-spacing:.08em}
.iv .iv-modes{gap:3px;padding:3px;border-radius:11px;background:color-mix(in srgb,var(--iv-tx) 5%,transparent)}
.iv .iv-modes-btn{height:30px;padding:0 12px;border-radius:8px;font-size:12.5px;font-weight:500;color:var(--iv-tx2)}
.iv .iv-modes-btn.on{background:var(--iv-panel);color:var(--iv-tx);font-weight:600;box-shadow:0 1px 3px color-mix(in srgb,#0b0d12 12%,transparent)}
.iv .iv-tabs,.iv .iv-quick-tabs,.iv .iv-skill-tabs,.iv .iv-health-tabs{gap:3px;padding:3px;border:0;border-radius:11px;background:color-mix(in srgb,var(--iv-tx) 5%,transparent)}
.iv .iv-tab{height:32px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:var(--iv-tx2);font-size:12.5px;font-weight:500}
.iv .iv-tab:hover{border-color:transparent;color:var(--iv-tx)}
.iv .iv-tab.on,.iv .iv-tab[aria-selected="true"]{border:.5px solid var(--iv-line);background:var(--iv-panel);color:var(--iv-tx);font-weight:600;box-shadow:0 1px 3px color-mix(in srgb,#0b0d12 12%,transparent)}
.iv .iv-tab.on .iv-ico,.iv .iv-tab[aria-selected="true"] .iv-ico{color:var(--iv-tx)}
.iv .iv-tabs .iv-select{height:28px;border-radius:8px;background-color:var(--iv-panel)}
.iv .iv-quick-tabs .iv-btn,.iv .iv-skill-tabs .iv-btn{height:32px;border:0;border-radius:8px;background:transparent;color:var(--iv-tx2);font-size:12.5px;font-weight:600;box-shadow:none}
.iv .iv-quick-tabs .iv-btn:hover:not(:disabled),.iv .iv-skill-tabs .iv-btn:hover:not(:disabled){border-color:transparent;background:transparent;color:var(--iv-tx)}
.iv .iv-quick-tabs .iv-btn--acc,.iv .iv-quick-tabs .iv-btn--acc:hover:not(:disabled),.iv .iv-skill-tabs .iv-btn--acc,.iv .iv-skill-tabs .iv-btn--acc:hover:not(:disabled){height:32px;background:var(--iv-panel);border:0;color:var(--iv-tx);font-size:12.5px;font-weight:600;box-shadow:0 1px 3px color-mix(in srgb,#0b0d12 12%,transparent)}
.iv .iv-btn{height:32px;padding:0 12px;border:1px solid var(--iv-line-2);border-radius:10px;background:var(--iv-panel);color:var(--iv-tx2);font-size:12.5px;font-weight:500;line-height:1.4}
.iv .iv-btn:hover:not(:disabled){border-color:color-mix(in srgb,var(--iv-tx) 28%,transparent);background:var(--iv-panel-2);color:var(--iv-tx)}
.iv .iv-btn:focus-visible{outline:2px solid color-mix(in srgb,var(--iv-solid) 35%,transparent);outline-offset:1px}
.iv .iv-btn:disabled{opacity:.55}
.iv .iv-btn--sm{height:26px;padding:0 9px;font-size:11.5px;border-radius:8px}
.iv .iv-btn--lg{height:42px;padding:0 18px;font-size:14px;border-radius:10px}
.iv .iv-btn--icon{width:32px;padding:0}
.iv .iv-btn--sm.iv-btn--icon{width:26px}
.iv .iv-btn--lg.iv-btn--icon{width:42px}
.iv .iv-btn--acc,.iv .iv-btn--acc:hover:not(:disabled){background:var(--iv-solid);border-color:transparent;color:var(--iv-on-solid);font-size:13px;font-weight:600;box-shadow:0 1px 2px color-mix(in srgb,#0b0d12 18%,transparent)}
.iv .iv-btn--acc:not(.iv-btn--sm):not(.iv-btn--lg){height:38px}
.iv .iv-btn--acc:active:not(:disabled){transform:translateY(1px)}
.iv .iv-btn--acc:disabled{background:var(--iv-panel-3);color:var(--iv-tx3);box-shadow:none}
.iv .iv-btn--acc.iv-btn--busy,.iv .iv-btn--acc.iv-btn--lg.iv-btn--busy{background:var(--iv-solid);color:var(--iv-on-solid);box-shadow:none}
.iv .iv-btn--ghost{border-color:transparent;background:transparent;color:var(--iv-tx3)}
.iv .iv-btn--ghost:hover:not(:disabled){background:var(--iv-acc-soft);color:var(--iv-tx)}
.iv .iv-btn--danger{background:transparent;border-color:color-mix(in srgb,var(--iv-danger) 35%,transparent);color:var(--iv-danger)}
.iv .iv-btn--danger:hover:not(:disabled){background:var(--iv-danger-soft);border-color:var(--iv-danger)}
.iv .iv-input,.iv .iv-select{height:36px;padding:0 12px;border:1px solid var(--iv-line-2);border-radius:10px;background:var(--iv-panel);color:var(--iv-tx);font-size:13px;line-height:1.5}
.iv .iv-input::placeholder{color:var(--iv-tx3);opacity:1}
.iv .iv-input:hover,.iv .iv-select:hover{border-color:color-mix(in srgb,var(--iv-tx) 30%,transparent)}
.iv .iv-input:focus,.iv .iv-select:focus{outline:2px solid color-mix(in srgb,var(--iv-solid) 22%,transparent);border-color:color-mix(in srgb,var(--iv-solid) 55%,transparent)}
.iv .iv-select{background-position:right 12px center}
.iv .iv-select--sm{height:28px;padding:0 28px 0 10px;font-size:12px;border-radius:8px}
.iv .iv-textarea,.iv textarea.iv-input{height:auto;min-height:84px;padding:10px 12px;line-height:1.55;font-size:13px;border-radius:10px}
.iv textarea[style*="border-radius"],.iv input[style*="border-radius"]{border-radius:10px!important}
.iv .iv-check input{accent-color:var(--iv-solid);width:14px;height:14px}
.iv .iv-field-label,.iv .iv-label{font-size:12px;font-weight:600;color:var(--iv-tx2)}
.iv .iv-pane{gap:14px;padding:18px;border:1px solid var(--iv-line);border-radius:16px;background:var(--iv-panel);box-shadow:0 2px 10px color-mix(in srgb,#0b0d12 5%,transparent)}
.iv .iv-pane--quiet{background:var(--iv-surface);box-shadow:none}
.iv .iv-pane-head{gap:10px}
.iv .iv-pane-title{font-size:15px;font-weight:600;letter-spacing:0}
.iv .iv-pane-tile{width:28px;height:28px;border-radius:8px;color:var(--iv-tx2);background:var(--iv-acc-soft);border:1px solid var(--iv-line)}
.iv .iv-sub,.iv .iv-fusion,.iv .iv-prompt-studio,.iv .iv-storyboard,.iv .iv-compose-params,.iv .iv-pipeline-pick,.iv .iv-card{gap:10px;padding:14px;border:1px solid var(--iv-line);border-radius:12px;background:var(--iv-surface)}
.iv .iv-sub-title{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--iv-tx3)}
.iv .iv-card-head strong{font-size:13px;font-weight:600}
.iv .iv-row{gap:10px;padding:8px 10px;border-radius:10px;font-size:13px}
.iv .iv-create-title{font-size:17px;font-weight:650;letter-spacing:0}
.iv .iv-empty{gap:10px;padding:24px 12px}
.iv .iv-empty strong{font-size:16px;font-weight:600;color:var(--iv-tx)}
.iv .iv-empty-tile{width:40px;height:40px;background:var(--iv-acc-soft);border:1px solid var(--iv-line)}
.iv .iv-chip{height:24px;padding:0 10px;font-size:12px;border-radius:999px}
.iv .iv-badge{height:22px;padding:0 9px;font-size:11px;border-radius:999px}
.iv .iv-notice{padding:10px 12px;border-radius:10px;gap:10px;font-size:12.5px}
.iv .iv-flow,.iv .iv-node{border-radius:12px}
.iv .iv-node{box-shadow:0 1px 3px color-mix(in srgb,#0b0d12 6%,transparent)}
.iv .iv-node-head{border-radius:12px 12px 0 0}
.iv .iv-node-head .iv-ico{color:var(--iv-tx2)}
.iv .iv-dock-col{border-radius:18px}
.iv .iv-pane img,.iv .iv-pane video,.iv .iv-pane .iv-asset-thumb{border-radius:10px}
.iv .iv-progress{height:4px;border-radius:999px}
.ivg-mask{
--ivg-acc:var(--iv-solid,var(--dsw-alias-label-primary,currentColor));
--ivg-on-acc:var(--iv-on-solid,var(--dsw-alias-label-primary-foreground,#fff));
font-size:13px;line-height:1.55;
}
.ivg-mask .ivg-modal{border-radius:18px;box-shadow:0 24px 60px color-mix(in srgb,#0b0d12 22%,transparent),0 2px 6px color-mix(in srgb,#0b0d12 8%,transparent)}
.ivg-mask .ivg-title{font-size:17px;font-weight:650;letter-spacing:0}
.ivg-mask .ivg-sub{font-size:12.5px;line-height:1.6}
.ivg-mask .ivg-label,.ivg-mask .ivg-field>span{font-size:12px;font-weight:600;color:var(--ivg-tx-2)}
.ivg-mask .ivg-btn{height:38px;padding:0 14px;border:1px solid var(--ivg-line-2);border-radius:10px;background:var(--ivg-bg);color:var(--ivg-tx);font-size:13px;font-weight:600;box-shadow:none}
.ivg-mask .ivg-btn:hover{background:var(--ivg-bg-2);color:var(--ivg-tx);filter:none}
.ivg-mask .ivg-btn--acc,.ivg-mask .ivg-btn--acc:hover{background:var(--ivg-acc);border-color:transparent;color:var(--ivg-on-acc);filter:none}
.ivg-mask .ivg-btn--sm{height:28px;padding:0 10px;font-size:11.5px;border-radius:8px}
.ivg-mask .ivg-btn--ghost{background:transparent;border-color:transparent;color:var(--ivg-tx-3)}
.ivg-mask .ivg-chip{height:24px;padding:0 10px;font-size:12px;border-radius:999px}
.ivg-mask .ivg-select,.ivg-mask .ivg-field input{height:36px;padding:0 12px;border:1px solid var(--ivg-line-2);border-radius:10px;background:var(--ivg-bg);font-size:13px}
.ivg-mask .ivg-n{width:28px;height:28px;font-size:12px}
.ivg-mask .ivg-step-t{font-size:13.5px;font-weight:600}
.ivg-mask .ivg-step-d,.ivg-mask .ivg-note{font-size:12px;line-height:1.6}
@media (max-width:520px){
.iv .iv-pane{padding:14px;border-radius:14px}
.iv .iv-btn{height:30px}
.iv .iv-btn--acc:not(.iv-btn--sm):not(.iv-btn--lg){height:36px}
.ivg-mask .ivg-modal{padding:18px;border-radius:14px}
}
`

/**
 * 注入主题层样式表（幂等；始终置于 head 末尾以覆盖宿主样式表）。
 * 与 useWorkbenchStyle / useGuideStyle 在同一组件里按调用顺序挂载即可。
 */
export function useModernTheme(): void {
  useEffect(() => {
    const existing = document.getElementById(MODERN_THEME_STYLE_ID)
    const style = existing instanceof HTMLStyleElement ? existing : document.createElement('style')
    if (existing === null) style.id = MODERN_THEME_STYLE_ID
    if (style.textContent !== MODERN_THEME_STYLE) style.textContent = MODERN_THEME_STYLE
    style.dataset.version = MODERN_THEME_VERSION
    document.head.append(style)
  }, [])
}
