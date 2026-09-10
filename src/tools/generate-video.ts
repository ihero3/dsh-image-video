/**
 * generate_video 工具：文生视频，支持 万象（wanx）/ Seedance 服务商切换。
 * 提交任务后后台轮询直到完成，下载视频到 outputs/ 目录。
 * 视频生成耗时较长（1-5 分钟），轮询过程不产生中间输出，仅最终结果返回模型，
 * 不阻塞对话上下文。时长上限 10 秒，由 schema 与运行时双重校验。
 * @module dsh-image-video/tools/generate-video
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { Config, Provider } from '../config.ts'
import { resolveProviderCredentials } from '../config.ts'
import type { RuntimeDefaultsStore } from '../runtime-defaults.ts'
import { resolveModelProvider } from '../runtime-defaults.ts'
import type { TaskManager } from '../task-manager.ts'
import { wanxAdapter } from '../providers/wanx.ts'
import { seedanceAdapter } from '../providers/seedance.ts'
import { threerouterAdapter } from '../providers/threerouter.ts'
import type { VideoGenParams, HttpOpts } from '../providers/types.ts'
import { downloadAndSave, createVideoContent } from '../media.ts'

/** 视频时长上限（秒），强制规范。 */
const MAX_VIDEO_DURATION = 10

/** 工具依赖。 */
export interface GenerateVideoDeps {
  config: Config
  taskManager: TaskManager
  /** 运行时默认值存储：composer 热更新覆盖值优先于 settings 持久值。 */
  runtimeDefaults: RuntimeDefaultsStore
}

/**
 * 创建 generate_video 工具定义。
 * 工具参数：prompt（必填）、duration（可选，1-10秒）、model（可选）、aspectRatio（可选）。
 */
export function createGenerateVideoTool(deps: GenerateVideoDeps) {
  const { config, taskManager, runtimeDefaults } = deps

  return defineTool({
    name: 'generate_video',
    description:
      '根据文本提示词生成短视频。服务商选择：指定模型属于某服务商映射时用该服务商（其凭证直连），'
      + '否则依次取 composer 会话选定的服务商、配置默认服务商、激活服务商（默认 threerouter），'
      + '由所选服务商的内置默认模型出片。'
      + '不要自行编写脚本或直接调用服务商 API。'
      + `视频时长上限 ${MAX_VIDEO_DURATION} 秒。生成完成后视频保存到本地 outputs/ 目录。`
      + '参数：prompt（提示词，必填）、duration（时长秒数，1-10，可选）、model（模型名，可选，留空用服务商内置默认模型）、aspectRatio（宽高比，可选）。',

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
      // UI-only 通道：与 generate_image 一致，把展示字段经 tool/result 事件持久化到
      // ToolResultNode.meta，桌面客户端 keyed toolview 据此内嵌视频播放器；对模型不可见。
      presentationMeta: (_args, value) => {
        const v = value as GenerateVideoOutput
        return {
          provider: v.provider,
          prompt: v.prompt,
          duration: v.duration,
          localPath: v.localPath,
          sourceUrl: v.sourceUrl,
          bytes: v.bytes,
        }
      },
    },

    async execute(args, exec) {
      const typedArgs = args as { prompt: string; duration?: number; model?: string; aspectRatio?: string }

      // 参数兜底优先级：工具显式参数 > composer 运行时覆盖值 > settings 持久值。
      // 运行时双重校验时长上限（schema 已约束，此处防御性检查）
      const runtime = runtimeDefaults.get()
      const duration = typedArgs.duration ?? runtime.videoDuration ?? config.defaultVideoDuration
      if (duration < 1 || duration > MAX_VIDEO_DURATION) {
        throw new Error(`视频时长必须在 1-${MAX_VIDEO_DURATION} 秒之间，当前为 ${duration}`)
      }

      const model = typedArgs.model

      // 服务商选择：显式 model 参数命中模型映射 → 按模型路由（用其凭证直连）；
      // 否则依次跟随 composer 运行时覆盖的服务商、settings 默认服务商、激活
      // 服务商，由所选 adapter 使用其内置默认模型出片。
      const routed = model !== undefined ? resolveModelProvider('video', model) : undefined
      const preferred: Provider | undefined = runtime.videoProvider
        ?? (config.defaultVideoProvider === '' ? undefined : config.defaultVideoProvider)
      const { provider, apiKey, baseURL } = resolveProviderCredentials(config, routed ?? preferred ?? config.provider)
      const adapter = provider === 'threerouter' ? threerouterAdapter
        : provider === 'wanx' ? wanxAdapter
        : seedanceAdapter

      const videoParams: VideoGenParams = {
        prompt: typedArgs.prompt,
        duration,
        model,
        aspectRatio: typedArgs.aspectRatio || runtime.videoAspectRatio || undefined,
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
