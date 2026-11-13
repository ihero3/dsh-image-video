/**
 * 剧本拆段：把一整段剧本交给文本模型，按剧情/场景拆成若干可直接生成的分段。
 *
 * 本模块只负责「提示词 + 解析」，不碰宿主服务：拆段请求由 `host/rpc.ts` 发出，
 * 落库由 `WorkbenchStore.createSegment` 完成。提示词与解析放在一起，是为了让
 * 「模型被要求输出什么」与「我们接受什么」在同一处对照，避免两边悄悄分叉。
 *
 * @module dsh-image-video/workbench/script-split
 */

import { MAX_SEGMENT_DURATION_SEC, MIN_SEGMENT_DURATION_SEC } from './episodes.ts'

/** 一次拆段最多接受的段落数：防模型返回超长数组把集记录撑爆。 */
export const MAX_SPLIT_SEGMENTS = 40

/** 送入模型的剧本正文上限（字符）：超出直接拒绝，不静默截断。 */
export const MAX_SPLIT_SCRIPT_CHARS = 20_000

/** 系统提示：把剧本拆成「场景连续、可单独生成」的分段，只输出 JSON。 */
export const SCRIPT_SPLIT_SYSTEM = [
  '你是短剧与短视频的拆段助手。把用户给出的剧本拆成若干「分段」。',
  '每个分段是一个连续场景或一个完整叙事单元，能单独生成一段 5–30 秒的画面。',
  '每段要给出可直接用于生图的画面提示词：写清主体、动作、场景、光线与镜头，不要编号、不要解释。',
  '按剧情自然切分，通常 2–12 段；剧本很短时也要拆成至少 2 段。',
  '只输出 JSON 数组，不要 Markdown 代码块，不要任何前后缀文字。格式：',
  '[{"promptText":"画面提示词","durationSec":5}]',
  'durationSec 是该段建议时长（整数秒，5–30）。',
].join('\n')

/** 一段拆段结果（落库前）。 */
export interface SplitProposal {
  /** 该段的画面提示词。 */
  readonly promptText: string
  /** 建议时长（秒）；模型没给时由宿主按默认值补。 */
  readonly durationSec?: number
}

/**
 * 构造送入模型的一条用户消息正文。
 * @param script - 剧本正文。
 * @returns 带拆段要求的用户输入。
 * @throws {Error} 剧本为空或超过 {@link MAX_SPLIT_SCRIPT_CHARS} 时。
 */
export function buildSplitInput(script: string): string {
  const text = script.trim()
  if (text === '') throw new Error('剧本为空，无法拆段')
  if (text.length > MAX_SPLIT_SCRIPT_CHARS) {
    throw new Error(`剧本超过 ${MAX_SPLIT_SCRIPT_CHARS} 字，请先分段再拆`)
  }
  return `请把下面这段剧本拆成分段：\n\n${text}`
}

/**
 * 从模型输出里解析分段建议。
 *
 * 容忍代码块围栏与前后缀说明：取第一个 `[` 到最后一个 `]` 之间的内容解析；
 * 任何一项缺少非空 `promptText` 就丢弃该项（不编造画面）。
 * @param raw - 模型的原始文本输出。
 * @returns 解析出的分段建议（按模型顺序，最多 {@link MAX_SPLIT_SEGMENTS} 条）。
 * @throws {Error} 找不到 JSON 数组或没有任何合法分段时。
 */
export function parseSplitProposals(raw: string): SplitProposal[] {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON 数组')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch (error) {
    throw new Error(`模型返回的分段不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Array.isArray(parsed)) throw new Error('模型返回的分段不是 JSON 数组')
  const proposals: SplitProposal[] = []
  for (const entry of parsed.slice(0, MAX_SPLIT_SEGMENTS)) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const promptText = record['promptText']
    if (typeof promptText !== 'string' || promptText.trim() === '') continue
    const rawDuration = record['durationSec']
    const durationSec = typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0
      ? Math.min(MAX_SEGMENT_DURATION_SEC, Math.max(MIN_SEGMENT_DURATION_SEC, Math.round(rawDuration)))
      : undefined
    proposals.push({
      promptText: promptText.trim(),
      ...durationSec === undefined ? {} : { durationSec },
    })
  }
  if (proposals.length === 0) throw new Error('模型没有给出可用的分段')
  return proposals
}
