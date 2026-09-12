/**
 * 运行时生成默认值（runtime defaults）：桌面 composer 的「文本/图片/视频」tab
 * 会在会话中途切换服务商/比例/风格/时长，这些覆盖值只存内存、不落盘——
 * 设置页（cordis.patch.yml 持久 config）仍是持久层，插件重载后覆盖值清空、
 * 回落 settings 持久值。这样避免任何配置写入触发宿主 scheduleRestart 重启
 * 整个应用，实现「切换立即生效」。
 *
 * 本文件同时提供回环 REST 路由 `/image-video/defaults`（GET 读当前覆盖值、
 * POST 写入），供桌面渲染进程在同源下调用；复用 media-route.ts 的安全边界：
 * 仅当 webServer 绑定 127.0.0.1 时注册，非本机回环一律不暴露。
 *
 * 请求协议（JSON）：
 *   - GET  → 200，六个字段齐全，值为「运行时覆盖 ?? settings 持久默认」的
 *     合并视图，`null` 表示两者皆未设置（工具使用内置默认）。
 *   - POST → body 为对象，仅接受六个已知键；值为 `null`（清除覆盖，回落
 *     settings 持久默认）或合法值；含未知键 / 非法值 / 不可解析 JSON → 400。
 *   - 其他方法 → 405。
 *
 * @module dsh-image-video/runtime-defaults
 */

import type { MediaWebServer } from './media-route.ts'
import type { Config, Provider } from './config.ts'

/**
 * 运行时覆盖值集合。字段语义与 generate_image / generate_video 工具的
 * 服务商/参数选择一一对应：`undefined` = 未覆盖，工具回落 settings（config）持久值。
 * `imageSize` 为映射后的尺寸串（如 '1024*1024'），`videoAspectRatio` 为比例串
 * （如 '16:9'），`imageStyle` 为风格 id（见 {@link IMAGE_STYLE_OPTIONS}）。
 */
export interface RuntimeDefaults {
  /** 图片服务商覆盖（'threerouter' | 'wanx' | 'seedance'，minimax 无图片能力）；undefined 跟随 settings。 */
  imageProvider?: Provider
  /** 图片尺寸覆盖（'宽*高'）；undefined 跟随 settings。 */
  imageSize?: string
  /** 图片风格 id 覆盖；undefined 跟随 settings（不拼接风格后缀）。 */
  imageStyle?: string
  /** 视频服务商覆盖；undefined 跟随 settings。 */
  videoProvider?: Provider
  /** 视频宽高比覆盖（如 '16:9'）；undefined 跟随 settings。 */
  videoAspectRatio?: string
  /** 视频时长覆盖（秒，1-10）；undefined 跟随 settings。 */
  videoDuration?: number
}

/** POST /image-video/defaults 接受的单字段写入：null 清除覆盖，否则为合法值。 */
export type RuntimeDefaultsPatch = {
  [K in keyof RuntimeDefaults]: RuntimeDefaults[K] | null
}

/** 内存态运行时默认值存储。 */
export interface RuntimeDefaultsStore {
  /** 当前覆盖值快照（只读视图；未覆盖字段不出现在对象上）。 */
  get(): Readonly<RuntimeDefaults>
  /** 合并写入：null 删除该字段覆盖，其余覆盖写入；返回新快照。 */
  patch(patch: RuntimeDefaultsPatch): Readonly<RuntimeDefaults>
  /** 清空全部覆盖（插件卸载语义；路由层暂不暴露）。 */
  reset(): void
}

/** 创建内存态运行时默认值存储。 */
export function createRuntimeDefaultsStore(): RuntimeDefaultsStore {
  let current: RuntimeDefaults = {}
  return {
    get: () => ({ ...current }),
    patch(patch) {
      const next: RuntimeDefaults = { ...current }
      for (const [key, value] of Object.entries(patch) as Array<[keyof RuntimeDefaults, RuntimeDefaultsPatch[keyof RuntimeDefaults]]>) {
        if (value === null) {
          delete next[key]
        } else {
          // 已由 parseDefaultsPatch 归一化：直接写入合法覆盖值
          ;(next as Record<string, unknown>)[key] = value
        }
      }
      current = next
      return { ...current }
    },
    reset() {
      current = {}
    },
  }
}

/** 图片风格选项：id 即协议值，label 供下拉 UI 展示；'' = 自动（不拼接后缀）。 */
export const IMAGE_STYLE_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: '', label: '自动' },
  { id: 'photo', label: '摄影' },
  { id: 'illustration', label: '插画' },
  { id: '3d', label: '3D 渲染' },
  { id: 'anime', label: '动漫' },
  { id: 'ink', label: '水墨' },
] as const

/** 风格 id → 英文提示词后缀（对所有服务商通用：直接拼接进 prompt，不改 API 参数）。 */
const STYLE_SUFFIXES: Record<string, string> = {
  photo: 'photorealistic style, professional photography, high detail',
  illustration: 'flat illustration style, clean vector art',
  '3d': '3D render style, octane render, soft studio lighting',
  anime: 'anime style, cel shading, vibrant colors',
  ink: 'Chinese ink painting style, expressive brush strokes',
}

/**
 * 把风格 id 拼接为英文提示词后缀（生成服务端通用做法：对所有 provider 生效）。
 * @param prompt - 原始提示词。
 * @param style - 风格 id；undefined / '' / 白名单外一律原样返回。
 * @returns 实际发给服务商的提示词。
 */
export function applyImageStyle(prompt: string, style: string | undefined): string {
  if (style === undefined || style === '') return prompt
  const suffix = STYLE_SUFFIXES[style]
  if (suffix === undefined) return prompt
  const trimmed = prompt.trim()
  // 末尾已有分隔符时避免重复逗号
  if (/[,,，、]$/.test(trimmed)) return `${trimmed} ${suffix}`
  return `${trimmed}, ${suffix}`
}

/** 图片尺寸白名单（'宽*高'）；'' 由协议层表示「自动（清除覆盖）」，不在表内。 */
export const IMAGE_SIZE_OPTIONS: ReadonlyArray<{ id: string; label: string; size: string }> = [
  { id: '1:1', label: '1:1', size: '1024*1024' },
  { id: '4:3', label: '4:3', size: '1152*864' },
  { id: '3:4', label: '3:4', size: '864*1152' },
  { id: '16:9', label: '16:9', size: '1280*720' },
  { id: '9:16', label: '9:16', size: '720*1280' },
] as const

/** 视频宽高比白名单。 */
const VIDEO_ASPECT_RATIOS: ReadonlyArray<string> = ['16:9', '9:16', '1:1'] as const

/** 视频时长上下限（与 generate_video 工具的强制规范一致）。 */
const MIN_VIDEO_DURATION = 1
const MAX_VIDEO_DURATION = 10

/** 合法服务商清单（与 config.ts 的 Provider 联合一一对应），供协议层白名单校验。 */
const PROVIDERS: ReadonlyArray<Provider> = ['threerouter', 'wanx', 'minimax', 'seedance'] as const

/** 值是否为合法服务商（'' / 未知值均拒绝）。 */
function isProvider(value: string): value is Provider {
  return (PROVIDERS as ReadonlyArray<string>).includes(value)
}

/**
 * 模型家族规则：按厂商关键词对显式 model 参数做小写包含匹配，得到该模型的家族
 * 候选服务商。维护点按「厂商」而非「模型 id」——新模型（wan3.0、qwen-video、
 * minimax 新版本等）自动命中家族规则，无需逐个登记。
 *
 * 家族事实（2026-09）：threerouter 是聚合器，出所有家族的模型（wan/minimax/seedance
 * 及文本/图片模型）；wanx（阿里百炼）、minimax（官方平台，仅视频）、seedance（火山方舟）
 * 是家族直连商。规则数组顺序即匹配优先级（更具体的家族在前）。
 */
export const MODEL_FAMILY_RULES: ReadonlyArray<{
  /** 家族名（厂商体系）。 */
  family: string
  /** 小写包含匹配的关键词，任一命中即视为该家族。 */
  keywords: readonly string[]
  /** 家族候选服务商（有序）：家族直连商在前，聚合器兜底在后。 */
  providers: readonly Provider[]
  /** 适用生成类型；minimax 官方平台 image_generation 支持图片（t2i + 主体一致性 i2i）。 */
  kinds: ReadonlyArray<'image' | 'video'>
}> = [
  { family: 'minimax', keywords: ['minimax', 'hailuo'], providers: ['minimax', 'threerouter'], kinds: ['video', 'image'] },
  { family: 'seedance', keywords: ['doubao', 'seedance', 'seedream'], providers: ['seedance', 'threerouter'], kinds: ['image', 'video'] },
  // 一条 wan 规则覆盖 wan* 与 wanx*（"wanx2.1-t2i-turbo" 同样包含 "wan"）。
  { family: 'wan', keywords: ['wan'], providers: ['wanx', 'threerouter'], kinds: ['image', 'video'] },
] as const

/**
 * 不支持自定义时长的视频模型集合：上游按模型内置档位出片，请求携带 duration 会被
 * 原样拒绝（"duration customization is not supported"）。工具层对命中模型丢弃
 * duration，并在结果 notes 中透明注明。列表按上游实测维护（2026-09 实测
 * wan2.2-t2v-plus 与 wan2.7-t2v 均拒绝；wan3.0-video / wan2.2-i2v-plus 尚未验证，
 * 暂保持透传，验证后再入表）。
 */
export const VIDEO_DURATION_UNSUPPORTED: ReadonlySet<string> = new Set([
  'wan2.2-t2v-plus',
  'wan2.7-t2v',
])

/**
 * 未显式指定 resolution 时的模型默认档位：Threerouter 的 MiniMax 系要求请求携带
 * resolution（缺失时上游 400），注入默认档位避免默认路径失败；wan 系上游按模型
 * 默认处理，无需注入。
 */
export const VIDEO_MODEL_DEFAULT_RESOLUTION: Readonly<Record<string, string>> = {
  'minimax-h3': '768P',
  'MiniMax-H3': '768P',
}

/**
 * 构建候选服务商序列（工具层按序尝试提交，回退语义见工具实现）：
 * ① 配置链服务商（会话选定 > settings 默认 > 激活服务商）——配置优先原则；
 * ② 显式 model 参数命中 {@link MODEL_FAMILY_RULES} 时的家族候选（直连商在前）；
 * ③ threerouter 聚合器兜底——其目录覆盖所有家族的模型，永远作为最后候选。
 * 未配置 key 的候选一律跳过（不会在提交阶段撞「未配置 API Key」）。
 * @param kind - 生成类型（minimax 家族仅参与视频候选）。
 * @param explicitModel - 工具显式 model 参数；undefined / 空串表示未指定（无家族匹配）。
 * @param configChain - 配置链解析出的服务商（可为 undefined）。
 * @param hasKey - 判断服务商是否已配置 key（工具层以 peekProviderCredentials 实现）。
 * @returns 去重后的候选服务商有序列表；可能为空 = 没有任何已配置凭证（工具层响亮报错）。
 */
export function resolveModelCandidates(
  kind: 'image' | 'video',
  explicitModel: string | undefined,
  configChain: Provider | undefined,
  hasKey: (provider: Provider) => boolean,
): Provider[] {
  const candidates: Provider[] = []
  const push = (provider: Provider): void => {
    if (!candidates.includes(provider) && hasKey(provider)) candidates.push(provider)
  }
  if (configChain) push(configChain)
  if (explicitModel) {
    const lower = explicitModel.toLowerCase()
    for (const rule of MODEL_FAMILY_RULES) {
      if (!rule.kinds.includes(kind)) continue
      if (rule.keywords.some((keyword) => lower.includes(keyword))) {
        for (const provider of rule.providers) push(provider)
        break
      }
    }
  }
  push('threerouter')
  return candidates
}

/** defaults 路由路径（exact 匹配；桌面渲染进程同源调用）。 */
export const DEFAULTS_ROUTE_PATH = '/image-video/defaults'

/** GET / POST 响应体：六字段齐全，null = 无运行时覆盖且无 settings 持久默认（工具用内置默认）。 */
export type RuntimeDefaultsView = RuntimeDefaultsPatch

/**
 * settings 持久默认值视图：{@link extractPersistedDefaults} 从 config 提取出的
 * 合法默认值子集，未提取的字段不出现在对象上（undefined → 合并时跳过）。
 */
export type PersistedDefaultsView = Partial<RuntimeDefaults>

/**
 * 从插件持久 config 提取 settings 默认值，作为 defaults 路由合并视图的回落层。
 * 白名单/范围守卫：服务商须命中 PROVIDERS 白名单（空串 = 跟随激活服务商，不
 * 提取）、imageSize 须命中 IMAGE_SIZE_OPTIONS 白名单、videoDuration 须 1-10 整数；
 * settings 手填的遗留越界值一律忽略（composer 显示「自动」，工具用内置默认），
 * 避免把非法持久值经合并视图当作生效值回显。
 * @param config - 已由 Schemastery 填充默认值的插件配置。
 */
export function extractPersistedDefaults(config: Config): PersistedDefaultsView {
  const persisted: PersistedDefaultsView = {}
  if (isProvider(config.defaultImageProvider)) {
    persisted.imageProvider = config.defaultImageProvider
  }
  if (IMAGE_SIZE_OPTIONS.some((option) => option.size === config.defaultImageSize)) {
    persisted.imageSize = config.defaultImageSize
  }
  if (isProvider(config.defaultVideoProvider)) {
    persisted.videoProvider = config.defaultVideoProvider
  }
  if (
    Number.isInteger(config.defaultVideoDuration) &&
    config.defaultVideoDuration >= MIN_VIDEO_DURATION &&
    config.defaultVideoDuration <= MAX_VIDEO_DURATION
  ) {
    persisted.videoDuration = config.defaultVideoDuration
  }
  return persisted
}

/**
 * 合并为响应视图：运行时覆盖优先，缺失回落 settings 持久默认，两者皆无 → null。
 * 风格与视频比例是纯运行时概念（settings 无对应持久字段），始终取覆盖层。
 */
function toView(defaults: Readonly<RuntimeDefaults>, persisted: PersistedDefaultsView): RuntimeDefaultsView {
  return {
    imageProvider: defaults.imageProvider ?? persisted.imageProvider ?? null,
    imageSize: defaults.imageSize ?? persisted.imageSize ?? null,
    imageStyle: defaults.imageStyle ?? null,
    videoProvider: defaults.videoProvider ?? persisted.videoProvider ?? null,
    videoAspectRatio: defaults.videoAspectRatio ?? null,
    videoDuration: defaults.videoDuration ?? persisted.videoDuration ?? null,
  }
}

/**
 * 校验并归一化 POST body 为存储 patch。严格协议：仅接受六个已知键；
 * null 清除覆盖；'' 表示「自动」（归一化为 null）；其余值按字段白名单/范围校验。
 * @param body - 已 JSON.parse 的请求体（可能是任意值）。
 * @returns 归一化后的 patch；校验失败返回错误信息（字符串）。
 */
export function parseDefaultsPatch(body: unknown): { ok: true; patch: RuntimeDefaultsPatch } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: '请求体必须是 JSON 对象' }
  }
  const record = body as Record<string, unknown>
  const KNOWN_KEYS: ReadonlyArray<keyof RuntimeDefaults> = ['imageProvider', 'imageSize', 'imageStyle', 'videoProvider', 'videoAspectRatio', 'videoDuration']
  for (const key of Object.keys(record)) {
    if (!KNOWN_KEYS.includes(key as keyof RuntimeDefaults)) {
      return { ok: false, error: `未知字段: ${key}` }
    }
  }
  const patch: Record<string, string | number | null> = {}
  for (const key of KNOWN_KEYS) {
    const value = record[key]
    // 键缺失 = 不修改该字段（undefined 跳过）
    if (value === undefined) continue
    if (value === null || value === '') {
      patch[key] = null
      continue
    }
    if (key === 'imageProvider' || key === 'videoProvider') {
      if (typeof value !== 'string' || !isProvider(value)) {
        return { ok: false, error: `${key} 必须是 ${PROVIDERS.join(' / ')} 之一` }
      }
      patch[key] = value
      continue
    }
    if (key === 'imageSize') {
      if (typeof value !== 'string' || !IMAGE_SIZE_OPTIONS.some((option) => option.size === value)) {
        return { ok: false, error: `imageSize 必须是白名单尺寸之一: ${IMAGE_SIZE_OPTIONS.map((o) => o.size).join(' / ')}` }
      }
      patch[key] = value
      continue
    }
    if (key === 'imageStyle') {
      if (typeof value !== 'string' || !IMAGE_STYLE_OPTIONS.some((option) => option.id === value && option.id !== '')) {
        return { ok: false, error: `imageStyle 必须是白名单风格之一: ${IMAGE_STYLE_OPTIONS.filter((o) => o.id !== '').map((o) => o.id).join(' / ')}` }
      }
      patch[key] = value
      continue
    }
    if (key === 'videoAspectRatio') {
      if (typeof value !== 'string' || !VIDEO_ASPECT_RATIOS.includes(value)) {
        return { ok: false, error: `videoAspectRatio 必须是 ${VIDEO_ASPECT_RATIOS.join(' / ')} 之一` }
      }
      patch[key] = value
      continue
    }
    // videoDuration：1-10 整数
    if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN_VIDEO_DURATION || value > MAX_VIDEO_DURATION) {
      return { ok: false, error: `videoDuration 必须是 ${MIN_VIDEO_DURATION}-${MAX_VIDEO_DURATION} 的整数秒` }
    }
    patch[key] = value
  }
  return { ok: true, patch: patch as RuntimeDefaultsPatch }
}

/**
 * 创建 defaults 路由 handler。GET 返回「运行时覆盖 ?? settings 持久默认」合并
 * 视图；POST 校验写入并返回合并视图；非 GET/POST 405；请求体不可解析或校验
 * 失败 400。
 * @param store - 运行时默认值存储。
 * @param persisted - settings 持久默认回落层（{@link extractPersistedDefaults}
 *   提取；未提供时用空对象，即不回落）。
 */
export function createDefaultsRouteHandler(
  store: RuntimeDefaultsStore,
  persisted: PersistedDefaultsView = {},
): (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void> {
  return async (req, res) => {
    const sendJson = (status: number, payload: unknown): void => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(payload))
    }
    if (req.method === 'GET') {
      sendJson(200, toView(store.get(), persisted))
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: 'GET, POST' })
      res.end()
      return
    }
    const chunks: Buffer[] = []
    const body: string = await new Promise((resolve) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', () => resolve(''))
    })
    let parsed: unknown
    try {
      parsed = body === '' ? undefined : JSON.parse(body)
    } catch {
      sendJson(400, { error: '请求体不是合法 JSON' })
      return
    }
    const result = parseDefaultsPatch(parsed)
    if (!result.ok) {
      sendJson(400, { error: result.error })
      return
    }
    sendJson(200, toView(store.patch(result.patch), persisted))
  }
}

/**
 * 把 defaults 路由注册进 webServer。仅回环地址注册：host 非 127.0.0.1 时返回
 * undefined 且不注册——运行时覆盖值属本机会话状态，不暴露到局域网。
 * @param webServer - webServer 服务实例（结构类型，见 media-route.ts）。
 * @param store - 运行时默认值存储。
 * @param persisted - settings 持久默认回落层（同 {@link createDefaultsRouteHandler}）。
 * @returns 路由注销函数；未注册返回 undefined。
 */
export function registerDefaultsRoute(
  webServer: MediaWebServer,
  store: RuntimeDefaultsStore,
  persisted: PersistedDefaultsView = {},
): (() => void) | undefined {
  if (webServer.host !== '127.0.0.1') return undefined
  return webServer.register({
    kind: 'exact',
    path: DEFAULTS_ROUTE_PATH,
    handler: createDefaultsRouteHandler(store, persisted),
  })
}
