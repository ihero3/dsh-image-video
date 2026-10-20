/**
 * WebVTT 字幕编解码（Track A / A122）。
 *
 * Web 平台（B 站/YouTube/网页播放器）普遍吃 VTT。与 SRT 的差别：
 * - 必须有 `WEBVTT` 头（真实文件偶尔缺失，这里容错但记录提示）
 * - 时间码用 `.` 分隔毫秒，且允许省略小时（`MM:SS.mmm`）
 * - 时间码后可跟渲染设置（`align:start position:10%`），解析时忽略
 * - 允许 `NOTE` / `STYLE` / `REGION` 等注释块，解析时跳过
 */
import type { SrtCue } from './srt.ts'
import { formatTimecode, parseTimecode } from './srt.ts'

export interface VttParseResult {
  readonly cues: readonly SrtCue[]
  readonly skipped: readonly string[]
  /** 文件缺少 `WEBVTT` 头（仍尽量解析）。 */
  readonly missingHeader: boolean
}

/** 毫秒 → VTT 时间码：`00:01:02.500`（VTT 用点）。 */
export function formatVttTimecode(ms: number): string {
  return formatTimecode(ms).replace(',', '.')
}

/** VTT 时间码 → 毫秒（允许 `MM:SS.mmm` 与时间码后的设置）。 */
export function parseVttTimecode(raw: string): number | undefined {
  const cleaned = raw.trim().split(/\s+/)[0]
  if (cleaned === undefined) return undefined
  const parts = cleaned.split(':')
  if (parts.length === 2) return parseTimecode(`00:${parts[0]}:${parts[1]}`)
  return parseTimecode(cleaned.replace('.', ','))
}

/**
 * 解析 VTT 文本。
 * @param text - WebVTT 内容。
 * @returns 字幕数组、跳过的块、是否缺头。
 */
export function parseVtt(text: string): VttParseResult {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const missingHeader = !/^WEBVTT\b/m.test(normalized)
  const blocks = normalized.split(/\n{2,}/)
  const cues: SrtCue[] = []
  const skipped: string[] = []
  for (const block of blocks) {
    const lines = block.split('\n').filter(line => line.trim() !== '')
    if (lines.length === 0) continue
    // 头与注释/样式块
    if (lines[0]!.startsWith('WEBVTT')) continue
    if (lines[0]!.startsWith('NOTE') || lines[0]!.startsWith('STYLE') || lines[0]!.startsWith('REGION')) continue
    // 可选 cue id（不含 --> 的那一行）
    let cursor = 0
    if (!lines[0]!.includes('-->') && lines.length > 1 && lines[1]!.includes('-->')) cursor = 1
    const timeLine = lines[cursor]
    if (timeLine === undefined || !timeLine.includes('-->')) { skipped.push(timeLine?.slice(0, 40) ?? block.slice(0, 40)); continue }
    const [rawStart, rawEnd] = timeLine.split('-->')
    const startMs = parseVttTimecode(rawStart ?? '')
    const endMs = parseVttTimecode(rawEnd ?? '')
    if (startMs === undefined || endMs === undefined || endMs <= startMs) { skipped.push(timeLine.slice(0, 40)); continue }
    const body = lines.slice(cursor + 1).join('\n').trim()
    if (body === '') { skipped.push(timeLine.slice(0, 40)); continue }
    cues.push({ index: cues.length + 1, startMs, endMs, text: body })
  }
  return { cues, skipped, missingHeader }
}

/**
 * 序列化为 VTT 文本。
 * @param cues - 字幕（按起始时间排序并重编号）。
 * @returns VTT 文本（带 WEBVTT 头）。
 */
export function serializeVtt(cues: readonly SrtCue[]): string {
  const sorted = [...cues].sort((left, right) => left.startMs - right.startMs)
  const body = sorted
    .map((cue, position) => `${position + 1}\n${formatVttTimecode(cue.startMs)} --> ${formatVttTimecode(cue.endMs)}\n${cue.text.trim()}\n`)
    .join('\n')
  return `WEBVTT\n\n${body}`
}
