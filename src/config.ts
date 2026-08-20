/**
 * 插件配置类型与 Schemastery schema。所有部署可变参数都通过 Config 暴露，
 * 不存在硬编码可调参数；切换服务商只需改 `provider` 字段，HMR 自动重载。
 * @module dsh-image-video/config
 */

import z from '@deepseek-ai/schemastery'

/** 支持的生成服务商。 */
export type Provider = 'kling' | 'seedance'

/** 单个服务商的凭证与自定义接口地址。 */
export interface ProviderCredentials {
  /** 服务商 API Key；切换 provider 后对应 key 立即生效。 */
  apiKey: string
  /** 自定义接口地址，留空使用服务商默认端点。 */
  baseURL?: string
}

/** 插件配置：服务商选择、凭证、生成默认值、轮询与重试策略。 */
export interface Config {
  /** 当前激活的服务商，切换后立即生效（HMR）。 */
  provider: Provider
  /** Kling 凭证；provider=kling 时使用。 */
  kling: ProviderCredentials
  /** Seedance2.5 凭证；provider=seedance 时使用。 */
  seedance: ProviderCredentials
  /** 默认图片尺寸，形如 "1024x1024"。 */
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

/** 服务商凭证 schema，复用于 kling 与 seedance。 */
const ProviderCredentialsSchema: z<ProviderCredentials> = z.object({
  apiKey: z.string().required().description('服务商 API Key'),
  baseURL: z.string().description('自定义接口地址，留空使用默认端点'),
})

/** 插件配置 schema，默认值贴近 Kling / Seedance 常用参数。 */
export const Config: z<Config> = z.object({
  provider: z.union(['kling', 'seedance']).default('kling').description('激活的生成服务商'),
  kling: ProviderCredentialsSchema.default({ apiKey: '' }).description('Kling 凭证'),
  seedance: ProviderCredentialsSchema.default({ apiKey: '' }).description('Seedance2.5 凭证'),
  defaultImageSize: z.string().default('1024x1024').description('默认图片尺寸，如 1024x1024'),
  defaultVideoDuration: z.number().default(5).min(1).max(10).description('默认视频时长（秒），上限 10'),
  timeoutMs: z.number().default(60_000).min(1_000).description('单次 HTTP 请求超时（毫秒）'),
  pollIntervalMs: z.number().default(5_000).min(1_000).description('视频任务轮询间隔（毫秒）'),
  pollTimeoutMs: z.number().default(300_000).min(10_000).description('视频任务整体超时（毫秒）'),
  retryTimes: z.number().default(3).min(0).max(10).description('可重试错误的最大重试次数'),
  outputsDir: z.string().default('./outputs').description('生成媒体落地目录'),
})

/**
 * 解析当前激活服务商的凭证，校验非空。配置错误在加载或首次调用时响亮失败。
 * @param config - 已校验的插件配置。
 * @returns 激活服务商的凭证与端点。
 * @throws 当激活服务商未配置 API Key 时。
 */
export function resolveActiveProvider(config: Config): { provider: Provider; apiKey: string; baseURL: string } {
  const creds = config.provider === 'kling' ? config.kling : config.seedance
  if (!creds.apiKey || creds.apiKey.trim().length === 0) {
    throw new Error(`dsh-image-video: 服务商 ${config.provider} 未配置 API Key，请在配置中设置 ${config.provider}.apiKey`)
  }
  return {
    provider: config.provider,
    apiKey: creds.apiKey,
    baseURL: creds.baseURL?.trim() || defaultBaseURL(config.provider),
  }
}

/** 服务商默认接口地址。 */
function defaultBaseURL(provider: Provider): string {
  switch (provider) {
    case 'kling': return 'https://dashscope.aliyuncs.com/api/v1'
    case 'seedance': return 'https://ark.cn-beijing.volces.com/api/v3'
  }
}
