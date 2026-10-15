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
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  newWorkbenchId, normalizeMediaKind, normalizeProjectName, normalizeTaskStatus, WORKBENCH_SCHEMA_VERSION,
  normalizeResourceKind, normalizeResourceName,
  type AssetRecord, type MediaKind, type ProjectRecord, type ResourceKind, type ResourceRecord,
  type TaskRecord, type TaskStatus,
} from './records.ts'

/** One stored document: every project and asset the workbench knows about. */
interface WorkbenchDocument {
  schemaVersion: number
  projects: ProjectRecord[]
  assets: AssetRecord[]
  /** Generation history; kept when a project is removed (the file still exists). */
  tasks: TaskRecord[]
  /** Reusable creative resources (roles, scenes, props, brands, styles, voices). */
  resources: ResourceRecord[]
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
export class WorkbenchStore {
  /** Absolute directory holding the document. */
  readonly directory: string
  private readonly file: string
  private readonly now: () => Date
  private cache: WorkbenchDocument | undefined

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
  async removeAsset(id: string): Promise<boolean> {
    const document = await this.load()
    const before = document.assets.length
    document.assets = document.assets.filter(asset => asset.id !== id)
    if (document.assets.length === before) return false
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
  async removeResource(id: string): Promise<boolean> {
    const document = await this.load()
    const before = document.resources.length
    document.resources = document.resources.filter(resource => resource.id !== id)
    if (document.resources.length === before) return false
    await this.save(document)
    return true
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

  /** Read the document, caching it after the first read. */
  private async load(): Promise<WorkbenchDocument> {
    if (this.cache !== undefined) return this.cache
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8')) as Partial<WorkbenchDocument>
      this.cache = {
        schemaVersion: raw.schemaVersion ?? WORKBENCH_SCHEMA_VERSION,
        projects: raw.projects ?? [],
        assets: raw.assets ?? [],
        tasks: raw.tasks ?? [],
        resources: raw.resources ?? [],
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.cache = { schemaVersion: WORKBENCH_SCHEMA_VERSION, projects: [], assets: [], tasks: [], resources: [] }
    }
    return this.cache
  }

  /** Write the document atomically and refresh the cache. */
  private async save(document: WorkbenchDocument): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
    await rename(temporary, this.file)
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
