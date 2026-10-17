/**
 * 工作台图标集：16px 基准的描边图标（`currentColor` 继承文字颜色）。
 *
 * 客户端产物由 `window.__ModuleLoader__` 以 JS 载入，不经过 Harness 的 CSS 打包链，
 * 所以图标与样式都走「内嵌 + 挂载时注入」的同一条路（见 `workbench-style.ts`）。
 * 全部图形为 24 视窗、1.8 描边、圆角线帽，保证与小字号（11–12px）搭配时清晰。
 */
import type { ReactNode } from 'react';
/** 图标名（与 `STROKE` / `SHAPES` 的键一致）。 */
export type IconName = 'bolt' | 'flow' | 'film' | 'folder' | 'plus' | 'refresh' | 'trash' | 'check' | 'alert' | 'x' | 'download' | 'sliders' | 'image' | 'video' | 'clock' | 'layers' | 'eye' | 'user' | 'play' | 'filter' | 'upload' | 'link' | 'box' | 'script' | 'storyboard' | 'input' | 'subtitle' | 'music' | 'motion' | 'sparkles' | 'tag' | 'search' | 'copy' | 'pause' | 'pencil' | 'chevron';
/** 图标组件的对外属性。 */
export interface IconProps {
    /** 图标名。 */
    name: IconName;
    /** 像素边长（默认 14，与 11–12px 正文搭配）。 */
    size?: number;
    /** 附加类名（如步骤箭头 `iv-step-arrow`）。 */
    className?: string;
}
/**
 * 渲染一个图标。
 * @param props - 图标名、尺寸与附加类名。
 * @returns 内联 SVG（对辅助技术隐藏，颜色随文字）。
 */
export declare function Icon({ name, size, className }: IconProps): ReactNode;
/** 品牌标（填充三角，放在渐变底标里用）。 */
export declare function BrandMark({ size }: {
    size?: number;
}): ReactNode;
