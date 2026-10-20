/**
 * 错误可操作性覆盖（`T7-2`）：网络 / 服务商 / ffmpeg / 磁盘 / 数据迁移，每一类都得
 * 既给机器可读的码、又给一句"下一步做什么"。
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { classifyErrorForTest } from '../src/http-client.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { probeFfmpeg } from '../src/media/ffmpeg.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

describe('error actionability (T7-2)', () => {
  it('turns provider/http failures into a next step', () => {
    const auth = classifyErrorForTest(401, { error: { message: 'invalid key' } }, 'https://example/v1')
    expect(auth.kind).toBe('auth')
    expect(auth.message).toMatch(/Key 无效/)
    expect(auth.retryable).toBe(false)

    const permission = classifyErrorForTest(403, {}, 'https://example/v1')
    expect(permission.message).toMatch(/开通/)

    const quota = classifyErrorForTest(429, {}, 'https://example/v1', '2')
    expect(quota.kind).toBe('quota')
    expect(quota.retryable).toBe(true)
    expect(quota.message).toMatch(/稍后重试|余额/)
    expect(quota.retryAfterMs).toBe(2000)

    const conflict = classifyErrorForTest(409, { error: { message: 'IN_PROGRESS' } }, 'https://example/v1')
    expect(conflict.message).toMatch(/幂等冲突/)
    expect(conflict.message).toMatch(/IN_PROGRESS/)

    // 5xx 归到可重试的服务端错误，且带上状态码与原文
    const server = classifyErrorForTest(503, { error: { message: 'upstream down' } }, 'https://example/v1')
    expect(server.retryable).toBe(true)
    expect(server.message).toMatch(/503|服务/)
    expect(server.message).toMatch(/upstream down/)
  })

  it('names the data file and the remedy when the workbench document is corrupt', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-corrupt-'))
    dirs.push(directory)
    await writeFile(join(directory, 'workbench.json'), '{ this is not json', 'utf8')
    const store = new WorkbenchStore({ directory })
    const error = await store.listProjects().catch(caught => caught as Error)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('workbench.json')
    expect(error.message).toMatch(/\.bak/)
    expect(error.message).toMatch(/corrupt|空工作台/)
  })

  it('keeps ffmpeg failures actionable (missing / not executable / encoder)', async () => {
    const missing = await probeFfmpeg({
      env: {},
      run: async () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }) },
      candidates: ['/definitely/not/here/ffmpeg'],
      strict: true,
    })
    expect(missing.code).toBe('MEDIA_FFMPEG_UNAVAILABLE')
    expect(missing.message).toMatch(/brew install ffmpeg/)
    expect(missing.message).toMatch(/DSH_FFMPEG_PATH/)
  })
})
