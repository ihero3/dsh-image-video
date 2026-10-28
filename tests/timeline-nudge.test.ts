/**
 * 时间轴手柄键盘微调（R6-3 / WCAG 2.1 SC 2.1.1）。
 *
 * 这里只测纯函数：按键 → 毫秒增量。真正"按下方向键片段变长"的集成断言在
 * `client-timeline-keyboard.test.tsx`。分成两层是因为边界规则（最短时长、模型上限、
 * 轨道末端）全部集中在 `nudgeDeltaForKey` + `resizeClip*`，纯函数测得住就不必在
 * DOM 里反复试边界。
 */
import { describe, expect, it } from 'vitest'
import {
  formatTimecode, KEYBOARD_NUDGE_MS, KEYBOARD_NUDGE_MS_FAST, MIN_CLIP_MS,
  nudgeDeltaForKey, resizeClipLeft, resizeClipRight,
} from '../src/client/timeline-math.ts'
import { MAX_CLIP_DURATION_MS } from '../src/workbench/timeline.ts'

const CLIP = { startMs: 1000, durationMs: 3000 }
const TOTAL = 10_000

describe('nudgeDeltaForKey', () => {
  it('方向键走 100ms，Shift 走 1s', () => {
    expect(nudgeDeltaForKey('ArrowRight', false, CLIP, TOTAL, 'left')).toBe(KEYBOARD_NUDGE_MS)
    expect(nudgeDeltaForKey('ArrowLeft', false, CLIP, TOTAL, 'right')).toBe(-KEYBOARD_NUDGE_MS)
    expect(nudgeDeltaForKey('ArrowRight', true, CLIP, TOTAL, 'left')).toBe(KEYBOARD_NUDGE_MS_FAST)
    expect(nudgeDeltaForKey('ArrowLeft', true, CLIP, TOTAL, 'right')).toBe(-KEYBOARD_NUDGE_MS_FAST)
  })

  it('上下方向键等价于左右（垂直方向也接受，符合 splitter 惯例）', () => {
    expect(nudgeDeltaForKey('ArrowUp', false, CLIP, TOTAL, 'left')).toBe(KEYBOARD_NUDGE_MS)
    expect(nudgeDeltaForKey('ArrowDown', false, CLIP, TOTAL, 'left')).toBe(-KEYBOARD_NUDGE_MS)
  })

  it('Home 把左手柄推到 0、右手柄收到最短时长', () => {
    // 左：delta = -startMs
    expect(nudgeDeltaForKey('Home', false, CLIP, TOTAL, 'left')).toBe(-1000)
    const left = resizeClipLeft(CLIP, nudgeDeltaForKey('Home', false, CLIP, TOTAL, 'left')!)
    expect(left).toEqual({ startMs: 0, durationMs: 4000 })

    // 右：delta = MIN - duration
    const right = resizeClipRight(CLIP, nudgeDeltaForKey('Home', false, CLIP, TOTAL, 'right')!)
    expect(right).toEqual({ startMs: 1000, durationMs: MIN_CLIP_MS })
  })

  it('End 把左手柄压到最短时长、右手柄拉到上限或轨道末端', () => {
    // 左：delta = duration - MIN，结果 duration 恰为最短
    const left = resizeClipLeft(CLIP, nudgeDeltaForKey('End', false, CLIP, TOTAL, 'left')!)
    expect(left.durationMs).toBe(MIN_CLIP_MS)
    expect(left.startMs).toBe(1000 + 3000 - MIN_CLIP_MS)

    // 右：total(10000) - start(1000) = 9000，未超上限
    const right = resizeClipRight(CLIP, nudgeDeltaForKey('End', false, CLIP, TOTAL, 'right')!)
    expect(right.durationMs).toBe(Math.min(MAX_CLIP_DURATION_MS, 9000))
  })

  it('右手柄 End 不会越过轨道末端', () => {
    const nearEnd = { startMs: 9000, durationMs: 500 }
    const right = resizeClipRight(nearEnd, nudgeDeltaForKey('End', false, nearEnd, TOTAL, 'right')!)
    expect(right.startMs + right.durationMs).toBeLessThanOrEqual(TOTAL)
  })

  it('不认识的按键返回 undefined（调用方据此决定不 preventDefault）', () => {
    expect(nudgeDeltaForKey('a', false, CLIP, TOTAL, 'left')).toBeUndefined()
    expect(nudgeDeltaForKey('Escape', false, CLIP, TOTAL, 'left')).toBeUndefined()
    expect(nudgeDeltaForKey('Tab', false, CLIP, TOTAL, 'left')).toBeUndefined()
  })

  it('已经在边界上时增量为 0（左右都压不动）', () => {
    const pinnedLeft = { startMs: 0, durationMs: 4000 }
    expect(nudgeDeltaForKey('Home', false, pinnedLeft, TOTAL, 'left')).toBe(-0)
    const result = resizeClipLeft(pinnedLeft, nudgeDeltaForKey('Home', false, pinnedLeft, TOTAL, 'left')!)
    expect(result.startMs).toBe(0)
    expect(result.durationMs).toBe(4000)
  })
})

describe('formatTimecode', () => {
  it('按 m:ss.d 输出，读屏念得出来', () => {
    expect(formatTimecode(0)).toBe('0:00.0')
    expect(formatTimecode(1234)).toBe('0:01.2')
    expect(formatTimecode(65_432)).toBe('1:05.4')
    expect(formatTimecode(60_000)).toBe('1:00.0')
    expect(formatTimecode(600_000)).toBe('10:00.0')
  })

  it('负数夹到 0（手柄算出负增量时不该念出 -0:00.1）', () => {
    expect(formatTimecode(-500)).toBe('0:00.0')
  })
})
