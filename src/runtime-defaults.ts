/**
 * 运行时生成默认值（runtime defaults）：桌面 composer 的「文本/图片/视频」tab
 * 会在会话中途切换模型/比例/风格/时长，这些覆盖值只存内存、不落盘——
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
 * 运行时覆盖值集合。字段语义与 generate_image / generate_video 工具参数一一对应：
 * `undefined` = 未覆盖，工具回落 settings（config）持久值。
 * `imageSize` 为映射后的尺寸串（如 '1024*1024'），`videoAspectRatio` 为比例串
 * （如 '16:9'），`imageStyle` 为风格 id（见 {@link IMAGE_STYLE_OPTIONS}）。
 */
export interface RuntimeDefaults {
  /** 图片模型覆盖；undefined 跟随 settings。 */
  imageModel?: string
  /** 图片尺寸覆盖（'宽*高'）；undefined 跟随 settings。 */
  imageSize?: string
  /** 图片风格 id 覆盖；undefined 跟随 settings（不拼接风格后缀）。 */
  imageStyle?: string
  /** 视频模型覆盖；undefined 跟随 settings。 */
  videoModel?: string
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

/**
 * 模型 id 的长度上限（防御性：模型 id 是发给服务商 API 的自由字符串，仅限长度）。
 * 白名单内最长 id 为 35 字符（doubao-seedance-1-0-lite-t2v-250428），取 3 倍
 * 余量收紧上限；settings 手填的自定义模型不受白名单限制，仅限长度。
 */
const MAX_MODEL_ID_LENGTH = 100

/**
 * 桌面 composer 模型下拉的图像模型 → 服务商映射。键与 dsh-plugin-desktop
 * composer-media-tabs.tsx 的 IMAGE_MODEL_OPTIONS 分组选项一一对应（两仓同步）。
 * 映射命中的模型生成时自动路由到对应服务商（使用其凭证），未命中的自定义
 * 模型跟随 settings 激活服务商。
 */
export const IMAGE_MODEL_PROVIDER: Readonly<Record<string, Provider>> = {
  'wan2.1-image': 'threerouter',
  'wanx2.1-t2i-turbo': 'wanx',
  'doubao-seedream-3-0-t2i-250415': 'seedance',
  'doubao-seedream-4-0-250828': 'seedance',
} as const

/** 视频模型 → 服务商映射（语义同 {@link IMAGE_MODEL_PROVIDER}）。 */
export const VIDEO_MODEL_PROVIDER: Readonly<Record<string, Provider>> = {
  'wan2.2-t2v-plus': 'threerouter',
  'doubao-seedance-1-0-pro-250428': 'seedance',
  'doubao-seedance-1-0-lite-t2v-250428': 'seedance',
} as const

/**
 * 解析模型应路由到的服务商。wan2.2-t2v-plus 是 Threerouter 的内置默认视频
 * 模型（万象直连默认亦为同款），为避免歧义固定路由 Threerouter 统一入口。
 * @param kind - 图像或视频模型。
 * @param model - 模型 id（运行时覆盖值 / settings 持久值 / 工具显式参数）。
 * @returns 映射命中的服务商；未命中（自定义模型）返回 undefined。
 */
export function resolveModelProvider(kind: 'image' | 'video', model: string): Provider | undefined {
  if (model === '') return undefined
  return kind === 'image' ? IMAGE_MODEL_PROVIDER[model] : VIDEO_MODEL_PROVIDER[model]
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
 * 白名单/范围守卫：模型 id 须命中 IMAGE/VIDEO_MODEL_PROVIDER 映射（与 composer
 * 下拉预设一致）、imageSize 须命中 IMAGE_SIZE_OPTIONS 白名单、videoDuration 须
 * 1-10 整数；settings 手填的遗留越界值一律忽略（composer 显示「自动」，工具用
 * 内置默认），避免把非法持久值经合并视图当作生效值回显。
 * @param config - 已由 Schemastery 填充默认值的插件配置。
 */
export function extractPersistedDefaults(config: Config): PersistedDefaultsView {
  const persisted: PersistedDefaultsView = {}
  if (resolveModelProvider('image', config.defaultImageModel) !== undefined) {
    persisted.imageModel = config.defaultImageModel
  }
  if (IMAGE_SIZE_OPTIONS.some((option) => option.size === config.defaultImageSize)) {
    persisted.imageSize = config.defaultImageSize
  }
  if (resolveModelProvider('video', config.defaultVideoModel) !== undefined) {
    persisted.videoModel = config.defaultVideoModel
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
    imageModel: defaults.imageModel ?? persisted.imageModel ?? null,
    imageSize: defaults.imageSize ?? persisted.imageSize ?? null,
    imageStyle: defaults.imageStyle ?? null,
    videoModel: defaults.videoModel ?? persisted.videoModel ?? null,
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
  const KNOWN_KEYS: ReadonlyArray<keyof RuntimeDefaults> = ['imageModel', 'imageSize', 'imageStyle', 'videoModel', 'videoAspectRatio', 'videoDuration']
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
    if (key === 'imageModel' || key === 'videoModel') {
      if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_MODEL_ID_LENGTH) {
        return { ok: false, error: `${key} 必须是 1-${MAX_MODEL_ID_LENGTH} 字符的模型名` }
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
