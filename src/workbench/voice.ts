/**
 * 配音编排（`P0-1` 应用层）：**字幕 → 配音计划**（纯函数，零网络、零花费）。
 *
 * 为什么先做"计划"而不是直接合成：Threerouter 的 TTS 接口尚未联调通过（owner 口径：
 * 先按应用层做，接口测试通过后再接）。但**界面、数据结构、时长估算、错误口径**不该等接口——
 * 这些定下来之后，接 API 只是把 `TtsProvider` 实现填进去。
 *
 * 计划口径（与字幕轨严格对齐）：
 * - 每一条字幕片段 → 一条配音行（`clipId` 对应，成片后字幕与配音同源，不会错位）；
 * - 估算时长：中文按 **4.5 字/秒**（普通话旁白的中位语速），英文按 **2.6 词/秒**；
 *   与字幕片段时长不一致时给出提醒（配音比画面长 = 必然挤压下一句）；
 * - 空文本/纯标点跳过并记录；总字数与总估算秒数一并返回，界面可直接显示"这集要念多久"。
 *
 * @module dsh-image-video/workbench/voice
 */
import type { TimelineRecord } from './timeline.ts'

/** 一条待配音的行（与字幕片段一一对应）。 */
export interface DubLine {
  /** 来源字幕片段 id（合成后 audio 片段也用它做关联键）。 */
  readonly clipId: string
  /** 台词文本。 */
  readonly text: string
  /** 字数（去掉空白与标点后的有效字符数，中英文同口径）。 */
  readonly chars: number
  /** 字幕占用的时间轴时长（毫秒）。 */
  readonly slotMs: number
  /** 估算语速时长（毫秒）。 */
  readonly estimatedMs: number
  /** 与该行时间轴时长不匹配时的提醒（长于/短于 20% 以上才算）。 */
  readonly warning?: string
}

/** 一份配音计划。 */
export interface DubPlan {
  readonly lines: readonly DubLine[]
  /** 总字数。 */
  readonly totalChars: number
  /** 估算总时长（毫秒）。 */
  readonly estimatedMs: number
  /** 整体提醒（没有字幕轨、全部为空等）。 */
  readonly warnings: readonly string[]
}

/** 中文旁白的经验语速：4.5 字/秒。 */
const CHARS_PER_SECOND_ZH = 4.5
/** 英文旁白的经验语速：2.6 词/秒。 */
const WORDS_PER_SECOND_EN = 2.6

/** 有效字符数：去掉空白与常见中英文标点。 */
export function countEffectiveChars(text: string): number {
  const stripped = text.replace(/[\s，。！？、；：""''（）《》…—,.!?;:'"()<>[\]-]/gu, '')
  return [...stripped].length
}

/** 这段文本里英文词的占比（用于选中/英哪条语速）。 */
function englishWordRatio(text: string): number {
  const englishWords = text.match(/[A-Za-z][A-Za-z'-]*/g)?.length ?? 0
  const chars = countEffectiveChars(text)
  if (chars === 0) return 0
  return englishWords / chars
}

/**
 * 估算一句话的朗读时长。
 * @param text - 台词文本。
 * @returns 估算毫秒数（至少 300ms，避免"一瞬间"）。
 */
export function estimateSpeechMs(text: string): number {
  const chars = countEffectiveChars(text)
  if (chars === 0) return 0
  const english = englishWordRatio(text) > 0.3
  const ms = english
    ? (chars / WORDS_PER_SECOND_EN) * 1000
    : (chars / CHARS_PER_SECOND_ZH) * 1000
  return Math.max(300, Math.round(ms))
}

/**
 * 从一条时间轴生成配音计划（只读、确定性）。
 * @param timeline - 时间轴记录。
 * @returns 配音计划 + 提醒。
 */
export function planDub(timeline: TimelineRecord): DubPlan {
  const warnings: string[] = []
  const subtitleTracks = timeline.tracks.filter(track => track.kind === 'subtitle')
  if (subtitleTracks.length === 0) {
    warnings.push('这条时间轴没有字幕轨：先在时间轴上写台词（或导入 SRT），配音才有文本可用')
    return { lines: [], totalChars: 0, estimatedMs: 0, warnings }
  }

  const lines: DubLine[] = []
  for (const track of subtitleTracks) {
    for (const clip of track.clips) {
      const text = (clip.text ?? '').trim()
      const chars = countEffectiveChars(text)
      if (chars === 0) continue
      const estimatedMs = estimateSpeechMs(text)
      const slotMs = clip.durationMs
      const tooLong = estimatedMs > slotMs * 1.2
      const tooShort = estimatedMs < slotMs * 0.6
      const warning = tooLong
        ? `这句按 ${CHARS_PER_SECOND_ZH} 字/秒估算约 ${(estimatedMs / 1000).toFixed(1)}s，比字幕的 ${(slotMs / 1000).toFixed(1)}s 长：成片会挤压下一句`
        : tooShort
          ? `这句只估算 ${(estimatedMs / 1000).toFixed(1)}s，字幕给了 ${(slotMs / 1000).toFixed(1)}s：中间会留白（可调语速或加停顿）`
          : undefined
      lines.push({
        clipId: clip.id, text, chars, slotMs, estimatedMs,
        ...warning === undefined ? {} : { warning },
      })
    }
  }

  if (lines.length === 0) warnings.push('字幕轨里没有可念的文本（全是空行或标点）')
  const totalChars = lines.reduce((sum, line) => sum + line.chars, 0)
  const estimatedMs = lines.reduce((sum, line) => sum + line.estimatedMs, 0)
  return { lines, totalChars, estimatedMs, warnings }
}
