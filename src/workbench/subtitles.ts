/**
 * 字幕批量生成（Track A / A14）：把一段台词/文案切成句子，再按字数把时间窗分配成多条字幕片段。
 *
 * 为什么放在域层：切句与时间分配是**业务规则**（中英标点、长度上限、最短显示时长、
 * 不重叠、不越界），客户端与 Agent 必须用同一套，否则两边生成的字幕节奏会不一样。
 */
import type { SubtitleStyle, TimelineClip } from './timeline.ts'

/** 切句选项。 */
export interface SplitOptions {
  /** 单条字幕最多多少字（默认 28；中文一行约 14–18 字，28 允许两行）。 */
  readonly maxChars?: number
}

/** 分配选项。 */
export interface PlanOptions extends SplitOptions {
  /** 时间窗起点（毫秒）。 */
  readonly startMs: number
  /** 时间窗终点（毫秒，不含）。 */
  readonly endMs: number
  /** 单条字幕最少显示多久（默认 600ms）。 */
  readonly minDurationMs?: number
  /** 统一套用的字幕样式。 */
  readonly style?: SubtitleStyle
  /** id 生成器（测试可注入）。 */
  readonly newId?: () => string
}

const DEFAULT_MAX_CHARS = 28
const DEFAULT_MIN_DURATION = 600
/** 句子切分：先按句末标点/换行切，再把过长的句子按逗号类标点续切。 */
const SENTENCE_END = /[。！？!?；;\n]+/
const CLAUSE_END = /[，,、：:]+/

/**
 * 把文本切成适合做字幕的短句（保留原文顺序，丢弃空段）。
 * @param text - 原始文本（台词、旁白、文案均可）。
 * @param options - 切句选项。
 * @returns 非空短句数组。
 */
export function splitSubtitleSentences(text: string, options: SplitOptions = {}): string[] {
  const maxChars = Math.max(4, Math.round(options.maxChars ?? DEFAULT_MAX_CHARS))
  const sentences: string[] = []
  for (const rawSentence of text.split(SENTENCE_END)) {
    const sentence = rawSentence.trim()
    if (sentence === '') continue
    if (sentence.length <= maxChars) {
      sentences.push(sentence)
      continue
    }
    // 长句再按逗号切；单段仍过长就硬切（保证每条不超过上限）
    let buffer = ''
    for (const clause of sentence.split(CLAUSE_END)) {
      const piece = clause.trim()
      if (piece === '') continue
      if ((buffer + piece).length <= maxChars) {
        buffer = buffer === '' ? piece : `${buffer}，${piece}`
        continue
      }
      if (buffer !== '') sentences.push(buffer)
      if (piece.length <= maxChars) {
        buffer = piece
      } else {
        for (let index = 0; index < piece.length; index += maxChars) sentences.push(piece.slice(index, index + maxChars))
        buffer = ''
      }
    }
    if (buffer !== '') sentences.push(buffer)
  }
  return sentences
}

/**
 * 把文本排成一组**连续、不重叠、不越界**的字幕片段。
 *
 * 时间分配按字数比例（长句显示更久），并保证每条不短于 `minDurationMs`；
 * 条数太多放不下时**截断文本**（而不是把每条压到看不见）。
 *
 * @param text - 文本。
 * @param options - 时间窗与样式。
 * @returns 字幕片段（`kind` 层面属于字幕轨，调用方负责放进轨道）。
 * @throws {Error} 时间窗非法时。
 */
export function planSubtitleClips(text: string, options: PlanOptions): TimelineClip[] {
  const { startMs, endMs } = options
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error(`字幕时间窗非法：startMs=${startMs} endMs=${endMs}（要求 endMs > startMs）`)
  }
  const totalMs = Math.round(endMs - startMs)
  const minDuration = Math.max(100, Math.round(options.minDurationMs ?? DEFAULT_MIN_DURATION))
  const sentences = splitSubtitleSentences(text, options)
  if (sentences.length === 0) return []

  // 放得下几条：总时长 / 最短显示时长
  const fit = Math.max(1, Math.floor(totalMs / minDuration))
  const kept = sentences.slice(0, fit)
  const weights = kept.map(sentence => Math.max(1, sentence.length))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)

  let newIdCounter = 0
  const newId = options.newId ?? (() => `sub-${Date.now().toString(36)}-${newIdCounter++}`)
  const clips: TimelineClip[] = []
  let cursor = Math.round(startMs)
  let remainingMs = totalMs
  let remainingWeight = totalWeight
  kept.forEach((sentence, index) => {
    const isLast = index === kept.length - 1
    // 按剩余权重分配剩余时间，最后一条吃掉全部余量（避免累计误差越界）
    const share = isLast
      ? remainingMs
      : Math.max(minDuration, Math.round(remainingMs * (weights[index]! / remainingWeight)))
    const durationMs = Math.max(1, Math.min(share, remainingMs))
    clips.push({
      id: newId(),
      text: sentence,
      startMs: cursor,
      durationMs,
      ...options.style === undefined ? {} : { style: options.style },
    })
    cursor += durationMs
    remainingMs -= durationMs
    remainingWeight -= weights[index]!
  })
  return clips
}

/**
 * 生成确定性的字幕 id 生成器（测试/可复现脚本用）。
 * @param prefix - id 前缀。
 * @returns 每次调用返回 `<prefix>-0`、`<prefix>-1`…
 */
export function makeSubtitleIds(prefix: string): () => string {
  let counter = 0
  return () => `${prefix}-${counter++}`
}

/**
 * 把字幕文本按**显示宽度**折成多行（`A25`）。
 *
 * 规则：尊重原文里的换行；每行不超过 `maxChars`；优先在标点处断行
 * （中文逗号顿号、英文空格），实在没有标点就硬断。
 *
 * @param text - 原始文本（可含换行）。
 * @param maxChars - 每行最多字符数（按等宽 CJK 估算，见 {@link estimateMaxCharsForWidth}）。
 * @returns 折好行的文本（行间用 `\n` 连接）。
 */
export function wrapSubtitleLines(text: string, maxChars: number): string {
  const limit = Math.max(4, Math.round(maxChars))
  const result: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    const line = paragraph.trim()
    if (line === '') continue
    if (line.length <= limit) { result.push(line); continue }
    let rest = line
    while (rest.length > limit) {
      // 在 limit 附近找最后一个标点/空格断行
      const window = rest.slice(0, limit + 1)
      const breakAt = Math.max(
        window.lastIndexOf('，'), window.lastIndexOf('。'), window.lastIndexOf('、'),
        window.lastIndexOf('；'), window.lastIndexOf('：'), window.lastIndexOf(' '),
        window.lastIndexOf(','), window.lastIndexOf(' '),
      )
      // 断点后含标点本身，但不能超过本行上限
      const cut = breakAt > Math.floor(limit * 0.4) ? Math.min(breakAt + 1, limit) : limit
      result.push(rest.slice(0, cut).trim())
      rest = rest.slice(cut).trim()
    }
    if (rest !== '') result.push(rest)
  }
  return result.join('\n')
}

/**
 * 按画面宽度与字号估算每行能放多少个 CJK 字符（`A25`）。
 * @param width - 画面宽（像素）。
 * @param fontSize - 字号（像素）。
 * @returns 每行建议字符数（至少 6）。
 */
export function estimateMaxCharsForWidth(width: number, fontSize: number): number {
  // 中文近似等宽；两侧各留 6% 边距，避免贴边
  const usable = Math.max(1, width * 0.88)
  return Math.max(6, Math.floor(usable / (fontSize * 1.05)))
}
