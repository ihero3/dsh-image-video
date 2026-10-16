/**
 * 项目包导出（`T8-1`）。
 *
 * 包格式（**目录形态**，避免为一期引入 zip 依赖）：
 * ```
 * <targetDir>/
 *   manifest.json      # 格式版本 + 项目/资源/时间轴/工作流/任务 + 每个文件的 sha256
 *   files/<资产文件>   # 按 asset id 前缀命名，避免同名互相盖掉
 * ```
 * 三条纪律：① 清单里带**包格式版本**，将来升级能判断兼容；② 每个复制的文件都记
 * **sha256 与字节数**，导入侧能校验；③ 源文件已经丢了就**如实记进 `missing`**，
 * 不假装导出成功。
 */
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { WorkbenchStore } from './store.ts'
import type { AssetRecord, ResourceRecord, TaskRecord } from './records.ts'
import type { TimelineRecord } from './timeline.ts'
import type { WorkflowRecord } from './workflow.ts'

/** 当前包格式版本。 */
export const PACKAGE_FORMAT_VERSION = 1

/** 清单里的一条资产（文件已复制进 `files/` 时带校验和）。 */
export interface PackageAssetEntry {
  readonly id: string
  readonly kind: AssetRecord['kind']
  /** 包内相对路径（`files/…`）；源文件缺失时为 `undefined`。 */
  readonly file?: string
  readonly bytes: number
  readonly sha256?: string
  /** 导出时的原始绝对路径，仅作线索（导入不依赖它）。 */
  readonly originPath: string
  readonly prompt?: string
}

/** `manifest.json` 的结构。 */
export interface ProjectPackageManifest {
  readonly formatVersion: number
  readonly plugin: 'dsh-image-video'
  readonly exportedAt: string
  readonly project: { readonly id: string; readonly name: string; readonly createdAt: string; readonly updatedAt: string }
  readonly assets: readonly PackageAssetEntry[]
  readonly resources: readonly ResourceRecord[]
  readonly timelines: readonly TimelineRecord[]
  readonly workflows: readonly WorkflowRecord[]
  /** 任务账本一并带上，但导入侧一律转 `imported-idle`、不自动续跑（`T8-2`）。 */
  readonly tasks: readonly TaskRecord[]
  /** 导出时找不到的源文件（导入时会进"缺失清单"）。 */
  readonly missing: readonly string[]
}

/** 计算一个文件的 sha256。 */
export async function sha256File(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

/** 把项目名压成安全的目录名片段。 */
export function safeName(name: string): string {
  return name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'project'
}

/**
 * 把一个项目导出成包。
 * @param input.store - 工作台存储。
 * @param input.projectId - 要导出的项目。
 * @param input.targetDir - 包目录（不存在会创建；已存在则覆盖同名文件）。
 * @param input.now - 时钟（测试注入）。
 * @returns 清单路径与清单内容。
 * @throws {Error} 项目不存在时。
 */
export async function exportProjectPackage(input: {
  store: WorkbenchStore
  projectId: string
  targetDir: string
  now?: () => Date
}): Promise<{ manifestPath: string; manifest: ProjectPackageManifest }> {
  const { store, projectId, targetDir } = input
  const projects = await store.listProjects()
  const project = projects.find(candidate => candidate.id === projectId)
  if (project === undefined) throw new Error(`unknown project: ${projectId}`)

  await mkdir(join(targetDir, 'files'), { recursive: true })
  const assets: PackageAssetEntry[] = []
  const missing: string[] = []

  for (const asset of await store.listAssets(projectId)) {
    const info = await stat(asset.path).catch(() => undefined)
    if (info === undefined || !info.isFile()) {
      missing.push(asset.path)
      assets.push({
        id: asset.id, kind: asset.kind, bytes: asset.bytes, originPath: asset.path,
        ...asset.prompt === undefined ? {} : { prompt: asset.prompt },
      })
      continue
    }
    // 用 asset id 前缀命名，避免不同目录里的同名文件互相覆盖
    const file = `files/${asset.id}-${basename(asset.path)}`
    await copyFile(asset.path, join(targetDir, file))
    assets.push({
      id: asset.id, kind: asset.kind, file, bytes: info.size, sha256: await sha256File(asset.path),
      originPath: asset.path,
      ...asset.prompt === undefined ? {} : { prompt: asset.prompt },
    })
  }

  const manifest: ProjectPackageManifest = {
    formatVersion: PACKAGE_FORMAT_VERSION,
    plugin: 'dsh-image-video',
    exportedAt: (input.now?.() ?? new Date()).toISOString(),
    project: { id: project.id, name: project.name, createdAt: project.createdAt, updatedAt: project.updatedAt },
    assets,
    resources: await store.listResources(projectId) as readonly ResourceRecord[],
    timelines: await store.listTimelines(projectId),
    workflows: await store.listWorkflows(projectId),
    tasks: await store.listTasks(100, projectId),
    missing,
  }
  const manifestPath = join(targetDir, 'manifest.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return { manifestPath, manifest }
}


/** 导入结果（`T8-2`）。 */
export interface ImportResult {
  readonly projectId: string
  readonly projectName: string
  readonly assets: number
  /** 缺失或校验和不符的文件（要如实告诉用户，少了什么）。 */
  readonly missing: readonly string[]
  /** 同名冲突而被跳过的资源名（`T8-3` 的三选一里默认走"跳过"）。 */
  readonly skippedResources: readonly string[]
  readonly tasksImported: number
  readonly structureOnly: boolean
}

/** 把节点参数/轨道里指向旧路径的字符串改写成新路径。 */
function rewritePaths<T>(value: T, mapping: ReadonlyMap<string, string>): T {
  if (typeof value === 'string') return (mapping.get(value) ?? value) as unknown as T
  if (Array.isArray(value)) return value.map(item => rewritePaths(item, mapping)) as unknown as T
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, rewritePaths(item, mapping)]),
    ) as unknown as T
  }
  return value
}

/**
 * 导入一个项目包。
 * @param input.store - 存储。
 * @param input.packageDir - 包目录（含 `manifest.json`）。
 * @param input.outputsDir - 素材落地目录（`merge` 模式复制文件到这里）。
 * @param input.mode - `merge`（默认，复制素材）或 `structure-only`（只导结构）。
 * @param input.nameSuffix - 新项目名后缀（默认「（导入）」）。
 * @returns 导入结果。
 * @throws {Error} 包格式版本不认识、或清单缺字段时。
 */
export async function importProjectPackage(input: {
  store: WorkbenchStore
  packageDir: string
  outputsDir: string
  mode?: 'merge' | 'structure-only'
  nameSuffix?: string
}): Promise<ImportResult> {
  const { store, packageDir, outputsDir } = input
  const structureOnly = input.mode === 'structure-only'
  const raw = JSON.parse(await readFile(join(packageDir, 'manifest.json'), 'utf8')) as Partial<ProjectPackageManifest>
  if (raw.plugin !== 'dsh-image-video') throw new Error('这不是本插件导出的项目包（manifest.plugin 不匹配）')
  const version = typeof raw.formatVersion === 'number' ? raw.formatVersion : 0
  if (version < 1 || version > PACKAGE_FORMAT_VERSION) {
    throw new Error(`包格式版本 ${version} 不认识（本版本支持 1..${PACKAGE_FORMAT_VERSION}）：请用对应的插件版本导入。`)
  }
  if (raw.project === undefined) throw new Error('包清单缺少 project 段')

  const project = await store.createProject(`${raw.project.name}${input.nameSuffix ?? '（导入）'}`)
  await mkdir(outputsDir, { recursive: true })

  const missing: string[] = []
  const mapping = new Map<string, string>()
  let assetCount = 0
  for (const entry of raw.assets ?? []) {
    if (structureOnly || entry.file === undefined) {
      missing.push(entry.originPath)
      // 仅结构：记录指向原路径（本机大概率没有），让用户自己补
      if (structureOnly) {
        await store.attachAsset({ projectId: project.id, path: entry.originPath, kind: entry.kind, bytes: entry.bytes })
        mapping.set(entry.originPath, entry.originPath)
        assetCount += 1
      }
      continue
    }
    const inside = join(packageDir, entry.file)
    const info = await stat(inside).catch(() => undefined)
    if (info === undefined) { missing.push(entry.originPath); continue }
    if (entry.sha256 !== undefined && (await sha256File(inside)) !== entry.sha256) {
      missing.push(`${entry.originPath}（包内副本校验和不符）`)
      continue
    }
    const targetPath = join(outputsDir, `${entry.id}-${basename(entry.originPath)}`)
    await copyFile(inside, targetPath)
    await store.attachAsset({
      projectId: project.id, path: targetPath, kind: entry.kind, bytes: info.size,
      ...entry.prompt === undefined ? {} : { prompt: entry.prompt },
    })
    mapping.set(entry.originPath, targetPath)
    assetCount += 1
  }

  const skippedResources: string[] = []
  const seenResourceNames = new Set<string>()
  for (const resource of raw.resources ?? []) {
    const key = `${resource.kind}:${resource.name}`
    if (seenResourceNames.has(key)) { skippedResources.push(resource.name); continue }
    seenResourceNames.add(key)
    await store.createResource({
      projectId: project.id, kind: resource.kind, name: resource.name,
      ...resource.note === undefined ? {} : { note: resource.note },
      ...resource.keyframes === undefined ? {} : { keyframes: resource.keyframes },
    })
  }

  for (const timeline of raw.timelines ?? []) {
    await store.saveTimeline({
      projectId: project.id, name: timeline.name, frameRate: timeline.frameRate,
      burnSubtitles: timeline.burnSubtitles,
      tracks: rewritePaths(timeline.tracks, mapping),
    })
  }
  for (const workflow of raw.workflows ?? []) {
    await store.saveWorkflow({
      projectId: project.id, name: workflow.name,
      nodes: rewritePaths(workflow.nodes, mapping), edges: workflow.edges,
    })
  }

  const tasksImported = await store.importTasks(project.id, raw.tasks ?? [])
  return {
    projectId: project.id, projectName: project.name, assets: assetCount,
    missing, skippedResources, tasksImported, structureOnly,
  }
}


/** 资源包清单（`T8-3`）：只有元数据，没有字节，可 diff、可手改。 */
export interface ResourcePackageManifest {
  readonly formatVersion: number
  readonly plugin: 'dsh-image-video'
  readonly exportedAt: string
  readonly source: { readonly projectId: string; readonly projectName: string }
  readonly resources: readonly ResourceRecord[]
}

/** 同名冲突的处理策略。 */
export type ResourceConflictStrategy = 'skip' | 'rename' | 'replace'

/** 资源包导入报告。 */
export interface ResourceImportResult {
  readonly imported: number
  readonly skipped: readonly string[]
  readonly renamed: readonly string[]
  readonly replaced: readonly string[]
}

/**
 * 把一个项目的创作资源导出成资源包。
 * @param input.store - 存储。
 * @param input.projectId - 源项目。
 * @param input.targetDir - 输出目录。
 * @param input.now - 时钟。
 * @returns 清单路径与内容。
 */
export async function exportResourcePackage(input: {
  store: WorkbenchStore
  projectId: string
  targetDir: string
  now?: () => Date
}): Promise<{ manifestPath: string; manifest: ResourcePackageManifest }> {
  const projects = await input.store.listProjects()
  const project = projects.find(candidate => candidate.id === input.projectId)
  if (project === undefined) throw new Error(`unknown project: ${input.projectId}`)
  const manifest: ResourcePackageManifest = {
    formatVersion: PACKAGE_FORMAT_VERSION,
    plugin: 'dsh-image-video',
    exportedAt: (input.now?.() ?? new Date()).toISOString(),
    source: { projectId: project.id, projectName: project.name },
    resources: await input.store.listResources(project.id) as readonly ResourceRecord[],
  }
  await mkdir(input.targetDir, { recursive: true })
  const manifestPath = join(input.targetDir, 'resources.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return { manifestPath, manifest }
}

/**
 * 把资源包导入一个项目。
 * 口径（`T8-3`）：**默认绝不覆盖同名资源**；冲突按策略处理并逐条报出来。
 * @param input.store - 存储。
 * @param input.projectId - 目标项目。
 * @param input.packageDir - 含 `resources.json` 的目录（也可直接给该文件路径）。
 * @param input.strategy - `skip`（默认）/`rename`/`replace`。
 * @returns 导入报告。
 * @throws {Error} 包格式不认识时。
 */
export async function importResourcePackage(input: {
  store: WorkbenchStore
  projectId: string
  packageDir: string
  strategy?: ResourceConflictStrategy
}): Promise<ResourceImportResult> {
  const file = input.packageDir.endsWith('.json') ? input.packageDir : join(input.packageDir, 'resources.json')
  const raw = JSON.parse(await readFile(file, 'utf8')) as Partial<ResourcePackageManifest>
  if (raw.plugin !== 'dsh-image-video') throw new Error('这不是本插件导出的资源包（manifest.plugin 不匹配）')
  const version = typeof raw.formatVersion === 'number' ? raw.formatVersion : 0
  if (version < 1 || version > PACKAGE_FORMAT_VERSION) {
    throw new Error(`资源包格式版本 ${version} 不认识（本版本支持 1..${PACKAGE_FORMAT_VERSION}）。`)
  }
  const strategy = input.strategy ?? 'skip'
  const existing = await input.store.listResources(input.projectId)
  const skipped: string[] = []
  const renamed: string[] = []
  const replaced: string[] = []
  let imported = 0

  for (const resource of raw.resources ?? []) {
    const clash = existing.find(candidate => candidate.kind === resource.kind && candidate.name === resource.name)
    let name = resource.name
    if (clash !== undefined) {
      if (strategy === 'skip') { skipped.push(resource.name); continue }
      if (strategy === 'rename') {
        let suffix = 2
        while (existing.some(candidate => candidate.kind === resource.kind && candidate.name === `${resource.name} (${suffix})`)) suffix += 1
        name = `${resource.name} (${suffix})`
        renamed.push(`${resource.name} → ${name}`)
      }
      if (strategy === 'replace') {
        await input.store.removeResource(clash.id, { force: true })
        replaced.push(resource.name)
      }
    }
    await input.store.createResource({
      projectId: input.projectId, kind: resource.kind, name,
      ...resource.note === undefined ? {} : { note: resource.note },
      ...resource.keyframes === undefined ? {} : { keyframes: resource.keyframes },
    })
    imported += 1
  }
  return { imported, skipped, renamed, replaced }
}
