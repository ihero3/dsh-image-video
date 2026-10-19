/**
 * 素材探测缓存（Track A / A77）。
 */
import { describe, expect, it, vi } from 'vitest'
import { ProbeCache } from '../src/media/probe-cache.ts'

const spec = { width: 320, height: 240, fps: 30, durationMs: 1000, hasAudio: false }

describe('ProbeCache (A77)', () => {
  it('hits the cache for the same file+mtime+size and re-probes when the file changes', async () => {
    let mtimeMs = 1000
    const size = 64
    const probe = vi.fn(async () => spec)
    const cache = new ProbeCache({ probe, statFile: async () => ({ mtimeMs, size }) })

    expect(await cache.get('/tmp/a.mp4')).toEqual(spec)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(await cache.get('/tmp/a.mp4')).toEqual(spec)
    expect(probe).toHaveBeenCalledTimes(1) // 命中，不再起进程
    expect(cache.stats()).toMatchObject({ hits: 1, misses: 1, size: 1 })

    // 素材被替换（mtime 变）→ 键变 → 重新探测，绝不返回旧时长
    mtimeMs = 2000
    await cache.get('/tmp/a.mp4')
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it('does not cache missing files (so a freshly generated asset is picked up)', async () => {
    let exists = false
    const probe = vi.fn(async () => spec)
    const cache = new ProbeCache({ probe, statFile: async () => exists ? { mtimeMs: 1, size: 1 } : undefined })
    expect(await cache.get('/tmp/new.mp4')).toBeUndefined()
    exists = true
    expect(await cache.get('/tmp/new.mp4')).toEqual(spec)
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('evicts the least recently used entry beyond the limit', async () => {
    const probe = vi.fn(async () => spec)
    const cache = new ProbeCache({ probe, statFile: async () => ({ mtimeMs: 1, size: 1 }), maxEntries: 2 })
    await cache.get('/tmp/a')
    await cache.get('/tmp/b')
    await cache.get('/tmp/a') // 触碰 a → b 变成最久未用
    await cache.get('/tmp/c') // 触发淘汰
    expect(cache.stats().size).toBe(2)
    await cache.get('/tmp/b') // b 已被淘汰 → 重新探测
    expect(probe).toHaveBeenCalledTimes(4)
  })
})
