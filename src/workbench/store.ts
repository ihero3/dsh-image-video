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
  newWorkbenchId, normalizeMediaKind, normalizeProjectName, WORKBENCH_SCHEMA_VERSION,
  type AssetRecord, type MediaKind, type ProjectRecord,
} from './records.ts'

/** One stored document: every project and asset the workbench knows about. */
interface WorkbenchDocument {
  schemaVersion: number
  projects: ProjectRecord[]
  assets: AssetRecord[]
}

/** Facts the store is constructed with. */
export interface WorkbenchStoreOptions {
  /** Directory holding `workbench.json` (created on first write). */
  readonly directory: string
  /** Clock override, for deterministic tests. */
  readonly now?: () => Date
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
   * @param input - project, path and media facts.
   * @returns the stored record.
   * @throws {Error} when the project is unknown.
   */
  async attachAsset(input: AssetInput): Promise<AssetRecord> {
    const document = await this.load()
    const project = document.projects.find(candidate => candidate.id === input.projectId)
    if (project === undefined) throw new Error(`unknown project: ${input.projectId}`)
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
    return asset
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

  /** Read the document, caching it after the first read. */
  private async load(): Promise<WorkbenchDocument> {
    if (this.cache !== undefined) return this.cache
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8')) as Partial<WorkbenchDocument>
      this.cache = {
        schemaVersion: raw.schemaVersion ?? WORKBENCH_SCHEMA_VERSION,
        projects: raw.projects ?? [],
        assets: raw.assets ?? [],
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.cache = { schemaVersion: WORKBENCH_SCHEMA_VERSION, projects: [], assets: [] }
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
