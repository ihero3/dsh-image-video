/**
 * SRT 解析与序列化（Track A / A118）。
 */
import { describe, expect, it } from 'vitest'
import { formatTimecode, parseSrt, parseTimecode, serializeSrt } from '../src/workbench/srt.ts'

describe('SRT codec (A118)', () => {
  it('round-trips cues through serialize + parse', () => {
    const srt = serializeSrt([
      { index: 2, startMs: 2_500, endMs: 4_000, text: '第二句\n第二行' },
      { index: 1, startMs: 0, endMs: 2_000, text: '第一句' },
    ])
    // 序列化按时间排序并重编号
    expect(srt.startsWith('1\n00:00:00,000 --> 00:00:02,000\n第一句')).toBe(true)
    const parsed = parseSrt(srt)
    expect(parsed.skipped).toEqual([])
    expect(parsed.cues).toHaveLength(2)
    expect(parsed.cues[1]).toMatchObject({ startMs: 2_500, endMs: 4_000, text: '第二句\n第二行' })
  })

  it('tolerates dirty real-world files (BOM, CRLF, missing index, dot millis, blank lines)', () => {
    const dirty = '\uFEFF\r\n00:00:01.000 --> 00:00:02.500\r\nhello\r\n\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nworld\r\n'
    const parsed = parseSrt(dirty)
    expect(parsed.cues).toHaveLength(2)
    expect(parsed.cues[0]).toMatchObject({ startMs: 1000, endMs: 2500, text: 'hello' })
    expect(parsed.cues[1]).toMatchObject({ index: 2, startMs: 3000, text: 'world' })
  })

  it('skips malformed blocks and reports them', () => {
    const parsed = parseSrt('1\nnot-a-timecode\nbad\n\n2\n00:00:05,000 --> 00:00:06,000\nok\n')
    expect(parsed.cues).toHaveLength(1)
    expect(parsed.skipped.length).toBe(1)
    expect(parseSrt('').cues).toEqual([])
  })

  it('formats and parses timecodes', () => {
    expect(formatTimecode(3_723_456)).toBe('01:02:03,456')
    expect(parseTimecode('01:02:03,456')).toBe(3_723_456)
    expect(parseTimecode('00:00:01.5')).toBe(1500)
    expect(parseTimecode('nope')).toBeUndefined()
  })
})
