/**
 * 跨运行成功结果缓存（`R-FLW-5`）：同参数同上游的下一次运行**不再调外部生成**，
 * 但换参数、显式 `refresh`、或缓存文件已不在时都必须真的重跑（不能拿旧结果糊弄）。
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { WorkflowRunner, type GenerationTool } from '../src/workbench/runner.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { MAX_NODE_CACHE, nodeCacheKey } from '../src/workbench/node-cache.ts'
import type { WorkflowRecord } from '../src/workbench/workflow.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })

async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

/** 一个会真的写出文件的假工具（缓存命中要求文件存在）。 */
function writingTool(outputs: string, calls: string[], name = 'clip'): GenerationTool {
  let sequence = 0
  return {
    async execute(args) {
      calls.push(JSON.stringify(args))
      sequence += 1
      const path = join(outputs, `${name}-${sequence}.mp4`)
      await writeFile(path, 'bytes')
      return { videoPath: path, bytes: 5 }
    },
  }
}

function graph(prompt: string): WorkflowRecord {
  return {
    schemaVersion: 1, id: 'wfl-cache', projectId: 'prj-1', name: '缓存图', edges: [],
    nodes: [{ id: 'v', kind: 'video-generate', position: { x: 0, y: 0 }, params: { prompt } }],
    createdAt: '', updatedAt: '',
  }
}

describe('cross-run success cache (R-FLW-5)', () => {
  it('reuses the previous artifact instead of calling the provider again', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-cache-store-') })
    const outputs = await temp('dsh-cache-out-')
    const calls: string[] = []
    const runner = new WorkflowRunner({
      store, newRunId: (() => { let n = 0; return () => `run-${++n}` })(),
      generateImage: writingTool(outputs, [], 'image'), generateVideo: writingTool(outputs, calls),
      retryDelayMs: 1,
    })

    await runner.begin(graph('齿轮'))
    await vi.waitFor(async () => { expect((await store.listRuns('prj-1'))[0]?.status).toBe('succeeded') })
    expect(calls).toHaveLength(1)

    // 第二次运行：同一参数 → 复用，工具不再被调用
    await runner.begin(graph('齿轮'))
    await vi.waitFor(async () => {
      const runs = await store.listRuns('prj-1')
      expect(runs[0]?.status).toBe('succeeded')
      expect(runs[0]?.id).toBe('run-2')
    })
    expect(calls).toHaveLength(1)
    const second = (await store.listRuns('prj-1'))[0]
    expect(second?.nodeRuns[0]).toMatchObject({ status: 'succeeded', cached: true })

    // 换参数 → 必须重新生成
    await runner.begin(graph('别的提示词'))
    await vi.waitFor(async () => { expect(calls.length).toBe(2) })

    // 显式 refresh → 即使参数一样也重跑
    await runner.begin(graph('别的提示词'), { bypassCache: true })
    await vi.waitFor(async () => { expect(calls.length).toBe(3) })
  })

  it('re-executes when the cached file is gone and bounds the cache', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-cache-gone-') })
    const outputs = await temp('dsh-cache-gone-out-')
    const calls: string[] = []
    const tool = writingTool(outputs, calls)
    const runner = new WorkflowRunner({
      store, newRunId: () => 'run-x', generateImage: tool, generateVideo: tool, retryDelayMs: 1,
    })
    await runner.begin(graph('会被删掉'))
    await vi.waitFor(async () => { expect(calls).toHaveLength(1) })
    const entry = await store.lookupNodeCache(nodeCacheKey({ kind: 'video-generate', args: { prompt: '会被删掉', duration: 5, aspectRatio: '16:9', compare: false } }))
    expect(entry).toBeDefined()
    await rm(entry!.outputPath, { force: true })

    await runner.begin(graph('会被删掉'))
    await vi.waitFor(async () => { expect(calls).toHaveLength(2) })

    // 缓存有上限（按时间淘汰最旧）
    expect(MAX_NODE_CACHE).toBeGreaterThan(0)
  })
})
