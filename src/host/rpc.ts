/**
 * Workbench host face: the one RPC channel the browser half calls.
 *
 * The channel carries the connection's result envelope — structured refusals
 * instead of thrown errors — and every answer stays free of credentials and of
 * paths beyond the configured output directory. Today it answers only the
 * health check; the project / asset / task endpoints join the same channel in
 * later phases. The channel name and the health shape live in
 * `src/workbench-contract.ts`, which both halves import, so the browser bundle
 * carries them without pulling in any host code.
 */
import { duplicateClip, splitClipAt } from '../workbench/edits.ts'
import { copyFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { extname } from 'node:path'
import { extractOutcome } from '../workbench/ledger.ts'
import { newWorkbenchId } from '../workbench/records.ts'
import { makeSubtitleIds } from '../workbench/subtitles.ts'
import { parseSrt, serializeSrt } from '../workbench/srt.ts'
import { parseVtt, serializeVtt } from '../workbench/vtt.ts'
import { findDuplicateAssets } from '../workbench/duplicates.ts'
import { sha256File } from '../workbench/package.ts'
import { listDiagnosticLogs } from './diagnostics-log.ts'
import { summarizePreflight } from './assembly.ts'
import { formatDuration, predictRenderMs } from '../media/render-predict.ts'
import { inspectProjectPackage } from '../workbench/package.ts'
import { renderOverview } from '../media/render-registry.ts'
import { reportAssetUsage } from '../workbench/usage.ts'
import { sizeReport } from '../workbench/size-report.ts'
import { projectStats } from '../workbench/project-stats.ts'
import { estimateExport, formatBytes } from '../workbench/estimate.ts'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the host connection merge (`ctx.connection`) and the handler signature.
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { groupRenderSets, retryError } from '../media/render-registry.ts'
import { PLUGIN_VERSION } from '../version.ts'
import { WORKBENCH_RPC_CHANNEL, type WorkbenchHealth, type WorkbenchOptions } from '../workbench-contract.ts'
import {
  IMAGE_SIZE_OPTIONS, IMAGE_STYLE_OPTIONS, MAX_VIDEO_DURATION, MIN_VIDEO_DURATION, PROVIDERS, VIDEO_ASPECT_RATIOS,
} from '../runtime-defaults.ts'
import type { WorkbenchStore } from '../workbench/store.ts'
import { listOutputs, type OutputFile } from '../workbench/outputs.ts'
import { sep } from 'node:path'
import { resolve } from 'node:path'
import { stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { probeFfmpeg } from '../media/ffmpeg.ts'
import { probeMediaSpec } from '../media/render.ts'
import { planRetention } from '../media/retention.ts'
import { EXPORT_PRESETS } from '../workbench/presets.ts'
import { checkInlineTimelineBounds, findClipOverruns, validateTimeline } from '../workbench/validate.ts'
import type { TimelineRecord } from '../workbench/timeline.ts'
import { exportProjectPackage, exportResourcePackage, importProjectPackage, importResourcePackage } from '../workbench/package.ts'
import type { GenerationRegistry } from '../workbench/cancel.ts'
import type { GenerationTool, WorkflowRunner } from '../workbench/runner.ts'
import type { RenderRegistry } from '../media/render-registry.ts'
import {
  normalizeMediaKind, normalizeProjectName, normalizeResourceKind, normalizeResourceName,
} from '../workbench/records.ts'

export { WORKBENCH_RPC_CHANNEL }
export type { WorkbenchHealth }

/**
 * What happened when this process tried to register the channel.
 *
 * The failure this surfaces is worth stating plainly: `connection.rpc.handle()`
 * registers its web route on the **context that read the service**, so a caller
 * whose context cannot see `webServer` makes the registration throw — and all the
 * browser half ever sees is `HTTP 405`. Recording it here (and serving it from
 * `/image-video/status`) turns that silent 405 into a readable fact.
 */
export interface WorkbenchRpcStatus {
  /** Channel the workbench registers under. */
  readonly channel: string
  /** `true` once `connection.rpc.handle` returned (the web route exists). */
  readonly registered: boolean
  /** `true` while the plugin is still waiting for the deferred injects. */
  readonly awaiting: boolean
  /** Registration failure message, when it threw. */
  readonly error?: string
}

let status: WorkbenchRpcStatus = { channel: WORKBENCH_RPC_CHANNEL, registered: false, awaiting: false }

/** Read the host-side registration state (served by `/image-video/status`). */
export function workbenchRpcStatus(): WorkbenchRpcStatus {
  return status
}

/** Host facts the channel answers with, plus the store behind the project API. */
/** 批量登记/导入的单次上限（防一次性放大）。 */
const MAX_BULK_ATTACH = 200

/** 允许导入的扩展名 → 媒体种类。 */
const IMPORTABLE_EXTENSIONS: Readonly<Record<string, 'image' | 'video'>> = {
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image',
  '.mp4': 'video', '.mov': 'video', '.webm': 'video',
}

export interface WorkbenchRpcDeps {
  /** Configured provider name (`threerouter` | `wanx` | `minimax` | `seedance`). */
  provider: string
  /** Resolved absolute output directory. */
  outputsDir: string
  /** Projects, assets, resources and the task ledger (phase 2). */
  store: WorkbenchStore
  /** In-flight generations the workbench may cancel. */
  registry: GenerationRegistry
  /** 图运行器（`T4-4`）。 */
  runner: WorkflowRunner
  /** 导出任务表（`T5-5`）。 */
  renders: RenderRegistry
  /**
   * 生成适配器（`A145`）：与对话里的 `generate_image` / `generate_video` **是同一对工具**
   * （由 index 用 `proxyTool` 注入），所以参数语义、计费口径、账本与取消完全一致。
   * 缺省时不提供 `media/generate`（测试宿主可以不带生成能力）。
   */
  readonly generate?: { readonly image: GenerationTool; readonly video: GenerationTool }
  /** 素材探测缓存（`A77`；未注入时退回每次直连探测）。 */
  probeCache?: { get: (file: string) => Promise<{ width?: number; height?: number; fps?: number; durationMs?: number; hasAudio: boolean } | undefined> }
  /** 诊断收集器（`A9`）；缺省时端点返回空错误列表。 */
  readonly diagnostics?: { snapshot: () => { errors: readonly unknown[]; errorCount: number } }
  /** 生效默认值视图（`T2-11`）；缺省时不带该字段。 */
  defaults?: () => Record<string, string | number | null>
  /** 默认值编辑器的可选项；缺省时不带该字段。 */
  options?: () => WorkbenchOptions
}

/**
 * 默认值编辑器的可选项：直接复用协议层的白名单，避免界面允许值与被拒值分叉。
 *
 * 服务端下发而不是客户端内置——浏览器包里出现服务商名会被
 * `tests/client-no-hardcoding.test.ts` 判为部署配置泄漏（`T2-11`）。
 * @returns 与协议层校验同源的下拉选项。
 */
export function workbenchOptions(): WorkbenchOptions {
  return {
    // minimax 只有视频能力，不作为图片服务商选项
    imageProviders: PROVIDERS.filter(provider => provider !== 'minimax'),
    videoProviders: [...PROVIDERS],
    imageSizes: IMAGE_SIZE_OPTIONS,
    imageStyles: IMAGE_STYLE_OPTIONS.filter(option => option.id !== '').map(option => option.id),
    videoAspectRatios: [...VIDEO_ASPECT_RATIOS],
    videoDuration: { min: MIN_VIDEO_DURATION, max: MAX_VIDEO_DURATION },
  }
}

/**
 * Build the channel handler.
 * @param deps - host facts the answers are built from.
 * @returns the connection RPC handler.
 */
export function createWorkbenchHandler(deps: WorkbenchRpcDeps): ConnectionRpcHandler {
  return async (endpoint, payload) => {
    try {
      const value = await answer(deps, endpoint, payload)
      return { ok: true, value }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        error: {
          code: message.startsWith('unknown workbench endpoint') ? 'workbench/unknown-endpoint'
            : message.startsWith('invalid workbench payload') ? 'workbench/invalid-payload'
            : 'workbench/failed',
          message,
          details: {},
        },
      }
    }
  }
}

/**
 * Answer one endpoint. Payloads are read field by field through {@link field}, so a
 * malformed request fails with a named error instead of a TypeError deep in the store.
 * @param deps - host facts.
 * @param endpoint - channel-relative endpoint.
 * @param payload - raw request payload.
 * @returns the endpoint's value.
 */
async function answer(deps: WorkbenchRpcDeps, endpoint: string, payload: unknown): Promise<unknown> {
  switch (endpoint) {
    case 'health': {
      const value: WorkbenchHealth = {
        plugin: 'dsh-image-video',
        version: PLUGIN_VERSION,
        channel: WORKBENCH_RPC_CHANNEL,
        provider: deps.provider,
        outputsDir: deps.outputsDir,
        at: new Date().toISOString(),
        ...deps.defaults === undefined ? {} : { defaults: deps.defaults() },
        ...deps.options === undefined ? {} : { options: deps.options() },
      }
      return value
    }
    // ---- 阶段 2 首个切片：项目 / 素材 / 产物清单 ----------------------------------
    case 'projects/list':
      return { projects: await deps.store.listProjects() }
    case 'projects/create':
      // 校验放在 handler 这层，错误码才能准确报成 invalid-payload（store 仍持有规则本身）
      return { project: await deps.store.createProject(validated(() => normalizeProjectName(field(payload, 'name')))) }
    case 'projects/remove':
      return { removed: await deps.store.removeProject(text(payload, 'id')) }
    case 'assets/list':
      return { assets: await deps.store.listAssets(text(payload, 'projectId')) }
    // `A152`：批量登记素材（「登记全部未登记产物」一次调用，避免 N 次往返）
    case 'assets/attach-many': {
      const projectId = text(payload, 'projectId')
      const items = field(payload, 'items')
      if (!Array.isArray(items)) throw new Error('items 必须是数组')
      let created = 0
      const results: unknown[] = []
      for (const item of items.slice(0, MAX_BULK_ATTACH)) {
        const record = (item ?? {}) as Record<string, unknown>
        const path = typeof record.path === 'string' ? record.path.trim() : ''
        if (path === '') continue
        const kind = typeof record.kind === 'string' && record.kind !== ''
          ? record.kind
          : IMPORTABLE_EXTENSIONS[extname(path).toLowerCase()] ?? 'image'
        const bytes = typeof record.bytes === 'number' ? record.bytes : undefined
        const attached = await deps.store.attachAsset({
          projectId, path, kind,
          ...bytes === undefined ? {} : { bytes },
        })
        if (attached.created) created += 1
        results.push(attached.asset)
      }
      return { created, assets: results }
    }
    case 'assets/attach': {
      const attached = await deps.store.attachAsset({
        projectId: text(payload, 'projectId'),
        path: text(payload, 'path'),
        kind: validated(() => normalizeMediaKind(text(payload, 'kind'))),
        bytes: optionalNumber(payload, 'bytes'),
        provider: optionalText(payload, 'provider'),
        model: optionalText(payload, 'model'),
        prompt: optionalText(payload, 'prompt'),
      })
      return attached
    }
    // 对话卡片入口的后端（`T6-1`）：卡片只给一个文件路径，由宿主决定放进哪个项目/时间轴
    case 'assets/quick-add': {
      const path = text(payload, 'path')
      const explicit = optionalText(payload, 'projectId')
      const listed = await deps.store.listProjects()
      const project = explicit !== undefined && explicit !== ''
        ? listed.find(candidate => candidate.id === explicit)
        : listed[0]
      const target = project ?? await deps.store.createProject('对话素材')
      const kind = field(payload, 'kind') === 'image' || field(payload, 'kind') === 'video'
        ? field(payload, 'kind') as 'image' | 'video'
        : /\.(png|jpe?g|webp|gif)$/i.test(path) ? 'image' as const : 'video' as const
      // 卡片只给路径，字节数由宿主补：先量一下，量不到就不写
      const { stat } = await import('node:fs/promises')
      const size = await stat(path).then(info => info.size).catch(() => undefined)
      const attached = await deps.store.attachAsset({
        projectId: target.id, path, kind,
        ...size === undefined ? {} : { bytes: size },
        ...optionalText(payload, 'prompt') === undefined ? {} : { prompt: optionalText(payload, 'prompt') },
        ...optionalText(payload, 'model') === undefined ? {} : { model: optionalText(payload, 'model') },
        ...optionalText(payload, 'provider') === undefined ? {} : { provider: optionalText(payload, 'provider') },
      })
      if (field(payload, 'intoTimeline') !== true) {
        return { projectId: target.id, projectName: target.name, asset: attached.asset, created: attached.created }
      }
      // 放进时间轴：用该项目最近的时间轴；没有就建一条三轨的
      const stamp = Date.now().toString(36)
      const timelines = await deps.store.listTimelines(target.id)
      const existing = timelines[0]
      const base = existing ?? await deps.store.saveTimeline({
        projectId: target.id, name: `${target.name} 成片`,
        tracks: [
          { id: 'v1', kind: 'video', clips: [] },
          { id: 'a1', kind: 'audio', clips: [] },
          { id: 's1', kind: 'subtitle', clips: [] },
        ],
      })
      const durationMs = typeof field(payload, 'durationMs') === 'number' ? Math.max(1, Math.round(field(payload, 'durationMs') as number)) : 3000
      let clipId = ''
      const tracks = base.tracks.map(track => {
        if (track.kind !== 'video') return { ...track, clips: [...track.clips] }
        const end = track.clips.reduce((longest, clip) => Math.max(longest, clip.startMs + clip.durationMs), 0)
        clipId = `clip-${stamp}-quick`
        return { ...track, clips: [...track.clips, { id: clipId, assetPath: attached.asset.path, startMs: end, durationMs }] }
      })
      const saved = await deps.store.saveTimeline({
        id: base.id, projectId: base.projectId, name: base.name,
        tracks, frameRate: base.frameRate, burnSubtitles: base.burnSubtitles,
      })
      return { projectId: target.id, projectName: target.name, asset: attached.asset, created: attached.created, timelineId: saved.id, clipId }
    }
    // `A-2`：批量删除素材（多选删除一次调用，避免 N 次往返）
    case 'assets/remove-many': {
      const raw = field(payload, 'ids')
      if (!Array.isArray(raw)) throw new Error('ids 必须是字符串数组')
      const ids = raw.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
      const force = field(payload, 'force') === true
      let removed = 0
      const skipped: Array<{ id: string; reason: string }> = []
      for (const id of ids.slice(0, 200)) {
        try {
          const ok = await deps.store.removeAsset(id, force ? { force: true } : {})
          if (ok) removed += 1
          else skipped.push({ id, reason: '不存在' })
        } catch (error) {
          skipped.push({ id, reason: error instanceof Error ? error.message : String(error) })
        }
      }
      return { removed, skipped }
    }
    case 'assets/remove':
      return {
        removed: await deps.store.removeAsset(text(payload, 'id'), field(payload, 'force') === true ? { force: true } : {}),
      }
    case 'projects/rename': {
      const id = text(payload, 'id')
      const project = await deps.store.renameProject(id, validated(() => normalizeProjectName(field(payload, 'name'))))
      if (project === undefined) throw new Error(`unknown project: ${id}`)
      return { project }
    }
    // ---- 创作资源（阶段 2）------------------------------------------------------
    case 'resources/list': {
      const kind = optionalText(payload, 'kind')
      const resources = await deps.store.listResources(
        text(payload, 'projectId'),
        kind === undefined ? undefined : validated(() => normalizeResourceKind(kind)),
      )
      return { resources }
    }
    case 'resources/create':
      return {
        resource: await deps.store.createResource({
          projectId: text(payload, 'projectId'),
          kind: validated(() => normalizeResourceKind(text(payload, 'kind'))),
          name: validated(() => normalizeResourceName(field(payload, 'name'))),
          note: optionalText(payload, 'note'),
          ...field(payload, 'keyframes') === undefined ? {} : { keyframes: field(payload, 'keyframes') },
          ...optionalText(payload, 'assetPath') === undefined ? {} : { assetPath: optionalText(payload, 'assetPath') as string },
          ...Array.isArray(field(payload, 'assetPaths')) ? { assetPaths: (field(payload, 'assetPaths') as unknown[]).filter((entry): entry is string => typeof entry === 'string') } : {},
        }),
      }
    // `A153`：改资源（改名 / 备注 / 参考图；`assetPath: null` 表示清除参考图）
    case 'resources/update': {
      const id = text(payload, 'id')
      const resource = await deps.store.updateResource(id, {
        ...field(payload, 'name') === undefined ? {} : { name: field(payload, 'name') },
        ...optionalText(payload, 'note') === undefined ? {} : { note: optionalText(payload, 'note') as string },
        ...field(payload, 'assetPath') === undefined
          ? {}
          : { assetPath: field(payload, 'assetPath') === null ? null : text(payload, 'assetPath') },
        ...field(payload, 'assetPaths') === undefined
          ? {}
          : { assetPaths: field(payload, 'assetPaths') === null ? null : (field(payload, 'assetPaths') as unknown[]).filter((entry): entry is string => typeof entry === 'string') },
      })
      if (resource === undefined) throw new Error(`unknown resource: ${id}`)
      return { resource }
    }
    case 'resources/remove':
      return {
        removed: await deps.store.removeResource(text(payload, 'id'), field(payload, 'force') === true ? { force: true } : {}),
      }
    case 'tasks/list': {
      const limit = optionalNumber(payload, 'limit')
      const projectId = optionalText(payload, 'projectId')
      return { tasks: await deps.store.listTasks(limit ?? undefined, projectId) }
    }
    // ---- 工作流文档（阶段 4）----------------------------------------------------
    case 'workflows/list':
      return { workflows: await deps.store.listWorkflows(text(payload, 'projectId')) }
    case 'workflows/save':
      return {
        workflow: await deps.store.saveWorkflow({
          id: optionalText(payload, 'id'),
          projectId: text(payload, 'projectId'),
          name: optionalText(payload, 'name'),
          nodes: field(payload, 'nodes') ?? [],
          edges: field(payload, 'edges') ?? [],
        }),
      }
    case 'workflows/remove':
      return { removed: await deps.store.removeWorkflow(text(payload, 'id')) }
    // ---- 运行（阶段 4，T4-4）----------------------------------------------------
    case 'workflows/run': {
      const workflowId = text(payload, 'workflowId')
      const workflow = await deps.store.findWorkflow(workflowId)
      if (workflow === undefined) throw new Error(`unknown workflow: ${workflowId}`)
      return { run: await deps.runner.begin(workflow) }
    }
    case 'workflows/runs':
      return {
        runs: await deps.store.listRuns(text(payload, 'projectId'), optionalText(payload, 'workflowId')),
      }
    case 'workflows/run-cancel':
      return { cancelled: deps.runner.cancel(text(payload, 'runId')) }
    case 'workflows/run-retry': {
      const runId = text(payload, 'runId')
      const previous = await deps.store.findRun(runId)
      if (previous === undefined) throw new Error(`unknown run: ${runId}`)
      return { run: await deps.runner.retry(previous) }
    }
    // 时间轴一致性校验（`A34`）：可传 timelineId，也可直接传一份未保存的 document 做保存前预检
    case 'timelines/validate': {
      const inline = field(payload, 'document')
      const timelineId = optionalText(payload, 'timelineId')
      let document: TimelineRecord | undefined
      if (inline !== undefined && typeof inline === 'object') {
        // 未保存文档不受存储层规模校验保护 → 这里补边界，超限直接给出可操作错误
        const problem = checkInlineTimelineBounds(inline)
        if (problem !== undefined) throw new Error(problem)
        document = inline as TimelineRecord
      } else if (timelineId !== undefined) {
        document = await deps.store.findTimeline(timelineId)
        if (document === undefined) throw new Error(`找不到时间轴 ${timelineId}；先用 timelines/list`)
      } else {
        throw new Error('timelines/validate 需要 timelineId 或 document')
      }
      const known = new Set(await deps.store.referencedAssetPaths())
      const issues = [...validateTimeline(document, { knownAssetPaths: known })]
      // `A45`：探测真实素材时长，找出"片段比素材还长"（导出后半段没画面，用户很难自查）
      try {
        const probe = await probeFfmpeg()
        if (probe.available) {
          const paths = [...new Set(document.tracks
            .flatMap(track => track.clips)
            .map(clip => clip.assetPath)
            .filter((path): path is string => typeof path === 'string'))].slice(0, 20)
          const durations = new Map<string, number>()
          for (const relative of paths) {
            const absolute = resolve(deps.outputsDir, relative)
            const spec = deps.probeCache === undefined
              ? await probeMediaSpec(probe.path ?? 'ffmpeg', absolute)
              : await deps.probeCache.get(absolute)
            if (spec?.durationMs !== undefined) durations.set(relative, spec.durationMs)
          }
          issues.push(...findClipOverruns(document, durations))
        }
      } catch {
        // 探测失败不影响校验结果（只是少了这一项检查）
      }
      return { ok: issues.length === 0, issues }
    }
    // `A132`：素材库按项目统计（谁最占地方；只报告）
    case 'assets/project-stats': {
      const projects = await deps.store.listProjects()
      const assets = (await Promise.all(projects.map(project => deps.store.listAssets(project.id)))).flat()
      const timelines = (await Promise.all(projects.map(project => deps.store.listTimelines(project.id)))).flat()
      return { stats: projectStats(projects.map(project => ({ id: project.id, name: project.name })), assets, timelines) }
    }
    // `A116`：素材体积排行（Top N + 总量/中位数/占比；只报告）
    case 'assets/size-report': {
      const projects = await deps.store.listProjects()
      const assets = (await Promise.all(projects.map(project => deps.store.listAssets(project.id)))).flat()
      const timelines = (await Promise.all(projects.map(project => deps.store.listTimelines(project.id)))).flat()
      const usage = reportAssetUsage(assets, timelines)
      const unusedPaths = new Set(usage.assets.filter(row => row.unused).map(row => row.assetPath))
      const report = sizeReport(
        assets.map(asset => ({ path: asset.path, ...asset.bytes === undefined ? {} : { bytes: asset.bytes }, unused: unusedPaths.has(asset.path) })),
        { ...optionalNumber(payload, 'topN') === undefined ? {} : { topN: optionalNumber(payload, 'topN') as number } },
      )
      return { size: report }
    }
    // `A112`：素材内容去重检测（按大小分组 + 仅同大小算 sha256；只报告不删除）
    case 'assets/duplicates': {
      const projects = await deps.store.listProjects()
      const assets = (await Promise.all(projects.map(project => deps.store.listAssets(project.id)))).flat()
      const report = await findDuplicateAssets(
        assets.map(asset => ({ path: asset.path, ...asset.bytes === undefined ? {} : { bytes: asset.bytes } })),
        async path => sha256File(resolve(deps.outputsDir, path)).catch(() => undefined),
        { ...optionalNumber(payload, 'maxHashFiles') === undefined ? {} : { maxHashFiles: optionalNumber(payload, 'maxHashFiles') as number } },
      )
      return { duplicates: report }
    }
    // `A82`：素材利用率报告（哪些素材从未被时间轴用过；只报告不删除）
    case 'assets/usage': {
      const projectId = optionalText(payload, 'projectId')
      const projects = projectId === undefined || projectId === ''
        ? await deps.store.listProjects()
        : (await deps.store.listProjects()).filter(project => project.id === projectId)
      const assets = (await Promise.all(projects.map(project => deps.store.listAssets(project.id)))).flat()
      const timelines = (await Promise.all(projects.map(project => deps.store.listTimelines(project.id)))).flat()
      const report = reportAssetUsage(assets, timelines)
      return {
        summary: report.summary,
        assets: report.assets.map(row => ({
          path: row.assetPath, projectId: row.projectId, kind: row.kind,
          ...row.bytes === undefined ? {} : { bytes: row.bytes },
          timesUsed: row.timesUsed, unused: row.unused,
          timelines: row.timelines.map(entry => ({ id: entry.timelineId, name: entry.timelineName, clips: entry.clips })),
        })),
      }
    }
    // 素材探测（`A44`）：真实时长/分辨率/帧率/有无音轨，供界面拖拽与 Agent 预估
    case 'assets/probe': {
      const relative = text(payload, 'path')
      const absolute = resolve(deps.outputsDir, relative)
      const known = new Set(await deps.store.referencedAssetPaths())
      const inside = absolute === deps.outputsDir || absolute.startsWith(`${deps.outputsDir}${sep}`)
      if (!inside && !known.has(relative)) {
        throw new Error(`只能探测 outputs 目录内或已登记的素材（收到 ${relative}）`)
      }
      const probe = await probeFfmpeg()
      if (!probe.available) throw new Error(probe.message ?? 'ffmpeg 不可用，无法探测素材')
      const spec = deps.probeCache === undefined
        ? await probeMediaSpec(probe.path ?? 'ffmpeg', absolute)
        : await deps.probeCache.get(absolute)
      if (spec === undefined) throw new Error(`探测失败：${relative} 可能不是有效媒体文件`)
      return { path: relative, spec }
    }
    // 导出预设（`A31` 内置 + `A48` 用户自定义）：界面/Agent 共用同一套平台尺寸口径
    case 'presets/list': {
      const custom = await deps.store.listExportPresets()
      return {
        presets: [
          ...EXPORT_PRESETS.map(preset => ({ ...preset, custom: false })),
          ...custom.map(preset => ({ ...preset, custom: true })),
        ],
      }
    }
    case 'presets/save': {
      const preset = await deps.store.saveExportPreset({
        ...optionalText(payload, 'id') === undefined ? {} : { id: optionalText(payload, 'id') as string },
        name: field(payload, 'name'),
        width: Number(field(payload, 'width') ?? 0),
        height: Number(field(payload, 'height') ?? 0),
        frameRate: Number(field(payload, 'frameRate') ?? 0),
        ...optionalNumber(payload, 'bitrateKbps') === undefined ? {} : { bitrateKbps: optionalNumber(payload, 'bitrateKbps') as number },
      })
      return { preset }
    }
    case 'presets/remove':
      return { removed: await deps.store.removeExportPreset(text(payload, 'id')) }
    // 诊断快照（`A9`）：版本、数据规模、渲染队列、近错；出问题不用翻日志
    case 'diagnostics': {
      const data = await deps.store.stats()
      const jobs = deps.renders.list()
      const running = jobs.filter(job => job.status === 'running' && job.queued !== true).length
      const queued = jobs.filter(job => job.queued === true).length
      // `A18`：输出目录实际占用（配合 `maintenance/retention` 判断要不要清理）
      const outputs = await listOutputs(deps.outputsDir)
      const outputBytes = outputs.reduce((sum, file) => sum + Math.max(0, file.bytes), 0)
      const stamps = outputs
        .map(file => Date.parse(file.modifiedAt ?? ''))
        .filter(value => Number.isFinite(value))
        .sort((left, right) => left - right)
      const referencedFiles = (await deps.store.referencedAssetPaths()).length
      const logFiles = await listDiagnosticLogs(join(deps.store.directory, 'diagnostics.log')).catch(() => [])
      return {
        logFiles,
        plugin: { name: 'dsh-image-video', version: PLUGIN_VERSION },
        provider: deps.provider,
        outputsDir: deps.outputsDir,
        data,
        renders: {
          running, queued,
          recent: jobs.slice(0, 5).map(job => ({ id: job.id, status: job.status, percent: job.percent, queued: job.queued ?? false })),
          stats: deps.renders.stats(),
        },
        runs: { running: data.runningRuns },
        cache: { nodeResults: data.nodeCache },
        outputs: {
          files: outputs.length,
          bytes: outputBytes,
          referenced: referencedFiles,
          ...stamps.length === 0 ? {} : {
            oldestAt: new Date(stamps[0] as number).toISOString(),
            newestAt: new Date(stamps[stamps.length - 1] as number).toISOString(),
          },
        },
        errors: deps.diagnostics?.snapshot() ?? { errors: [], errorCount: 0 },
      }
    }
    // 资源使用记录（`R-QCK-3`）
    case 'resources/usage':
      return {
        usage: await deps.store.listResourceUsage({
          ...optionalText(payload, 'resourceId') === undefined ? {} : { resourceId: optionalText(payload, 'resourceId') },
          ...optionalText(payload, 'projectId') === undefined ? {} : { projectId: optionalText(payload, 'projectId') },
        }),
      }
    // ---- 项目包（阶段 8，T8-1）---------------------------------------------------
    case 'packages/export': {
      const projectId = text(payload, 'projectId')
      const target = optionalText(payload, 'targetDir')
      const base = resolve(deps.outputsDir, '..', 'packages')
      const chosen = target === undefined || target === '' ? resolve(base, projectId) : resolve(target)
      // 安全边界：导出是**写盘**动作，只允许落在 packages/ 之下（防止任意路径写入）
      if (chosen !== base && !chosen.startsWith(base + sep)) {
        throw new Error(`导出目录必须在 ${base} 之下（收到 ${chosen}）：这是安全边界，避免任意路径写入。`)
      }
      const { manifestPath, manifest } = await exportProjectPackage({ store: deps.store, projectId, targetDir: chosen })
      return { package: { manifestPath, formatVersion: manifest.formatVersion, assets: manifest.assets.length, missing: manifest.missing.length } }
    }
    // `A152`：把任意本地媒体文件批量导入 outputs 目录并登记为项目素材。
    // 复制（而不是引用外部路径）是为了让 `/outputs/<name>` 预览链路继续可用。
    case 'media/import': {
      const projectId = text(payload, 'projectId')
      const raw = field(payload, 'paths')
      if (!Array.isArray(raw)) throw new Error('paths 必须是字符串数组')
      const sources = raw.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
      if (sources.length === 0) throw new Error('没有可导入的文件')
      if (sources.length > MAX_BULK_ATTACH) throw new Error(`一次最多导入 ${String(MAX_BULK_ATTACH)} 个文件`)
      const root = resolve(deps.outputsDir)
      const imported: unknown[] = []
      const skipped: Array<{ path: string; reason: string }> = []
      for (const source of sources) {
        try {
          const info = await stat(source)
          if (!info.isFile()) { skipped.push({ path: source, reason: '不是普通文件' }); continue }
          const extension = extname(source).toLowerCase()
          const kind = IMPORTABLE_EXTENSIONS[extension]
          if (kind === undefined) { skipped.push({ path: source, reason: `不支持的扩展名 ${extension}` }); continue }
          const safeName = basename(source).replace(/[^\w.-]/gu, '_')
          const target = resolve(root, `${String(Date.now())}-${safeName}`)
          if (target !== root && !target.startsWith(`${root}${sep}`)) {
            skipped.push({ path: source, reason: '目标路径越界' })
            continue
          }
          await copyFile(source, target)
          const attached = await deps.store.attachAsset({ projectId, path: target, kind, bytes: info.size })
          imported.push(attached.asset)
        } catch (error) {
          skipped.push({ path: source, reason: error instanceof Error ? error.message : String(error) })
        }
      }
      return { imported: imported.length, assets: imported, skipped }
    }
    // `A145`：工作台内直接生成（「快速创作」的生成入口）——复用对话里同一对工具，
    // 成功的产物自动登记为项目素材，并写一条任务账本记录（面板能看到）。
    // `A-4`：融合生图 —— 选角色/场景/物品（创作资源）→ 收集其参考图与描述 → 一次生成并登记素材
    case 'media/compose': {
      const projectId = text(payload, 'projectId')
      const prompt = text(payload, 'prompt')
      const tool = deps.generate?.image
      if (tool === undefined) throw new Error('生成能力未装配：此宿主没有注入图片生成适配器')
      const rawIds = field(payload, 'resourceIds')
      const resourceIds = Array.isArray(rawIds)
        ? rawIds.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
        : []
      const resources = (await deps.store.listResources(projectId)).filter(resource => resourceIds.includes(resource.id))
      const images: string[] = []
      const parts: string[] = []
      for (const resource of resources) {
        const extra = resource as unknown as { assetPaths?: readonly string[]; assetPath?: string }
        const paths = extra.assetPaths ?? (extra.assetPath === undefined ? [] : [extra.assetPath])
        images.push(...paths)
        parts.push(`${resource.kind}「${resource.name}」${resource.note === undefined ? '' : `：${resource.note}`}`)
      }
      const composedPrompt = [prompt, ...parts].filter(part => part.trim() !== '').join('\n')
      const args: Record<string, unknown> = { prompt: composedPrompt }
      if (images.length > 0) args.images = images
      const size = optionalText(payload, 'size')
      if (size !== undefined) args.size = size
      const model = optionalText(payload, 'model')
      if (model !== undefined) args.model = model
      const controller = new AbortController()
      const value = await tool.execute(args, { signal: controller.signal })
      const outcome = extractOutcome(value)
      if (outcome.outputPath === undefined) throw new Error('生成工具没有返回产物路径')
      const info = await stat(outcome.outputPath).catch(() => undefined)
      const attached = await deps.store.attachAsset({
        projectId, path: outcome.outputPath, kind: 'image',
        ...info === undefined ? {} : { bytes: info.size },
      })
      return {
        path: outcome.outputPath, asset: attached.asset,
        referencedImages: images.length, resourceIds: resources.map(resource => resource.id),
      }
    }
    case 'media/generate': {
      const mediaMode = optionalText(payload, 'mediaMode') === 'video' ? 'video' : 'image'
      const tool = mediaMode === 'video' ? deps.generate?.video : deps.generate?.image
      if (tool === undefined) throw new Error(`生成能力未装配：此宿主没有注入 ${mediaMode} 生成适配器`)
      const prompt = text(payload, 'prompt')
      const model = optionalText(payload, 'model')
      const image = optionalText(payload, 'image')
      const args = mediaMode === 'video'
        ? {
            prompt,
            ...optionalNumber(payload, 'duration') === undefined ? {} : { duration: optionalNumber(payload, 'duration') as number },
            ...model === undefined ? {} : { model },
            ...optionalText(payload, 'aspectRatio') === undefined ? {} : { aspectRatio: optionalText(payload, 'aspectRatio') as string },
            ...image === undefined ? {} : { image },
            ...optionalText(payload, 'resolution') === undefined ? {} : { resolution: optionalText(payload, 'resolution') as string },
          }
        : {
            prompt,
            ...optionalText(payload, 'size') === undefined ? {} : { size: optionalText(payload, 'size') as string },
            ...model === undefined ? {} : { model },
            ...image === undefined ? {} : { image },
            ...Array.isArray(field(payload, 'images')) ? { images: field(payload, 'images') } : {},
          }
      // Track B 申请（B-3）：视频编辑的多素材序列与"含真人"开关原样透传给工具
      if (Array.isArray(field(payload, 'media'))) (args as Record<string, unknown>).media = field(payload, 'media')
      if (field(payload, 'realPerson') === true) (args as Record<string, unknown>).realPerson = true
      const projectId = optionalText(payload, 'projectId')
      const tracked = projectId !== undefined && projectId !== ''
      // `A147`：`wait:false` 时立即返回 taskId，前端轮询 `tasks/running` / `tasks/list` 拿结果。
      // 非阻塞模式必须绑定项目（否则结果没有地方可查，等于丢结果）。
      const wait = field(payload, 'wait') !== false
      if (!wait && !tracked) throw new Error('非阻塞模式（wait:false）必须传 projectId：否则生成结果无处可查')
      const startedAt = new Date().toISOString()
      let task: { id: string } | undefined
      if (tracked) {
        task = await deps.store.recordTask({
          kind: mediaMode, status: 'running', provider: deps.provider, prompt,
          projectId, startedAt,
        })
      }
      // `A146`：把这次生成登记进取消表 —— 面板用 `tasks/cancel`（或 `tasks/running` 找到它）就能中断，
      // 取消后任务落 `cancelled` 而不是一直转圈。未绑定项目时也能取消，只是不写账本。
      const generationId = task?.id ?? newWorkbenchId('gen')
      const controller = deps.registry.register(generationId, mediaMode, startedAt)
      const run = async (): Promise<Record<string, unknown>> => {
      try {
        const value = await tool.execute(args, { signal: controller.signal })
        const outcome = extractOutcome(value)
        if (outcome.outputPath === undefined) throw new Error('生成工具没有返回产物路径')
        let asset: unknown
        if (tracked) {
          asset = (await deps.store.attachAsset({
            projectId: projectId as string, path: outcome.outputPath, kind: mediaMode,
            ...outcome.bytes === undefined ? {} : { bytes: outcome.bytes },
            provider: deps.provider, prompt,
          })).asset
        }
        if (task !== undefined) {
          await deps.store.updateTask(task.id, {
            status: 'succeeded', outputPath: outcome.outputPath,
            ...outcome.bytes === undefined ? {} : { bytes: outcome.bytes },
          })
        }
        return {
          mediaMode, path: outcome.outputPath,
          ...outcome.bytes === undefined ? {} : { bytes: outcome.bytes },
          ...asset === undefined ? {} : { asset },
          ...task === undefined ? {} : { taskId: task.id },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const cancelled = controller.signal.aborted
        if (task !== undefined) {
          await deps.store.updateTask(task.id, {
            status: cancelled ? 'cancelled' : 'failed',
            ...cancelled ? {} : { error: message },
          }).catch(() => undefined)
        }
        throw new Error(cancelled ? '生成已取消' : message)
      } finally {
        deps.registry.release(generationId)
      }
      }
      if (!wait) {
        // 后台跑：失败只落账本，不冒泡到 RPC（因为调用方已经拿到 taskId 了）
        void run().catch(() => undefined)
        return { pending: true, taskId: generationId, mediaMode }
      }
      return await run()
    }
    // `A118`：字幕导出为 SRT
    case 'subtitles/export': {
      const timelineId = text(payload, 'timelineId')
      const timeline = await deps.store.findTimeline(timelineId)
      if (timeline === undefined) throw new Error(`unknown timeline: ${timelineId}`)
      const trackId = optionalText(payload, 'trackId')
      const tracks = timeline.tracks.filter(track => track.kind === 'subtitle' && (trackId === undefined || trackId === '' || track.id === trackId))
      if (tracks.length === 0) throw new Error('这条时间轴没有字幕轨（或指定的轨不是字幕轨）')
      const cues = tracks.flatMap(track => track.clips.map(clip => ({
        index: 0,
        startMs: clip.startMs,
        endMs: clip.startMs + clip.durationMs,
        text: clip.text ?? '',
      }))).filter(cue => cue.text.trim() !== '')
      const format = optionalText(payload, 'format') === 'vtt' ? 'vtt' : 'srt'
      return {
        text: format === 'vtt' ? serializeVtt(cues) : serializeSrt(cues),
        format,
        cues: cues.length,
        srt: serializeSrt(cues), // 兼容旧调用方
      }
    }
    // `A118`：SRT 导入为字幕片段（replace 默认 true：替换该字幕轨的片段）
    case 'subtitles/import': {
      const timelineId = text(payload, 'timelineId')
      const timeline = await deps.store.findTimeline(timelineId)
      if (timeline === undefined) throw new Error(`unknown timeline: ${timelineId}`)
      const format = optionalText(payload, 'format') === 'vtt' ? 'vtt' : 'srt'
      const payloadText = typeof field(payload, 'text') === 'string' ? field(payload, 'text') as string : text(payload, 'srt')
      const parsed = format === 'vtt' ? parseVtt(payloadText) : parseSrt(payloadText)
      if (parsed.cues.length === 0) throw new Error('SRT 里没有解析出任何字幕：检查时间码格式（如 00:00:01,000 --> 00:00:02,500）')
      const offsetMs = optionalNumber(payload, 'offsetMs') ?? 0
      const newId = makeSubtitleIds('srt')
      const clips = parsed.cues.map(cue => ({
        id: newId(), text: cue.text, startMs: Math.max(0, Math.round(cue.startMs + offsetMs)), durationMs: Math.max(1, Math.round(cue.endMs - cue.startMs)),
      }))
      const trackId = optionalText(payload, 'trackId')
      const existingTrack = timeline.tracks.find(track => track.kind === 'subtitle' && (trackId === undefined || trackId === '' || track.id === trackId))
      const replace = field(payload, 'replace') !== false
      const tracks = existingTrack === undefined
        ? [...timeline.tracks, { id: newWorkbenchId('trk'), kind: 'subtitle' as const, clips }]
        : timeline.tracks.map(track => track.id === existingTrack.id
            ? { ...track, clips: replace ? clips : [...track.clips, ...clips] }
            : track)
      const saved = await deps.store.saveTimeline({ id: timeline.id, projectId: timeline.projectId, name: timeline.name, tracks, frameRate: timeline.frameRate, burnSubtitles: timeline.burnSubtitles, ...timeline.exportFormat === undefined ? {} : { exportFormat: timeline.exportFormat } })
      return { timeline: saved, imported: clips.length, skipped: parsed.skipped.length }
    }
    // `A96`：项目包预检（只读，不落地任何数据）
    case 'packages/inspect':
      return {
        inspection: await inspectProjectPackage({
          packageDir: text(payload, 'packageDir'),
          store: deps.store,
          ...field(payload, 'verifyFiles') === true ? { verifyFiles: true } : {},
        }),
      }
    case 'packages/import': {
      const result = await importProjectPackage({
        store: deps.store,
        packageDir: text(payload, 'packageDir'),
        outputsDir: deps.outputsDir,
        ...field(payload, 'mode') === 'structure-only' ? { mode: 'structure-only' as const } : {},
      })
      return { imported: result }
    }
    case 'packages/export-resources': {
      const projectId = text(payload, 'projectId')
      const target = optionalText(payload, 'targetDir')
      const base = resolve(deps.outputsDir, '..', 'packages')
      const chosen = target === undefined || target === '' ? resolve(base, `${projectId}-resources`) : resolve(target)
      if (chosen !== base && !chosen.startsWith(base + sep)) {
        throw new Error(`资源包目录必须在 ${base} 之下（收到 ${chosen}）：这是安全边界，避免任意路径写入。`)
      }
      const { manifestPath, manifest } = await exportResourcePackage({ store: deps.store, projectId, targetDir: chosen })
      return { package: { manifestPath, formatVersion: manifest.formatVersion, resources: manifest.resources.length } }
    }
    case 'packages/import-resources': {
      const strategy = field(payload, 'strategy')
      const result = await importResourcePackage({
        store: deps.store,
        projectId: text(payload, 'projectId'),
        packageDir: text(payload, 'packageDir'),
        ...strategy === 'rename' || strategy === 'replace' || strategy === 'skip' ? { strategy } : {},
      })
      return { imported: result }
    }
    // ---- 媒体能力（阶段 5）：ffmpeg 是否可用、什么版本、编码器齐不齐 ----------------
    case 'media/ffmpeg': {
      // 允许带一个 path 做"检查指定副本"的诊断（UI 的重新检查按钮用默认路径）
      const candidate = optionalText(payload, 'path')
      return {
        ffmpeg: await probeFfmpeg(candidate === undefined || candidate === ''
          ? {}
          : { candidates: [candidate], strict: true }),
      }
    }
    // ---- 时间轴（阶段 5）--------------------------------------------------------
    case 'timelines/list':
      return { timelines: await deps.store.listTimelines(text(payload, 'projectId')) }
    // `A-9`：客户端可直接分割/复制片段（此前只有工具动作，UI 无法调用）
    case 'timelines/split-clip': {
      const timeline = await deps.store.findTimeline(text(payload, 'timelineId'))
      if (timeline === undefined) throw new Error(`unknown timeline: ${String(field(payload, 'timelineId'))}`)
      const split = splitClipAt(timeline.tracks, text(payload, 'clipId'), Math.max(0, Math.round(optionalNumber(payload, 'atMs') ?? 0)), () => newWorkbenchId('clip'))
      const saved = await deps.store.saveTimeline({
        id: timeline.id, projectId: timeline.projectId, name: timeline.name, tracks: split.tracks,
        frameRate: timeline.frameRate, burnSubtitles: timeline.burnSubtitles,
        ...timeline.exportFormat === undefined ? {} : { exportFormat: timeline.exportFormat },
      })
      return { timeline: saved, leftId: split.leftId, rightId: split.rightId }
    }
    case 'timelines/copy-clip': {
      const timeline = await deps.store.findTimeline(text(payload, 'timelineId'))
      if (timeline === undefined) throw new Error(`unknown timeline: ${String(field(payload, 'timelineId'))}`)
      const copy = duplicateClip(timeline.tracks, text(payload, 'clipId'), () => newWorkbenchId('clip'))
      const tracks = (copy as unknown as { tracks: typeof timeline.tracks }).tracks
      const saved = await deps.store.saveTimeline({
        id: timeline.id, projectId: timeline.projectId, name: timeline.name, tracks,
        frameRate: timeline.frameRate, burnSubtitles: timeline.burnSubtitles,
        ...timeline.exportFormat === undefined ? {} : { exportFormat: timeline.exportFormat },
      })
      return { timeline: saved }
    }
    case 'timelines/save':
      return {
        timeline: await deps.store.saveTimeline({
          id: optionalText(payload, 'id'),
          projectId: text(payload, 'projectId'),
          name: optionalText(payload, 'name'),
          tracks: field(payload, 'tracks') ?? [],
          ...typeof field(payload, 'frameRate') === 'number' ? { frameRate: field(payload, 'frameRate') as number } : {},
          ...typeof field(payload, 'burnSubtitles') === 'boolean' ? { burnSubtitles: field(payload, 'burnSubtitles') as boolean } : {},
          ...field(payload, 'exportFormat') === undefined ? {} : { exportFormat: field(payload, 'exportFormat') },
          ...typeof field(payload, 'normalizeLoudness') === 'boolean' ? { normalizeLoudness: field(payload, 'normalizeLoudness') as boolean } : {},
          ...optionalText(payload, 'burnLanguage') === undefined ? {} : { burnLanguage: optionalText(payload, 'burnLanguage') },
        }),
      }
    case 'timelines/remove':
      return { removed: await deps.store.removeTimeline(text(payload, 'id')) }
    // ---- 导出（阶段 5，T5-5）----------------------------------------------------
    // `A86`：整条时间轴复制为副本（素材引用共享，不复制文件）
    case 'timelines/duplicate': {
      const timelineId = text(payload, 'timelineId')
      const name = optionalText(payload, 'name')
      const timeline = await deps.store.duplicateTimeline(timelineId, name === undefined ? {} : { name })
      return { timeline }
    }
    // `A84`：导出前体检 —— 一次拿到"能不能导 / 会有多大 / 有没有素材浪费"
    case 'timelines/preflight': {
      const timelineId = text(payload, 'timelineId')
      const timeline = await deps.store.findTimeline(timelineId)
      if (timeline === undefined) throw new Error(`unknown timeline: ${timelineId}`)
      const known = new Set(await deps.store.referencedAssetPaths())
      const issues = [...validateTimeline(timeline, { knownAssetPaths: known })]
      // 与 timelines/validate 相同的"片段比素材长"检查（有上限、可失败）
      try {
        const probe = await probeFfmpeg()
        if (probe.available) {
          const paths = [...new Set(timeline.tracks.flatMap(track => track.clips)
            .map(clip => clip.assetPath)
            .filter((path): path is string => typeof path === 'string'))].slice(0, 20)
          const durations = new Map<string, number>()
          for (const relative of paths) {
            const absolute = resolve(deps.outputsDir, relative)
            const spec = deps.probeCache === undefined
              ? await probeMediaSpec(probe.path ?? 'ffmpeg', absolute)
              : await deps.probeCache.get(absolute)
            if (spec?.durationMs !== undefined) durations.set(relative, spec.durationMs)
          }
          issues.push(...findClipOverruns(timeline, durations))
        }
      } catch {
        // 探测失败只影响这一项检查，不影响体检结果
      }
      const estimate = estimateExport(timeline)
      const usage = reportAssetUsage(
        await deps.store.listAssets(timeline.projectId),
        await deps.store.listTimelines(timeline.projectId),
      )
      const blocking = issues.filter(issue => issue.code !== 'overlap' && issue.code !== 'subtitle-burn-overlap')
      const summaryLine = summarizePreflight({
        blockingIssues: blocking.length,
        humanBytes: formatBytes(estimate.estimatedBytes),
        humanPredicted: formatDuration(predictRenderMs({ durationMs: estimate.durationMs, width: estimate.width, height: estimate.height, frameRate: estimate.frameRate }, deps.renders.exportSamples())),
        durationAndAspect: `${Math.round(estimate.durationMs / 1000)} 秒 / ${estimate.aspect}`,
        unusedAssets: usage.summary.unused,
        ...usage.summary.unused > 0 ? { unusedBytes: formatBytes(usage.summary.unusedBytes) } : {},
      })
      return {
        ok: issues.length === 0,
        issues,
        estimate: { ...estimate, humanBytes: formatBytes(estimate.estimatedBytes) },
        usage: usage.summary,
        summaryLine,
      }
    }
    // `A80`：导出预估（时长/规格/预估体积），可传 overrides 预览"换成 4K 会有多大"
    case 'timelines/estimate': {
      const timelineId = text(payload, 'timelineId')
      const timeline = await deps.store.findTimeline(timelineId)
      if (timeline === undefined) throw new Error(`unknown timeline: ${timelineId}`)
      const estimate = estimateExport(timeline, {
        ...optionalNumber(payload, 'width') === undefined ? {} : { width: optionalNumber(payload, 'width') as number },
        ...optionalNumber(payload, 'height') === undefined ? {} : { height: optionalNumber(payload, 'height') as number },
        ...optionalNumber(payload, 'frameRate') === undefined ? {} : { frameRate: optionalNumber(payload, 'frameRate') as number },
        ...optionalNumber(payload, 'bitrateKbps') === undefined ? {} : { bitrateKbps: optionalNumber(payload, 'bitrateKbps') as number },
      })
      const predicted = predictRenderMs(
        { durationMs: estimate.durationMs, width: estimate.width, height: estimate.height, frameRate: estimate.frameRate },
        deps.renders.exportSamples(),
      )
      return {
        estimate: {
          ...estimate,
          humanBytes: formatBytes(estimate.estimatedBytes),
          predictedRenderMs: predicted,
          humanPredicted: formatDuration(predicted),
        },
      }
    }
    case 'timelines/render': {
      const timelineId = text(payload, 'timelineId')
      const timeline = await deps.store.findTimeline(timelineId)
      if (timeline === undefined) throw new Error(`unknown timeline: ${timelineId}`)
      const projectId = optionalText(payload, 'projectId')
      if (projectId !== undefined && projectId !== '' && projectId !== timeline.projectId) {
        throw new Error(`timeline ${timelineId} does not belong to project ${projectId}`)
      }
      return {
        render: deps.renders.start(timeline, {
          ...optionalNumber(payload, 'priority') === undefined ? {} : { priority: optionalNumber(payload, 'priority') as number },
          ...field(payload, 'retryTransient') === true ? { retryTransient: true } : {},
          ...optionalNumber(payload, 'thumbnailAtMs') === undefined ? {} : { thumbnailAtMs: optionalNumber(payload, 'thumbnailAtMs') as number },
          ...optionalText(payload, 'subtitleFormat') === 'vtt' ? { subtitleFormat: 'vtt' as const } : {},
        }),
      }
    }
    case 'timelines/renders':
      // `A56`：成片集归组（按项目+时间轴；只读聚合、纯加法字段，老客户端不受影响）
      {
        const projectId = optionalText(payload, 'projectId')
        const renders = deps.renders.list(projectId)
        return { renders, sets: groupRenderSets(renders) }
      }
    // `A59` 一键重试：用原时间轴与原优先级重跑（适合瞬时失败：机器忙/超时；必然失败会再报同样的错）
    case 'timelines/render-retry': {
      const renderId = text(payload, 'renderId')
      const previous = deps.renders.list().find(job => job.id === renderId)
      if (previous === undefined) throw new Error(`找不到渲染任务 ${renderId}：先用 timelines/renders 看现有任务`)
      const blocked = retryError(previous)
      if (blocked !== undefined) throw new Error(blocked)
      const timeline = await deps.store.findTimeline(previous.timelineId)
      if (timeline === undefined) throw new Error(`原时间轴 ${previous.timelineId} 已删除，无法重试：请重新选择时间轴导出`)
      const render = deps.renders.start(timeline, { ...previous.priority === undefined ? {} : { priority: previous.priority } })
      return { render, retriedFrom: previous.id }
    }
    // `A90`：导出队列全景（正在跑/排队/最近成败/吞吐与耗时分布）
    case 'renders/overview':
      {
        const stats = deps.renders.stats()
        return {
          overview: renderOverview(deps.renders.list(), {
            ...stats.durationMs === undefined ? {} : { p50Ms: stats.durationMs.p50, p90Ms: stats.durationMs.p90 },
            samples: stats.finished,
          }),
        }
      }
    case 'timelines/render-cancel':
      return { cancelled: deps.renders.cancel(text(payload, 'renderId')) }
    // `A104`：数据完整性巡检（只报告不修复）
    case 'maintenance/integrity':
      return { integrity: await deps.store.integrityReport() }
    // `A94`：工作台文档归档（默认 dryRun 只算不删；归档追加到旁路文件，不丢历史）
    case 'maintenance/archive':
      return await deps.store.archiveOlderThan({
        ...optionalNumber(payload, 'olderThanDays') === undefined ? {} : { olderThanDays: optionalNumber(payload, 'olderThanDays') as number },
        ...typeof field(payload, 'dryRun') === 'boolean' ? { dryRun: field(payload, 'dryRun') as boolean } : {},
      })
    // ---- 维护：把幂等上线前留下的重复素材记录合并 -------------------------------
    case 'maintenance/retention': {
      // `A15`：输出目录配额清理。默认 dryRun，只算不删；被素材库引用的文件永不动
      const files = (await listOutputs(deps.outputsDir)).map(file => ({
        name: file.name, bytes: file.bytes, mtimeMs: Date.parse(file.modifiedAt ?? '') || 0,
      }))
      const referenced = new Set((await deps.store.referencedAssetPaths()).map(path => path.split('/').pop() ?? path))
      const plan = planRetention(files, {
        ...optionalNumber(payload, 'maxBytes') === undefined ? {} : { maxBytes: optionalNumber(payload, 'maxBytes') },
        ...optionalNumber(payload, 'maxFiles') === undefined ? {} : { maxFiles: optionalNumber(payload, 'maxFiles') },
        ...optionalNumber(payload, 'keepNewest') === undefined ? {} : { keepNewest: optionalNumber(payload, 'keepNewest') },
        protect: referenced,
      })
      const dryRun = field(payload, 'dryRun') !== false
      let deleted = 0
      if (!dryRun) {
        for (const file of plan.removed) {
          // 只删 outputs 目录里的、名字里不含路径分隔符的（防目录穿越）
          if (file.name.includes('/') || file.name.includes('\\')) continue
          try {
            await unlink(join(deps.outputsDir, file.name))
            deleted += 1
          } catch {
            // 删不掉的跳过（可能正被播放器占用）
          }
        }
      }
      return {
        dryRun, deleted,
        plan: {
          remove: plan.removed.map(file => ({ name: file.name, bytes: file.bytes })),
          keptFiles: plan.keptFiles, keptBytes: plan.keptBytes, freedBytes: plan.freedBytes, overQuota: plan.overQuota,
        },
        hint: dryRun ? '这是预演：确认无误后用 dryRun=false 真正清理' : '已按计划清理',
      }
    }
    case 'maintenance/compact':
      return { removed: await deps.store.compactAssets() }
    case 'tasks/cancel':
      return { cancelled: deps.registry.cancel(text(payload, 'id')) }
    case 'tasks/running':
      return { running: deps.registry.list() }
    case 'tasks/assign': {
      const id = text(payload, 'id')
      const task = await deps.store.updateTask(id, { projectId: text(payload, 'projectId') })
      if (task === undefined) throw new Error(`unknown task: ${id}`)
      return { task }
    }
    case 'outputs/list': {
      const limit = optionalNumber(payload, 'limit')
      const outputs: OutputFile[] = await listOutputs(deps.outputsDir, limit ?? undefined)
      return { outputs, directory: deps.outputsDir }
    }
    default:
      throw new Error(`unknown workbench endpoint: ${endpoint}`)
  }
}

/**
 * Run a payload validation, re-tagging its failure so the client sees
 * `workbench/invalid-payload` instead of a generic failure.
 * @param validate - validator to run.
 * @returns the validated value.
 */
function validated<T>(validate: () => T): T {
  try {
    return validate()
  } catch (error) {
    throw new Error(`invalid workbench payload: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Read one required string field. */
function text(payload: unknown, key: string): string {
  const value = field(payload, key)
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`invalid workbench payload: ${key} must be a non-empty string`)
  }
  return value
}

/** Read one optional string field. */
function optionalText(payload: unknown, key: string): string | undefined {
  const value = field(payload, key)
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(`invalid workbench payload: ${key} must be a string`)
  return value
}

/** Read one optional number field. */
function optionalNumber(payload: unknown, key: string): number | undefined {
  const value = field(payload, key)
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`invalid workbench payload: ${key} must be a finite number`)
  }
  return value
}

/** Read one field out of an untyped payload. */
function field(payload: unknown, key: string): unknown {
  if (typeof payload !== 'object' || payload === null) {
    if (payload === undefined) return undefined
    throw new Error('invalid workbench payload: expected an object')
  }
  return (payload as Record<string, unknown>)[key]
}

/**
 * Register the channel on this plugin's fiber: the disposer lifts it on unload,
 * so a disabled plugin leaves no callable endpoint behind.
 * @param ctx - host context already carrying the `connection` service.
 * @param deps - host facts the answers are built from.
 */
export function registerWorkbenchRpc(ctx: Context, deps: WorkbenchRpcDeps): void {
  status = { ...status, awaiting: true }
  ctx.effect(() => {
    const connection = ctx.get('connection')
    // Effect callbacks must hand back a disposer; with no connection there is
    // nothing to lift, so the channel simply never exists.
    if (connection === undefined) return () => {}
    try {
      const remove = connection.rpc.handle(WORKBENCH_RPC_CHANNEL, createWorkbenchHandler(deps))
      status = { channel: WORKBENCH_RPC_CHANNEL, registered: true, awaiting: false }
      return () => {
        status = { channel: WORKBENCH_RPC_CHANNEL, registered: false, awaiting: false }
        void remove()
      }
    } catch (error) {
      // 不抛出：注册失败不该连累工具与既有路由，但必须被记录（见 WorkbenchRpcStatus）。
      status = {
        channel: WORKBENCH_RPC_CHANNEL,
        registered: false,
        awaiting: false,
        error: error instanceof Error ? error.message : String(error),
      }
      return () => {}
    }
  }, 'dsh-image-video: workbench RPC channel')
}
