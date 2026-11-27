/**
 * 语音工具：`generate_speech`（文本转语音）与 `clone_voice`（语音克隆）。
 *
 * 两个工具都只是 {@link TtsService} 的薄封装——参数语义、错误口径、落盘位置与
 * 工作台里的「合成试听 / 克隆」严格一致（同一份服务实现），所以对话里生成的音频
 * 与界面里生成的音频行为相同：都落在 outputs/、都回报真实模型与实际音色。
 *
 * 长文本口径：`mode: 'auto'`（默认）在字数超过配置阈值时自动改走
 * `/t2a_async_v2` 异步端点（提交 → 轮询），避免同步请求被网关超时掐断。
 *
 * @module dsh-image-video/tools/speech
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { TtsAudioFormat, TtsRequest, TtsService, TtsSettings, TtsTask } from '../media/tts.ts'
import { shouldUseAsync, TtsNotReadyError } from '../media/tts.ts'
import { downloadMedia } from '../http-client.ts'

/** 工具依赖。 */
export interface SpeechToolDeps {
  readonly tts: TtsService
  readonly settings: TtsSettings | undefined
  /** 生成媒体落地的绝对目录（相对路径参数按它解析）。 */
  readonly outputsDir?: string
  readonly timeoutMs?: number
}

/** 合成模式：自动（长文本走异步）/ 强制同步 / 强制异步。 */
type SpeechMode = 'auto' | 'sync' | 'async'

/** 音频封装白名单。 */
const AUDIO_FORMATS: readonly TtsAudioFormat[] = ['mp3', 'wav', 'pcm', 'flac', 'ogg', 'aac']

/** 合成结果（工具输出值）。 */
interface GenerateSpeechOutput {
  provider: string
  model: string
  voice: string
  format: string
  localPath: string
  bytes: number
  durationMs: number
  durationEstimated: boolean
  mode: 'sync' | 'async'
  taskId?: string
  notes?: string[]
}

/**
 * 创建 `generate_speech` 工具。
 * @param deps - 语音服务与配置。
 */
export function createGenerateSpeechTool(deps: SpeechToolDeps) {
  const { tts, settings } = deps
  const threshold = settings?.asyncThresholdChars ?? 0
  return defineTool({
    name: 'generate_speech',
    description:
      '把文本合成为语音（TTS）并保存成本地音频文件；支持音色、语气指令、语速/音调/音量、多人对话参考音频，'
      + '长文本自动改走异步端点。'
      + '服务商固定为 Threevideo / Threerouter 网关（与生图/生视频同一个 Key），不要自行调用其他 TTS API。'
      + `模型取值：调用参数 model > 配置 tts.model > 网关默认（qwen-audio-3.1-tts-flash）；`
      + `音色 voice 可以是网关预设音色，也可以是 clone_voice 克隆出来的 mmxvc_… id。`
      + `${threshold > 0 ? `mode=auto 时超过 ${threshold} 字会自动走异步端点。` : ''}`
      + '参数：text（必填）、voice、model、format（mp3/wav/pcm/flac/ogg/aac）、instruction（如「用温柔的语气，语速稍慢」）、'
      + 'speed（0.5-2）、pitch（音调倍数 0.5-2，仅 MiniMax 系生效）、volume（0-2，仅 MiniMax 系生效）、'
      + 'references（多人对话/音效参考音频地址数组）、mode（auto/sync/async）。',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: '要朗读的文本。多人对话可写成剧本式文本，并配 references 指定各角色参考音频。',
      },
      voice: {
        type: 'string',
        description: '音色 id：网关预设音色（如 stella / longanhuan_v3.1 / male-qn-qingse）或克隆音色（mmxvc_…）。留空用配置默认。',
      },
      model: {
        type: 'string',
        description: 'TTS 模型名，如 qwen-audio-3.1-tts-flash、qwen-audio-3.1-tts-next、speech-2.8-hd、deepseek-tts。留空用配置默认。',
      },
      format: {
        type: 'string',
        enum: [...AUDIO_FORMATS],
        description: '音频封装，留空用配置默认（mp3）。',
      },
      instruction: {
        type: 'string',
        description: '语气/风格指令，如「用温柔的语气，语速稍慢」。留空用配置默认。',
      },
      speed: { type: 'number', description: '语速倍数 0.5-2，留空 1。' },
      pitch: { type: 'number', description: '音调倍数 0.5-2（仅 MiniMax 系 speech-* 模型生效），留空 1。' },
      volume: { type: 'number', description: '音量 0-2（仅 MiniMax 系 speech-* 模型生效），留空 1。' },
      references: {
        type: 'array',
        description: '参考音频（多人对话/音色参考）：每项为音频地址或用 {audio_url} 对象。',
        items: { type: 'string' },
      },
      mode: {
        type: 'string',
        enum: ['auto', 'sync', 'async'],
        description: '合成通道：auto（默认，长文本自动异步）/ sync 强制同步 / async 强制异步。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          provider: { type: 'string', required: true },
          model: { type: 'string', required: true },
          voice: { type: 'string', required: true },
          format: { type: 'string', required: true },
          localPath: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          durationMs: { type: 'integer', required: true },
          durationEstimated: { type: 'boolean', required: true },
          mode: { type: 'string', required: true },
          taskId: { type: 'string', description: '异步通道的任务 id（同步合成时缺省）。' },
          notes: { type: 'array', items: { type: 'string' } },
        },
      },
      render: (_args, value): ContentBlock[] => {
        const v = value as GenerateSpeechOutput
        const lines = [
          '语音已生成并保存到本地：',
          `- 文件路径：${v.localPath}`,
          `- 文件大小：${(v.bytes / 1024).toFixed(1)} KB`,
          `- 时长：${(v.durationMs / 1000).toFixed(2)} 秒${v.durationEstimated ? '（按字数估算，未探测到真实时长）' : ''}`,
          `- 模型：${v.model}（服务商：${v.provider}）`,
          `- 音色：${v.voice}`,
          `- 封装：${v.format}`,
          `- 通道：${v.mode === 'async' ? `异步（task ${v.taskId ?? '—'}）` : '同步'}`,
        ]
        const notesBlock = v.notes !== undefined && v.notes.length > 0
          ? `\n\n透明告知：\n${v.notes.map(note => `- ${note}`).join('\n')}`
          : ''
        return [{ type: 'text', text: `${lines.join('\n')}${notesBlock}\n\n请用本地播放器打开上述文件路径试听。` }]
      },
      // UI-only：桌面端 keyed toolview 可据此内嵌音频播放器
      presentationMeta: (_args, value) => {
        const v = value as GenerateSpeechOutput
        return {
          provider: v.provider,
          model: v.model,
          voice: v.voice,
          localPath: v.localPath,
          bytes: v.bytes,
          durationMs: v.durationMs,
          format: v.format,
        }
      },
    },

    async execute(args, exec) {
      const typed = args as {
        text: string
        voice?: string
        model?: string
        format?: TtsAudioFormat
        instruction?: string
        speed?: number
        pitch?: number
        volume?: number
        references?: Array<string | { audio_url?: string; audioUrl?: string }>
        mode?: SpeechMode
      }
      const spoken = typed.text.trim()
      if (spoken === '') throw new Error('generate_speech：text 不能为空')
      const references = normalizeReferences(typed.references)
      const request: TtsRequest = {
        text: spoken,
        ...typed.voice === undefined || typed.voice.trim() === '' ? {} : { voiceId: typed.voice.trim() },
        ...typed.model === undefined || typed.model.trim() === '' ? {} : { model: typed.model.trim() },
        ...typed.format === undefined ? {} : { responseFormat: typed.format },
        ...typed.instruction === undefined || typed.instruction.trim() === '' ? {} : { instruction: typed.instruction.trim() },
        ...typed.speed === undefined ? {} : { speed: typed.speed },
        ...typed.pitch === undefined ? {} : { pitch: typed.pitch },
        ...typed.volume === undefined ? {} : { volume: typed.volume },
        ...references === undefined ? {} : { references },
      }
      const mode: SpeechMode = typed.mode ?? 'auto'
      const useAsync = mode === 'async' || (mode === 'auto' && shouldUseAsync(settings, spoken))
      const status = await tts.status()
      // 未配置凭证时在**提交前**就给出可操作原因，而不是等网关回 401
      if (!status.available) throw new TtsNotReadyError(status.reason ?? '语音服务未配置')
      const provider = status.provider

      if (useAsync) {
        const task = await tts.synthesizeAsync(request, exec.signal)
        const audio = ensureSucceeded(task)
        return {
          provider,
          model: audio.model,
          voice: audio.voiceId,
          format: String(audio.format),
          localPath: audio.audioPath,
          bytes: audio.bytes,
          durationMs: audio.durationMs,
          durationEstimated: audio.durationEstimated,
          mode: 'async' as const,
          taskId: task.taskId,
          ...audio.notes === undefined ? {} : { notes: audio.notes },
        }
      }
      const audio = await tts.synthesize(request, exec.signal)
      return {
        provider,
        model: audio.model,
        voice: audio.voiceId,
        format: String(audio.format),
        localPath: audio.audioPath,
        bytes: audio.bytes,
        durationMs: audio.durationMs,
        durationEstimated: audio.durationEstimated,
        mode: 'sync' as const,
        ...audio.notes === undefined ? {} : { notes: audio.notes },
      }
    },

    presentCall: args => ({ card: 'generic', title: '生成语音', kind: 'other', rawInput: args }),
    timeoutMs: deps.timeoutMs ?? 600_000,
  })
}

/** 异步任务必须真的成功且拿到音频，否则响亮失败（绝不返回空路径）。 */
function ensureSucceeded(task: TtsTask) {
  if (task.status !== 'succeeded' || task.audio === undefined) {
    throw new Error(`语音合成失败：${task.error ?? `任务状态 ${task.status}`}（task ${task.taskId}）`)
  }
  return task.audio
}

/** 参考音频归一：接受字符串或 `{audio_url}` / `{audioUrl}` 对象。 */
function normalizeReferences(
  value: ReadonlyArray<string | { audio_url?: string; audioUrl?: string }> | undefined,
): Array<{ audioUrl: string }> | undefined {
  if (value === undefined || value.length === 0) return undefined
  const references = value.map((entry, index) => {
    if (typeof entry === 'string' && entry.trim() !== '') return { audioUrl: entry.trim() }
    if (typeof entry === 'object' && entry !== null) {
      const url = entry.audioUrl ?? entry.audio_url
      if (typeof url === 'string' && url.trim() !== '') return { audioUrl: url.trim() }
    }
    throw new Error(`generate_speech：references[${index}] 需要音频地址`)
  })
  return references
}

/** 克隆结果（工具输出值）。 */
interface CloneVoiceOutput {
  voiceId: string
  name: string
  model: string
  fileId: string | number
  sample: string
  notes?: string[]
}

/**
 * 创建 `clone_voice` 工具：上传一段样本音频，复刻成可复用的音色。
 * @param deps - 语音服务与配置。
 */
export function createCloneVoiceTool(deps: SpeechToolDeps) {
  const { tts } = deps
  return defineTool({
    name: 'clone_voice',
    description:
      '用一段人声样本复刻音色（语音克隆），返回网关音色 id（形如 mmxvc_…）——之后调用 generate_speech 时把它传给 voice 即可用这个音色说话。'
      + '样本要求：10 秒–2 分钟、单人、无背景音乐的清晰录音（wav/mp3/m4a/flac，≤20MB）。'
      + '参数：audio（必填：本地样本路径或 http(s) 地址）、voiceId（自定义音色名，如 MyVoice001，留空自动生成）、'
      + 'name（展示名）、text（试听文本，留空用默认）、model（克隆模型，留空用配置默认 speech-2.8-hd）。',
    parameters: {
      audio: {
        type: 'string',
        required: true,
        description: '克隆样本：本地文件路径（相对路径按 outputs 解析）或 http(s) 音频地址。',
      },
      voiceId: { type: 'string', description: '自定义音色名（网关 voice_id），如 MyVoice001；留空自动生成。' },
      name: { type: 'string', description: '展示名（界面上显示的音色名），留空同 voiceId。' },
      text: { type: 'string', description: '试听文本（部分通道要求提供），留空用默认试听句。' },
      model: { type: 'string', description: '克隆模型，留空用配置默认（speech-2.8-hd）。' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          voiceId: { type: 'string', required: true },
          name: { type: 'string', required: true },
          model: { type: 'string', required: true },
          fileId: { type: 'string', required: true },
          sample: { type: 'string', required: true },
          notes: { type: 'array', items: { type: 'string' } },
        },
      },
      render: (_args, value): ContentBlock[] => {
        const v = value as CloneVoiceOutput
        const notes = v.notes !== undefined && v.notes.length > 0
          ? `\n\n透明告知：\n${v.notes.map(note => `- ${note}`).join('\n')}`
          : ''
        return [{
          type: 'text',
          text: `音色已复刻：${v.name}\n`
            + `- 音色 id：${v.voiceId}\n`
            + `- 克隆模型：${v.model}\n`
            + `- 样本：${v.sample}\n`
            + `- 服务端文件 id：${String(v.fileId)}\n\n`
            + `之后调用 generate_speech 时把 voice 设为 "${v.voiceId}" 即可用这个音色说话。${notes}`,
        }]
      },
      presentationMeta: (_args, value) => {
        const v = value as CloneVoiceOutput
        return { voiceId: v.voiceId, name: v.name, model: v.model, sample: v.sample }
      },
    },

    async execute(args, exec) {
      const typed = args as { audio: string; voiceId?: string; name?: string; text?: string; model?: string }
      const sample = await resolveSample(typed.audio, deps.outputsDir)
      try {
        const clone = await tts.clone({
          audioPath: sample.path,
          ...typed.voiceId === undefined || typed.voiceId.trim() === '' ? {} : { voiceId: typed.voiceId.trim() },
          ...typed.name === undefined || typed.name.trim() === '' ? {} : { name: typed.name.trim() },
          ...typed.text === undefined || typed.text.trim() === '' ? {} : { previewText: typed.text.trim() },
          ...typed.model === undefined || typed.model.trim() === '' ? {} : { model: typed.model.trim() },
        }, exec.signal)
        return {
          voiceId: clone.voiceId,
          name: clone.name,
          model: clone.model,
          fileId: String(clone.fileId),
          sample: sample.label,
          ...sample.notes === undefined ? {} : { notes: sample.notes },
        }
      } finally {
        await sample.cleanup()
      }
    },

    presentCall: args => ({ card: 'generic', title: '复刻音色', kind: 'other', rawInput: args }),
    timeoutMs: deps.timeoutMs ?? 600_000,
  })
}

/**
 * 解析克隆样本：本地路径直接读，http(s) 地址先下载到临时目录。
 * @param input - 工具入参。
 * @param outputsDir - 相对路径的解析基准（缺省 cwd）。
 */
async function resolveSample(
  input: string,
  outputsDir?: string,
): Promise<{ path: string; label: string; cleanup: () => Promise<void>; notes?: string[] }> {
  const value = input.trim()
  if (value === '') throw new Error('clone_voice：audio 不能为空')
  if (/^https?:\/\//i.test(value)) {
    const directory = await mkdtemp(`${tmpdir()}/dsh-voice-sample-`)
    const downloaded = await downloadMedia(value, { timeoutMs: 120_000, retryTimes: 2 })
    const extension = extensionFromContentType(downloaded.contentType)
    const path = `${directory}/sample${extension}`
    await writeFile(path, downloaded.data)
    return {
      path,
      label: value,
      cleanup: async () => { await rm(directory, { recursive: true, force: true }) },
      notes: ['样本来自远程地址：已下载到临时目录后上传，生成结束后已清理'],
    }
  }
  const base = outputsDir ?? process.cwd()
  const absolute = isAbsolute(value) ? value : resolve(base, value)
  return { path: absolute, label: basename(absolute), cleanup: async () => {} }
}

/** Content-Type → 样本扩展名。 */
function extensionFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase()
  if (ct.includes('wav')) return '.wav'
  if (ct.includes('mpeg') || ct.includes('mp3')) return '.mp3'
  if (ct.includes('mp4') || ct.includes('m4a')) return '.m4a'
  if (ct.includes('flac')) return '.flac'
  if (ct.includes('ogg')) return '.ogg'
  return '.wav'
}
