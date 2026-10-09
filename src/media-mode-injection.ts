/**
 * 媒体模式指令注入：composer 切到「图片」/「视频」tab 时，`mediaMode` 覆盖值只
 * 影响生成工具的取参链，模型本身仍会把「中秋节快乐」当普通聊天。本模块在用户轮次
 * 进入模型请求前追加一条插件来源的上下文消息，明确要求模型直接调用
 * generate_image / generate_video，并列出当前生效参数。
 *
 * 注入点选 `agent/pre-step`（waterfall）：本监听先 `await next()` 取到循环原本的
 * 决策，只在成功进入且本步确实带来新的用户输入时，把指令消息追加到末尾——因此
 * 多步工具循环不会重复注入。注册用 `prepend: true`（与 time-context 同型），使本
 * 监听位于链最外层，追加的消息落在其他监听重建 `messages` 之后而不会被丢弃。消息
 * source 以本模块自己的 kind + `form: 'snapshot'` 声明（`MessageSourceMap` 可合并
 * 扩展，没有通用 plugin kind），满足「Model-visible ⟺ logged」。
 *
 * 子代理排除：subagent 的初始任务消息同样以 `kind: 'user'` 投递，若不排除，进入
 * 图片/视频模式后所有子代理都会被要求「只生成图片」。
 *
 * @module dsh-image-video/media-mode-injection
 */

import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextFormed, UserMessage } from '@deepseek-ai/dsh-llm'
import { IMAGE_STYLE_OPTIONS, resolveDefaultsView } from './runtime-defaults.ts'
import type { PersistedDefaultsView, RuntimeDefaultsStore, RuntimeDefaultsView } from './runtime-defaults.ts'

/** 摘要在 log 中的 section 名，同时也是注入消息的来源标识。 */
const INJECTION_SECTION_NAME = 'image-video.media-mode'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'image-video.media-mode': { kind: 'image-video.media-mode' } & ContextFormed
  }
}

/**
 * 渲染当前媒体模式对应的模型指令。工具会按「显式参数 > 运行时覆盖 > settings 持久
 * 默认 > 内置默认」取参，故指令要求模型不要抢先传生成参数，让 composer 选的生效值
 * 真正落实。
 * @param view - 当前生效的默认值视图（{@link resolveDefaultsView}）。
 * @returns 指令文本；'text' 模式或不认识的模式返回 undefined（不注入）。
 */
export function renderMediaModeInstruction(view: RuntimeDefaultsView): string | undefined {
  if (view.mediaMode === 'image') {
    const size = view.imageSize ?? '工具默认'
    const style = IMAGE_STYLE_OPTIONS.find((option) => option.id === (view.imageStyle ?? ''))?.label ?? '自动'
    return [
      '【图片生成模式】用户已把输入框切到「图片」模式：请直接调用 generate_image 生成图片，不要只回复文字。',
      '把用户本条消息本身作为 prompt；即使消息只是问候或祝福（例如「中秋节快乐」），也请据此构思画面并立即生成。',
      `用户未另行指定时不要传 size / model 参数，让当前生效参数（尺寸：${size}；风格：${style}）生效。`,
    ].join('')
  }
  if (view.mediaMode === 'video') {
    const aspectRatio = view.videoAspectRatio ?? '工具默认'
    const duration = view.videoDuration === null ? '工具默认' : `${view.videoDuration} 秒`
    return [
      '【视频生成模式】用户已把输入框切到「视频」模式：请直接调用 generate_video 生成视频，不要只回复文字。',
      '把用户本条消息本身作为 prompt；即使消息只是问候或祝福（例如「中秋节快乐」），也请据此构思画面并立即生成。',
      `用户未另行指定时不要传 aspectRatio / duration / model 参数，让当前生效参数（宽高比：${aspectRatio}；时长：${duration}）生效。`,
    ].join('')
  }
  return undefined
}

/** {@link registerMediaModeInjection} 的依赖。 */
export interface MediaModeInjectionOptions {
  /** 运行时默认值存储（composer 覆盖值）。 */
  readonly store: RuntimeDefaultsStore
  /** settings 持久默认回落层，与 defaults 路由共用同一取值口径。 */
  readonly persisted: PersistedDefaultsView
}

/**
 * 注册 `agent/pre-step` 监听：媒体模式为 image / video 时，在纳入本步的消息之后
 * 追加一条插件来源的指令消息。监听器挂载在插件根上下文，按 scope-filtered 分发
 * 语义接收每个 agent 的事件；注销随持有本上下文的 fiber 卸载。
 * @param ctx - 已注入 `agents` 的上下文。
 * @param options - 运行时默认值存储与持久回落层。
 */
export function registerMediaModeInjection(ctx: Context, options: MediaModeInjectionOptions): void {
  const { store, persisted } = options
  ctx.on('agent/pre-step', async ({ agent, messages, signal }, next): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted) return decision
    // 子代理的任务投递同样是 kind: 'user'，不能把主会话的选择带进子代理
    if (agent.session.header.origin === 'subagent') return decision
    // 只在本步确实带来新的用户输入时注入：工具循环的后续步不会重复追加
    if (!messages.some((message: UserMessage) => message.source.kind === 'user')) return decision
    const text = renderMediaModeInstruction(resolveDefaultsView(store, persisted))
    if (text === undefined) return decision
    return {
      ...decision,
      messages: [
        ...decision.messages,
        createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: INJECTION_SECTION_NAME, form: 'snapshot', sections: [{ name: INJECTION_SECTION_NAME, text }] },
        }),
      ],
    }
  }, { prepend: true })
}
