/**
 * generate_image 工具：文生图 / 图生图。
 *
 * 一次调用的完整链路（顺序即设计，不得颠倒）：
 *   1. 解析参数（提示词、参考图、尺寸、模型）与服务商候选链；
 *   2. **调用前预检查**：尺寸写法、模型是否明显是视频模型、传输方式是否被该
 *      服务商支持——任何确定失败的输入在这里就响亮报错，绝不带着错参数去打一次
 *      真金白银的生成请求；
 *   3. **只提交一次**（image-transaction.ts 的提交预算）：async 传输携带幂等键，
 *      服务端保证同一键只创建一个任务；提交结果未知时凭 request_id 找回原任务，
 *      绝不重新生成、绝不换模型；
 *   4. 结果字节下载到**内存**；
 *   5. 品牌水印后处理（内存内合成）；
 *   6. 只落盘最终图到插件唯一的 outputsDir，并把**最终字节**写入 attachment 服务；
 *   7. 返回元数据（提交次数、传输方式、request_id、后处理链路）+ 最终图片附件，
 *      交互流据 localPath 内嵌展示同一份最终图。
 *
 * 另提供 `recoverRequestId` 找回模式：凭上一次调用的 request_id 取回任务结果，
 * **不产生任何新的生成请求**。
 * @module dsh-image-video/tools/generate-image
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-llm'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef, ImageMediaType, AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { Config, Provider } from '../config.ts'
import { randomUUID } from 'node:crypto'
import { applyImageWatermark } from '../watermark.ts'
import { resolveProviderCredentials, peekProviderCredentials } from '../config.ts'
import type { RuntimeDefaultsStore } from '../runtime-defaults.ts'
import { applyImageStyle, resolveModelCandidates } from '../runtime-defaults.ts'
import {
  AsyncTransportUnavailableError,
  DEFAULT_RECOVERY_BUDGET,
  TRANSPORT_PROBE_TTL_MS,
  createImageTransaction,
  canFallbackToNextProvider,
  reportTransaction,
  resolveImageTransport,
  runImageTransaction,
} from '../image-transaction.ts'
import type { ImageTransaction, TransportProbeCache } from '../image-transaction.ts'
import { formatPreflightNote, resolveImagePreflight } from '../image-preflight.ts'
import type { ImagePreflight } from '../image-preflight.ts'
import type { TaskManager, TaskQueryFn } from '../task-manager.ts'
import { wanxAdapter } from '../providers/wanx.ts'
import { seedanceAdapter } from '../providers/seedance.ts'
import { threerouterAdapter } from '../providers/threerouter.ts'
import { minimaxAdapter } from '../providers/minimax.ts'
import type { ProviderAdapter, ImageGenParams, HttpOpts, SubmitResult } from '../providers/types.ts'
import {
  createImageSummaryText,
  decodeBase64Media,
  fetchMediaBytes,
  resolveImageReference,
  saveImageAttachment,
  writeOutputFile,
} from '../media.ts'
import type { MediaSaveResult } from '../media.ts'

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
  /** 运行时默认值存储：composer 热更新覆盖值优先于 settings 持久值。 */
  runtimeDefaults: RuntimeDefaultsStore
  /** 已解析为绝对路径的 outputsDir（插件唯一解析点，见 index.apply）。 */
  outputsDir: string
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

/** 单次候选服务商的执行结果：成功、或失败（含事务账本，供判定能否换家）。 */
type CandidateAttempt =
  | { ok: true; result: SubmitResult; tx: ImageTransaction; preflight: ImagePreflight }
  | { ok: false; error: unknown; tx: ImageTransaction }

/**
/**
 * 从当前会话最后一条用户消息读取已持久化图片，并转为服务商可消费的 data URL。
 * 粘贴图片进入对话后，输入框已经由宿主 attachment 服务持久化；这里不再要求用户
 * 复制路径，也不扫描历史图片，严格只取本轮最新用户消息中的图片，顺序保持不变。
 */
async function resolveConversationImages(exec: ToolExecution, attachments: AttachmentStore): Promise<string[]> {
  const messages = exec.agent?.session.deriveMessages() ?? []
  const latest = [...messages].reverse().find((message) => message.role === 'user'
    && message.content.some((block) => block.type === 'image'))
  if (latest === undefined) return []
  const refs = latest.content
    .filter((block): block is Extract<ContentBlock, { type: 'image' }> => block.type === 'image')
    .map((block) => block.attachment)
  const resolved: string[] = []
  for (const ref of refs) {
    const stored = await attachments.readImage(ref, exec.signal)
    resolved.push(`data:${stored.ref.mediaType};base64,${Buffer.from(stored.data).toString('base64')}`)
  }
  return resolved
}

/**
 * 创建 generate_image 工具定义。
 * 工具参数：prompt（必填，找回模式除外）、image（单图）、images（多参考图）、size、model、recoverRequestId。
 */
export function createGenerateImageTool(deps: GenerateImageDeps) {
  const { config, taskManager, attachments, ctx, runtimeDefaults, outputsDir } = deps
  /**
   * 异步传输能力探测缓存（按服务商）：某个服务商的异步端点被判为不可用后，
   * 在 TTL（10 分钟）内直接走同步，省掉每次调用一次的 404 往返；TTL 过后自动
   * 重新探测——服务端上线异步能力后无需重启客户端即可切换。
   */
  const transportProbe = new Map<Provider, TransportProbeCache>()

  const adapterFor = (p: Provider): ProviderAdapter => p === 'threerouter' ? threerouterAdapter
    : p === 'wanx' ? wanxAdapter
    : p === 'minimax' ? minimaxAdapter
    : seedanceAdapter

  /** 轮询实现：异步传输查网关图片任务端点，同步传输沿用适配器自身的任务查询。 */
  const pollFor = (
    adapter: ProviderAdapter,
    transport: 'async' | 'sync',
    httpOpts: HttpOpts,
  ): ((taskId: string, signal?: AbortSignal) => Promise<{ mediaUrl: string }>) => {
    const api = adapter.imageAsync
    const query: TaskQueryFn | ProviderAdapter = transport === 'async' && api !== undefined
      ? (taskId, opts) => api.query(taskId, opts)
      : adapter
    return async (taskId, signal) =>
      await taskManager.pollUntilDone(taskId, query, { ...httpOpts, ...(signal === undefined ? {} : { signal }) }, signal)
  }

  /**
   * 尝试一个候选服务商：预检查 → 单次提交（async 优先）→ 必要时降级同步。
   * 失败时把事务账本一并带回，让调用方按 `canFallbackToNextProvider` 判定
   * 「能否安全换家」——未知状态绝不允许换家。
   */
  const attemptCandidate = async (
    candidate: Provider,
    input: {
      requestId: string
      model: string | undefined
      size: string
      imageReference: string | undefined
      imageReferences: string[]
      prompt: string
      exec: ToolExecution
      notes: string[]
    },
  ): Promise<CandidateAttempt> => {
    const { requestId, model, size, imageReference, imageReferences, prompt, exec, notes } = input
    const adapter = adapterFor(candidate)
    const creds = resolveProviderCredentials(config, candidate)
    const httpOpts: HttpOpts = {
      apiKey: creds.apiKey,
      baseURL: creds.baseURL,
      timeoutMs: config.timeoutMs,
      retryTimes: config.retryTimes,
      signal: exec.signal,
    }
    const configuredTransport = resolveImageTransport(config.imageTransport, adapter, transportProbe.get(candidate))
    if (config.imageTransport === 'auto' && configuredTransport === 'sync' && adapter.imageAsync !== undefined) {
      notes.push('该服务商的异步图片端点近期探测为不可用（生图功能未开启或分组平台不支持），本次直接走同步单次提交；'
        + '服务端恢复后 10 分钟内自动切回异步')
    }

    // 调用前预检查：任何确定失败的输入都在提交之前报错。
    const preflight = resolveImagePreflight({
      provider: candidate,
      model,
      size,
      hasReferenceImage: imageReference !== undefined || imageReferences.length > 0,
      transport: configuredTransport,
      adapterSupportsAsync: adapter.imageAsync !== undefined,
      config,
    })
    notes.push(formatPreflightNote(preflight))

    const params: ImageGenParams = {
      prompt,
      size,
      model,
      requestId,
      ...(imageReferences.length > 0 ? { images: imageReferences } : imageReference === undefined ? {} : { image: imageReference }),
    }
    const run = async (transport: 'async' | 'sync', tx: ImageTransaction) =>
      await runImageTransaction({
        tx,
        adapter,
        params,
        httpOpts,
        poll: pollFor(adapter, transport, httpOpts),
        unknownStatePolicy: config.imageUnknownStatePolicy === 'resubmit-same-key' ? 'resubmit-same-key' : 'fail',
        recovery: DEFAULT_RECOVERY_BUDGET,
        onNote: (note) => { notes.push(note) },
      })

    let tx = createImageTransaction({ requestId, provider: candidate, model, transport: configuredTransport })
    try {
      const outcome = await run(configuredTransport, tx)
      return { ok: true, result: outcome.submit, tx, preflight }
    } catch (err) {
      // 降级路径：异步端点在服务端创建任务之前返回 404，因此改走同步不会重复生成。
      // 只在 auto 模式下降级；imageTransport=async 是「上线验收口径」，要响亮失败。
      if (err instanceof AsyncTransportUnavailableError && config.imageTransport === 'auto') {
        transportProbe.set(candidate, { unavailableUntil: Date.now() + TRANSPORT_PROBE_TTL_MS })
        notes.push(`异步图片端点不可用，已降级为同步单次提交：${err.message}`)
        notes.push('降级说明：同步端点没有幂等键记录，因此不会自动重试，提交超时后也不会重新生成')
        const syncTx = createImageTransaction({ requestId, provider: candidate, model, transport: 'sync' })
        try {
          const outcome = await run('sync', syncTx)
          return { ok: true, result: outcome.submit, tx: syncTx, preflight }
        } catch (syncErr) {
          return { ok: false, error: syncErr, tx: syncTx }
        }
      }
      return { ok: false, error: err, tx }
    }
  }

  /**
   * 交付结果：内存下载 → 水印后处理 → 只落盘最终图 → 写最终字节附件。
   * 图片生成与「凭 request_id 找回」共用本函数，保证两条路径的产出一致。
   */
  const deliverImage = async (
    source: { mediaUrl?: string; mediaBase64?: { data: string; mediaType: string } },
    exec: ToolExecution,
    notes: string[],
  ): Promise<{ saved: MediaSaveResult; postprocess: string[] }> => {
    if (source.mediaUrl === undefined && source.mediaBase64 === undefined) {
      throw new Error('生成失败：服务端既未返回图片 URL 也未返回图片数据')
    }
    const media = source.mediaBase64 !== undefined
      ? decodeBase64Media(source.mediaBase64.data, source.mediaBase64.mediaType)
      : await fetchMediaBytes(source.mediaUrl as string, {
        timeoutMs: config.timeoutMs,
        retryTimes: config.retryTimes,
        signal: exec.signal,
      })
    // 后处理在内存内完成：磁盘上只可能出现一份文件，且内容就是最终结果。
    const watermark = await applyImageWatermark(media.data, media.contentType, config.watermark)
    if (watermark.note !== undefined) notes.push(watermark.note)
    const saved = await writeOutputFile(
      watermark.data,
      watermark.contentType,
      outputsDir,
      '.png',
      source.mediaUrl ?? '',
    )
    const postprocess = watermark.applied ? [`品牌水印 ${config.watermark.text}（${config.watermark.position}）`] : []
    return { saved, postprocess }
  }

  return defineTool({
    name: 'generate_image',
    description:
      '根据文本提示词生成图片；传入 image 参考图即为图生图（threerouter 统一生图端点按提示词编辑、'
      + 'Seedream 参考编辑、MiniMax 保留主体特征换场景——主体一致性）。服务商选择：配置链服务商优先'
      + '（composer 会话选定 > 配置默认服务商 > 激活服务商，默认 threerouter 聚合器）；'
      + '显式指定模型时按模型家族自动路由（wan/wanx→百炼直连，doubao/seedream/seedance→火山方舟，minimax→MiniMax 官方），'
      + '候选仅在「服务端明确拒绝该模型且未创建任务」时按序回退，threerouter 永远兜底。'
      + '一次调用只提交一次生成请求：默认走 threerouter 异步图片端点（携带幂等键），'
      + '提交结果未知时凭同一 request_id 找回原任务，绝不自动重提、绝不自动换模型、不生成多张候选；'
      + '需要多个版本时请分别发起多次调用。'
      + '生成结果经品牌水印后处理（可配置）后保存到客户端统一 outputs 目录（对话内附最终图片附件）。'
      + '不要自行编写脚本、不要直接调用服务商 API、不要把结果写到 outputs 之外。'
      + '参数：prompt（提示词，必填；仅找回模式可省略）、image（单张参考图本地路径/URL，可选）; images（多参考图数组，直接粘贴到对话的图片会自动作为参考图，首图为底图，其余为脸部/风格参考）、'
      + 'size（尺寸或比例，可选，默认 3:4；qwen/wan 系自动换算为宽*高）、'
      + 'model（模型名，可选，留空用配置 defaultImageModel 或服务商内置默认模型）、'
      + 'recoverRequestId（可选：凭上一次调用的 request_id 找回结果，不产生新的生成请求）。',

    parameters: {
      prompt: {
        type: 'string',
        description: '描述要生成的图片内容，支持中英文。仅当使用 recoverRequestId 找回模式时可省略。',
      },
      image: {
        type: 'string',
        description: '单张参考图（本地文件路径或 http(s) URL）。',
      },
      images: {
        type: 'array',
        items: { type: 'string' },
        description: '多张参考图路径/URL；首图为底图，其余按顺序作为编辑、脸部或风格参考。若省略，自动读取本轮对话中粘贴的图片。',
      },
      size: {
        type: 'string',
        description: '图片尺寸，如 1024*1024、1280*720。留空使用配置默认值。',
      },
      model: {
        type: 'string',
        description: '指定模型名称。留空使用配置 defaultImageModel 或服务商默认模型。',
      },
      recoverRequestId: {
        type: 'string',
        description: '仅用于找回：上一次调用返回的 request_id。凭它取回已提交任务的结果（服务端保留 24 小时），不会重新生成。',
      },
    },

    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          provider: { type: 'string', required: true },
          prompt: { type: 'string', description: '本次实际使用的提示词；找回模式下为服务端任务回显值或空串。' },
          mode: { type: 'string', enum: ['text-to-image', 'image-to-image'], required: true },
          localPath: { type: 'string', required: true },
          sourceUrl: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          model: { type: 'string', description: '实际发给上游的模型名（含服务商内置默认），供用户核对本次到底用了哪个模型。' },
          transport: { type: 'string', enum: ['async', 'sync'], description: '本次使用的提交传输：async=网关异步任务（有幂等与找回），sync=同步单次提交。' },
          submitAttempts: { type: 'integer', description: '本次生成事务的物理提交次数：正常为 1，仅同键重提策略下为 2（服务端按键去重）。' },
          recoveryLookups: { type: 'integer', description: '凭 request_id 反查原任务的次数（只读查询，不计费）。' },
          requestId: { type: 'string', description: '本次生成事务的幂等键：可用 recoverRequestId 参数找回结果。' },
          taskId: { type: 'string', description: '服务端任务 ID（async 传输或服务商异步任务形态下有值）。' },
          postprocess: { type: 'array', items: { type: 'string' }, description: '后处理链路（如品牌水印）；无后处理时省略。' },
          notes: { type: 'array', items: { type: 'string' } },
          image: {
            type: 'object',
            additionalProperties: false,
            description: '内嵌图片附件引用（模型可见）。路由支持图片输入时 render 一并注入 image 块使对话内嵌显示；否则省略。',
            properties: {
              attachmentId: { type: 'string', required: true },
              mediaType: { type: 'string', enum: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], required: true },
              bytes: { type: 'integer', required: true },
              width: { type: 'integer', required: true },
              height: { type: 'integer', required: true },
              name: { type: 'string' },
            },
          },
          previewImage: {
            type: 'object',
            additionalProperties: false,
            description: '最终图片的附件引用（UI-only，始终提供）：与 localPath 是同一份后处理后的字节。',
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
        // 尺寸取自**始终提供**的最终图引用（previewImage），与 presentationMeta 同一取值链；
        // 不能只读 v.image——它仅在路由支持图片输入时才注入，纯文本模型下会让结果退化成「未知尺寸」。
        const dimensions = v.previewImage ?? v.image
        const content = createImageSummaryText({
          provider: v.provider,
          localPath: v.localPath,
          bytes: v.bytes,
          ...(v.prompt === undefined ? {} : { prompt: v.prompt }),
          mode: v.mode,
          ...(v.model === undefined ? {} : { model: v.model }),
          ...(v.notes === undefined ? {} : { notes: v.notes }),
          ...(v.postprocess === undefined ? {} : { postprocess: v.postprocess }),
          ...(v.submitAttempts === undefined ? {} : { submitAttempts: v.submitAttempts }),
          ...(v.transport === undefined ? {} : { transport: v.transport }),
          ...(v.requestId === undefined ? {} : { requestId: v.requestId }),
          ...dimensions === undefined ? {} : { width: dimensions.width, height: dimensions.height },
        })
        if (v.image !== undefined) {
          content.push({ type: 'image', attachment: imageAttachmentRef(v.image) })
        }
        return content
      },
      // UI-only 通道：持久化到 tool/result 事件的 meta 字段，客户端 ToolResultNode.meta
      // 可消费它内嵌渲染图片，但绝不进入模型请求上下文（Model-visible ⟺ logged 的反向：
      // 持久化 ≠ 模型可见）。previewImage 无论路由是否支持图片输入都提供，
      // 保证交互流始终能引用到**后处理后的最终图**。
      presentationMeta: (_args, value) => {
        const v = value as GenerateImageOutput
        const preview = v.previewImage ?? v.image
        return {
          provider: v.provider,
          model: v.model,
          mode: v.mode,
          prompt: v.prompt,
          localPath: v.localPath,
          sourceUrl: v.sourceUrl,
          bytes: v.bytes,
          transport: v.transport,
          submitAttempts: v.submitAttempts,
          requestId: v.requestId,
          ...(v.taskId === undefined ? {} : { taskId: v.taskId }),
          ...(v.postprocess === undefined ? {} : { postprocess: v.postprocess }),
          ...(v.notes ? { notes: v.notes } : {}),
          ...(preview === undefined ? {} : { image: preview }),
        }
      },
    },

    async execute(args, exec) {
      const typedArgs = args as {
        prompt?: string
        image?: string
        images?: string[]
        size?: string
        model?: string
        recoverRequestId?: string
      }

      // ── 找回模式：凭 request_id 取回已提交任务的结果，不产生任何新的生成请求 ──
      if (typedArgs.recoverRequestId !== undefined && typedArgs.recoverRequestId.trim() !== '') {
        return await recoverByRequestId(typedArgs.recoverRequestId.trim())
      }

      const rawPrompt = typedArgs.prompt?.trim() ?? ''
      if (rawPrompt === '') {
        throw new Error('generate_image：prompt 必填（仅使用 recoverRequestId 找回模式时可省略）')
      }

      // 参数兜底优先级：工具显式参数 > composer 运行时覆盖值 > settings 持久值。
      // 风格在 host 端拼接为英文提示词后缀，对所有服务商通用（不改 API 参数）。
      const runtime = runtimeDefaults.get()
      const prompt = applyImageStyle(rawPrompt, runtime.imageStyle)

      // 参考图解析：本地路径 → data URL，URL/data URL 原样透传（图生图入参）
      const conversationReferences = await resolveConversationImages(exec, attachments)
       const explicitReferences = Array.isArray(typedArgs.images)
         ? await Promise.all(typedArgs.images.filter((value): value is string => typeof value === 'string' && value.trim() !== '').map(resolveImageReference))
         : []
       const resolvedReferences = explicitReferences.length > 0 ? explicitReferences : conversationReferences
       const imageReference = typedArgs.image
         ? await resolveImageReference(typedArgs.image)
         : undefined

      // 模型取值链：调用参数 model > 配置 defaultImageModel > adapter 内置默认
      const imageReferences = imageReference !== undefined ? [imageReference] : resolvedReferences
       const model = typedArgs.model || config.defaultImageModel || undefined
      const size = typedArgs.size ?? runtime.imageSize ?? config.defaultImageSize

      // 服务商选择：构建候选序列——配置链优先（composer 覆盖 > settings 默认 > 激活
      // 服务商）→ 显式 model 命中家族规则的直连商 → threerouter 聚合器兜底；
      // 未配置 key 的候选自动跳过。
      const preferred: Provider | undefined = runtime.imageProvider
        ?? (config.defaultImageProvider === '' ? undefined : config.defaultImageProvider)
      const candidates = resolveModelCandidates(
        'image',
        model,
        preferred ?? config.provider,
        (p) => peekProviderCredentials(config, p).apiKey.trim().length > 0,
      )
      if (candidates.length === 0) {
        throw new Error('dsh-image-video：没有任何已配置 API Key 的服务商，请至少为一个服务商配置 apiKey')
      }

      // 一个调用 = 一个生成事务 = 一个幂等键（换候选服务商也复用同一个键：
      // 服务端按 API Key 隔离幂等域，键复用不会串任务）。
      const requestId = randomUUID()
      const notes: string[] = []
      const attempts: string[] = []
      let chosen: Extract<CandidateAttempt, { ok: true }> | undefined
      let lastError: unknown
      for (const candidate of candidates) {
        const attempt = await attemptCandidate(candidate, {
          requestId,
          model,
          size,
          imageReference,
          imageReferences,
          prompt,
          exec,
          notes,
        })
        if (attempt.ok) {
          chosen = attempt
          break
        }
        lastError = attempt.error
        if (canFallbackToNextProvider(attempt.error, attempt.tx)) {
          attempts.push(`${candidate} 不接受该模型（${attempt.error instanceof Error ? attempt.error.message.slice(0, 120) : String(attempt.error)}）`)
          continue
        }
        throw attempt.error
      }
      if (chosen === undefined) {
        throw lastError instanceof Error
          ? lastError
          : new Error(`图片提交失败：所有候选服务商均不接受模型 ${model ?? '（服务商默认）'}`)
      }
      if (attempts.length > 0) {
        notes.unshift(`模型自动路由回退：${attempts.join('；')}；最终由 ${chosen.tx.provider} 提交`)
      }

      // ── 交付：内存下载 → 水印后处理 → 只落盘最终图 → 写最终字节附件 ──
      const { saved, postprocess } = await deliverImage(chosen.result, exec, notes)

      // 通过 attachment 服务持久化**最终**字节（复用已处理的字节，避免二次请求）。
      const imageRef = await saveImageAttachment(attachments, saved.data, saved.contentType, 'generated-image')

      // 判定调用路由是否声明图片输入：支持才注入 image 块（前端内嵌显示），否则仅文本摘要。
      const imageInline = await routeAcceptsImages(ctx, exec)
      // 实际模型以适配器回报为准（含服务商内置默认兜底），避免用配置推断模型。
      const actualModel = chosen.result.model ?? model ?? ''
      const txReport = reportTransaction(chosen.tx)
      const output: GenerateImageOutput = {
        provider: chosen.tx.provider,
        prompt,
        // 模式与预检查同源：预检查已统一按「单图 / 多图 / 对话粘贴图」判定是否带参考图，
        // 这里只再看 imageReference 会把 images（含对话粘贴图）误报成文生图。
        mode: chosen.preflight.mode,
        localPath: saved.localPath,
        sourceUrl: saved.sourceUrl,
        bytes: saved.bytes,
        model: actualModel,
        transport: chosen.tx.transport,
        submitAttempts: txReport.submitAttempts,
        recoveryLookups: txReport.recoveryLookups,
        requestId: txReport.requestId,
        ...(txReport.taskId === undefined ? {} : { taskId: txReport.taskId }),
        ...(postprocess.length === 0 ? {} : { postprocess }),
        ...(notes.length > 0 ? { notes } : {}),
        previewImage: imageRef as GenerateImageOutput['previewImage'],
        ...imageInline ? { image: imageRef as GenerateImageOutput['image'] } : {},
      }
      return output

      /**
       * 凭 request_id 找回上一次调用的任务结果并交付（不提交任何生成请求）。
       * 逐个候选服务商的反查端点查询：只有提交时那把 key 能查到自己的任务，
       * 因此用不到的服务商会直接 404（不计费、不产生任务）。
       */
      async function recoverByRequestId(recoverRequestId: string): Promise<GenerateImageOutput> {
        const recoverNotes: string[] = []
        const probeCandidates: Provider[] = candidates.includes('threerouter')
          ? candidates
          : [...candidates, 'threerouter']
        let found: { provider: Provider; taskId: string; adapter: ProviderAdapter; httpOpts: HttpOpts } | undefined
        let lookupError: unknown
        for (const candidate of probeCandidates) {
          const adapter = adapterFor(candidate)
          if (adapter.imageAsync === undefined) continue
          const creds = resolveProviderCredentials(config, candidate)
          const httpOpts: HttpOpts = {
            apiKey: creds.apiKey,
            baseURL: creds.baseURL,
            timeoutMs: config.timeoutMs,
            retryTimes: config.retryTimes,
            signal: exec.signal,
          }
          try {
            const hit = await adapter.imageAsync.findByRequest(recoverRequestId, httpOpts)
            if (hit !== undefined) {
              found = { provider: candidate, taskId: hit.taskId, adapter, httpOpts }
              break
            }
          } catch (err) {
            lookupError = err
          }
        }
        if (found === undefined) {
          throw new Error(
            `未找到 request_id=${recoverRequestId} 对应的任务：该键没有记录（从未成功提交）或已超过服务端 24 小时保留期。`
            + (lookupError === undefined ? '' : `查询过程中的错误：${lookupError instanceof Error ? lookupError.message : String(lookupError)}。`)
            + '本次没有发起任何新的生成请求。',
          )
        }
        const hit = found
        const hitApi = hit.adapter.imageAsync
        if (hitApi === undefined) {
          throw new Error(`服务商 ${hit.provider} 不支持按 request_id 找回任务`)
        }
        recoverNotes.unshift(`找回模式：凭 request_id=${recoverRequestId} 取回任务 ${hit.taskId}（服务商 ${hit.provider}），本次未提交任何新的生成请求`)
        const mediaUrl = (await taskManager.pollUntilDone(
          hit.taskId,
          (taskId, opts) => hitApi.query(taskId, opts),
          hit.httpOpts,
          exec.signal,
        )).mediaUrl
        const { saved, postprocess } = await deliverImage({ mediaUrl }, exec, recoverNotes)
        const imageRef = await saveImageAttachment(attachments, saved.data, saved.contentType, 'recovered-image')
        const imageInline = await routeAcceptsImages(ctx, exec)
        return {
          provider: hit.provider,
          prompt: '',
          mode: 'text-to-image',
          localPath: saved.localPath,
          sourceUrl: saved.sourceUrl,
          bytes: saved.bytes,
          model: model ?? '',
          transport: 'async',
          submitAttempts: 0,
          recoveryLookups: 1,
          requestId: recoverRequestId,
          taskId: hit.taskId,
          ...(postprocess.length === 0 ? {} : { postprocess }),
          notes: recoverNotes,
          previewImage: imageRef as GenerateImageOutput['previewImage'],
          ...imageInline ? { image: imageRef as GenerateImageOutput['image'] } : {},
        }
      }
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
  /** 实际使用的提示词；找回模式下为空串（无提示词上下文）。 */
  prompt: string
  /** 生成模式：text-to-image（文生图）/ image-to-image（图生图，带参考图）。 */
  mode: 'text-to-image' | 'image-to-image'
  localPath: string
  sourceUrl: string
  bytes: number
  /** 实际发给上游的模型名（含服务商内置默认），逐次调用如实回报。 */
  model: string
  /** 提交传输方式（async = 网关异步任务，sync = 同步单次提交）。 */
  transport: 'async' | 'sync'
  /** 物理提交次数：正常恒为 1，是「没有重复生成」的自证字段。 */
  submitAttempts: number
  /** 凭 request_id 反查原任务的次数（只读，不计费）。 */
  recoveryLookups: number
  /** 生成事务幂等键：可用 recoverRequestId 找回结果。 */
  requestId: string
  /** 服务端任务 ID。 */
  taskId?: string
  /** 后处理链路（品牌水印）；未做后处理时缺省。 */
  postprocess?: string[]
  /** 透明告知：预检查结论、传输降级、候选回退、找回过程等。 */
  notes?: string[]
  /** 模型可见的图片附件引用（仅路由支持图片输入时提供）。 */
  image?: ImageAttachmentOutput
  /** UI-only 预览附件引用（始终提供，与 localPath 是同一份最终字节）。 */
  previewImage?: ImageAttachmentOutput
}

/**
 * 工具输出里内嵌的图片附件引用（attachmentId 为字符串，render 时重建为品牌化 ID）。
 * 刻意声明为 type 别名而非 interface：匿名对象类型带隐式索引签名，
 * 可直接赋值给 `presentationMeta` 要求的 JsonValue。
 */
type ImageAttachmentOutput = {
  attachmentId: string
  mediaType: ImageMediaType
  bytes: number
  width: number
  height: number
  name?: string
}
