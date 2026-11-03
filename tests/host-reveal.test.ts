/**
 * 打开本地产物目录（人工清理用）：只唤起文件管理器，不删除任何东西；
 * 任何失败都返回原因，绝不抛错、也不假装成功。
 *
 * @module dsh-image-video/tests/host-reveal
 */
import { describe, expect, it } from 'vitest'
import { revealCommand, revealDirectory } from '../src/host/reveal.ts'

describe('打开本地产物目录（revealDirectory）', () => {
  it('按平台选命令并真的调用执行器', async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = []
    const result = await revealDirectory('/tmp/outputs', async (command, args) => { calls.push({ command, args }) })
    expect(result.ok).toBe(true)
    expect(result.path).toBe('/tmp/outputs')
    const expected = revealCommand('/tmp/outputs')
    expect(calls).toEqual([{ command: expected.command, args: ['/tmp/outputs'] }])
    // 三个平台各自的命令；不认识的平台也不崩（走 xdg-open 兜底）
    expect(['open', 'explorer', 'xdg-open']).toContain(expected.command)
  })

  it('执行失败如实返回原因（界面据此让用户手动打开）', async () => {
    const result = await revealDirectory('/tmp/outputs', async () => { throw new Error('spawn ENOENT') })
    expect(result.ok).toBe(false)
    expect(result.path).toBe('/tmp/outputs')
    expect(result.reason).toContain('无法唤起文件管理器')
    expect(result.reason).toContain('ENOENT')
  })

  it('相对路径直接拒绝（不猜用户想打开哪儿）', async () => {
    const result = await revealDirectory('outputs/relative')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('绝对路径')
  })
})
