/**
 * 配音应用层：计划（字幕 → 台词/时长/提醒）、可用性视图、端点的诚实拒绝。
 *
 * 口径：计划与时长估算零花费可测；语音服务本身（HTTP 契约）在
 * `tts-service.test.ts` 里用 fetch 桩覆盖，这里只钉宿主 RPC 的行为——
 * 未配置凭证时 `voice/status` 说明原因、`voice/synthesize` 给机器码而不是假装成功。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { estimateSpeechMs, planDub } from '../src/workbench/voice.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { createTtsService, TtsNotReadyError, type TtsService } from '../src/media/tts.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

const EMPTY_TTS = {
  provider: 'threevideo' as const, apiKey: '', apiKeyEnv: 'THREEVIDEO_TTS_API_KEY',
  baseURL: '', model: '', defaultVoice: '', voices: [], responseFormat: 'mp3' as const,
  cloneModel: '', instruction: '', asyncThresholdChars: 0,
}

/** 没凭证的真实语音服务：可用性为 false，合成抛可操作错误。 */
function unavailableService(): TtsService {
  return createTtsService({
    settings: EMPTY_TTS,
    outputsDir: '/tmp/outputs',
    timeoutMs: 1_000,
    retryTimes: 0,
    resolveCredentials: async () => { throw new Error('服务商 threevideo 未配置 API Key') },
  })
}

describe('时长估算', () => {
  it('中文按 4.5 字/秒、英文按 2.6 词/秒，且标点不计入字数', () => {
    const zh = estimateSpeechMs('雨夜街头，林夏撑伞走来。')       // 12 个有效字 ≈ 2.7s
    expect(zh).toBeGreaterThan(2000)
    expect(zh).toBeLessThan(3200)
    const en = estimateSpeechMs('Rain falls on the empty street tonight')
    expect(en).toBeGreaterThan(2000)
    expect(estimateSpeechMs('，。！')).toBe(0)
  })
})

describe('planDub', () => {
  function timeline(clips: Array<{ id: string; text?: string; startMs: number; durationMs: number }>) {
    return {
      schemaVersion: 4, id: 'tml-1', projectId: 'prj-1', name: '成片',
      tracks: [
        { id: 'v1', kind: 'video' as const, clips: [] },
        { id: 's1', kind: 'subtitle' as const, clips },
      ],
      createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z',
    }
  }

  it('每条字幕一行，字数/时长/提醒都对得上', () => {
    const plan = planDub(timeline([
      { id: 'c1', text: '第一句台词，八个字。', startMs: 0, durationMs: 2500 },
      { id: 'c2', text: '第二句明显更长的一段台词，字幕只给了很短的时间，配音会被挤压。', startMs: 2500, durationMs: 1200 },
      { id: 'c3', text: '，。', startMs: 4000, durationMs: 800 },
    ]) as never)
    expect(plan.lines).toHaveLength(2)
    expect(plan.lines[0]!.clipId).toBe('c1')
    expect(plan.lines[0]!.chars).toBe(8)
    expect(plan.lines[1]!.warning).toContain('挤压')
    expect(plan.totalChars).toBeGreaterThan(8)
    expect(plan.estimatedMs).toBeGreaterThan(plan.lines[0]!.estimatedMs)
  })

  it('没有字幕轨时给可操作提醒，不静默返回空计划', () => {
    const plan = planDub({
      schemaVersion: 4, id: 'tml-2', projectId: 'prj-1', name: '成片',
      tracks: [{ id: 'v1', kind: 'video', clips: [] }],
      createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z',
    } as never)
    expect(plan.lines).toEqual([])
    expect(plan.warnings.join('\n')).toContain('没有字幕轨')
  })
})

describe('语音可用性（status）', () => {
  it('没有凭证 = 不可用，并给出下一步该做什么', async () => {
    const voice = await unavailableService().status()
    expect(voice.available).toBe(false)
    expect(voice.reason).toContain('语音还不可用')
    expect(voice.reason).toContain('API Key')
    expect(voice.voices).toEqual([])
  })

  it('有凭证即可用，且把配置的预设音色与复刻音色合并列出', async () => {
    const service = createTtsService({
      settings: { ...EMPTY_TTS, apiKey: 'k', voices: [{ id: 'v1', name: '晓晓', languages: ['zh-CN'], gender: 'female' }] },
      outputsDir: '/tmp/outputs',
      timeoutMs: 1_000,
      retryTimes: 0,
      resolveCredentials: async () => ({ apiKey: 'k', baseURL: 'https://gw.example/v1' }),
      clones: async () => [{ id: 'mmxvc_abc', name: '我的声音', kind: 'clone', model: 'speech-2.8-hd' }],
    })
    const voice = await service.status()
    expect(voice.available).toBe(true)
    expect(voice.baseURL).toBe('https://gw.example/v1')
    expect(voice.voices.map(entry => entry.id)).toEqual(['v1', 'mmxvc_abc'])
    expect(voice.model).toBe('qwen-audio-3.1-tts-flash')
  })

  it('合成时凭证缺失 → 机器码 tts/not-ready（不是静默失败）', async () => {
    await expect(unavailableService().synthesize({ text: '你好' })).rejects.toBeInstanceOf(TtsNotReadyError)
  })
})

describe('voice 端点', () => {
  function handler(store: WorkbenchStore, voice: TtsService = unavailableService()) {
    const deps = {
      provider: 'threevideo',
      outputsDir: '/tmp/outputs',
      store,
      registry: {} as never,
      runner: {} as never,
      renders: {} as never,
      voice,
    }
    return createWorkbenchHandler(deps as never)
  }

  it('voice/status 返回未接入原因；voice/plan 返回计划', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-voice-') })
    const project = await store.createProject('配音项目')
    const timeline = await store.saveTimeline({
      projectId: project.id, name: '对白',
      tracks: [{ id: 's1', kind: 'subtitle', clips: [{ id: 'c1', startMs: 0, durationMs: 2000, text: '你好，世界。' }] }],
    })
    const call = handler(store)
    const status = await call('voice/status', {}, new AbortController().signal, {} as never)
    expect(status.ok).toBe(true)
    if (status.ok) {
      const voice = (status.value as { voice: { available: boolean; reason?: string } }).voice
      expect(voice.available).toBe(false)
      expect(voice.reason).toBeTruthy()
    }
    const planned = await call('voice/plan', { timelineId: timeline.id }, new AbortController().signal, {} as never)
    expect(planned.ok).toBe(true)
    if (planned.ok) {
      const plan = (planned.value as { plan: { lines: Array<{ text: string; estimatedMs: number }>; totalChars: number } }).plan
      expect(plan.lines).toHaveLength(1)
      expect(plan.lines[0]!.text).toBe('你好，世界。')
      expect(plan.lines[0]!.estimatedMs).toBeGreaterThan(0)
      expect(plan.totalChars).toBe(4)
    }
  })

  it('voice/synthesize 未配置凭证时明确拒绝（机器码 + 可操作原因），不是静默失败', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-voice-') })
    const result = await handler(store)('voice/synthesize', { text: '试一下' }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toContain('语音还不可用')
    expect(result.error.message).toContain('API Key')
  })

  it('voice/clone 未配置凭证时明确拒绝，且不写任何文件', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-voice-') })
    const result = await handler(store)('voice/clone', { audioBase64: 'AAAA' }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toContain('语音还不可用')
  })

  it('voice/synthesize 可用时把请求透传给语音服务并回传落盘结果', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-voice-') })
    const seen: unknown[] = []
    const voice: TtsService = {
      status: async () => ({ available: true, provider: 'threevideo', voices: [] }),
      synthesize: async (input) => {
        seen.push(input)
        return {
          audioPath: '/tmp/outputs/speech.mp3', bytes: 12, durationMs: 900, durationEstimated: false,
          contentType: 'audio/mpeg', format: 'mp3', model: input.model ?? 'm', voiceId: input.voiceId ?? 'v',
        }
      },
      clone: async () => { throw new Error('unused') },
      submitAsync: async () => ({ taskId: 't', status: 'submitted', model: 'm' }),
      queryAsync: async () => ({ taskId: 't', status: 'running', model: 'm' }),
      synthesizeAsync: async () => ({ taskId: 't', status: 'running', model: 'm' }),
    }
    const result = await handler(store, voice)('voice/synthesize', {
      text: '你好', voiceId: 'stella', speed: 0.9, instruction: '温柔', format: 'wav',
    }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect((result.value as { audio: { audioPath: string } }).audio.audioPath).toBe('/tmp/outputs/speech.mp3')
    expect(seen[0]).toMatchObject({ text: '你好', voiceId: 'stella', speed: 0.9, instruction: '温柔', responseFormat: 'wav' })
  })
})
