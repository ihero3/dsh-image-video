/**
 * 浮层定位（R6-3）：把"放哪、多高、是否翻转"从 CSS 里拿出来，变成可单测的纯函数。
 *
 * 为什么必须抽出来：jsdom 没有排版引擎，`getBoundingClientRect` 全是 0，
 * 靠在集成测试里断言"弹层没被裁"永远测不出来。抽成纯函数后，边界情形
 * （下方空间不足 / 两边都不足 / 比视口还宽）都能用数字直接验证。
 *
 * 现状与约束：
 * - 默认值弹层目前用 `position:absolute` + `container:iv-defaults/inline-size` +
 *   `width:min(560px,100%)` 定位，宽度基准是**锚点容器宽度**；一旦 portal 到别处，
 *   `100%` 与 `@container` 都会失效——届时用它算出的 `width` 以内联样式注入。
 * - 本文件只算几何，不碰 DOM、不决定 portal 目标。
 */

/** 视口内的矩形（与 `DOMRect` 同名字段对齐，便于直接传）。 */
export interface Rect {
  readonly top: number
  readonly left: number
  readonly right: number
  readonly bottom: number
}

/** 浮层期望尺寸。 */
export interface PanelSize {
  readonly width: number
  readonly height: number
}

/** 可视区尺寸。 */
export interface ViewportSize {
  readonly width: number
  readonly height: number
}

/** 计算结果：相对视口的定位与可用尺寸。 */
export interface Placement {
  /** 放在锚点下方还是上方。 */
  readonly side: 'below' | 'above'
  /** 左边界（px，相对视口）。 */
  readonly left: number
  /** 上边界（px，相对视口）。 */
  readonly top: number
  /** 最终宽度（已按视口夹紧）。 */
  readonly width: number
  /** 最终高度上限（空间不足时会被压缩，浮层自己负责 `overflow:auto`）。 */
  readonly maxHeight: number
  /** 贴的是锚点左边缘还是右边缘。 */
  readonly align: 'start' | 'end'
}

/** 浮层与锚点之间的缝隙（px）。 */
export const OVERLAY_GAP = 6
/** 浮层与视口边缘的最小留白（px）。 */
export const OVERLAY_MARGIN = 8

/**
 * 计算浮层放置。
 *
 * 规则（按优先级）：
 * 1. 宽度先夹到 `视口宽 - 2×留白`，再按 `align` 贴锚点左/右边缘，最后夹进视口；
 * 2. 默认向下；下方放不下且上方更宽裕时才翻转向上；
 * 3. 两边都放不下时选空间大的一侧，并压缩 `maxHeight`（浮层内部滚动）。
 *
 * @param anchor - 锚点矩形。
 * @param panel - 浮层期望尺寸。
 * @param viewport - 可视区尺寸。
 * @param prefer - 优先方向，默认 `below`。
 * @param align - 贴锚点哪一侧，默认 `end`（右对齐，与默认值弹层现状一致）。
 * @returns 定位结果。
 */
export function placeOverlay(
  anchor: Rect,
  panel: PanelSize,
  viewport: ViewportSize,
  prefer: 'below' | 'above' = 'below',
  align: 'start' | 'end' = 'end',
): Placement {
  const width = Math.max(0, Math.min(panel.width, viewport.width - OVERLAY_MARGIN * 2))

  const spaceBelow = viewport.height - anchor.bottom - OVERLAY_GAP - OVERLAY_MARGIN
  const spaceAbove = anchor.top - OVERLAY_GAP - OVERLAY_MARGIN

  let side: Placement['side'] = prefer
  // 优先方向放得下就不折腾；放不下时才看另一侧
  if (prefer === 'below' && spaceBelow < panel.height && spaceAbove > spaceBelow) side = 'above'
  if (prefer === 'above' && spaceAbove < panel.height && spaceBelow > spaceAbove) side = 'below'

  const maxHeight = Math.max(0, Math.min(panel.height, side === 'below' ? spaceBelow : spaceAbove))

  const rawLeft = align === 'end' ? anchor.right - width : anchor.left
  const left = Math.min(
    Math.max(OVERLAY_MARGIN, rawLeft),
    Math.max(OVERLAY_MARGIN, viewport.width - width - OVERLAY_MARGIN),
  )

  // above 时按"压缩后的高度"贴上去，否则顶部会被挤出视口
  const renderedHeight = Math.min(panel.height, maxHeight)
  const top = side === 'below'
    ? anchor.bottom + OVERLAY_GAP
    : Math.max(OVERLAY_MARGIN, anchor.top - OVERLAY_GAP - renderedHeight)

  return { side, left, top, width, maxHeight, align }
}
