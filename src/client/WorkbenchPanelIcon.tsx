/**
 * dsh-image-video 左栏入口图标：三视标（石墨灰圆角底 + 三根白条 + 产品蓝三角）。
 *
 * 尺寸由侧栏传入（宽栏 16px、收起时 18px），图形自带底色与配色，不跟随 `currentColor`。
 *
 * 入口**不 import `icons.tsx`**：那个模块同时被惰性加载的界面 chunk 引用，构建器会把它
 * 抽成共享 chunk（`client.icons.js`），入口侧于是出现同步的 `require("./client.icons.js")`；
 * 宿主工厂拿到的 `require` 只查模块表，包内 chunk 不在表里，整条入口激活失败。
 * 所以这枚标就地画：24 视窗，与 `icons.tsx` 的 `BrandMark` 同一份几何。
 */
import type { ReactNode } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * 画入口图标。
 * @param props - 侧栏给的图标份额：请求的边长与是否选中。
 * @returns 图标元素。
 */
export function WorkbenchPanelIcon({ size }: PropsRuntime<'sidebar.panellist'>): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect width="24" height="24" rx="5.6" fill="#31363D" />
      <rect x="6.4" y="4.4" width="7.6" height="2.6" rx="1.3" fill="#FFFFFF" />
      <rect x="6.4" y="9.7" width="7.6" height="2.6" rx="1.3" fill="#FFFFFF" />
      <rect x="6.4" y="15" width="7.6" height="2.6" rx="1.3" fill="#FFFFFF" />
      <path d="M16.8 7.4 22 12l-5.2 4.6z" fill="#2F6FED" />
    </svg>
  )
}
