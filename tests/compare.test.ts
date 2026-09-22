/**
 * 对比片合成测试：方向决策是纯函数（竖屏左右并排、横屏上下堆叠），
 * 合成路径在本机有 ffmpeg/ffprobe 时做一次真实合成并断言画布尺寸。
 */

import { describe, it, expect } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderComparison, resolveCompareLayout } from '../src/compare.ts'

const execFileAsync = promisify(execFile)

const hasFfmpeg = await (async () => {
  try {
    await execFileAsync('ffmpeg', ['-version'])
    await execFileAsync('ffprobe', ['-version'])
    return true
  } catch {
    return false
  }
})()

describe('resolveCompareLayout：按原片画幅选方向', () => {
  it('竖屏（3:4 / 9:16）左右并排', () => {
    expect(resolveCompareLayout(1080, 1440)).toBe('side-by-side')
    expect(resolveCompareLayout(1080, 1920)).toBe('side-by-side')
    expect(resolveCompareLayout(720, 1280)).toBe('side-by-side')
  })

  it('横屏（4:3 / 16:9）上下堆叠', () => {
    expect(resolveCompareLayout(1440, 1080)).toBe('stacked')
    expect(resolveCompareLayout(1920, 1080)).toBe('stacked')
    expect(resolveCompareLayout(1280, 720)).toBe('stacked')
  })

  it('正方形按竖屏处理（左右并排），避免堆叠出极端长条', () => {
    expect(resolveCompareLayout(1080, 1080)).toBe('side-by-side')
  })
})

describe.skipIf(!hasFfmpeg)('renderComparison：真实合成', () => {
  /** 用 ffmpeg 造一段纯色测试片，指定画幅与时长。 */
  async function makeClip(path: string, size: string, seconds: number): Promise<void> {
    await execFileAsync('ffmpeg', [
      '-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=gray:s=${size}:d=${seconds}:r=30`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path,
    ])
  }

  async function frameSize(path: string): Promise<string> {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path,
    ])
    return stdout.trim()
  }

  it('横屏原片 → 上下堆叠（宽不变、高翻倍）', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-compare-'))
    try {
      const source = join(dir, 'src.mp4')
      const result = join(dir, 'res.mp4')
      await makeClip(source, '320x240', 1)
      await makeClip(result, '320x240', 1)
      const out = await renderComparison({ source, result })
      expect(out.layout).toBe('stacked')
      expect(`${out.width}x${out.height}`).toBe('320x480')
      expect(out.data.byteLength).toBeGreaterThan(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('竖屏原片 → 左右并排（高不变、宽翻倍）', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-compare-'))
    try {
      const source = join(dir, 'src.mp4')
      const result = join(dir, 'res.mp4')
      await makeClip(source, '240x320', 1)
      await makeClip(result, '240x320', 1)
      const out = await renderComparison({ source, result })
      expect(out.layout).toBe('side-by-side')
      expect(`${out.width}x${out.height}`).toBe('480x320')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('两侧画幅不一致时仍按原片方向合成，各自等比放进同一格', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-compare-'))
    try {
      const source = join(dir, 'src.mp4')
      const result = join(dir, 'res.mp4')
      await makeClip(source, '320x240', 1)
      await makeClip(result, '640x360', 1)
      const out = await renderComparison({ source, result })
      expect(out.layout).toBe('stacked')
      expect(`${out.width}x${out.height}`).toBe('320x480')
      expect(await frameSize(source)).toBe('320,240')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
