/**
 * 融合生图参数化（`B-3`）：姿态 × 镜头 × 场景裁剪。
 *
 * 三层断言：
 * 1. **纯逻辑**：预设 id 稳定、未知 id 响亮报错、拼词顺序固定、裁剪框校验；
 * 2. **端点装配**：`media/compose` 把姿态/镜头拼进提示词、把裁剪真的落到参考图上；
 * 3. **不虚构**：没有可用参考图却要求裁剪 → 明确拒绝（而不是悄悄忽略参数）。
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { buildComposePrompt, LENS_PRESETS, normalizeComposeCrop, POSE_PRESETS } from '../src/workbench/compose.ts'
import type { GenerationTool } from '../src/workbench/runner.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

async function harness() {
  const dataDir = await temp('dsh-compose-store-')
  const outputsDir = await temp('dsh-compose-out-')
  const store = new WorkbenchStore({ directory: dataDir })
  const calls: Array<Record<string, unknown>> = []
  const image: GenerationTool = {
    async execute(args) {
      calls.push(args as Record<string, unknown>)
      const out = join(outputsDir, `composed-${calls.length}.png`)
      await sharp({ create: { width: 64, height: 64, channels: 3, background: '#223344' } }).png().toFile(out)
      return { localPath: out, bytes: 64 }
    },
  }
  const call = createWorkbenchHandler({
    provider: 'threevideo',
    outputsDir,
    store,
    registry: {} as never,
    runner: {} as never,
    renders: {} as never,
    generate: { image, video: { async execute() { throw new Error('no video') } } },
  })
  const project = await store.createProject('融合生图')
  return { call, store, project, outputsDir, calls }
}

describe('预设与拼词（纯逻辑）', () => {
  it('姿态/镜头的 id 唯一，且每个都有提示词片段', () => {
    for (const presets of [POSE_PRESETS, LENS_PRESETS]) {
      const ids = presets.map(preset => preset.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const preset of presets) {
        expect(preset.promptFragment.trim()).not.toBe('')
        expect(preset.labelKey.trim()).not.toBe('')
      }
      expect(ids.length).toBeGreaterThanOrEqual(5)
    }
  })

  it('拼词顺序固定：用户提示词 → 主体 → 姿态 → 镜头 → 风格', () => {
    const prompt = buildComposePrompt({
      prompt: '雨夜街头对峙',
      pose: 'fighting',
      lens: 'low-angle',
      subjects: [{ kind: 'role', name: '林夏', note: '短发风衣' }, { kind: 'scene', name: '雨夜街头' }],
      styleNote: '低饱和青蓝',
    })
    const order = [
      prompt.indexOf('雨夜街头对峙'),
      prompt.indexOf('role「林夏」'),
      prompt.indexOf('姿态（pose）'),
      prompt.indexOf('镜头（camera）'),
      prompt.indexOf('风格：低饱和青蓝'),
    ]
    expect(order.every(index => index >= 0)).toBe(true)
    expect([...order].sort((left, right) => left - right)).toEqual(order)
    expect(prompt).toContain('fighting stance')
  })

  it('未知姿态/镜头 id 直接报错（不静默丢参数）', () => {
    expect(() => buildComposePrompt({ prompt: 'x', pose: 'dance' })).toThrowError(/未知姿态/)
    expect(() => buildComposePrompt({ prompt: 'x', lens: 'drone' })).toThrowError(/未知镜头类别/)
  })

  it('裁剪框校验：越界/太小/非数字都被拒绝，合法输入原样返回', () => {
    expect(normalizeComposeCrop(undefined)).toBeUndefined()
    expect(normalizeComposeCrop({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 })).toEqual({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 })
    expect(() => normalizeComposeCrop({ x: 0.8, y: 0, width: 0.5, height: 0.5 })).toThrowError(/超出画面/)
    expect(() => normalizeComposeCrop({ x: 0, y: 0, width: 0.01, height: 0.01 })).toThrowError(/太小/)
    expect(() => normalizeComposeCrop({ x: '0', y: 0, width: 0.5, height: 0.5 })).toThrowError(/有限数字/)
  })
})

describe('media/compose（端点装配）', () => {
  it('姿态/镜头进提示词，场景裁剪真的落到参考图上', async () => {
    const { call, store, project, outputsDir, calls } = await harness()
    // 场景图：200×100，左半红右半蓝 → 取右半应得 100×100
    const scenePath = join(outputsDir, 'scene.png')
    await sharp({ create: { width: 200, height: 100, channels: 3, background: '#ff0000' } })
      .composite([{ input: { create: { width: 100, height: 100, channels: 3, background: '#0000ff' } }, left: 100, top: 0 }])
      .png()
      .toFile(scenePath)
    const scene = await store.createResource({ projectId: project.id, kind: 'scene', name: '雨夜街头', note: '霓虹反光' })
    await store.updateResource(scene.id, { assetPaths: [scenePath] })
    const role = await store.createResource({ projectId: project.id, kind: 'role', name: '林夏', note: '短发风衣' })

    const result = await call('media/compose', {
      projectId: project.id,
      prompt: '雨夜街头对峙',
      roles: [role.id],
      scenes: [scene.id],
      pose: 'fighting',
      lens: 'low-angle',
      cropScene: { x: 0.5, y: 0, width: 0.5, height: 1 },
    }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const value = result.value as {
      composedPrompt: string
      pose: string
      lens: string
      cropped: { path: string; width: number; height: number }
      referencedImages: number
    }
    expect(value.pose).toBe('fighting')
    expect(value.lens).toBe('low-angle')
    expect(value.composedPrompt).toContain('fighting stance')
    expect(value.composedPrompt).toContain('low angle')
    expect(value.composedPrompt).toContain('role「林夏」')
    // 裁剪结果：100×100，且生成时用的是裁剪后的文件
    expect(value.cropped.width).toBe(100)
    expect(value.cropped.height).toBe(100)
    const args = calls[0] as { images: string[]; prompt: string }
    expect(args.prompt).toContain('fighting stance')
    // 裁剪是**替换**原场景图（不把两张场景图同时塞给模型）
    expect(args.images).toEqual([value.cropped.path])
    expect(args.images).not.toContain(scenePath)
    expect((await readFile(value.cropped.path)).byteLength).toBeGreaterThan(0)
  })

  it('没有可裁的参考图却要求裁剪 → 明确拒绝', async () => {
    const { call, project } = await harness()
    const result = await call('media/compose', {
      projectId: project.id, prompt: 'x', cropScene: { x: 0, y: 0, width: 0.5, height: 0.5 },
    }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('cropScene')
  })

  it('未知姿态经端点透传为可操作错误', async () => {
    const { call, project } = await harness()
    const result = await call('media/compose', { projectId: project.id, prompt: 'x', pose: 'dance' },
      new AbortController().signal, {} as never)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('未知姿态')
  })
})
