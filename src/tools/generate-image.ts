/**
 * generate_image 工具：文生图，支持 万象（wanx）/ Seedance 服务商切换。
 * 提交任务后轮询直到完成（异步服务商）或直接获取结果（同步服务商），
 * 下载图片到 outputs/，附件字节经 attachment 服务持久化，
 * 附件引用通过 presentationMeta 走 UI-only 通道，模型只见文本摘要。
 * @module dsh-image-video/tools/generate-image
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { ImageAttachmentRef, AttachmentStore } from '@deepseek-ai/dsh-attachment'
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
}

/**
 * 创建 generate_image 工具定义。
 * 工具参数：prompt（必填）、size（可选）、model（可选）。
 */
export function createGenerateImageTool(deps: GenerateImageDeps) {
  const { config, taskManager, attachments } = deps

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
            description: '内嵌图片附件引用（经 presentationMeta 持久化为 UI 专用数据，不进入模型上下文）。',
            properties: {
              attachmentId: { type: 'string' },
              mediaType: { type: 'string' },
              bytes: { type: 'integer' },
              width: { type: 'integer' },
              height: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      },
      // 模型可见内容为纯文本：图片附件引用只经 presentationMeta 走 UI 通道持久化，
      // 不注入工具结果内容。纯文本模型（如 deepseek-v4-flash）无法接收 image 块——
      // LLM 适配器会把 image 块序列化成 image_url 发送，不支持图片输入的网关会直接
      // 400（unknown variant `image_url`），导致生成图片后的下一轮请求失败。
      render: (_args, value): ContentBlock[] => {
        const v = value as GenerateImageOutput
        return createImageSummaryText({
          provider: v.provider,
          localPath: v.localPath,
          bytes: v.bytes,
          ...v.image === undefined ? {} : { width: v.image.width, height: v.image.height },
        })
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

      const output: GenerateImageOutput = {
        provider: imageProvider,
        prompt: typedArgs.prompt,
        localPath: saved.localPath,
        sourceUrl: saved.sourceUrl,
        bytes: saved.bytes,
        image: imageRef as GenerateImageOutput['image'],
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
    mediaType: string
    bytes: number
    width: number
    height: number
    name?: string
  }
}
