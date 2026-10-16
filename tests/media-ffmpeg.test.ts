/**
 * ffmpeg 解析与特性检测（`T5-4`）。
 *
 * 失败面必须"可操作"：缺 ffmpeg、没有执行权限、缺编码器三种情况都要有 code + 能照着做的文案。
 */
import { describe, expect, it, vi } from 'vitest'
import { FFMPEG_PATH_ENV, parseEncoders, parseFfmpegVersion, probeFfmpeg, type RunCommand } from '../src/media/ffmpeg.ts'

const VERSION_OUT = 'ffmpeg version 7.1.1 Copyright (c) 2000-2025 the FFmpeg developers\nbuilt with Apple clang'
const ENCODERS_OUT = 'Encoders:\n V....D libx264              H.264 / AVC (codec h264)\n A....D aac                  AAC (Advanced Audio Coding)'

describe('ffmpeg probing (T5-4)', () => {
  it('parses version and encoders from real-looking output', () => {
    expect(parseFfmpegVersion(VERSION_OUT)).toBe('7.1.1')
    expect(parseEncoders(ENCODERS_OUT)).toEqual({ h264: true, aac: true })
    expect(parseEncoders('Encoders:\n V....D mpeg4\n')).toEqual({ h264: false, aac: false })
  })

  it('reports the explicit DSH_FFMPEG_PATH copy when it works', async () => {
    const run = vi.fn<RunCommand>(async (_file, args) => ({
      code: 0,
      stdout: args.includes('-encoders') ? ENCODERS_OUT : VERSION_OUT,
      stderr: '',
    }))
    const probe = await probeFfmpeg({ env: { [FFMPEG_PATH_ENV]: process.execPath }, run })
    expect(probe.available).toBe(true)
    expect(probe.path).toBe(process.execPath)
    expect(probe.version).toBe('7.1.1')
    expect(probe.encoders).toEqual({ h264: true, aac: true })
  })

  it('gives an actionable message when ffmpeg is nowhere to be found', async () => {
    const run: RunCommand = async () => { throw Object.assign(new Error('not found'), { code: 'ENOENT' }) }
    const probe = await probeFfmpeg({ env: {}, run, candidates: ['/nonexistent/ffmpeg'] })
    expect(probe.available).toBe(false)
    expect(probe.code).toBe('MEDIA_FFMPEG_UNAVAILABLE')
    expect(probe.message).toContain('brew install ffmpeg')
    expect(probe.message).toContain(FFMPEG_PATH_ENV)
  })

  it('flags a found-but-not-executable copy distinctly', async () => {
    const run = vi.fn<RunCommand>(async () => ({ code: 126, stdout: '', stderr: 'EACCES: permission denied' }))
    const probe = await probeFfmpeg({ env: { [FFMPEG_PATH_ENV]: process.execPath }, run })
    expect(probe.available).toBe(false)
    expect(probe.code).toBe('MEDIA_FFMPEG_NOT_EXECUTABLE')
    expect(probe.message).toMatch(/权限|permission/)
  })

  it('flags a build without the H.264 encoder', async () => {
    const run = vi.fn<RunCommand>(async (_file, args) => ({
      code: 0,
      stdout: args.includes('-encoders') ? 'Encoders:\n V....D mpeg4\n' : VERSION_OUT,
      stderr: '',
    }))
    const probe = await probeFfmpeg({ env: { [FFMPEG_PATH_ENV]: process.execPath }, run })
    expect(probe.available).toBe(false)
    expect(probe.code).toBe('MEDIA_FFMPEG_ENCODER_MISSING')
    expect(probe.message).toMatch(/libx264/)
  })

  it('in strict mode only honours the given candidate (diagnostics path)', async () => {
    const run: RunCommand = async () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }) }
    const probe = await probeFfmpeg({ env: {}, run, candidates: ['/definitely/not/here/ffmpeg'], strict: true })
    expect(probe.available).toBe(false)
    expect(probe.code).toBe('MEDIA_FFMPEG_UNAVAILABLE')
  })

  it('finds the real ffmpeg on this machine when it exists', async () => {
    const probe = await probeFfmpeg()
    if (probe.available) {
      expect(probe.path).toBeTruthy()
      expect(probe.version).toMatch(/\d+\./)
      expect(probe.encoders?.h264).toBe(true)
    } else {
      // 本机没装也算合法结果，但必须给出可操作原因
      expect(probe.code).toMatch(/^MEDIA_FFMPEG_/)
      expect(probe.message).toBeTruthy()
    }
  })
})
