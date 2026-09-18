/**
 * 生图调用前预检查（preflight）：把「能不能发这次请求」在**真正提交之前**判断完，
 * 而不是先提交一次、失败了再换模型重来。
 *
 * 设计边界（重要）：预检查只做**本地可判定**的事——配置是否自洽、尺寸写法是否
 * 能被服务商解析、模型名是否明显是视频模型、异步传输是否被该服务商支持。
 * 它**不**试图猜测「这个模型是不是图片模型」：聚合器模型目录由服务端维护，
 * 客户端拍脑袋判定会把可用模型误杀，反而制造失败。模型是否可用以服务端的
 * 「明确拒绝」为准（见 image-transaction.ts 的 canFallbackToNextProvider）。
 * @module dsh-image-video/image-preflight
 */

import type { Config, Provider } from './config.ts'
import { GenerationError } from './http-client.ts'
import type { ImageTransport } from './image-transaction.ts'

/** 预检查输入：本次调用已经解析完的所有决策。 */
export interface ImagePreflightInput {
  provider: Provider
  /** 工具参数 > 配置 defaultImageModel；undefined 表示交给服务商内置默认。 */
  model: string | undefined
  /** 请求尺寸（可能是 宽*高 / 宽x高 / 比例）。 */
  size: string
  /** 是否带参考图（决定文生图 / 图生图）。 */
  hasReferenceImage: boolean
  /** 本次实际使用的传输方式。 */
  transport: ImageTransport
  /** 适配器是否声明了异步图片网关能力。 */
  adapterSupportsAsync: boolean
  config: Config
}

/** 预检查结论：本次调用的完整决策快照，同时作为 notes 透明告知用户。 */
export interface ImagePreflight {
  provider: Provider
  model: string | undefined
  size: string
  mode: 'text-to-image' | 'image-to-image'
  transport: ImageTransport
  /** 水印后处理决策（未开启时 enabled=false）。 */
  watermark: { enabled: boolean; text: string }
}

/** 尺寸写法白名单：宽*高 / 宽x高 / 比例 / 常见档位别名。 */
const SIZE_PATTERN = /^(?:\d+[*xX]\d+|\d+:\d+|\d+K|auto)$/i

/**
 * 视频模型特征：`t2v` / `i2v` / `v2v` / `flf2v` / 独立 `video` 词段。
 * 只匹配**分段**出现（横杠/下划线/点号分隔），避免误伤 `wide-video-editing`
 * 之类含子串的图片模型名。
 */
const VIDEO_MODEL_PATTERN = /(?:^|[-_.])(?:t2v|i2v|v2v|flf2v|video)(?:[-_.]|$)/i

/**
 * 执行调用前预检查。任何**确定无法成功**的输入在这里直接失败，绝不带着错误
 * 参数去打一次真金白银的生成请求。
 * @param input - 已解析的调用决策。
 * @returns 预检查结论。
 * @throws {GenerationError} 尺寸写法无法识别、模型明显是视频模型、异步传输不被支持。
 */
export function resolveImagePreflight(input: ImagePreflightInput): ImagePreflight {
  const { provider, model, size, config } = input

  const trimmedSize = size.trim()
  if (trimmedSize === '') {
    throw new GenerationError('task', '生图参数错误：尺寸为空。请给出 宽*高（如 1024*1024）、比例（如 3:4）或 1K/2K/auto', false)
  }
  if (!SIZE_PATTERN.test(trimmedSize)) {
    throw new GenerationError(
      'task',
      `生图参数错误：无法识别的尺寸写法「${trimmedSize}」。支持 宽*高（1024*1024）、宽x高（1024x1024）、比例（3:4）或 1K/2K/4K/auto`,
      false,
    )
  }

  if (model !== undefined && model.trim() !== '' && looksLikeVideoModel(model, config)) {
    throw new GenerationError(
      'task',
      `生图参数错误：模型「${model}」是视频模型（或等于配置 defaultVideoModel=${config.defaultVideoModel}），`
      + '不能用于 generate_image。生图请用图片模型（如 qwen-image-3.0 / qwen-image-3.0-pro），'
      + '或修正配置中的 defaultImageModel',
      false,
    )
  }

  if (input.transport === 'async' && !input.adapterSupportsAsync) {
    throw new GenerationError(
      'task',
      `生图配置错误：服务商 ${provider} 不支持异步图片传输，但 imageTransport=async 要求它。`
      + '可改用 threerouter（唯一实现异步图片网关的服务商），或把 imageTransport 改为 auto/sync',
      false,
    )
  }

  return {
    provider,
    model: model === undefined || model.trim() === '' ? undefined : model,
    size: trimmedSize,
    mode: input.hasReferenceImage ? 'image-to-image' : 'text-to-image',
    transport: input.transport,
    watermark: { enabled: config.watermark.enabled, text: config.watermark.text },
  }
}

/**
 * 模型名是否明显属于视频模型。命中条件之一即可，且**显式配置优先**：
 * 当用户把 defaultImageModel 明确设成该名字时不再拦截（用户的显式选择胜过启发式）。
 * @param model - 模型名。
 * @param config - 插件配置。
 * @returns 是否判定为视频模型。
 */
export function looksLikeVideoModel(model: string, config: Config): boolean {
  const name = model.trim()
  if (name === '') return false
  const explicitImageModel = config.defaultImageModel.trim()
  if (explicitImageModel !== '' && name === explicitImageModel) return false
  const videoModel = config.defaultVideoModel.trim()
  if (videoModel !== '' && name === videoModel) return true
  return VIDEO_MODEL_PATTERN.test(name)
}

/**
 * 把预检查结论格式化为一行透明告知，写进工具结果 notes：
 * 「本次用了谁、什么模型、什么尺寸、走哪条传输、要不要打水印」一句话说完，
 * 用户不必查配置或翻服务商后台。
 */
export function formatPreflightNote(preflight: ImagePreflight): string {
  const model = preflight.model ?? '（服务商内置默认）'
  const mode = preflight.mode === 'image-to-image' ? '图生图' : '文生图'
  const watermark = preflight.watermark.enabled ? `开（${preflight.watermark.text}）` : '关'
  return `调用前预检查通过：服务商=${preflight.provider}，模型=${model}，模式=${mode}，`
    + `尺寸=${preflight.size}，传输=${preflight.transport}，品牌水印=${watermark}`
}
