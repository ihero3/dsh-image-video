/**
 * 语音（TTS）服务：文本转语音、语音克隆、长文本异步合成。
 *
 * 网关契约（Threevideo / Threerouter 同源，OpenAI 兼容入口 + MiniMax 直通端点）：
 * - `POST {base}/audio/speech` —— 同步合成，响应体就是音频字节（wav/mp3/…）。
 *   OpenAI 兼容字段：`model` / `input` / `voice` / `response_format` / `speed`；
 *   网关扩展字段：`instruction`（语气指令）、`references`（多人对话/音色的参考音频）；
 *   MiniMax 系模型额外接受 `voice_setting`（音高/音量）。
 * - `POST {base}/files/upload` —— multipart 上传克隆样本（`purpose=voice_clone`、
 *   `model`、`file`），返回 `file_id`。
 * - `POST {base}/voice_clone` —— 用 `file_id` + 自定义 `voice_id` 复刻，返回网关
 *   音色 id（形如 `mmxvc_…`），后续合成把 `voice` 传成该 id 即自动路由到复刻账号。
 * - `POST {base}/t2a_async_v2` → `task_id`；`GET {base}/query/t2a_async_query_v2?task_id=…`
 *   轮询；成功后音频地址可能在 `download_url` 或 `file_id`（再经
 *   `GET {base}/files/retrieve?file_id=…` 取下载地址）。
 *
 * 设计口径（与生图/生视频一致）：
 * 1. **同步合成不自动重试**——请求一旦抵达上游就可能计费，超时/断连只如实失败；
 * 2. 响应形态尽量宽容（二进制 / JSON 包 audio / JSON 包 url / MiniMax base_resp），
 *    但**绝不伪造成功**：拿不到音频就抛可操作的错误；
 * 3. 音频统一落到 outputs/（唯一落盘入口），时长优先 ffprobe 实测，其次 WAV 头解析，
 *    最后才用文本估算，并用 `durationEstimated` 如实标注。
 *
 * @module dsh-image-video/media/tts
 */

import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { RequestOptions } from '../http-client.ts'
import { GenerationError, request, requestBinary, requestMultipart, downloadMedia } from '../http-client.ts'
import { toRequestOpts } from '../providers/types.ts'
import type { MediaSaveResult } from '../media.ts'
import { writeOutputFile } from '../media.ts'
import { estimateSpeechMs } from '../workbench/voice.ts'

/** 网关默认同步语音模型（服务端模型目录收录的 OpenAI 兼容 TTS 模型）。 */
export const DEFAULT_TTS_MODEL = 'qwen-audio-3.1-tts-flash'
/** 网关默认语音克隆模型（MiniMax 语音复刻通道）。 */
export const DEFAULT_CLONE_MODEL = 'speech-2.8-hd'
/** 复刻试听文本（MiniMax 要求带上，否则部分账号会拒绝建音色）。 */
export const DEFAULT_CLONE_PREVIEW_TEXT = '这是一段克隆音色的试听文本。'
/** 克隆样本体积上限（MiniMax 官方建议 ≤20MB）。 */
const MAX_CLONE_BYTES = 20 * 1024 * 1024
/** 长文本异步任务默认轮询间隔（语音任务通常几十秒内完成）。 */
const DEFAULT_POLL_INTERVAL_MS = 2_000
/** 长文本异步任务默认整体超时。 */
const DEFAULT_POLL_TIMEOUT_MS = 300_000

/** 音频封装：网关 `response_format` 的取值。 */
export type TtsAudioFormat = 'mp3' | 'wav' | 'pcm' | 'flac' | 'ogg' | 'aac'

/** 封装 → MIME（网关不回 Content-Type 时用）。 */
const AUDIO_MIME: Readonly<Record<TtsAudioFormat, string>> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pcm: 'audio/L16',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
}

/** 模型未显式给音色时的兜底（只对确实需要音色的模型族生效，避免瞎猜）。 */
const DEFAULT_VOICE_BY_MODEL: Readonly<Record<string, string>> = {
  'speech-2.8-hd': 'male-qn-qingse',
  'deepseek-tts': 'stella',
}

/** 一个可选音色。 */
export interface TtsVoice {
  readonly id: string
  readonly name: string
  /** BCP-47 语言码（如 `zh-CN` / `en-US`），用于界面筛选。 */
  readonly languages?: string[]
  readonly gender?: 'female' | 'male' | 'neutral'
  /** 来源：网关预设音色，或本机复刻出来的音色。 */
  readonly kind?: 'system' | 'clone'
  /** 复刻音色使用的是哪个 TTS 模型。 */
  readonly model?: string
  /** 复刻样本的来源名（只记文件名，供溯源）。 */
  readonly source?: string
  readonly createdAt?: string
}

/** 插件配置里的 `tts` 段（字段与 schema 输出一一对应）。 */
export interface TtsSettings {
  readonly provider: 'threevideo'
  readonly apiKey: string
  readonly apiKeyEnv: string
  readonly baseURL: string
  readonly model: string
  readonly defaultVoice: string
  readonly voices: TtsVoice[]
  /** 默认音频封装（同步合成）。 */
  readonly responseFormat: TtsAudioFormat
  /** 语音克隆使用的模型。 */
  readonly cloneModel: string
  /** 默认语气指令（如「用温柔的语气，语速稍慢」）；空 = 不发该字段。 */
  readonly instruction: string
  /** 文本长度超过该值时可走异步端点（工具层据此自动切换）。 */
  readonly asyncThresholdChars: number
}

/** 一次合成请求。 */
export interface TtsRequest {
  readonly text: string
  /** 音色 id：网关预设音色或复刻音色（`mmxvc_…`）。 */
  readonly voiceId?: string
  readonly model?: string
  /** 0.5–2，缺省 1（网关 `speed`）。 */
  readonly speed?: number
  /** 音调倍数 0.5–2，缺省 1（仅 MiniMax 系模型生效，换成半音发送）。 */
  readonly pitch?: number
  /** 音量 0–2，缺省 1（仅 MiniMax 系模型生效）。 */
  readonly volume?: number
  /** 语气指令（如「用温柔的语气，语速稍慢」）。 */
  readonly instruction?: string
  readonly responseFormat?: TtsAudioFormat
  /** 多人对话/音效参考：按顺序给网关的参考音频。 */
  readonly references?: ReadonlyArray<{ readonly audioUrl: string }>
}

/** 一次合成结果（落地为音频文件，交由素材/时间轴消费）。 */
export interface TtsResult {
  readonly audioPath: string
  readonly bytes: number
  readonly durationMs: number
  /** true = 时长是按字数估算的（ffprobe / WAV 头都拿不到真实值）。 */
  readonly durationEstimated: boolean
  readonly contentType: string
  readonly format: TtsAudioFormat | string
  /** 实际发给上游的模型名（含服务商内置默认）。 */
  readonly model: string
  readonly voiceId: string
  /** 透明告知：参数被模型能力限制而改写/忽略的情况。 */
  readonly notes?: string[]
}

/** 语音克隆请求。 */
export interface TtsCloneRequest {
  /** 本地克隆样本（宿主已做路径边界校验）。 */
  readonly audioPath: string
  /** 自定义音色名（网关 `voice_id`），缺省自动生成。 */
  readonly voiceId?: string
  /** 展示名（缺省同 voiceId）。 */
  readonly name?: string
  /** 试听文本。 */
  readonly previewText?: string
  readonly model?: string
}

/** 语音克隆结果。 */
export interface TtsCloneResult {
  /** 后续合成要传的音色 id（网关返回，形如 `mmxvc_…`）。 */
  readonly voiceId: string
  readonly name: string
  readonly model: string
  /** 上传得到的服务端文件 id（原始类型，MiniMax 用数字）。 */
  readonly fileId: string | number
  /** 落库的音色记录（已写进克隆音色库）。 */
  readonly voice: TtsVoice
}

/** 长文本异步任务状态。 */
export type TtsTaskStatus = 'submitted' | 'running' | 'succeeded' | 'failed'

/** 长文本异步任务视图。 */
export interface TtsTask {
  readonly taskId: string
  readonly status: TtsTaskStatus
  readonly model: string
  /** 成功时的合成结果（已落盘）。 */
  readonly audio?: TtsResult
  readonly error?: string
  readonly notes?: string[]
}

/** 语音未配置/凭证缺失时的可操作错误（机器码 `tts/not-ready`）。 */
export class TtsNotReadyError extends Error {
  readonly code = 'tts/not-ready'
  constructor(reason: string) {
    super(`语音还不可用：${reason}`)
    this.name = 'TtsNotReadyError'
  }
}

/** 服务层向界面暴露的可用性视图。 */
export interface TtsAvailability {
  readonly available: boolean
  readonly provider: string
  /** 不可用时的原因（可直接展示给用户）。 */
  readonly reason?: string
  readonly voices: readonly TtsVoice[]
  readonly defaultVoice?: string
  /** 生效的同步合成模型。 */
  readonly model?: string
  /** 生效的克隆模型。 */
  readonly cloneModel?: string
  /** 生效的网关基地址（排查「端点没部署」时用）。 */
  readonly baseURL?: string
  /** 建议从多少字开始走异步（工具层用同一口径）。 */
  readonly asyncThresholdChars?: number
}

/** 语音服务：宿主/工具/界面共用的唯一入口。 */
export interface TtsService {
  /** 当前能否合成（解析凭证 + 合并克隆音色）。 */
  status(): Promise<TtsAvailability>
  /** 同步合成一段语音并落盘。 */
  synthesize(input: TtsRequest, signal?: AbortSignal): Promise<TtsResult>
  /** 上传样本并复刻音色（成功后写进克隆音色库）。 */
  clone(input: TtsCloneRequest, signal?: AbortSignal): Promise<TtsCloneResult>
  /** 提交长文本异步合成任务。 */
  submitAsync(input: TtsRequest, signal?: AbortSignal): Promise<TtsTask>
  /**
   * 查询异步任务；成功时把音频落盘并返回结果。
   * @param options - 取消信号与「任务文本」（拿不到真实时长时按字数估算，可省略）。
   */
  queryAsync(taskId: string, options?: { readonly signal?: AbortSignal; readonly text?: string }): Promise<TtsTask>
  /** 提交并轮询到结束（工具层的长文本入口）。 */
  synthesizeAsync(input: TtsRequest, signal?: AbortSignal): Promise<TtsTask>
}

/** 语音服务依赖。 */
export interface TtsServiceOptions {
  readonly settings: TtsSettings | undefined
  /** 绝对输出目录（唯一落盘入口，见 index.apply 的 resolveOutputsDir）。 */
  readonly outputsDir: string
  readonly timeoutMs: number
  readonly retryTimes: number
  /** 解析凭证与端点：tts 段优先，缺省回落到激活的生成服务商。 */
  readonly resolveCredentials: () => Promise<{ readonly apiKey: string; readonly baseURL: string }>
  /** 已保存的克隆音色（缺省 = 没有克隆库）。 */
  readonly clones?: () => Promise<readonly TtsVoice[]>
  /** 保存一条克隆音色。 */
  readonly saveClone?: (voice: TtsVoice) => Promise<void>
  /** 探测音频真实时长（ffprobe 不可用时返回 undefined）。 */
  readonly probeDurationMs?: (file: string) => Promise<number | undefined>
  readonly pollIntervalMs?: number
  readonly pollTimeoutMs?: number
}

/** 生效的同步合成模型：调用参数 > 配置 > 内置默认。 */
export function effectiveTtsModel(settings: TtsSettings | undefined, requested?: string): string {
  return (requested ?? '').trim() || (settings?.model ?? '').trim() || DEFAULT_TTS_MODEL
}

/** 生效的克隆模型：调用参数 > 配置 > 内置默认。 */
export function effectiveCloneModel(settings: TtsSettings | undefined, requested?: string): string {
  return (requested ?? '').trim() || (settings?.cloneModel ?? '').trim() || DEFAULT_CLONE_MODEL
}

/** 生效音色：调用参数 > 配置默认 > 按模型的兜底（可能为空 = 交给服务端默认）。 */
export function effectiveTtsVoice(
  settings: TtsSettings | undefined,
  model: string,
  requested?: string,
): string {
  const explicit = (requested ?? '').trim()
  if (explicit !== '') return explicit
  const configured = (settings?.defaultVoice ?? '').trim()
  if (configured !== '') return configured
  return DEFAULT_VOICE_BY_MODEL[model] ?? ''
}

/** 文本长度是否达到「建议走异步」的门槛。 */
export function shouldUseAsync(settings: TtsSettings | undefined, text: string): boolean {
  const threshold = settings?.asyncThresholdChars ?? 0
  if (threshold <= 0) return false
  return [...text].length > threshold
}

/** MiniMax 系 TTS 模型判定（支持 `voice_setting` 的模型族）。 */
function isMinimaxSpeechModel(model: string): boolean {
  return /^speech-[\d.]/i.test(model) || /^minimax/i.test(model)
}

/** 音调倍数 → MiniMax 半音（-12..12）。 */
function pitchToSemitones(multiplier: number): number {
  const safe = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
  return Math.max(-12, Math.min(12, Math.round(12 * Math.log2(safe))))
}

/** 把数值夹到区间内。 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

/** 语音请求头（JSON 端点）。 */
function ttsHeaders(apiKey: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
}

/** 把内部请求映射成同步 `/audio/speech` 的请求体。 */
function speechBody(
  model: string,
  voice: string,
  format: TtsAudioFormat,
  input: TtsRequest,
  settings: TtsSettings | undefined,
): { body: Record<string, unknown>; notes: string[] } {
  const notes: string[] = []
  const body: Record<string, unknown> = { model, input: input.text, response_format: format }
  if (voice !== '') body.voice = voice
  const instruction = (input.instruction ?? settings?.instruction ?? '').trim()
  if (instruction !== '') body.instruction = instruction
  if (input.speed !== undefined) body.speed = clamp(input.speed, 0.25, 4)
  if (input.references !== undefined && input.references.length > 0) {
    body.references = input.references.map(reference => ({ audio_url: reference.audioUrl }))
  }
  const wantsTuning = input.pitch !== undefined || input.volume !== undefined
  if (wantsTuning) {
    if (isMinimaxSpeechModel(model)) {
      const voiceSetting: Record<string, unknown> = {}
      if (voice !== '') voiceSetting.voice_id = voice
      if (input.speed !== undefined) voiceSetting.speed = clamp(input.speed, 0.5, 2)
      if (input.volume !== undefined) voiceSetting.vol = clamp(input.volume, 0, 2)
      if (input.pitch !== undefined) voiceSetting.pitch = pitchToSemitones(input.pitch)
      body.voice_setting = voiceSetting
    } else {
      notes.push(`模型 ${model} 不支持音调/音量（仅 MiniMax 系 speech-* 支持），这两个参数已忽略`)
    }
  }
  return { body, notes }
}

/** 把内部请求映射成长文本异步 `/t2a_async_v2` 的请求体（MiniMax 直通形态）。 */
function asyncBody(
  model: string,
  voice: string,
  format: TtsAudioFormat,
  input: TtsRequest,
): Record<string, unknown> {
  const voiceSetting: Record<string, unknown> = {}
  if (voice !== '') voiceSetting.voice_id = voice
  if (input.speed !== undefined) voiceSetting.speed = clamp(input.speed, 0.5, 2)
  if (input.volume !== undefined) voiceSetting.vol = clamp(input.volume, 0, 2)
  if (input.pitch !== undefined) voiceSetting.pitch = pitchToSemitones(input.pitch)
  return {
    model,
    text: input.text,
    ...Object.keys(voiceSetting).length === 0 ? {} : { voice_setting: voiceSetting },
    audio_setting: { format, sample_rate: 32_000, bitrate: 128_000, channel: 1 },
  }
}

/** 取对象路径（支持点号分段），不是对象就返回 undefined。 */
function at(value: unknown, ...path: readonly string[]): unknown {
  let current: unknown = value
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/** 取字符串字段。 */
function stringAt(value: unknown, ...path: readonly string[]): string | undefined {
  const found = at(value, ...path)
  return typeof found === 'string' && found.trim() !== '' ? found.trim() : undefined
}

/** 取 id 字段（网关可能用字符串也可能用数字）。 */
function idAt(value: unknown, ...path: readonly string[]): string | number | undefined {
  const found = at(value, ...path)
  if (typeof found === 'string' && found.trim() !== '') return found.trim()
  if (typeof found === 'number' && Number.isFinite(found)) return found
  return undefined
}

/**
 * 从网关响应里提取可读错误：兼容
 * `{error:{message,code,type}}`、`{error:'…'}`、`{base_resp:{status_code,status_msg}}`、`{message}`。
 * `base_resp.status_code === 0` 视为成功，返回 undefined。
 */
function gatewayError(value: unknown): string | undefined {
  const baseCode = at(value, 'base_resp', 'status_code')
  if (typeof baseCode === 'number' && baseCode !== 0) {
    const message = stringAt(value, 'base_resp', 'status_msg') ?? '网关返回失败状态'
    return `${message}（base_resp ${baseCode}）`
  }
  const error = at(value, 'error')
  if (typeof error === 'string' && error.trim() !== '') return error.trim()
  if (typeof error === 'object' && error !== null) {
    const message = stringAt(error, 'message') ?? stringAt(error, 'msg')
    const code = stringAt(error, 'code') ?? stringAt(error, 'type')
    const joined = [code, message].filter((part): part is string => part !== undefined).join(': ')
    if (joined !== '') return joined
  }
  return stringAt(value, 'message') ?? stringAt(value, 'msg')
}

/** 响应体片段（用于「响应里没有音频」这类错误）。 */
function snippet(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return (text ?? '').slice(0, 200)
}

/** 十六进制串判定（MiniMax 同步接口把音频放在 `data.audio` 里，是 hex）。 */
function looksLikeHex(value: string): boolean {
  return value.length >= 32 && value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value)
}

/** 解码音频载荷：hex（MiniMax）/ base64（部分网关）。 */
function decodeAudioPayload(value: string): Uint8Array | undefined {
  if (looksLikeHex(value)) return new Uint8Array(Buffer.from(value, 'hex'))
  try {
    const decoded = Buffer.from(value, 'base64')
    return decoded.byteLength > 0 ? new Uint8Array(decoded) : undefined
  } catch {
    return undefined
  }
}

/** Content-Type → 音频封装。 */
function formatFromContentType(contentType: string): TtsAudioFormat | undefined {
  const ct = contentType.toLowerCase()
  if (ct.includes('mpeg') || ct.includes('mp3')) return 'mp3'
  if (ct.includes('wav') || ct.includes('wave') || ct.includes('x-wav')) return 'wav'
  if (ct.includes('flac')) return 'flac'
  if (ct.includes('ogg')) return 'ogg'
  if (ct.includes('aac') || ct.includes('mp4')) return 'aac'
  if (ct.includes('l16') || ct.includes('pcm')) return 'pcm'
  return undefined
}

/** 从字节魔数猜封装（网关偶尔不回报 Content-Type）。 */
function formatFromBytes(bytes: Uint8Array): TtsAudioFormat | undefined {
  if (bytes.length >= 12) {
    const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)
    if (riff === 'RIFF') return 'wav'
    if (riff === 'fLaC') return 'flac'
    if (riff === 'OggS') return 'ogg'
    if (riff === 'ID3') return 'mp3'
  }
  // MPEG frame sync：0xFF 0xEx / 0xFx
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return 'mp3'
  return undefined
}

/**
 * WAV 头解析时长（不依赖 ffmpeg）：读 `fmt ` 的 byteRate 与 `data` 的字节数。
 * @param bytes - 文件字节。
 * @returns 毫秒；不是 RIFF/WAVE 或头部不完整时返回 undefined。
 */
export function wavDurationMs(bytes: Uint8Array): number | undefined {
  if (bytes.length < 44) return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)
  const wave = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!)
  if (tag !== 'RIFF' || wave !== 'WAVE') return undefined
  let offset = 12
  let byteRate = 0
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!)
    const size = view.getUint32(offset + 4, true)
    if (id === 'fmt ' && offset + 16 <= bytes.length) {
      byteRate = view.getUint32(offset + 16, true)
    } else if (id === 'data') {
      if (byteRate <= 0 || size <= 0) return undefined
      return Math.round((size / byteRate) * 1000)
    }
    offset += 8 + size + (size % 2)
  }
  return undefined
}

/** 音频扩展名（落盘用）。 */
function audioExtension(format: TtsAudioFormat | string): string {
  return `.${format === 'pcm' ? 'pcm' : format}`
}

/** 克隆样本的 MIME（按扩展名推断）。 */
function audioMimeFromPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.wav': return 'audio/wav'
    case '.mp3': return 'audio/mpeg'
    case '.m4a': return 'audio/mp4'
    case '.flac': return 'audio/flac'
    case '.ogg': return 'audio/ogg'
    case '.aac': return 'audio/aac'
    default: return 'application/octet-stream'
  }
}

/** 从 `/files/upload` 响应里取 file_id。 */
function pickFileId(value: unknown): string | number | undefined {
  return idAt(value, 'file', 'file_id')
    ?? idAt(value, 'file_id')
    ?? idAt(value, 'file', 'id')
    ?? idAt(value, 'data', 'file_id')
    ?? idAt(value, 'data', 'file', 'file_id')
}

/** 从 `/voice_clone` 响应里取网关音色 id。 */
function pickVoiceId(value: unknown): string | undefined {
  return stringAt(value, 'voice_id')
    ?? stringAt(value, 'data', 'voice_id')
    ?? stringAt(value, 'voice', 'voice_id')
    ?? stringAt(value, 'voice', 'id')
    ?? stringAt(value, 'data', 'voice', 'id')
}

/** 从异步提交响应里取 task_id。 */
function pickTaskId(value: unknown): string | undefined {
  const direct = idAt(value, 'task_id') ?? idAt(value, 'id') ?? idAt(value, 'data', 'task_id')
  return direct === undefined ? undefined : String(direct)
}

/** 字节开头是不是 JSON 对象（网关偶尔用 octet-stream 返回错误体）。 */
function looksLikeJsonObject(bytes: Uint8Array): boolean {
  return bytes.length > 0 && bytes[0] === 0x7b
}

/**
 * 建一个真实的网关语音服务。
 * @param options - 见 {@link TtsServiceOptions}。
 * @returns 宿主/工具/界面共用的语音服务。
 */
export function createTtsService(options: TtsServiceOptions): TtsService {
  const { settings, outputsDir, timeoutMs, retryTimes } = options
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const pollTimeoutMs = options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS
  const provider = settings?.provider ?? 'threevideo'
  const defaultFormat = (): TtsAudioFormat => settings?.responseFormat ?? 'mp3'

  /** 解析凭证；缺凭证时抛带机器码的可操作错误。 */
  async function credentials(): Promise<{ apiKey: string; baseURL: string }> {
    try {
      const creds = await options.resolveCredentials()
      if (creds.apiKey.trim() === '') throw new Error('API Key 为空')
      return { apiKey: creds.apiKey, baseURL: creds.baseURL.replace(/\/+$/, '') }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new TtsNotReadyError(
        `${detail}。请在「连接服务」里登录网关账号，`
        + '或为 threevideo.apiKey / tts.apiKey 配置语音服务的 Key',
      )
    }
  }

  /** 合成结果的时长：ffprobe → WAV 头 → 文本估算（标注是否估算）。 */
  async function measure(saved: MediaSaveResult, text: string): Promise<{ durationMs: number; estimated: boolean }> {
    if (options.probeDurationMs !== undefined) {
      const probed = await options.probeDurationMs(saved.localPath).catch(() => undefined)
      if (probed !== undefined && probed > 0) return { durationMs: Math.round(probed), estimated: false }
    }
    const parsed = wavDurationMs(saved.data)
    if (parsed !== undefined) return { durationMs: parsed, estimated: false }
    return { durationMs: estimateSpeechMs(text), estimated: true }
  }

  /** 把「音频字节」或「音频地址」落盘（唯一落盘入口 writeOutputFile / downloadMedia）。 */
  async function persist(
    payload: { readonly bytes?: Uint8Array; readonly contentType?: string; readonly mediaUrl?: string },
    text: string,
    model: string,
    voiceId: string,
    notes: string[],
    signal?: AbortSignal,
  ): Promise<TtsResult> {
    let saved: MediaSaveResult
    if (payload.bytes !== undefined && payload.bytes.byteLength > 0) {
      if (looksLikeJsonObject(payload.bytes)) {
        // 200 + JSON 错误体（Content-Type 没标 json 的网关形态）：不落成「假音频」
        const raw = new TextDecoder().decode(payload.bytes)
        let detail = raw.slice(0, 200)
        try {
          detail = gatewayError(JSON.parse(raw) as unknown) ?? detail
        } catch { /* 保留原文片段 */ }
        throw new GenerationError('task', `语音合成失败：${detail}`, false)
      }
      const detected = formatFromContentType(payload.contentType ?? '') ?? formatFromBytes(payload.bytes) ?? defaultFormat()
      const contentType = (payload.contentType ?? '').startsWith('audio/')
        ? payload.contentType!
        : AUDIO_MIME[detected] ?? 'application/octet-stream'
      saved = await writeOutputFile(payload.bytes, contentType, outputsDir, audioExtension(detected))
    } else if (payload.mediaUrl !== undefined && payload.mediaUrl !== '') {
      const downloaded = await downloadMedia(payload.mediaUrl, { timeoutMs, retryTimes, signal })
      const detected = formatFromContentType(downloaded.contentType) ?? formatFromBytes(downloaded.data) ?? defaultFormat()
      saved = await writeOutputFile(downloaded.data, downloaded.contentType, outputsDir, audioExtension(detected), payload.mediaUrl)
    } else {
      throw new GenerationError('task', '网关没有返回音频字节，也没有返回音频地址', false)
    }
    const resolvedFormat = formatFromContentType(saved.contentType) ?? formatFromBytes(saved.data) ?? defaultFormat()
    const measured = await measure(saved, text)
    return {
      audioPath: saved.localPath,
      bytes: saved.bytes,
      durationMs: measured.durationMs,
      durationEstimated: measured.estimated,
      contentType: saved.contentType,
      format: resolvedFormat,
      model,
      voiceId,
      ...notes.length === 0 ? {} : { notes },
    }
  }

  /** 解析 `POST /audio/speech` 的响应（二进制或 JSON 包装形态）。 */
  async function readSpeechResponse(
    response: { readonly data: Uint8Array; readonly contentType: string },
    text: string,
    model: string,
    voiceId: string,
    notes: string[],
    signal?: AbortSignal,
  ): Promise<TtsResult> {
    const contentType = response.contentType.toLowerCase()
    if (contentType.includes('json') || contentType.includes('text/plain')) {
      const raw = new TextDecoder().decode(response.data)
      let parsed: unknown
      try {
        parsed = JSON.parse(raw) as unknown
      } catch {
        throw new GenerationError('task', `网关返回了非音频内容：${raw.slice(0, 200)}`, false)
      }
      const error = gatewayError(parsed)
      if (error !== undefined) throw new GenerationError('task', `语音合成失败：${error}`, false)
      const audioPayload = stringAt(parsed, 'data', 'audio')
        ?? stringAt(parsed, 'audio')
        ?? stringAt(parsed, 'data', 'audio_base64')
        ?? stringAt(parsed, 'audio_base64')
      const bytes = audioPayload === undefined ? undefined : decodeAudioPayload(audioPayload)
      const mediaUrl = stringAt(parsed, 'audio_url')
        ?? stringAt(parsed, 'download_url')
        ?? stringAt(parsed, 'url')
        ?? stringAt(parsed, 'data', 'url')
        ?? stringAt(parsed, 'data', 'audio_url')
      return await persist(
        {
          ...bytes === undefined ? {} : { bytes, contentType: AUDIO_MIME[defaultFormat()] },
          ...mediaUrl === undefined ? {} : { mediaUrl },
        },
        text, model, voiceId, notes, signal,
      )
    }
    if (response.data.byteLength === 0) {
      throw new GenerationError('task', '网关返回了空音频（0 字节）', false)
    }
    return await persist({ bytes: response.data, contentType: response.contentType }, text, model, voiceId, notes, signal)
  }

  /** 同步合成（`POST /audio/speech`）。 */
  async function synthesize(input: TtsRequest, signal?: AbortSignal): Promise<TtsResult> {
    const creds = await credentials()
    if (input.text.trim() === '') throw new Error('合成文本为空：text 必须是非空字符串')
    const model = effectiveTtsModel(settings, input.model)
    const voice = effectiveTtsVoice(settings, model, input.voiceId)
    const { body, notes } = speechBody(model, voice, input.responseFormat ?? defaultFormat(), input, settings)
    const url = `${creds.baseURL}/audio/speech`
    const requestOptions: RequestOptions = toRequestOpts('POST', url, ttsHeaders(creds.apiKey), body, {
      apiKey: creds.apiKey,
      baseURL: creds.baseURL,
      // 合成是「可能已计费」的写操作：永不自动重试（与同步生图同口径）
      timeoutMs: Math.max(timeoutMs, 120_000),
      retryTimes: 0,
      signal,
    })
    const response = await requestBinary(requestOptions)
    return await readSpeechResponse(response, input.text, model, voice === '' ? '(服务商默认)' : voice, notes, signal)
  }

  /** 取异步任务里的下载地址（必要时走 `/files/retrieve`）。 */
  async function resolveAudioUrl(
    data: unknown,
    creds: { readonly apiKey: string; readonly baseURL: string },
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    const direct = stringAt(data, 'download_url')
      ?? stringAt(data, 'audio_url')
      ?? stringAt(data, 'url')
      ?? stringAt(data, 'data', 'download_url')
      ?? stringAt(data, 'data', 'audio_url')
      ?? stringAt(data, 'data', 'url')
    if (direct !== undefined) return direct
    const fileId = idAt(data, 'file_id') ?? idAt(data, 'data', 'file_id')
    if (fileId === undefined) return undefined
    const url = `${creds.baseURL}/files/retrieve?file_id=${encodeURIComponent(String(fileId))}`
    const retrieved = await request(toRequestOpts('GET', url, ttsHeaders(creds.apiKey), undefined, {
      apiKey: creds.apiKey, baseURL: creds.baseURL, timeoutMs, retryTimes, signal,
    }))
    return stringAt(retrieved, 'file', 'download_url')
      ?? stringAt(retrieved, 'download_url')
      ?? stringAt(retrieved, 'file', 'url')
      ?? stringAt(retrieved, 'url')
  }

  /** 语音克隆（上传样本 → 建音色 → 写入克隆音色库）。 */
  async function clone(input: TtsCloneRequest, signal?: AbortSignal): Promise<TtsCloneResult> {
    const creds = await credentials()
    const model = effectiveCloneModel(settings, input.model)
    const data = await readFile(input.audioPath)
    if (data.byteLength === 0) throw new Error(`克隆样本是空文件：${input.audioPath}`)
    if (data.byteLength > MAX_CLONE_BYTES) {
      throw new Error(
        `克隆样本 ${(data.byteLength / 1024 / 1024).toFixed(1)}MB 超过上限 ${MAX_CLONE_BYTES / 1024 / 1024}MB：`
        + '请裁剪到 10 秒–2 分钟、20MB 以内的清晰人声',
      )
    }
    const sampleName = basename(input.audioPath)
    const form = new FormData()
    form.append('purpose', 'voice_clone')
    form.append('model', model)
    form.append('file', new Blob([new Uint8Array(data)], { type: audioMimeFromPath(input.audioPath) }), sampleName)
    const uploaded = await requestMultipart({
      url: `${creds.baseURL}/files/upload`,
      // 不设 Content-Type：让 fetch 自己带 multipart boundary
      headers: { Authorization: `Bearer ${creds.apiKey}` },
      form,
      timeoutMs: Math.max(timeoutMs, 120_000),
      // 上传失败可能已在服务端留下文件：不自动重试，避免堆积
      retryTimes: 0,
      signal,
    })
    const uploadError = gatewayError(uploaded.data)
    if (uploadError !== undefined) throw new GenerationError('task', `语音克隆上传失败：${uploadError}`, false)
    const fileId = pickFileId(uploaded.data)
    if (fileId === undefined) {
      throw new GenerationError('task', `语音克隆上传未返回 file_id：${snippet(uploaded.data)}`, false)
    }

    const requested = (input.voiceId ?? '').trim()
    const voiceKey = requested !== '' ? requested : `vc_${Date.now().toString(36)}`
    const body = {
      file_id: fileId,
      voice_id: voiceKey,
      text: (input.previewText ?? '').trim() || DEFAULT_CLONE_PREVIEW_TEXT,
      model,
    }
    const cloned = await request(toRequestOpts('POST', `${creds.baseURL}/voice_clone`, ttsHeaders(creds.apiKey), body, {
      apiKey: creds.apiKey,
      baseURL: creds.baseURL,
      timeoutMs: Math.max(timeoutMs, 180_000),
      // 同一 voice_id 重复提交按 id 覆盖，网络抖动重试不会造出两个音色
      retryTimes,
      signal,
    }))
    const cloneError = gatewayError(cloned)
    if (cloneError !== undefined) throw new GenerationError('task', `语音克隆失败：${cloneError}`, false)
    const voiceId = pickVoiceId(cloned) ?? voiceKey
    const displayName = (input.name ?? '').trim()
    const voice: TtsVoice = {
      id: voiceId,
      name: displayName !== '' ? displayName : voiceKey,
      kind: 'clone',
      model,
      source: sampleName,
      createdAt: new Date().toISOString(),
    }
    await options.saveClone?.(voice)
    return { voiceId, name: voice.name, model, fileId, voice }
  }

  /** 提交长文本异步合成（`POST /t2a_async_v2`）。 */
  async function submitAsync(input: TtsRequest, signal?: AbortSignal): Promise<TtsTask> {
    const creds = await credentials()
    if (input.text.trim() === '') throw new Error('合成文本为空：text 必须是非空字符串')
    const model = effectiveTtsModel(settings, input.model)
    const voice = effectiveTtsVoice(settings, model, input.voiceId)
    const body = asyncBody(model, voice, input.responseFormat ?? defaultFormat(), input)
    const data = await request(toRequestOpts('POST', `${creds.baseURL}/t2a_async_v2`, ttsHeaders(creds.apiKey), body, {
      apiKey: creds.apiKey, baseURL: creds.baseURL, timeoutMs: Math.max(timeoutMs, 60_000), retryTimes: 0, signal,
    }))
    const error = gatewayError(data)
    if (error !== undefined) throw new GenerationError('task', `长文本合成提交失败：${error}`, false)
    const taskId = pickTaskId(data)
    if (taskId === undefined) {
      throw new GenerationError('task', `长文本合成未返回 task_id：${snippet(data)}`, false)
    }
    return { taskId, status: 'submitted', model }
  }

  /** 查询长文本任务（`GET /query/t2a_async_query_v2`），成功后落盘。 */
  async function queryAsync(
    taskId: string,
    queryOptions: { readonly signal?: AbortSignal; readonly text?: string } = {},
  ): Promise<TtsTask> {
    const creds = await credentials()
    const model = effectiveTtsModel(settings)
    const url = `${creds.baseURL}/query/t2a_async_query_v2?task_id=${encodeURIComponent(taskId)}`
    const data = await request(toRequestOpts('GET', url, ttsHeaders(creds.apiKey), undefined, {
      apiKey: creds.apiKey, baseURL: creds.baseURL, timeoutMs, retryTimes, signal: queryOptions.signal,
    }))
    const error = gatewayError(data)
    if (error !== undefined) return { taskId, status: 'failed', model, error }
    const raw = (stringAt(data, 'status') ?? stringAt(data, 'data', 'status') ?? '').toLowerCase()
    if (/success|succeed|completed|finished|done/.test(raw)) {
      try {
        const mediaUrl = await resolveAudioUrl(data, creds, queryOptions.signal)
        const audioPayload = stringAt(data, 'data', 'audio') ?? stringAt(data, 'audio')
        const bytes = audioPayload === undefined ? undefined : decodeAudioPayload(audioPayload)
        if (mediaUrl === undefined && bytes === undefined) {
          return { taskId, status: 'failed', model, error: `任务已完成但未返回音频地址：${snippet(data)}` }
        }
        const audio = await persist(
          { ...bytes === undefined ? {} : { bytes }, ...mediaUrl === undefined ? {} : { mediaUrl } },
          queryOptions.text ?? '',
          model,
          effectiveTtsVoice(settings, model),
          [],
          queryOptions.signal,
        )
        return { taskId, status: 'succeeded', model, audio }
      } catch (cause) {
        return {
          taskId, status: 'failed', model,
          error: cause instanceof Error ? cause.message : String(cause),
        }
      }
    }
    if (/fail|error|cancel|expired|reject/.test(raw)) {
      return {
        taskId,
        status: 'failed',
        model,
        error: stringAt(data, 'base_resp', 'status_msg') ?? stringAt(data, 'message') ?? `任务状态：${raw || '未知'}`,
      }
    }
    return { taskId, status: 'running', model }
  }

  /** 提交并轮询到结束；超时只报告 task_id，绝不重新提交。 */
  async function synthesizeAsync(input: TtsRequest, signal?: AbortSignal): Promise<TtsTask> {
    const submitted = await submitAsync(input, signal)
    const deadline = Date.now() + pollTimeoutMs
    let current = submitted
    while (current.status === 'submitted' || current.status === 'running') {
      if (signal?.aborted) throw new GenerationError('timeout', '任务已被取消', false)
      if (Date.now() > deadline) {
        throw new GenerationError(
          'timeout',
          `长文本合成超时（${Math.round(pollTimeoutMs / 1000)}s），任务 ${current.taskId} 仍在执行：`
          + '稍后用 voice/async-status 按 task_id 继续查询，不要重新提交',
          false,
        )
      }
      await new Promise<void>(resolve => setTimeout(resolve, pollIntervalMs))
      current = await queryAsync(current.taskId, { signal, text: input.text })
    }
    return current
  }

  /** 可用性视图（解析凭证 + 合并克隆音色）。 */
  async function status(): Promise<TtsAvailability> {
    const settingsVoices = settings?.voices ?? []
    const clones = (await options.clones?.().catch(() => [])) ?? []
    const base: Omit<TtsAvailability, 'available'> = {
      provider,
      voices: [...settingsVoices, ...clones],
      model: effectiveTtsModel(settings),
      cloneModel: effectiveCloneModel(settings),
      asyncThresholdChars: settings?.asyncThresholdChars ?? 0,
      ...(settings?.defaultVoice ? { defaultVoice: settings.defaultVoice } : {}),
    }
    try {
      const creds = await credentials()
      return { available: true, ...base, baseURL: creds.baseURL }
    } catch (error) {
      return {
        available: false,
        ...base,
        reason: error instanceof Error ? error.message : String(error),
      }
    }
  }

  return { status, synthesize, clone, submitAsync, queryAsync, synthesizeAsync }
}
