/**
 * 对抗性扫荡 R8（Track A / A142 后收尾轮）：专挑最近版本的边界。
 */
import { describe, expect, it } from 'vitest'
import { formatTimecode, parseSrt, parseTimecode, serializeSrt } from '../src/workbench/srt.ts'
import { parseVtt, serializeVtt } from '../src/workbench/vtt.ts'

describe('timecode round-trips beyond 24h (R8)', () => {
  it('parses what formatTimecode produces even past a day', () => {
    const long = 25 * 3600 * 1000 + 1234 // 25:00:01,234
    const formatted = formatTimecode(long)
    expect(formatted.startsWith('25:')).toBe(true)
    expect(parseTimecode(formatted)).toBe(long) // 修前：解析返回 undefined（自己的格式解析不了）
    const srt = serializeSrt([{ index: 0, startMs: long, endMs: long + 1000, text: '超长素材' }])
    expect(parseSrt(srt).cues[0]?.startMs).toBe(long)
  })

  it('parses long VTT timecodes too', () => {
    const vtt = serializeVtt([{ index: 0, startMs: 30 * 3600 * 1000, endMs: 30 * 3600 * 1000 + 500, text: 'x' }])
    expect(parseVtt(vtt).cues[0]?.startMs).toBe(30 * 3600 * 1000)
  })
})

describe('dirty subtitle inputs (R8)', () => {
  it('skips whitespace-only bodies in both formats', () => {
    expect(parseSrt('1\n00:00:01,000 --> 00:00:02,000\n   \n').cues).toEqual([])
    expect(parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n   \n').cues).toEqual([])
  })

  it('does not choke on a missing arrow or a malformed range', () => {
    expect(parseSrt('1\n00:00:01,000 00:00:02,000\nx\n').cues).toEqual([])
    expect(parseVtt('WEBVTT\n\n00:00:02.000 --> 00:00:01.000\nreverse\n').cues).toEqual([])
  })
})
