/**
 * dsh-image-video — DeepSeek Harness 插件：文生图与文生视频工具。
 *
 * 注册两个模型可调用工具：
 *   - `generate_image`：文生图，支持 万象（wanx）/ Seedance2.5 切换。路由支持图片输入时，工具结果
 *     携带 image 块经现有消息图片渲染内嵌显示；否则回退纯文本摘要。附件字节走 attachment 服务，落地 outputs/
 *   - `generate_video`：文生短视频（上限 10s），后台异步轮询，不阻塞对话，结果落地 outputs/
 *
 * 生命周期遵循 Cordis 规范：`TaskManager` 在构造时通过 `ctx.effect()` 注册卸载清理函数，
 * 插件卸载时框架自动调用该清理函数，取消所有排队中的生成任务、清理轮询定时器，杜绝内存泄漏。
 *
 * 服务依赖声明：
 *   - `tools`（必需）：工具注册表，`inject` 顶部声明，缺失则插件不加载。
 *   - `attachments`（generate_image 必需）：通过 `ctx.inject(['attachments'], cb)` 显式声明，
 *     当 attachment 服务挂载时注册 generate_image；服务撤销时 fiber dispose 自动注销工具。
 *     不在工具执行体内部运行时 `ctx.get` 读取未声明的服务。
 *   - `webServer`（可选，桌面环境提供）：通过 `ctx.inject(['webServer'], cb)` 显式声明，
 *     挂载时注册 outputs/ 只读媒体路由（仅 127.0.0.1 回环），供桌面客户端内嵌
 *     播放器加载生成结果；服务缺失（纯 CLI 会话）时跳过，不影响工具注册。
 *   - generate_video 不依赖 attachments，始终注册。
 *
 * 组合兼容：`cordis.patch.yml` 用 `- insert:` 新增 `image-video` 行，不覆盖任何现有插件行；
 * 依赖均通过官方服务接口交互，不假设其他插件内部实现。
 *
 * @module dsh-image-video
 */

import { ProbeCache } from './media/probe-cache.ts'
import { probeMediaSpec } from './media/render.ts'
import { probeFfmpeg } from './media/ffmpeg.ts'
import { sep } from 'node:path'
import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-tools'
import { Config, hasConfiguredCredentials } from './config.ts'
import type { ApiKeyResolver } from './config.ts'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { Provider } from './config.ts'
import { registerOutputsRoute, type MediaWebServer } from './media-route.ts'
import { resolveOutputsDir } from './media.ts'
import { extractPersistedDefaults, registerDefaultsRoute } from './runtime-defaults.ts'
import { createRuntimeDefaultsStore, resolveDefaultsView } from './runtime-defaults.ts'
import { registerMediaModeInjection } from './media-mode-injection.ts'
import { registerWorkbenchRpc, workbenchOptions } from './host/rpc.ts'
import { DiagnosticsCollector } from './host/diagnostics.ts'
import { registerWorkbenchStatusRoute } from './host/status-route.ts'
import { resolveWorkbenchDirectory, WorkbenchStore } from './workbench/store.ts'
import { withTaskLedger } from './workbench/ledger.ts'
import { GenerationRegistry } from './workbench/cancel.ts'
import { WorkflowRunner, type GenerationTool } from './workbench/runner.ts'
import { RenderRegistry } from './media/render-registry.ts'
import { planRetention } from './media/retention.ts'
import { listOutputs } from './workbench/outputs.ts'
import { RenderService } from './media/render.ts'
import { TaskManager } from './task-manager.ts'
import { createGenerateImageTool } from './tools/generate-image.ts'
import { createGenerateVideoTool } from './tools/generate-video.ts'
import { createWorkbenchTools } from './tools/workbench.ts'

export { Config } from './config.ts'
export type { Config as ConfigType, Provider, ProviderCredentials, WatermarkConfig, WatermarkPosition } from './config.ts'
export { applyImageWatermark, buildWatermarkSvg, fitFontSize } from './watermark.ts'
export type { WatermarkResult } from './watermark.ts'
export { TaskManager } from './task-manager.ts'
export type { TaskQueryFn } from './task-manager.ts'
export { GenerationError, isAsyncImageUnavailableError, isUnknownSubmitStateError, isModelNotAcceptedError } from './http-client.ts'
export type { ErrorKind, RequestOptions, RequestResult } from './http-client.ts'
export {
  AsyncTransportUnavailableError,
  DEFAULT_RECOVERY_BUDGET,
  TRANSPORT_PROBE_TTL_MS,
  canFallbackToNextProvider,
  consumeSubmitBudget,
  createImageTransaction,
  reportTransaction,
  resolveImageTransport,
  runImageTransaction,
  submitBudget,
  unknownStateError,
} from './image-transaction.ts'
export type {
  ImageTransaction,
  ImageTransport,
  RecoveryBudget,
  TransactionReport,
  TransactionStatus,
  TransportProbeCache,
  UnknownStatePolicy,
} from './image-transaction.ts'
export { formatPreflightNote, looksLikeVideoModel, resolveImagePreflight } from './image-preflight.ts'
export type { ImagePreflight } from './image-preflight.ts'
export { wanxAdapter } from './providers/wanx.ts'
export { seedanceAdapter } from './providers/seedance.ts'
export { threerouterAdapter } from './providers/threerouter.ts'
export type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult, AsyncImageSubmit, ImageAsyncCapability } from './providers/types.ts'
export { createGenerateImageTool } from './tools/generate-image.ts'
export { createGenerateVideoTool } from './tools/generate-video.ts'
export {
  applyImageStyle,
  createRuntimeDefaultsStore,
  createDefaultsRouteHandler,
  DEFAULTS_ROUTE_PATH,
  extractPersistedDefaults,
  IMAGE_SIZE_OPTIONS,
  IMAGE_STYLE_OPTIONS,
  parseDefaultsPatch,
  registerDefaultsRoute,
  resolveDefaultsView,
} from './runtime-defaults.ts'
export type { MediaMode, PersistedDefaultsView, RuntimeDefaults, RuntimeDefaultsPatch, RuntimeDefaultsStore, RuntimeDefaultsView } from './runtime-defaults.ts'
export { registerMediaModeInjection, renderMediaModeInstruction } from './media-mode-injection.ts'
export type { MediaModeInjectionOptions } from './media-mode-injection.ts'

/** Cordis 插件名，用于 loader 诊断。 */
export const name = 'image-video'

/**
 * 必需服务依赖：`tools`（工具注册表）。
 * `attachments` 不在此声明——它由 `generate_image` 通过 `ctx.inject` 按需声明，
 * 缺失时仅 generate_image 不注册，generate_video 与插件本身不受影响。
 */
export const inject = ['tools']

/**
 * 插件入口：创建任务管理器（注册卸载清理），注册 generate_image / generate_video 工具。
 *
 * `generate_image` 通过 `ctx.inject(['attachments'], cb)` 显式声明对 attachment 服务的依赖：
 * callback 接收已注入 attachments 的子上下文，从中读取服务实例构造时注入工具，
 * 不在执行体内部运行时 `ctx.get` 读取。attachments 服务撤销时，该 fiber dispose，
 * `ctx.tools.register` 的 disposer 自动注销工具。
 *
 * `generate_video` 不依赖 attachments，始终注册。工具注册的 disposer 由 `ctx.tools.register`
 * 内部经 effect 注册，fiber dispose 时自动清理。
 *
 * @param ctx - 插件上下文。
 * @param config - 已由 Schemastery 填充默认值的插件配置。
 */
export function apply(ctx: Context, config: Config): void {
  // outputsDir 的**唯一解析点**：相对路径按进程 cwd 解析成绝对路径后，生成/下载/
  // 水印后处理/只读媒体路由全部使用这一个结果。这样「图片到底写到了哪个目录」
  // 有唯一答案，不会再出现模型结果在 A 目录、后处理结果在 B 目录的旁路产物。
  const outputsDir = resolveOutputsDir(config.outputsDir)

  // 工作台数据（项目/素材/任务账本）：目录由输出目录派生，全进程一个实例，
  // 生成工具的账本写入与 RPC 端点读写共用它。
  // 诊断收集器（`A9`）：只留最近 50 条错误，不落盘、不含提示词
  const diagnostics = new DiagnosticsCollector()
  const workbenchStore = new WorkbenchStore({ directory: resolveWorkbenchDirectory(outputsDir) })

  // 在飞的生成任务：账本包装器按 taskId 注册可取消句柄，RPC 的 tasks/cancel 掐它。
  const generationRegistry = new GenerationRegistry()

  // 上次进程留下的"运行中"条目本进程无法再取消，启动时如实收尾（避免永远显示运行中）。
  void workbenchStore.failStaleRunning('宿主重启中断（无法继续等待该任务）').catch(() => {})
  void workbenchStore.failStaleRuns('宿主重启中断（无法继续执行这次运行）').catch(() => {})

  // 生效配置摘要（不含 key 明文）：把「哪个 profile/patch 生效、默认服务商与默认模型
  // 究竟是什么、图片提交走哪条传输、水印开没开、结果落到哪个绝对目录」一次性写进
  // 宿主日志，便于在 web/desktop 多 profile 场景定位配置来源，消除「用了哪个服务商/
  // 模型/目录」只能靠推断的问题。
  const keyState = (provider: Provider): string =>
    hasConfiguredCredentials(config, provider) ? '已配置' : '未配置'
  ctx.logger.info(
    `dsh-image-video 生效配置：provider=${config.provider}`
    + ` defaultVideoProvider=${config.defaultVideoProvider || '(跟随激活服务商)'}`
    + ` defaultImageProvider=${config.defaultImageProvider || '(跟随激活服务商)'}`
    + ` defaultVideoModel=${config.defaultVideoModel || '(服务商内置默认)'}`
    + ` defaultImageModel=${config.defaultImageModel || '(服务商内置默认)'}`
    + ` defaultImageSize=${config.defaultImageSize}`
    + ` imageTransport=${config.imageTransport}`
    + ` imageUnknownStatePolicy=${config.imageUnknownStatePolicy}`
    + ` watermark=${config.watermark.enabled ? `${config.watermark.text}@${config.watermark.position}` : '关闭'}`
    + ` outputsDir=${outputsDir}`
    + ` keys{threerouter=${keyState('threerouter')}, wanx=${keyState('wanx')}, minimax=${keyState('minimax')}, seedance=${keyState('seedance')}}`,
  )

  // 任务管理器：构造时通过 ctx.effect() 注册卸载清理函数，
  // 插件卸载时自动取消所有排队任务、清理轮询定时器。
  const taskManager = new TaskManager(ctx, config)

  // API Key 解析：生成工具每次执行时经凭证缝读取 `apiKeyEnv` 引用的值
  // （如桌面端登录后写入的 Key），使配置只携带引用、不内联明文；每次操作重新
  // 解析，凭证变更无需重启即生效。凭证服务或引用缺失都返回 undefined，由
  // resolveProviderCredentials 回落明文 apiKey 或响亮报错。
  const resolveApiKey: ApiKeyResolver = async (ref) => {
    const validated = credentialRef(ref)
    const credentials = ctx.get('credentials')
    if (credentials === undefined) return undefined
    return (await credentials.resolve(validated))?.value
  }

  // 运行时生成默认值：桌面 composer 热更新覆盖值的内存态存储（不落盘，
  // 重载后回落 settings 持久值，避免任何配置写入触发宿主重启）。
  const runtimeDefaults = createRuntimeDefaultsStore()

  // settings 持久默认回落层：defaults 路由与媒体模式注入共用同一取值口径。
  // 结构化日志（`T7-3`）：一行一个 JSON 事件，字段（taskId/runId/renderId/服务商/耗时）可串联
  const logEntry = (entry: Record<string, unknown>): void => {
    ctx.logger?.info?.(`image-video ${JSON.stringify(entry)}`)
  }
  const persistedDefaults = extractPersistedDefaults(config)

  // 图运行器要复用**同一对**生成工具（参数语义、账本、取消都一致）。
  // generate_image 只在 attachments 注入回调里注册，顺序不定，所以这里放槽位、
  // 用惰性代理调用；服务缺失时给出诚实错误，而不是伪造成功。
  const generationTools: { image?: GenerationTool; video?: GenerationTool } = {}
  const proxyTool = (slot: 'image' | 'video'): GenerationTool => ({
    async execute(args, exec) {
      const tool = generationTools[slot]
      if (tool === undefined) throw new Error(`generate_${slot} is unavailable in this host`)
      return tool.execute(args, exec)
    },
  })

  // generate_image：显式声明 attachments 依赖。
  // callback 在 attachments 服务可用时执行，fiber-scoped 注册工具；
  // 服务撤销时 fiber dispose，工具自动注销。对齐官方 read-image 模式。
  ctx.inject(['attachments'], (imageCtx) => {
    const attachments = imageCtx.get('attachments')
    // ctx.inject 回调保证 attachments 已注入；defensive check 仅防御直接调用方
    if (!attachments) return
    // 传入插件根 ctx 供 generate_image 在 execute 内解析 llm 服务以判定图片能力门。
    const imageTool = withTaskLedger(
      createGenerateImageTool({ config, taskManager, attachments, ctx, runtimeDefaults, outputsDir, resolveApiKey }),
      { store: workbenchStore, registry: generationRegistry, kind: 'image', log: logEntry },
    )
    imageCtx.tools.register(imageTool)
    generationTools.image = imageTool as unknown as GenerationTool
  })

  // generate_video：不依赖 attachments，始终注册。
  const videoTool = withTaskLedger(
    createGenerateVideoTool({ config, taskManager, runtimeDefaults, outputsDir, resolveApiKey }),
    { store: workbenchStore, registry: generationRegistry, kind: 'video', log: logEntry },
  )
  ctx.tools.register(videoTool)
  generationTools.video = videoTool as unknown as GenerationTool

  // outputs 媒体路由：webServer 服务可用时把 outputs/ 目录以只读方式暴露给
  // 渲染进程（/outputs/<文件名>），桌面客户端 toolview 据此内嵌加载生成的
  // 视频/图片；仅回环地址注册，非 127.0.0.1 不暴露。路由注销随 fiber 卸载。
  ctx.inject(['webServer'], (mediaCtx) => {
    const webServer = mediaCtx.get('webServer') as MediaWebServer | undefined
    if (!webServer) return
    const disposeRoute = registerOutputsRoute(webServer, outputsDir)
    // host 非 127.0.0.1 时不注册，无路由可注销
    if (disposeRoute) mediaCtx.effect(() => disposeRoute, 'dsh-image-video: outputs media route')

    // defaults 热更新路由：桌面渲染进程同源 GET/POST /image-video/defaults，
    // composer 切换模型/比例/风格/时长立即生效（仅内存，不触发重启）；
    // GET/POST 响应为「运行时覆盖 ?? settings 持久默认」合并视图，持久默认经
    // extractPersistedDefaults 白名单守卫提取。同样仅回环注册，注销随 fiber 卸载。
    const disposeDefaults = registerDefaultsRoute(webServer, runtimeDefaults, persistedDefaults)
    if (disposeDefaults) mediaCtx.effect(() => disposeDefaults, 'dsh-image-video: runtime defaults route')

    // 工作台状态路由（GET /image-video/status，仅回环）：把宿主侧 RPC 通道的注册结果
    // 直接摊开给页面——通道缺席时客户端只会看到 HTTP 405，这里能读到"已注册/仍在等
    // 注入/注册报错"。与 defaults 同一条已验证可用的注册路径，因此它是可靠的诊断口。
    const disposeStatus = registerWorkbenchStatusRoute(webServer, { provider: config.provider, outputsDir })
    if (disposeStatus) mediaCtx.effect(() => disposeStatus, 'dsh-image-video: workbench status route')
  })

  // 媒体模式注入：composer 选到图片/视频 tab 时，在用户轮次进入模型请求前追加
  // 「直接调用生成工具」的指令（见 media-mode-injection.ts）。agents 服务可用时
  // 注册，注销随 fiber 卸载；服务缺失（纯 CLI 会话）时跳过，不影响工具注册。
  ctx.inject(['agents'], (agentCtx) => {
    registerMediaModeInjection(agentCtx, { store: runtimeDefaults, persisted: persistedDefaults })
  })

  // 工作台 RPC（右栏客户端半边的唯一宿主入口，见 host/rpc.ts）：目前只暴露健康
  // 检查，项目/素材/任务/渲染的端点后续加进同一通道。通道随 fiber 卸载撤销，禁用
  // 插件后调用即失败。
  //
  // **必须同时注入 `webServer`**：`connection.rpc.handle()` 把 Web 路由注册在
  // 「读取该服务的 ctx」（见 `HostConnectionService.callerCtx`），即 `rpcCtx`；
  // 而 `webServer` 未在该子上下文中注入时 `owner.webServer.register` 会抛错、路由
  // 静默缺席，浏览器侧只能看到 `HTTP 405`（2026-10-14 现场踩到并修掉）。
  ctx.inject(['connection', 'webServer'], (rpcCtx) => {
    // 导出服务：成功产物自动登记成素材，出现在素材面板里（`T5-5`）
  const renderService = new RenderService({
    // 用插件已经解析好的绝对目录，不要回落到可能是相对路径的 config 字段
    outputsDir,
  })
  // `A38`：导出完成后给"保留建议"——只在配置了上限时计算，**只报告不删除**
  const retentionHint = async (): Promise<{ files: number; bytes: number; removeCount: number; freedBytes: number; overQuota: boolean } | undefined> => {
    const maxFiles = Number(process.env.DSH_OUTPUT_MAX_FILES ?? '') || undefined
    const maxGb = Number(process.env.DSH_OUTPUT_MAX_GB ?? '') || undefined
    if (maxFiles === undefined && maxGb === undefined) return undefined
    const files = (await listOutputs(outputsDir)).map(file => ({
      name: file.name, bytes: file.bytes, mtimeMs: Date.parse(file.modifiedAt ?? '') || 0,
    }))
    const plan = planRetention(files, {
      ...maxFiles === undefined ? {} : { maxFiles },
      ...maxGb === undefined ? {} : { maxBytes: Math.round(maxGb * 1024 ** 3) },
      protect: new Set(await workbenchStore.referencedAssetPaths()),
    })
    return {
      files: files.length,
      bytes: files.reduce((sum, file) => sum + file.bytes, 0),
      removeCount: plan.removed.length,
      freedBytes: plan.freedBytes,
      overQuota: plan.overQuota,
    }
  }
  // `A77`：素材探测缓存（同一素材重复探测不再起 ffmpeg 进程；素材变则自动失效）
  const probeCache = new ProbeCache({
    probe: async file => {
      const available = await probeFfmpeg()
      if (!available.available) return undefined
      return probeMediaSpec(available.path ?? 'ffmpeg', file)
    },
  })

  const renderRegistry = new RenderRegistry({
    render: renderService,
    retention: retentionHint,
    registerAsset: async job => {
      if (job.outputPath === undefined) return
      await workbenchStore.attachAsset({
        projectId: job.projectId, path: job.outputPath, kind: 'video',
        bytes: job.bytes, provider: config.provider, prompt: `时间轴导出（${job.timelineId}）`,
      })
    },
    onError: message => {
      ctx.logger?.warn?.(`image-video workbench: ${message}`)
      diagnostics.recordError('runner', message)
    },
  })
  // 进程重启后遗留的"运行中"导出按失败收尾，避免永远转圈
  renderRegistry.failStale('宿主重启中断（无法继续这次导出）')

    // 图运行器复用对话里的同一对生成工具（参数语义一致，账本/取消自动继承）
    const workflowRunner = new WorkflowRunner({
      store: workbenchStore,
      generateImage: proxyTool('image'),
      generateVideo: proxyTool('video'),
      log: logEntry,
      onError: message => { ctx.logger?.warn?.(`image-video workbench: ${message}`) },
    })
    registerWorkbenchRpc(rpcCtx, {
    diagnostics,
      provider: config.provider, outputsDir, store: workbenchStore, registry: generationRegistry,
      runner: workflowRunner, renders: renderRegistry,
      probeCache,
      // 生效默认值：与 composer 注入用同一口径（运行时覆盖 ?? settings 持久默认）
      defaults: () => resolveDefaultsView(runtimeDefaults, persistedDefaults) as Record<string, string | number | null>,
      // 下拉白名单由宿主下发：浏览器包不内置服务商名（`T2-11`）
      options: workbenchOptions,
    })

  // Agent 工具面（`T6-3`）：项目/素材/时间轴/工作流/任务。注册在 effect 内，
  // 卸载时随 fiber 注销（回滚=摘掉这段注册）。
  for (const tool of createWorkbenchTools({
    store: workbenchStore, renders: renderRegistry, runner: workflowRunner, registry: generationRegistry,
    outputsDir,
    // `A63`：与 `assets/probe` 端点同一套边界（只允许 outputs 内或已登记素材）
    probeAsset: async relative => {
      const absolute = resolve(outputsDir, relative)
      const known = new Set(await workbenchStore.referencedAssetPaths())
      const inside = absolute === outputsDir || absolute.startsWith(`${outputsDir}${sep}`)
      if (!inside && !known.has(relative)) return undefined
      const probe = await probeFfmpeg()
      if (!probe.available) return undefined
      return probeMediaSpec(probe.path ?? 'ffmpeg', absolute)
    },
  })) {
    ctx.tools.register(tool)
  }
  })
}
