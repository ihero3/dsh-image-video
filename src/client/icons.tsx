/**
 * 工作台图标集：16px 基准的描边图标（`currentColor` 继承文字颜色）。
 *
 * 客户端产物由 `window.__ModuleLoader__` 以 JS 载入，不经过 Harness 的 CSS 打包链，
 * 所以图标与样式都走「内嵌 + 挂载时注入」的同一条路（见 `workbench-style.ts`）。
 * 全部图形为 24 视窗、1.8 描边、圆角线帽，保证与小字号（11–12px）搭配时清晰。
 */
import type { ReactNode } from 'react'

/** 图标名（与 `STROKE` / `SHAPES` 的键一致）。 */
export type IconName =
  | 'bolt' | 'flow' | 'film' | 'folder' | 'plus' | 'refresh' | 'trash' | 'check'
  | 'alert' | 'x' | 'download' | 'sliders' | 'image' | 'video' | 'clock' | 'layers'
  | 'eye' | 'user' | 'play' | 'filter' | 'upload' | 'link' | 'box' | 'script'
  | 'storyboard' | 'input' | 'subtitle' | 'music' | 'motion' | 'sparkles' | 'tag'
  | 'search' | 'copy' | 'pause' | 'pencil' | 'chevron' | 'undo' | 'redo' | 'clipboard' | 'help'

/** 单路径图标：一个 `d` 讲完（圆用小圆弧拼）；多元素图形见 {@link SHAPES}。 */
const STROKE: Partial<Record<IconName, string>> = {
  bolt: 'M13 2 3 14h7l-1 8 11-14h-7l1-8z',
  film: 'M3.5 5h17v14h-17zM8 5v14M16 5v14M3.5 9.5h4.5M3.5 14.5h4.5M16 9.5h4.5M16 14.5h4.5',
  folder: 'M3.5 8A1.5 1.5 0 0 1 5 6.5h4l2 2h8A1.5 1.5 0 0 1 20.5 10v7a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17z',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20.5 12a8.5 8.5 0 1 1-2.6-6.1M20.5 3.5V9h-5.5',
  trash: 'M4.5 7h15M10 7V5.2A1.2 1.2 0 0 1 11.2 4h1.6A1.2 1.2 0 0 1 14 5.2V7M6.2 7l.8 12.2A1.3 1.3 0 0 0 8.3 20.5h7.4a1.3 1.3 0 0 0 1.3-1.3L17.8 7M10.2 10.8v6M13.8 10.8v6',
  check: 'M4.8 12.6 9.8 17.6 19.2 6.8',
  alert: 'M12 3.8 2.6 20.2h18.8zM12 9.6v4.6M12 17.4v.2',
  x: 'M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8',
  download: 'M12 3.5v11M7.6 10 12 14.4 16.4 10M4.5 19.5h15',
  image: 'M4 5h16v14H4zM8.6 10.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8M20.4 15.6 15 10.2 7 18.2',
  video: 'M3.6 6.4h10.8a1 1 0 0 1 1 1v9.2a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1V7.4a1 1 0 0 1 1-1zM15.4 10.6 20.4 8v8l-5-2.6z',
  clock: 'M12 7.4V12l3.4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  layers: 'M12 3 3 7.4l9 4.4 9-4.4zM3 12.4 12 16.8l9-4.4M3 17 12 21.4 21 17',
  eye: 'M2.6 12S6.1 5.6 12 5.6 21.4 12 21.4 12 17.9 18.4 12 18.4 2.6 12 2.6 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  user: 'M12 11.6a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.2 20.4a7.8 7.8 0 0 1 15.6 0',
  play: 'M8.2 5.4 19 12 8.2 18.6z',
  filter: 'M3.6 5.4h16.8l-6.4 7.8v5.2l-4 1.8v-7z',
  upload: 'M12 19.6V5M6.6 10.4 12 5l5.4 5.4M4.6 21h14.8',
  link: 'M9.6 14.4 14.4 9.6M7.8 11.8 6 13.6a3.6 3.6 0 0 0 5.1 5.1l1.8-1.8M16.2 12.2 18 10.4a3.6 3.6 0 0 0-5.1-5.1l-1.8 1.8',
  box: 'M12 3 21 7.4v9.2L12 21 3 16.6V7.4zM3 7.4 12 11.8l9-4.4M12 11.8V21',
  script: 'M6.4 3.4h8.2l4 4v13.2H6.4zM14.6 3.4v4h4M9.4 12.4h5.2M9.4 16.4h5.2',
  storyboard: 'M3.6 4.4h16.8v5.2H3.6zM3.6 12.4h7.2v7.2H3.6zM13.2 12.4h7.2v7.2h-7.2z',
  input: 'M3.6 6.4h16.8v11.2H3.6zM7.6 10.6h8.8M7.6 14h5',
  subtitle: 'M3.6 5.4h16.8v13.2H3.6zM7 15h6M14.6 15h2.4',
  music: 'M9 17.6V5.8l10-2.6v11.6M6 17.6a3 3 0 1 0 6 0 3 3 0 0 0-6 0M16 14.8a3 3 0 1 0 6 0 3 3 0 0 0-6 0z',
  motion: 'M3 16.4c2-8.4 4-8.4 6 0s4 8.4 6 0 4-8.4 6 0',
  sparkles: 'M11.6 3.8 13.3 8 17.6 9.8 13.3 11.6 11.6 15.8 9.9 11.6 5.6 9.8 9.9 8zM18.4 15.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  tag: 'M4 4.6h6.6l9 9-6.6 6.6-9-9zM7.4 8.4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  search: 'M10.6 17a6.4 6.4 0 1 0 0-12.8 6.4 6.4 0 0 0 0 12.8M15.4 15.4 20 20',
  copy: 'M8.6 8.6h10v10h-10zM5.4 15.4v-10h10',
  pause: 'M8.6 5v14M15.4 5v14',
  pencil: 'M4.6 19.4l.8-3.6L16.2 5a1.7 1.7 0 0 1 2.4 0l.4.4a1.7 1.7 0 0 1 0 2.4L8 18.6z',
  chevron: 'M9.5 5.5 16 12l-6.5 6.5',
  undo: 'M4 9h9.5a4.5 4.5 0 0 1 0 9H10M8 5 4 9l4 4',
  redo: 'M20 9h-9.5a4.5 4.5 0 0 0 0 9H14M16 5l4 4-4 4',
  clipboard: 'M9.5 4.5h5v2.2h-5zM7 6.2h10V20H7zM10.2 11h3.6M10.2 14.4h3.6',
  help: 'M12 3.6a8.4 8.4 0 1 0 8.4 8.4A8.4 8.4 0 0 0 12 3.6zM9.7 9.4a2.4 2.4 0 1 1 3.2 2.2c-.6.3-.9.8-.9 1.5v.3M12 16.6v.2',
}

/** 多元素图标（矩形/圆等无法用一个 `d` 表达的图形）。 */
const SHAPES: Partial<Record<IconName, ReactNode>> = {
  flow: (
    <>
      <rect x="3" y="3" width="7" height="6" rx="1.6" />
      <rect x="14" y="15" width="7" height="6" rx="1.6" />
      <path d="M6.5 9v2.6a2 2 0 0 0 2 2h9" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h8M16 7h4M4 17h4M12 17h8" />
      <circle cx="14" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
}

/** 图标组件的对外属性。 */
export interface IconProps {
  /** 图标名。 */
  name: IconName
  /** 像素边长（默认 14，与 11–12px 正文搭配）。 */
  size?: number
  /** 附加类名（如步骤箭头 `iv-step-arrow`）。 */
  className?: string
}

/**
 * 渲染一个图标。
 * @param props - 图标名、尺寸与附加类名。
 * @returns 内联 SVG（对辅助技术隐藏，颜色随文字）。
 */
export function Icon({ name, size = 14, className }: IconProps): ReactNode {
  const d: string | undefined = STROKE[name]
  return (
    <svg
      className={className === undefined ? 'iv-ico' : `iv-ico ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {d === undefined ? SHAPES[name] : <path d={d} />}
    </svg>
  )
}

/** 品牌标（填充三角，放在渐变底标里用）。 */
export function BrandMark({ size = 14 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8.6 5.2 19 12 8.6 18.8z" />
    </svg>
  )
}
