/**
 * 输出目录保留策略（Track A / A15）：最旧优先清理、受保护文件不动、至少保留最新 N 个、可预演。
 */
import { describe, expect, it } from 'vitest'
import { planRetention, type RetentionFile } from '../src/media/retention.ts'

const file = (name: string, bytes: number, mtimeMs: number): RetentionFile => ({ name, bytes, mtimeMs })
const files: RetentionFile[] = [
  file('newest.mp4', 100, 5000),
  file('mid.mp4', 100, 4000),
  file('old.mp4', 100, 3000),
  file('older.mp4', 100, 2000),
  file('oldest.mp4', 100, 1000),
]

describe('planRetention (A15)', () => {
  it('removes the oldest first until the file-count cap is met', () => {
    const plan = planRetention(files, { maxFiles: 3, keepNewest: 0 })
    expect(plan.removed.map(entry => entry.name)).toEqual(['oldest.mp4', 'older.mp4'])
    expect(plan.keptFiles).toBe(3)
    expect(plan.freedBytes).toBe(200)
    expect(plan.overQuota).toBe(false)
  })

  it('never removes protected files or the newest N', () => {
    const plan = planRetention(files, { maxFiles: 1, keepNewest: 2, protect: ['older.mp4'] })
    // 最新两个保留；older 受保护；能删的都删（oldest、old），但仍超上限 → overQuota
    expect(plan.removed.map(entry => entry.name)).toEqual(['oldest.mp4', 'old.mp4'])
    expect(plan.overQuota).toBe(true) // 3 个 > 1 个，但不硬删保护对象
  })

  it('respects a byte cap', () => {
    const plan = planRetention(files, { maxBytes: 250, keepNewest: 0 })
    expect(plan.keptBytes).toBeLessThanOrEqual(250)
    expect(plan.removed.length).toBeGreaterThanOrEqual(3)
  })

  it('does nothing when the directory is under both caps', () => {
    const plan = planRetention(files, { maxFiles: 10, maxBytes: 10_000 })
    expect(plan.removed).toEqual([])
    expect(plan.overQuota).toBe(false)
    expect(plan.keptFiles).toBe(5)
  })
})
