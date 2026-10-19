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
  normalizeKeyframes, normalizeResourceKind, normalizeResourceName, normalizeResourceScope,
  type AssetRecord, type MediaKind, type ProjectRecord, type ResourceKind, type ResourceRecord,
  type TaskRecord, type TaskStatus,
} from './records.ts'
import { normalizeGraph, type WorkflowRecord, type WorkflowRunNodeRecord, type WorkflowRunRecord } from './workflow.ts'
import { MAX_NODE_CACHE, type CachedNodeResult } from './node-cache.ts'
import type { ExportPresetRecord, ResourceUsageRecord } from './records.ts'
import { migrateDocument, type WorkbenchMigration } from './migrate.ts'
import { duplicateTimeline, DEFAULT_FRAME_RATE, normalizeExportFormat, normalizeTimelineTracks, type TimelineRecord, type TimelineTrack } from './timeline.ts'
import { describeReferences, findAssetReferences, findResourceReferences } from './references.ts'

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
}

/** Facts the store is constructed with. */
export interface WorkbenchStoreOptions {
  /** 迁移链（默认用内置的；测试可注入）。 */
  readonly migrations?: readonly WorkbenchMigration[]
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
  /** 迁移链（默认用内置；测试可注入）。 */
  private readonly migrations: readonly WorkbenchMigration[] | undefined

  constructor(options: WorkbenchStoreOptions) {
    this.directory = options.directory
    this.file = join(options.directory, 'workbench.json')
    this.now = options.now ?? (() => new Date())
    this.migrations = options.migrations
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
   * List one project's assets, newest first.
   * @param projectId - project id.
   * @returns the asset records.
   */
  async listAssets(projectId: string): Promise<AssetRecord[]> {
    const document = await this.load()
    return document.assets
      .filter(asset => asset.projectId === projectId)
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
  async listResources(projectId: string, kind?: ResourceKind): Promise<ResourceRecord[]> {
    const document = await this.load()
    return document.resources
      .filter(resource => resource.projectId === projectId && (kind === undefined || resource.kind === kind))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  /**
   * Create a resource inside a project.
   * @param input - project, kind, name and optional note.
   * @returns the stored record.
   * @throws {Error} when the project is unknown.
   */
  async createResource(input: {
    projectId: string
    kind: ResourceKind | string
    name: unknown
    note?: string
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
    }
    document.resources.push(resource)
    document.projects = document.projects.map(candidate =>
      candidate.id === project.id ? { ...candidate, updatedAt: stamp } : candidate)
    await this.save(document)
    return resource
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
      id: existing?.id ?? newWorkbenchId('wfl'),
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
   * @returns the records.
   */
  async listTasks(limit = 50, projectId?: string): Promise<TaskRecord[]> {
    const document = await this.load()
    return document.tasks
      .filter(task => projectId === undefined || task.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(0, limit))
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
      // 迁移链：只升不降；真发生迁移时先把原文件备份成 .pre-migrate-v<N>
      const migration = migrateDocument(parsed, this.migrations)
      if (migration.applied.length > 0) {
        await copyFile(this.file, `${this.file}.pre-migrate-v${migration.fromVersion}`).catch(() => undefined)
      }
      this.cache = this.normalize(migration.document as Partial<WorkbenchDocument>)
      if (migration.applied.length > 0) {
        await this.save(this.cache).catch(() => undefined)
      }
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
      this.cache = {
        schemaVersion: WORKBENCH_SCHEMA_VERSION, projects: [], assets: [], tasks: [], resources: [], workflows: [],
        runs: [], timelines: [], nodeCache: [], resourceUsage: [], exportPresets: [],
      }
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
