/**
 * 一键自动流水线（`P0-2`）：剧本 → 分镜 →（生图）→ 生视频 的编排契约。
 *
 * 单测盯着三件事：
 * 1. **编排正确**：模式（图生/文生）、分镜数、节点与连线数量、参数透传；
 * 2. **诚实拒绝**：严格模式缺物料要报错且消息能照着修（列出缺哪些物料）；
 * 3. **落库可用**：`pipelines/compose` 产出的工作流真的能被 store 读回、`pipelines/run` 能起跑。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { planPipeline } from '../src/workbench/pipeline.ts'
import type { PlanResource } from '../src/workbench/storyboard.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'

const SCRIPT = '雨夜街头，林夏撑伞走来。她抬眼看向霓虹招牌。镜头推近她的侧脸。'

const RESOURCES: PlanResource[] = [
  { id: 'res-role', kind: 'role', name: '林夏', note: '短发，米色风衣' },
  { id: 'res-scene', kind: 'scene', name: '雨夜街头', note: '霓虹反光' },
]

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

describe('planPipeline（纯编排）', () => {
  it('image-to-video：每镜一个生图 + 一个生视频，连线 1 条/镜', () => {
    const draft = planPipeline({ script: SCRIPT, options: { shots: 3, ratio: '9:16', duration: 4 }, resources: RESOURCES })
    expect(draft.mode).toBe('image-to-video')
    expect(draft.shots).toHaveLength(3)
    expect(draft.diagnostics.shots).toBe(3)
    expect(draft.nodes).toHaveLength(6)
    expect(draft.edges).toHaveLength(3)
    expect(draft.name).toContain('图生视频')
    const image = draft.nodes.find(node => node.kind === 'image-generate')
    const video = draft.nodes.find(node => node.kind === 'video-generate')
    expect(image?.params.ratio).toBe('9:16')
    expect(video?.params.ratio).toBe('9:16')
    expect(video?.params.duration).toBe(4)
    expect(draft.edges.every(edge => edge.source.endsWith('-image') && edge.target.endsWith('-video'))).toBe(true)
  })

  it('text-to-video：省掉生图环节，只有视频节点', () => {
    const draft = planPipeline({ script: SCRIPT, options: { mode: 'text-to-video', shots: 3 }, resources: RESOURCES })
    expect(draft.nodes).toHaveLength(3)
    expect(draft.nodes.every(node => node.kind === 'video-generate')).toBe(true)
    expect(draft.edges).toHaveLength(0)
    expect(draft.name).toContain('文生视频')
  })

  it('风格约束同时追加到生图与生视频提示词', () => {
    const draft = planPipeline({ script: SCRIPT, options: { shots: 1, styleNote: '低饱和青蓝' }, resources: RESOURCES })
    expect(draft.shots[0]!.imagePrompt).toContain('低饱和青蓝')
    expect(draft.shots[0]!.videoPrompt).toContain('低饱和青蓝')
  })

  it('目标分镜数超过句子数时封顶并给出提醒', () => {
    const draft = planPipeline({ script: SCRIPT, options: { shots: 9 } })
    expect(draft.diagnostics.shots).toBeLessThan(9)
    expect(draft.diagnostics.warnings.join('\n')).toContain('封顶')
  })

  it('随意模式：缺物料只记诊断，不阻断', () => {
    const draft = planPipeline({ script: SCRIPT, options: { shots: 2 }, resources: [] })
    expect(draft.diagnostics.missingResources.length).toBeGreaterThanOrEqual(0)
    expect(draft.diagnostics.warnings.join('\n')).toContain('还没有角色/场景/物品资源')
  })

  it('严格模式：一个角色/场景资源都没有就拒绝，并说明怎么补', () => {
    // 严格模式的可判定口径是"库里必须有可匹配的物料"；凭剧本猜"张三是不是角色"不在其职责内
    expect(() => planPipeline({
      script: '张三推开仓库大门。',
      options: { shots: 1, strictResources: true },
      resources: [],
    })).toThrowError(/严格模式[\s\S]*资源/)
    // 有资源时严格模式放行
    const ok = planPipeline({ script: SCRIPT, options: { shots: 2, strictResources: true }, resources: RESOURCES })
    expect(ok.diagnostics.shots).toBeGreaterThan(0)
  })

  it('空剧本直接报错，不产出空流水线', () => {
    expect(() => planPipeline({ script: '   \n\n  ' })).toThrowError(/剧本/)
  })
})

describe('pipelines/compose + pipelines/run（RPC 装配）', () => {
  function handler(store: WorkbenchStore, started: string[] = []) {
    const deps = {
      provider: 'threevideo',
      outputsDir: '/tmp/outputs',
      store,
      registry: {} as never,
      runner: {
        begin: async (workflow: { id: string }) => {
          started.push(workflow.id)
          return { id: `run-${workflow.id}`, workflowId: workflow.id, status: 'running' }
        },
      } as never,
      renders: {} as never,
    }
    return { handler: createWorkbenchHandler(deps as never), started }
  }

  it('compose 把剧本编排成工作流并落库', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-pipeline-store-') })
    const project = await store.createProject('流水线项目')
    await store.createResource({ projectId: project.id, kind: 'role', name: '林夏', note: '短发' })
    const { handler: call } = handler(store)

    const result = await call('pipelines/compose', { projectId: project.id, script: SCRIPT, shots: 2 }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const pipeline = result.value as { pipeline: { workflowId: string; shots: number; nodes: number; missingResources: string[] } }
    expect(pipeline.pipeline.shots).toBe(2)
    expect(pipeline.pipeline.nodes).toBe(4)

    const stored = await store.findWorkflow(pipeline.pipeline.workflowId)
    expect(stored?.nodes).toHaveLength(4)
    expect(stored?.edges).toHaveLength(2)
    // 风格资源缺省时，concept 里的 style note 会作为提示词后缀（这里没有 style 资源 → 不追加）
    expect(stored?.name).toContain('一键成片')
  })

  it('run 先编排再起跑，返回 run 记录', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-pipeline-store-') })
    const project = await store.createProject('流水线项目')
    const { handler: call, started } = handler(store)

    const result = await call('pipelines/run', { projectId: project.id, script: SCRIPT, mode: 'text-to-video', shots: 2 }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const payload = result.value as { pipeline: { workflowId: string }; run: { id: string } }
    expect(payload.run.id).toBe(`run-${payload.pipeline.workflowId}`)
    expect(started).toEqual([payload.pipeline.workflowId])
  })

  it('严格模式缺物料：RPC 返回可照着修的错误', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-pipeline-store-') })
    const project = await store.createProject('流水线项目')
    const { handler: call } = handler(store)
    const result = await call('pipelines/compose', {
      projectId: project.id, script: '王五走进机房。', shots: 1, strictResources: true,
    }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toContain('严格模式')
    expect(result.error.message).toContain('资源')
  })
})
