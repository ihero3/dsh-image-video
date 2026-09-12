/**
 * generate_video 工具：文生视频 + 图生视频（image 首帧驱动），支持 threerouter（聚合器）/
 * 万象（wanx，百炼直连）/ MiniMax 官方平台 / Seedance（火山方舟），按模型家族自动路由。
 * 提交任务后后台轮询直到完成，下载视频到 outputs/ 目录。
 * 视频生成耗时较长（1-5 分钟），轮询过程不产生中间输出，仅最终结果返回模型，
 * 不阻塞对话上下文。时长上限 10 秒，由 schema 与运行时双重校验。
 * @module dsh-image-video/tools/generate-video
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { Config, Provider } from '../config.ts'
import { resolveProviderCredentials, peekProviderCredentials } from '../config.ts'
import type { RuntimeDefaultsStore } from '../runtime-defaults.ts'
import { resolveModelCandidates } from '../runtime-defaults.ts'
import { isModelNotAcceptedError } from '../http-client.ts'
import type { TaskManager } from '../task-manager.ts'
import { wanxAdapter } from '../providers/wanx.ts'
import { seedanceAdapter } from '../providers/seedance.ts'
import { threerouterAdapter } from '../providers/threerouter.ts'
import { minimaxAdapter } from '../providers/minimax.ts'
import type { ProviderAdapter, VideoGenParams, SubmitResult, HttpOpts } from '../providers/types.ts'
import { downloadAndSave, createVideoContent, resolveImageReference } from '../media.ts'

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
 * 工具参数：prompt（必填）、duration（可选，1-10秒）、model（可选）、aspectRatio（可选）、
 * image（可选首帧图片，传了即图生视频）、resolution（可选分辨率档位）。
 */
export function createGenerateVideoTool(deps: GenerateVideoDeps) {
  const { config, taskManager, runtimeDefaults } = deps

  return defineTool({
    name: 'generate_video',
    description:
      '根据文本提示词生成短视频；传入 image（首帧图片）时为图生视频，让图片动起来。'
      + '服务商选择：配置链服务商优先（composer 会话选定 > 配置默认服务商 > 激活服务商，默认 threerouter 聚合器）；'
      + '显式指定模型时按模型家族自动路由（minimax/hailuo→MiniMax 官方直连，wan/wanx→百炼直连，doubao/seedance/seedream→火山方舟），'
      + '候选仅在「模型不被该服务商接受」的提交错误时按序回退，threerouter 永远兜底，回退过程在结果 notes 透明注明。'
      + '模型取值：调用参数 model > 配置 defaultVideoModel > 服务商内置默认模型（threerouter 默认 minimax-h3）。'
      + '不要自行编写脚本或直接调用服务商 API。'
      + `视频时长上限 ${MAX_VIDEO_DURATION} 秒；wan 系模型不支持自定义时长，传入会被忽略并在结果 notes 注明。`
      + '生成完成后视频保存到本地 outputs/ 目录。'
      + '参数：prompt（提示词，必填）、duration（时长秒数，1-10，可选）、model（模型名，可选，留空用配置或服务商内置默认模型）、'
      + 'aspectRatio（宽高比，可选，留空 16:9；图生视频时忽略）、image（首帧图片：本地路径/URL，可选）、resolution（分辨率档位，可选，取值随模型）。',

    parameters: {
      prompt: {
        type: 'string',
        required: true,
        description: '描述要生成的视频内容，支持中英文。',
      },
      duration: {
        type: 'integer',
        description: `视频时长（秒），范围 1-${MAX_VIDEO_DURATION}。留空使用配置默认值。wan 系模型（如 wan2.2-t2v-plus）不支持自定义时长，传入将被忽略。`,
      },
      model: {
        type: 'string',
        description: '指定模型名称。留空使用服务商内置默认模型（图生视频用服务商内置 i2v 默认模型）。',
      },
      aspectRatio: {
        type: 'string',
        description: '视频宽高比，如 16:9、9:16、1:1。留空使用 16:9；图生视频时构图由首帧图片决定，此参数被忽略。',
      },
      image: {
        type: 'string',
        description: '首帧图片，用于图生视频（让图片动起来）：本地文件路径、http(s) URL 或 data URL。',
      },
      resolution: {
        type: 'string',
        description: '分辨率档位，取值由模型决定（如 MiniMax-H3：480P/768P/2K；wan 图生视频：480P/1080P）。留空使用服务商默认。',
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
          mode: { type: 'string', required: true },
          resolution: { type: 'string', required: true },
          localPath: { type: 'string', required: true },
          sourceUrl: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          elapsedMs: { type: 'integer', required: true },
          model: { type: 'string', description: '实际发给上游的模型名（含服务商内置默认），供用户核对本次到底用了哪个模型。' },
          notes: { type: 'array', items: { type: 'string' } },
        },
      },
      render: (_args, value): ContentBlock[] => {
        const v = value as GenerateVideoOutput
        return createVideoContent(v.localPath, v.bytes, v.sourceUrl, {
          provider: v.provider,
          model: v.model,
          mode: v.mode,
          duration: v.duration,
          resolution: v.resolution,
          ...(v.notes ? { notes: v.notes } : {}),
        })
      },
      // UI-only 通道：与 generate_image 一致，把展示字段经 tool/result 事件持久化到
      // ToolResultNode.meta，桌面客户端 keyed toolview 据此内嵌视频播放器；对模型不可见。
      presentationMeta: (_args, value) => {
        const v = value as GenerateVideoOutput
        return {
          provider: v.provider,
          model: v.model,
          prompt: v.prompt,
          duration: v.duration,
          localPath: v.localPath,
          sourceUrl: v.sourceUrl,
          bytes: v.bytes,
          ...(v.notes ? { notes: v.notes } : {}),
        }
      },
    },

    async execute(args, exec) {
      const typedArgs = args as {
        prompt: string
        duration?: number
        model?: string
        aspectRatio?: string
        image?: string
        resolution?: string
      }

      // 参数兜底优先级：工具显式参数 > composer 运行时覆盖值 > settings 持久值。
      // 运行时双重校验时长上限（schema 已约束，此处防御性检查）
      const runtime = runtimeDefaults.get()
      const duration = typedArgs.duration ?? runtime.videoDuration ?? config.defaultVideoDuration
      if (duration < 1 || duration > MAX_VIDEO_DURATION) {
        throw new Error(`视频时长必须在 1-${MAX_VIDEO_DURATION} 秒之间，当前为 ${duration}`)
      }

      // 服务商选择：构建候选序列——配置链优先（composer 覆盖 > settings 默认 > 激活
      // 服务商）→ 显式 model 命中家族规则的直连商 → threerouter 聚合器兜底；
      // 未配置 key 的候选自动跳过，全部候选均无凭证时响亮报错。
      const preferred: Provider | undefined = runtime.videoProvider
        ?? (config.defaultVideoProvider === '' ? undefined : config.defaultVideoProvider)
      const candidates = resolveModelCandidates(
        'video',
        typedArgs.model,
        preferred ?? config.provider,
        (p) => peekProviderCredentials(config, p).apiKey.trim().length > 0,
      )
      if (candidates.length === 0) {
        throw new Error('dsh-image-video：没有任何已配置 API Key 的服务商，请至少为一个服务商配置 apiKey')
      }
      const adapterFor = (p: Provider): ProviderAdapter => p === 'threerouter' ? threerouterAdapter
        : p === 'wanx' ? wanxAdapter
        : p === 'minimax' ? minimaxAdapter
        : seedanceAdapter

      // 本地路径在此解析为 data URL，适配器只接收 URL / data URL
      const imageRef = typedArgs.image ? await resolveImageReference(typedArgs.image) : undefined
      // 模型取值链：调用参数 model > 配置 defaultVideoModel > adapter 内置默认
      const model = typedArgs.model || config.defaultVideoModel || undefined

      const videoParams: VideoGenParams = {
        prompt: typedArgs.prompt,
        duration,
        model,
        // 文档承诺「留空使用 16:9」在此落地：MiniMax 等上游纯文生场景要求显式 ratio
        aspectRatio: typedArgs.aspectRatio || runtime.videoAspectRatio || '16:9',
        image: imageRef,
        resolution: typedArgs.resolution,
      }

      // 按候选序提交：仅在「模型不被该服务商接受」类提交错误时回退下一候选
      // （鉴权/配额/网络/超时立即响亮失败，不掩盖配置错误；拿到 taskId 之后的
      // 任何失败一律不回退，绝不重复生成、双重扣费）。回退链写入 notes 透明告知。
      let provider: Provider | undefined
      let adapter: ProviderAdapter | undefined
      let httpOpts: HttpOpts | undefined
      let submitResult: SubmitResult | undefined
      const fallbackNotes: string[] = []
      let lastError: unknown
      for (const candidate of candidates) {
        const creds = resolveProviderCredentials(config, candidate)
        const candidateAdapter = adapterFor(candidate)
        const candidateOpts: HttpOpts = {
          apiKey: creds.apiKey,
          baseURL: creds.baseURL,
          timeoutMs: config.timeoutMs,
          retryTimes: config.retryTimes,
          signal: exec.signal,
        }
        try {
          submitResult = await candidateAdapter.submitVideo(videoParams, candidateOpts)
          provider = candidate
          adapter = candidateAdapter
          httpOpts = candidateOpts
          break
        } catch (err) {
          if (!isModelNotAcceptedError(err)) throw err
          lastError = err
          fallbackNotes.push(`${candidate} 不接受该模型（${err instanceof Error ? err.message.slice(0, 120) : String(err)}）`)
        }
      }
      if (!submitResult || !provider || !adapter || !httpOpts) {
        throw lastError instanceof Error ? lastError : new Error(`视频提交失败：所有候选服务商均不接受模型 ${model ?? '（服务商默认）'}`)
      }
      if (!submitResult.taskId) {
        throw new Error('视频任务提交失败：未返回 task_id')
      }

      // 透明告知 notes：wan 系 duration 丢弃 + 候选回退链（无降级时为空数组，不输出）
      // 实际模型以适配器回报为准（含服务商内置默认兜底），避免用配置推断模型。
      const actualModel = submitResult.model ?? model ?? ''
      const notes: string[] = []
      if (submitResult.droppedDuration) {
        notes.push(`当前模型 ${actualModel || '（服务商内置默认）'} 不支持自定义时长，已忽略 duration=${duration} 秒，实际时长由上游模型默认决定`)
      }
      if (fallbackNotes.length > 0) {
        notes.push(`模型自动路由回退：${fallbackNotes.join('；')}；最终由 ${provider} 提交`)
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
        mode: imageRef ? 'image-to-video' : 'text-to-video',
        resolution: typedArgs.resolution ?? '',
        model: actualModel,
        localPath: saved.localPath,
        sourceUrl: saved.sourceUrl,
        bytes: saved.bytes,
        elapsedMs: pollResult.elapsedMs,
        ...(notes.length > 0 ? { notes } : {}),
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
  /** 生成模式：image-to-video（图生视频）或 text-to-video（文生视频）。 */
  mode: 'image-to-video' | 'text-to-video'
  /** 请求携带的分辨率档位；未指定为空字符串。 */
  resolution: string
  /** 实际发给上游的模型名（含服务商内置默认），逐次调用如实回报。 */
  model: string
  localPath: string
  sourceUrl: string
  bytes: number
  elapsedMs: number
  /** 透明告知：模型能力导致的参数降级说明（如 wan 系模型丢弃自定义时长）；无降级时缺省。 */
  notes?: string[]
}
