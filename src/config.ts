/**
 * 插件配置类型与 Schemastery schema。所有部署可变参数都通过 Config 暴露，
 * 不存在硬编码可调参数；切换服务商只需改 `provider` 字段，HMR 自动重载。
 * @module dsh-image-video/config
 */

import z from '@deepseek-ai/schemastery'

/** 支持的生成服务商。minimax 为 MiniMax 官方平台直连（仅视频），threerouter 为聚合器（所有模型）。 */
export type Provider = 'threerouter' | 'wanx' | 'minimax' | 'seedance'

/** 单个服务商的凭证与自定义接口地址。 */
export interface ProviderCredentials {
  /** 服务商 API Key；切换 provider 后对应 key 立即生效。 */
  apiKey: string
  /** 自定义接口地址，留空使用服务商默认端点。 */
  baseURL?: string
}

/** 水印位置（四角之一）。 */
export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

/**
 * 品牌水印后处理配置。所有尺寸类参数都是**相对图片宽/高的比例**，
 * 保证同一套配置对不同尺寸出图观感一致。
 */
export interface WatermarkConfig {
  /** 是否对最终图片合成品牌水印（关闭时图片流程完全不受影响）。 */
  enabled: boolean
  /** 水印文字。 */
  text: string
  /** 主文字不透明度（0-1）。 */
  opacity: number
  /** 水印位置：四角之一。 */
  position: WatermarkPosition
  /** 字号占图片宽度的比例。 */
  fontSizeRatio: number
  /** 水平留白占图片宽度的比例。 */
  marginXRatio: number
  /** 垂直留白占图片高度的比例。 */
  marginYRatio: number
  /** 是否给水印加柔光（浅色底图上也看得见）。 */
  glowEnabled: boolean
  /** 柔光颜色。 */
  glowColor: string
  /** 柔光半径占字号的比例。 */
  glowBlurRatio: number
}

export interface Config {
  /** 当前激活的服务商，切换后立即生效（HMR）。 */
  provider: Provider
  /** Threerouter 凭证；provider=threerouter 时使用（支持图片+视频）。 */
  threerouter: ProviderCredentials
  /** 万象（wanx）凭证；provider=wanx 时使用。 */
  wanx: ProviderCredentials
  /** MiniMax 官方平台凭证；provider=minimax 时使用（图片与视频）。 */
  minimax: ProviderCredentials
  /** Seedance2.5 凭证；provider=seedance 时使用。 */
  seedance: ProviderCredentials
  /** 默认图片服务商；留空跟随激活服务商。 */
  defaultImageProvider: '' | Provider
  /** 默认视频服务商；留空跟随激活服务商，adapter 使用其内置默认模型。 */
  defaultVideoProvider: '' | Provider
  /** 默认图片模型；留空使用 adapter 内置默认模型。 */
  defaultImageModel: string
  /** 默认视频模型；留空使用 adapter 内置默认模型。 */
  defaultVideoModel: string
  /** 默认图片尺寸，形如 "1024*1024"。 */
  defaultImageSize: string
  /** 默认视频时长（秒），上限 30；具体模型能力由上游校验。 */
  defaultVideoDuration: number
  /**
   * 图片提交传输方式：
   * - `auto`：优先异步网关（幂等 + 超时找回），服务商不支持或探测到不可用时降级同步；
   * - `async`：强制异步，端点不可用即响亮失败（上线验收口径）；
   * - `sync`：强制同步单次提交（无幂等，仅保证「不自动重提」）。
   */
  imageTransport: 'auto' | 'async' | 'sync'
  /**
   * 提交结果未知（超时/断连/5xx 且按幂等键反查无果）后的策略：
   * - `fail`：不自动重提，响亮失败并回报 request_id（默认，最保守）；
   * - `resubmit-same-key`：用同一个幂等键再提交一次（服务端按键去重，不会重复生成）。
   */
  imageUnknownStatePolicy: 'fail' | 'resubmit-same-key'
  /** 单次 HTTP 请求超时（毫秒）。 */
  timeoutMs: number
  /** 视频任务轮询间隔（毫秒）。 */
  pollIntervalMs: number
  /** 视频任务整体超时（毫秒），超时后中止轮询。 */
  pollTimeoutMs: number
  /** 可重试错误的最大重试次数（仅作用于幂等的读取类请求；生图提交永远不重试）。 */
  retryTimes: number
  /** 生成媒体落地目录，相对路径基于进程 cwd 解析；插件启动时解析为绝对路径并打日志。 */
  outputsDir: string
  /** 图片最终结果的品牌水印后处理。 */
  watermark: WatermarkConfig
}

/** 服务商凭证 schema，复用于 threerouter/wanx/seedance。apiKey 可空（未激活的 provider 留空）。 */
const ProviderCredentialsSchema: z<ProviderCredentials> = z.object({
  apiKey: z.string().default('').description('服务商 API Key；未激活的 provider 可留空'),
  baseURL: z.string().default('').description('自定义接口地址，留空使用默认端点'),
})

/** 插件配置 schema，默认服务商为 threerouter（图片+视频统一入口），wanx/seedance 可选。 */
export const Config: z<Config> = z.object({
  provider: z.union(['threerouter', 'wanx', 'minimax', 'seedance']).default('threerouter').description('激活的生成服务商'),
  threerouter: ProviderCredentialsSchema.default({ apiKey: '' }).description('Threerouter 凭证（默认服务商，聚合器）'),
  wanx: ProviderCredentialsSchema.default({ apiKey: '' }).description('万象（wanx）凭证'),
  minimax: ProviderCredentialsSchema.default({ apiKey: '' }).description('MiniMax 官方平台凭证（仅视频）'),
  seedance: ProviderCredentialsSchema.default({ apiKey: '' }).description('Seedance2.5 凭证'),
  defaultImageProvider: z.union(['', 'threerouter', 'wanx', 'minimax', 'seedance']).default('').description('默认图片服务商，留空跟随激活服务商'),
  defaultVideoProvider: z.union(['', 'threerouter', 'wanx', 'minimax', 'seedance']).default('').description('默认视频服务商，留空跟随激活服务商'),
  defaultImageModel: z.string().default('').description('默认图片模型，留空使用服务商内置默认模型'),
  defaultVideoModel: z.string().default('').description('默认视频模型，留空使用服务商内置默认模型'),
  defaultImageSize: z.string().default('3:4').description('默认图片尺寸/比例，如 3:4（qwen/wan 系自动换算为宽*高，threerouter/方舟换算为宽x高）'),
  defaultVideoDuration: z.number().default(5).min(1).max(30).description('默认视频时长（秒），上限 30，由上游模型校验具体能力'),
  imageTransport: z.union(['auto', 'async', 'sync']).default('auto').description('图片提交传输：auto 优先异步（幂等+超时找回）并按需降级，async 强制异步，sync 强制同步单次提交'),
  imageUnknownStatePolicy: z.union(['fail', 'resubmit-same-key']).default('fail').description('提交状态未知时的策略：fail 不重提（默认），resubmit-same-key 用同一幂等键重提一次（服务端按键去重）'),
  timeoutMs: z.number().default(60_000).min(1_000).description('单次 HTTP 请求超时（毫秒）'),
  pollIntervalMs: z.number().default(5_000).min(1_000).description('视频任务轮询间隔（毫秒）'),
  pollTimeoutMs: z.number().default(600_000).min(10_000).description('视频任务整体超时（毫秒）'),
  retryTimes: z.number().default(3).min(0).max(10).description('可重试错误的最大重试次数（仅读取类请求；生图提交永远不重试）'),
  outputsDir: z.string().default('./outputs').description('生成媒体落地目录（插件唯一解析点，启动时打绝对路径日志）'),
  watermark: z.object({
    enabled: z.boolean().default(true).description('是否对最终图片合成品牌水印'),
    text: z.string().default('Threerouter').description('水印文字'),
    opacity: z.number().default(0.68).min(0).max(1).description('主文字不透明度'),
    position: z.union(['bottom-right', 'bottom-left', 'top-right', 'top-left']).default('bottom-right').description('水印位置'),
    fontSizeRatio: z.number().default(0.032).min(0.005).max(0.2).description('字号占图片宽度比例'),
    marginXRatio: z.number().default(0.028).min(0).max(0.3).description('水平留白占比'),
    marginYRatio: z.number().default(0.012).min(0).max(0.3).description('垂直留白占比'),
    glowEnabled: z.boolean().default(true).description('是否加柔光'),
    glowColor: z.string().default('#ffffff').description('柔光颜色'),
    glowBlurRatio: z.number().default(0.18).min(0).max(1).description('柔光半径占字号比例'),
  }).default({
    enabled: true,
    text: 'Threerouter',
    opacity: 0.68,
    position: 'bottom-right',
    fontSizeRatio: 0.032,
    marginXRatio: 0.028,
    marginYRatio: 0.012,
    glowEnabled: true,
    glowColor: '#ffffff',
    glowBlurRatio: 0.18,
  }).description('图片最终结果的品牌水印后处理（内存内合成，只落盘最终图）'),
})

/**
 * 读取指定服务商的凭证，不校验 key 非空。供候选服务商构建时的 key 过滤
 * （resolveModelCandidates 用它跳过未配置 key 的候选），不抛错。
 */
export function peekProviderCredentials(config: Config, provider: Provider): ProviderCredentials {
  return provider === 'threerouter' ? config.threerouter
    : provider === 'wanx' ? config.wanx
    : provider === 'minimax' ? config.minimax
    : config.seedance
}

/**
 * 解析指定服务商的凭证，校验非空。供按模型自动路由的生成工具使用：
 * composer 选中某服务商分组下的模型时，工具以该服务商的凭证直连。
 * @param config - 已校验的插件配置。
 * @param provider - 目标服务商。
 * @returns 服务商凭证与端点。
 * @throws 当该服务商未配置 API Key 时（报错指明缺 key 的 provider 字段）。
 */
export function resolveProviderCredentials(config: Config, provider: Provider): { provider: Provider; apiKey: string; baseURL: string } {
  const creds = peekProviderCredentials(config, provider)
  if (!creds.apiKey || creds.apiKey.trim().length === 0) {
    throw new Error(`dsh-image-video: 服务商 ${provider} 未配置 API Key，请在配置中设置 ${provider}.apiKey`)
  }
  return {
    provider,
    apiKey: creds.apiKey,
    baseURL: creds.baseURL?.trim() || defaultBaseURL(provider),
  }
}

/**
 * 解析当前激活服务商的凭证，校验非空。配置错误在加载或首次调用时响亮失败。
 * @param config - 已校验的插件配置。
 * @returns 激活服务商的凭证与端点。
 * @throws 当激活服务商未配置 API Key 时。
 */
export function resolveActiveProvider(config: Config): { provider: Provider; apiKey: string; baseURL: string } {
  return resolveProviderCredentials(config, config.provider)
}

/** 服务商默认接口地址。 */
function defaultBaseURL(provider: Provider): string {
  switch (provider) {
    case 'threerouter': return 'https://api.threerouter.com/v1'
    case 'wanx': return 'https://dashscope.aliyuncs.com/api/v1'
    case 'minimax': return 'https://api.minimaxi.com/v1'
    case 'seedance': return 'https://ark.cn-beijing.volces.com/api/v3'
  }
}
