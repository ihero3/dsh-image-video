// @vitest-environment jsdom
/**
 * 配音卡片（`P0-1` 应用层）渲染契约。
 *
 * 钉三件事：
 * 1. TTS 未接入时显示**原因**，且「生成配音」是**禁用**的（绝不假装可用）；
 * 2. 「生成配音计划」零花费可用，渲染句数/字数/估算时长与逐句提醒；
 * 3. 计划失败（如时间轴不存在）时显示可读错误，而不是静默。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { WorkbenchApi } from '../src/client/api.ts'
import { VoiceCard } from '../src/client/VoiceCard.tsx'
import { en, type WorkbenchLocaleKey } from '../src/client/locales.ts'

afterEach(() => { cleanup() })

const t = (key: WorkbenchLocaleKey): string => en[key]

const UNAVAILABLE = {
  available: false, provider: 'threevideo',
  reason: 'TTS 接口尚未接入：等待 Threevideo TTS API 联调通过（配音计划/时长估算已可用）',
  voices: [],
} as const

function makeApi(overrides: Partial<WorkbenchApi> = {}): WorkbenchApi {
  return {
    voiceStatus: vi.fn(async () => UNAVAILABLE),
    voicePlan: vi.fn(async () => ({
      plan: {
        lines: [
          { clipId: 'c1', text: '第一句台词', chars: 5, slotMs: 2000, estimatedMs: 1111 },
          { clipId: 'c2', text: '第二句很长很长很长很长很长很长的台词', chars: 17, slotMs: 1000, estimatedMs: 3778, warning: '比字幕长：成片会挤压下一句' },
        ],
        totalChars: 22, estimatedMs: 4889, warnings: [],
      },
      voice: UNAVAILABLE,
    })),
    voiceSynthesize: vi.fn(),
    ...overrides,
  } as unknown as WorkbenchApi
}

describe('VoiceCard', () => {
  it('未接入时显示原因，且「生成配音」禁用', async () => {
    const { container } = render(<VoiceCard api={makeApi()} t={t} timelineId="tml-1" />)
    await waitFor(() => { expect(container.querySelector('[data-voice-status="unavailable"]')).not.toBeNull() })
    expect((container.querySelector('[data-voice-reason]') as HTMLElement).textContent).toContain('TTS')
    expect((container.querySelector('[data-voice-generate]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('生成计划（零花费）后渲染句数/字数/估算与逐句提醒', async () => {
    const api = makeApi()
    const { container } = render(<VoiceCard api={api} t={t} timelineId="tml-1" />)
    fireEvent.click(container.querySelector('[data-voice-plan]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelector('[data-voice-plan-result]')).not.toBeNull() })
    const text = (container.querySelector('[data-voice-plan-result]') as HTMLElement).textContent ?? ''
    expect(text).toContain('2 lines')
    expect(text).toContain('22 chars')
    expect(text).toContain('4.9s')
    expect(text).toContain('挤压下一句')
    expect(api.voiceSynthesize).not.toHaveBeenCalled()
  })

  it('计划失败时显示可读错误', async () => {
    const api = makeApi({ voicePlan: vi.fn(async () => { throw new Error('unknown timeline: tml-x') }) as unknown as WorkbenchApi['voicePlan'] })
    const { container } = render(<VoiceCard api={api} t={t} timelineId="tml-x" />)
    fireEvent.click(container.querySelector('[data-voice-plan]') as HTMLButtonElement)
    await waitFor(() => { expect(container.querySelector('[data-voice-error]')).not.toBeNull() })
    expect((container.querySelector('[data-voice-error]') as HTMLElement).textContent).toContain('unknown timeline')
  })
})
