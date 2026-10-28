/**
 * 浮层定位纯函数（R6-3）。
 *
 * 这些用例替代的是"在浏览器里把弹层拖到各种边角看有没有被裁"——那种验证无法进 CI、
 * 也无法回归。这里用数字把四种边界钉死：下方不足翻转、两边都不足压缩、
 * 比视口还宽、贴左右边夹紧。
 */
import { describe, expect, it } from 'vitest'
import { OVERLAY_GAP, OVERLAY_MARGIN, placeOverlay } from '../src/client/overlay-position.ts'

const VIEWPORT = { width: 420, height: 700 }
const PANEL = { width: 360, height: 300 }

describe('placeOverlay', () => {
  it('空间充足时放在下方，右对齐锚点', () => {
    const anchor = { top: 40, left: 20, right: 400, bottom: 60 }
    const placement = placeOverlay(anchor, PANEL, VIEWPORT)
    expect(placement.side).toBe('below')
    expect(placement.top).toBe(60 + OVERLAY_GAP)
    expect(placement.left).toBe(400 - 360)
    expect(placement.width).toBe(360)
    expect(placement.maxHeight).toBe(300)
  })

  it('下方空间不足且上方更宽裕时翻转向上，且顶边不出视口', () => {
    // 锚点在底部：下方只剩 40px
    const anchor = { top: 600, left: 20, right: 400, bottom: 660 }
    const placement = placeOverlay(anchor, PANEL, VIEWPORT)
    expect(placement.side).toBe('above')
    expect(placement.top).toBeGreaterThanOrEqual(OVERLAY_MARGIN)
    expect(placement.top + Math.min(PANEL.height, placement.maxHeight)).toBeLessThanOrEqual(anchor.top)
  })

  it('上下都不够时选空间大的一侧，并压缩高度', () => {
    const tinyViewport = { width: 420, height: 260 }
    const anchor = { top: 120, left: 20, right: 400, bottom: 140 }
    const placement = placeOverlay(anchor, { width: 360, height: 400 }, tinyViewport)
    const spaceBelow = tinyViewport.height - 140 - OVERLAY_GAP - OVERLAY_MARGIN
    const spaceAbove = 120 - OVERLAY_GAP - OVERLAY_MARGIN
    expect(placement.side).toBe(spaceBelow >= spaceAbove ? 'below' : 'above')
    expect(placement.maxHeight).toBeLessThan(400)
    expect(placement.maxHeight).toBe(Math.max(0, Math.max(spaceBelow, spaceAbove)))
  })

  it('面板比视口还宽时，宽度收到视口内并留出边距', () => {
    const anchor = { top: 10, left: 0, right: 420, bottom: 30 }
    const placement = placeOverlay(anchor, { width: 900, height: 200 }, VIEWPORT)
    expect(placement.width).toBe(VIEWPORT.width - OVERLAY_MARGIN * 2)
    expect(placement.left).toBeGreaterThanOrEqual(OVERLAY_MARGIN)
    expect(placement.left + placement.width).toBeLessThanOrEqual(VIEWPORT.width - OVERLAY_MARGIN)
  })

  it('锚点贴左边时不会被推到视口外（左对齐也一样）', () => {
    const anchor = { top: 10, left: 2, right: 40, bottom: 30 }
    const endAligned = placeOverlay(anchor, PANEL, VIEWPORT)
    const startAligned = placeOverlay(anchor, PANEL, VIEWPORT, 'below', 'start')
    for (const placement of [endAligned, startAligned]) {
      expect(placement.left).toBeGreaterThanOrEqual(OVERLAY_MARGIN)
      expect(placement.left + placement.width).toBeLessThanOrEqual(VIEWPORT.width - OVERLAY_MARGIN)
    }
  })

  it('可以强制优先向上（给"工具栏在底部"的场景用）', () => {
    const anchor = { top: 200, left: 20, right: 400, bottom: 220 }
    const placement = placeOverlay(anchor, { width: 200, height: 120 }, VIEWPORT, 'above')
    expect(placement.side).toBe('above')
    expect(placement.top).toBe(200 - OVERLAY_GAP - 120)
  })
})
