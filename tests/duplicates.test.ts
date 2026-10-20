/**
 * 素材内容去重（Track A / A112）：先按大小分组，只对同大小文件算哈希。
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { findDuplicateAssets } from '../src/workbench/duplicates.ts'
import { sha256File } from '../src/workbench/package.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })

describe('findDuplicateAssets (A112)', () => {
  it('reports only same-content files and counts reclaimable bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-dup-'))
    dirs.push(directory)
    await writeFile(join(directory, 'a.mp4'), 'same-content-here')
    await writeFile(join(directory, 'a-copy.mp4'), 'same-content-here') // 同内容
    await writeFile(join(directory, 'b.mp4'), 'different-content!!')    // 不同内容（同长度？长度不同更简单）
    await writeFile(join(directory, 'short.mp4'), 'x')                  // 唯一大小，不会被哈希

    const assets = [
      { path: join(directory, 'a.mp4'), bytes: 17 },
      { path: join(directory, 'a-copy.mp4'), bytes: 17 },
      { path: join(directory, 'b.mp4'), bytes: 19 },
      { path: join(directory, 'short.mp4'), bytes: 1 },
    ]
    const hashed: string[] = []
    const report = await findDuplicateAssets(assets, async path => {
      hashed.push(path)
      return sha256File(path)
    })
    expect(report.groups).toHaveLength(1)
    expect(report.groups[0]?.paths.length).toBe(2)
    expect(report.groups[0]?.reclaimableBytes).toBe(17)
    expect(report.reclaimableBytes).toBe(17)
    // 只对"同大小"的 2 个文件算哈希；唯一大小的 short.mp4 不参与
    expect(hashed).toHaveLength(2)
    expect(hashed.some(path => path.endsWith('short.mp4'))).toBe(false)
  })

  it('respects the hash budget so a huge library cannot be scanned', async () => {
    const assets = [
      { path: '/a', bytes: 10 }, { path: '/b', bytes: 10 }, { path: '/c', bytes: 10 }, { path: '/d', bytes: 10 },
    ]
    let hashCalls = 0
    const report = await findDuplicateAssets(assets, async () => { hashCalls += 1; return 'same' }, { maxHashFiles: 2 })
    expect(hashCalls).toBeLessThanOrEqual(2)
    expect(report.skippedFiles).toBeGreaterThan(0)
  })
})
