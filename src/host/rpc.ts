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
import { planStoryboard } from '../workbench/storyboard.ts'
import { DEFAULT_SHOT_DURATION, planPipeline, type PipelineOptions, type PipelineShot } from '../workbench/pipeline.ts'
import { planDub } from '../workbench/voice.ts'
import { buildComposePrompt, normalizeComposeCrop } from '../workbench/compose.ts'
import { cropImage } from '../media/image-crop.ts'
import { planRatioSlices } from '../workbench/derive-ratios.ts'
import { hasExportSelection, resolveExportFormat, sameExportFormat, type ExportSelection } from '../workbench/export-selection.ts'
import { catalogConsistencyIssues, isTextModelEntry, modelCards } from '../media/model-catalog.ts'
import { compareCardsAgainstRegistry, type ModelCatalogLive, type ModelRegistryProbe } from '../media/model-health.ts'
import { assertPromptAllowed, scanPrompt } from '../media/prompt-safety.ts'
import { TtsNotReadyError, type TtsAudioFormat, type TtsAvailability, type TtsRequest, type TtsService } from '../media/tts.ts'
import { ExportHistory } from '../workbench/exports.ts'
import { PromptLibrary } from '../workbench/prompts.ts'
import { SkillLibrary } from '../workbench/skills.ts'
import { exportEpisode } from '../workbench/episode-export.ts'
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
import { createAuthRpcHandler } from './auth.ts'
import { createAuthSettingsStore } from './auth-settings.ts'
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
import type { RevealResult } from './reveal.ts'
import {
  IMAGE_SIZE_OPTIONS, IMAGE_STYLE_OPTIONS, MAX_VIDEO_DURATION, MIN_VIDEO_DURATION, PROVIDERS, VIDEO_ASPECT_RATIOS,
} from '../runtime-defaults.ts'
import type { WorkbenchStore } from '../workbench/store.ts'
import { listOutputs, renameGeneratedOutput, type OutputFile } from '../workbench/outputs.ts'
import { dirname, join, resolve, sep } from 'node:path'
import { stat, unlink, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
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
  type MotionKeyframe,
} from '../workbench/records.ts'
import type { EpisodeRecord, EpisodeRefAction, EpisodeRefInput, SegmentInput, SegmentRecord } from '../workbench/episodes.ts'
import { buildSplitInput, parseSplitProposals, SCRIPT_SPLIT_SYSTEM } from '../workbench/script-split.ts'
import {
  DEFAULT_PLAN_EPISODES, DEFAULT_PLAN_SEGMENTS, DEFAULT_PLAN_SHOTS, DEFAULT_PLAN_SHOT_SEC,
  buildCountSuggestionPrompt, buildEpisodePlanPrompt, parseCountSuggestion, parseEpisodePlan, planEpisodesByRules,
  type EpisodePlanEpisode, type EpisodePlanRequest,
} from '../workbench/episode-plan.ts'
import {
  buildExtractPrompt, parseExtractItems, type ExtractCategory, type ExtractItem,
} from '../workbench/entity-extract.ts'
import type { StoryboardShot } from '../workbench/storyboard.ts'
import type { StoryboardEntityLibrary } from '../workbench/storyboard-plan.ts'
import { planStoryboardWithModel, replanStoryboardShot, type StoryboardModelCaller } from './storyboard-llm.ts'
import { extractScriptBytes, readScriptFile } from './script-import.ts'
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmRuntime } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { saveImageAttachment } from '../media.ts'

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

/**
 * 解析生成产物的命名上下文：当前剧集名 + 选中集数。
 * 项目已被删除时返回 undefined，让产物保持生成工具的原始文件名。
 */
async function resolveOutputNaming(
  store: WorkbenchStore,
  projectId: string,
  episodeId: string | undefined,
): Promise<{ projectName: string; episodeNo?: number } | undefined> {
  const project = (await store.listProjects()).find(candidate => candidate.id === projectId)
  if (project === undefined) return undefined
  if (episodeId === undefined) return { projectName: project.name }
  const episode = (await store.listEpisodes(projectId)).find(candidate => candidate.id === episodeId)
  return episode === undefined ? { projectName: project.name } : { projectName: project.name, episodeNo: episode.no }
}

export interface WorkbenchRpcDeps {
  /** Configured provider name (`threevideo` | `wanx` | `minimax` | `seedance`). */
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
  /**
   * 语音服务（TTS / 语音克隆 / 长文本异步）：缺省表示宿主没装配语音
   * （`voice/status` 会如实说明原因，不会假装可用）。
   */
  readonly voice?: TtsService
  /** 生效默认值视图（`T2-11`）；缺省时不带该字段。 */
  defaults?: () => Record<string, string | number | null>
  /**
   * 生效默认模型（图片 / 视频各一个）：配置显式值优先，否则服务商内置默认。
   * 界面用它回答"不选模型时到底会用哪个"，而不是只写一个「自动」（`T2-11`：
   * 模型名由宿主下发，客户端不内置）。
   */
  defaultModels?: () => { readonly image?: string; readonly video?: string }
  /** 在系统文件管理器里打开本地产物目录（人工清理用；缺省时界面只显示路径）。 */
  revealOutputs?: () => Promise<RevealResult>
  /** 在系统文件管理器里打开技能目录（缺省时界面只显示路径）。 */
  revealPath?: (directory: string) => Promise<RevealResult>
  /** 双技能库（缺省时按工作台数据目录惰性创建）。 */
  skills?: SkillLibrary
  /** 现场探测服务商模型目录（`GET /models`）；缺省时能力卡只能标「无法校验」。 */
  probeModels?: () => Promise<ModelRegistryProbe>
  /** 逐字段来源（override / settings / none）；缺省时不带该字段，界面也就不标来源。 */
  defaultSources?: () => NonNullable<WorkbenchHealth['defaultsSources']>
  /** 默认值编辑器的可选项；缺省时不带该字段。 */
  options?: () => WorkbenchOptions
  /**
   * 文本模型服务（`ctx.llm`）：剧本自动拆段用。
   * 缺省时 `llm/models` 与 `episodes/split` 如实报错，界面降级为手动加段。
   */
  readonly llm?: LlmRuntime
  /**
   * 附件服务（`ctx.attachments`）：把引用的图片 / 视频帧交给文本模型提取提示词。
   * 缺省时选模型提取会如实报错；不选模型仍可退回宿主视觉适配器。
   */
  readonly attachments?: AttachmentStore
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
/**
 * Lazily built export history bound to the workbench data directory.
 * @param deps - handler dependencies.
 * @returns shared history instance.
 */
/**
 * 把「一键流水线」的编排请求变成一张已保存的工作流（`P0-2`）。
 *
 * 复用：分镜拆解 `planStoryboard`（A-7）+ 画布执行器；本函数只做装配与落库。
 * 风格约束默认取项目里第一条 `style` 资源的 note（用户不用重复填）。
 * @param deps - RPC 依赖（store 等）。
 * @param payload - RPC 载荷（projectId / script / 选项）。
 * @returns 已保存的工作流 id 与编排诊断。
 * @throws {Error} 剧本为空、项目未知、或严格模式下缺物料。
 */
async function composePipeline(
  deps: WorkbenchRpcDeps,
  payload: unknown,
  signal?: AbortSignal,
): Promise<{
  workflowId: string
  name: string
  mode: string
  shots: number
  nodes: number
  warnings: string[]
  missingResources: string[]
  matchedResources: Array<{ name: string; resourceId: string; kind: string }>
  /** `B5`：逐镜明细（时长 / 提示词），界面据此做"可编辑分镜"；旧宿主没有该字段。 */
  shotDetails: Array<{ index: number; shot: string; duration: number; imagePrompt: string; videoPrompt: string }>
  /** `B-20`：分镜是谁拆的（`model` = 文本模型，`rules` = 规则拆解）。 */
  source: 'model' | 'rules'
  /** `B-20`：模型拆出的实体库（局部重拆时客户端原样回传）。 */
  entities?: StoryboardEntityLibrary
}> {
  const projectId = text(payload, 'projectId')
  const script = text(payload, 'script')
  const resources = await deps.store.listResources(projectId)
  const styleResource = resources.find(resource => resource.kind === 'style' && (resource.note ?? '') !== '')
  const rawMode = field(payload, 'mode')
  const mode = rawMode === 'text-to-video' || rawMode === 'video-to-video' || rawMode === 'image-to-video' ? rawMode : undefined
  const options: PipelineOptions = {
    ...mode === undefined ? {} : { mode },
    ...optionalNumber(payload, 'shots') === undefined ? {} : { shots: optionalNumber(payload, 'shots') as number },
    ...optionalText(payload, 'imageModel') === undefined ? {} : { imageModel: optionalText(payload, 'imageModel') as string },
    ...optionalText(payload, 'videoModel') === undefined ? {} : { videoModel: optionalText(payload, 'videoModel') as string },
    ...optionalText(payload, 'ratio') === undefined ? {} : { ratio: optionalText(payload, 'ratio') as string },
    ...optionalNumber(payload, 'duration') === undefined ? {} : { duration: optionalNumber(payload, 'duration') as number },
    ...field(payload, 'strictResources') === true ? { strictResources: true } : {},
    // `B5`：用户在界面改过的逐镜时长（下标对应分镜）；脏值由域层兜底
    ...Array.isArray(field(payload, 'shotDurations'))
      ? {
        shotDurations: (field(payload, 'shotDurations') as unknown[])
          .filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry)),
      }
      : {},
    // `B2` 视频生视频（复刻）：参考视频路径
    ...optionalText(payload, 'referenceVideo') === undefined ? {} : { referenceVideo: optionalText(payload, 'referenceVideo') as string },
    ...optionalText(payload, 'styleNote') === undefined
      ? styleResource?.note === undefined ? {} : { styleNote: styleResource.note }
      : { styleNote: optionalText(payload, 'styleNote') as string },
  }
  // `B-18`：显式挑选的物料 id（可选；不给就走剧本自动匹配）
  const rawResourceIds = field(payload, 'resourceIds')
  const resourceIds = Array.isArray(rawResourceIds)
    ? rawResourceIds.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
    : undefined
  // `B-20`：选了文本模型就让模型拆分镜；失败如实回落规则拆解并写进诊断
  const warnings: string[] = []
  const choice = optionalModelChoice(payload)
  const skill = await resolveSkillPrompt(deps, payload)
  if (skill.warning !== undefined) warnings.push(skill.warning)
  if (skill.prompt !== undefined && choice === undefined) {
    warnings.push('技能只在文本模型拆解时生效：本次用规则拆解，技能未应用')
  }
  if (choice === undefined) warnings.push('未选择文本模型：本次用规则拆解')
  let planned: readonly PipelineShot[] | undefined
  let entities: StoryboardEntityLibrary | undefined
  if (choice !== undefined) {
    try {
      const caller = await createStoryboardCaller(deps, choice.provider, choice.model, signal)
      if (caller === undefined) throw new Error('当前宿主未提供文本模型服务')
      const modelPlan = await planStoryboardWithModel(caller, {
        script,
        ...options.shots === undefined ? {} : { shots: options.shots },
        ...skill.prompt === undefined ? {} : { skillPrompt: skill.prompt },
        ...signal === undefined ? {} : { signal },
      })
      const duration = options.duration ?? DEFAULT_SHOT_DURATION
      planned = modelPlan.shots.map((shot, index) => ({
        index: index + 1,
        shot: shot.shot,
        duration,
        imagePrompt: shot.imagePrompt,
        videoPrompt: shot.videoPrompt,
      }))
      entities = modelPlan.library
    } catch (error) {
      warnings.push(`文本模型拆解失败：${error instanceof Error ? error.message : String(error)}；已回落到规则拆解`)
    }
  }
  const draft = planPipeline({
    script,
    options: resourceIds === undefined ? options : { ...options, resourceIds },
    resources: resources.map(resource => ({
      id: resource.id, kind: resource.kind, name: resource.name,
      ...resource.note === undefined ? {} : { note: resource.note },
    })),
    ...planned === undefined ? {} : { planned },
  })
  const stored = await deps.store.saveWorkflow({
    projectId,
    name: draft.name,
    nodes: draft.nodes,
    edges: draft.edges,
  })
  return {
    workflowId: stored.id,
    name: stored.name,
    mode: draft.mode,
    shots: draft.diagnostics.shots,
    nodes: draft.diagnostics.nodes,
    warnings: [...warnings, ...draft.diagnostics.warnings],
    missingResources: [...draft.diagnostics.missingResources],
    matchedResources: draft.diagnostics.matchedResources.map(entry => ({ ...entry })),
    // `shots` 这个字段历史上是"分镜数"（number），不能占用；逐镜明细单独给
    shotDetails: draft.shots.map(shot => ({ ...shot })),
    source: planned === undefined ? 'rules' : 'model',
    ...entities === undefined ? {} : { entities },
  }
}

function exportHistoryFor(deps: WorkbenchRpcDeps): ExportHistory {
  return new ExportHistory({ directory: dirname(deps.outputsDir) })
}

/**
 * Lazily built prompt library bound to the workbench data directory.
 * @param deps - handler dependencies.
 * @returns shared library instance.
 */
function promptLibraryFor(deps: WorkbenchRpcDeps): PromptLibrary {
  return new PromptLibrary({ directory: dirname(deps.outputsDir) })
}

/** 每个 handler 实例一份技能库，避免每次端点调用都重新读索引。 */
const skillLibraries = new WeakMap<WorkbenchRpcDeps, SkillLibrary>()

/**
 * Lazily built skill library bound to the workbench data directory.
 * @param deps - handler dependencies.
 * @returns shared library instance.
 */
function skillLibraryFor(deps: WorkbenchRpcDeps): SkillLibrary {
  const existing = deps.skills ?? skillLibraries.get(deps)
  if (existing !== undefined) return existing
  const created = new SkillLibrary({ directory: deps.store.directory })
  skillLibraries.set(deps, created)
  return created
}

/**
 * 取请求里选中的导演技能正文（`B-20`）。
 *
 * 技能只增强**文本模型**拆解：没选模型时规则拆解照旧，并如实说明技能未生效；
 * 技能缺失或已禁用不阻断编排，只给一条可照做的提醒。
 * @param deps - RPC 依赖（技能库）。
 * @param payload - RPC 载荷（`skillId`）。
 * @returns 技能正文与可选提醒。
 */
async function resolveSkillPrompt(
  deps: WorkbenchRpcDeps,
  payload: unknown,
): Promise<{ readonly prompt?: string; readonly warning?: string }> {
  const skillId = optionalText(payload, 'skillId')
  if (skillId === undefined || skillId === '') return {}
  try {
    const skill = await skillLibraryFor(deps).get(skillId)
    if (!skill.enabled) return { warning: `技能「${skill.name}」已禁用：本次按内置导演口径拆解` }
    return { prompt: skill.prompt }
  } catch (error) {
    return { warning: `技能 ${skillId} 不可用：${error instanceof Error ? error.message : String(error)}；本次按内置导演口径拆解` }
  }
}

export function createWorkbenchHandler(deps: WorkbenchRpcDeps): ConnectionRpcHandler {
  return async (endpoint, payload, signal) => {
    try {
      const value = await answer(deps, endpoint, payload, signal)
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
 * @param signal - caller cancellation, forwarded to model calls.
 * @returns the endpoint's value.
 */
/** 探测缓存 TTL：同一实例 60 秒内不重复打服务商（刷新按钮显式绕开）。 */
const MODEL_PROBE_TTL_MS = 60_000

/** 每个 handler 实例（= 每个插件加载）一份缓存，避免测试之间互相污染。 */
const modelProbeCache = new WeakMap<WorkbenchRpcDeps, { at: number; probe: ModelRegistryProbe }>()

/**
 * 组装能力卡的实时段：默认走缓存，`refresh` 强制重新探测。
 * 探测失败不是异常路径——返回 `ok:false` 的 probe，界面如实显示"无法校验（原因）"。
 * @param deps - handler 依赖（探测能力可选）。
 * @param refresh - 是否绕开缓存。
 * @returns 一次探测 + 逐卡片结论。
 */
async function liveCatalog(deps: WorkbenchRpcDeps, refresh: boolean): Promise<ModelCatalogLive> {
  const cached = modelProbeCache.get(deps)
  const now = Date.now()
  let probe: ModelRegistryProbe
  if (!refresh && cached !== undefined && now - cached.at < MODEL_PROBE_TTL_MS) {
    probe = cached.probe
  } else if (deps.probeModels === undefined) {
    probe = { attemptedAt: new Date().toISOString(), ok: false, ids: [], reason: '宿主未装配模型目录探测' }
  } else {
    probe = await deps.probeModels()
  }
  modelProbeCache.set(deps, { at: now, probe })
  return { probe, targets: compareCardsAgainstRegistry(modelCards(), probe) }
}

/** 拆段请求的输出上限：一段 2–3 句提示词，40 段也远低于该预算。 */
const SPLIT_MAX_TOKENS = 4096

/**
 * 调所选文本模型把剧本拆成分段，并逐段落库。
 *
 * 剧本优先取载荷里的 `script`（用户可能还没等自动保存），缺省才回到集记录。
 * 新分段继承模块级选择：图片模型 / 视频模型 / 导演技能。
 * @param deps - RPC 依赖（含文本模型服务）。
 * @param payload - 载荷：episodeId / provider / model / script / 三类默认值。
 * @param signal - 取消信号，透传给模型调用。
 * @returns 新建立的分段与最新集记录。
 * @throws {Error} 缺文本模型服务、剧本为空或超长、模型输出无法解析、落库失败时。
 */
async function splitEpisode(
  deps: WorkbenchRpcDeps,
  payload: unknown,
  signal?: AbortSignal,
): Promise<{ episode: EpisodeRecord, created: readonly SegmentRecord[] }> {
  const llm = deps.llm
  if (llm === undefined) throw new Error('当前宿主未提供文本模型服务，无法自动拆段')
  const episodeId = text(payload, 'episodeId')
  const provider = text(payload, 'provider')
  const model = text(payload, 'model')
  const episode = await deps.store.getEpisode(episodeId)
  const supplied = optionalText(payload, 'script')
  const input = buildSplitInput(supplied === undefined || supplied.trim() === '' ? episode.script.text : supplied)
  const prepared = await llm.prepareCall({ provider, model, maxTokens: SPLIT_MAX_TOKENS }, signal)
  const options: GenerateOptions = {
    ...prepared.config,
    messages: [createUserMessage({ content: [{ type: 'text', text: input }], source: { kind: 'user' } })],
    system: SCRIPT_SPLIT_SYSTEM,
    ...signal === undefined ? {} : { signal },
  }
  const assembler = new BlockAssembler()
  for await (const chunk of prepared.stream(options)) assembler.push(chunk)
  const raw = assembler.blocks()
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
  const proposals = parseSplitProposals(raw)
  const imageModel = optionalText(payload, 'imageModel')
  const videoModel = optionalText(payload, 'videoModel')
  const skillId = optionalText(payload, 'skillId')
  const created: SegmentRecord[] = []
  try {
    for (const proposal of proposals) {
      created.push(await deps.store.createSegment(episodeId, {
        promptText: proposal.promptText,
        ...proposal.durationSec === undefined ? {} : { durationSec: proposal.durationSec },
        ...imageModel === undefined || imageModel === '' ? {} : { imageModel },
        ...videoModel === undefined || videoModel === '' ? {} : { videoModel },
        ...skillId === undefined || skillId === '' ? {} : { skillId },
      }))
    }
  } catch (error) {
    throw new Error(`已创建 ${created.length} 段后失败：${error instanceof Error ? error.message : String(error)}`)
  }
  return { episode: await deps.store.getEpisode(episodeId), created }
}

/** 分镜拆解单步的模型输出上限：一条提示词几十字，60 条也远低于该预算。 */
const STORYBOARD_STEP_MAX_TOKENS = 4096

/** 「剧本 → 集 → 分段 → 分镜」整棵结构的模型输出上限（多集多段时体积最大）。 */
const EPISODE_PLAN_MAX_TOKENS = 16_384

/**
 * 组装生成请求：三级数量缺省用产品默认值。
 * @param payload - RPC 载荷。
 * @returns 领域层的生成请求。
 */
function readEpisodePlanRequest(payload: unknown): EpisodePlanRequest {
  return {
    script: optionalText(payload, 'script') ?? '',
    brief: optionalText(payload, 'brief') ?? '',
    episodes: optionalNumber(payload, 'episodes') ?? DEFAULT_PLAN_EPISODES,
    segments: optionalNumber(payload, 'segments') ?? DEFAULT_PLAN_SEGMENTS,
    shots: optionalNumber(payload, 'shots') ?? DEFAULT_PLAN_SHOTS,
    shotDurationSec: optionalNumber(payload, 'shotDurationSec') ?? DEFAULT_PLAN_SHOT_SEC,
  }
}

/**
 * 生成「集 → 分段 → 分镜」草案：选了文本模型就让模型写剧本并拆分，
 * 没有模型（或模型失败仍有剧本）时用规则拆分。
 * @param deps - RPC 依赖（含文本模型服务）。
 * @param payload - 载荷：projectId / script / brief / 三级数量 / 模型。
 * @param signal - 取消信号，透传给模型调用。
 * @returns 结构草案（集号缺省，由落库阶段分配）。
 * @throws {Error} 剧本与创意都为空、模型失败且无剧本可拆、模型输出不可用时。
 */
async function draftEpisodePlan(
  deps: WorkbenchRpcDeps,
  payload: unknown,
  signal?: AbortSignal,
): Promise<readonly EpisodePlanEpisode[]> {
  const request = readEpisodePlanRequest(payload)
  if (request.script.trim() === '' && request.brief.trim() === '') {
    throw new Error('请先写剧本，或写一句创意让模型生成剧本')
  }
  const projectId = optionalText(payload, 'projectId') ?? ''
  const resources = projectId === '' ? [] : await deps.store.listResources(projectId)
  const rules = (): readonly EpisodePlanEpisode[] => planEpisodesByRules(
    request,
    resources.map(resource => ({
      id: resource.id,
      kind: resource.kind,
      name: resource.name,
      ...resource.note === undefined ? {} : { note: resource.note },
    })),
  )
  const choice = optionalModelChoice(payload)
  const llm = deps.llm
  // 没有模型就只能拆已有剧本；只有一句话创意时没有可拆的内容
  if (choice === undefined || llm === undefined) {
    if (request.script.trim() === '') throw new Error('请选择文本模型后再用一句话创意生成剧本')
    return rules()
  }
  try {
    const prepared = await llm.prepareCall(
      { provider: choice.provider, model: choice.model, maxTokens: EPISODE_PLAN_MAX_TOKENS },
      signal,
    )
    const options: GenerateOptions = {
      ...prepared.config,
      messages: [createUserMessage({
        content: [{ type: 'text', text: buildEpisodePlanPrompt(request) }],
        source: { kind: 'user' },
      })],
      ...signal === undefined ? {} : { signal },
    }
    const assembler = new BlockAssembler()
    for await (const chunk of prepared.stream(options)) assembler.push(chunk)
    const raw = assembler.blocks()
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map(block => block.text)
      .join('')
    return parseEpisodePlan(raw, request)
  } catch (error) {
    // 有剧本就还能按规则拆；只有创意时只能如实报错，不编造内容
    if (request.script.trim() !== '') return rules()
    throw error
  }
}

/**
 * 让文本模型按剧本内容推荐集 / 每集段 / 每段镜三个数量（不落库）。
 *
 * 与结构生成分开，响应只要三个整数；结果夹取到合法区间后回填到界面，用户仍可手改。
 * @param deps - RPC 依赖（含文本模型服务）。
 * @param payload - 载荷：script / brief / provider / model。
 * @param signal - 取消信号，透传给模型调用。
 * @returns 三个数量。
 * @throws {Error} 没有文本模型、素材为空或模型输出不可用时。
 */
async function suggestEpisodeCounts(
  deps: WorkbenchRpcDeps,
  payload: unknown,
  signal?: AbortSignal,
): Promise<{ episodes: number, segments: number, shots: number }> {
  const choice = optionalModelChoice(payload)
  const llm = deps.llm
  if (choice === undefined || llm === undefined) throw new Error('请先选择一个文本模型')
  const script = optionalText(payload, 'script') ?? ''
  const brief = optionalText(payload, 'brief') ?? ''
  if (script.trim() === '' && brief.trim() === '') throw new Error('请先写剧本，或写一句创意')
  const prepared = await llm.prepareCall(
    { provider: choice.provider, model: choice.model, maxTokens: 512 },
    signal,
  )
  const options: GenerateOptions = {
    ...prepared.config,
    messages: [createUserMessage({
      content: [{ type: 'text', text: buildCountSuggestionPrompt(script, brief) }],
      source: { kind: 'user' },
    })],
    ...signal === undefined ? {} : { signal },
  }
  const assembler = new BlockAssembler()
  for await (const chunk of prepared.stream(options)) assembler.push(chunk)
  const raw = assembler.blocks()
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
  return parseCountSuggestion(raw)
}

/**
 * 把结构草案落库：目标集先更新剧本，其余按需新建；分段与分镜逐段落库。
 *
 * 落库是追加语义：不清空用户已有的分段 / 分镜，失败时已写入的部分保留并如实报出集数。
 * @param deps - RPC 依赖（store）。
 * @param payload - 载荷：projectId / 可选 episodeId / 模型与技能默认值。
 * @param plan - 结构草案。
 * @returns 受影响集的完整记录（含新分段与分镜）。
 * @throws {Error} 项目或集不存在、字段不合法，或中途落库失败时。
 */
async function materializeEpisodePlan(
  deps: WorkbenchRpcDeps,
  payload: unknown,
  plan: readonly EpisodePlanEpisode[],
): Promise<EpisodeRecord[]> {
  const projectId = text(payload, 'projectId')
  let targetId = optionalText(payload, 'episodeId')
  const imageModel = optionalText(payload, 'imageModel')
  const videoModel = optionalText(payload, 'videoModel')
  const skillId = optionalText(payload, 'skillId')
  const created: EpisodeRecord[] = []
  try {
    for (const entry of plan) {
      const target = targetId
      // 只有第一集落在目标集上，后续集都新建
      targetId = undefined
      let episode = target === undefined || target === ''
        ? await deps.store.createEpisode(projectId, entry.title === '' ? {} : { title: entry.title })
        : await deps.store.updateEpisode(target, entry.title === '' ? {} : { title: entry.title })
      if (entry.script !== '') episode = await deps.store.updateEpisode(episode.id, { script: entry.script })
      for (const segment of entry.segments) {
        const saved = await deps.store.createSegment(episode.id, {
          promptText: segment.promptText,
          durationSec: segment.durationSec,
          ...imageModel === undefined || imageModel === '' ? {} : { imageModel },
          ...videoModel === undefined || videoModel === '' ? {} : { videoModel },
          ...skillId === undefined || skillId === '' ? {} : { skillId },
        })
        if (segment.shots.length === 0) continue
        await deps.store.upsertStoryboard({
          episodeId: episode.id,
          segmentId: saved.id,
          ...skillId === undefined || skillId === '' ? {} : { skillId },
          shots: segment.shots.map((shot, index) => ({
            order: index + 1,
            durationSec: shot.durationSec,
            imagePrompt: shot.imagePrompt,
            videoPrompt: shot.videoPrompt,
            refs: [],
          })),
        })
      }
      created.push(await deps.store.getEpisode(episode.id))
    }
  } catch (error) {
    throw new Error(`已生成 ${created.length} 集后失败：${error instanceof Error ? error.message : String(error)}`)
  }
  return created
}

/** 实体提取的最大输出 token（一屏角色 / 道具列表足够）。 */
const ENTITY_EXTRACT_MAX_TOKENS = 4_096

/**
 * 读提取分区：未知值直接报错——静默按角色处理会把结果错位到另一个标签页。
 * @param payload - RPC 载荷。
 * @returns 分区名。
 * @throws {Error} `category` 不是三个已知分区之一时。
 */
function readExtractCategory(payload: unknown): ExtractCategory {
  const value = optionalText(payload, 'category')
  if (value === 'role' || value === 'scene' || value === 'costume' || value === 'prop' || value === 'voice' || value === 'motion') return value
  throw new Error('未知的提取分区')
}

/**
 * 从剧本提取实体：把剧本与分区要求交给文本模型，返回可入库的候选列表。
 * @param deps - RPC 依赖（含文本模型服务）。
 * @param payload - 载荷：script / category / provider / model / instructions（可选提取提示词）。
 * @param signal - 取消信号，透传给模型调用。
 * @returns 候选条目（名称 + 说明）。
 * @throws {Error} 剧本为空、没有可用文本模型、模型输出不可用时。
 */
async function extractEntities(
  deps: WorkbenchRpcDeps,
  payload: unknown,
  signal?: AbortSignal,
): Promise<{ items: readonly ExtractItem[] }> {
  const script = optionalText(payload, 'script')?.trim() ?? ''
  if (script === '') throw new Error('请先把剧本写进当前集')
  const category = readExtractCategory(payload)
  const choice = optionalModelChoice(payload)
  const llm = deps.llm
  if (choice === undefined || llm === undefined) throw new Error('请选择文本模型后再提取')
  // 角色提取选的 Skill 真正参与提示词：技能不可用时不阻断，按内置口径提取
  const skill = await resolveSkillPrompt(deps, payload)
  const extra = [optionalText(payload, 'instructions'), skill.prompt]
    .filter((part): part is string => part !== undefined && part.trim() !== '')
    .join('\n')
  const prepared = await llm.prepareCall(
    { provider: choice.provider, model: choice.model, maxTokens: ENTITY_EXTRACT_MAX_TOKENS },
    signal,
  )
  const options: GenerateOptions = {
    ...prepared.config,
    messages: [createUserMessage({
      content: [{ type: 'text', text: buildExtractPrompt(script, category, extra) }],
      source: { kind: 'user' },
    })],
    ...signal === undefined ? {} : { signal },
  }
  const assembler = new BlockAssembler()
  for await (const chunk of prepared.stream(options)) assembler.push(chunk)
  const raw = assembler.blocks()
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('\n')
  return { items: parseExtractItems(raw) }
}

/**
 * 读请求里可选的文本模型选择（`B-20`）。
 * provider 与 model 必须成对出现：只给一半当作"不启用模型拆解"，不猜默认值。
 * @param payload - RPC 载荷。
 * @returns 成对的模型选择；缺任一半时 `undefined`。
 */
function optionalModelChoice(payload: unknown): { provider: string; model: string } | undefined {
  const provider = optionalText(payload, 'provider')
  const model = optionalText(payload, 'model')
  if (provider === undefined || provider === '' || model === undefined || model === '') return undefined
  return { provider, model }
}

/** 提示词提取的输出上限：一段提示词远低于该预算。 */
const PROMPT_EXTRACT_MAX_TOKENS = 2048

/** 没给提取要点时使用的中性口径。 */
const PROMPT_EXTRACT_DEFAULT_POINTS = '提取可直接用于生图或生视频的中文提示词：主体、风格、材质与光线、构图与镜头细节。'

/** 提取提示词的系统口径：只描述画面里确实存在的内容。 */
const PROMPT_EXTRACT_SYSTEM = [
  '你是生图与分镜提示词的反向工程助手。',
  '阅读用户给出的画面，输出一段可直接使用的中文提示词。',
  '只描述画面中确实存在的内容，不要编造品牌、文字或画面外的信息。',
  '按「主体 → 风格 → 材质/光线 → 构图与镜头细节」的顺序写成一段，不要使用 Markdown。',
].join('\n')

/** 视频扩展名：这些引用需要先取一帧才能交给视觉模型。 */
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm'])

/** 图片扩展名 → 内容类型；未知扩展名按 PNG 交给附件服务。 */
const IMAGE_CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/** 提取输入的一帧画面及其临时资源。 */
interface ExtractFrame {
  readonly data: Uint8Array
  readonly contentType: string
  readonly name: string
  /** 视频取帧时创建的临时目录；图片输入没有该清理动作。 */
  readonly cleanup?: () => Promise<void>
}

/**
 * 把引用路径变成一张可交给视觉模型的画面：图片直接读字节，视频用 ffmpeg 取第 1 秒的一帧。
 * @param path - 素材绝对路径。
 * @param signal - 取消信号；取消会终止 ffmpeg。
 * @returns 帧字节、内容类型、保存名与可选清理动作。
 * @throws {Error} 视频引用但宿主没有可用的 ffmpeg，或取帧失败时。
 */
async function readExtractFrame(path: string, signal?: AbortSignal): Promise<ExtractFrame> {
  if (!VIDEO_EXTENSIONS.has(extname(path).toLowerCase())) {
    const contentType = IMAGE_CONTENT_TYPES[extname(path).toLowerCase()] ?? 'image/png'
    return { data: await readFile(path), contentType, name: basename(path) }
  }
  const probe = await probeFfmpeg()
  const ffmpeg = probe.path
  if (!probe.available || ffmpeg === undefined) {
    throw new Error(`提取视频提示词需要 ffmpeg：${probe.message ?? '未找到可执行文件'}`)
  }
  const dir = await mkdtemp(join(tmpdir(), 'dsh-image-video-extract-'))
  const frame = join(dir, 'frame.jpg')
  try {
    await new Promise<void>((resolveCall, rejectCall) => {
      const child = spawn(ffmpeg, [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-ss', '1', '-i', path,
        '-frames:v', '1', '-vf', 'scale=1280:-2', frame,
      ], { stdio: 'ignore' })
      const onAbort = (): void => { child.kill('SIGKILL') }
      signal?.addEventListener('abort', onAbort, { once: true })
      child.on('error', rejectCall)
      child.on('close', code => {
        signal?.removeEventListener('abort', onAbort)
        if (code === 0) resolveCall()
        else rejectCall(new Error(`ffmpeg 提取视频帧失败（退出码 ${String(code)}）`))
      })
    })
  } catch (thrown) {
    await rm(dir, { recursive: true, force: true })
    throw thrown
  }
  return {
    data: await readFile(frame),
    contentType: 'image/jpeg',
    name: `${basename(path, extname(path))}-frame.jpg`,
    cleanup: async () => { await rm(dir, { recursive: true, force: true }) },
  }
}

/**
 * 提示词提取（`A-5`）：图片 / 视频 → 可编辑提示词。
 * 选了文本模型就一次调用一个引用；没选时退回宿主视觉适配器。
 * @param deps - RPC 依赖（文本模型 / 附件 / 视觉适配器）。
 * @param payload - 载荷：path / skillId / instructions / provider / model。
 * @param signal - 取消信号。
 * @returns 提取出的提示词文本。
 * @throws {Error} 既没有文本模型也没有视觉适配器、或模型没有返回结果时。
 */
async function extractPromptByPath(
  deps: WorkbenchRpcDeps,
  payload: unknown,
  signal?: AbortSignal,
): Promise<{ text: string }> {
  const path = text(payload, 'path')
  const skillId = optionalText(payload, 'skillId')
  const skillPrompt = skillId === undefined ? undefined : (await skillLibraryFor(deps).get(skillId)).prompt
  const points = optionalText(payload, 'instructions')?.trim()
  const guidance = [skillPrompt?.trim(), points === undefined || points === '' ? undefined : points]
    .filter((part): part is string => part !== undefined && part !== '')
    .join('\n\n')
  const choice = optionalModelChoice(payload)
  if (choice === undefined) {
    const vision = (deps as unknown as { generate?: { vision?: GenerationTool } }).generate?.vision
    if (vision === undefined) {
      throw new Error('提示词提取需要模型：请选择文本模型，或让宿主注入 vision 适配器')
    }
    const controller = new AbortController()
    const value = await vision.execute(
      guidance === '' ? { image: path } : { image: path, instructions: guidance },
      { signal: controller.signal },
    )
    const outcome = extractOutcome(value)
    if (outcome.outputPath === undefined) throw new Error('视觉模型没有返回提示词结果')
    return { text: outcome.outputPath }
  }
  const llm = deps.llm
  if (llm === undefined) throw new Error('当前宿主未提供文本模型服务，无法提取提示词')
  const attachments = deps.attachments
  if (attachments === undefined) throw new Error('当前宿主未提供附件服务，无法把引用画面交给文本模型')
  const frame = await readExtractFrame(path, signal)
  try {
    const ref = await saveImageAttachment(attachments, frame.data, frame.contentType, frame.name)
    const prepared = await llm.prepareCall(
      { provider: choice.provider, model: choice.model, maxTokens: PROMPT_EXTRACT_MAX_TOKENS },
      signal,
    )
    const options: GenerateOptions = {
      ...prepared.config,
      messages: [createUserMessage({
        content: [
          { type: 'image', attachment: ref },
          { type: 'text', text: guidance === '' ? PROMPT_EXTRACT_DEFAULT_POINTS : guidance },
        ],
        source: { kind: 'user' },
      })],
      system: PROMPT_EXTRACT_SYSTEM,
      ...signal === undefined ? {} : { signal },
    }
    const assembler = new BlockAssembler()
    for await (const chunk of prepared.stream(options)) assembler.push(chunk)
    const raw = assembler.blocks()
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map(block => block.text)
      .join('')
      .trim()
    if (raw === '') throw new Error('模型没有返回提示词结果')
    return { text: raw }
  } finally {
    await frame.cleanup?.()
  }
}

/**
 * 用宿主文本模型服务构造分镜拆解调用器。
 * @param deps - RPC 依赖（含文本模型服务）。
 * @param provider - 服务商路由键。
 * @param model - 模型 id。
 * @param signal - 取消信号（透传到每一次流式调用）。
 * @returns 调用器；宿主未装配文本模型服务时 `undefined`。
 * @throws {Error} 模型不可用 / 无凭证时（由调用方决定是否回落）。
 */
async function createStoryboardCaller(
  deps: WorkbenchRpcDeps,
  provider: string,
  model: string,
  signal?: AbortSignal,
): Promise<StoryboardModelCaller | undefined> {
  const llm = deps.llm
  if (llm === undefined) return undefined
  const prepared = await llm.prepareCall({ provider, model, maxTokens: STORYBOARD_STEP_MAX_TOKENS }, signal)
  return async call => {
    const assembler = new BlockAssembler()
    const options: GenerateOptions = {
      ...prepared.config,
      messages: [createUserMessage({ content: [{ type: 'text', text: call.input }], source: { kind: 'user' } })],
      system: call.system,
      ...call.signal === undefined ? {} : { signal: call.signal },
    }
    for await (const chunk of prepared.stream(options)) assembler.push(chunk)
    return assembler.blocks()
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map(block => block.text)
      .join('')
  }
}

/**
 * 按资源名在分镜文本里是否出现，回填"这次拆解用到了哪些资源"。
 * @param shots - 分镜表。
 * @param resources - 项目资源。
 * @returns 命中的资源 id（按资源顺序，去重）。
 */
function referencedResourceIds(
  shots: readonly StoryboardShot[],
  resources: readonly { readonly id: string; readonly name: string }[],
): string[] {
  const text = shots.map(shot => `${shot.shot}${shot.characters.join('')}${shot.scene ?? ''}${shot.imagePrompt}${shot.videoPrompt}`).join('\n')
  return resources.filter(resource => text.includes(resource.name)).map(resource => resource.id)
}

/**
 * 校验客户端回传的实体库（线路边界，不信任形状）。
 * @param value - 请求里的 `entities` 字段。
 * @returns 合法的实体库；缺字段或结构不对时 `undefined`（局部重拆退化为只按剧本改）。
 */
function readEntityLibrary(value: unknown): StoryboardEntityLibrary | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  const read = (key: 'roles' | 'props' | 'scenes'): Array<{ kind: 'role' | 'prop' | 'scene'; name: string; prompt: string }> | undefined => {
    const entries = record[key]
    if (!Array.isArray(entries)) return undefined
    const kind = key === 'roles' ? 'role' : key === 'props' ? 'prop' : 'scene'
    const parsed: Array<{ kind: 'role' | 'prop' | 'scene'; name: string; prompt: string }> = []
    for (const entry of entries) {
      if (typeof entry !== 'object' || entry === null) continue
      const item = entry as Record<string, unknown>
      if (typeof item['name'] !== 'string' || typeof item['prompt'] !== 'string') continue
      parsed.push({ kind, name: item['name'], prompt: item['prompt'] })
    }
    return parsed
  }
  const roles = read('roles')
  const props = read('props')
  const scenes = read('scenes')
  if (roles === undefined || props === undefined || scenes === undefined) return undefined
  return { roles, props, scenes }
}

async function answer(deps: WorkbenchRpcDeps, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<unknown> {
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
        ...deps.defaultSources === undefined ? {} : { defaultsSources: deps.defaultSources() },
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
      return { assets: await deps.store.listAssets(optionalText(payload, 'projectId')) }
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
      // Track B 传 `{ projectId, assetId?, path? }`：优先按素材 id 解析真实路径
      const assetId = optionalText(payload, 'assetId')
      let path = optionalText(payload, 'path')
      if (path === undefined && assetId !== undefined) {
        const projectId = optionalText(payload, 'projectId')
        const assets = projectId === undefined ? [] : await deps.store.listAssets(projectId)
        path = assets.find(asset => asset.id === assetId)?.path
      }
      if (path === undefined) throw new Error('提示词提取需要 path 或 assetId')
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
      const folder = optionalText(payload, 'folder')
      const resources = await deps.store.listResources(
        text(payload, 'projectId'),
        kind === undefined ? undefined : validated(() => normalizeResourceKind(kind)),
        folder === undefined || folder === '' ? undefined : folder,
      )
      // `B-7`：同时给出该项目的分类清单（扁平），界面不用自己聚合
      const all = await deps.store.listResources(text(payload, 'projectId'))
      const folders = [...new Set(all.map(resource => resource.folder).filter((entry): entry is string => entry !== undefined))].sort((left, right) => left.localeCompare(right, 'zh'))
      return { resources, folders }
    }
    case 'resources/create':
      return {
        resource: await deps.store.createResource({
          projectId: text(payload, 'projectId'),
          kind: validated(() => normalizeResourceKind(text(payload, 'kind'))),
          name: validated(() => normalizeResourceName(field(payload, 'name'))),
          note: optionalText(payload, 'note'),
          ...optionalText(payload, 'folder') === undefined ? {} : { folder: optionalText(payload, 'folder') as string },
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
        ...field(payload, 'folder') === undefined
          ? {}
          : { folder: field(payload, 'folder') === null ? null : text(payload, 'folder') },
        ...field(payload, 'assetPath') === undefined
          ? {}
          : { assetPath: field(payload, 'assetPath') === null ? null : text(payload, 'assetPath') },
        ...field(payload, 'assetPaths') === undefined
          ? {}
          : { assetPaths: field(payload, 'assetPaths') === null ? null : (field(payload, 'assetPaths') as unknown[]).filter((entry): entry is string => typeof entry === 'string') },
        ...field(payload, 'keyframes') === undefined
          ? {}
          : {
            keyframes: field(payload, 'keyframes') === null
              ? null
              : field(payload, 'keyframes') as readonly MotionKeyframe[],
          },
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
      const episodeId = optionalText(payload, 'episodeId')
      return { tasks: await deps.store.listTasks(limit ?? undefined, projectId, episodeId) }
    }
    // ---- 集 / 分段 / 分镜（剧集四层结构）----------------------------------------
    case 'episodes/list':
      return { episodes: await deps.store.listEpisodes(text(payload, 'projectId')) }
    case 'episodes/create':
      return {
        episode: await deps.store.createEpisode(text(payload, 'projectId'), {
          ...field(payload, 'no') === undefined ? {} : { no: field(payload, 'no') },
          ...field(payload, 'title') === undefined ? {} : { title: field(payload, 'title') },
        }),
      }
    case 'episodes/get':
      return { episode: await deps.store.getEpisode(text(payload, 'id')) }
    case 'episodes/update':
      return {
        episode: await deps.store.updateEpisode(text(payload, 'id'), {
          ...field(payload, 'no') === undefined ? {} : { no: field(payload, 'no') },
          ...field(payload, 'title') === undefined ? {} : { title: field(payload, 'title') },
          ...field(payload, 'remark') === undefined ? {} : { remark: field(payload, 'remark') },
          ...field(payload, 'script') === undefined ? {} : { script: field(payload, 'script') },
        }),
      }
    case 'episodes/remove':
      return { removed: await deps.store.deleteEpisode(text(payload, 'id'), field(payload, 'force') === true) }
    case 'episodes/reorder':
      return {
        episodes: await deps.store.reorderEpisodes(text(payload, 'projectId'), stringArray(payload, 'order')),
      }
    case 'episodes/resources':
      return {
        refs: await deps.store.episodeResources(text(payload, 'id'), episodeRefAction(payload), refInput(payload)),
      }
    case 'episodes/assets':
      return {
        refs: await deps.store.episodeAssets(text(payload, 'id'), episodeRefAction(payload), refInput(payload)),
      }
    case 'segments/list':
      return { segments: await deps.store.listSegments(text(payload, 'episodeId')) }
    case 'segments/create':
      return { segment: await deps.store.createSegment(text(payload, 'episodeId'), segmentInput(payload)) }
    case 'segments/update':
      return { segment: await deps.store.updateSegment(text(payload, 'id'), segmentInput(payload)) }
    case 'segments/remove':
      return { removed: await deps.store.deleteSegment(text(payload, 'id')) }
    case 'segments/reorder':
      return { segments: await deps.store.reorderSegments(text(payload, 'episodeId'), stringArray(payload, 'order')) }
    // 剧本自动拆段：交给所选文本模型按剧情/场景切分，并逐段落库。
    case 'episodes/split':
      return await splitEpisode(deps, payload, signal)
    // 剧本 → 集 → 分段 → 分镜：一次生成整棵结构并落库（每级都能再手动增删）。
    case 'episodes/generate': {
      const plan = await draftEpisodePlan(deps, payload, signal)
      return { episodes: await materializeEpisodePlan(deps, payload, plan) }
    }
    // 自动取数：按剧本内容让模型推荐集 / 段 / 镜三级数量，不落库。
    case 'episodes/suggestCounts':
      return await suggestEpisodeCounts(deps, payload, signal)
    // 剧本实体提取：剧本生成页的角色 / 场景 / 道具·服装三个分区共用。
    case 'entities/extract':
      return await extractEntities(deps, payload, signal)
    // 文本模型目录：剧本模块「模型」选择器的候选（宿主 ctx.llm，与图片/视频服务商无关）。
    case 'llm/models': {
      const llm = deps.llm
      if (llm === undefined) throw new Error('当前宿主未提供文本模型服务')
      const models: Array<{ provider: string; providerName: string; id: string; name: string }> = []
      const failures: Array<{ provider: string; message: string }> = []
      for (const provider of llm.listProviders()) {
        try {
          const listed = await llm.listModels(provider.id)
          for (const entry of listed) {
            // 生图 / 生视频模型也能从 llm 目录里列出来，但文本模型选择器不该看到它们。
            // 只按模型 id / 模态过滤：threevideo 等网关下的 deepseek-flash / deepseek-v4-pro
            // 是真正可用的文本模型，必须保留。
            if (!isTextModelEntry({ ...entry, provider: provider.id })) continue
            models.push({ provider: provider.id, providerName: provider.name, id: entry.id, name: entry.name })
          }
        } catch (error) {
          // 单个服务商的目录不可用不该拖垮其它服务商：如实记下原因，界面只列成功的那部分
          failures.push({ provider: provider.id, message: error instanceof Error ? error.message : String(error) })
        }
      }
      return { models, failures }
    }
    case 'storyboards/list':
      return { storyboards: await deps.store.listStoryboards(text(payload, 'episodeId')) }
    case 'storyboards/get':
      return { storyboard: await deps.store.getStoryboard(text(payload, 'id')) }
    case 'storyboards/save':
      return {
        storyboard: await deps.store.upsertStoryboard({
          ...field(payload, 'id') === undefined ? {} : { id: text(payload, 'id') },
          ...field(payload, 'episodeId') === undefined ? {} : { episodeId: text(payload, 'episodeId') },
          segmentId: text(payload, 'segmentId'),
          ...field(payload, 'skillId') === undefined ? {} : { skillId: field(payload, 'skillId') },
          shots: field(payload, 'shots') ?? [],
        }),
      }
    case 'storyboards/remove':
      return { removed: await deps.store.deleteStoryboard(text(payload, 'id')) }
    case 'episodes/export': {
      const episodeId = text(payload, 'episodeId')
      return {
        export: await exportEpisode({
          store: deps.store,
          episodeId,
          targetDir: join(deps.outputsDir, 'episodes', episodeId),
        }),
      }
    }
    // 单集导入：浏览器没有真实路径，走 base64 文本；桌面壳也可传 path。
    case 'episodes/import': {
      const projectId = text(payload, 'projectId')
      const base64 = optionalText(payload, 'base64')
      const content = base64 === undefined
        ? await readFile(text(payload, 'path'), 'utf8')
        : Buffer.from(base64, 'base64').toString('utf8')
      let manifest: unknown
      try {
        manifest = JSON.parse(content)
      } catch {
        throw new Error('导入失败：文件不是合法的 JSON')
      }
      return { imported: await deps.store.importEpisode({ projectId, manifest }) }
    }
    // ---- 双技能库（导演库 / 逆向库）--------------------------------------------
    case 'skills/list': {
      const kind = optionalText(payload, 'kind')
      return {
        skills: await skillLibraryFor(deps).list({
          ...kind === undefined ? {} : { kind },
          ...field(payload, 'enabled') === true ? { enabledOnly: true } : {},
        }),
      }
    }
    case 'skills/get':
      return { skill: await skillLibraryFor(deps).get(text(payload, 'id')) }
    case 'skills/save':
      return {
        skill: await skillLibraryFor(deps).save({
          ...optionalText(payload, 'id') === undefined ? {} : { id: optionalText(payload, 'id') as string },
          kind: text(payload, 'kind'),
          name: text(payload, 'name'),
          description: optionalText(payload, 'description') ?? '',
          prompt: text(payload, 'prompt'),
        }),
      }
    case 'skills/import':
      return {
        skill: await skillLibraryFor(deps).import({
          kind: text(payload, 'kind'),
          source: text(payload, 'source'),
        }),
      }
    case 'skills/toggle': {
      const enabled = field(payload, 'enabled')
      if (typeof enabled !== 'boolean') throw new Error('invalid workbench payload: enabled must be a boolean')
      return { skill: await skillLibraryFor(deps).toggle(text(payload, 'id'), enabled) }
    }
    case 'skills/remove':
      return { removed: await skillLibraryFor(deps).remove(text(payload, 'id')) }
    case 'skills/reveal': {
      const directory = await skillLibraryFor(deps).directoryOf(text(payload, 'id'))
      const reveal = deps.revealPath === undefined
        ? { ok: false, path: directory, reason: '宿主未装配目录打开能力' }
        : await deps.revealPath(directory)
      return { reveal }
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
    case 'workflows/sync-episode':
      return { workflow: await deps.store.syncEpisodeWorkflow(text(payload, 'episodeId')) }
    case 'workflows/remove':
      return { removed: await deps.store.removeWorkflow(text(payload, 'id')) }
    // ---- 运行（阶段 4，T4-4）----------------------------------------------------
    case 'workflows/run': {
      const workflowId = text(payload, 'workflowId')
      const workflow = await deps.store.findWorkflow(workflowId)
      if (workflow === undefined) throw new Error(`unknown workflow: ${workflowId}`)
      // `only` = 部分运行：只跑这些节点及其全部下游；上游/旁支不执行，
      // 运行记录里如实标 `skipped + not part of this run`（语义由 runner 保证）。
      const only = optionalStringArray(payload, 'only')
      return { run: await deps.runner.begin(workflow, only === undefined ? {} : { only }) }
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
    // ---- 一键自动流水线（`P0-2`）：剧本 → 分镜 →（生图）→ 生视频 的编排与起跑 ----------
    // 与画布同一套执行语义：这里只负责"把剧本编排成图"，执行仍走 `deps.runner`。
    case 'pipelines/compose': {
      const pipeline = await composePipeline(deps, payload, signal)
      return { pipeline }
    }
    case 'pipelines/run': {
      const pipeline = await composePipeline(deps, payload, signal)
      const workflow = await deps.store.findWorkflow(pipeline.workflowId)
      if (workflow === undefined) throw new Error(`unknown workflow: ${pipeline.workflowId}`)
      return { pipeline, run: await deps.runner.begin(workflow) }
    }
    // ---- 语音（TTS）：计划 / 同步合成 / 语音克隆 / 长文本异步 ----------
    case 'voice/status': {
      return { voice: await voiceStatus(deps) }
    }
    case 'voice/plan': {
      const timelineId = text(payload, 'timelineId')
      const timeline = await deps.store.findTimeline(timelineId)
      if (timeline === undefined) throw new Error(`unknown timeline: ${timelineId}`)
      return {
        plan: planDub(timeline),
        voice: await voiceStatus(deps),
      }
    }
    case 'voice/synthesize': {
      // 未配置时**绝不假装成功**：给机器码 + 可操作原因（界面直接展示）
      const service = requireTts(deps)
      const audio = await service.synthesize(ttsRequest(payload), signal)
      return { audio }
    }
    case 'voice/clone': {
      const service = requireTts(deps)
      const sample = await cloneSample(deps, payload)
      try {
        const voiceId = optionalText(payload, 'voiceId')
        const name = optionalText(payload, 'name')
        const previewText = optionalText(payload, 'text')
        const model = optionalText(payload, 'model')
        const clone = await service.clone({
          audioPath: sample.path,
          ...voiceId === undefined || voiceId.trim() === '' ? {} : { voiceId: voiceId.trim() },
          ...name === undefined || name.trim() === '' ? {} : { name: name.trim() },
          ...previewText === undefined || previewText.trim() === '' ? {} : { previewText: previewText.trim() },
          ...model === undefined || model.trim() === '' ? {} : { model: model.trim() },
        }, signal)
        return { clone }
      } finally {
        await sample.cleanup()
      }
    }
    case 'voice/synthesize-async': {
      const service = requireTts(deps)
      const task = await service.submitAsync(ttsRequest(payload), signal)
      return { task }
    }
    case 'voice/async-status': {
      const service = requireTts(deps)
      const taskId = text(payload, 'taskId')
      const spoken = optionalText(payload, 'text')
      const task = await service.queryAsync(taskId, {
        signal,
        ...spoken === undefined || spoken.trim() === '' ? {} : { text: spoken },
      })
      return { task }
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
    // ---- `B-7` 资源闭环：从「参考图」到「重绘」的零花费计划（不调模型）-------------------
    case 'resources/plan-redraw': {
      const id = text(payload, 'resourceId')
      const resource = await deps.store.findResource(id)
      if (resource === undefined) throw new Error(`unknown resource: ${id}`)
      const images = resource.assetPaths ?? (resource.assetPath === undefined ? [] : [resource.assetPath])
      const prompt = (resource.note ?? '').trim() !== '' ? (resource.note as string).trim() : `${resource.name}（${resource.kind}）`
      const warnings: string[] = []
      if (images.length === 0) warnings.push('这个资源还没有参考图：先给它挂一张定妆照/参考图，重绘才有视觉锚点')
      if ((resource.note ?? '').trim() === '') warnings.push('这个资源没有备注/提示词：已用「名称（类型）」兜底，建议补一句外观描述')
      return {
        resource,
        prompt,
        images,
        referenceCount: images.length,
        // 建议参数（界面可直接带进生成表单；不替用户决定模型）
        suggestions: { aspectRatio: '3:4', count: Math.max(1, images.length) },
        warnings,
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
      // `B-6`：block 级风险在提交前就拒绝（不花钱）；warn 级随结果回传提醒
      const promptRisk = scanPrompt(prompt)
      assertPromptAllowed(promptRisk, '融合生图提示词')
      const tool = deps.generate?.image
      if (tool === undefined) throw new Error('生成能力未装配：此宿主没有注入图片生成适配器')
      // Track B 的界面按角色/场景/物品分组传参；两套入参都接受，统一成 id 列表
      const collected: string[] = []
      for (const key of ['resourceIds', 'roles', 'scenes', 'props'] as const) {
        const raw = field(payload, key)
        if (!Array.isArray(raw)) continue
        collected.push(...raw.filter((entry): entry is string => typeof entry === 'string' && entry !== ''))
      }
      const resourceIds = [...new Set(collected)]
      const resources = (await deps.store.listResources(projectId)).filter(resource => resourceIds.includes(resource.id))
      const images: string[] = []
      /** 场景图（kind=scene）的第一个参考图：cropScene 优先裁它。 */
      let sceneImage: string | undefined
      for (const resource of resources) {
        const extra = resource as unknown as { assetPaths?: readonly string[]; assetPath?: string }
        const paths = extra.assetPaths ?? (extra.assetPath === undefined ? [] : [extra.assetPath])
        if (resource.kind === 'scene' && sceneImage === undefined) sceneImage = paths[0]
        images.push(...paths)
      }
      // `B-3`：姿态 / 镜头 / 裁剪（纯函数拼词；未知 id 会响亮报错而不是被静默丢弃）
      const pose = optionalText(payload, 'pose')
      const lens = optionalText(payload, 'lens')
      const styleNote = optionalText(payload, 'styleNote')
      const composedPrompt = buildComposePrompt({
        prompt,
        ...pose === undefined || pose === '' ? {} : { pose },
        ...lens === undefined || lens === '' ? {} : { lens },
        ...styleNote === undefined || styleNote === '' ? {} : { styleNote },
        subjects: resources.map(resource => ({
          kind: resource.kind, name: resource.name,
          ...resource.note === undefined ? {} : { note: resource.note },
        })),
      })
      const crop = normalizeComposeCrop(field(payload, 'cropScene'))
      let cropped: { path: string; bytes: number; width: number; height: number } | undefined
      if (crop !== undefined) {
        const targetPath = sceneImage ?? images[0]
        if (targetPath === undefined) {
          throw new Error('cropScene 需要至少一张场景/参考图：先给选中的场景资源挂参考图')
        }
        cropped = await cropImage({ sourcePath: targetPath, crop, outputsDir: deps.outputsDir })
        const index = images.indexOf(targetPath)
        if (index >= 0) images[index] = cropped.path
        else images.unshift(cropped.path)
      }
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
        composedPrompt,
        ...pose === undefined || pose === '' ? {} : { pose },
        ...lens === undefined || lens === '' ? {} : { lens },
        ...cropped === undefined ? {} : { cropped },
        ...promptRisk.hits.length === 0 ? {} : { promptWarnings: promptRisk.advice },
      }
    }
    case 'media/generate': {
      const mediaMode = optionalText(payload, 'mediaMode') === 'video' ? 'video' : 'image'
      const tool = mediaMode === 'video' ? deps.generate?.video : deps.generate?.image
      if (tool === undefined) throw new Error(`生成能力未装配：此宿主没有注入 ${mediaMode} 生成适配器`)
      const prompt = text(payload, 'prompt')
      // `B-6`：block 级风险在提交前就拒绝（不花钱）；warn 级随结果回传提醒
      const promptRisk = scanPrompt(prompt)
      assertPromptAllowed(promptRisk, mediaMode === 'video' ? '视频提示词' : '图片提示词')
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
      // `B-4`：续写是显式意图，原样透传给工具（由工具做「必须有参考视频」的校验）
      if (field(payload, 'continuation') === true) (args as Record<string, unknown>).continuation = true
      const projectId = optionalText(payload, 'projectId')
      const tracked = projectId !== undefined && projectId !== ''
      // `A147`：`wait:false` 时立即返回 taskId，前端轮询 `tasks/running` / `tasks/list` 拿结果。
      // 非阻塞模式必须绑定项目（否则结果没有地方可查，等于丢结果）。
      const wait = field(payload, 'wait') !== false
      if (!wait && !tracked) throw new Error('非阻塞模式（wait:false）必须传 projectId：否则生成结果无处可查')
      const startedAt = new Date().toISOString()
      const taskEpisodeId = optionalText(payload, 'episodeId')
      const taskSegmentId = optionalText(payload, 'segmentId')
      const taskShotId = optionalText(payload, 'shotId')
      let task: { id: string } | undefined
      if (tracked) {
        task = await deps.store.recordTask({
          kind: mediaMode, status: 'running', provider: deps.provider, prompt,
          projectId, startedAt,
          ...taskEpisodeId === undefined ? {} : { episodeId: taskEpisodeId },
          ...taskSegmentId === undefined ? {} : { segmentId: taskSegmentId },
          ...taskShotId === undefined ? {} : { shotId: taskShotId },
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
        const generatedPath = outcome.outputPath
        // 命名规则：<剧集名>-E<集数>-<序号>；旧文件不改名，序号每集从 001 递增
        const naming = tracked ? await resolveOutputNaming(deps.store, projectId as string, taskEpisodeId) : undefined
        const outputPath = naming === undefined
          ? generatedPath
          : await renameGeneratedOutput(generatedPath, naming).catch(() => generatedPath)
        let asset: unknown
        if (tracked) {
          asset = (await deps.store.attachAsset({
            projectId: projectId as string, path: outputPath, kind: mediaMode,
            ...outcome.bytes === undefined ? {} : { bytes: outcome.bytes },
            provider: deps.provider, prompt,
          })).asset
        }
        if (task !== undefined) {
          await deps.store.updateTask(task.id, {
            status: 'succeeded', outputPath,
            ...outcome.bytes === undefined ? {} : { bytes: outcome.bytes },
          })
        }
        return {
          mediaMode, path: outputPath,
          ...outcome.bytes === undefined ? {} : { bytes: outcome.bytes },
          ...asset === undefined ? {} : { asset },
          ...task === undefined ? {} : { taskId: task.id },
          ...promptRisk.hits.length === 0 ? {} : { promptWarnings: promptRisk.advice },
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
    // ---- `B-6`：模型能力卡 + 提示词风险校验 -------------------------------------------
    case 'models/catalog': {
      const cards = modelCards()
      // `refresh`：界面刷新按钮要求现场重探服务商目录，而不是再读一遍静态清单
      const refresh = (payload as { refresh?: unknown } | undefined)?.refresh === true
      return {
        cards,
        consistencyIssues: catalogConsistencyIssues(),
        generatedAt: new Date().toISOString(),
        // 「不选模型会用哪个」：宿主解析好再下发，界面直接显示默认模型名
        ...deps.defaultModels === undefined ? {} : { defaults: deps.defaultModels() },
        live: await liveCatalog(deps, refresh),
      }
    }
    // 默认值编辑器的白名单：编辑器打开时现取一次，避免只靠 health 那次快照
    case 'defaults/options':
      return { options: workbenchOptions() }
    case 'prompts/check': {
      const raw = field(payload, 'text')
      const text = typeof raw === 'string' ? raw : ''
      return { report: scanPrompt(text) }
    }
    // ---- 媒体能力（阶段 5）：ffmpeg 是否可用、什么版本、编码器齐不齐 ----------------
    // `A-7` / `B-20`：剧本 → 分镜表。选了文本模型走四步拆解，否则走确定性规则拆解；
    // 模型失败**如实回落**并在 `warnings` 里说明，不让界面以为"模型拆的就是这份"。
    case 'storyboard/plan': {
      const projectId = text(payload, 'projectId')
      const script = text(payload, 'script')
      const resources = await deps.store.listResources(projectId)
      const target = optionalNumber(payload, 'shots')
      const choice = optionalModelChoice(payload)
      const skill = await resolveSkillPrompt(deps, payload)
      const skillWarnings = skill.warning === undefined ? [] : [skill.warning]
      if (choice !== undefined) {
        try {
          const caller = await createStoryboardCaller(deps, choice.provider, choice.model, signal)
          if (caller === undefined) throw new Error('当前宿主未提供文本模型服务')
          const modelPlan = await planStoryboardWithModel(caller, {
            script,
            ...target === undefined ? {} : { shots: target },
            ...skill.prompt === undefined ? {} : { skillPrompt: skill.prompt },
            ...signal === undefined ? {} : { signal },
          })
          return {
            shots: modelPlan.shots,
            referencedResourceIds: referencedResourceIds(modelPlan.shots, resources),
            source: 'model' as const,
            entities: modelPlan.library,
            warnings: skillWarnings,
          }
        } catch (error) {
          const fallback = planStoryboard({
            script,
            ...target === undefined ? {} : { shots: target },
            resources: resources.map(resource => ({
              id: resource.id, kind: resource.kind, name: resource.name,
              ...resource.note === undefined ? {} : { note: resource.note },
            })),
          })
          return {
            ...fallback,
            source: 'rules' as const,
            warnings: [...skillWarnings, `文本模型拆解失败：${error instanceof Error ? error.message : String(error)}；已回落到规则拆解`],
          }
        }
      }
      return {
        ...planStoryboard({
          script,
          ...target === undefined ? {} : { shots: target },
          resources: resources.map(resource => ({
            id: resource.id, kind: resource.kind, name: resource.name,
            ...resource.note === undefined ? {} : { note: resource.note },
          })),
        }),
        source: 'rules' as const,
        warnings: [
          ...skillWarnings,
          ...skill.prompt === undefined ? [] : ['技能只在文本模型拆解时生效：本次用规则拆解，技能未应用'],
          '未选择文本模型：本次用规则拆解',
        ],
      }
    }
    // `B-20`：剧本文件导入（txt / md / docx / pdf，宿主侧解析后回纯文本）
    case 'scripts/import': {
      // 浏览器用 `<input type="file">` 上传时没有真实路径，改交文件名 + base64 字节
      const base64 = optionalText(payload, 'base64')
      if (base64 !== undefined) {
        return { script: await extractScriptBytes(text(payload, 'fileName'), Buffer.from(base64, 'base64')) }
      }
      return { script: await readScriptFile(text(payload, 'path')) }
    }
    // `B-20` 局部重拆：只重写指定的一镜，其余镜头原样保留（不推翻全表）。
    case 'storyboard/replan': {
      const script = text(payload, 'script')
      const index = Math.round(optionalNumber(payload, 'index') ?? 0)
      const rawShots = field(payload, 'shots')
      if (!Array.isArray(rawShots) || rawShots.length === 0) throw new Error('局部重拆需要先有分镜表')
      const shots = rawShots
        .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
        .map((entry, position) => ({
          index: position + 1,
          shot: typeof entry['shot'] === 'string' ? entry['shot'] : '',
          characters: Array.isArray(entry['characters'])
            ? (entry['characters'] as unknown[]).filter((name): name is string => typeof name === 'string')
            : [],
          ...typeof entry['scene'] === 'string' && entry['scene'] !== '' ? { scene: entry['scene'] } : {},
          imagePrompt: typeof entry['imagePrompt'] === 'string' ? entry['imagePrompt'] : '',
          videoPrompt: typeof entry['videoPrompt'] === 'string' ? entry['videoPrompt'] : '',
        }))
      if (index < 1 || index > shots.length) throw new Error(`镜号 ${index} 不在 1–${shots.length} 范围内`)
      const choice = optionalModelChoice(payload)
      if (choice === undefined) throw new Error('局部重拆需要选择一个文本模型')
      const caller = await createStoryboardCaller(deps, choice.provider, choice.model, signal)
      if (caller === undefined) throw new Error('当前宿主未提供文本模型服务，无法局部重拆')
      const entities = readEntityLibrary(field(payload, 'entities'))
      const skill = await resolveSkillPrompt(deps, payload)
      const next = await replanStoryboardShot(caller, {
        script,
        shots,
        index,
        ...entities === undefined ? {} : { library: entities },
        ...skill.prompt === undefined ? {} : { skillPrompt: skill.prompt },
        ...signal === undefined ? {} : { signal },
      })
      return { shots: next }
    }
    // `A-11`：导出历史（独立 exports.json；按项目可查，供界面展示成功/失败/重试）
    case 'exports/list': {
      const projectId = optionalText(payload, 'projectId')
      const limit = Math.min(200, Math.max(1, Math.round(optionalNumber(payload, 'limit') ?? 50)))
      const all = await exportHistoryFor(deps).list(projectId === undefined || projectId === '' ? undefined : projectId)
      return { exports: all.slice(0, limit) }
    }
    case 'exports/record': {
      const record = await exportHistoryFor(deps).start({
        projectId: text(payload, 'projectId'),
        timelineId: text(payload, 'timelineId'),
      })
      return { export: record }
    }
    case 'exports/update': {
      const updated = await exportHistoryFor(deps).update(text(payload, 'id'), {
        ...optionalText(payload, 'status') === undefined ? {} : { status: optionalText(payload, 'status') as 'queued' | 'running' | 'succeeded' | 'failed' },
        ...optionalText(payload, 'outputPath') === undefined ? {} : { outputPath: optionalText(payload, 'outputPath') as string },
        ...optionalNumber(payload, 'bytes') === undefined ? {} : { bytes: optionalNumber(payload, 'bytes') as number },
        ...optionalText(payload, 'error') === undefined ? {} : { error: optionalText(payload, 'error') as string },
        ...optionalNumber(payload, 'elapsedSeconds') === undefined ? {} : { elapsedSeconds: optionalNumber(payload, 'elapsedSeconds') as number },
      })
      if (updated === undefined) throw new Error(`unknown export: ${String(field(payload, 'id'))}`)
      return { export: updated }
    }
    // `A-5`：提示词库（独立 JSON 文件，不动项目 schema）
    case 'prompts/list': {
      const projectId = optionalText(payload, 'projectId')
      const episodeId = optionalText(payload, 'episodeId')
      return {
        prompts: await promptLibraryFor(deps).list({
          ...projectId === undefined ? {} : { projectId },
          ...episodeId === undefined ? {} : { episodeId },
        }),
      }
    }
    case 'prompts/save': {
      const projectId = optionalText(payload, 'projectId')
      const episodeId = optionalText(payload, 'episodeId')
      const prompt = await promptLibraryFor(deps).save({
        ...optionalText(payload, 'id') === undefined ? {} : { id: optionalText(payload, 'id') as string },
        name: text(payload, 'name'),
        text: text(payload, 'text'),
        ...optionalText(payload, 'source') === undefined ? {} : { source: optionalText(payload, 'source') as 'manual' | 'extract' | 'template' },
        ...projectId === undefined ? {} : { projectId },
        ...episodeId === undefined ? {} : { episodeId },
      })
      return { prompt }
    }
    case 'prompts/remove':
      return { removed: await promptLibraryFor(deps).remove(text(payload, 'id')) }
    // `A-5`：图片 / 视频 → 提示词提取。没有模型时如实报错（`R-BND-4` 不伪造结果）。
    case 'prompts/extract':
      return await extractPromptByPath(deps, payload, signal)
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
      // 预估与导出同口径：档位先换算成规格，再让显式 width/height/frameRate 覆盖（数值优先）
      const estimateSelection = exportSelectionFrom(payload)
      const estimateFormat = hasExportSelection(estimateSelection)
        ? resolveExportFormat(timeline.exportFormat, estimateSelection)
        : undefined
      const estimate = estimateExport(timeline, {
        ...estimateFormat === undefined ? {} : { width: estimateFormat.width, height: estimateFormat.height, frameRate: estimateFormat.frameRate },
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
      // `B2`：导出条给的是档位（480P/2K、24–60fps、16:9/9:16…），渲染器只认 exportFormat。
      // 换算在这里做，且只覆盖**本次**导出——不改存储里的时间轴。
      const selection = exportSelectionFrom(payload)
      const resolved = hasExportSelection(selection) ? resolveExportFormat(timeline.exportFormat, selection) : undefined
      return {
        render: deps.renders.start(timeline, {
          ...optionalNumber(payload, 'priority') === undefined ? {} : { priority: optionalNumber(payload, 'priority') as number },
          ...field(payload, 'retryTransient') === true ? { retryTransient: true } : {},
          ...optionalNumber(payload, 'thumbnailAtMs') === undefined ? {} : { thumbnailAtMs: optionalNumber(payload, 'thumbnailAtMs') as number },
          ...optionalText(payload, 'subtitleFormat') === 'vtt' ? { subtitleFormat: 'vtt' as const } : {},
          ...resolved === undefined || sameExportFormat(resolved, timeline.exportFormat) ? {} : { exportFormat: resolved },
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
    // ---- `B-5` 多比例切片：一条时间轴 → 多种画幅各自导出（只编码，不重新生成）---------
    case 'timelines/render-ratios': {
      const timelineId = text(payload, 'timelineId')
      const timeline = await deps.store.findTimeline(timelineId)
      if (timeline === undefined) throw new Error(`unknown timeline: ${timelineId}`)
      const rawRatios = field(payload, 'ratios')
      if (!Array.isArray(rawRatios)) throw new Error('ratios 必须是字符串数组（如 ["9:16","1:1"]）')
      const ratios = rawRatios.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
      const { slices, warnings } = planRatioSlices({ timeline, ratios })
      const priority = optionalNumber(payload, 'priority')
      const thumbnailAtMs = optionalNumber(payload, 'thumbnailAtMs')
      const jobs = slices.map(slice => deps.renders.start(slice.timeline, {
        ...priority === undefined ? {} : { priority },
        ...thumbnailAtMs === undefined ? {} : { thumbnailAtMs },
      }))
      return {
        timelineId,
        slices: slices.map(slice => ({ ratio: slice.ratio, width: slice.width, height: slice.height })),
        jobs,
        warnings,
      }
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
      // 按**原规格**重跑：用户选 2K 失败后重试，不能悄悄退回时间轴默认的 720p
      const recordedFormat = deps.renders.exportFormatOf(previous.id)
      const render = deps.renders.start(timeline, {
        ...previous.priority === undefined ? {} : { priority: previous.priority },
        ...recordedFormat === undefined ? {} : { exportFormat: recordedFormat },
      })
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
    // 打开本地产物目录：只唤起文件管理器，绝不删除任何东西（清理由用户自己做）
    case 'outputs/reveal': {
      const reveal = deps.revealOutputs === undefined
        ? { ok: false, path: deps.outputsDir, reason: '宿主未装配目录打开能力' }
        : await deps.revealOutputs()
      return { reveal }
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

/**
 * 读取导出条的三个档位（`B2`）。
 *
 * 与 `width/height/frameRate` 并存：档位是界面语言（480P/2K、16:9…），
 * 数值是程序语言，两者都支持，数值优先（见各调用点）。
 */
function exportSelectionFrom(payload: unknown): ExportSelection {
  const resolution = optionalText(payload, 'resolution')
  const fps = optionalNumber(payload, 'fps')
  const aspect = optionalText(payload, 'aspect')
  return {
    ...resolution === undefined ? {} : { resolution },
    ...fps === undefined ? {} : { fps },
    ...aspect === undefined ? {} : { aspect },
  }
}

/** Read one required string array field. */
function stringArray(payload: unknown, key: string): string[] {
  const value = field(payload, key)
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')) {
    throw new Error(`invalid workbench payload: ${key} must be a string array`)
  }
  return value
}

/** Read an optional string array field; an explicitly empty array is a misuse. */
function optionalStringArray(payload: unknown, key: string): string[] | undefined {
  const value = field(payload, key)
  if (value === undefined || value === null) return undefined
  const parsed = stringArray(payload, key)
  if (parsed.length === 0) throw new Error(`invalid workbench payload: ${key} must be a non-empty string array`)
  return parsed
}

/** Read the episode reference action (`list` / `add` / `remove` / `move`). */
function episodeRefAction(payload: unknown): EpisodeRefAction {
  const value = field(payload, 'action')
  if (value === 'list') return 'list'
  if (value === 'add') return 'add'
  if (value === 'remove') return 'remove'
  if (value === 'move') return 'move'
  throw new Error('invalid workbench payload: action must be list/add/remove/move')
}

/** Read the optional fields shared by resource and asset references. */
function refInput(payload: unknown): EpisodeRefInput {
  return {
    ...field(payload, 'resourceId') === undefined ? {} : { resourceId: field(payload, 'resourceId') },
    ...field(payload, 'assetId') === undefined ? {} : { assetId: field(payload, 'assetId') },
    ...field(payload, 'category') === undefined ? {} : { category: field(payload, 'category') },
    ...field(payload, 'order') === undefined ? {} : { order: field(payload, 'order') },
  }
}

/** Read the optional fields shared by segment create and update. */
function segmentInput(payload: unknown): SegmentInput {
  const keys = ['promptText', 'durationSec', 'order', 'imageModel', 'videoModel', 'textModel', 'skillId', 'refs'] as const
  const input: Record<string, unknown> = {}
  for (const key of keys) {
    const value = field(payload, key)
    if (value !== undefined) input[key] = value
  }
  return input
}

/** 克隆样本体积上限（与语音服务内部口径一致，在这里先拦掉明显的错误）。 */
const MAX_CLONE_UPLOAD_BYTES = 20 * 1024 * 1024

/** 语音可用性：宿主没装配语音服务时如实说明（不抛错，界面据此禁用按钮）。 */
async function voiceStatus(deps: WorkbenchRpcDeps): Promise<TtsAvailability> {
  if (deps.voice === undefined) {
    return {
      available: false,
      provider: 'threevideo',
      reason: '当前宿主没有装配语音服务（voice 依赖缺失）：升级到带语音能力的宿主版本',
      voices: [],
    }
  }
  return await deps.voice.status()
}

/** 取语音服务；缺失时抛可操作错误（机器码 `tts/not-ready`）。 */
function requireTts(deps: WorkbenchRpcDeps): TtsService {
  if (deps.voice === undefined) {
    throw new TtsNotReadyError('当前宿主没有装配语音服务（voice 依赖缺失）：升级到带语音能力的宿主版本')
  }
  return deps.voice
}

/** 读可选的音频封装字段。 */
function audioFormat(payload: unknown): TtsAudioFormat | undefined {
  const value = optionalText(payload, 'responseFormat') ?? optionalText(payload, 'format')
  if (value === undefined || value.trim() === '') return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'mp3' || normalized === 'wav' || normalized === 'pcm'
    || normalized === 'flac' || normalized === 'ogg' || normalized === 'aac') {
    return normalized
  }
  throw new Error(`invalid workbench payload: responseFormat 必须是 mp3/wav/pcm/flac/ogg/aac 之一，收到 ${value}`)
}

/** 读多人对话/音效参考音频（接受 `[{audioUrl}]`、`[{audio_url}]`、`['url']` 三种形态）。 */
function ttsReferences(payload: unknown): Array<{ audioUrl: string }> | undefined {
  const value = field(payload, 'references')
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) throw new Error('invalid workbench payload: references must be an array')
  const references = value.map((entry, index) => {
    if (typeof entry === 'string' && entry.trim() !== '') return { audioUrl: entry.trim() }
    if (typeof entry === 'object' && entry !== null) {
      const record = entry as Record<string, unknown>
      const url = record.audioUrl ?? record.audio_url ?? record.url
      if (typeof url === 'string' && url.trim() !== '') return { audioUrl: url.trim() }
    }
    throw new Error(`invalid workbench payload: references[${index}] 需要 audioUrl / audio_url / url`)
  })
  return references.length === 0 ? undefined : references
}

/** 读一次合成请求（`text` 必填，其余可选且只在有值时下发）。 */
function ttsRequest(payload: unknown): TtsRequest {
  const spoken = text(payload, 'text')
  const voiceId = optionalText(payload, 'voiceId') ?? optionalText(payload, 'voice')
  const model = optionalText(payload, 'model')
  const speed = optionalNumber(payload, 'speed')
  const pitch = optionalNumber(payload, 'pitch')
  const volume = optionalNumber(payload, 'volume')
  const instruction = optionalText(payload, 'instruction')
  const responseFormat = audioFormat(payload)
  const references = ttsReferences(payload)
  return {
    text: spoken,
    ...voiceId === undefined || voiceId.trim() === '' ? {} : { voiceId: voiceId.trim() },
    ...model === undefined || model.trim() === '' ? {} : { model: model.trim() },
    ...speed === undefined ? {} : { speed },
    ...pitch === undefined ? {} : { pitch },
    ...volume === undefined ? {} : { volume },
    ...instruction === undefined || instruction.trim() === '' ? {} : { instruction: instruction.trim() },
    ...responseFormat === undefined ? {} : { responseFormat },
    ...references === undefined ? {} : { references },
  }
}

/**
 * 定位克隆样本：`audioPath`（outputs 内或已登记素材）或 `audioBase64`（浏览器上传）。
 * 上传的字节写到临时目录，调用方用完即删（不污染 outputs）。
 */
async function cloneSample(
  deps: WorkbenchRpcDeps,
  payload: unknown,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const base64 = optionalText(payload, 'audioBase64')
  if (base64 !== undefined && base64.trim() !== '') {
    const cleaned = base64.trim().replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, '')
    const bytes = Buffer.from(cleaned, 'base64')
    if (bytes.byteLength === 0) throw new Error('voice/clone: audioBase64 解码为空')
    if (bytes.byteLength > MAX_CLONE_UPLOAD_BYTES) {
      throw new Error(`voice/clone: 样本 ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB 超过 20MB 上限`)
    }
    const rawName = (optionalText(payload, 'filename') ?? 'clone-sample').replace(/[^\w.-]/gu, '_')
    const extension = extname(rawName) === '' ? '.wav' : extname(rawName)
    const directory = await mkdtemp(join(tmpdir(), 'dsh-voice-clone-'))
    const path = join(directory, `${basename(rawName, extname(rawName)) || 'sample'}${extension}`)
    await writeFile(path, bytes)
    return { path, cleanup: async () => { await rm(directory, { recursive: true, force: true }) } }
  }
  const relative = optionalText(payload, 'audioPath') ?? optionalText(payload, 'path')
  if (relative === undefined || relative.trim() === '') {
    throw new Error('voice/clone 需要 audioPath（宿主路径）或 audioBase64（浏览器上传的样本）')
  }
  const value = relative.trim()
  const absolute = resolve(deps.outputsDir, value)
  const inside = absolute === deps.outputsDir || absolute.startsWith(`${deps.outputsDir}${sep}`)
  const known = new Set(await deps.store.referencedAssetPaths())
  if (!inside && !known.has(value)) {
    throw new Error(`克隆样本必须在 outputs 目录内或已登记素材中：${value}`)
  }
  return { path: absolute, cleanup: async () => {} }
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
      // 文本模型服务是可选的：宿主没装配 ctx.llm 时客户端会收到明确报错，手动加段照常可用。
      const workbench = createWorkbenchHandler({ ...deps, llm: deps.llm ?? ctx.get('llm') })
      // 同一个通道按前缀分流：`auth/*` 走登录闭环 dispatcher，其余仍是工作台端点。
      // 共用一条通道让浏览器半边只持有一个 ConnectionHandle（凭证明文只在宿主内流转）。
      // 长期配置（接口地址 / 最近服务商）落在工作台数据目录：重启后仍然有效，无过期。
      // 测试或裸上下文里目录可能缺失，此时退化成进程内配置而不是让通道注册失败。
      const directory = deps.store?.directory
      const auth = createAuthRpcHandler(ctx, typeof directory === 'string' && directory !== ''
        ? { settings: createAuthSettingsStore(join(directory, 'auth-settings.json')) }
        : {})
      const remove = connection.rpc.handle(WORKBENCH_RPC_CHANNEL, async (endpoint, payload, signal, peer) =>
        endpoint.startsWith('auth/') ? auth(endpoint, payload) : workbench(endpoint, payload, signal, peer))
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
