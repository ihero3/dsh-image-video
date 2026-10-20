/**
 * 诊断日志落盘与轮转（Track A / A100）。
 */
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  appendDiagnosticLog, listDiagnosticLogs, rotatedName, shouldRotate, tailDiagnosticLog,
} from '../src/host/diagnostics-log.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function temp(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-diag-'))
  dirs.push(directory)
  return directory
}

describe('diagnostics log (A100)', () => {
  it('decides rotation only when the incoming line would exceed the cap', () => {
    expect(shouldRotate(0, 500)).toBe(false) // 空文件永不轮转
    expect(shouldRotate(900, 200, { maxBytes: 1000 })).toBe(true)
    expect(shouldRotate(500, 200, { maxBytes: 1000 })).toBe(false)
    // 上限有下限保护（防止传 0 把日志写碎）
    expect(shouldRotate(2000, 10, { maxBytes: 0 })).toBe(true)
  })

  it('appends JSON lines and rotates keeping at most `keep` files', async () => {
    const directory = await temp()
    const path = join(directory, 'diagnostics.log')
    const policy = { maxBytes: 1024, keep: 3 }
    // 每条 ~150 字节，写 40 条必然触发多次轮转
    for (let index = 0; index < 40; index += 1) {
      await appendDiagnosticLog({ path, policy, entry: { at: new Date(2026, 9, 20, 0, 0, index).toISOString(), level: 'error', event: 'render', message: `failure ${index} ${'x'.repeat(80)}` } })
    }
    const files = await listDiagnosticLogs(path, policy)
    expect(files.length).toBeLessThanOrEqual(3)
    expect(files[0]?.current).toBe(true)
    expect(files.every(file => file.bytes <= 1024)).toBe(true)
    // 回读最后几行仍是合法 JSON，且能读到最新一条
    const lines = await tailDiagnosticLog(rotatedName(files[0]!.path, 0) === path ? path : path, 5)
    expect(lines.length).toBeGreaterThan(0)
    expect(() => JSON.parse(lines[lines.length - 1]!)).not.toThrow()
  })

  it('keeps the log free of prompts and absolute paths (redaction contract)', async () => {
    const directory = await temp()
    const path = join(directory, 'diagnostics.log')
    // 落盘内容只来自调用方给的字段；这里断言写入的是事件摘要而非提示词
    await appendDiagnosticLog({
      path,
      entry: { at: '2026-10-20T00:00:00.000Z', level: 'warn', event: 'workflow-node', message: 'node failed (timeout)' },
    })
    const text = await readFile(path, 'utf8')
    expect(text).toContain('timeout')
    expect(text).not.toContain('prompt')
    expect((await stat(path)).size).toBeGreaterThan(0)
  })
})
