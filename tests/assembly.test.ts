/**
 * 宿主装配的纯函数（Track A / A140）。
 */
import { describe, expect, it } from 'vitest'
import { normalizePresetId, parseRetentionPolicy, summarizePreflight } from '../src/host/assembly.ts'

describe('parseRetentionPolicy (A140)', () => {
  it('returns undefined when nothing is configured (no nagging)', () => {
    expect(parseRetentionPolicy({})).toBeUndefined()
    expect(parseRetentionPolicy({ DSH_OUTPUT_MAX_FILES: '', DSH_OUTPUT_MAX_GB: 'abc' })).toBeUndefined()
  })

  it('parses file and GB limits independently', () => {
    expect(parseRetentionPolicy({ DSH_OUTPUT_MAX_FILES: '200' })).toEqual({ maxFiles: 200 })
    expect(parseRetentionPolicy({ DSH_OUTPUT_MAX_GB: '5' })).toEqual({ maxBytes: 5 * 1024 ** 3 })
    expect(parseRetentionPolicy({ DSH_OUTPUT_MAX_FILES: '50', DSH_OUTPUT_MAX_GB: '1.5' })).toEqual({
      maxFiles: 50, maxBytes: 1.5 * 1024 ** 3,
    })
  })
})

describe('normalizePresetId (A140)', () => {
  it('trims and rejects blank values', () => {
    expect(normalizePresetId(undefined)).toBeUndefined()
    expect(normalizePresetId('   ')).toBeUndefined()
    expect(normalizePresetId(' douyin-vertical ')).toBe('douyin-vertical')
  })
})

describe('summarizePreflight (A140)', () => {
  it('says exportable when nothing blocks', () => {
    const line = summarizePreflight({ blockingIssues: 0, humanBytes: '120 MB', humanPredicted: '2 分 15 秒', unusedAssets: 0 })
    expect(line).toContain('可以导出')
    expect(line).toContain('约 120 MB')
    expect(line).toContain('导出预计 2 分 15 秒')
    expect(line).toContain('素材都在用')
  })

  it('warns about blocking issues and unused assets', () => {
    const line = summarizePreflight({
      blockingIssues: 2, humanBytes: '80 MB', humanPredicted: '45 秒', unusedAssets: 3, unusedBytes: '88 MB',
    })
    expect(line).toContain('暂不建议导出（2 个问题要先处理）')
    expect(line).toContain('3 个素材从未使用')
    expect(line).toContain('可选清理 88 MB')
  })
})
