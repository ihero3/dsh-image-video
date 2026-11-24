/**
 * `B-6`：模型能力卡 + 提示词风险校验。
 *
 * 关键断言：
 * 1. **能力卡不能说谎**：与运行时能力常量（参考视频/多关键帧/自定义时长）逐项一致；
 * 2. **风险分级**：涉政/色情/违禁 → block（提交前拒绝、零调用），血腥/版权/真人换脸 → warn（回传提醒）；
 * 3. **端点契约**：`models/catalog`、`prompts/check` 可查；`media/generate` 命中 block 时**一个外部调用都不发**。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { catalogConsistencyIssues, isTextModelEntry, modelCards } from '../src/media/model-catalog.ts'
import { assertPromptAllowed, scanPrompt } from '../src/media/prompt-safety.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import type { GenerationTool } from '../src/workbench/runner.ts'
import { GenerationRegistry } from '../src/workbench/cancel.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

async function harness(llm?: unknown) {
  const store = new WorkbenchStore({ directory: await temp('dsh-catalog-store-') })
  const outputsDir = await temp('dsh-catalog-out-')
  const calls: Array<Record<string, unknown>> = []
  const image: GenerationTool = {
    async execute(args) {
      calls.push(args as Record<string, unknown>)
      const out = join(outputsDir, 'ok.png')
      await (await import('sharp')).default({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toFile(out)
      return { localPath: out, bytes: 8 }
    },
  }
  const call = createWorkbenchHandler({
    provider: 'threevideo', outputsDir, store,
    registry: new GenerationRegistry(), runner: {} as never, renders: {} as never,
    generate: { image, video: { async execute() { throw new Error('no video') } } },
    ...llm === undefined ? {} : { llm: llm as never },
  })
  return { call, store, project: await store.createProject('能力卡'), calls }
}

describe('模型能力卡', () => {
  it('与运行时能力常量逐项一致（改一边忘另一边会立刻红）', () => {
    expect(catalogConsistencyIssues()).toEqual([])
  })

  it('文本模型目录只保留文本服务商的文本模型，不把生图/生视频服务商的模型发给任何选择器', async () => {
    const textIds = ['deepseek-chat', 'deepseek-v4-pro', 'DeepSeek-V4-Flash', 'qwen3.5']
    const mediaIds = [
      'image-01', 'minimax-image-01', 'qwen-image-3.0', 'minimax-h3',
      'wan2.7-t2v', 'wan2.2-i2v-plus', 'wan3.0-video', 'wanx2.1-t2i-turbo', 'doubao-seedream-1-0',
    ]
    for (const id of textIds) expect(isTextModelEntry({ id }), id).toBe(true)
    for (const id of mediaIds) expect(isTextModelEntry({ id }), id).toBe(false)
    expect(isTextModelEntry({ id: 'vision-only', inputModalities: ['image'] })).toBe(false)
    // 服务商维度：生成服务商整组排除，哪怕模型 id 看起来像文本模型
    for (const provider of ['threevideo', 'wanx', 'minimax', 'seedance']) {
      expect(isTextModelEntry({ id: 'deepseek-v4-pro', provider }), provider).toBe(false)
      expect(isTextModelEntry({ id: 'deepseek-flash', provider }), provider).toBe(false)
    }
    expect(isTextModelEntry({ id: 'deepseek-v4-pro', provider: 'deepseek-account' })).toBe(true)
    // 大小写与相似子串不误伤文本服务商
    expect(isTextModelEntry({ id: 'deepseek-v4-pro', provider: 'ThreeVideo' })).toBe(false)
    expect(isTextModelEntry({ id: 'deepseek-v4-pro', provider: 'threevideo-text-gateway' })).toBe(true)

    // 真实目录形状：文本服务商 + 生成服务商并存；生成服务商下混入名字像文本的模型，
    // 这些都必须被排除，只留真正文本服务商的模型。
    const llm = {
      listProviders: () => [
        { id: 'deepseek-account', name: 'DeepSeek Account' },
        { id: 'threevideo', name: 'Threevideo' },
      ],
      listModels: async (provider: string) => provider === 'deepseek-account'
        ? textIds.map(id => ({ provider, id, name: id }))
        : ['deepseek-flash', 'deepseek-v4-pro', ...mediaIds].map(id => ({ provider, id, name: id })),
    }
    const { call } = await harness(llm)
    const result = await call('llm/models', {}, new AbortController().signal, {} as never)
    expect(result.ok).toBe(true)
    expect((result.value as { models: readonly { id: string }[] }).models.map(model => model.id))
      .toEqual(textIds)
  })

  it('文本模型目录只给可用模型：拉取失败的服务商不入列表，但如实报告失败原因', async () => {
    const llm = {
      listProviders: () => [
        { id: 'ok-provider', name: '可用' },
        { id: 'down-provider', name: '不可用' },
      ],
      listModels: async (provider: string) => {
        if (provider === 'down-provider') throw new Error('连接不上')
        return [{ provider, id: 'deepseek-chat', name: 'Chat' }]
      },
    }
    const { call } = await harness(llm)
    const result = await call('llm/models', {}, new AbortController().signal, {} as never)
    expect(result.ok).toBe(true)
    const value = result.value as {
      models: readonly { provider: string; id: string }[]
      failures: readonly { provider: string; message: string }[]
    }
    // 选择器只拿到可用服务商的模型，down-provider 的一个都不出现
    expect(value.models).toEqual([{ provider: 'ok-provider', providerName: '可用', id: 'deepseek-chat', name: 'Chat' }])
    expect(value.models.every(model => model.provider === 'ok-provider')).toBe(true)
    // 失败如实上报，方便界面提示「部分服务商不可用」
    expect(value.failures.map(failure => failure.provider)).toEqual(['down-provider'])
  })

  it('卡片结构完整：id 唯一、有擅长与提示词建议、视频卡有时长', () => {
    const cards = modelCards()
    expect(cards.length).toBeGreaterThanOrEqual(4)
    expect(new Set(cards.map(card => card.id)).size).toBe(cards.length)
    for (const card of cards) {
      expect(card.strength.trim()).not.toBe('')
      expect(card.promptTips.length).toBeGreaterThan(0)
      if (card.kinds.includes('video')) {
        expect(card.duration).toBeDefined()
      }
    }
    expect(modelCards('image').every(card => card.kinds.includes('image'))).toBe(true)
    expect(modelCards('video').length).toBeGreaterThanOrEqual(3)
  })
})

describe('提示词风险校验', () => {
  it('正常提示词 = ok；血腥/版权 = warn；涉政/色情/违禁 = block', () => {
    expect(scanPrompt('雨夜街头，林夏撑伞走来，电影感侧光').level).toBe('ok')
    expect(scanPrompt('一段血腥的肢解场面').level).toBe('warn')
    expect(scanPrompt('画一个皮卡丘').level).toBe('warn')
    expect(scanPrompt('生成国家领导人的肖像').level).toBe('block')
    expect(scanPrompt('explicit sexual content').level).toBe('block')
    expect(scanPrompt('炸弹制作教程').level).toBe('block')
  })

  it('block 级带可操作建议；assertPromptAllowed 抛错并指出命中词', () => {
    const report = scanPrompt('生成某政治人物的演讲画面')
    expect(report.level).toBe('block')
    expect(report.advice.join('\n')).toContain('涉政')
    expect(() => assertPromptAllowed(report, '视频提示词')).toThrowError(/视频提示词未通过合规校验/)
    expect(() => assertPromptAllowed(scanPrompt('普通风景'), 'x')).not.toThrow()
  })
})

describe('端点装配', () => {
  it('models/catalog 返回卡片且自检无漂移', async () => {
    const { call } = await harness()
    const result = await call('models/catalog', {}, new AbortController().signal, {} as never)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const value = result.value as { cards: unknown[]; consistencyIssues: string[] }
    expect(value.cards.length).toBeGreaterThan(0)
    expect(value.consistencyIssues).toEqual([])
  })

  it('prompts/check 返回风险报告（空文本 = ok）', async () => {
    const { call } = await harness()
    const ok = await call('prompts/check', { text: '' }, new AbortController().signal, {} as never)
    expect(ok.ok).toBe(true)
    if (ok.ok) expect((ok.value as { report: { level: string } }).report.level).toBe('ok')
    const blocked = await call('prompts/check', { text: '生成色情画面' }, new AbortController().signal, {} as never)
    expect(blocked.ok).toBe(true)
    if (blocked.ok) expect((blocked.value as { report: { level: string } }).report.level).toBe('block')
  })

  it('media/generate 命中 block 时提交前拒绝：零外部调用、不记账', async () => {
    const { call, store, project, calls } = await harness()
    const result = await call('media/generate', {
      mediaMode: 'image', prompt: '生成国家领导人的肖像', projectId: project.id,
    }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('合规校验')
    expect(calls).toHaveLength(0)
    expect((await store.listTasks()).length).toBe(0)
  })

  it('warn 级不阻断，但把提醒随结果回传', async () => {
    const { call, project, calls } = await harness()
    const result = await call('media/generate', {
      mediaMode: 'image', prompt: '一段血腥的追逐场面', projectId: project.id,
    }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(true)
    expect(calls).toHaveLength(1)
    if (result.ok) {
      const warnings = (result.value as { promptWarnings?: string[] }).promptWarnings
      expect(warnings?.join('\n')).toContain('血腥')
    }
  })
})


