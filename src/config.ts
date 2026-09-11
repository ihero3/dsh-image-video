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

/** 插件配置：服务商选择、凭证、模型、生成默认值、轮询与重试策略。 */
export interface Config {
  /** 当前激活的服务商，切换后立即生效（HMR）。 */
  provider: Provider
  /** Threerouter 凭证；provider=threerouter 时使用（支持图片+视频）。 */
  threerouter: ProviderCredentials
  /** 万象（wanx）凭证；provider=wanx 时使用。 */
  wanx: ProviderCredentials
  /** MiniMax 官方平台凭证；provider=minimax 时使用（仅视频，按官方 video-generation v2 实现）。 */
  minimax: ProviderCredentials
  /** Seedance2.5 凭证；provider=seedance 时使用。 */
  seedance: ProviderCredentials
  /** 默认图片服务商；留空跟随激活服务商（minimax 无图片生成能力，不参与图片默认）。 */
  defaultImageProvider: '' | Exclude<Provider, 'minimax'>
  /** 默认视频服务商；留空跟随激活服务商，adapter 使用其内置默认模型。 */
  defaultVideoProvider: '' | Provider
  /** 默认图片模型；留空使用 adapter 内置默认模型。 */
  defaultImageModel: string
  /** 默认视频模型；留空使用 adapter 内置默认模型。 */
  defaultVideoModel: string
  /** 默认图片尺寸，形如 "1024*1024"。 */
  defaultImageSize: string
  /** 默认视频时长（秒），上限 10。 */
  defaultVideoDuration: number
  /** 单次 HTTP 请求超时（毫秒）。 */
  timeoutMs: number
  /** 视频任务轮询间隔（毫秒）。 */
  pollIntervalMs: number
  /** 视频任务整体超时（毫秒），超时后中止轮询。 */
  pollTimeoutMs: number
  /** 可重试错误的最大重试次数（鉴权失败等不可重试错误立即抛出）。 */
  retryTimes: number
  /** 生成媒体落地目录，相对路径基于进程 cwd 解析。 */
  outputsDir: string
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
  defaultImageProvider: z.union(['', 'threerouter', 'wanx', 'seedance']).default('').description('默认图片服务商，留空跟随激活服务商'),
  defaultVideoProvider: z.union(['', 'threerouter', 'wanx', 'minimax', 'seedance']).default('').description('默认视频服务商，留空跟随激活服务商'),
  defaultImageModel: z.string().default('').description('默认图片模型，留空使用服务商内置默认模型'),
  defaultVideoModel: z.string().default('').description('默认视频模型，留空使用服务商内置默认模型'),
  defaultImageSize: z.string().default('1024*1024').description('默认图片尺寸，如 1024*1024'),
  defaultVideoDuration: z.number().default(5).min(1).max(10).description('默认视频时长（秒），上限 10'),
  timeoutMs: z.number().default(60_000).min(1_000).description('单次 HTTP 请求超时（毫秒）'),
  pollIntervalMs: z.number().default(5_000).min(1_000).description('视频任务轮询间隔（毫秒）'),
  pollTimeoutMs: z.number().default(300_000).min(10_000).description('视频任务整体超时（毫秒）'),
  retryTimes: z.number().default(3).min(0).max(10).description('可重试错误的最大重试次数'),
  outputsDir: z.string().default('./outputs').description('生成媒体落地目录'),
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
