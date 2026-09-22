/**
 * generate_video 工具：文生视频 + 图生视频（image 首帧驱动），支持 threerouter（聚合器）/
 * 万象（wanx，百炼直连）/ MiniMax 官方平台 / Seedance（火山方舟），按模型家族自动路由。
 * 提交任务后后台轮询直到完成，下载视频到 outputs/ 目录。
 * 视频生成耗时较长（1-5 分钟），轮询过程不产生中间输出，仅最终结果返回模型，
 * 不阻塞对话上下文。时长上限 30 秒，由 schema 与运行时双重校验。
 * @module dsh-image-video/tools/generate-video
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { Config, Provider } from '../config.ts'
import { resolveProviderCredentials, peekProviderCredentials } from '../config.ts'
import type { RuntimeDefaultsStore } from '../runtime-defaults.ts'
import { resolveModelCandidates, MULTI_FRAME_CAPABLE_MODELS, REFERENCE_VIDEO_CAPABLE_MODELS } from '../runtime-defaults.ts'
import { isModelNotAcceptedError } from '../http-client.ts'
import type { TaskManager } from '../task-manager.ts'
import { wanxAdapter } from '../providers/wanx.ts'
import { seedanceAdapter } from '../providers/seedance.ts'
import { threerouterAdapter } from '../providers/threerouter.ts'
import { minimaxAdapter } from '../providers/minimax.ts'
import type { ProviderAdapter, VideoGenParams, SubmitResult, HttpOpts } from '../providers/types.ts'
import type { VideoMediaInput } from '../media.ts'
import { downloadAndSave, createVideoContent, resolveImageReference, compressVideoFirstFrame, resolveVideoMedia } from '../media.ts'

/** 视频时长上限（秒），强制规范。 */
const MAX_VIDEO_DURATION = 30

/** 工具依赖。 */
export interface GenerateVideoDeps {
  config: Config
  taskManager: TaskManager
  /** 运行时默认值存储：composer 热更新覆盖值优先于 settings 持久值。 */
  runtimeDefaults: RuntimeDefaultsStore
  /**
   * 已解析为绝对路径的 outputsDir（插件唯一解析点，见 index.apply）。
   * 与图片链路共用同一个目录，杜绝旁路产物；缺省时回退 config.outputsDir。
   */
  outputsDir?: string
}

/**
 * 创建 generate_video 工具定义。
 * 工具参数：prompt（必填）、duration（可选，1-10秒）、model（可选）、aspectRatio（可选）、
 * image（可选首帧图片，传了即图生视频）、resolution（可选分辨率档位）。
 */
export function createGenerateVideoTool(deps: GenerateVideoDeps) {
  const { config, taskManager, runtimeDefaults } = deps
  const outputsDir = deps.outputsDir ?? config.outputsDir

  return defineTool({
    name: 'generate_video',
    description:
      '根据文本提示词生成短视频；传入 image（首帧图片）时为图生视频，让图片动起来。'
      + '服务商选择：配置链服务商优先（composer 会话选定 > 配置默认服务商 > 激活服务商，默认 threerouter 聚合器）；'
      + '视频生成固定通过 ThreeRouter 提交（项目约定，禁止切换到 OpenArt 或其他直连服务商），'
      + '不使用任何其他服务商回退。'
      + '模型取值：调用参数 model > 配置 defaultVideoModel > 多关键帧自动路由 > 服务商内置默认模型（threerouter 默认 minimax-h3）。'
      + '不要自行编写脚本或直接调用服务商 API。'
      + `视频时长上限 ${MAX_VIDEO_DURATION} 秒；具体模型能力由上游校验，wan 系模型不支持自定义时长时会在结果 notes 注明。`
      + '生成完成后视频保存到本地 outputs/ 目录。'
      + '参数：prompt（提示词，必填）、duration（时长秒数，1-30；传 -1 表示保持参考视频原时长/由模型智能决定）、model（模型名，可选，留空用配置或服务商内置默认模型）、'
      + 'aspectRatio（宽高比，可选，留空 16:9；图生视频时忽略，多关键帧时也忽略，参考视频时默认 adaptive 保持原片比例）、image（首帧图片：本地路径/URL，可选，单图时用）、'
      + 'media（参考素材序列：数组，每项含 image 路径/URL 或 video 路径/URL，可带 type 与 position；'
      + '传 video 即「视频编辑」——把参考视频交给 wan3.0-video，配合提示词里的编辑意图（如"替换""改成""去掉"）改内容而保留原片动作，'
      + '此时 model 缺省为 wan3.0-video、ratio 缺省 adaptive、duration 缺省 -1；适用于 MiniMax-H3 / wan3.0-video，此时 image 字段忽略）、resolution（分辨率档位，可选，取值随模型）。',

    parameters: {
      prompt: {
        type: 'string',
        required: true,
        description: '描述要生成的视频内容，支持中英文。',
      },
      duration: {
        type: 'integer',
        description: `视频时长（秒），范围 1-${MAX_VIDEO_DURATION}；传 -1 表示保持参考视频原时长（参考视频未指定时自动取 -1）。`
          + '留空使用配置默认值。具体模型能力由上游校验。',
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
        description: '首帧图片，用于图生视频（让图片动起来）：本地文件路径、http(s) URL 或 data URL。单图时用，与 media 二选一。',
      },
      media: {
        type: 'array',
        description: '参考素材序列（MiniMax-H3 / wan3.0-video）：每项为 {image|video, type?, position?}，适配器转换为服务端的 type/url。'
          + '传 video 即视频编辑：保留参考视频的构图与动作，按提示词替换/增删元素（缺省 type=reference_video）。存在时 image 字段忽略。',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            image: { type: 'string', description: '参考图：本地路径 / http(s) URL / data URL' },
            video: { type: 'string', description: '参考视频（视频编辑用）：本地路径 / http(s) URL；本地文件超过阈值时自动压缩，建议 ≤15 秒、720p 以内' },
            type: { type: 'string', description: '素材类型，缺省按字段与 position 推断：first_frame / last_frame / reference_image / reference_video（传 video 时缺省值）' },
            position: { type: 'string', description: "参考图对应时间点，如 '0s' / '1s' / 'first_frame' / 'last_frame'" },
          },
        },
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
          prompt: v.prompt,
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
        media?: VideoMediaInput[]
        resolution?: string
      }

      // 参考素材先解析：media 优先于 image；video 条目即「视频编辑」（保留原片动作、按提示词改写内容）。
      const mediaRef = typedArgs.media ? await resolveVideoMedia(typedArgs.media) : undefined
      const hasMedia = !!mediaRef
      const hasRefVideo = mediaRef?.some((m) => m.type === 'reference_video') ?? false

      // 参数兜底优先级：工具显式参数 > composer 运行时覆盖值 > settings 持久值。
      // 参考视频缺省 duration=-1：由服务端保持原片时长（官方视频编辑建议值）。
      // 运行时双重校验时长上限（schema 已约束，此处防御性检查）；-1 是「保持原片时长」哨兵值。
      const runtime = runtimeDefaults.get()
      const duration = typedArgs.duration ?? (hasRefVideo ? -1 : runtime.videoDuration ?? config.defaultVideoDuration)
      if (duration !== -1 && (duration < 1 || duration > MAX_VIDEO_DURATION)) {
        throw new Error(`视频时长必须在 1-${MAX_VIDEO_DURATION} 秒之间（-1 表示保持参考视频原时长），当前为 ${duration}`)
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

      // 本地路径在此解析为 data URL，适配器只接收 URL / data URL；
      // 超大首帧先压缩（实测 ~3MB data URL 提交会被网关拖到超时，压缩后秒收）
      const imageRef = typedArgs.image
        ? await compressVideoFirstFrame(await resolveImageReference(typedArgs.image))
        : undefined
      // 模型取值链：调用参数 model > 参考视频固定 wan3.0-video（All-in-One，只有它支持视频编辑）
      // > 配置 defaultVideoModel > adapter 内置默认
      let model = typedArgs.model
        || (hasRefVideo ? REFERENCE_VIDEO_CAPABLE_MODELS[0] : config.defaultVideoModel)
        || undefined

      // 参考素材能力校验：参考视频与多关键帧要求不同，分别响亮报错，不静默失败。
      if (hasRefVideo) {
        if (model && !REFERENCE_VIDEO_CAPABLE_MODELS.includes(model)) {
          throw new Error(`模型「${model}」不支持参考视频（视频编辑）。请使用 ${REFERENCE_VIDEO_CAPABLE_MODELS.join('、')}`)
        }
      } else if (hasMedia) {
        if (model && !MULTI_FRAME_CAPABLE_MODELS.includes(model)) {
          throw new Error(`模型「${model}」不支持多关键帧。请使用支持多帧的模型：${MULTI_FRAME_CAPABLE_MODELS.join('、')}`)
        }
        if (!model) {
          model = MULTI_FRAME_CAPABLE_MODELS[0]
        }
      }
      const videoParams: VideoGenParams = {
        prompt: typedArgs.prompt,
        duration,
        model,
        // 文档承诺「留空使用 16:9」在此落地：MiniMax 等上游纯文生场景要求显式 ratio；
        // 参考视频按官方建议用 adaptive 保持原片宽高比；多关键帧构图由素材决定，不传 ratio
        aspectRatio: hasRefVideo
          ? (typedArgs.aspectRatio || 'adaptive')
          : hasMedia ? undefined : (typedArgs.aspectRatio || runtime.videoAspectRatio || '16:9'),
        // media 存在时 image 忽略（适配器以 media 为准）
        image: hasMedia ? undefined : imageRef,
        media: mediaRef,
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
      if (hasRefVideo) {
        const videoCount = mediaRef?.filter((m) => m.type === 'reference_video').length ?? 0
        const assetCount = (mediaRef?.length ?? 0) - videoCount
        notes.push(`视频编辑：提交 ${videoCount} 段参考视频 + ${assetCount} 张参考素材，`
          + '由上游保留参考视频的构图与动作、按提示词改写内容'
          + `${assetCount > 0 ? '（提示词需包含「替换 / 改成 / 去掉」等编辑意图才会触发改写）' : ''}`)
        if (duration === -1) {
          notes.push('duration=-1：时长由服务端按参考视频原时长决定，不使用配置默认时长')
        }
      }
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
      const saved = await downloadAndSave(pollResult.mediaUrl, outputsDir, '.mp4', downloadOpts)

      const output: GenerateVideoOutput = {
        provider,
        prompt: typedArgs.prompt,
        duration,
        mode: hasRefVideo ? 'video-edit' : imageRef ? 'image-to-video' : 'text-to-video',
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
  /** 生成模式：text-to-video（文生视频）/ image-to-video（图生视频）/ video-edit（参考视频编辑）。 */
  mode: 'image-to-video' | 'text-to-video' | 'video-edit'
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
