/**
 * 已用时秒表（`F3` 生成进度）：给一个开始时间戳，每秒推一次渲染。
 *
 * 单独成模块是为了可单测：进度条没有百分比时，界面只能显示"生成中 · 12s"，
 * 这个秒表就是那句话的数据源。`startedAt` 为 `undefined` 时停表（没有在飞的生成）。
 */

import { useEffect, useState } from 'react'

/**
 * 从开始时间戳算已用时（整秒），每秒钟推一次。
 * @param startedAt - 开始的毫秒时间戳；`undefined` 表示没有在跑的任务。
 * @returns 已用时秒数；没有在跑的任务时为 `undefined`。
 */
export function useElapsedSeconds(startedAt: number | undefined): number | undefined {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt === undefined) return
    // 切任务时立刻校正一次，避免显示上一个任务的残留
    setNow(Date.now())
    const timer = setInterval(() => { setNow(Date.now()) }, 1000)
    return () => { clearInterval(timer) }
  }, [startedAt])
  if (startedAt === undefined) return undefined
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}
