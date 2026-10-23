/**
 * 配音应用层（`P0-1`）：计划（字幕 → 台词/时长/提醒）、可用性视图、端点的诚实拒绝。
 *
 * 口径：TTS 接口还没联调通过，所以这里**不测"能合成"**，只测"该说的都说到位"——
 * 计划可读、时长估算合理、未接入时 give 可操作原因，接入后只换 provider 实现。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { estimateSpeechMs, planDub } from '../src/workbench/voice.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { ttsAvailability } from '../src/media/tts.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

const EMPTY_TTS = {
  provider: 'threerouter' as const, apiKey: '', apiKeyEnv: 'THREEROUTER_TTS_API_KEY',
  baseURL: '', model: '', defaultVoice: '', voices: [],
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

describe('ttsAvailability', () => {
  it('空配置 = 未接入，并给出下一步该做什么', () => {
    const voice = ttsAvailability(EMPTY_TTS)
    expect(voice.available).toBe(false)
    expect(voice.reason).toContain('未配置 TTS')
    expect(voice.voices).toEqual([])
  })

  it('配了音色也仍然"未接入"（接口没上线就绝不假装可用），但能列出音色', () => {
    const voice = ttsAvailability({
      ...EMPTY_TTS, apiKey: 'k', voices: [{ id: 'v1', name: '晓晓', languages: ['zh-CN'], gender: 'female' }],
    })
    expect(voice.available).toBe(false)
    expect(voice.reason).toContain('接口尚未接入')
    expect(voice.voices).toHaveLength(1)
  })
})

describe('voice 端点', () => {
  function handler(store: WorkbenchStore, tts = EMPTY_TTS) {
    const deps = {
      provider: 'threerouter',
      outputsDir: '/tmp/outputs',
      store,
      registry: {} as never,
      runner: {} as never,
      renders: {} as never,
      voice: { availability: () => ttsAvailability(tts), provider: { name: 'threerouter', listVoices: async () => [], synthesize: async () => { throw new Error('should not be called') } } },
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

  it('voice/synthesize 未接入时明确拒绝（机器码 + 可操作原因），不是静默失败', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-voice-') })
    const result = await handler(store)('voice/synthesize', { text: '试一下' }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toContain('配音还不可用')
    expect(result.error.message).toContain('TTS')
  })
})
