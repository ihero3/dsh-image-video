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

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-tools'
import { Config } from './config.ts'
import { registerOutputsRoute, type MediaWebServer } from './media-route.ts'
import { registerDefaultsRoute } from './runtime-defaults.ts'
import { createRuntimeDefaultsStore } from './runtime-defaults.ts'
import { TaskManager } from './task-manager.ts'
import { createGenerateImageTool } from './tools/generate-image.ts'
import { createGenerateVideoTool } from './tools/generate-video.ts'

export { Config } from './config.ts'
export type { Config as ConfigType, Provider, ProviderCredentials } from './config.ts'
export { TaskManager } from './task-manager.ts'
export { GenerationError } from './http-client.ts'
export type { ErrorKind, RequestOptions, RequestResult } from './http-client.ts'
export { wanxAdapter } from './providers/wanx.ts'
export { seedanceAdapter } from './providers/seedance.ts'
export { threerouterAdapter } from './providers/threerouter.ts'
export type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult } from './providers/types.ts'
export { createGenerateImageTool } from './tools/generate-image.ts'
export { createGenerateVideoTool } from './tools/generate-video.ts'
export {
  applyImageStyle,
  createRuntimeDefaultsStore,
  createDefaultsRouteHandler,
  DEFAULTS_ROUTE_PATH,
  IMAGE_SIZE_OPTIONS,
  IMAGE_STYLE_OPTIONS,
  parseDefaultsPatch,
  registerDefaultsRoute,
} from './runtime-defaults.ts'
export type { RuntimeDefaults, RuntimeDefaultsPatch, RuntimeDefaultsStore, RuntimeDefaultsView } from './runtime-defaults.ts'

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
  // 任务管理器：构造时通过 ctx.effect() 注册卸载清理函数，
  // 插件卸载时自动取消所有排队任务、清理轮询定时器。
  const taskManager = new TaskManager(ctx, config)

  // 运行时生成默认值：桌面 composer 热更新覆盖值的内存态存储（不落盘，
  // 重载后回落 settings 持久值，避免任何配置写入触发宿主重启）。
  const runtimeDefaults = createRuntimeDefaultsStore()

  // generate_image：显式声明 attachments 依赖。
  // callback 在 attachments 服务可用时执行，fiber-scoped 注册工具；
  // 服务撤销时 fiber dispose，工具自动注销。对齐官方 read-image 模式。
  ctx.inject(['attachments'], (imageCtx) => {
    const attachments = imageCtx.get('attachments')
    // ctx.inject 回调保证 attachments 已注入；defensive check 仅防御直接调用方
    if (!attachments) return
    // 传入插件根 ctx 供 generate_image 在 execute 内解析 llm 服务以判定图片能力门。
    imageCtx.tools.register(createGenerateImageTool({ config, taskManager, attachments, ctx, runtimeDefaults }))
  })

  // generate_video：不依赖 attachments，始终注册。
  ctx.tools.register(createGenerateVideoTool({ config, taskManager, runtimeDefaults }))

  // outputs 媒体路由：webServer 服务可用时把 outputs/ 目录以只读方式暴露给
  // 渲染进程（/outputs/<文件名>），桌面客户端 toolview 据此内嵌加载生成的
  // 视频/图片；仅回环地址注册，非 127.0.0.1 不暴露。路由注销随 fiber 卸载。
  ctx.inject(['webServer'], (mediaCtx) => {
    const webServer = mediaCtx.get('webServer') as MediaWebServer | undefined
    if (!webServer) return
    const disposeRoute = registerOutputsRoute(webServer, config.outputsDir)
    // host 非 127.0.0.1 时不注册，无路由可注销
    if (disposeRoute) mediaCtx.effect(() => disposeRoute, 'dsh-image-video: outputs media route')

    // defaults 热更新路由：桌面渲染进程同源 GET/POST /image-video/defaults，
    // composer 切换模型/比例/风格/时长立即生效（仅内存，不触发重启）；
    // 同样仅回环注册。路由注销随 fiber 卸载。
    const disposeDefaults = registerDefaultsRoute(webServer, runtimeDefaults)
    if (disposeDefaults) mediaCtx.effect(() => disposeDefaults, 'dsh-image-video: runtime defaults route')
  })
}
