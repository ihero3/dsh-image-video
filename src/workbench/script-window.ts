/**
 * 长剧本切段：把整本小说切成可以逐段拆解的分镜窗口。
 *
 * 一份几十万字的小说无法一次送进模型（{@link MAX_PLANNING_SCRIPT_CHARS} 上限），
 * 但用户要的是「整本导入、每次拆一段」，而不是被导入卡住。这里只做切分，
 * 选中哪一段由界面决定；每段正文都不超过上限，宿主侧的长度校验照旧生效。
 */
import { MAX_STORYBOARD_SCRIPT_CHARS } from './storyboard-plan.ts'

/** 单段正文上限：与拆解侧一致，保证每段都能直接送进模型。 */
export const MAX_PLANNING_SCRIPT_CHARS = MAX_STORYBOARD_SCRIPT_CHARS

/** 一段可拆解的剧本窗口。 */
export interface ScriptWindow {
  /** 从 1 开始的段号。 */
  readonly index: number
  /** 段标题：章节名（截断到 20 字）或「第 N 段」。 */
  readonly title: string
  /** 本段正文（已去首尾空白）。 */
  readonly text: string
  /** 本段字符数。 */
  readonly chars: number
}

/** 章节标题：`第三章`、`第 12 回`、`Chapter 3` 这类独占一行的标题。 */
const CHAPTER_LINE = /^[ \t]*(?:第[0-9一二三四五六七八九十百千零两]+[章节回卷部篇][^\n]{0,40}|Chapter[ \t]+\d+[^\n]{0,40})$/gmu

/** 段标题最大长度：章节名太长时只留开头，避免下拉框被撑开。 */
const MAX_TITLE_CHARS = 20

/**
 * 把剧本切成若干段，每段不超过 {@link MAX_PLANNING_SCRIPT_CHARS} 字。
 *
 * 优先按章节标题切；没有章节标记（或某一章本身超长）时按空行段落切；
 * 单段仍超长才按字数硬切。短于上限的剧本不切，直接返回空数组。
 *
 * @param script - 整份剧本。
 * @param max - 单段上限（测试与特殊场景可调）。
 * @returns 段列表；不需要切分时为空数组。
 */
export function splitScriptWindows(script: string, max = MAX_PLANNING_SCRIPT_CHARS): readonly ScriptWindow[] {
  const text = script.trim()
  if (text.length <= max) return []
  const chunks: string[] = []
  for (const block of chapterBlocks(text)) {
    for (const piece of splitByParagraph(block, max)) chunks.push(piece)
  }
  return chunks.map((chunk, position) => ({
    index: position + 1,
    title: windowTitle(chunk, position + 1),
    text: chunk,
    chars: chunk.length,
  }))
}

/**
 * 按章节标题把全文切成块；标题不足两处时整篇当成一块。
 * @param text - 已 trim 的剧本。
 * @returns 章正文。
 */
function chapterBlocks(text: string): readonly string[] {
  const starts: number[] = []
  for (const match of text.matchAll(CHAPTER_LINE)) {
    if (match.index === undefined) continue
    starts.push(match.index)
  }
  // 没有章节标记，或第一章不在开头（前言占了太多）时，整篇按段落切
  if (starts.length < 2 || (starts[0] ?? 0) > 2_000) return [text]
  return starts
    .map((start, position) => text.slice(start, starts[position + 1] ?? text.length).trim())
    .filter(block => block !== '')
}

/**
 * 把一块正文按空行段落装进不超过 `max` 字的桶里；单个超长段落再硬切。
 * @param block - 章（或整篇）正文。
 * @param max - 单段上限。
 * @returns 分好的段。
 */
function splitByParagraph(block: string, max: number): readonly string[] {
  if (block.length <= max) return [block]
  const result: string[] = []
  let buffer = ''
  const flush = (): void => {
    const trimmed = buffer.trim()
    if (trimmed !== '') result.push(trimmed)
    buffer = ''
  }
  for (const paragraph of block.split(/\n{2,}/u)) {
    const piece = paragraph.trim()
    if (piece === '') continue
    if (piece.length > max) {
      flush()
      for (const slice of hardSlice(piece, max)) result.push(slice)
      continue
    }
    if (buffer.length + piece.length + 1 > max) flush()
    buffer = buffer === '' ? piece : `${buffer}\n${piece}`
  }
  flush()
  return result
}

/**
 * 单段仍超长时按字数硬切（避开代理对，不劈开表情等字符）。
 * @param text - 超长段落。
 * @param max - 单段上限。
 * @returns 切片。
 */
function hardSlice(text: string, max: number): readonly string[] {
  const slices: string[] = []
  let offset = 0
  while (offset < text.length) {
    let end = Math.min(offset + max, text.length)
    // 低代理项不能单独落在开头：往回让一个位置
    if (end < text.length && (text.charCodeAt(end) & 0xfc00) === 0xdc00) end -= 1
    slices.push(text.slice(offset, end))
    offset = end
  }
  return slices
}

/**
 * 段标题：优先用章节标题行，其次按段号命名。
 * @param text - 段正文。
 * @param index - 段号（1 起）。
 * @returns 标题。
 */
function windowTitle(text: string, index: number): string {
  const firstLine = text.split('\n', 1)[0]?.trim() ?? ''
  if (/^第[0-9一二三四五六七八九十百千零两]+[章节回卷部篇]/u.test(firstLine)
    || /^Chapter[ \t]+\d+/u.test(firstLine)) {
    return firstLine.length > MAX_TITLE_CHARS ? `${firstLine.slice(0, MAX_TITLE_CHARS)}…` : firstLine
  }
  return `第 ${index} 段`
}
