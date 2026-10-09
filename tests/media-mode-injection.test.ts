/**
 * 媒体模式注入测试：指令渲染（纯函数）与 `agent/pre-step` 门控——
 * 只在成功进入、本步带来新用户输入、且非子代理时追加一条指令消息。
 *
 * @module dsh-image-video/tests/media-mode-injection
 */

import { describe, expect, it } from 'vitest'
import { createRuntimeDefaultsStore, resolveDefaultsView } from '../src/runtime-defaults.ts'
import { registerMediaModeInjection, renderMediaModeInstruction } from '../src/media-mode-injection.ts'

/** 抓取注册进 ctx.on 的监听器，供测试直接驱动。 */
type PreStepListener = (
  payload: { agent: { session: { header: { origin: string } } }; messages: Array<{ source: { kind: string } }>; signal: { aborted: boolean } },
  next: () => Promise<{ kind: 'ok'; messages: unknown[] }>,
) => Promise<{ kind: string; messages: unknown[] }>

function captureListener(store = createRuntimeDefaultsStore()): PreStepListener {
  let captured: PreStepListener | undefined
  const ctx = {
    on: (name: string, listener: PreStepListener, options?: { prepend?: boolean }) => {
      expect(name).toBe('agent/pre-step')
      expect(options).toEqual({ prepend: true })
      captured = listener
    },
  }
  registerMediaModeInjection(ctx as never, { store, persisted: {} })
  if (captured === undefined) throw new Error('listener not registered')
  return captured
}

describe('renderMediaModeInstruction', () => {
  it('image 模式带出生效尺寸与风格标签', () => {
    const store = createRuntimeDefaultsStore()
    store.patch({ mediaMode: 'image', imageSize: '1024*1024', imageStyle: 'photo' })
    const text = renderMediaModeInstruction(resolveDefaultsView(store))
    expect(text).toContain('【图片生成模式】')
    expect(text).toContain('generate_image')
    expect(text).toContain('尺寸：1024*1024')
    expect(text).toContain('风格：摄影')
  })

  it('video 模式带出生效宽高比与时长', () => {
    const store = createRuntimeDefaultsStore()
    store.patch({ mediaMode: 'video', videoAspectRatio: '9:16', videoDuration: 8 })
    const text = renderMediaModeInstruction(resolveDefaultsView(store))
    expect(text).toContain('【视频生成模式】')
    expect(text).toContain('generate_video')
    expect(text).toContain('宽高比：9:16')
    expect(text).toContain('时长：8 秒')
  })

  it('text 模式与未设置时不渲染指令', () => {
    const store = createRuntimeDefaultsStore()
    expect(renderMediaModeInstruction(resolveDefaultsView(store))).toBeUndefined()
    store.patch({ mediaMode: 'text', imageSize: '1024*1024' })
    expect(renderMediaModeInstruction(resolveDefaultsView(store))).toBeUndefined()
  })
})

describe('registerMediaModeInjection 门控', () => {
  const nextOk = async (): Promise<{ kind: 'ok'; messages: unknown[] }> => ({ kind: 'ok', messages: [] })

  it('图片模式下带新用户输入时追加一条指令消息', async () => {
    const store = createRuntimeDefaultsStore()
    store.patch({ mediaMode: 'image' })
    const listener = captureListener(store)
    const decision = await listener(
      { agent: { session: { header: { origin: 'main' } } }, messages: [{ source: { kind: 'user' } }], signal: { aborted: false } },
      nextOk,
    )
    expect(decision.messages).toHaveLength(1)
  })

  it('没有新的用户输入（工具循环后续步）不注入', async () => {
    const store = createRuntimeDefaultsStore()
    store.patch({ mediaMode: 'image' })
    const listener = captureListener(store)
    const decision = await listener(
      { agent: { session: { header: { origin: 'main' } } }, messages: [{ source: { kind: 'tool' } }], signal: { aborted: false } },
      nextOk,
    )
    expect(decision.messages).toHaveLength(0)
  })

  it('子代理不继承主会话的媒体模式', async () => {
    const store = createRuntimeDefaultsStore()
    store.patch({ mediaMode: 'video' })
    const listener = captureListener(store)
    const decision = await listener(
      { agent: { session: { header: { origin: 'subagent' } } }, messages: [{ source: { kind: 'user' } }], signal: { aborted: false } },
      nextOk,
    )
    expect(decision.messages).toHaveLength(0)
  })

  it('next() 拒绝时不追加任何消息', async () => {
    const store = createRuntimeDefaultsStore()
    store.patch({ mediaMode: 'image' })
    const listener = captureListener(store)
    const decision = await listener(
      { agent: { session: { header: { origin: 'main' } } }, messages: [{ source: { kind: 'user' } }], signal: { aborted: false } },
      async () => ({ kind: 'reject', messages: [] }),
    )
    expect(decision.kind).toBe('reject')
    expect(decision.messages).toHaveLength(0)
  })
})
