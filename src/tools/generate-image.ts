/**
 * generate_image 工具：文生图，支持 万象（wanx）/ Seedance 服务商切换。
 * 提交任务后轮询直到完成（异步服务商）或直接获取结果（同步服务商），
 * 下载图片到 outputs/，附件字节经 attachment 服务持久化，
 * 附件引用通过 presentationMeta 走 UI-only 通道，模型只见文本摘要。
 * @module dsh-image-video/tools/generate-image
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-llm'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef, ImageMediaType, AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { Config } from '../config.ts'
import { resolveActiveProvider } from '../config.ts'
import type { TaskManager } from '../task-manager.ts'
import { wanxAdapter } from '../providers/wanx.ts'
import { seedanceAdapter } from '../providers/seedance.ts'
import type { ImageGenParams, HttpOpts } from '../providers/types.ts'
import { downloadAndSave, saveImageAttachment, createImageSummaryText } from '../media.ts'

/**
 * 工具依赖：配置、任务管理器、attachment 服务实例。
 * `attachments` 由 `apply()` 通过 `ctx.inject(['attachments'], cb)` 在注册时注入，
 * 不在执行体内部运行时 `ctx.get` 读取——依赖关系在构造时即明确。
 */
export interface GenerateImageDeps {
  config: Config
  taskManager: TaskManager
  attachments: AttachmentStore
  ctx: Context
}

/**
 * 判断当前调用路由是否声明支持图片输入，与官方 read_image 的能力门一致：
 * 解析会话当前 provider/model 后经 llm 服务读取输入模态。任何环节缺服务或
 * 解析失败都视为「不支持」，从而回退纯文本摘要——绝不向纯文本模型注入 image
 * 块触发网关 400。@param ctx 插件上下文。@param exec 工具执行上下文。
 * @returns 路由是否声明了 image 输入模态。
 */
async function routeAcceptsImages(ctx: Context, exec: ToolExecution): Promise<boolean> {
  const routed = exec.agent?.session.requestHeader()?.config
  const provider = routed?.provider ?? exec.agent?.options.provider
  const model = routed?.model ?? exec.agent?.options.model
  const llm = ctx.get('llm')
  if (provider === undefined || model === undefined || llm === undefined) return false
  try {
    const info = await llm.resolveModelInfo(provider, model, exec.signal)
    return info.inputModalities?.includes('image') === true
  } catch {
    return false
  }
}

/**
 * 把工具输出里的 image 字段重建为 attachment 持久化引用，供 `image` 内容块携带。
 * execute 返回的是 schema 校验后的明文对象（attachmentId 为字符串），此处补上品牌化 ID
 * 并还原为 durable 引用，与官方 read_image 的 imageRefFromValue 保持一致。
 */
function imageAttachmentRef(image: NonNullable<GenerateImageOutput['image']>): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(image.attachmentId),
    mediaType: image.mediaType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    ...image.name === undefined ? {} : { name: image.name },
  }
}

/**
 * 创建 generate_image 工具定义。
 * 工具参数：prompt（必填）、size（可选）、model（可选）。
 */
export function createGenerateImageTool(deps: GenerateImageDeps) {
  const { config, taskManager, attachments, ctx } = deps

  return defineTool({
    name: 'generate_image',
    description:
      '根据文本提示词生成图片。支持 万象wanx（阿里云百炼）和 Seedance（火山引擎）两种服务商，'
      + '通过配置切换。生成完成后图片保存到本地 outputs/ 目录（对话内附图片附件）。'
      + '参数：prompt（提示词，必填）、size（尺寸如 1024*1024，可选）、model（模型名，可选）。',

    parameters: {
      prompt: {
        type: 'string',
        required: true,
        description: '描述要生成的图片内容，支持中英文。',
      },
      size: {
        type: 'string',
        description: '图片尺寸，如 1024*1024、1280*720。留空使用配置默认值。',
      },
      model: {
        type: 'string',
        description: '指定模型名称。留空使用服务商默认模型。',
      },
    },

    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          provider: { type: 'string', required: true },
          prompt: { type: 'string', required: true },
          localPath: { type: 'string', required: true },
          sourceUrl: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          image: {
            type: 'object',
            additionalProperties: false,
            description: '内嵌图片附件引用。路由支持图片输入时 render 一并注入 image 块使对话内嵌显示；否则仅返回文本摘要。',
            properties: {
              attachmentId: { type: 'string', required: true },
              mediaType: { type: 'string', enum: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], required: true },
              bytes: { type: 'integer', required: true },
              width: { type: 'integer', required: true },
              height: { type: 'integer', required: true },
              name: { type: 'string' },
            },
          },
        },
      },
      // 模型可见内容：文本摘要 +（当 execute 判定路由支持图片输入时）一个 image 块。
      // image 块携带 attachment 持久化引用，前端经现有消息图片渲染内嵌显示，与官方
      // read_image 一致；纯文本模型（如 deepseek-v4-flash）不注入 image 块，避免 LLM
      // 适配器序列化成 image_url 后网关 400（unknown variant `image_url`）。
      render: (_args, value): ContentBlock[] => {
        const v = value as GenerateImageOutput
        const content = createImageSummaryText({
          provider: v.provider,
          localPath: v.localPath,
          bytes: v.bytes,
          ...v.image === undefined ? {} : { width: v.image.width, height: v.image.height },
        })
        if (v.image !== undefined) {
          content.push({ type: 'image', attachment: imageAttachmentRef(v.image) })
        }
        return content
      },
      // UI-only 通道：持久化到 tool/result 事件的 meta 字段，客户端 ToolResultNode.meta
      // 可消费它内嵌渲染图片，但绝不进入模型请求上下文（Model-visible ⟺ logged 的反向：
      // 持久化 ≠ 模型可见）。
      presentationMeta: (_args, value) => {
        const v = value as GenerateImageOutput
        return {
          provider: v.provider,
          prompt: v.prompt,
          localPath: v.localPath,
          sourceUrl: v.sourceUrl,
          bytes: v.bytes,
          ...v.image === undefined ? {} : { image: v.image },
        }
      },
    },

    async execute(args, exec) {
      const typedArgs = args as { prompt: string; size?: string; model?: string }
      // bxinle 仅支持视频；图片生成回退到 wanx，需用 wanx 凭证
      const resolved = resolveActiveProvider(config)
      const imageProvider = resolved.provider === 'bxinle' ? 'wanx' : resolved.provider
      const apiKey = imageProvider === 'wanx' ? config.wanx.apiKey : config.seedance.apiKey
      const baseURL = imageProvider === 'wanx'
        ? (config.wanx.baseURL?.trim() || 'https://dashscope.aliyuncs.com/api/v1')
        : (config.seedance.baseURL?.trim() || 'https://ark.cn-beijing.volces.com/api/v3')
      const adapter = imageProvider === 'wanx' ? wanxAdapter : seedanceAdapter

      const imageParams: ImageGenParams = {
        prompt: typedArgs.prompt,
        size: typedArgs.size ?? config.defaultImageSize,
        model: typedArgs.model,
      }

      const httpOpts: HttpOpts = {
        apiKey,
        baseURL,
        timeoutMs: config.timeoutMs,
        retryTimes: config.retryTimes,
        signal: exec.signal,
      }

      // 提交任务
      const submitResult = await adapter.submitImage(imageParams, httpOpts)

      let mediaUrl: string
      if (submitResult.async && submitResult.taskId) {
        // 异步：轮询直到完成
        const pollResult = await taskManager.pollUntilDone(
          submitResult.taskId,
          adapter,
          { ...httpOpts, signal: exec.signal },
          exec.signal,
        )
        mediaUrl = pollResult.mediaUrl
      } else {
        // 同步：直接使用返回的 URL
        mediaUrl = submitResult.mediaUrl ?? ''
      }
      if (!mediaUrl) throw new Error('生成失败：未获取到图片 URL')

      // 下载并保存到 outputs/，扩展名由下载返回的 Content-Type 自动推断
      const downloadOpts = { timeoutMs: config.timeoutMs, retryTimes: config.retryTimes, signal: exec.signal }
      const saved = await downloadAndSave(mediaUrl, config.outputsDir, '.png', downloadOpts)

      // 通过 attachment 服务持久化字节（复用已下载的字节，避免二次请求），
      // 附件引用供 presentationMeta 走 UI-only 通道，不进入模型上下文。
      // attachments 已在工具构造时注入，此处直接使用，不做运行时解析。
      let imageRef: ImageAttachmentRef | undefined
      imageRef = await saveImageAttachment(attachments, saved.data, saved.contentType, 'generated-image')

      // 判定调用路由是否声明图片输入：支持才注入 image 块（前端内嵌显示），否则仅文本摘要。
      const imageInline = await routeAcceptsImages(ctx, exec)
      const output: GenerateImageOutput = {
        provider: imageProvider,
        prompt: typedArgs.prompt,
        localPath: saved.localPath,
        sourceUrl: saved.sourceUrl,
        bytes: saved.bytes,
        ...imageInline && imageRef !== undefined ? { image: imageRef as GenerateImageOutput['image'] } : {},
      }
      return output
    },

    presentCall: (args) => ({
      card: 'generic',
      title: '生成图片',
      kind: 'other',
      rawInput: args,
    }),

    timeoutMs: config.pollTimeoutMs,
  })
}

/** generate_image 工具输出值。 */
interface GenerateImageOutput {
  provider: string
  prompt: string
  localPath: string
  sourceUrl: string
  bytes: number
  image?: {
    attachmentId: string
    mediaType: ImageMediaType
    bytes: number
    width: number
    height: number
    name?: string
  }
}
