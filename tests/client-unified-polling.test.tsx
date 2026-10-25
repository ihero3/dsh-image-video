// @vitest-environment jsdom
/**
 * B1 轮询收敛：三个定时器（导出 2s / 运行 2.5s / 项目 5s）合成一个统一轮询后，
 * 节奏、隐藏暂停、恢复补跳、座位不可见停轮的行为。
 *
 * 用假计时器把"间隔"变成可断言的量：抖动 ±20% 意味着空闲跳间隔 ∈ [4s, 6s]、
 * 活跃跳间隔 ∈ [1.6s, 2.4s]——推进到区间内不动、越过区间必动。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Workbench } from '../src/client/Workbench.tsx'
import {
  POLL_ACTIVE_MS, POLL_IDLE_MS, jitteredInterval,
} from '../src/client/use-unified-poll.ts'
import { cleanup, clientProps, fakeApi, render } from './client-fake-api.ts'
import type { TaskRecord } from '../src/workbench/records.ts'

/** 数一下假宿主被轮询了多少次（项目列表是每一跳都有的动作）。 */
function pollCount(host: ReturnType<typeof fakeApi>): number {
  return host.calls.filter(call => call === 'projects/list').length
}

/** 把 document.hidden 置成指定值并发一次 visibilitychange（停表/恢复都走这个事件）。 */
function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  Object.defineProperty(document, 'hidden', { value: false, configurable: true })
})

describe('B1 unified polling', () => {
  it('jitters the interval within ±20% of the base', () => {
    expect(jitteredInterval(POLL_IDLE_MS, () => 0)).toBe(4000)
    expect(jitteredInterval(POLL_IDLE_MS, () => 1)).toBe(6000)
    expect(jitteredInterval(POLL_IDLE_MS, () => 0.5)).toBe(5000)
    expect(jitteredInterval(POLL_ACTIVE_MS, () => 0)).toBe(1600)
    expect(jitteredInterval(POLL_ACTIVE_MS, () => 1)).toBe(2400)
  })

  it('polls at the idle 5s cadence (jittered) when nothing is running', async () => {
    const host = fakeApi()
    render(<Workbench {...clientProps({ api: host.api })} />)
    await vi.advanceTimersByTimeAsync(0) // 让挂载时的 health/list 落地
    const baseline = pollCount(host)
    expect(baseline).toBeGreaterThan(0)

    // 抖动下界 4s 之前不该有新的一跳
    await vi.advanceTimersByTimeAsync(3900)
    expect(pollCount(host)).toBe(baseline)

    // 越过抖动上界 6s，必有新的一跳
    await vi.advanceTimersByTimeAsync(2300)
    expect(pollCount(host)).toBeGreaterThan(baseline)
  })

  it('polls at the 2s cadence (jittered) while a task is running', async () => {
    const running: TaskRecord = {
      schemaVersion: 1, id: 'tsk-run', kind: 'video', status: 'running', provider: 'threevideo',
      model: 'minimax-h3', createdAt: '2026-10-14T11:00:00.000Z', updatedAt: '2026-10-14T11:00:00.000Z',
    }
    const host = fakeApi({ tasks: [running] })
    render(<Workbench {...clientProps({ api: host.api })} />)
    await vi.advanceTimersByTimeAsync(0)
    const baseline = pollCount(host)

    // 活跃跳抖动下界 1.6s 之前不动
    await vi.advanceTimersByTimeAsync(1500)
    expect(pollCount(host)).toBe(baseline)

    // 越过上界 2.4s 必动
    await vi.advanceTimersByTimeAsync(1000)
    expect(pollCount(host)).toBeGreaterThan(baseline)
  })

  it('sends no requests while the page is hidden, and catches up when visible again', async () => {
    const host = fakeApi()
    render(<Workbench {...clientProps({ api: host.api })} />)
    await vi.advanceTimersByTimeAsync(0)
    const baseline = pollCount(host)

    // 隐藏：停表——半小时也不该有一个请求
    setHidden(true)
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)
    expect(pollCount(host)).toBe(baseline)

    // 恢复可见：立即补跳一次（用户回来看到的就是新数据）
    setHidden(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(pollCount(host)).toBeGreaterThan(baseline)

    // 且重新排表：之后按正常节奏继续
    const afterResume = pollCount(host)
    await vi.advanceTimersByTimeAsync(6200)
    expect(pollCount(host)).toBeGreaterThan(afterResume)
  })

  it('does not poll at all while the seat is invisible', async () => {
    const host = fakeApi()
    render(<Workbench {...clientProps({ api: host.api, visible: false })} />)
    await vi.advanceTimersByTimeAsync(0)
    const baseline = pollCount(host)
    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(pollCount(host)).toBe(baseline)
  })
})
