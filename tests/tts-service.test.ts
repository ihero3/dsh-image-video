/**
 * 语音网关契约测试（`vi.stubGlobal` 拦截 fetch，不发真实请求）。
 *
 * 断言的重点是**端点与请求体**：合成打 `/audio/speech`、克隆先 `/files/upload`
 * 再 `/voice_clone`、长文本走 `/t2a_async_v2` + `/query/t2a_async_query_v2`；
 * 以及响应形态的宽容度（二进制音频 / JSON 包 audio / MiniMax base_resp / file_id 反查下载地址）
 * 和「拿不到音频就响亮失败」这条底线。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createTtsService, TtsNotReadyError, effectiveTtsVoice, shouldUseAsync, wavDurationMs,
  type TtsSettings,
} from '../src/media/tts.ts'

const BASE = 'https://gw.example/v1'

const SETTINGS: TtsSettings = {
  provider: 'threevideo', apiKey: '', apiKeyEnv: '', baseURL: '', model: '', defaultVoice: '',
  voices: [], responseFormat: 'mp3', cloneModel: '', instruction: '', asyncThresholdChars: 200,
}

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  json: Record<string, unknown> | undefined
  form: FormData | undefined
}

/** 安装 fetch 桩：按顺序返回响应，并记录每次调用的 URL / 方法 / 头 / 体。 */
function stubFetch(...responses: Array<Response | (() => Response)>): Call[] {
  const calls: Call[] = []
  let index = 0
  vi.stubGlobal('fetch', async (url: URL | string, init: RequestInit = {}) => {
    const body = init.body
    calls.push({
      url: String(url),
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      json: typeof body === 'string' ? JSON.parse(body) as Record<string, unknown> : undefined,
      form: body instanceof FormData ? body : undefined,
    })
    const next = responses[Math.min(index, responses.length - 1)]!
    index += 1
    return typeof next === 'function' ? next() : next
  })
  return calls
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function audio(bytes: Uint8Array, contentType: string): Response {
  return new Response(bytes, { status: 200, headers: { 'content-type': contentType } })
}

/** 造一段合法 WAV（16bit/单声道/8kHz，`seconds` 秒静音），用于验证时长解析。 */
function wavBytes(seconds: number): Uint8Array {
  const sampleRate = 8_000
  const dataSize = sampleRate * 2 * seconds
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)
  return new Uint8Array(buffer)
}

const dirs: string[] = []
afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })))
})

async function temp(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-tts-'))
  dirs.push(directory)
  return directory
}

function service(outputsDir: string, overrides: Partial<TtsSettings> = {}, options: { clones?: () => Promise<{ id: string; name: string; kind: 'clone' }[]> } = {}) {
  return createTtsService({
    settings: { ...SETTINGS, ...overrides },
    outputsDir,
    timeoutMs: 5_000,
    retryTimes: 0,
    resolveCredentials: async () => ({ apiKey: 'sk-test', baseURL: BASE }),
    ...options,
    pollIntervalMs: 1,
    pollTimeoutMs: 5_000,
  })
}

describe('同步合成：POST /audio/speech', () => {
  it('二进制音频 → 落盘到 outputs/，时长按 WAV 头实测而不是估算', async () => {
    const dir = await temp()
    const calls = stubFetch(audio(wavBytes(1), 'audio/wav'))
    const result = await service(dir).synthesize({ text: '你好，世界。', voiceId: 'stella' })

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(`${BASE}/audio/speech`)
    expect(calls[0]!.method).toBe('POST')
    expect(calls[0]!.headers.Authorization).toBe('Bearer sk-test')
    expect(calls[0]!.json).toMatchObject({
      model: 'qwen-audio-3.1-tts-flash',
      input: '你好，世界。',
      voice: 'stella',
      response_format: 'mp3',
    })

    expect(result.audioPath.startsWith(dir)).toBe(true)
    expect(result.format).toBe('wav')
    expect(result.voiceId).toBe('stella')
    expect(result.durationMs).toBe(1000)
    expect(result.durationEstimated).toBe(false)
    expect(result.bytes).toBe(wavBytes(1).byteLength)
    expect((await readFile(result.audioPath)).byteLength).toBe(result.bytes)
  })

  it('MiniMax 系模型的音调/音量走 voice_setting；其他模型忽略并明确告知', async () => {
    const dir = await temp()
    const calls = stubFetch(audio(wavBytes(1), 'audio/wav'), audio(wavBytes(1), 'audio/wav'))
    const speech = service(dir)
    await speech.synthesize({ text: '你好', model: 'speech-2.8-hd', voiceId: 'mmxvc_abc', pitch: 2, volume: 1.5, speed: 1.1 })
    expect(calls[0]!.json).toMatchObject({
      model: 'speech-2.8-hd',
      voice: 'mmxvc_abc',
      voice_setting: { voice_id: 'mmxvc_abc', speed: 1.1, vol: 1.5, pitch: 12 },
    })
    const plain = await speech.synthesize({ text: '你好', model: 'qwen-audio-3.1-tts-flash', pitch: 1.2 })
    expect(calls[1]!.json).not.toHaveProperty('voice_setting')
    expect(plain.notes?.[0]).toContain('不支持音调/音量')
  })

  it('instruction / references 只在有值时下发（多人对话与语气指令）', async () => {
    const dir = await temp()
    const calls = stubFetch(audio(wavBytes(1), 'audio/wav'))
    await service(dir).synthesize({
      text: '主播1：最近怎么样？',
      instruction: '用温柔的语气，语速稍慢',
      references: [{ audioUrl: 'https://example.com/voice1.wav' }],
    })
    expect(calls[0]!.json).toMatchObject({
      instruction: '用温柔的语气，语速稍慢',
      references: [{ audio_url: 'https://example.com/voice1.wav' }],
    })
  })

  it('网关在 200 响应里报错（base_resp / error）→ 响亮失败，不生成假音频', async () => {
    const dir = await temp()
    stubFetch(json({ base_resp: { status_code: 1000, status_msg: 'MiniMax upstream request failed' } }))
    await expect(service(dir).synthesize({ text: '你好' })).rejects.toThrow(/MiniMax upstream request failed/)
  })

  it('JSON 里给音频地址时按地址下载落盘（网关可用 url 形态回包）', async () => {
    const dir = await temp()
    const calls = stubFetch(
      json({ audio_url: 'https://cdn.example/a.wav' }),
      audio(wavBytes(2), 'audio/wav'),
    )
    const result = await service(dir).synthesize({ text: '你好' })
    expect(calls[1]!.url).toBe('https://cdn.example/a.wav')
    expect(result.durationMs).toBe(2000)
    expect(result.durationEstimated).toBe(false)
  })

  it('凭证缺失 → 机器码 tts/not-ready（带上下一步该做什么）', async () => {
    const dir = await temp()
    const speech = createTtsService({
      settings: SETTINGS,
      outputsDir: dir,
      timeoutMs: 1_000,
      retryTimes: 0,
      resolveCredentials: async () => { throw new Error('服务商 threevideo 未配置 API Key') },
    })
    const error = await speech.synthesize({ text: '你好' }).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(TtsNotReadyError)
    expect((error as TtsNotReadyError).code).toBe('tts/not-ready')
    expect((error as Error).message).toContain('API Key')
  })
})

describe('语音克隆：/files/upload → /voice_clone', () => {
  it('上传样本（multipart）→ 建音色 → 返回网关 voice_id 并写入克隆库', async () => {
    const dir = await temp()
    const sample = join(dir, 'sample.wav')
    const { writeFile } = await import('node:fs/promises')
    await writeFile(sample, wavBytes(12))
    const saved: Array<{ id: string; name: string; kind?: string }> = []
    const calls = stubFetch(
      json({ file: { file_id: 12345 } }),
      json({ voice_id: 'mmxvc_9f8e7d' }),
    )
    const speech = service(dir, { cloneModel: 'speech-2.8-hd' }, {
      clones: async () => saved as never,
    })
    const result = await speech.clone({ audioPath: sample, voiceId: 'MyVoice001', name: '我的声音', previewText: '试听' })

    expect(calls[0]!.url).toBe(`${BASE}/files/upload`)
    expect(calls[0]!.method).toBe('POST')
    expect(calls[0]!.headers.Authorization).toBe('Bearer sk-test')
    // multipart 由 fetch 自己带 boundary：客户端不能手写 Content-Type
    expect(calls[0]!.headers['Content-Type']).toBeUndefined()
    const form = calls[0]!.form!
    expect(form.get('purpose')).toBe('voice_clone')
    expect(form.get('model')).toBe('speech-2.8-hd')
    expect(form.get('file')).toBeInstanceOf(File)

    expect(calls[1]!.url).toBe(`${BASE}/voice_clone`)
    expect(calls[1]!.json).toMatchObject({
      file_id: 12345, voice_id: 'MyVoice001', text: '试听', model: 'speech-2.8-hd',
    })
    expect(result.voiceId).toBe('mmxvc_9f8e7d')
    expect(result.name).toBe('我的声音')
    expect(result.fileId).toBe(12345)
  })

  it('上传失败（网关 base_resp）→ 直接失败，不继续建音色', async () => {
    const dir = await temp()
    const sample = join(dir, 'sample.wav')
    const { writeFile } = await import('node:fs/promises')
    await writeFile(sample, wavBytes(12))
    const calls = stubFetch(json({ base_resp: { status_code: 1000, status_msg: 'MiniMax upstream request failed' } }))
    await expect(service(dir).clone({ audioPath: sample })).rejects.toThrow(/MiniMax upstream request failed/)
    expect(calls).toHaveLength(1)
  })
})

describe('长文本异步：/t2a_async_v2 + /query/t2a_async_query_v2', () => {
  it('提交拿到 task_id → 轮询 Success → 用 file_id 反查下载地址 → 落盘', async () => {
    const dir = await temp()
    const calls = stubFetch(
      json({ task_id: 'task-1', base_resp: { status_code: 0 } }),
      json({ task_id: 'task-1', status: 'Processing', base_resp: { status_code: 0 } }),
      json({ task_id: 'task-1', status: 'Success', file_id: 'file_9', base_resp: { status_code: 0 } }),
      json({ file: { download_url: 'https://cdn.example/long.mp3' } }),
      audio(new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]), 'audio/mpeg'),
    )
    const task = await service(dir).synthesizeAsync({ text: '很长的旁白'.repeat(400), voiceId: 'mmxvc_abc' })

    expect(calls[0]!.url).toBe(`${BASE}/t2a_async_v2`)
    expect(calls[0]!.json).toMatchObject({
      model: 'qwen-audio-3.1-tts-flash',
      text: '很长的旁白'.repeat(400),
      voice_setting: { voice_id: 'mmxvc_abc' },
      audio_setting: { format: 'mp3' },
    })
    expect(calls[1]!.url).toContain('/query/t2a_async_query_v2?task_id=task-1')
    expect(calls[3]!.url).toContain('/files/retrieve?file_id=file_9')
    expect(task.status).toBe('succeeded')
    expect(task.audio?.audioPath.startsWith(dir)).toBe(true)
    expect(task.audio?.format).toBe('mp3')
    // mp3 没有可解析的头、也没有 ffprobe：时长如实标注为估算
    expect(task.audio?.durationEstimated).toBe(true)
  })

  it('任务失败 → 返回 failed + 网关原因（不抛成「成功但没文件」）', async () => {
    const dir = await temp()
    stubFetch(
      json({ task_id: 'task-2' }),
      json({ task_id: 'task-2', status: 'Failed', base_resp: { status_code: 0, status_msg: 'quota exceeded' } }),
    )
    const task = await service(dir).synthesizeAsync({ text: '长文本' })
    expect(task.status).toBe('failed')
    expect(task.error).toContain('quota exceeded')
  })
})

describe('默认值与门槛', () => {
  it('音色取值：调用参数 > 配置默认 > 模型兜底', () => {
    expect(effectiveTtsVoice({ ...SETTINGS, defaultVoice: 'cfg' }, 'qwen-audio-3.1-tts-flash', 'call')).toBe('call')
    expect(effectiveTtsVoice({ ...SETTINGS, defaultVoice: 'cfg' }, 'qwen-audio-3.1-tts-flash')).toBe('cfg')
    expect(effectiveTtsVoice(SETTINGS, 'deepseek-tts')).toBe('stella')
    expect(effectiveTtsVoice(SETTINGS, 'speech-2.8-hd')).toBe('male-qn-qingse')
    expect(effectiveTtsVoice(SETTINGS, 'qwen-audio-3.1-tts-flash')).toBe('')
  })

  it('长文本门槛按字数判定，0 = 从不自动切异步', () => {
    expect(shouldUseAsync({ ...SETTINGS, asyncThresholdChars: 3 }, '四个字符')).toBe(true)
    expect(shouldUseAsync({ ...SETTINGS, asyncThresholdChars: 10 }, '四个字符')).toBe(false)
    expect(shouldUseAsync({ ...SETTINGS, asyncThresholdChars: 0 }, '随便多长'.repeat(100))).toBe(false)
  })

  it('wavDurationMs 只认 RIFF/WAVE，未知格式返回 undefined', () => {
    expect(wavDurationMs(wavBytes(3))).toBe(3000)
    expect(wavDurationMs(new Uint8Array([1, 2, 3]))).toBeUndefined()
    expect(wavDurationMs(new Uint8Array(64))).toBeUndefined()
  })
})
