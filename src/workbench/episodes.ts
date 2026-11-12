/**
 * 剧集（project）下的第二层实体：集（episode）→ 分段（segment）→ 分镜（storyboard / shot）。
 *
 * 边界（与重构任务书一致）：素材库是全局的，集里只存引用 id；剧集资源库按集引用，
 * 同样只存引用，不复制本体。本文件只有纯数据与校验，不碰文件系统。
 */
import { newWorkbenchId, WORKBENCH_SCHEMA_VERSION, type ResourceKind } from './records.ts'

/** 集内引用的分类：剧集资源库的固定分类 + 未分组。 */
export type EpisodeRefCategory = ResourceKind | 'ungrouped'

/** 集级引用可选的固定分类（顺序即界面分组顺序）。 */
export const EPISODE_REF_CATEGORIES: readonly EpisodeRefCategory[] = [
  'role', 'costume', 'voice', 'motion-track', 'scene', 'prop', 'style', 'ungrouped',
]

/** 引用没写分类时落到「未分组」。 */
export const DEFAULT_EPISODE_REF_CATEGORY: EpisodeRefCategory = 'ungrouped'

/** 分段时长常用档位（界面快捷按钮），数据层允许 1–60。 */
export const SEGMENT_DURATION_PRESETS: readonly number[] = [5, 10, 20, 30]

/** 分段时长下限（秒）。 */
export const MIN_SEGMENT_DURATION_SEC = 1

/** 分段时长上限（秒）。 */
export const MAX_SEGMENT_DURATION_SEC = 60

/** 集标题上限。 */
export const MAX_EPISODE_TITLE_LENGTH = 80

/** 集备注上限。 */
export const MAX_EPISODE_REMARK_LENGTH = 500

/** 剧本正文上限（字符）。 */
export const MAX_SCRIPT_LENGTH = 200_000

/** 一条分段提示词上限。 */
export const MAX_SEGMENT_PROMPT_LENGTH = 20_000

/** 集内顺序号从 1 起。 */
export const FIRST_ORDER = 1

/** 本集独立的剧本。 */
export interface EpisodeScript {
  readonly text: string
  readonly updatedAt: string
}

/** 集对剧集资源库的引用（只存 id，不复制素材本体）。 */
export interface EpisodeResourceRef {
  readonly resourceId: string
  readonly category: EpisodeRefCategory
  readonly order: number
}

/** 集对全局素材库的引用（只存 id）。 */
export interface EpisodeAssetRef {
  readonly assetId: string
  readonly category: EpisodeRefCategory
  readonly order: number
}

/** 分段 / 分镜里的引用项；`order` 与正文里的 `[@n]` 一一对应。 */
export interface SegmentRef {
  readonly kind: 'resource' | 'asset'
  readonly id: string
  readonly order: number
}

/** 一个分镜镜头。 */
export interface ShotRecord {
  readonly id: string
  readonly order: number
  readonly durationSec: number
  readonly imagePrompt: string
  readonly videoPrompt: string
  readonly imageModel?: string
  readonly videoModel?: string
  readonly refs: readonly SegmentRef[]
}

/** 一个分段对应的一组分镜。 */
export interface StoryboardRecord {
  readonly schemaVersion: number
  readonly id: string
  readonly episodeId: string
  readonly segmentId: string
  readonly skillId?: string
  readonly shots: readonly ShotRecord[]
  readonly updatedAt: string
}

/** 一条带时长的提示词。 */
export interface SegmentRecord {
  readonly id: string
  readonly episodeId: string
  readonly order: number
  readonly durationSec: number
  readonly promptText: string
  readonly imageModel?: string
  readonly videoModel?: string
  readonly skillId?: string
  readonly refs: readonly SegmentRef[]
  readonly storyboardId?: string
}

/** 一集：剧本、分段、分镜与两类引用的容器。 */
export interface EpisodeRecord {
  readonly schemaVersion: number
  readonly id: string
  readonly projectId: string
  readonly no: number
  readonly title: string
  readonly remark?: string
  readonly script: EpisodeScript
  readonly segments: readonly SegmentRecord[]
  readonly storyboards: readonly StoryboardRecord[]
  readonly resourceRefs: readonly EpisodeResourceRef[]
  readonly assetRefs: readonly EpisodeAssetRef[]
  readonly createdAt: string
  readonly updatedAt: string
}

/** 建集时的可选输入。 */
export interface EpisodeInput {
  readonly title?: unknown
  readonly no?: unknown
}

/** 建分段时的可选输入。 */
export interface SegmentInput {
  readonly promptText?: unknown
  readonly durationSec?: unknown
  readonly order?: unknown
  readonly imageModel?: unknown
  readonly videoModel?: unknown
  readonly skillId?: unknown
  readonly refs?: unknown
}

/** 改分段的可选字段。 */
export interface SegmentPatch extends SegmentInput {
  readonly episodeId?: string
}

/** 改集的可选字段；`script` 可以是正文，也可以是首轮解析出的对象。 */
export interface EpisodePatch {
  readonly title?: unknown
  readonly remark?: unknown
  readonly script?: unknown
}

/** 集级引用的四类动作。 */
export type EpisodeRefAction = 'list' | 'add' | 'remove' | 'move'

/** 集级引用动作的入参（资源库与素材库共用）。 */
export interface EpisodeRefInput {
  readonly resourceId?: unknown
  readonly assetId?: unknown
  readonly category?: unknown
  readonly order?: unknown
}

/** 写分镜的入参；`id` 缺省表示新建。 */
export interface StoryboardInput {
  readonly id?: string
  readonly episodeId?: string
  readonly segmentId: string
  readonly skillId?: unknown
  readonly shots: unknown
}

/**
 * 校验集标题。
 * @param value - 原始输入；缺省时按集号生成默认标题。
 * @param no - 集号，用于默认标题。
 * @returns 去空白后的标题。
 * @throws {Error} 非字符串、为空或超长时。
 */
export function normalizeEpisodeTitle(value: unknown, no: number): string {
  if (value === undefined || value === null || value === '') return `第${no}集`
  if (typeof value !== 'string') throw new Error('集标题必须是字符串')
  const title = value.trim()
  if (title === '') return `第${no}集`
  if (title.length > MAX_EPISODE_TITLE_LENGTH) {
    throw new Error(`集标题最多 ${MAX_EPISODE_TITLE_LENGTH} 个字符（收到 ${title.length}）`)
  }
  return title
}

/**
 * 校验集号。
 * @param value - 原始输入；缺省时用调用方算出的下一个集号。
 * @param fallback - 缺省值。
 * @returns 正整数集号。
 * @throws {Error} 非正整数时。
 */
export function normalizeEpisodeNo(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < FIRST_ORDER) {
    throw new Error('集号必须是正整数')
  }
  return value
}

/**
 * 校验分段时长。
 * @param value - 原始输入；缺省时用默认 5 秒。
 * @returns 1–60 的整数秒。
 * @throws {Error} 非数字或越界时（越界一律拒，不做静默截断）。
 */
export function normalizeSegmentDuration(value: unknown): number {
  if (value === undefined || value === null) return SEGMENT_DURATION_PRESETS[0]!
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('分段时长必须是数字')
  const seconds = Math.round(value)
  if (seconds < MIN_SEGMENT_DURATION_SEC || seconds > MAX_SEGMENT_DURATION_SEC) {
    throw new Error(`分段时长必须在 ${MIN_SEGMENT_DURATION_SEC}–${MAX_SEGMENT_DURATION_SEC} 秒之间`)
  }
  return seconds
}

/**
 * 校验剧本正文。
 * @param value - 原始输入。
 * @returns 正文。
 * @throws {Error} 非字符串或超长时。
 */
export function normalizeScriptText(value: unknown): string {
  if (typeof value !== 'string') throw new Error('剧本正文必须是字符串')
  if (value.length > MAX_SCRIPT_LENGTH) {
    throw new Error(`剧本正文最多 ${MAX_SCRIPT_LENGTH} 个字符（收到 ${value.length}）`)
  }
  return value
}

/**
 * 校验备注。
 * @param value - 原始输入；空串表示清空备注。
 * @returns 去空白后的备注，空串返回 undefined。
 * @throws {Error} 非字符串或超长时。
 */
export function normalizeRemark(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error('集备注必须是字符串')
  const remark = value.trim()
  if (remark === '') return undefined
  if (remark.length > MAX_EPISODE_REMARK_LENGTH) {
    throw new Error(`集备注最多 ${MAX_EPISODE_REMARK_LENGTH} 个字符（收到 ${remark.length}）`)
  }
  return remark
}

/**
 * 校验一条可选的模型 / 技能 id。
 * @param value - 原始输入；空串表示「跟随默认」。
 * @returns 去空白后的 id，空串返回 undefined。
 * @throws {Error} 非字符串时。
 */
export function normalizeOptionalId(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(`${label}必须是字符串`)
  const id = value.trim()
  return id === '' ? undefined : id
}

/**
 * 校验提示词正文。
 * @param value - 原始输入。
 * @returns 正文（允许为空）。
 * @throws {Error} 非字符串或超长时。
 */
export function normalizePromptText(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new Error('提示词正文必须是字符串')
  if (value.length > MAX_SEGMENT_PROMPT_LENGTH) {
    throw new Error(`提示词最多 ${MAX_SEGMENT_PROMPT_LENGTH} 个字符（收到 ${value.length}）`)
  }
  return value
}

/**
 * 校验引用分类。
 * @param value - 原始输入；缺省落到「未分组」。
 * @returns 固定分类之一。
 * @throws {Error} 不在白名单时。
 */
export function normalizeEpisodeRefCategory(value: unknown): EpisodeRefCategory {
  if (value === undefined || value === null || value === '') return DEFAULT_EPISODE_REF_CATEGORY
  if (typeof value !== 'string') throw new Error('引用分类必须是字符串')
  const category = EPISODE_REF_CATEGORIES.find(candidate => candidate === value)
  if (category === undefined) {
    throw new Error(`引用分类必须是 ${EPISODE_REF_CATEGORIES.join('/')} 之一`)
  }
  return category
}

/**
 * 校验引用项数组；按 `order` 排序后重排为 1..n，保证正文 `[@n]` 连续。
 * @param value - 原始输入；缺省表示无引用。
 * @returns 规范化后的引用项。
 * @throws {Error} 结构不合法时。
 */
export function normalizeSegmentRefs(value: unknown): SegmentRef[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error('refs 必须是数组')
  const refs = value.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null) throw new Error(`refs[${index}] 必须是对象`)
    const entry = raw as Record<string, unknown>
    if (entry.kind !== 'resource' && entry.kind !== 'asset') throw new Error(`refs[${index}].kind 必须是 resource 或 asset`)
    const kind: SegmentRef['kind'] = entry.kind === 'resource' ? 'resource' : 'asset'
    if (typeof entry.id !== 'string' || entry.id.trim() === '') throw new Error(`refs[${index}].id 必须是非空字符串`)
    const order = typeof entry.order === 'number' && Number.isInteger(entry.order) && entry.order >= FIRST_ORDER
      ? entry.order
      : FIRST_ORDER
    return { kind, id: entry.id.trim(), order }
  })
  return refs
    .sort((left, right) => left.order - right.order)
    .map((ref, index) => ({ ...ref, order: index + FIRST_ORDER }))
}

/**
 * 校验分镜镜头数组；同样按 order 重排为 1..n。
 * @param value - 原始输入。
 * @returns 规范化后的镜头。
 * @throws {Error} 结构不合法时。
 */
export function normalizeShots(value: unknown): ShotRecord[] {
  if (!Array.isArray(value)) throw new Error('shots 必须是数组')
  const shots = value.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null) throw new Error(`shots[${index}] 必须是对象`)
    const entry = raw as Record<string, unknown>
    const id = typeof entry.id === 'string' && entry.id.trim() !== '' ? entry.id.trim() : newWorkbenchId('shot')
    const order = typeof entry.order === 'number' && Number.isInteger(entry.order) && entry.order >= FIRST_ORDER
      ? entry.order
      : index + FIRST_ORDER
    const imageModel = normalizeOptionalId(entry.imageModel, '镜头图片模型')
    const videoModel = normalizeOptionalId(entry.videoModel, '镜头视频模型')
    return {
      id,
      order,
      durationSec: normalizeSegmentDuration(entry.durationSec),
      imagePrompt: normalizePromptText(entry.imagePrompt),
      videoPrompt: normalizePromptText(entry.videoPrompt),
      ...imageModel === undefined ? {} : { imageModel },
      ...videoModel === undefined ? {} : { videoModel },
      refs: normalizeSegmentRefs(entry.refs),
    }
  })
  return shots
    .sort((left, right) => left.order - right.order)
    .map((shot, index) => ({ ...shot, order: index + FIRST_ORDER }))
}

/**
 * 本集总时长：所有分段时长之和。
 * @param segments - 分段列表。
 * @returns 秒数。
 */
export function episodeDurationSec(segments: readonly SegmentRecord[]): number {
  return segments.reduce((total, segment) => total + segment.durationSec, 0)
}

/**
 * 下一个可用顺序号（列表末尾 +1）。
 * @param items - 已有条目。
 * @returns `items.length + 1`。
 */
export function nextOrder(items: readonly { readonly order: number }[]): number {
  return items.length === 0 ? FIRST_ORDER : Math.max(...items.map(item => item.order)) + FIRST_ORDER
}

/**
 * 按给定 id 顺序重排，并重编号 1..n；缺项 / 多项 / 未知 id 一律拒。
 * @param items - 现有条目。
 * @param order - 目标顺序（id 数组）。
 * @param label - 错误信息里的实体名。
 * @returns 重排后的条目。
 * @throws {Error} 顺序数组不完整或含未知 id 时。
 */
export function applyReorder<T extends { readonly id: string }>(items: readonly T[], order: readonly string[], label: string): T[] {
  if (items.length !== order.length) throw new Error(`${label}排序必须包含全部 ${items.length} 项（收到 ${order.length}）`)
  const known = new Set(items.map(item => item.id))
  for (const id of order) if (!known.has(id)) throw new Error(`${label}排序里含有未知 id：${id}`)
  return order.map(id => items.find(item => item.id === id) as T)
}

/**
 * 空集的默认剧本。
 * @param stamp - 创建时间。
 * @returns 剧本记录。
 */
export function emptyScript(stamp: string): EpisodeScript {
  return { text: '', updatedAt: stamp }
}

/**
 * 新建一条分段的默认值。
 * @param episodeId - 所属集。
 * @returns 分段骨架（顺序与时长由调用方覆盖）。
 */
export function emptySegment(episodeId: string): SegmentRecord {
  return {
    id: newWorkbenchId('seg'),
    episodeId,
    order: FIRST_ORDER,
    durationSec: SEGMENT_DURATION_PRESETS[0]!,
    promptText: '',
    refs: [],
  }
}

/**
 * 新建集的骨架（不含时间戳，由 store 填充）。
 * @param projectId - 所属剧集。
 * @param no - 集号。
 * @param title - 已校验的标题。
 * @param stamp - 创建 / 更新时间。
 * @returns 集记录。
 */
export function newEpisode(projectId: string, no: number, title: string, stamp: string): EpisodeRecord {
  return {
    schemaVersion: WORKBENCH_SCHEMA_VERSION,
    id: newWorkbenchId('ep'),
    projectId,
    no,
    title,
    script: emptyScript(stamp),
    segments: [],
    storyboards: [],
    resourceRefs: [],
    assetRefs: [],
    createdAt: stamp,
    updatedAt: stamp,
  }
}
