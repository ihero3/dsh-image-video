/**
 * 剧本实体提取（角色 / 场景 / 道具·服装，`B-23`）。
 *
 * 剧本生成页的三个提取分区共用一套流程：把当前集剧本交给文本模型，要它返回
 * `[{"name","note"}]` 的 JSON。本模块只有提示词与解析，模型调用在 `host/rpc.ts`，
 * 入库由客户端逐条调 `resources/create`（用户能看到并挑选每一条）。
 *
 * @module dsh-image-video/workbench/entity-extract
 */

/** 提取分区：对应剧本生成页的三个提取标签页。 */
export type ExtractCategory = 'role' | 'scene' | 'prop'

/** 一次最多保留多少条：超出截断，避免模型复读把列表撑爆。 */
export const MAX_EXTRACT_ITEMS = 20

/** 一条提取结果。 */
export interface ExtractItem {
  /** 实体名称（角色名 / 地点名 / 道具名）。 */
  readonly name: string
  /** 可直接当资源备注与出图提示词用的说明；模型没给时为空串。 */
  readonly note: string
}

/** 分区 → 写进提示词的提取要求。 */
const CATEGORY_BRIEF: Record<ExtractCategory, string> = {
  role: '提取剧本里出现的所有角色（人物）。同一角色的别名合并成一条；说明写外形、年龄、气质、服装等能直接用于定妆照的要点。',
  scene: '提取剧本里出现的所有场景与地点。同一地点的不同时间算同一条；说明写时间、光线、氛围、陈设与可用的镜头角度。',
  prop: '提取剧本里出现的所有道具与服装。说明写外观、材质、颜色与谁在用；服装要写清穿着者。',
}

/**
 * 拼一次提取请求的提示词。
 * @param script - 剧本原文（调用方保证非空）。
 * @param category - 提取分区。
 * @returns 交给文本模型的完整提示词。
 */
export function buildExtractPrompt(script: string, category: ExtractCategory): string {
  return [
    CATEGORY_BRIEF[category],
    '只输出 JSON 数组，不要解释、不要 Markdown 代码块；每条形如 {"name":"名称","note":"一句话说明"}。',
    `最多 ${MAX_EXTRACT_ITEMS} 条；剧本里没有的不要编。`,
    '',
    '剧本：',
    script.trim(),
  ].join('\n')
}

/** 从模型输出里取出 JSON 数组（容忍代码块围栏与前后废话）。 */
function readJsonArray(raw: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)
  const text = (fenced?.[1] ?? raw).trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) throw new Error('模型返回的结构里没有条目')
  const parsed: unknown = JSON.parse(text.slice(start, end + 1))
  return parsed
}

/** 一条候选是否可读：名字非空，说明允许缺失。 */
function readItem(entry: unknown): ExtractItem | undefined {
  if (typeof entry !== 'object' || entry === null) return undefined
  const record = entry as Record<string, unknown>
  const name = typeof record['name'] === 'string' ? record['name'].trim() : ''
  if (name === '') return undefined
  const note = typeof record['note'] === 'string'
    ? record['note'].trim()
    : typeof record['description'] === 'string' ? record['description'].trim() : ''
  return { name, note }
}

/**
 * 解析提取结果：去空名、按名称去重、截断到上限。
 * @param raw - 模型输出原文。
 * @returns 可入库的条目（至少一条）。
 * @throws {Error} 输出里没有 JSON 数组，或解析后没有可用条目时。
 */
export function parseExtractItems(raw: string): ExtractItem[] {
  const parsed = readJsonArray(raw)
  if (!Array.isArray(parsed)) throw new Error('模型返回的结构里没有条目')
  const seen = new Set<string>()
  const items: ExtractItem[] = []
  for (const entry of parsed) {
    const item = readItem(entry)
    if (item === undefined || seen.has(item.name)) continue
    seen.add(item.name)
    items.push(item)
    if (items.length >= MAX_EXTRACT_ITEMS) break
  }
  if (items.length === 0) throw new Error('模型没有返回可用的条目')
  return items
}
