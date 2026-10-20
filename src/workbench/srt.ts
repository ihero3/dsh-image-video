/**
 * SRT 字幕导入 / 导出（Track A / A118）。
 *
 * 创作者手上常有现成 SRT；剪完也可能要把字幕交给别人。这里只做**纯解析与序列化**
 * （便于单测），端点负责与时间轴互转。
 *
 * 容错：BOM、CRLF、多余空行、序号缺失/错乱、时间码小数用 `.` 而非 `,` —— 真实文件很脏。
 */

/** 一条字幕。 */
export interface SrtCue {
  /** 原文序号（1 起；缺失时为位置序）。 */
  readonly index: number
  readonly startMs: number
  readonly endMs: number
  readonly text: string
}

export interface ParseResult {
  readonly cues: readonly SrtCue[]
  /** 解析过程中被跳过的块（给用户可见的提示）。 */
  readonly skipped: readonly string[]
}

/** 时间码 → 毫秒：`00:01:02,500` 或 `00:01:02.500`。 */
export function parseTimecode(raw: string): number | undefined {
  // 小时允许任意位数：`formatTimecode` 对超长素材会输出 25:00:00,000，解析必须能读回（R8 修的往返缺陷）
  const match = /^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(raw.trim())
  if (match === null) return undefined
  const [, hours, minutes, seconds, millis] = match
  const ms = Number(millis!.padEnd(3, '0'))
  return ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 + ms
}

/** 毫秒 → 时间码：`00:01:02,500`。 */
export function formatTimecode(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1000)
  const millis = total % 1000
  const pad = (value: number, width = 2): string => String(value).padStart(width, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`
}

/**
 * 解析 SRT 文本。
 * @param text - SRT 内容（容忍 BOM/CRLF/多余空行）。
 * @returns 字幕数组与被跳过的块说明。
 */
export function parseSrt(text: string): ParseResult {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const blocks = normalized.split(/\n{2,}/)
  const cues: SrtCue[] = []
  const skipped: string[] = []
  for (const block of blocks) {
    const lines = block.split('\n').filter((line, index) => !(index === 0 && line.trim() === ''))
    if (lines.length === 0) continue
    // 序号行可选
    let cursor = 0
    let index = cues.length + 1
    if (/^\d+$/.test(lines[0]!.trim())) {
      index = Number(lines[0]!.trim())
      cursor = 1
    }
    const timeLine = lines[cursor]
    if (timeLine === undefined) { skipped.push(block.slice(0, 40)); continue }
    const timeMatch = /^(\S+)\s*-->\s*(\S+)/.exec(timeLine.trim())
    if (timeMatch === null) { skipped.push(timeLine.slice(0, 40)); continue }
    const startMs = parseTimecode(timeMatch[1]!)
    const endMs = parseTimecode(timeMatch[2]!)
    if (startMs === undefined || endMs === undefined || endMs <= startMs) {
      skipped.push(timeLine.slice(0, 40))
      continue
    }
    const body = lines.slice(cursor + 1).join('\n').trim()
    if (body === '') { skipped.push(timeLine.slice(0, 40)); continue }
    cues.push({ index, startMs, endMs, text: body })
  }
  return { cues, skipped }
}

/**
 * 序列化为 SRT 文本。
 * @param cues - 字幕数组（会按起始时间排序并重排序号）。
 * @returns SRT 文本（以换行结尾）。
 */
export function serializeSrt(cues: readonly SrtCue[]): string {
  const sorted = [...cues].sort((left, right) => left.startMs - right.startMs)
  return sorted
    .map((cue, position) => `${position + 1}\n${formatTimecode(cue.startMs)} --> ${formatTimecode(cue.endMs)}\n${cue.text.trim()}\n`)
    .join('\n')
}
