/**
 * 导出失败面（`T5-6`）：素材丢失 / 磁盘不足 / 编码器不支持 / ffmpeg 缺失，
 * 每一类都要有机器码 + 一句能照着做的文案。
 */
import { chmod, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { RenderError, RenderService, defaultRenderRunner, type RenderRunner } from '../src/media/render.ts'
import type { TimelineRecord } from '../src/workbench/timeline.ts'

const dirs: string[] = []
async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

/** 一个"假 ffmpeg"：把给定信息打到 stderr 后按退出码结束。跨平台——
 * Windows 生成 `.cmd`（cmd.exe 可直接执行），Unix 生成 `.sh` 并 chmod。 */
async function fakeFfmpeg(dir: string, name: string, stderr: string, code: number): Promise<string> {
  const base = name.replace(/\.[^.]+$/, '')
  const fake = process.platform === 'win32' ? join(dir, `${base}.cmd`) : join(dir, `${base}.sh`)
  if (process.platform === 'win32') {
    const escaped = stderr.replace(/"/g, '""')
    await writeFile(fake, `@echo off\r\necho ${escaped} 1>&2\r\nexit /b ${code}\r\n`)
  } else {
    await writeFile(fake, `#!/bin/sh\necho "${stderr}" >&2\nexit ${code}\n`)
    await chmod(fake, 0o755)
  }
  return fake
}

function timelineWith(path: string, fileName?: string): TimelineRecord {
  return {
    schemaVersion: 1, id: 'tml-1', projectId: 'prj-1', name: '成片', frameRate: 30, burnSubtitles: false,
    tracks: [
      { id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: path, startMs: 0, durationMs: 1000 }] },
      { id: 's1', kind: 'subtitle', clips: [] },
    ],
    createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z',
    ...fileName === undefined ? {} : {},
  }
}

const AVAILABLE = { available: true as const, path: '/usr/bin/true', version: '8.0', encoders: { h264: true, aac: true } }

describe('export failure surfaces (T5-6)', () => {
  it('resolves a relative outputsDir so assets never store relative paths (T5-5)', async () => {
    const work = await tempDir('dsh-render-relative-')
    const asset = join(work, 'asset.mp4')
    await writeFile(asset, 'x')
    const argv: string[] = []
    const service = new RenderService({
      outputsDir: 'outputs', probe: async () => AVAILABLE,
      run: async ({ args }) => { argv.push(String(args[args.length - 1])) },
    })
    // 起 ffmpeg 之前会因为产物不存在/校验失败而报错，这里只关心它写出的路径是绝对的
    await service.render(timelineWith(asset), { fileName: 'out.mp4' }).catch(() => undefined)
    expect(argv[0]).toBeDefined()
    expect(isAbsolute(argv[0]!)).toBe(true)
    expect(argv[0]).toBe(join(resolve('outputs'), 'out.mp4'))
  })

  it('says what to do when ffmpeg is missing', async () => {
    const outputs = await tempDir('dsh-fail-ffmpeg-')
    const service = new RenderService({
      outputsDir: outputs,
      probe: async () => ({ available: false, code: 'MEDIA_FFMPEG_UNAVAILABLE', message: '未找到可用的 ffmpeg。macOS 可执行 `brew install ffmpeg`；已装在别处就设 DSH_FFMPEG_PATH 后重试。' }),
    })
    await expect(service.render(timelineWith('/tmp/whatever.mp4'))).rejects.toThrow(/brew install ffmpeg/)
  })

  it('maps ffmpeg stderr to disk-full / unsupported-encoder codes', async () => {
    const work = await tempDir('dsh-fail-mapping-')
    const asset = join(work, 'asset.mp4')
    await writeFile(asset, 'not really a video')
    const diskFull = await fakeFfmpeg(work, 'disk-full.sh', 'av_interleaved_write_frame(): No space left on device', 1)
    const encoder = await fakeFfmpeg(work, 'encoder.sh', "Unknown encoder 'libx264'", 1)

    await expect(defaultRenderRunner({ ffmpegPath: diskFull, args: [], durationMs: 1000 }))
      .rejects.toMatchObject({ code: 'MEDIA_DISK_FULL' })
    await expect(defaultRenderRunner({ ffmpegPath: encoder, args: [], durationMs: 1000 }))
      .rejects.toMatchObject({ code: 'MEDIA_ENCODER_UNSUPPORTED' })
    await expect(defaultRenderRunner({ ffmpegPath: join(work, 'missing-binary'), args: [], durationMs: 1000 }))
      .rejects.toMatchObject({ code: 'MEDIA_FFMPEG_UNAVAILABLE' })
  }, 30_000)

  it('treats a successful-but-empty output as invalid instead of reporting success', async () => {
    const work = await tempDir('dsh-fail-empty-')
    const asset = join(work, 'asset.mp4')
    await writeFile(asset, 'x')
    const outputs = await tempDir('dsh-fail-empty-out-')
    const noop: RenderRunner = async () => undefined
    const service = new RenderService({ outputsDir: outputs, probe: async () => AVAILABLE, run: noop })
    await expect(service.render(timelineWith(asset))).rejects.toMatchObject({ code: 'MEDIA_OUTPUT_INVALID' })
  })

  it('cleans up the half-written file when the runner fails', async () => {
    const work = await tempDir('dsh-fail-partial-')
    const asset = join(work, 'asset.mp4')
    await writeFile(asset, 'x')
    const outputs = await tempDir('dsh-fail-partial-out-')
    const partial: RenderRunner = async ({ args }) => {
      await writeFile(args[args.length - 1] as string, 'half')
      throw new RenderError('MEDIA_RENDER_FAILED', 'ffmpeg 渲染失败')
    }
    const service = new RenderService({ outputsDir: outputs, probe: async () => AVAILABLE, run: partial })
    await expect(service.render(timelineWith(asset), { fileName: 'partial.mp4' })).rejects.toThrow(/渲染失败/)
    await expect(stat(join(outputs, 'partial.mp4'))).rejects.toThrow()
  })
})
