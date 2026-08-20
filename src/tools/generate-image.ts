/**
 * generate_image 工具：文生图，支持 Kling / Seedance 服务商切换。
 * 提交任务后轮询直到完成（异步服务商）或直接获取结果（同步服务商），
 * 下载图片到 outputs/，通过 attachment 服务内嵌渲染在对话中。
 * @module dsh-image-video/tools/generate-image
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { ImageAttachmentRef, AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { Config } from '../config.ts'
import { resolveActiveProvider } from '../config.ts'
import type { TaskManager } from '../task-manager.ts'
import { klingAdapter } from '../providers/kling.ts'
import { seedanceAdapter } from '../providers/seedance.ts'
import type { ImageGenParams, HttpOpts } from '../providers/types.ts'
import { downloadAndSave, createImageContent } from '../media.ts'

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
      '根据文本提示词生成图片。支持 Kling（阿里云百炼）和 Seedance（火山引擎）两种服务商，'
      + '通过配置切换。生成完成后图片内嵌显示在对话中并保存到本地 outputs/ 目录。'
      + '参数：prompt（提示词，必填）、size（尺寸如 1024x1024，可选）、model（模型名，可选）。',

    parameters: {
      prompt: {
        type: 'string',
        required: true,
        description: '描述要生成的图片内容，支持中英文。',
      },
      size: {
        type: 'string',
        description: '图片尺寸，如 1024x1024、1280x720。留空使用配置默认值。',
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
            description: '内嵌图片附件引用，存在时对话中直接渲染图片。',
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
      render: (_args, value): ContentBlock[] => {
        const v = value as GenerateImageOutput
        if (v.image) {
          // 构造内嵌图片块，attachment 服务已持久化字节
          return [{ type: 'image', attachment: v.image as unknown as ImageAttachmentRef }]
        }
        return [{ type: 'text', text: `图片已生成并保存到本地：${v.localPath}（服务商：${v.provider}）` }]
      },
    },

    async execute(args, exec) {
      const typedArgs = args as { prompt: string; size?: string; model?: string }
      const { provider, apiKey, baseURL } = resolveActiveProvider(config)
      const adapter = provider === 'kling' ? klingAdapter : seedanceAdapter

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

      // 通过 attachment 服务内嵌渲染（复用已下载的字节，避免二次请求）。
      // attachments 已在工具构造时注入，此处直接使用，不做运行时解析。
      let imageRef: ImageAttachmentRef | undefined
      const contentBlocks = await createImageContent(attachments, saved.data, saved.contentType, 'generated-image')
      const imageBlock = contentBlocks.find((b): b is { type: 'image'; attachment: ImageAttachmentRef } => b.type === 'image')
      if (imageBlock) imageRef = imageBlock.attachment

      const output: GenerateImageOutput = {
        provider,
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
