/**
 * 诊断与可观测（Track A / A9）：有界环形缓冲 + 快照语义。
 * 隐私约束：不记录提示词/路径，只记录来源、机器码与一句话。
 */
import { describe, expect, it } from 'vitest'
import { DiagnosticsCollector } from '../src/host/diagnostics.ts'

const fixedNow = () => new Date('2026-10-18T00:00:00.000Z')

describe('DiagnosticsCollector (A9)', () => {
  it('keeps a bounded ring of the newest errors', () => {
    const collector = new DiagnosticsCollector({ now: fixedNow })
    for (let index = 0; index < 60; index += 1) collector.recordError('runner', `失败 ${index}`)
    const snapshot = collector.snapshot()
    expect(snapshot.errors).toHaveLength(50)
    expect(snapshot.errorCount).toBe(60)
    // 最新在前
    expect(snapshot.errors[0]?.message).toBe('失败 59')
    expect(snapshot.errors[49]?.message).toBe('失败 10')
  })

  it('truncates long messages and keeps the machine code', () => {
    const collector = new DiagnosticsCollector({ now: fixedNow })
    collector.recordError('render', 'x'.repeat(500), 'MEDIA_DISK_FULL')
    const error = collector.snapshot().errors[0]!
    expect(error.code).toBe('MEDIA_DISK_FULL')
    expect(error.message.length).toBeLessThanOrEqual(301)
    expect(error.at).toBe('2026-10-18T00:00:00.000Z')
  })
})
