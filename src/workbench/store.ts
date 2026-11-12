/**
 * File-backed workbench store: one JSON document under the plugin's own data
 * directory, written atomically (tmp + rename) so a crash never leaves a
 * half-written project file behind.
 *
 * The store owns *records*, not files: registering an asset records the path of a
 * file that already exists under the output directory, and removing an asset (or
 * a project) removes records only — deleting media is a separate, explicit act
 * (`D2`: hard delete with a confirmation, and never a cascade over user files).
 */
import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  newWorkbenchId, normalizeMediaKind, normalizeProjectName, normalizeTaskStatus, WORKBENCH_SCHEMA_VERSION,
  normalizeKeyframes, normalizeResourceFolder, normalizeResourceKind, normalizeResourceName, normalizeResourceScope,
  type AssetRecord, type MediaKind, type ProjectRecord, type ResourceKind, type ResourceRecord,
  type TaskRecord, type TaskStatus,
} from './records.ts'
import { normalizeGraph, type WorkflowRecord, type WorkflowRunNodeRecord, type WorkflowRunRecord } from './workflow.ts'
import { MAX_NODE_CACHE, type CachedNodeResult } from './node-cache.ts'
import type { ExportPresetRecord, ResourceUsageRecord } from './records.ts'
import { planArchive } from './archive.ts'
import { inspectIntegrity } from './integrity.ts'
import { duplicateTimeline, DEFAULT_FRAME_RATE, normalizeExportFormat, normalizeTimelineTracks, type TimelineRecord, type TimelineTrack } from './timeline.ts'
import { buildEpisodeWorkflow } from './storyboard-workflow.ts'
import { describeReferences, findAssetReferences, findResourceReferences } from './references.ts'
import {
  applyReorder, DEFAULT_EPISODE_REF_CATEGORY, emptySegment, EPISODE_REF_CATEGORIES, FIRST_ORDER, newEpisode, nextOrder,
  normalizeEpisodeNo, normalizeEpisodeRefCategory, normalizeEpisodeTitle, normalizeOptionalId,
  normalizePromptText, normalizeRemark, normalizeScriptText, normalizeSegmentDuration, normalizeSegmentRefs,
  normalizeShots, type EpisodeAssetRef, type EpisodeInput, type EpisodePatch, type EpisodeRecord,
  type EpisodeRefAction, type EpisodeRefInput, type EpisodeRefCategory, type EpisodeResourceRef,
  type SegmentInput, type SegmentPatch, type SegmentRecord, type StoryboardInput, type StoryboardRecord,
} from './episodes.ts'

/** One stored document: every project and asset the workbench knows about. */
interface WorkbenchDocument {
  schemaVersion: number
  projects: ProjectRecord[]
  assets: AssetRecord[]
  /** Generation history; kept when a project is removed (the file still exists). */
  tasks: TaskRecord[]
  /** Reusable creative resources (roles, scenes, props, brands, styles, voices). */
  resources: ResourceRecord[]
  /** Workflow documents (one per project, plus copies the user made). */
  workflows: WorkflowRecord[]
  /** Workflow runs, newest last (bounded when written). */
  runs: WorkflowRunRecord[]
  /** Timeline documents (阶段 5). */
  timelines: TimelineRecord[]
  /** 跨运行的成功结果缓存（`R-FLW-5`），按 at 淘汰。 */
  nodeCache: CachedNodeResult[]
  /** 资源使用记录（`R-QCK-3`）。 */
  resourceUsage: ResourceUsageRecord[]
  /** 用户自定义导出预设（`A48`）。 */
  exportPresets: ExportPresetRecord[]
  /** 集（episode）：剧集下的第二层实体，含分段与分镜。 */
  episodes: EpisodeRecord[]
}

/** Facts the store is constructed with. */
export interface WorkbenchStoreOptions {
  /** Directory holding `workbench.json` (created on first write). */
  readonly directory: string
  /** Clock override, for deterministic tests. */
  readonly now?: () => Date
}

/** What the host records when a generation call finishes. */
export interface TaskInput {
  readonly kind: MediaKind | string
  readonly status: TaskStatus | string
  readonly provider?: string
  readonly model?: string
  readonly prompt?: string
  readonly outputPath?: string
  readonly bytes?: number
  readonly projectId?: string
  readonly episodeId?: string
  readonly segmentId?: string
  readonly shotId?: string
  readonly error?: string
  /** When the call started (defaults to now). */
  readonly startedAt?: string
}

/** What may be changed on an existing task afterwards. */
export interface TaskPatch {
  readonly status?: TaskStatus | string
  readonly outputPath?: string
  readonly bytes?: number
  readonly projectId?: string
  readonly episodeId?: string
  readonly segmentId?: string
  readonly shotId?: string
  readonly error?: string
}

/** What the client may register as an asset. */
export interface AssetInput {
  readonly projectId: string
  readonly path: string
  readonly kind: MediaKind | string
  readonly bytes?: number
  readonly provider?: string
  readonly model?: string
  readonly prompt?: string
}

/**
 * Projects and assets on disk.
 */
/** 任务账本最多保留多少条（规模化：账本只留最近这批，避免 JSON 无界膨胀）。 */
export const MAX_TASKS = 1000

/** 空文档（首次启动、旧版本留证后重开、坏文件兜底共用一份定义）。 */
function emptyDocument(): WorkbenchDocument {
  return {
    schemaVersion: WORKBENCH_SCHEMA_VERSION, projects: [], assets: [], tasks: [], resources: [], workflows: [],
    runs: [], timelines: [], nodeCache: [], resourceUsage: [], exportPresets: [], episodes: [],
  }
}

export class WorkbenchStore {
  /** Absolute directory holding the document. */
  readonly directory: string
  private readonly file: string
  private readonly now: () => Date
  private cache: WorkbenchDocument | undefined
  /** Shared first read: concurrent mutations must land on one document, not one copy each. */
  private loading: Promise<WorkbenchDocument> | undefined
  /** Serializes writes so concurrent mutations cannot interleave on the same temporary file. */
  private writes: Promise<void> = Promise.resolve()
  /** Distinguishes temporary files written by queued saves within this process. */
  private writeSequence = 0
  /** 真实落盘次数（压测与诊断用；`A8`/`A9`）。 */
  writeCount = 0
  /** 上次成功落盘的内容（相同则跳过写盘） */
  private lastSerialized: string | undefined

  /**
   * @param options - directory and optional clock.
   */
  constructor(options: WorkbenchStoreOptions) {
    this.directory = options.directory
    this.file = join(options.directory, 'workbench.json')
    this.now = options.now ?? (() => new Date())
  }

  /** Read every project, newest first. */
  async listProjects(): Promise<ProjectRecord[]> {
    const document = await this.load()
    return [...document.projects].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  /**
   * Create a project.
   * @param name - user-supplied name (trimmed, validated).
   * @returns the stored record.
   */
  async createProject(name: unknown): Promise<ProjectRecord> {
    const document = await this.load()
    const stamp = this.now().toISOString()
    const project: ProjectRecord = {
      schemaVersion: WORKBENCH_SCHEMA_VERSION,
      id: newWorkbenchId('prj'),
      name: normalizeProjectName(name),
      createdAt: stamp,
      updatedAt: stamp,
    }
    document.projects.push(project)
    await this.save(document)
    return project
  }

  /**
   * Remove a project and its asset records (never the media files themselves).
   * @param id - project id.
   * @returns `true` when a project was removed.
   */
  async removeProject(id: string): Promise<boolean> {
    const document = await this.load()
    const before = document.projects.length
    document.projects = document.projects.filter(project => project.id !== id)
    if (document.projects.length === before) return false
    document.assets = document.assets.filter(asset => asset.projectId !== id)
    document.resources = document.resources.filter(resource => resource.projectId !== id)
    document.workflows = document.workflows.filter(workflow => workflow.projectId !== id)
    document.runs = document.runs.filter(run => run.projectId !== id)
    document.timelines = document.timelines.filter(timeline => timeline.projectId !== id)
    document.resourceUsage = document.resourceUsage.filter(usage => usage.projectId !== id)
    await this.save(document)
    return true
  }

  /**
   * List assets, newest first.
   * @param projectId - 来源剧集；缺省时返回全局素材库（素材库对所有剧集可见）。
   * @returns the asset records.
   */
  async listAssets(projectId?: string): Promise<AssetRecord[]> {
    const document = await this.load()
    return document.assets
      .filter(asset => projectId === undefined || asset.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  /**
   * Register an existing file as an asset of a project.
   *
   * Idempotent per (project, path): registering the same file twice returns the
   * existing record, so double-clicking "register" cannot produce two assets for
   * one file.
   * @param input - project, path and media facts.
   * @returns the record, plus whether this call created it.
   * @throws {Error} when the project is unknown.
   */
  async attachAsset(input: AssetInput): Promise<{ asset: AssetRecord; created: boolean }> {
    const document = await this.load()
    const project = document.projects.find(candidate => candidate.id === input.projectId)
    if (project === undefined) throw new Error(`unknown project: ${input.projectId}`)
    const existing = document.assets.find(asset => asset.projectId === project.id && asset.path === input.path)
    if (existing !== undefined) return { asset: existing, created: false }
    const asset: AssetRecord = {
      schemaVersion: WORKBENCH_SCHEMA_VERSION,
      id: newWorkbenchId('ast'),
      projectId: project.id,
      kind: normalizeMediaKind(input.kind),
      path: input.path,
      bytes: input.bytes ?? 0,
      createdAt: this.now().toISOString(),
      ...input.provider === undefined ? {} : { provider: input.provider },
      ...input.model === undefined ? {} : { model: input.model },
      ...input.prompt === undefined ? {} : { prompt: input.prompt },
    }
    document.assets.push(asset)
    // 记录是只读的：替换整条而不是改字段
    document.projects = document.projects.map(candidate =>
      candidate.id === project.id ? { ...candidate, updatedAt: asset.createdAt } : candidate)
    await this.save(document)
    return { asset, created: true }
  }

  /**
   * Remove one asset record.
   * @param id - asset id.
   * @returns `true` when a record was removed.
   */
  async removeAsset(id: string, options: { force?: boolean } = {}): Promise<boolean> {
    const document = await this.load()
    const asset = document.assets.find(candidate => candidate.id === id)
    if (asset === undefined) return false
    // 被引用就先拦下，并把"谁在引用"说清楚（`R-MED-2`）
    const hits = findAssetReferences(document, asset)
    if (hits.length > 0 && options.force !== true) {
      throw new Error(`素材 ${asset.path} 正被引用：${describeReferences(hits)}。确认要删就在界面上再确认一次（force）。`)
    }
    document.assets = document.assets.filter(candidate => candidate.id !== id)
    await this.save(document)
    return true
  }

  /**
   * Rename a project.
   * @param id - project id.
   * @param name - validated new name.
   * @returns the updated record, or `undefined` when the id is unknown.
   */
  async renameProject(id: string, name: unknown): Promise<ProjectRecord | undefined> {
    const document = await this.load()
    const current = document.projects.find(project => project.id === id)
    if (current === undefined) return undefined
    const renamed: ProjectRecord = {
      ...current, name: normalizeProjectName(name), updatedAt: this.now().toISOString(),
    }
    document.projects = document.projects.map(project => (project.id === id ? renamed : project))
    await this.save(document)
    return renamed
  }

  /**
   * List a project's resources, newest first.
   * @param projectId - project id.
   * @param kind - optional kind filter.
   * @returns the records.
   */
  async listResources(projectId: string, kind?: ResourceKind, folder?: string): Promise<ResourceRecord[]> {
    const document = await this.load()
    const folderFilter = folder === undefined || folder === '' ? undefined : folder
    return document.resources
      .filter(resource => resource.projectId === projectId
        && (kind === undefined || resource.kind === kind)
        && (folderFilter === undefined || (resource.folder ?? '') === folderFilter))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  /**
   * Create a resource inside a project.
   * @param input - project, kind, name and optional note.
   * @returns the stored record.
   * @throws {Error} when the project is unknown.
   */
  /**
   * Find one resource by id（`B-7`：资源闭环端点按 id 直接取，不要求调用方先知道 projectId）。
   * @param id - resource id.
   * @returns the record, or `undefined` when unknown.
   */
  async findResource(id: string): Promise<ResourceRecord | undefined> {
    const document = await this.load()
    return document.resources.find(resource => resource.id === id)
  }

  async createResource(input: {
    projectId: string
    kind: ResourceKind | string
    name: unknown
    note?: string
    /** 分类（`B-7`）：扁平文件夹名；空 = 未分类。 */
    folder?: string
    /** 参考图（`A153`）：定妆照 / 参考素材路径。 */
    assetPath?: string
    /** 多张参考图（`A-3`）：首图为底图。 */
    assetPaths?: readonly string[]
    keyframes?: unknown
    scope?: unknown
  }): Promise<ResourceRecord> {
    const document = await this.load()
    const project = document.projects.find(candidate => candidate.id === input.projectId)
    if (project === undefined) throw new Error(`unknown project: ${input.projectId}`)
    const stamp = this.now().toISOString()
    const resource: ResourceRecord = {
      schemaVersion: WORKBENCH_SCHEMA_VERSION,
      id: newWorkbenchId('res'),
      projectId: project.id,
      kind: normalizeResourceKind(input.kind),
      name: normalizeResourceName(input.name),
      // V1 只写 project（`R-COL-1`）；入参给了别的也照实校验，未来放开时再说
      scope: normalizeResourceScope(input.scope),
      // 轨迹资源必须带合法关键帧；其它资源给了关键帧也一并校验（越界一律拒）
      ...input.keyframes === undefined && normalizeResourceKind(input.kind) !== 'motion-track' ? {}
        : { keyframes: normalizeKeyframes(input.keyframes) },
      createdAt: stamp,
      updatedAt: stamp,
      ...input.note === undefined || input.note === '' ? {} : { note: input.note },
      ...normalizeResourceFolder(input.folder) === undefined ? {} : { folder: normalizeResourceFolder(input.folder) },
      ...input.assetPath === undefined || input.assetPath === '' ? {} : { assetPath: input.assetPath },
      ...input.assetPaths === undefined || input.assetPaths.length === 0 ? {} : { assetPaths: [...input.assetPaths] },
    }
    document.resources.push(resource)
    document.projects = document.projects.map(candidate =>
      candidate.id === project.id ? { ...candidate, updatedAt: stamp } : candidate)
    await this.save(document)
    return resource
  }

  /**
   * Update one resource record (name / note / reference image).
   * @param id - resource id.
   * @param patch - fields to change; `assetPath: null` clears the reference image.
   * @returns the updated record, or `undefined` when the id is unknown.
   */
  async updateResource(id: string, patch: {
    name?: unknown
    note?: string
    /** 分类：字符串设置、`null` 清除（回到未分类）、`undefined` 不改。 */
    folder?: string | null
    assetPath?: string | null
    assetPaths?: readonly string[] | null
  }): Promise<ResourceRecord | undefined> {
    const document = await this.load()
    const index = document.resources.findIndex(resource => resource.id === id)
    if (index === -1) return undefined
    const current = document.resources[index]!
    const next: ResourceRecord = {
      ...current,
      updatedAt: this.now().toISOString(),
      ...patch.name === undefined ? {} : { name: normalizeResourceName(patch.name) },
      ...patch.note === undefined ? {} : patch.note === '' ? { note: undefined as never } : { note: patch.note },
      ...patch.folder === undefined
        ? {}
        : patch.folder === null ? { folder: undefined as never } : normalizeResourceFolder(patch.folder) === undefined
          ? { folder: undefined as never }
          : { folder: normalizeResourceFolder(patch.folder) as string },
      ...patch.assetPath === undefined ? {} : patch.assetPath === null ? { assetPath: undefined as never } : { assetPath: patch.assetPath },
      ...patch.assetPaths === undefined ? {} : patch.assetPaths === null ? { assetPaths: undefined as never } : { assetPaths: [...patch.assetPaths] },
    }
    // 显式清除时把键删掉（而不是留 `undefined`，避免落库出现 `"note": null` 这类脏值）
    const cleaned: ResourceRecord = { ...next }
    const mutable = cleaned as unknown as Record<string, unknown>
    if (mutable.note === undefined) delete mutable.note
    if (mutable.folder === undefined) delete mutable.folder
    if (mutable.assetPath === undefined) delete mutable.assetPath
    if (mutable.assetPaths === undefined) delete mutable.assetPaths
    document.resources[index] = cleaned
    await this.save(document)
    return cleaned
  }

  /**
   * Remove one resource record.
   * @param id - resource id.
   * @returns `true` when a record was removed.
   */
  async removeResource(id: string, options: { force?: boolean } = {}): Promise<boolean> {
    const document = await this.load()
    const resource = document.resources.find(candidate => candidate.id === id)
    if (resource === undefined) return false
    const hits = findResourceReferences(document, id)
    if (hits.length > 0 && options.force !== true) {
      throw new Error(`创作资源「${resource.name}」正被引用：${describeReferences(hits)}。确认要删就在界面上再确认一次（force）。`)
    }
    document.resources = document.resources.filter(candidate => candidate.id !== id)
    await this.save(document)
    return true
  }

  /**
   * List a project's workflow documents, newest first.
   * @param projectId - project id.
   * @returns the records.
   */
  async listWorkflows(projectId: string): Promise<WorkflowRecord[]> {
    const document = await this.load()
    return document.workflows
      .filter(workflow => workflow.projectId === projectId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  /**
   * Create or update a workflow document.
   * @param input - id to update (optional), project, name, nodes and edges.
   * @returns the stored record.
   * @throws {Error} when the project is unknown or the graph is malformed.
   */
  async saveWorkflow(input: {
    id?: string
    projectId: string
    name?: unknown
    nodes: unknown
    edges: unknown
  }): Promise<WorkflowRecord> {
    const document = await this.load()
    const project = document.projects.find(candidate => candidate.id === input.projectId)
    if (project === undefined) throw new Error(`unknown project: ${input.projectId}`)
    const graph = normalizeGraph(input.nodes, input.edges)
    const stamp = this.now().toISOString()
    const existing = input.id === undefined ? undefined : document.workflows.find(row => row.id === input.id)
    const name = input.name === undefined || input.name === '' ? '未命名工作流' : String(input.name).slice(0, 80)
    const record: WorkflowRecord = {
      schemaVersion: 1,
      id: input.id ?? existing?.id ?? newWorkbenchId('wfl'),
      projectId: project.id,
      name,
      nodes: graph.nodes,
      edges: graph.edges,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
    }
    document.workflows = existing === undefined
      ? [...document.workflows, record]
      : document.workflows.map(row => (row.id === record.id ? record : row))
    await this.save(document)
    return record
  }

  /**
   * 把一集的分镜同步成固定的工作流文档（幂等：同一份分镜重复同步只更新同一份图）。
   * @param episodeId - 集 id。
   * @returns 同步后的工作流记录。
   * @throws {Error} 集不存在或本集没有分镜镜头时。
   */
  async syncEpisodeWorkflow(episodeId: string): Promise<WorkflowRecord> {
    const episode = await this.getEpisode(episodeId)
    const graph = buildEpisodeWorkflow(episode)
    return this.saveWorkflow({
      id: graph.id,
      projectId: episode.projectId,
      name: graph.name,
      nodes: graph.nodes,
      edges: graph.edges,
    })
  }

  /**
   * Remove one workflow document.
   * @param id - workflow id.
   * @returns `true` when a record was removed.
   */
  async removeWorkflow(id: string): Promise<boolean> {
    const document = await this.load()
    const before = document.workflows.length
    document.workflows = document.workflows.filter(workflow => workflow.id !== id)
    if (document.workflows.length === before) return false
    await this.save(document)
    return true
  }

  /**
   * Find one workflow document by id.
   * @param id - workflow id.
   * @returns the record, or `undefined`.
   */
  async findWorkflow(id: string): Promise<WorkflowRecord | undefined> {
    const document = await this.load()
    return document.workflows.find(workflow => workflow.id === id)
  }

  /**
   * Find one workflow run by id.
   * @param id - run id.
   * @returns the record, or `undefined`.
   */
  async findRun(id: string): Promise<WorkflowRunRecord | undefined> {
    const document = await this.load()
    return document.runs.find(run => run.id === id)
  }

  /**
   * List a project's timelines, newest first.
   * @param projectId - project id.
   * @returns the records.
   */
  async listTimelines(projectId: string): Promise<TimelineRecord[]> {
    const document = await this.load()
    return document.timelines
      .filter(timeline => timeline.projectId === projectId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  /**
   * Find one timeline by id.
   * @param id - timeline id.
   * @returns the record, or `undefined`.
   */
  async findTimeline(id: string): Promise<TimelineRecord | undefined> {
    const document = await this.load()
    return document.timelines.find(timeline => timeline.id === id)
  }

  /**
   * Create or update a timeline document.
   * @param input - id (update), project, name, tracks and frame rate.
   * @returns the stored record.
   * @throws {Error} when the project is unknown or the tracks are malformed.
   */
  async saveTimeline(input: {
    id?: string
    projectId: string
    name?: string
    tracks: unknown
    frameRate?: number
    burnSubtitles?: boolean
    exportFormat?: unknown
    normalizeLoudness?: boolean
    burnLanguage?: string
  }): Promise<TimelineRecord> {
    const document = await this.load()
    const project = document.projects.find(candidate => candidate.id === input.projectId)
    if (project === undefined) throw new Error(`unknown project: ${input.projectId}`)
    const tracks: readonly TimelineTrack[] = normalizeTimelineTracks(input.tracks)
    const stamp = this.now().toISOString()
    const existing = input.id === undefined ? undefined : document.timelines.find(row => row.id === input.id)
    const record: TimelineRecord = {
      schemaVersion: 1,
      id: existing?.id ?? newWorkbenchId('tml'),
      projectId: project.id,
      name: input.name === undefined || input.name === '' ? '未命名时间轴' : input.name.slice(0, 80),
      frameRate: input.frameRate ?? existing?.frameRate ?? DEFAULT_FRAME_RATE,
      tracks,
      burnSubtitles: input.burnSubtitles ?? existing?.burnSubtitles ?? true,
      exportFormat: normalizeExportFormat(input.exportFormat ?? existing?.exportFormat),
      normalizeLoudness: input.normalizeLoudness ?? existing?.normalizeLoudness ?? false,
      ...input.burnLanguage === undefined && existing?.burnLanguage === undefined ? {} : { burnLanguage: input.burnLanguage ?? existing?.burnLanguage },
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
    }
    document.timelines = existing === undefined
      ? [...document.timelines, record]
      : document.timelines.map(row => (row.id === record.id ? record : row))
    await this.save(document)
    return record
  }

  /**
   * Remove one timeline.
   * @param id - timeline id.
   * @returns `true` when a record was removed.
   */
  async removeTimeline(id: string): Promise<boolean> {
    const document = await this.load()
    const before = document.timelines.length
    document.timelines = document.timelines.filter(timeline => timeline.id !== id)
    if (document.timelines.length === before) return false
    await this.save(document)
    return true
  }

  /**
   * 导入外来的任务记录（`T8-2`）：**一律转 `imported-idle`**，绝不自动续跑。
   * @param projectId - 归属项目。
   * @param tasks - 包里的任务记录。
   * @returns 导入条数。
   */
  async importTasks(projectId: string, tasks: readonly TaskRecord[]): Promise<number> {
    const document = await this.load()
    const stamp = this.now().toISOString()
    for (const task of tasks) {
      document.tasks.push({
        ...task,
        id: newWorkbenchId('task'),
        projectId,
        status: 'imported-idle',
        updatedAt: stamp,
      })
    }
    if (tasks.length > 0) await this.save(document)
    return tasks.length
  }

  /**
   * 查一条成功结果缓存。
   * @param key - 指纹。
   * @returns 命中的记录，或 `undefined`。
   */
  async lookupNodeCache(key: string): Promise<CachedNodeResult | undefined> {
    const document = await this.load()
    return document.nodeCache.find(entry => entry.key === key)
  }

  /**
   * 记一条成功结果缓存（有界：超过上限淘汰最旧的）。
   * @param entry - 缓存记录。
   */
  async rememberNodeCache(entry: CachedNodeResult): Promise<void> {
    const document = await this.load()
    document.nodeCache = [
      entry,
      ...document.nodeCache.filter(existing => existing.key !== entry.key),
    ].slice(0, MAX_NODE_CACHE)
    await this.save(document)
  }

  /**
   * 素材库引用的全部文件路径（`A15` 输出清理的保护名单）。
   * @returns 路径数组（去重）。
   */
  async referencedAssetPaths(): Promise<string[]> {
    const document = await this.load()
    return [...new Set(document.assets.map(asset => asset.path))]
  }

  /**
   * 数据规模快照（`A9` 诊断用）：各实体条数、真实落盘次数、数据文件字节数。
   * @returns 计数（只读，不触发写盘）。
   */
  async stats(): Promise<{
    projects: number; assets: number; tasks: number; resources: number; workflows: number
    runs: number; timelines: number; nodeCache: number; resourceUsage: number
    runningRuns: number; writeCount: number; fileBytes: number
  }> {
    const document = await this.load()
    const fileBytes = await stat(this.file).then(info => info.size).catch(() => 0)
    return {
      projects: document.projects.length, assets: document.assets.length, tasks: document.tasks.length,
      resources: document.resources.length, workflows: document.workflows.length, runs: document.runs.length,
      timelines: document.timelines.length, nodeCache: document.nodeCache.length,
      resourceUsage: document.resourceUsage.length, writeCount: this.writeCount, fileBytes,
      runningRuns: document.runs.filter(run => run.status === 'running').length,
    }
  }

  /**
   * 列出用户自定义导出预设（`A48`，新的在前）。
   * @returns 预设数组。
   */
  async listExportPresets(): Promise<ExportPresetRecord[]> {
    const document = await this.load()
    return [...document.exportPresets].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  /**
   * 新建/覆盖一个自定义导出预设（`A48`）。
   * @param input - 名称与规格（规格走 `normalizeExportFormat` 校验）。
   * @returns 保存后的预设。
   * @throws {Error} 名称非法/重名、规格非法时。
   */
  async saveExportPreset(input: {
    id?: string
    name: unknown
    width: number
    height: number
    frameRate: number
    bitrateKbps?: number
  }): Promise<ExportPresetRecord> {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (name === '' || name.length > 40) throw new Error('预设名称必须是 1–40 个字符')
    const format = normalizeExportFormat({
      width: input.width, height: input.height, frameRate: input.frameRate,
      ...input.bitrateKbps === undefined ? {} : { bitrateKbps: input.bitrateKbps },
    })
    const document = await this.load()
    const duplicated = document.exportPresets.some(preset => preset.name === name && preset.id !== input.id)
    if (duplicated) throw new Error(`已有同名导出预设「${name}」：换个名字`)
    const existing = input.id === undefined ? undefined : document.exportPresets.find(preset => preset.id === input.id)
    // R6：给了 id 却找不到 → 明确报错。早先会**静默新建**，调用方以为在更新、实际在造数据
    if (input.id !== undefined && existing === undefined) {
      throw new Error(`找不到要更新的导出预设 ${input.id}：先用 presets/list 确认，或去掉 id 表示新建`)
    }
    const record: ExportPresetRecord = {
      id: existing?.id ?? newWorkbenchId('preset'),
      name,
      width: format.width, height: format.height, frameRate: format.frameRate,
      ...format.bitrateKbps === undefined ? {} : { bitrateKbps: format.bitrateKbps },
      createdAt: existing?.createdAt ?? this.now().toISOString(),
    }
    document.exportPresets = existing === undefined
      ? [...document.exportPresets, record]
      : document.exportPresets.map(preset => preset.id === existing.id ? record : preset)
    await this.save(document)
    return record
  }

  /**
   * 删除一个自定义导出预设（`A48`）。
   * @param id - 预设 id。
   * @returns 是否删掉了。
   */
  async removeExportPreset(id: string): Promise<boolean> {
    const document = await this.load()
    const next = document.exportPresets.filter(preset => preset.id !== id)
    if (next.length === document.exportPresets.length) return false
    document.exportPresets = next
    await this.save(document)
    return true
  }

  /**
   * 工作台数据完整性巡检（`A104`，只报告不修复）。
   * @returns 完整性报告。
   */
  async integrityReport(): Promise<import('./integrity.ts').IntegrityReport> {
    const document = await this.load()
    return inspectIntegrity(document as unknown as Parameters<typeof inspectIntegrity>[0])
  }

  /**
   * 归档历史记录（`A94`）：把"已结束且够旧"的任务/运行记录搬到旁路文件（追加，不丢历史）。
   * @param options - 天数与 dryRun（默认 dryRun=true，只算不删）。
   * @returns 归档计划（含实际归档条数与估算字节）。
   */
  async archiveOlderThan(options: { olderThanDays?: number; dryRun?: boolean } = {}): Promise<{ archivedTasks: number; archivedRuns: number; estimatedBytes: number; dryRun: boolean; olderThanDays: number }> {
    const document = await this.load()
    const plan = planArchive(document, {
      nowMs: this.now().getTime(),
      ...options.olderThanDays === undefined ? {} : { olderThanDays: options.olderThanDays },
      ...options.dryRun === undefined ? {} : { dryRun: options.dryRun },
    })
    const result = {
      archivedTasks: plan.tasks.length,
      archivedRuns: plan.runs.length,
      estimatedBytes: plan.estimatedBytes,
      dryRun: plan.dryRun,
      olderThanDays: plan.olderThanDays,
    }
    if (plan.dryRun || (plan.tasks.length === 0 && plan.runs.length === 0)) return result
    // 追加写旁路文件：保留历史，主文档瘦身
    const archivePath = join(this.directory, 'workbench.archive.json')
    const previous = await readFile(archivePath, 'utf8').then(text => JSON.parse(text) as { tasks?: unknown[]; runs?: unknown[] }).catch(() => ({ tasks: [], runs: [] }))
    const next = {
      tasks: [...(previous.tasks ?? []), ...plan.tasks],
      runs: [...(previous.runs ?? []), ...plan.runs],
    }
    await writeFile(archivePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    const taskIds = new Set(plan.tasks.map(task => task.id))
    const runIds = new Set(plan.runs.map(run => String((run as { id?: unknown }).id)))
    document.tasks = document.tasks.filter(task => !taskIds.has(task.id))
    document.runs = document.runs.filter(run => !runIds.has(String((run as { id?: unknown }).id)))
    await this.save(document)
    return result
  }

  /**
   * 复制一条时间轴为副本（`A86`）：名字默认「原名 副本」，重名自动加序号。
   * @param id - 原时间轴 id。
   * @param options - 可选新名字。
   * @returns 新时间轴。
   * @throws {Error} 原时间轴不存在时。
   */
  async duplicateTimeline(id: string, options: { name?: string } = {}): Promise<TimelineRecord> {
    const document = await this.load()
    const source = document.timelines.find(candidate => candidate.id === id)
    if (source === undefined) throw new Error(`找不到时间轴 ${id}`)
    const baseName = options.name?.trim() !== undefined && options.name!.trim() !== '' ? options.name!.trim() : `${source.name} 副本`
    const taken = new Set(document.timelines.filter(candidate => candidate.projectId === source.projectId).map(candidate => candidate.name))
    let uniqueName = baseName
    for (let index = 2; taken.has(uniqueName); index += 1) uniqueName = `${baseName} ${index}`
    const copy = duplicateTimeline(source, {
      newId: newWorkbenchId('tml'),
      newName: uniqueName,
      newClipId: (prefix, index) => `${prefix}-${newWorkbenchId('c')}-${index}`,
    })
    const saved = await this.saveTimeline({
      id: copy.id, projectId: copy.projectId, name: copy.name, tracks: copy.tracks,
      frameRate: copy.frameRate, burnSubtitles: copy.burnSubtitles,
      ...copy.exportFormat === undefined ? {} : { exportFormat: copy.exportFormat },
      ...copy.normalizeLoudness === undefined ? {} : { normalizeLoudness: copy.normalizeLoudness },
      ...copy.burnLanguage === undefined ? {} : { burnLanguage: copy.burnLanguage },
    })
    return saved
  }

  /**
   * 记一批资源使用记录（`R-QCK-3`）：同 (resourceId, assetPath) 只留最新一条。
   * @param entries - 使用记录。
   */
  async recordResourceUsage(entries: readonly ResourceUsageRecord[]): Promise<number> {
    if (entries.length === 0) return 0
    const document = await this.load()
    const keys = new Set(entries.map(entry => `${entry.resourceId}|${entry.assetPath}`))
    document.resourceUsage = [
      ...entries,
      ...document.resourceUsage.filter(existing => !keys.has(`${existing.resourceId}|${existing.assetPath}`)),
    ].slice(0, 2000)
    await this.save(document)
    return entries.length
  }

  /**
   * 查资源使用记录：资源库据此显示"被哪些素材用过"。
   * @param options.resourceId - 只看某个资源。
   * @param options.projectId - 只看某个项目。
   * @returns 记录（最新在前）。
   */
  async listResourceUsage(options: { resourceId?: string; projectId?: string } = {}): Promise<ResourceUsageRecord[]> {
    const document = await this.load()
    return document.resourceUsage
      .filter(entry => (options.resourceId === undefined || entry.resourceId === options.resourceId)
        && (options.projectId === undefined || entry.projectId === options.projectId))
      .sort((left, right) => right.at.localeCompare(left.at))
  }

  /**
   * Collapse duplicate asset records (same project + same path) into the earliest one.
   *
   * Idempotent registration landed after some duplicates were already written, and the
   * panel showed one row per record. Deduplication has to happen *here* because the
   * process caches the document in memory — an outside edit would be overwritten by
   * the next save.
   * @returns how many records were removed.
   */
  async compactAssets(): Promise<number> {
    const document = await this.load()
    const seen = new Map<string, AssetRecord>()
    const kept: AssetRecord[] = []
    for (const asset of document.assets) {
      const key = `${asset.projectId}\u0000${asset.path}`
      const previous = seen.get(key)
      if (previous === undefined) { seen.set(key, asset); kept.push(asset); continue }
      const earliest = asset.createdAt < previous.createdAt ? asset : previous
      if (earliest === asset) kept[kept.indexOf(previous)] = asset
      seen.set(key, earliest)
    }
    const removed = document.assets.length - kept.length
    if (removed === 0) return 0
    document.assets = kept
    await this.save(document)
    return removed
  }

  /**
   * Append one workflow-run record.
   * @param run - the record to store.
   * @returns the stored record.
   */
  async recordRun(run: WorkflowRunRecord): Promise<WorkflowRunRecord> {
    const document = await this.load()
    document.runs.push(run)
    // 只保留最近 50 次运行，避免台账本无界增长
    if (document.runs.length > 50) document.runs = document.runs.slice(-50)
    await this.save(document)
    return run
  }

  /**
   * Patch a workflow run in place.
   * @param id - run id.
   * @param patch - fields to replace.
   * @returns the updated record, or `undefined` when the id is unknown.
   */
  async updateRun(id: string, patch: Partial<Omit<WorkflowRunRecord, 'id' | 'schemaVersion'>>): Promise<WorkflowRunRecord | undefined> {
    const document = await this.load()
    const current = document.runs.find(run => run.id === id)
    if (current === undefined) return undefined
    const updated: WorkflowRunRecord = { ...current, ...patch }
    document.runs = document.runs.map(run => (run.id === id ? updated : run))
    await this.save(document)
    return updated
  }

  /**
   * List workflow runs, newest first.
   * @param projectId - project id.
   * @param workflowId - optional workflow filter.
   * @returns the records.
   */
  async listRuns(projectId: string, workflowId?: string): Promise<WorkflowRunRecord[]> {
    const document = await this.load()
    return document.runs
      .filter(run => run.projectId === projectId && (workflowId === undefined || run.workflowId === workflowId))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
  }

  /**
   * Close runs (and their in-flight nodes) left `running` by a process that went away.
   * @param reason - message filed with each closed run.
   * @returns how many runs were closed.
   */
  async failStaleRuns(reason: string): Promise<number> {
    const document = await this.load()
    const stamp = this.now().toISOString()
    let closed = 0
    document.runs = document.runs.map(run => {
      if (run.status !== 'running') return run
      closed += 1
      return {
        ...run, status: 'failed' as const, error: reason, finishedAt: stamp,
        nodeRuns: run.nodeRuns.map(node => (node.status === 'succeeded' || node.status === 'failed' || node.status === 'cancelled' || node.status === 'skipped'
          ? node
          : { ...node, status: 'cancelled' as const, error: reason, finishedAt: stamp })) as readonly WorkflowRunNodeRecord[],
      }
    })
    if (closed > 0) await this.save(document)
    return closed
  }

  /**
   * Record one generation attempt.
   * @param input - what the tool reported.
   * @returns the stored record.
   */
  async recordTask(input: TaskInput): Promise<TaskRecord> {
    const document = await this.load()
    const stamp = this.now().toISOString()
    const task: TaskRecord = {
      schemaVersion: WORKBENCH_SCHEMA_VERSION,
      id: newWorkbenchId('tsk'),
      kind: normalizeMediaKind(input.kind),
      status: normalizeTaskStatus(input.status),
      createdAt: input.startedAt ?? stamp,
      updatedAt: stamp,
      ...input.provider === undefined ? {} : { provider: input.provider },
      ...input.model === undefined ? {} : { model: input.model },
      ...input.prompt === undefined ? {} : { prompt: input.prompt },
      ...input.outputPath === undefined ? {} : { outputPath: input.outputPath },
      ...input.bytes === undefined ? {} : { bytes: input.bytes },
      ...input.projectId === undefined ? {} : { projectId: input.projectId },
      ...input.episodeId === undefined ? {} : { episodeId: input.episodeId },
      ...input.segmentId === undefined ? {} : { segmentId: input.segmentId },
      ...input.shotId === undefined ? {} : { shotId: input.shotId },
      ...input.error === undefined ? {} : { error: input.error },
    }
    document.tasks.push(task)
    if (document.tasks.length > MAX_TASKS) document.tasks = document.tasks.slice(-MAX_TASKS)
    await this.save(document)
    return task
  }

  /**
   * Change an existing task (status, output, project).
   * @param id - task id.
   * @param patch - fields to change.
   * @returns the updated record, or `undefined` when the id is unknown.
   */
  async updateTask(id: string, patch: TaskPatch): Promise<TaskRecord | undefined> {
    const document = await this.load()
    const current = document.tasks.find(task => task.id === id)
    if (current === undefined) return undefined
    const updated: TaskRecord = {
      ...current,
      ...patch.status === undefined ? {} : { status: normalizeTaskStatus(patch.status) },
      ...patch.outputPath === undefined ? {} : { outputPath: patch.outputPath },
      ...patch.bytes === undefined ? {} : { bytes: patch.bytes },
      ...patch.projectId === undefined ? {} : { projectId: patch.projectId },
      ...patch.episodeId === undefined ? {} : { episodeId: patch.episodeId },
      ...patch.segmentId === undefined ? {} : { segmentId: patch.segmentId },
      ...patch.shotId === undefined ? {} : { shotId: patch.shotId },
      ...patch.error === undefined ? {} : { error: patch.error },
      updatedAt: this.now().toISOString(),
    }
    document.tasks = document.tasks.map(task => (task.id === id ? updated : task))
    await this.save(document)
    return updated
  }

  /**
   * List recorded generations, newest first.
   * @param limit - maximum entries.
   * @param projectId - restrict to one project (tasks filed into it).
   * @param episodeId - restrict to one episode.
   * @returns the records.
   */
  async listTasks(limit = 50, projectId?: string, episodeId?: string): Promise<TaskRecord[]> {
    const document = await this.load()
    return document.tasks
      .filter(task => projectId === undefined || task.projectId === projectId)
      .filter(task => episodeId === undefined || task.episodeId === episodeId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(0, limit))
  }

  /**
   * 列出一个剧集的集，按集号排序。
   *
   * 空剧集（含重构前的老剧集）首次访问时补建一个空的 Episode #1：旧剧集级剧本 / 分镜
   * 不迁移、不再展示，只保证集视图可用。
   * @param projectId - 剧集 id。
   * @returns 该剧集的集。
   * @throws {Error} 剧集不存在时。
   */
  async listEpisodes(projectId: string): Promise<EpisodeRecord[]> {
    const document = await this.load()
    this.assertProject(document, projectId)
    let episodes = document.episodes.filter(episode => episode.projectId === projectId)
    if (episodes.length === 0) {
      const stamp = this.now().toISOString()
      const created = newEpisode(projectId, 1, normalizeEpisodeTitle(undefined, 1), stamp)
      document.episodes.push(created)
      await this.save(document)
      episodes = [created]
    }
    return [...episodes].sort((left, right) => left.no - right.no)
  }

  /**
   * 新建一集；集号缺省取当前最大值 +1。
   * @param projectId - 剧集 id。
   * @param input - 可选的标题与集号。
   * @returns 新建的集。
   * @throws {Error} 剧集不存在、集号冲突或标题不合法时。
   */
  async createEpisode(projectId: string, input: EpisodeInput = {}): Promise<EpisodeRecord> {
    const document = await this.load()
    this.assertProject(document, projectId)
    const siblings = document.episodes.filter(episode => episode.projectId === projectId)
    const nextNo = siblings.length === 0 ? 1 : Math.max(...siblings.map(episode => episode.no)) + 1
    const no = normalizeEpisodeNo(input.no, nextNo)
    if (siblings.some(episode => episode.no === no)) throw new Error(`第${no}集已存在`)
    const stamp = this.now().toISOString()
    const episode = newEpisode(projectId, no, normalizeEpisodeTitle(input.title, no), stamp)
    document.episodes.push(episode)
    await this.save(document)
    return episode
  }

  /**
   * 读取一整集（含分段、分镜与两类引用）。
   * @param episodeId - 集 id。
   * @returns 集记录。
   * @throws {Error} 集不存在时。
   */
  async getEpisode(episodeId: string): Promise<EpisodeRecord> {
    const document = await this.load()
    return this.findEpisode(document, episodeId)
  }

  /**
   * 部分更新一集；`script` 传字符串或 `{ text }` 都会刷新 `updatedAt`。
   * @param episodeId - 集 id。
   * @param patch - 要改的字段。
   * @returns 更新后的集。
   * @throws {Error} 集不存在或字段不合法时。
   */
  async updateEpisode(episodeId: string, patch: EpisodePatch): Promise<EpisodeRecord> {
    const document = await this.load()
    const current = this.findEpisode(document, episodeId)
    const stamp = this.now().toISOString()
    const remark = patch.remark === undefined ? undefined : normalizeRemark(patch.remark)
    const updated: EpisodeRecord = {
      ...current,
      ...patch.title === undefined ? {} : { title: normalizeEpisodeTitle(patch.title, current.no) },
      ...patch.remark === undefined ? {} : remark === undefined ? { remark: undefined } : { remark },
      ...patch.script === undefined ? {} : { script: { text: normalizeScriptText(readScriptText(patch.script)), updatedAt: stamp } },
      updatedAt: stamp,
    }
    this.replaceEpisode(document, updated)
    await this.save(document)
    return updated
  }

  /**
   * 删除一集；有归属任务时必须 `force`。
   * @param episodeId - 集 id。
   * @param force - 有归属任务时是否强制删除。
   * @returns 被删除的集。
   * @throws {Error} 集不存在，或存在归属任务且未 `force` 时。
   */
  async deleteEpisode(episodeId: string, force = false): Promise<EpisodeRecord> {
    const document = await this.load()
    const current = this.findEpisode(document, episodeId)
    const related = document.tasks.filter(task => task.episodeId === episodeId)
    if (related.length > 0 && !force) {
      throw new Error(`第${current.no}集有 ${related.length} 个关联任务；确认后请传 force`)
    }
    document.episodes = document.episodes.filter(episode => episode.id !== episodeId)
    // 任务账本是历史记录：保留任务，只清掉悬空的集归属，避免按已删除的集继续筛选。
    document.tasks = document.tasks.map(task => (task.episodeId === episodeId ? { ...task, episodeId: undefined } : task))
    await this.save(document)
    return current
  }

  /**
   * 重排一个剧集的集顺序，并把集号重编为 1..n；默认标题跟随集号。
   * @param projectId - 剧集 id。
   * @param order - 目标集 id 顺序。
   * @returns 重排后的集。
   * @throws {Error} 顺序不完整或含未知 id 时。
   */
  async reorderEpisodes(projectId: string, order: readonly string[]): Promise<EpisodeRecord[]> {
    const document = await this.load()
    this.assertProject(document, projectId)
    const current = document.episodes.filter(episode => episode.projectId === projectId).sort((left, right) => left.no - right.no)
    const reordered = applyReorder(current, order, '集')
    const stamp = this.now().toISOString()
    const next = reordered.map((episode, index): EpisodeRecord => {
      const no = index + 1
      return {
        ...episode,
        no,
        title: episode.title === `第${episode.no}集` ? `第${no}集` : episode.title,
        updatedAt: stamp,
      }
    })
    document.episodes = document.episodes.map(episode => next.find(candidate => candidate.id === episode.id) ?? episode)
    await this.save(document)
    return next
  }

  /**
   * 集对剧集资源库的引用：list / add / remove / move（move 是剪切语义，改分类并改顺序）。
   * @param episodeId - 集 id。
   * @param action - 动作。
   * @param input - 资源 id、分类与目标顺序。
   * @returns 更新后的引用列表（按 order 排序）。
   * @throws {Error} 集 / 资源不存在，或动作参数不合法时。
   */
  async episodeResources(episodeId: string, action: EpisodeRefAction, input: EpisodeRefInput = {}): Promise<EpisodeResourceRef[]> {
    const document = await this.load()
    const current = this.findEpisode(document, episodeId)
    const resourceId = requireRefId(input.resourceId, 'resourceId')
    if (action === 'list') return [...current.resourceRefs].sort((left, right) => left.order - right.order)
    if (action === 'add' || action === 'move') {
      const resource = document.resources.find(candidate => candidate.id === resourceId && candidate.projectId === current.projectId)
      if (resource === undefined) throw new Error(`本剧集没有该资源：${resourceId}`)
    }
    const existing = current.resourceRefs.find(ref => ref.resourceId === resourceId)
    if (action === 'add' && existing !== undefined) throw new Error(`该资源已在本集引用中：${resourceId}`)
    if ((action === 'remove' || action === 'move') && existing === undefined) throw new Error(`该资源不在本集引用中：${resourceId}`)
    const category = input.category === undefined
      ? existing?.category ?? resolveRefCategory(document, current.projectId, resourceId)
      : normalizeEpisodeRefCategory(input.category)
    const rest = current.resourceRefs.filter(ref => ref.resourceId !== resourceId)
    const refs = action === 'remove'
      ? reindexRefs(rest)
      : arrangeResourceRefs(rest, { resourceId, category }, input.order)
    const updated: EpisodeRecord = { ...current, resourceRefs: refs, updatedAt: this.now().toISOString() }
    this.replaceEpisode(document, updated)
    await this.save(document)
    return refs
  }

  /**
   * 集对全局素材库的引用：list / add / remove / move。
   * @param episodeId - 集 id。
   * @param action - 动作。
   * @param input - 素材 id、分类与目标顺序。
   * @returns 更新后的引用列表（按 order 排序）。
   * @throws {Error} 集 / 素材不存在，或动作参数不合法时。
   */
  async episodeAssets(episodeId: string, action: EpisodeRefAction, input: EpisodeRefInput = {}): Promise<EpisodeAssetRef[]> {
    const document = await this.load()
    const current = this.findEpisode(document, episodeId)
    const assetId = requireRefId(input.assetId, 'assetId')
    if (action === 'list') return [...current.assetRefs].sort((left, right) => left.order - right.order)
    if ((action === 'add' || action === 'move') && !document.assets.some(candidate => candidate.id === assetId)) {
      throw new Error(`素材库里没有该素材：${assetId}`)
    }
    const existing = current.assetRefs.find(ref => ref.assetId === assetId)
    if (action === 'add' && existing !== undefined) throw new Error(`该素材已在本集引用中：${assetId}`)
    if ((action === 'remove' || action === 'move') && existing === undefined) throw new Error(`该素材不在本集引用中：${assetId}`)
    const category = input.category === undefined
      ? existing?.category ?? 'ungrouped'
      : normalizeEpisodeRefCategory(input.category)
    const rest = current.assetRefs.filter(ref => ref.assetId !== assetId)
    const refs = action === 'remove'
      ? reindexAssetRefs(rest)
      : arrangeAssetRefs(rest, { assetId, category }, input.order)
    const updated: EpisodeRecord = { ...current, assetRefs: refs, updatedAt: this.now().toISOString() }
    this.replaceEpisode(document, updated)
    await this.save(document)
    return refs
  }

  /**
   * 列出集内分段，按集内顺序排序。
   * @param episodeId - 集 id。
   * @returns 分段列表。
   * @throws {Error} 集不存在时。
   */
  async listSegments(episodeId: string): Promise<SegmentRecord[]> {
    const document = await this.load()
    return sortByOrder(this.findEpisode(document, episodeId).segments)
  }

  /**
   * 新建一条分段；顺序缺省追加到末尾。
   * @param episodeId - 集 id。
   * @param input - 提示词、时长、模型、技能与引用。
   * @returns 新建的分段。
   * @throws {Error} 集不存在或字段不合法时。
   */
  async createSegment(episodeId: string, input: SegmentInput = {}): Promise<SegmentRecord> {
    const document = await this.load()
    const current = this.findEpisode(document, episodeId)
    const imageModel = normalizeOptionalId(input.imageModel, '图片模型')
    const videoModel = normalizeOptionalId(input.videoModel, '视频模型')
    const skillId = normalizeOptionalId(input.skillId, 'director 技能')
    const segment: SegmentRecord = {
      ...emptySegment(episodeId),
      order: resolveOrder(input.order, nextOrder(current.segments)),
      durationSec: normalizeSegmentDuration(input.durationSec),
      promptText: normalizePromptText(input.promptText),
      ...imageModel === undefined ? {} : { imageModel },
      ...videoModel === undefined ? {} : { videoModel },
      ...skillId === undefined ? {} : { skillId },
      refs: normalizeSegmentRefs(input.refs),
    }
    const segments = insertSegment(current.segments, segment)
    const updated: EpisodeRecord = { ...current, segments, updatedAt: this.now().toISOString() }
    this.replaceEpisode(document, updated)
    await this.save(document)
    return segments.find(candidate => candidate.id === segment.id) as SegmentRecord
  }

  /**
   * 部分更新一条分段；改 `order` 即移动位置。
   * @param segmentId - 分段 id。
   * @param patch - 要改的字段。
   * @returns 更新后的分段。
   * @throws {Error} 分段不存在或字段不合法时。
   */
  async updateSegment(segmentId: string, patch: SegmentPatch): Promise<SegmentRecord> {
    const document = await this.load()
    const { episode, segment } = this.findSegment(document, segmentId)
    const imageModel = normalizeOptionalId(patch.imageModel, '图片模型')
    const videoModel = normalizeOptionalId(patch.videoModel, '视频模型')
    const skillId = normalizeOptionalId(patch.skillId, 'director 技能')
    const next: SegmentRecord = {
      ...segment,
      ...patch.promptText === undefined ? {} : { promptText: normalizePromptText(patch.promptText) },
      ...patch.durationSec === undefined ? {} : { durationSec: normalizeSegmentDuration(patch.durationSec) },
      ...patch.imageModel === undefined ? {} : { imageModel },
      ...patch.videoModel === undefined ? {} : { videoModel },
      ...patch.skillId === undefined ? {} : { skillId },
      ...patch.refs === undefined ? {} : { refs: normalizeSegmentRefs(patch.refs) },
    }
    const rest = episode.segments.filter(candidate => candidate.id !== segmentId)
    const segments = patch.order === undefined
      ? sortByOrder([...rest, next])
      : insertSegment(rest, { ...next, order: resolveOrder(patch.order, rest.length + FIRST_ORDER) })
    const updated: EpisodeRecord = { ...episode, segments, updatedAt: this.now().toISOString() }
    this.replaceEpisode(document, updated)
    await this.save(document)
    return updated.segments.find(candidate => candidate.id === segmentId) as SegmentRecord
  }

  /**
   * 删除一条分段；同一分段下的分镜一并删除。
   * @param segmentId - 分段 id。
   * @returns 被删除的分段。
   * @throws {Error} 分段不存在时。
   */
  async deleteSegment(segmentId: string): Promise<SegmentRecord> {
    const document = await this.load()
    const { episode, segment } = this.findSegment(document, segmentId)
    const updated: EpisodeRecord = {
      ...episode,
      segments: reindexOrder(episode.segments.filter(candidate => candidate.id !== segmentId)),
      storyboards: episode.storyboards.filter(storyboard => storyboard.segmentId !== segmentId),
      updatedAt: this.now().toISOString(),
    }
    this.replaceEpisode(document, updated)
    await this.save(document)
    return segment
  }

  /**
   * 重排集内分段，顺序重编为 1..n。
   * @param episodeId - 集 id。
   * @param order - 目标分段 id 顺序。
   * @returns 重排后的分段。
   * @throws {Error} 集不存在、顺序不完整或含未知 id 时。
   */
  async reorderSegments(episodeId: string, order: readonly string[]): Promise<SegmentRecord[]> {
    const document = await this.load()
    const current = this.findEpisode(document, episodeId)
    const reordered = applyReorder(sortByOrder(current.segments), order, '分段')
    const segments = reordered.map((segment, index) => ({ ...segment, order: index + 1 }))
    const updated: EpisodeRecord = { ...current, segments, updatedAt: this.now().toISOString() }
    this.replaceEpisode(document, updated)
    await this.save(document)
    return segments
  }

  /**
   * 列出集内分镜。
   * @param episodeId - 集 id。
   * @returns 分镜列表。
   * @throws {Error} 集不存在时。
   */
  async listStoryboards(episodeId: string): Promise<StoryboardRecord[]> {
    const document = await this.load()
    return [...this.findEpisode(document, episodeId).storyboards]
  }

  /**
   * 读取一组分镜。
   * @param storyboardId - 分镜 id。
   * @returns 分镜记录。
   * @throws {Error} 分镜不存在时。
   */
  async getStoryboard(storyboardId: string): Promise<StoryboardRecord> {
    const document = await this.load()
    for (const episode of document.episodes) {
      const found = episode.storyboards.find(storyboard => storyboard.id === storyboardId)
      if (found !== undefined) return found
    }
    throw new Error(`未知的分镜：${storyboardId}`)
  }

  /**
   * 写入一组分镜：无 `id` 新建，有 `id` 整组替换；同时回填分段的 `storyboardId`。
   * @param input - 分段 id、可选分镜 id、技能与镜头数组。
   * @returns 写入后的分镜。
   * @throws {Error} 分段 / 分镜不存在、跨集写入或镜头不合法时。
   */
  async upsertStoryboard(input: StoryboardInput): Promise<StoryboardRecord> {
    const document = await this.load()
    const { episode } = this.findSegment(document, input.segmentId)
    if (input.episodeId !== undefined && input.episodeId !== episode.id) {
      throw new Error(`分段属于第${episode.no}集，不能写入 ${input.episodeId}`)
    }
    const existing = input.id === undefined ? undefined : episode.storyboards.find(storyboard => storyboard.id === input.id)
    if (input.id !== undefined && existing === undefined) throw new Error(`未知的分镜：${input.id}`)
    const skillId = normalizeOptionalId(input.skillId, 'reverse 技能')
    const stamp = this.now().toISOString()
    const storyboard: StoryboardRecord = {
      schemaVersion: WORKBENCH_SCHEMA_VERSION,
      id: existing?.id ?? newWorkbenchId('sb'),
      episodeId: episode.id,
      segmentId: input.segmentId,
      ...skillId === undefined ? {} : { skillId },
      shots: normalizeShots(input.shots),
      updatedAt: stamp,
    }
    const storyboards = existing === undefined
      ? [...episode.storyboards, storyboard]
      : episode.storyboards.map(candidate => (candidate.id === storyboard.id ? storyboard : candidate))
    const segments = episode.segments.map(candidate => (
      candidate.id === input.segmentId ? { ...candidate, storyboardId: storyboard.id } : candidate
    ))
    const updated: EpisodeRecord = { ...episode, storyboards, segments, updatedAt: stamp }
    this.replaceEpisode(document, updated)
    await this.save(document)
    return storyboard
  }

  /**
   * 删除一组分镜，并清掉分段的 `storyboardId` 回填。
   * @param storyboardId - 分镜 id。
   * @returns 被删除的分镜。
   * @throws {Error} 分镜不存在时。
   */
  async deleteStoryboard(storyboardId: string): Promise<StoryboardRecord> {
    const document = await this.load()
    const episode = document.episodes.find(candidate => candidate.storyboards.some(storyboard => storyboard.id === storyboardId))
    if (episode === undefined) throw new Error(`未知的分镜：${storyboardId}`)
    const removed = episode.storyboards.find(storyboard => storyboard.id === storyboardId) as StoryboardRecord
    const updated: EpisodeRecord = {
      ...episode,
      storyboards: episode.storyboards.filter(storyboard => storyboard.id !== storyboardId),
      segments: episode.segments.map(segment => (
        segment.storyboardId === storyboardId ? { ...segment, storyboardId: undefined } : segment
      )),
      updatedAt: this.now().toISOString(),
    }
    this.replaceEpisode(document, updated)
    await this.save(document)
    return removed
  }

  /**
   * 校验剧集存在。
   * @param document - 当前文档。
   * @param projectId - 剧集 id。
   * @throws {Error} 剧集不存在时。
   */
  private assertProject(document: WorkbenchDocument, projectId: string): void {
    if (!document.projects.some(project => project.id === projectId)) throw new Error(`未知的剧集：${projectId}`)
  }

  /**
   * 查找一集。
   * @param document - 当前文档。
   * @param episodeId - 集 id。
   * @returns 集记录。
   * @throws {Error} 集不存在时。
   */
  private findEpisode(document: WorkbenchDocument, episodeId: string): EpisodeRecord {
    const episode = document.episodes.find(candidate => candidate.id === episodeId)
    if (episode === undefined) throw new Error(`未知的集：${episodeId}`)
    return episode
  }

  /**
   * 跨集查找一条分段。
   * @param document - 当前文档。
   * @param segmentId - 分段 id。
   * @returns 所属集与分段。
   * @throws {Error} 分段不存在时。
   */
  private findSegment(document: WorkbenchDocument, segmentId: string): { episode: EpisodeRecord; segment: SegmentRecord } {
    for (const episode of document.episodes) {
      const segment = episode.segments.find(candidate => candidate.id === segmentId)
      if (segment !== undefined) return { episode, segment }
    }
    throw new Error(`未知的分段：${segmentId}`)
  }

  /**
   * 用新记录替换文档里的同一集。
   * @param document - 当前文档。
   * @param next - 更新后的集。
   */
  private replaceEpisode(document: WorkbenchDocument, next: EpisodeRecord): void {
    document.episodes = document.episodes.map(episode => (episode.id === next.id ? next : episode))
  }

  /**
   * Close generations that were still `running` when the process went away.
   *
   * Without this, a crash or a host restart would leave rows reading "running"
   * forever, and the workbench would offer to cancel something that no longer
   * exists.
   * @param reason - message filed with each closed task.
   * @returns how many records were closed.
   */
  async failStaleRunning(reason: string): Promise<number> {
    const document = await this.load()
    const stamp = this.now().toISOString()
    let closed = 0
    document.tasks = document.tasks.map(task => {
      if (task.status !== 'running') return task
      closed += 1
      return { ...task, status: 'failed' as TaskStatus, error: reason, updatedAt: stamp }
    })
    if (closed > 0) await this.save(document)
    return closed
  }

  /** 把任意读到的对象补成完整文档（缺字段补默认值）。 */
  private normalize(raw: Partial<WorkbenchDocument>): WorkbenchDocument {
    return {
      schemaVersion: raw.schemaVersion ?? WORKBENCH_SCHEMA_VERSION,
      projects: raw.projects ?? [],
      assets: raw.assets ?? [],
      tasks: raw.tasks ?? [],
      resources: raw.resources ?? [],
      workflows: raw.workflows ?? [],
      runs: raw.runs ?? [],
      timelines: raw.timelines ?? [],
      nodeCache: raw.nodeCache ?? [],
      resourceUsage: raw.resourceUsage ?? [],
      exportPresets: raw.exportPresets ?? [],
      episodes: raw.episodes ?? [],
    }
  }

  /** Read the document, caching it after the first read. */
  private async load(): Promise<WorkbenchDocument> {
    if (this.cache !== undefined) return this.cache
    this.loading ??= this.readDocument()
    return this.loading
  }

  /** Perform the one read that populates {@link cache}. */
  private async readDocument(): Promise<WorkbenchDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as Record<string, unknown>
      // 预发布阶段只认当前 schema：没有迁移链，也不猜字段。旧版本文件整份留证后
      // 以空工作台重开——宁可让开发期的数据留在 `.legacy-v<N>` 里，也不要把半懂的
      // 字段写回磁盘。
      const declared = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : WORKBENCH_SCHEMA_VERSION
      if (declared !== WORKBENCH_SCHEMA_VERSION) {
        const backup = `${this.file}.legacy-v${declared}`
        await copyFile(this.file, backup).catch(() => undefined)
        console.warn(
          `image-video workbench: 数据是 v${declared}，当前只支持 v${WORKBENCH_SCHEMA_VERSION}；`
          + `已留证到 ${backup}，以空工作台继续`,
        )
        this.cache = emptyDocument()
        await this.save(this.cache).catch(() => undefined)
        return this.cache
      }
      this.cache = this.normalize(parsed as Partial<WorkbenchDocument>)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // 商用底线：**数据坏了也不能把用户卡死**。
        // 顺序：主文件 → `<file>.bak`（上次成功保存的副本）→ 把坏文件留证后以空工作台继续。
        const reason = error instanceof Error ? error.message : String(error)
        const backup = `${this.file}.bak`
        const recovered = await readFile(backup, 'utf8').then(text => JSON.parse(text)).catch(() => undefined)
        if (recovered !== undefined && typeof recovered === 'object' && recovered !== null) {
          this.cache = this.normalize(recovered as Partial<WorkbenchDocument>)
          await copyFile(this.file, `${this.file}.corrupt-${Date.now()}`).catch(() => undefined)
          return this.cache
        }
        await copyFile(this.file, `${this.file}.corrupt-${Date.now()}`).catch(() => undefined)
        throw new Error(
          `工作台数据文件读不出来（${this.file}）：${reason}。`
          + `已把坏文件留证为 .corrupt-*；可以删掉原文件让插件以空工作台重来，`
          + `或者把一份可用的 ${this.file}.bak 放回去再重启。`,
          { cause: error },
        )
      }
      this.cache = emptyDocument()
    }
    return this.cache
  }

  /** Write the document atomically and refresh the cache. */
  private async save(document: WorkbenchDocument): Promise<void> {
    // 并发保存（后台运行收尾 + 新一轮 begin）曾共用 `<file>.<pid>.tmp`：先完成的那次
    // rename 移走临时文件，后一次 rename 直接 ENOENT。写队列保证顺序，序号保证临时名唯一。
    const serialized = `${JSON.stringify(document, null, 2)}\n`
    // 没有变化就别碰磁盘（轮询/重复保存很常见，省掉无意义的写放大）
    if (serialized === this.lastSerialized) return
    const write = this.writes.then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      this.writeSequence += 1
      const temporary = `${this.file}.${process.pid}.${this.writeSequence}.tmp`
      await writeFile(temporary, serialized, 'utf8')
      await rename(temporary, this.file)
      this.writeCount += 1
      // 成功落盘后再镜像一份 .bak：这是"损坏自动恢复"的数据来源，
      // 且镜像的是**最新成功状态**（恢复时不丢最后一次保存）
      await copyFile(this.file, `${this.file}.bak`).catch(() => undefined)
      this.lastSerialized = serialized
    })
    // 队列不能因一次失败而中断；错误仍由下面的 `await write` 交给调用方
    this.writes = write.then(() => undefined, () => undefined)
    await write
    this.cache = document
  }
}

/**
 * Where a deployment keeps its workbench data, derived from the output
 * directory so no extra configuration is needed: `<outputsDir>/../image-video-workbench`.
 * @param outputsDir - absolute output directory in use.
 * @returns the absolute data directory.
 */
export function resolveWorkbenchDirectory(outputsDir: string): string {
  return join(dirname(outputsDir), 'image-video-workbench')
}

/**
 * 按集内顺序号排序。
 * @param items - 带 `order` 的条目。
 * @returns 排序后的副本。
 */
function sortByOrder<T extends { readonly order: number }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => left.order - right.order)
}

/**
 * 把分段顺序号重编为 1..n，删段后保持连续。
 * @param segments - 分段列表。
 * @returns 重编号后的分段。
 */
function reindexOrder(segments: readonly SegmentRecord[]): SegmentRecord[] {
  return sortByOrder(segments).map((segment, index) => ({ ...segment, order: index + FIRST_ORDER }))
}

/**
 * 把一条分段插到目标顺序位置，并重编全部顺序号。
 * @param segments - 现有分段（不含待插入项）。
 * @param segment - 待插入分段；其 `order` 是目标位置。
 * @returns 插入并重编号后的分段。
 */
function insertSegment(segments: readonly SegmentRecord[], segment: SegmentRecord): SegmentRecord[] {
  const sorted = sortByOrder(segments)
  const index = Math.min(Math.max(segment.order - FIRST_ORDER, 0), sorted.length)
  return [...sorted.slice(0, index), segment, ...sorted.slice(index)]
    .map((entry, position) => ({ ...entry, order: position + FIRST_ORDER }))
}

/**
 * 校验顺序号。
 * @param value - 原始输入；缺省用调用方给的位置。
 * @param fallback - 缺省位置。
 * @returns 正整数顺序号。
 * @throws {Error} 非正整数时。
 */
function resolveOrder(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return Math.max(fallback, FIRST_ORDER)
  if (typeof value !== 'number' || !Number.isInteger(value) || value < FIRST_ORDER) {
    throw new Error('顺序必须是正整数')
  }
  return value
}

/**
 * 校验集级引用动作里的对象 id。
 * @param value - 原始输入。
 * @param label - 错误信息里的字段名。
 * @returns 去空白后的 id。
 * @throws {Error} 非字符串或为空时。
 */
function requireRefId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} 必须是非空字符串`)
  return value.trim()
}

/**
 * 取出剧本正文：兼容纯字符串与 `{ text }` 两种入参。
 * @param value - 原始输入。
 * @returns 待校验的正文值。
 */
function readScriptText(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  return (value as { text?: unknown }).text
}

/**
 * 按资源自身的分类给出集内引用分类；`brand` 等不可入集的分类落到「未分组」。
 * @param document - 当前文档。
 * @param projectId - 剧集 id。
 * @param resourceId - 资源 id。
 * @returns 集内引用分类。
 */
function resolveRefCategory(document: WorkbenchDocument, projectId: string, resourceId: string): EpisodeRefCategory {
  const resource = document.resources.find(candidate => candidate.id === resourceId && candidate.projectId === projectId)
  if (resource === undefined) return DEFAULT_EPISODE_REF_CATEGORY
  return EPISODE_REF_CATEGORIES.find(category => category === resource.kind) ?? DEFAULT_EPISODE_REF_CATEGORY
}

/**
 * 把资源引用顺序号重编为 1..n。
 * @param refs - 资源引用。
 * @returns 重编号后的引用。
 */
function reindexRefs(refs: readonly EpisodeResourceRef[]): EpisodeResourceRef[] {
  return sortByOrder(refs).map((ref, index) => ({ ...ref, order: index + FIRST_ORDER }))
}

/**
 * 把素材引用顺序号重编为 1..n。
 * @param refs - 素材引用。
 * @returns 重编号后的引用。
 */
function reindexAssetRefs(refs: readonly EpisodeAssetRef[]): EpisodeAssetRef[] {
  return sortByOrder(refs).map((ref, index) => ({ ...ref, order: index + FIRST_ORDER }))
}

/**
 * 把一个资源引用插到目标顺序位置，并重编全部顺序号。
 * @param refs - 现有引用（不含待插入项）。
 * @param ref - 待插入的引用（`order` 由本函数填充）。
 * @param order - 目标位置。
 * @returns 插入并重编号后的引用。
 */
function arrangeResourceRefs(
  refs: readonly EpisodeResourceRef[],
  ref: Pick<EpisodeResourceRef, 'resourceId' | 'category'>,
  order: unknown,
): EpisodeResourceRef[] {
  const sorted = sortByOrder(refs)
  const target = resolveOrder(order, sorted.length + FIRST_ORDER)
  const index = Math.min(Math.max(target - FIRST_ORDER, 0), sorted.length)
  return [...sorted.slice(0, index), { ...ref, order: target }, ...sorted.slice(index)]
    .map((entry, position) => ({ ...entry, order: position + FIRST_ORDER }))
}

/**
 * 把一个素材引用插到目标顺序位置，并重编全部顺序号。
 * @param refs - 现有引用（不含待插入项）。
 * @param ref - 待插入的引用（`order` 由本函数填充）。
 * @param order - 目标位置。
 * @returns 插入并重编号后的引用。
 */
function arrangeAssetRefs(
  refs: readonly EpisodeAssetRef[],
  ref: Pick<EpisodeAssetRef, 'assetId' | 'category'>,
  order: unknown,
): EpisodeAssetRef[] {
  const sorted = sortByOrder(refs)
  const target = resolveOrder(order, sorted.length + FIRST_ORDER)
  const index = Math.min(Math.max(target - FIRST_ORDER, 0), sorted.length)
  return [...sorted.slice(0, index), { ...ref, order: target }, ...sorted.slice(index)]
    .map((entry, position) => ({ ...entry, order: position + FIRST_ORDER }))
}
