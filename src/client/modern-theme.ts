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
export const MODERN_THEME_VERSION = '2026-11-27.4'

/** 主题层样式表：令牌 + 控件 + 容器 + 引导层，布局规则（grid / flex / 定位）一律不动。 */
export const MODERN_THEME_STYLE = `
.iv{
--iv-fs-root:13px;--iv-fs-body:12.5px;--iv-fs-strong:13px;--iv-fs-title:15px;--iv-fs-lead:17px;
--iv-fs-metric:20px;--iv-fs-meta:12px;--iv-fs-micro:11px;--iv-fs-tick:10px;
--iv-r:10px;--iv-r-xs:6px;--iv-r-sm:8px;--iv-r-lg:14px;--iv-r-xl:18px;
--iv-sp-1:3px;--iv-sp-2:6px;--iv-sp-3:8px;--iv-sp-4:10px;--iv-sp-5:14px;--iv-sp-6:18px;
--iv-acc:var(--iv-solid);--iv-acc-deep:var(--iv-solid-hover);--iv-on-acc:var(--iv-on-solid);
--iv-acc-soft:color-mix(in srgb,var(--iv-tx) 6%,transparent);
--iv-info:var(--dsw-alias-button-info-fill,#4176e6);
--iv-shadow-2:0 8px 24px color-mix(in srgb,#0b0d12 14%,transparent);
--iv-shadow-3:0 18px 46px color-mix(in srgb,#0b0d12 18%,transparent),0 2px 8px color-mix(in srgb,#0b0d12 8%,transparent);
font-size:var(--iv-fs-root);line-height:1.55;
}
.iv .iv-top{padding:8px 14px 0;gap:4px 10px;align-items:center}
.iv .iv-brand{gap:9px}
.iv .iv-brand-name{font-size:14px;font-weight:650;letter-spacing:0}
.iv .iv-brand-sub{font-size:10px;letter-spacing:.06em;color:var(--iv-tx3)}
.iv .iv-top-sep{height:16px}
.iv .iv-top-sep--stacked{display:none}
.iv .iv-proj,.iv .iv-episode{gap:5px}
.iv .iv-proj>.iv-micro,.iv .iv-episode>.iv-micro{font-size:11px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--iv-tx3)}
.iv .iv-top .iv-select{height:30px;padding:0 26px 0 9px;border-color:transparent;background-color:transparent;font-size:12.5px;font-weight:500;color:var(--iv-tx2)}
.iv .iv-top .iv-select:hover{border-color:var(--iv-line-2);background-color:var(--iv-panel-2);color:var(--iv-tx)}
.iv .iv-top .iv-select:focus{border-color:var(--iv-solid);background-color:var(--iv-panel);color:var(--iv-tx)}
.iv .iv-top .iv-input{height:30px;font-size:12.5px}
.iv .iv-newform .iv-input{width:104px}
.iv .iv-newform{margin-left:3px;padding-left:9px;border-left:1px solid var(--iv-line)}
.iv .iv-newform .iv-btn{height:30px}
.iv .iv-proj>.iv-btn--icon:not(.iv-btn--danger),.iv .iv-episode>.iv-btn--icon:not(.iv-btn--danger){color:var(--iv-tx3);opacity:.72}
.iv .iv-proj:hover>.iv-btn--icon:not(.iv-btn--danger),.iv .iv-episode:hover>.iv-btn--icon:not(.iv-btn--danger){opacity:1;color:var(--iv-tx2)}
.iv .iv-top-end{display:flex;align-items:center;gap:2px;margin-left:auto;flex:none}
.iv .iv-top-tools{border-left:1px solid var(--iv-line);padding-left:8px;margin-left:2px}
.iv .iv-modes{flex:1 0 100%;justify-content:flex-start;gap:2px;margin-top:4px;padding:0;border-radius:0;border-top:1px solid var(--iv-line);background:transparent}
.iv .iv-modes-btn{position:relative;height:32px;padding:0 12px;gap:6px;border-radius:8px 8px 0 0;font-size:13px;font-weight:500;color:var(--iv-tx3);background:transparent}
.iv .iv-modes-btn:hover{color:var(--iv-tx);background:color-mix(in srgb,var(--iv-tx) 4%,transparent)}
.iv .iv-modes-btn.on{background:color-mix(in srgb,var(--iv-tx) 5%,transparent);color:var(--iv-tx);font-weight:650;box-shadow:none}
.iv .iv-modes-btn.on .iv-ico{color:var(--iv-acc)}
.iv .iv-modes-btn.on::after{content:'';position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:2px 2px 0 0;background:var(--iv-acc)}
@container iv-panel (max-width:1400px){.iv .iv-brand-sub{display:none}}
@container iv-panel (max-width:1320px){.iv .iv-proj>.iv-micro,.iv .iv-episode>.iv-micro{display:none}}
@container iv-panel (max-width:1180px){.iv .iv-top .iv-select{max-width:128px!important}.iv .iv-newform .iv-input{width:82px}}
@container iv-panel (max-width:1060px){.iv .iv-episode .iv-btn-txt{display:none}}
@container iv-panel (max-width:560px){.iv .iv-brand-text{display:none}.iv .iv-top .iv-select{max-width:104px!important}}
@container iv-panel (max-width:460px){.iv .iv-modes-txt{display:none}.iv .iv-tools-txt{display:none}.iv .iv-modes-btn{padding:0 11px}}
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
.iv .iv-episode-script{display:flex;flex-direction:column;gap:8px}
.iv .iv-episode-script-head{display:flex;align-items:center;gap:8px;justify-content:flex-end}
.iv .iv-episode-script-editor{min-height:180px;line-height:1.7;font-size:13px}
.iv .iv-seg-prompt-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}
.iv .iv-seg-prompt-row--with-refs{grid-template-columns:minmax(0,1fr) clamp(180px,28%,300px)}
.iv .iv-seg-ref-side{display:flex;flex-direction:column;gap:6px;align-items:stretch;min-width:0}
.iv .iv-seg-prompt-row .iv-ref-pop{margin-left:0;align-self:start}
.iv .iv-seg-refs-block{display:flex;flex-direction:column;gap:6px;min-width:0}
.iv .iv-seg-ref-side .iv-seg-refs-block{width:100%}
.iv .iv-seg-ref-side .iv-ref-list{margin-top:0;max-height:200px}
.iv .iv-shot-prompt-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}
.iv .iv-shot-prompt-row--with-refs{grid-template-columns:minmax(0,1fr) clamp(180px,28%,300px)}
.iv .iv-shot-prompt-main{display:flex;flex-direction:column;gap:4px;min-width:0}
/* 提示词 label 不能被 .iv-sb-field 的 flex:1 1 150px 在高度轴上撑开：输入框与模型行之间会留一大片空白 */
.iv .iv-shot-prompt-main>.iv-sb-field{flex:0 0 auto}
/* 生成图片行紧贴图片提示词；再往下到视频提示词留足间隔，避免两组操作挤在一起 */
.iv .iv-shot-prompt-main>.iv-shot-tool-row+.iv-sb-field{margin-top:8px}
/* 分镜提示词只有 2 行，去掉通用 textarea 的 84px 最小高度带来的内部空白 */
.iv .iv-shot-prompt-main textarea.iv-input{min-height:56px}
.iv .iv-shot-tool-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.iv .iv-shot-tool-row .iv-meta{flex:none}
.iv .iv-shot-tool-row .iv-input{flex:0 1 150px;width:auto}
.iv .iv-shot-prompt-row .iv-ref-pop{margin-left:0;align-self:start}
.iv .iv-sb-segment-head{margin-top:var(--iv-sp-6)}
.iv .iv-btn--action{height:34px;padding:0 14px;border-radius:10px;font-size:12.5px;font-weight:600;box-shadow:0 1px 3px color-mix(in srgb,#0b0d12 10%,transparent);transition:background .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease,transform .16s ease}
.iv .iv-btn--action--primary{background:var(--iv-solid);border-color:transparent;color:var(--iv-on-solid)}
.iv .iv-btn--action--soft{background:var(--iv-panel-2);border-color:var(--iv-line-2);color:var(--iv-tx)}
/* 生图 / 生视频主操作：悬停要有明确反馈（提亮 + 微抬 + 加深阴影），按下回落 */
.iv .iv-btn--action--primary:hover:not(:disabled){background:var(--iv-solid-hover);box-shadow:0 4px 12px color-mix(in srgb,var(--iv-solid) 34%,transparent);transform:translateY(-1px)}
.iv .iv-btn--action--soft:hover:not(:disabled){background:var(--iv-acc-soft);border-color:var(--iv-acc);color:var(--iv-acc);box-shadow:0 3px 9px color-mix(in srgb,var(--iv-acc) 18%,transparent);transform:translateY(-1px)}
.iv .iv-btn--action:hover:not(:disabled){filter:brightness(1.04)}
.iv .iv-btn--action:active:not(:disabled){transform:translateY(0);box-shadow:0 1px 2px color-mix(in srgb,#0b0d12 12%,transparent)}
@media (prefers-reduced-motion:reduce){.iv .iv-btn--action{transition:none}.iv .iv-btn--action:hover:not(:disabled),.iv .iv-btn--action:active:not(:disabled){transform:none}}
.iv .iv-def--select{gap:6px}
.iv .iv-def--select select{height:28px;max-width:190px}
/* 生效参数条是信息条，不是表单：入口与文本模型下拉都压到 24px，三页顶栏才不会被它撑高 */
.iv .iv-defaults-actions .iv-btn{height:24px;padding:0 8px;font-size:var(--iv-fs-meta)}
.iv .iv-defaults-actions .iv-btn--ghost{color:var(--iv-tx2)}
.iv .iv-defaults .iv-def--select select{height:24px;max-width:160px}
.iv .iv-ref-chip{display:flex;align-items:center;gap:6px}
.iv .iv-ref-thumb-button{display:inline-flex;padding:0;border:1px solid var(--iv-line);border-radius:var(--iv-r-xs);background:var(--iv-panel-3);cursor:zoom-in;overflow:hidden;flex:none}
.iv .iv-ref-thumb-button .iv-ref-picker-thumb{width:34px;height:24px;border-radius:0}
.iv .iv-ref-thumb-button:hover{border-color:var(--iv-acc);box-shadow:0 0 0 2px var(--iv-acc-soft)}
.iv .iv-ref-picker-preview:hover{border-color:var(--iv-line-2)}
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
/* 本集已选：整行不折行（否则删除按钮掉到第二行）；名称吃掉剩余宽度，分类框固定宽 */
.iv .iv-episode-refs .iv-row{flex-wrap:nowrap;padding-block:11px}
.iv .iv-episode-refs .iv-row .iv-row-main{flex:1 1 auto;min-width:0}
.iv .iv-episode-refs .iv-row .iv-select{flex:none;width:76px;min-width:76px}
.iv .iv-episode-refs .iv-row .iv-row-actions{flex:none}
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
.iv .iv-pane--compact{gap:var(--iv-sp-5);padding:var(--iv-sp-6)}
.iv .iv-quick-tabs--minor{display:flex;align-items:center;gap:var(--iv-sp-1);margin-left:auto;padding:var(--iv-sp-1);border-radius:999px;background:color-mix(in srgb,var(--iv-tx) 5%,transparent)}
.iv .iv-quick-tabs--minor .iv-btn{height:24px;padding:0 var(--iv-sp-3);border:0;border-radius:999px;background:transparent;box-shadow:none;font-size:var(--iv-fs-meta);font-weight:var(--iv-fw-regular);color:var(--iv-tx3)}
.iv .iv-quick-tabs--minor .iv-btn .iv-ico{flex:none;margin-right:var(--iv-sp-1);opacity:.85}
.iv .iv-quick-tabs--minor .iv-btn:hover:not(:disabled){background:transparent;border-color:transparent;color:var(--iv-tx)}
.iv .iv-quick-tabs--minor .iv-btn.is-active,.iv .iv-quick-tabs--minor .iv-btn[aria-selected="true"]{color:var(--iv-tx);background:var(--iv-panel);border-color:transparent;font-weight:var(--iv-fw-medium);box-shadow:0 1px 2px color-mix(in srgb,#0b0d12 5%,transparent)}
.iv .iv-quick-tabs--minor .iv-btn.is-active .iv-ico,.iv .iv-quick-tabs--minor .iv-btn[aria-selected="true"] .iv-ico{color:var(--iv-acc);opacity:1}
.iv .iv-modules--quick,.iv .iv-module--quick{padding-top:0;border-top:0;gap:0}
.iv .iv-module--quick .iv-module-body{gap:0}
.iv .iv-quick-create{display:flex;flex-direction:column;gap:var(--iv-sp-5);min-width:0}
.iv .iv-create-tabs{display:flex;gap:var(--iv-sp-2);padding:var(--iv-sp-2);border-radius:var(--iv-r);background:color-mix(in srgb,var(--iv-tx) 5%,transparent)}
.iv .iv-create-tabs .iv-btn{flex:1 1 0;min-width:0;height:32px;padding:0 var(--iv-sp-4);border:0;border-radius:var(--iv-r-sm);background:transparent;color:var(--iv-tx2);font-size:12.5px;font-weight:var(--iv-fw-medium);box-shadow:none}
.iv .iv-create-tabs .iv-btn.iv-btn--acc{height:32px;border:0;background:transparent;color:var(--iv-tx2);font-size:12.5px;font-weight:var(--iv-fw-medium);box-shadow:none}
.iv .iv-create-tabs .iv-btn:hover:not(:disabled),.iv .iv-create-tabs .iv-btn--acc:hover:not(:disabled){border-color:transparent;background:transparent;color:var(--iv-tx)}
.iv .iv-create-tabs .iv-btn[aria-selected="true"],.iv .iv-create-tabs .iv-btn--acc[aria-selected="true"]:hover:not(:disabled){background:var(--iv-panel);border:0;color:var(--iv-tx);font-weight:var(--iv-fw-bold);box-shadow:0 1px 3px color-mix(in srgb,#0b0d12 12%,transparent)}
.iv .iv-create-tabs .iv-btn .iv-ico{margin-right:var(--iv-sp-2)}
.iv .iv-qc-field{display:flex;flex-direction:column;gap:var(--iv-sp-2);min-width:0}
.iv .iv-qc-field-head{display:flex;align-items:center;justify-content:space-between;gap:var(--iv-sp-2);min-width:0}
.iv .iv-qc-field-actions{display:flex;align-items:center;gap:var(--iv-sp-2);flex:none}
.iv .iv-qc-field-label{font-size:12px;font-weight:var(--iv-fw-medium);color:var(--iv-tx2);letter-spacing:0}
.iv .iv-qc-field-hint{font-size:var(--iv-fs-micro);font-weight:var(--iv-fw-regular);color:var(--iv-tx3)}
/* 字段说明不跟着栏宽铺满整行：横向贯穿会读成一整条横幅，按内容宽度收口 */
.iv .iv-qc-field>.iv-qc-field-hint{align-self:flex-start;max-width:56ch;line-height:1.5}
.iv .iv-ref-zone{display:flex;flex-direction:column;gap:var(--iv-sp-3);padding:var(--iv-sp-3);border:1px solid var(--iv-line);border-radius:var(--iv-r);background:color-mix(in srgb,var(--iv-tx) 2%,transparent)}
.iv .iv-ref-zone[data-ref-dropzone="true"]{border:1px dashed var(--iv-acc);background:var(--iv-acc-soft)}
.iv .iv-ref-empty-hint{font-size:var(--iv-fs-micro);color:var(--iv-tx3)}
.iv .iv-ref-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,120px));justify-content:start;gap:var(--iv-sp-2)}
.iv .iv-ref-cell{position:relative;aspect-ratio:4/3;min-width:0;border:1px solid var(--iv-line-2);border-radius:var(--iv-r-sm);background:var(--iv-panel-3);overflow:hidden;cursor:grab;transition:border-color var(--iv-dur-2) ease,box-shadow var(--iv-dur-2) ease}
.iv .iv-ref-cell:hover{border-color:color-mix(in srgb,var(--iv-tx) 32%,transparent)}
.iv .iv-ref-cell:active{cursor:grabbing}
.iv .iv-ref-cell[data-ref-drop="true"]{border-color:var(--iv-acc);background:var(--iv-acc-soft)}
.iv .iv-ref-cell--base{border-color:var(--iv-acc);box-shadow:0 0 0 2px color-mix(in srgb,var(--iv-acc) 20%,transparent)}
.iv .iv-ref-thumb-wrap{display:block;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:zoom-in}
.iv .iv-ref-cell .iv-ref-thumb{width:100%;height:100%;border-radius:0;object-fit:cover}
.iv .iv-ref-base-badge{position:absolute;left:var(--iv-sp-2);bottom:var(--iv-sp-2);padding:1px var(--iv-sp-2);border-radius:var(--iv-r-xs);background:var(--iv-acc);color:var(--iv-on-acc);font-size:var(--iv-fs-tick);font-weight:var(--iv-fw-medium);line-height:1.4;pointer-events:none}
.iv .iv-ref-remove{position:absolute;top:var(--iv-sp-2);right:var(--iv-sp-2);width:20px;height:20px;padding:0;border:0;border-radius:var(--iv-r-xs);background:color-mix(in srgb,#0b0d12 55%,transparent);color:#fff;display:flex;align-items:center;justify-content:center;opacity:0;cursor:pointer;transition:opacity var(--iv-dur-2) ease}
.iv .iv-ref-cell:hover .iv-ref-remove,.iv .iv-ref-remove:focus-visible{opacity:1}
.iv .iv-ref-add-cell{aspect-ratio:4/3;min-width:0}
.iv .iv-ref-add-cell .iv-pick{height:100%}
.iv .iv-ref-add-cell .iv-pick>.iv-btn{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--iv-sp-2);padding:0;border:1px dashed var(--iv-line-2);border-radius:var(--iv-r-sm);background:transparent;color:var(--iv-tx3);font-size:var(--iv-fs-micro)}
.iv .iv-ref-add-cell .iv-pick>.iv-btn:hover:not(:disabled){border-color:var(--iv-acc);color:var(--iv-acc);background:var(--iv-acc-soft)}
.iv .iv-ref-add-cell .iv-pick>.iv-btn .iv-ico{margin-right:0}
.iv .iv-advanced{border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-surface);overflow:hidden}
.iv .iv-advanced-head{display:flex;align-items:center;gap:var(--iv-sp-2);padding:var(--iv-sp-3) var(--iv-sp-4);cursor:pointer;list-style:none;font-size:12.5px;font-weight:var(--iv-fw-medium);color:var(--iv-tx2)}
.iv .iv-advanced-head::-webkit-details-marker{display:none}
.iv .iv-advanced-head:hover{color:var(--iv-tx);background:color-mix(in srgb,var(--iv-tx) 4%,transparent)}
.iv .iv-advanced-title{flex:none;color:var(--iv-tx)}
.iv .iv-advanced-defaults{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--iv-fs-micro);font-weight:var(--iv-fw-regular);color:var(--iv-tx3)}
.iv .iv-advanced-caret{flex:none;margin-left:auto;transition:transform var(--iv-dur-2) ease}
.iv details.iv-advanced[open] .iv-advanced-caret{transform:rotate(90deg)}
.iv .iv-disclosure{border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-surface);overflow:hidden}
.iv .iv-disclosure>summary{display:flex;align-items:center;gap:var(--iv-sp-2);padding:var(--iv-sp-3) var(--iv-sp-4);cursor:pointer;list-style:none;font-size:12.5px;font-weight:var(--iv-fw-medium);color:var(--iv-tx2)}
.iv .iv-disclosure>summary::-webkit-details-marker{display:none}
.iv .iv-disclosure>summary:hover{color:var(--iv-tx);background:color-mix(in srgb,var(--iv-tx) 4%,transparent)}
.iv .iv-disclosure-body{padding:var(--iv-sp-3) var(--iv-sp-4);border-top:1px solid var(--iv-line)}
.iv .iv-disclosure .iv-caret{flex:none;margin-left:auto;transition:transform var(--iv-dur-2) ease}
.iv details.iv-disclosure[open]>.iv-disclosure-head .iv-caret,.iv details.iv-disclosure[open]>.iv-disclosure-summary .iv-caret{transform:rotate(90deg)}
.iv .iv-advanced-body{padding:var(--iv-sp-3) var(--iv-sp-4) var(--iv-sp-4);border-top:1px solid var(--iv-line)}
.iv .iv-advanced-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--iv-sp-3)}
.iv .iv-qc-field--wide{grid-column:1/-1}
.iv .iv-advanced .iv-compose-params{padding:0;border:0;border-radius:0;background:transparent;gap:var(--iv-sp-3)}
.iv .iv-gen-actions{position:relative;display:flex;align-items:center;padding-top:var(--iv-sp-5)}
.iv .iv-gen-separator{position:absolute;top:0;left:0;right:0;height:1px;background:var(--iv-line)}
.iv .iv-gen-actions .iv-gen-btn{width:100%;flex:1 1 auto;padding-right:calc(var(--iv-sp-6) * 4)}
.iv .iv-gen-shortcut{position:absolute;right:var(--iv-sp-5);top:calc(50% + var(--iv-sp-3));transform:translateY(-50%);font-size:var(--iv-fs-tick);font-weight:var(--iv-fw-regular);letter-spacing:.02em;color:var(--iv-tx3);pointer-events:none}
.iv .iv-gen-actions .iv-gen-btn.iv-btn--acc+.iv-gen-shortcut{color:color-mix(in srgb,var(--iv-on-acc) 72%,transparent)}
/* 结果展示按素材自身比例走：固定方形 + cover 会把横图/竖图裁掉一截 */
.iv .iv-last-result-media{width:auto;height:auto;max-width:min(200px,100%);max-height:160px;object-fit:contain;background:var(--iv-monitor)}
/* 预览舞台不再钉死 320px：小图按自身尺寸，大图在 420px 内完整收进来 */
.iv .iv-dock-preview{height:auto;min-height:160px;max-height:min(52vh,420px)}
.iv .iv-dock .iv-dock-preview img,.iv .iv-dock .iv-dock-preview video{width:auto;height:auto;max-width:100%;max-height:min(52vh,420px);object-fit:contain}
.iv .iv-dock .iv-dock-preview--expanded img,.iv .iv-dock .iv-dock-preview--expanded video{width:100%;height:100%;max-width:100%;max-height:100%}
.iv .iv-dock-preview--expanded{min-height:0;max-height:none}
.iv .iv-preview-video-thumb{height:auto;min-height:160px;aspect-ratio:16/9}
.iv .iv-preview-video-thumb video{width:100%;height:100%;object-fit:cover}
/* 首帧 / 尾帧 / 参考视频槽位：19px 徽章胶囊塞不下可辨认的缩略图，会被压成一条横杠 */
.iv .iv-slot-row{min-height:48px;gap:var(--iv-sp-2) var(--iv-sp-4)}
.iv .iv-slot-row>.iv-meta:first-child{flex:none;min-width:64px;color:var(--iv-tx2)}
.iv .iv-slot-row .iv-chip{height:auto;max-width:min(440px,100%);padding:var(--iv-sp-1);gap:var(--iv-sp-3);border-radius:var(--iv-r-sm)}
.iv .iv-slot-row .iv-ref-open{max-width:100%;padding:0;gap:var(--iv-sp-3)}
.iv .iv-slot-row .iv-ref-thumb{width:64px;height:40px;flex:none;border-radius:var(--iv-r-xs);object-fit:contain;background:var(--iv-monitor)}
.iv .iv-slot-row .iv-ellipsis{max-width:220px;font-size:var(--iv-fs-meta)}
@media (max-width:768px){.iv .iv-advanced-grid{grid-template-columns:minmax(0,1fr)}}
@media (prefers-reduced-motion:reduce){.iv .iv-ref-cell,.iv .iv-ref-remove,.iv .iv-advanced-caret,.iv .iv-disclosure .iv-caret{transition:none}}
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
/* 模板市场浮层（D2）：挂在 pane 头下方、覆盖画布右上，打开时画布高度不变 */
.iv .iv-wf-runstate{display:inline-flex;align-items:center;gap:var(--iv-sp-2);font-size:var(--iv-fs-micro);color:var(--iv-tx2);white-space:nowrap}
.iv .iv-wf-runstate[data-workflow-run-status="running"] .iv-dot{color:var(--iv-info)}
.iv .iv-wf-runstate[data-workflow-run-status="succeeded"] .iv-dot{color:var(--iv-ok)}
.iv .iv-wf-runstate[data-workflow-run-status="failed"] .iv-dot{color:var(--iv-danger)}
.iv .iv-flow-hint,.iv .iv-wf-onboard-hint{color:var(--iv-tx2)}
.iv .iv-wf-onboard .iv-btn--sm{border-color:var(--iv-solid);color:var(--iv-tx)}
.iv .iv-pane--canvas>.iv-pane-head{position:relative}
.iv .iv-tpl.iv-wf-drawer{position:absolute;top:calc(100% + 6px);right:0;z-index:var(--iv-z-tip);width:min(560px,92%);max-height:60vh;overflow:auto;padding:var(--iv-sp-4);border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-surface);box-shadow:var(--iv-shadow-3)}

/* 片段条瘦身：只留「在哪 / 多长 / 是什么 / 手柄」，参数全部移到检查器 */
.iv .iv-pane[data-workbench-pane="paneTimeline"] .iv-clip{padding:2px 20px 2px 8px;justify-content:center;overflow:hidden}
.iv .iv-clip-thumb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:1;pointer-events:none}
.iv .iv-clip-thumb-wrap{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.iv .iv-clip-thumb-wrap::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,color-mix(in srgb,#000 62%,transparent),color-mix(in srgb,#000 18%,transparent))}
.iv .iv-clip-top{position:relative;z-index:1;color:#fff;text-shadow:0 1px 3px color-mix(in srgb,#000 90%,transparent)}
.iv .iv-clip-dur,.iv .iv-clip-top .iv-ico{color:#fff}
.iv .iv-clip:focus-visible{outline:2px solid var(--iv-solid);outline-offset:1px}
/* 分割按钮：默认半透明可见（触屏无 hover，不能靠碰运气发现） */
.iv .iv-clip-split{position:absolute;right:2px;bottom:2px;z-index:2;display:inline-flex;align-items:center;justify-content:center;
  width:22px;height:22px;padding:0;border:0;border-radius:var(--iv-r-xs);
  background:color-mix(in srgb,var(--iv-panel) 70%,transparent);color:var(--iv-tx2);cursor:pointer;opacity:.55;
  transition:opacity var(--iv-dur-1)}
.iv .iv-clip:hover .iv-clip-split,.iv .iv-clip:focus-within .iv-clip-split{opacity:1}
.iv .iv-clip-split:hover{color:var(--iv-tx)}
.iv .iv-clip-split:disabled{opacity:.25;cursor:not-allowed}
@media (pointer:coarse){.iv .iv-clip-split{opacity:1;width:32px;height:32px}}

/* 片段检查器：常驻轨道下方，参数按「标签 + 控件」成组折行 */
.iv .iv-clip-ins{display:flex;flex-direction:column;gap:var(--iv-sp-2);padding:var(--iv-sp-3);
  border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel-2)}
.iv .iv-clip-ins-head{display:flex;align-items:center;gap:var(--iv-sp-2);min-width:0}
.iv .iv-clip-ins-title{flex:0 1 auto;min-width:0;font-size:var(--iv-fs-meta);font-weight:var(--iv-fw-medium);color:var(--iv-tx2)}
.iv .iv-clip-ins-hint{flex:none;padding:0 6px;border-radius:999px;font-size:var(--iv-fs-micro);color:var(--iv-tx3);
  border:1px dashed var(--iv-line-2)}
.iv .iv-clip-ins-actions{display:flex;gap:var(--iv-sp-2);margin-left:auto}
.iv .iv-clip-ins-actions .iv-btn{width:26px;height:26px;padding:0;justify-content:center}
.iv .iv-clip-ins-grid{display:flex;flex-wrap:wrap;align-items:flex-end;gap:var(--iv-sp-2) var(--iv-sp-3)}
.iv .iv-clip-ins-field{display:flex;flex-direction:column;gap:2px;min-width:0}
.iv .iv-clip-ins-field>span{font-size:var(--iv-fs-micro);color:var(--iv-tx3)}
.iv .iv-clip-ins-field .iv-input,
.iv .iv-clip-ins-field .iv-select{height:26px;width:78px;font-size:var(--iv-fs-meta);padding:0 6px}
.iv .iv-clip-ins-field .iv-select{width:104px}
.iv .iv-clip-ins-field--tight .iv-input{width:64px}
.iv .iv-clip-ins-field .iv-color{width:44px;height:26px;padding:1px 2px}
.iv .iv-clip-ins-empty{margin:0;padding:var(--iv-sp-3);border:1px dashed var(--iv-line-2);border-radius:var(--iv-r)}

/* === 时间轴精剪 === */
/* 根为弹性列，监视器是唯一可伸缩项：「监视器 + 轨道同屏」由布局保证，不靠 magic number */
.iv .iv-pane[data-workbench-pane="paneTimeline"]{display:flex;flex-direction:column;gap:var(--iv-sp-3);min-height:0;flex:1 1 auto}
/* ffmpeg 降为 pane 头色点：正常只看点，异常才展开路径与修复指引 */
.iv .iv-tl-ffmpeg{position:relative;display:inline-flex}
.iv .iv-tl-ffmpeg>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:var(--iv-sp-2)}
.iv .iv-tl-ffmpeg>summary::-webkit-details-marker{display:none}
.iv .iv-tl-ffmpeg-body{position:absolute;right:0;top:calc(100% + 6px);z-index:var(--iv-z-tip);display:flex;flex-direction:column;
  gap:var(--iv-sp-2);width:min(420px,86vw);padding:var(--iv-sp-3);border:1px solid var(--iv-line);border-radius:var(--iv-r);
  background:var(--iv-panel);box-shadow:var(--iv-shadow-2)}
.iv .iv-tl-ffmpeg-body .iv-meta{white-space:normal;word-break:break-all}
/* 监视器吃余量；媒体跟随容器，不再被 200px 上限卡出大片留白 */
.iv .iv-pane[data-workbench-pane="paneTimeline"] .iv-monitor{flex:1 1 auto;min-height:140px;max-height:clamp(160px,calc(100dvh - 520px),420px)}
.iv .iv-monitor img,.iv .iv-monitor video{max-height:100%;width:auto;object-fit:contain}
/* 导出条：常驻轨道下方；参数与开关同一行，导出中参数语义禁用（不只透明） */
.iv .iv-tl{overflow-x:auto;overflow-y:hidden}
.iv .iv-ruler,.iv .iv-tracks{width:calc(100% * var(--iv-tl-zoom,1));min-width:100%}
.iv .iv-tl-export{border-top:1px solid var(--iv-line);padding-top:var(--iv-sp-3);align-items:center}
.iv .iv-tl-export .iv-tl-params{display:flex;align-items:center;gap:var(--iv-sp-3);flex-wrap:wrap;min-width:0}
.iv .iv-tl-export[data-timeline-export-busy="true"] .iv-tl-params{opacity:.6}
/* 导出规格预览（B2）：档位换算结果的当场凭证，只读、等宽数字、不抢主按钮 */
.iv .iv-tl-spec{display:inline-flex;align-items:baseline;gap:6px;padding:3px 9px;flex:none;
  border:1px solid var(--iv-line);border-radius:var(--iv-r-pill);background:var(--iv-panel-3);
  color:var(--iv-tx2);font-size:var(--iv-fs-micro);font-variant-numeric:tabular-nums;white-space:nowrap}
.iv .iv-tl-spec b{font-weight:650;color:var(--iv-tx)}
.iv .iv-tl-spec i{font-style:normal;opacity:.8}
/* 辅助工具：逐段预览 / 配音 / 多比例，默认收起；展开不改主区高度预算 */
.iv .iv-tl-aux{border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-surface);overflow:hidden}
.iv .iv-tl-aux>summary{display:flex;align-items:center;gap:var(--iv-sp-2);padding:var(--iv-sp-3) var(--iv-sp-4);cursor:pointer;list-style:none;font-size:var(--iv-fs-meta);color:var(--iv-tx2)}
.iv .iv-tl-aux>summary::-webkit-details-marker{display:none}
.iv .iv-tl-aux>summary .iv-caret{margin-left:auto;transition:transform var(--iv-dur-2) ease}
.iv .iv-tl-aux[open]>summary .iv-caret{transform:rotate(90deg)}
.iv .iv-tl-aux-body{display:flex;flex-direction:column;gap:var(--iv-sp-3);padding:var(--iv-sp-3) var(--iv-sp-4);border-top:1px solid var(--iv-line)}
.iv .iv-tl-aux-role{color:var(--iv-tx2);font-size:var(--iv-fs-micro)}
.iv .iv-seg-preview{background:var(--iv-panel-2)}
.iv .iv-clip-ins-more{border:0;border-top:1px solid var(--iv-line);border-radius:0;background:transparent;margin-top:var(--iv-sp-2)}
.iv .iv-clip-ins-more>summary{padding:var(--iv-sp-2) 0;font-size:var(--iv-fs-micro)}
.iv .iv-monitor .iv-meta{color:var(--iv-tx2)}
.iv .iv-ruler b:last-child{transform:translateX(-100%)}
/* 剧本生成页：分区头、设置摘要、溢出菜单与折叠区（复用 iv-disclosure 基类） */
.iv .iv-pane[data-workbench-pane="paneScript"] .iv-pane-head .iv-quick-tabs{margin-left:auto}
.iv .iv-sc-io{display:flex;flex-direction:column;gap:var(--iv-sp-3)}
.iv .iv-sc-io .iv-textarea{resize:vertical;min-height:96px}
.iv .iv-sc-settings{border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-surface);overflow:hidden}
.iv .iv-sc-settings-head{display:flex;align-items:center;gap:var(--iv-sp-2);padding:var(--iv-sp-3) var(--iv-sp-4);font-size:12.5px;font-weight:var(--iv-fw-medium);color:var(--iv-tx2)}
.iv .iv-sc-settings-head .iv-advanced-defaults{color:var(--iv-tx2)}
.iv .iv-sc-settings .iv-plan-row{padding:var(--iv-sp-3) var(--iv-sp-4);border-top:1px solid var(--iv-line)}
.iv .iv-sc-num{width:80px}
.iv .iv-sc-generate{min-width:132px}
/* 剧本页步进条：三步（写剧本 → 分段 → 分镜）的真实进度。
   它同时负责**收敛主按钮**——只有轮到的那一步是实心主色，另外两个降为柔色。 */
.iv .iv-steps{display:flex;align-items:center;flex-wrap:wrap;gap:2px;padding:6px;margin-bottom:var(--iv-sp-3);
  border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel-2)}
.iv .iv-steps-item{display:inline-flex;align-items:center;gap:2px}
.iv .iv-step-sep{padding:0 2px;color:var(--iv-tx3);font-size:12px}
.iv .iv-step{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px 0 5px;border:1px solid transparent;
  border-radius:999px;background:transparent;color:var(--iv-tx2);font-size:12px;font-weight:500;cursor:pointer;
  transition:background .15s ease,color .15s ease,border-color .15s ease}
.iv .iv-step:hover{background:color-mix(in srgb,var(--iv-tx) 6%,transparent);color:var(--iv-tx)}
.iv .iv-step-idx{display:inline-grid;place-items:center;width:17px;height:17px;border-radius:50%;
  background:color-mix(in srgb,var(--iv-tx) 9%,transparent);color:var(--iv-tx2);
  font-size:10px;font-weight:700;font-variant-numeric:tabular-nums}
.iv .iv-step--done .iv-step-idx{background:color-mix(in srgb,var(--iv-ok) 20%,transparent);color:var(--iv-ok)}
.iv .iv-step--now{border-color:color-mix(in srgb,var(--iv-acc) 36%,transparent);background:var(--iv-acc-soft);
  color:var(--iv-acc);font-weight:600}
.iv .iv-step--now:hover{background:color-mix(in srgb,var(--iv-acc) 17%,transparent);color:var(--iv-acc)}
.iv .iv-step--now .iv-step-idx{background:var(--iv-acc);color:var(--iv-on-acc)}
.iv .iv-step-tag{padding:0 5px;border-radius:4px;background:var(--iv-acc);color:var(--iv-on-acc);
  font-size:9.5px;font-weight:700;line-height:14px;letter-spacing:.02em}
.iv .iv-steps-hint{margin-left:auto;min-width:0;padding:0 6px 0 10px;color:var(--iv-tx2);font-size:11.5px;line-height:1.4}
/* 点按步进条滚动到这里时留一点余量，别贴住上一条边界 */
.iv #script-step-pipeline,.iv #script-step-segments,.iv #script-step-storyboard{scroll-margin-top:8px}
@container iv-panel (max-width:780px){.iv .iv-steps-hint{margin-left:0;flex-basis:100%;padding:3px 6px 1px}}
@media (prefers-reduced-motion:reduce){.iv .iv-step{transition:none}}
.iv .iv-sc-divider{display:flex;align-items:center;gap:var(--iv-sp-3);margin:var(--iv-sp-4) 0 var(--iv-sp-3);color:var(--iv-tx2);font-size:var(--iv-fs-micro);font-weight:var(--iv-fw-medium)}
.iv .iv-sc-divider::after{content:"";flex:1;height:1px;background:var(--iv-line)}
.iv .iv-sc-more{position:relative;display:inline-flex}
.iv .iv-sc-more>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:var(--iv-r-sm);border:1px solid var(--iv-line-2);color:var(--iv-tx2)}
.iv .iv-sc-more>summary::-webkit-details-marker{display:none}
.iv .iv-sc-more[open]>summary{border-color:var(--iv-line);background:var(--iv-panel-2)}
.iv .iv-sc-more-body{position:absolute;right:0;top:calc(100% + 6px);z-index:var(--iv-z-tip);display:flex;flex-direction:column;gap:2px;min-width:132px;padding:4px;border:1px solid var(--iv-line);border-radius:var(--iv-r);background:var(--iv-panel);box-shadow:var(--iv-shadow-2)}
.iv .iv-sc-more-body .iv-btn{justify-content:flex-start;width:100%}
.iv .iv-sc-script .iv-sc-adv-body,.iv .iv-sc-script>.iv-disclosure-body{max-height:40vh;overflow:auto}
.iv .iv-sc-sum{font-size:var(--iv-fs-micro);color:var(--iv-tx2);white-space:nowrap}
.iv .iv-sc-sum-text{flex:1;min-width:0;font-size:var(--iv-fs-meta);color:var(--iv-tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv .iv-sc-caret{flex:none;transition:transform var(--iv-dur-2) ease}
.iv .iv-sb-seg-head--clickable{min-height:32px}
.iv .iv-sb-seg-head--clickable:hover{background:color-mix(in srgb,var(--iv-tx) 4%,transparent)}
@container iv-panel (max-width:560px){
.iv .iv-pane[data-workbench-pane="paneScript"] .iv-pane-head{flex-wrap:wrap}
.iv .iv-pane[data-workbench-pane="paneScript"] .iv-pane-head .iv-tab{padding:0 8px}
}
@media (pointer:coarse){
.iv .iv-sc-more>summary,.iv .iv-sc-more-body .iv-btn{min-width:44px;min-height:44px}
.iv .iv-sb-seg-head--clickable{min-height:44px}
}
@media (prefers-reduced-motion:reduce){.iv .iv-sc-caret{transition:none}}
@media (max-height:640px){
.iv .iv-pane[data-workbench-pane="paneTimeline"] .iv-monitor{min-height:96px;max-height:160px}
.iv .iv-clips{height:38px}
}
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
