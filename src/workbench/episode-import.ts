/**
 * 单集导入：`exportEpisode` 产出的 `episode.json` → 一份全新的集。
 *
 * 三条硬规则：
 * 1. 只新建，不覆盖。导入做不到"猜哪集该被替换"，新建 + 集号追加永远不毁现有内容。
 * 2. 实例 id 全量重发（集 / 分段 / 分镜 / 镜头），顺序、文本、时长与引用内容原样保留；
 *    跨项目复用时不会和源项目的 id 撞车。
 * 3. 清单里只有素材的**记录**、没有素材**字节**：引用照常带过来，但如实给出提示，
 *    不假装文件已经到位。
 *
 * v1 清单没有 storyboards（分镜镜头），按"只有剧本与分段"导入并写入 warnings；
 * v2 起导出完整集，roundtrip 能还原分镜。
 *
 * @module dsh-image-video/workbench/episode-import
 */

import { WORKBENCH_SCHEMA_VERSION, newWorkbenchId } from './records.ts'
import {
  DEFAULT_EPISODE_REF_CATEGORY, FIRST_ORDER, normalizeEpisodeNo, normalizeEpisodeRefCategory,
  normalizeEpisodeTitle, normalizeOptionalId, normalizePromptText, normalizeScriptText,
  normalizeSegmentDuration, normalizeSegmentRefs, normalizeShots,
  type EpisodeAssetRef, type EpisodeRecord, type EpisodeRefCategory,
  type EpisodeResourceRef, type SegmentRecord, type StoryboardRecord,
} from './episodes.ts'
import { EPISODE_EXPORT_VERSION } from './episode-export.ts'

/** 可导入的清单版本（v1 缺分镜，仍兼容，只是给出提示）。 */
export const SUPPORTED_EPISODE_IMPORT_VERSIONS: readonly number[] = [1, EPISODE_EXPORT_VERSION]

/** 导入结果。 */
export interface EpisodeImportResult {
  readonly episode: EpisodeRecord
  /** 清单不完整 / 素材文件未随行等非致命提示，照实交给界面展示。 */
  readonly warnings: readonly string[]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label}必须是字符串`)
  return value
}

function numberField(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label}必须是数字`)
  return value
}

/**
 * 集级引用（资源 / 素材）：清单里只存 id，导入按目标项目的库做弱引用，
 * 不因为目标项目还没有同名资源就拒绝导入。
 */
function normalizeRefList(
  value: unknown,
  label: string,
  idField: 'resourceId' | 'assetId',
): { readonly id: string; readonly order: number; readonly category: EpisodeRefCategory }[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error(`${label}必须是数组`)
  return value.map((raw, index) => {
    if (!isObject(raw)) throw new Error(`${label}[${index}]必须是对象`)
    const id = normalizeOptionalId(raw[idField], `${label}[${index}].${idField}`)
    if (id === undefined) throw new Error(`${label}[${index}].${idField} 不能为空`)
    const category = raw['category'] === undefined
      ? DEFAULT_EPISODE_REF_CATEGORY
      : normalizeEpisodeRefCategory(raw['category'])
    const order = typeof raw['order'] === 'number' && Number.isInteger(raw['order']) && raw['order'] >= FIRST_ORDER
      ? raw['order'] : index + FIRST_ORDER
    return { id, category, order }
  }).sort((left, right) => left.order - right.order)
    .map((entry, index) => ({ ...entry, order: index + FIRST_ORDER }))
}

/**
 * 把清单还原成一份新的集记录。
 * @param input.manifest - 已 JSON.parse 的清单内容（原始文本由 RPC 层解析）。
 * @param input.projectId - 导入目标剧集。
 * @param input.no - 目标集号（由调用方按剧集内最大值算出）。
 * @param input.stamp - 时间戳（测试注入）。
 * @throws {Error} 清单格式、版本、字段不合法时；不合法的清单不允许半途入库。
 */
export function buildImportedEpisode(input: {
  readonly manifest: unknown
  readonly projectId: string
  readonly no: number
  readonly stamp: string
}): EpisodeImportResult {
  const raw = input.manifest
  if (!isObject(raw)) throw new Error('清单不是合法的 JSON 对象')
  if (raw['plugin'] !== 'dsh-image-video') throw new Error('不是 dsh-image-video 的单集清单')
  const version = numberField(raw['formatVersion'], '清单版本')
  if (!SUPPORTED_EPISODE_IMPORT_VERSIONS.includes(version)) {
    throw new Error(`不支持的清单版本 ${version}（支持 ${SUPPORTED_EPISODE_IMPORT_VERSIONS.join(' / ')}）`)
  }
  const source = raw['episode']
  if (!isObject(source)) throw new Error('清单缺少 episode')

  const no = normalizeEpisodeNo(input.no, input.no)
  const stamp = input.stamp
  const warnings: string[] = []
  const episodeId = newWorkbenchId('ep')
  const script = normalizeScriptText(source['script'])
  const title = normalizeEpisodeTitle(source['title'], no)
  const remark = normalizeOptionalId(source['remark'], '集备注')

  const rawSegments = raw['segments']
  if (!Array.isArray(rawSegments)) throw new Error('清单 segments 必须是数组')
  const segmentIdMap = new Map<string, string>()
  const drafts = rawSegments.map((entry, index) => {
    if (!isObject(entry)) throw new Error(`segments[${index}] 必须是对象`)
    const oldId = stringField(entry['id'], `segments[${index}].id`)
    const newId = newWorkbenchId('seg')
    segmentIdMap.set(oldId, newId)
    const imageModel = normalizeOptionalId(entry['imageModel'], '分段图片模型')
    const videoModel = normalizeOptionalId(entry['videoModel'], '分段视频模型')
    const textModel = normalizeOptionalId(entry['textModel'], '分段文本模型')
    const skillId = normalizeOptionalId(entry['skillId'], '分段技能')
    const oldStoryboardId = normalizeOptionalId(entry['storyboardId'], `segments[${index}].storyboardId`)
    const segment: SegmentRecord = {
      id: newId,
      episodeId,
      order: typeof entry['order'] === 'number' && Number.isInteger(entry['order']) && entry['order'] >= FIRST_ORDER
        ? entry['order'] : index + FIRST_ORDER,
      durationSec: normalizeSegmentDuration(entry['durationSec']),
      promptText: normalizePromptText(entry['promptText']),
      ...imageModel === undefined ? {} : { imageModel },
      ...videoModel === undefined ? {} : { videoModel },
      ...textModel === undefined ? {} : { textModel },
      ...skillId === undefined ? {} : { skillId },
      refs: normalizeSegmentRefs(entry['refs']),
    }
    return { segment, oldStoryboardId }
  })

  const rawStoryboards = raw['storyboards']
  if (version < 2) warnings.push('这份清单是旧格式（v1），不含分镜镜头：已导入剧本与分段，分镜需重新拆分')
  if (rawStoryboards !== undefined && !Array.isArray(rawStoryboards)) throw new Error('清单 storyboards 必须是数组')
  const storyboardIdMap = new Map<string, string>()
  const storyboards: StoryboardRecord[] = (rawStoryboards ?? []).map((entry, index) => {
    if (!isObject(entry)) throw new Error(`storyboards[${index}] 必须是对象`)
    const oldId = stringField(entry['id'], `storyboards[${index}].id`)
    const newId = newWorkbenchId('sb')
    storyboardIdMap.set(oldId, newId)
    const oldSegmentId = stringField(entry['segmentId'], `storyboards[${index}].segmentId`)
    const segmentId = segmentIdMap.get(oldSegmentId)
    if (segmentId === undefined) throw new Error(`storyboards[${index}] 指向未知分段 ${oldSegmentId}`)
    const skillId = normalizeOptionalId(entry['skillId'], '分镜技能')
    // normalizeShots 会保留传入 id；强制换新，避免跨项目实例 id 冲突。
    const shots = normalizeShots(Array.isArray(entry['shots'])
      ? entry['shots'].map(shot => isObject(shot) ? { ...shot, id: newWorkbenchId('shot') } : shot)
      : entry['shots'])
    return {
      schemaVersion: WORKBENCH_SCHEMA_VERSION,
      id: newId,
      episodeId,
      segmentId,
      ...skillId === undefined ? {} : { skillId },
      shots,
      updatedAt: stamp,
    }
  })
  // 分段的 storyboardId 指向旧 id，导入后必须换成新 id，否则界面找不到分镜。
  const segments: SegmentRecord[] = drafts.map(({ segment, oldStoryboardId }) => {
    if (oldStoryboardId === undefined) return segment
    const storyboardId = storyboardIdMap.get(oldStoryboardId)
    return storyboardId === undefined ? segment : { ...segment, storyboardId }
  })

  const resources = normalizeRefList(raw['resourceRefs'], '清单 resourceRefs', 'resourceId')
  const assets = normalizeRefList(raw['assetRefs'], '清单 assetRefs', 'assetId')
  const resourceRefs: EpisodeResourceRef[] = resources.map(ref => ({ resourceId: ref.id, category: ref.category, order: ref.order }))
  const assetRefs: EpisodeAssetRef[] = assets.map(ref => ({ assetId: ref.id, category: ref.category, order: ref.order }))
  const files = raw['files']
  const missing = raw['missing']
  if ((Array.isArray(files) && files.length > 0) || (Array.isArray(missing) && missing.length > 0)) {
    warnings.push('清单只记录素材引用，不含素材文件：请在素材库重新关联图片 / 视频')
  }

  const episode: EpisodeRecord = {
    schemaVersion: WORKBENCH_SCHEMA_VERSION,
    id: episodeId,
    projectId: input.projectId,
    no,
    title,
    ...remark === undefined ? {} : { remark },
    script: { text: script, updatedAt: stamp },
    segments,
    storyboards,
    resourceRefs,
    assetRefs,
    createdAt: stamp,
    updatedAt: stamp,
  }
  return { episode, warnings }
}
