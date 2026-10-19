/**
 * WebVTT 编解码（Track A / A122）。
 */
import { describe, expect, it } from 'vitest'
import { formatVttTimecode, parseVtt, parseVttTimecode, serializeVtt } from '../src/workbench/vtt.ts'

describe('WebVTT codec (A122)', () => {
  it('round-trips and uses dot millis in VTT', () => {
    const vtt = serializeVtt([
      { index: 2, startMs: 2_500, endMs: 4_000, text: '第二句' },
      { index: 1, startMs: 0, endMs: 2_000, text: '第一句' },
    ])
    expect(vtt.startsWith('WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000')).toBe(true)
    const parsed = parseVtt(vtt)
    expect(parsed.missingHeader).toBe(false)
    expect(parsed.cues).toHaveLength(2)
    expect(parsed.cues[1]).toMatchObject({ startMs: 2_500, endMs: 4_000, text: '第二句' })
  })

  it('tolerates MM:SS.mmm, settings, NOTE/STYLE blocks, cue ids and a missing header', () => {
    const messy = [
      'NOTE 这是一段注释', '', 'STYLE', '::cue { color: red }', '',
      'cue-1', '00:01.000 --> 00:02.500 align:start position:10%', 'hello', '',
      '00:00:03.000 --> 00:00:04.000', 'world',
    ].join('\n')
    const parsed = parseVtt(messy)
    expect(parsed.missingHeader).toBe(true)
    expect(parsed.cues).toHaveLength(2)
    expect(parsed.cues[0]).toMatchObject({ startMs: 1000, endMs: 2500, text: 'hello' })
    expect(parsed.cues[1]).toMatchObject({ startMs: 3000, text: 'world' })
  })

  it('formats and parses VTT timecodes', () => {
    expect(formatVttTimecode(3_723_456)).toBe('01:02:03.456')
    expect(parseVttTimecode('01:02:03.456')).toBe(3_723_456)
    expect(parseVttTimecode('00:01.500 align:start')).toBe(1500)
    expect(parseVttTimecode('nope')).toBeUndefined()
    expect(parseVtt('').cues).toEqual([])
  })
})
