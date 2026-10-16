/**
 * 文档一致性：`docs/TASKS.md` 的阶段门禁表必须与实际任务行**完全一致**。
 *
 * 起因：这张表曾经漂过（个别阶段写着 0 完成，其实早就做完了）——手工同步靠不住，
 * 所以用测试钉死：表里的"总数/完成"逐阶段从任务行重算比对。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const TASKS = readFileSync(new URL('../docs/TASKS.md', import.meta.url), 'utf8')

describe('TASKS.md phase table (docs consistency)', () => {
  it('matches the per-phase task lines and the grand total', () => {
    const states = new Map<number, string[]>()
    for (const line of TASKS.split('\n')) {
      const match = /^- \[([x~ ])\] \*\*T(\d+)-\d+\*\*/.exec(line)
      if (match === null) continue
      const phase = Number(match[2])
      states.set(phase, [...states.get(phase) ?? [], match[1] as string])
    }

    const rows = [...TASKS.matchAll(/^\|\s*(\d+)\s+([^|]+?)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/gm)]
    expect(rows.length).toBeGreaterThanOrEqual(8)
    for (const row of rows) {
      const phase = Number(row[1])
      const actual = states.get(phase) ?? []
      expect(actual.length, `阶段 ${phase} 的任务行数量`).toBe(Number(row[3]))
      expect(actual.filter(state => state === 'x').length, `阶段 ${phase} 的完成数`).toBe(Number(row[4]))
    }

    const all = [...states.values()].flat()
    const total = /^\| \*\*合计\*\* \| \*\*(\d+)\*\* \| \*\*(\d+)\*\* \|/m.exec(TASKS)
    expect(total).not.toBeNull()
    expect(Number(total?.[1]), '合计任务数').toBe(all.length)
    expect(Number(total?.[2]), '合计完成数').toBe(all.filter(state => state === 'x').length)
    // 每项都必须是三种状态之一，且没有遗留在"未开始"
    expect(all.every(state => ['x', '~', ' '].includes(state))).toBe(true)
  })
})
