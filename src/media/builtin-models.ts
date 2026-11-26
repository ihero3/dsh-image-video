/**
 * 服务商「内置默认模型」的宿主侧解析表（只给宿主用，不进客户端 bundle）。
 *
 * 用途：界面要能回答"我不选模型时，到底会用哪个"——只显示「自动」等于把这个问题
 * 甩回给用户。取值顺序与工具侧一致：
 * `调用参数 model` → `配置 defaultImageModel / defaultVideoModel` → `服务商内置默认`。
 * 本文件负责最后一档：把「哪个服务商」映射到它适配器里的默认模型名。
 *
 * 为什么不把模型名写进客户端：模型/服务商名属于部署事实，浏览器产物里出现会被
 * `client-no-hardcoding` 判为泄漏（`T2-11`）。所以由宿主经 `models/catalog` 下发，
 * 客户端只负责展示与回填。
 *
 * @module dsh-image-video/media/builtin-models
 */
import {
  DEFAULT_IMAGE_MODEL as THREEVIDEO_IMAGE, DEFAULT_VIDEO_MODEL as THREEVIDEO_VIDEO,
} from '../providers/threevideo.ts'
import {
  DEFAULT_IMAGE_MODEL as WANX_IMAGE, DEFAULT_VIDEO_MODEL as WANX_VIDEO,
} from '../providers/wanx.ts'
import {
  DEFAULT_IMAGE_MODEL as MINIMAX_IMAGE, DEFAULT_VIDEO_MODEL as MINIMAX_VIDEO,
} from '../providers/minimax.ts'
import {
  DEFAULT_IMAGE_MODEL as SEEDANCE_IMAGE, DEFAULT_VIDEO_MODEL as SEEDANCE_VIDEO,
} from '../providers/seedance.ts'

/** 某个服务商的内置默认模型（缺项 = 该服务商没有这类生成能力）。 */
export interface BuiltinModels {
  readonly image?: string
  readonly video?: string
}

/**
 * 服务商 → 内置默认模型。
 *
 * 旧 id `threerouter` 在配置加载时已归一为 `threevideo`，这里仍保留映射：
 * 万一有调用方绕过 config 归一（测试、旧存档），也不会解析不到默认值。
 */
const TABLE: Readonly<Record<string, BuiltinModels>> = {
  threevideo: { image: THREEVIDEO_IMAGE, video: THREEVIDEO_VIDEO },
  threerouter: { image: THREEVIDEO_IMAGE, video: THREEVIDEO_VIDEO },
  wanx: { image: WANX_IMAGE, video: WANX_VIDEO },
  minimax: { image: MINIMAX_IMAGE, video: MINIMAX_VIDEO },
  seedance: { image: SEEDANCE_IMAGE, video: SEEDANCE_VIDEO },
}

/**
 * 取某服务商的内置默认模型。
 * @param provider - 服务商 id（大小写不敏感）。
 * @returns 默认模型；未知服务商返回 `undefined`（界面退回「自动」，不编造名字）。
 */
export function builtinModels(provider: string | null | undefined): BuiltinModels | undefined {
  if (provider === null || provider === undefined) return undefined
  return TABLE[provider.trim().toLowerCase()]
}

/**
 * 合并「配置里显式指定的默认模型」与「服务商内置默认」，得到界面该显示的默认值。
 * @param provider - 生效服务商（已解析过 defaultImageProvider / defaultVideoProvider）。
 * @param explicit - 配置里的 defaultImageModel / defaultVideoModel（空串 = 未指定）。
 * @param kind - 图片或视频。
 * @returns 实际会用的模型名；解析不到时为 `undefined`。
 */
export function resolveEffectiveModel(
  provider: string | null | undefined,
  explicit: string,
  kind: 'image' | 'video',
): string | undefined {
  const configured = explicit.trim()
  if (configured !== '') return configured
  return builtinModels(provider)?.[kind]
}
