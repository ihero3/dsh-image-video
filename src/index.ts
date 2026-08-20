/**
 * dsh-image-video — DeepSeek Harness 插件：文生图与文生视频工具。
 *
 * 注册两个模型可调用工具：
 *   - `generate_image`：文生图，支持 Kling / Seedance2.5 切换，结果内嵌对话并落地 outputs/
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
import { TaskManager } from './task-manager.ts'
import { createGenerateImageTool } from './tools/generate-image.ts'
import { createGenerateVideoTool } from './tools/generate-video.ts'

export { Config } from './config.ts'
export type { Config as ConfigType, Provider, ProviderCredentials } from './config.ts'
export { TaskManager } from './task-manager.ts'
export { GenerationError } from './http-client.ts'
export type { ErrorKind, RequestOptions, RequestResult } from './http-client.ts'
export { klingAdapter } from './providers/kling.ts'
export { seedanceAdapter } from './providers/seedance.ts'
export type { ProviderAdapter, ImageGenParams, VideoGenParams, SubmitResult, TaskQueryResult } from './providers/types.ts'
export { createGenerateImageTool } from './tools/generate-image.ts'
export { createGenerateVideoTool } from './tools/generate-video.ts'

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

  // generate_image：显式声明 attachments 依赖。
  // callback 在 attachments 服务可用时执行，fiber-scoped 注册工具；
  // 服务撤销时 fiber dispose，工具自动注销。对齐官方 read-image 模式。
  ctx.inject(['attachments'], (imageCtx) => {
    const attachments = imageCtx.get('attachments')
    // ctx.inject 回调保证 attachments 已注入；defensive check 仅防御直接调用方
    if (!attachments) return
    imageCtx.tools.register(createGenerateImageTool({ config, taskManager, attachments }))
  })

  // generate_video：不依赖 attachments，始终注册。
  ctx.tools.register(createGenerateVideoTool({ config, taskManager }))
}
