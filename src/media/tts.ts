/**
 * TTS 接入点（`P0-1` 应用层）：**契约先定、实现等接口**。
 *
 * owner 口径（2026-10-23）：Threevideo 后续会提供 TTS 服务，调用方式与生图/生视频一致；
 * 接口联调通过前，先把应用层做完 —— 也就是"谁能念、念什么、多久、错了怎么说"。
 *
 * 因此本模块只做三件事：
 * 1. 定义 provider 的**唯一契约**（接入时只实现这一个接口，别处不改）；
 * 2. 给出**可用性视图**（未配置/未接入 → 明确原因，界面照着显示）；
 * 3. 未接入时**绝不假装成功**：`synthesize` 抛带机器码的可操作错误。
 *
 * @module dsh-image-video/media/tts
 */

/** 一个可选音色。 */
export interface TtsVoice {
  readonly id: string
  readonly name: string
  /** BCP-47 语言码（如 `zh-CN` / `en-US`），用于界面筛选。 */
  readonly languages?: string[]
  readonly gender?: 'female' | 'male' | 'neutral'
}

/** 插件配置里的 `tts` 段（字段与 schema 输出一一对应；空值 = 没接 TTS）。 */
export interface TtsSettings {
  readonly provider: 'threevideo'
  readonly apiKey: string
  readonly apiKeyEnv: string
  readonly baseURL: string
  readonly model: string
  readonly defaultVoice: string
  /** 音色清单：接口上线前由配置提供；上线后可改为远端拉取。 */
  readonly voices: TtsVoice[]
}

/** 一次合成请求（语速/音调/音量都是可选的归一化参数）。 */
export interface TtsRequest {
  readonly text: string
  readonly voiceId?: string
  /** 0.5–2，缺省 1。 */
  readonly speed?: number
  /** -12–12 半音，缺省 0。 */
  readonly pitch?: number
  /** 0–2，缺省 1。 */
  readonly volume?: number
}

/** 一次合成结果（落地为音频文件，交由素材/时间轴消费）。 */
export interface TtsResult {
  readonly audioPath: string
  readonly bytes: number
  readonly durationMs: number
}

/** TTS 未接入/未配置时的可操作错误（机器码 `tts/not-ready`）。 */
export class TtsNotReadyError extends Error {
  readonly code = 'tts/not-ready'
  constructor(reason: string) {
    super(`配音还不可用：${reason}`)
    this.name = 'TtsNotReadyError'
  }
}

/** 服务层向界面暴露的可用性视图。 */
export interface TtsAvailability {
  readonly available: boolean
  readonly provider: 'threevideo'
  /** 不可用时的原因（可直接展示给用户）。 */
  readonly reason?: string
  readonly voices: readonly TtsVoice[]
  readonly defaultVoice?: string
  readonly model?: string
}

/**
 * 从配置推导"现在能不能配音"。
 * @param settings - 插件配置的 `tts` 段（可能为空）。
 * @returns 可用性视图；`available` 为 false 时 `reason` 一定可读。
 */
export function ttsAvailability(settings: TtsSettings | undefined): TtsAvailability {
  const unconfigured = settings === undefined
    || (settings.voices.length === 0 && settings.apiKey === '' && settings.model === '')
  if (unconfigured) {
    return {
      available: false,
      provider: 'threevideo',
      reason: '未配置 TTS 服务：接口联调通过后填入服务商与音色即可（当前配音计划仍可预览）',
      voices: [],
    }
  }
  return {
    available: false,
    provider: settings.provider,
    reason: 'TTS 接口尚未接入：等待 Threevideo TTS API 联调通过（配音计划/时长估算已可用）',
    voices: settings.voices,
    ...settings.defaultVoice === '' ? {} : { defaultVoice: settings.defaultVoice },
    ...settings.model === '' ? {} : { model: settings.model },
  }
}

/** TTS 提供方契约：接口上线后**只实现这一个接口**。 */
export interface TtsProvider {
  readonly name: string
  /** 拉取可用音色（接口上线后可换成远端列表）。 */
  listVoices(): Promise<readonly TtsVoice[]>
  /** 合成一段语音并落地成音频文件。 */
  synthesize(input: TtsRequest, signal?: AbortSignal): Promise<TtsResult>
}

/**
 * 建一个"尚未接入"的 provider：所有合成调用都抛 {@link TtsNotReadyError}。
 *
 * 接口上线后，把这里换成真正的 HTTP 实现即可（`POST {baseURL}/audio/speech`，
 * 语义与 `image/generations` 一致：鉴权头、超时、错误码映射复用 src/http-client.ts）。
 * @param settings - 插件配置的 `tts` 段。
 * @returns 只读的 provider 占位实现。
 */
export function createTtsProvider(settings: TtsSettings | undefined): TtsProvider {
  const availability = ttsAvailability(settings)
  return {
    name: 'threevideo',
    listVoices: async () => availability.voices,
    synthesize: async () => {
      throw new TtsNotReadyError(availability.reason ?? 'TTS 服务未配置')
    },
  }
}
