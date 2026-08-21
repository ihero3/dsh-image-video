/**
 * generate_video 工具：文生视频，支持 万象（wanx）/ Seedance 服务商切换。
 * 提交任务后后台轮询直到完成，下载视频到 outputs/ 目录。
 * 视频生成耗时较长（1-5 分钟），轮询过程不产生中间输出，仅最终结果返回模型，
 * 不阻塞对话上下文。时长上限 10 秒，由 schema 与运行时双重校验。
 * @module dsh-image-video/tools/generate-video
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { Config } from '../config.ts'
import { resolveActiveProvider } from '../config.ts'
import type { TaskManager } from '../task-manager.ts'
import { wanxAdapter } from '../providers/wanx.ts'
import { seedanceAdapter } from '../providers/seedance.ts'
import { bxinleAdapter } from '../providers/bxinle.ts'
import type { VideoGenParams, HttpOpts } from '../providers/types.ts'
import { downloadAndSave, createVideoContent } from '../media.ts'

/** 视频时长上限（秒），强制规范。 */
const MAX_VIDEO_DURATION = 10

/** 工具依赖。 */
export interface GenerateVideoDeps {
  config: Config
  taskManager: TaskManager
}

/**
 * 创建 generate_video 工具定义。
 * 工具参数：prompt（必填）、duration（可选，1-10秒）、model（可选）、aspectRatio（可选）。
 */
export function createGenerateVideoTool(deps: GenerateVideoDeps) {
  const { config, taskManager } = deps

  return defineTool({
    name: 'generate_video',
    description:
      '根据文本提示词生成短视频。支持 万象wanx 和 Seedance 两种服务商，通过配置切换。'
      + `视频时长上限 ${MAX_VIDEO_DURATION} 秒。生成完成后视频保存到本地 outputs/ 目录。`
      + '参数：prompt（提示词，必填）、duration（时长秒数，1-10，可选）、model（模型名，可选）、aspectRatio（宽高比，可选）。',

    parameters: {
      prompt: {
        type: 'string',
        required: true,
        description: '描述要生成的视频内容，支持中英文。',
      },
      duration: {
        type: 'integer',
        description: `视频时长（秒），范围 1-${MAX_VIDEO_DURATION}。留空使用配置默认值。`,
      },
      model: {
        type: 'string',
        description: '指定模型名称。留空使用服务商默认模型。',
      },
      aspectRatio: {
        type: 'string',
        description: '视频宽高比，如 16:9、9:16、1:1。留空使用 16:9。',
      },
    },

    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          provider: { type: 'string', required: true },
          prompt: { type: 'string', required: true },
          duration: { type: 'integer', required: true },
          localPath: { type: 'string', required: true },
          sourceUrl: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          elapsedMs: { type: 'integer', required: true },
        },
      },
      render: (_args, value): ContentBlock[] => {
        const v = value as GenerateVideoOutput
        return createVideoContent(v.localPath, v.bytes, v.sourceUrl)
      },
    },

    async execute(args, exec) {
      const typedArgs = args as { prompt: string; duration?: number; model?: string; aspectRatio?: string }

      // 运行时双重校验时长上限（schema 已约束，此处防御性检查）
      const duration = typedArgs.duration ?? config.defaultVideoDuration
      if (duration < 1 || duration > MAX_VIDEO_DURATION) {
        throw new Error(`视频时长必须在 1-${MAX_VIDEO_DURATION} 秒之间，当前为 ${duration}`)
      }

      const { provider, apiKey, baseURL } = resolveActiveProvider(config)
      const adapter = provider === 'bxinle' ? bxinleAdapter
        : provider === 'wanx' ? wanxAdapter
        : seedanceAdapter

      const videoParams: VideoGenParams = {
        prompt: typedArgs.prompt,
        duration,
        model: typedArgs.model,
        aspectRatio: typedArgs.aspectRatio,
      }

      const httpOpts: HttpOpts = {
        apiKey,
        baseURL,
        timeoutMs: config.timeoutMs,
        retryTimes: config.retryTimes,
        signal: exec.signal,
      }

      // 提交视频生成任务（视频始终为异步）
      const submitResult = await adapter.submitVideo(videoParams, httpOpts)
      if (!submitResult.taskId) {
        throw new Error('视频任务提交失败：未返回 task_id')
      }

      // 后台轮询直到完成——轮询过程不产生中间输出，仅最终结果返回模型
      const pollResult = await taskManager.pollUntilDone(
        submitResult.taskId,
        adapter,
        httpOpts,
        exec.signal,
      )

      // 下载视频到 outputs/ 目录
      const downloadOpts = { timeoutMs: config.timeoutMs, retryTimes: config.retryTimes, signal: exec.signal }
      const saved = await downloadAndSave(pollResult.mediaUrl, config.outputsDir, '.mp4', downloadOpts)

      const output: GenerateVideoOutput = {
        provider,
        prompt: typedArgs.prompt,
        duration,
        localPath: saved.localPath,
        sourceUrl: saved.sourceUrl,
        bytes: saved.bytes,
        elapsedMs: pollResult.elapsedMs,
      }
      return output
    },

    presentCall: (args) => ({
      card: 'generic',
      title: '生成视频',
      kind: 'other',
      rawInput: args,
    }),

    // 视频生成耗时较长，设置协作式超时为轮询整体超时
    timeoutMs: config.pollTimeoutMs,
  })
}

/** generate_video 工具输出值。 */
interface GenerateVideoOutput {
  provider: string
  prompt: string
  duration: number
  localPath: string
  sourceUrl: string
  bytes: number
  elapsedMs: number
}
