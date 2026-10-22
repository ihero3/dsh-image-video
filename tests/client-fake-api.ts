// @vitest-environment jsdom
/**
 * 客户端测试共享夹具：内存假宿主 + 座位 props + 常见交互助手。
 *
 * 放在 `tests/client-*.ts`（非 `.test.ts`）里：vitest 的 include 只收
 * `tests/**\/*.test.ts(x)`，所以它不会被当成套件执行；命名带 `client` 前缀，
 * 落在 Track B 的文件所有权范围内（`src/client/**` + `tests/*client*`）。
 *
 * `workbench.client.test.tsx` 与 B1–B13 的各客户端测试共用这一份，避免
 * 每个文件各抄一遍 200 行的假 API——两份假宿主漂移比没有复用更糟。
 */
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import type { WorkbenchProps } from '../src/client/Workbench.tsx'
import { en } from '../src/client/locales.ts'
import type { AssetDuplicatesReport, AssetProjectStats, AssetSizeReport, PromptRecord, RunningGeneration, WorkbenchApi } from '../src/client/api.ts'
import type { AssetRecord, ProjectRecord, ResourceRecord, TaskRecord } from '../src/workbench/records.ts'
import type { WorkflowRecord, WorkflowRunRecord } from '../src/workbench/workflow.ts'
import type { TimelineRecord, TimelineTrack } from '../src/workbench/timeline.ts'
import type { OutputFile } from '../src/workbench/outputs.ts'

/** Host-supplied dropdown values (the browser bundle carries none of these). */
export const OPTIONS = {
  imageProviders: ['threerouter', 'wanx', 'seedance'],
  videoProviders: ['threerouter', 'wanx', 'minimax', 'seedance'],
  imageSizes: [
    { id: '1:1', label: '1:1', size: '1024*1024' },
    { id: '4:3', label: '4:3', size: '1152*864' },
  ],
  imageStyles: ['photo', 'illustration', '3d', 'anime', 'ink'],
  videoAspectRatios: ['16:9', '9:16', '1:1'],
  videoDuration: { min: 1, max: 30 },
}

export const HEALTH = {
  plugin: 'dsh-image-video' as const, version: '0.3.1', channel: '/image-video',
  provider: 'threerouter', outputsDir: '/tmp/outputs', at: '2026-10-14T00:00:00.000Z',
  options: OPTIONS,
}

/** Outputs the fake host offers. */
export const OUTPUT_IMAGE: OutputFile = {
  name: 'shot.png', path: '/tmp/outputs/shot.png', kind: 'image', bytes: 2048, modifiedAt: '2026-10-14T10:00:00.000Z',
}
export const OUTPUT_VIDEO: OutputFile = {
  name: 'clip.mp4', path: '/tmp/outputs/clip.mp4', kind: 'video', bytes: 4_096_000, modifiedAt: '2026-10-14T09:00:00.000Z',
}

/** In-memory stand-in for the host API, recording the calls it received. */
export function fakeApi(options: {
  failHealth?: string
  tasks?: TaskRecord[]
  assets?: AssetRecord[]
  running?: RunningGeneration[]
  referencedAssetIds?: readonly string[]
  workflows?: WorkflowRecord[]
  runs?: WorkflowRunRecord[]
  timelines?: TimelineRecord[]
  ffmpeg?: { available: boolean; code?: string; message?: string; version?: string; path?: string }
  defaults?: Record<string, string | number | null>
  /** `A-5` 提示词库初始内容（B-10 测试替身）。 */
  prompts?: PromptRecord[]
  /** `B-11` 体检三端点的返回（测试替身）。 */
  sizeReport?: AssetSizeReport
  duplicates?: AssetDuplicatesReport
  projectStats?: AssetProjectStats
} = {}) {
  const projects: ProjectRecord[] = []
  const assets: AssetRecord[] = [...(options.assets ?? [])]
  const tasks: TaskRecord[] = [...(options.tasks ?? [])]
  const resources: ResourceRecord[] = []
  const workflows: WorkflowRecord[] = [...(options.workflows ?? [])]
  const runs: WorkflowRunRecord[] = [...(options.runs ?? [])]
  const timelines: TimelineRecord[] = [...(options.timelines ?? [])]
  let runSequence = 0
  let renderJobs: Array<{ id: string; timelineId: string; projectId: string; status: 'running' | 'succeeded' | 'cancelled' | 'failed'; percent: number; startedAt: string; outputPath?: string; bytes?: number; durationMs?: number; error?: string }> = []
  let renderPolls = 0
  /** `renderTimeline` 最近一次收到的导出选项（B6 测试断言用）。 */
  let lastExportOptions: import('../src/client/api.ts').TimelineExportOptions | undefined
  const savedDefaults: Array<Record<string, string | number | null>> = []
  const calls: string[] = []
  /** `tasks/running` 的在飞生成（`F3` 测试替身）：测试可直接改 `startedAt` 推进时间。 */
  const runningGenerations: RunningGeneration[] = [...(options.running ?? [])]
  /** 被时间轴引用的素材 id（`A-2` 测试替身）：不带 force 删这些会进 skipped。 */
  const referencedAssetIds = new Set<string>(options.referencedAssetIds ?? [])
  /** `workflows/run` 收到的入参（B4 单节点运行断言用）。 */
  const runPayloads: Array<{ workflowId: string; only?: readonly string[] }> = []
  /** `B-9`：`composeMedia` 收到的入参（测试断言用）。 */
  const composePayloads: Array<{ projectId: string; prompt: string; resourceIds?: readonly string[] }> = []
  /** `B-10`：`extractPrompt` 收到的入参（测试断言用）。 */
  const extractInputs: Array<{ path?: string }> = []
  /** `B-10`：提示词库（内存态，`savePrompt`/`removePrompt` 会改它）。 */
  const prompts: PromptRecord[] = [...(options.prompts ?? [])]
  let promptSequence = prompts.length
  let counter = 0
  const api: WorkbenchApi = {
  // `A152`：批量登记 / 批量导入（测试替身）
  attachAssets: async input => ({ created: input.items.length, assets: [] }),
  importMedia: async input => ({ imported: input.paths.length, assets: [], skipped: [] }),
  // `A149`：工作台内生成（测试替身）。图片立即"登记"一张素材；视频返回 pending + taskId。
  generateMedia: async input => {
    if (input.mediaMode === 'video') {
      const task = {
        schemaVersion: 4, id: 'tsk-generate-video', kind: 'video', status: 'running',
        prompt: input.prompt, projectId: input.projectId,
        createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
      }
      tasks.push(task as never)
      return { mediaMode: 'video', pending: true, taskId: task.id }
    }
    const asset = {
      schemaVersion: 4, id: 'ast-generated', projectId: input.projectId ?? 'prj-1', kind: 'image',
      path: '/tmp/outputs/generated.png', bytes: 2048, prompt: input.prompt,
      createdAt: '2026-10-21T00:00:00.000Z',
    }
    assets.push(asset as never)
    return { mediaMode: 'image', path: asset.path, bytes: 2048, asset: asset as never }
  },
  // `B-9`：融合生图（测试替身）。记录入参并"登记"一张合成素材。
  composeMedia: async input => {
    calls.push('media/compose')
    composePayloads.push(input)
    const asset = {
      schemaVersion: 4, id: 'ast-composed', projectId: input.projectId, kind: 'image',
      path: '/tmp/outputs/composed.png', bytes: 3072, prompt: input.prompt,
      createdAt: '2026-10-22T00:00:00.000Z',
    }
    assets.push(asset as never)
    return { mediaMode: 'image', path: asset.path, bytes: 3072, asset: asset as never }
  },
  // `B-10`：从图片提取结构化提示词（测试替身，返回固定四字段）。
  extractPrompt: async input => {
    calls.push('prompts/extract')
    extractInputs.push(input)
    return { style: 'cinematic', subject: 'a courier in the rain', material: 'neon reflections', details: 'shallow depth of field' }
  },
  listPrompts: async () => { calls.push('prompts/list'); return [...prompts] },
  savePrompt: async input => {
    calls.push('prompts/save')
    const existing = input.id === undefined ? undefined : prompts.find(record => record.id === input.id)
    if (existing !== undefined) {
      const updated: PromptRecord = {
        ...existing, name: input.name, text: input.text,
        ...input.tags === undefined ? {} : { tags: input.tags },
      }
      prompts[prompts.indexOf(existing)] = updated
      return updated
    }
    promptSequence += 1
    const record: PromptRecord = {
      id: `prm-${promptSequence}`, name: input.name, text: input.text,
      ...input.tags === undefined ? {} : { tags: input.tags },
      createdAt: '2026-10-22T00:00:00.000Z',
    }
    prompts.unshift(record)
    return record
  },
  removePrompt: async id => {
    calls.push('prompts/remove')
    const index = prompts.findIndex(record => record.id === id)
    if (index < 0) return false
    prompts.splice(index, 1)
    return true
  },
    health: async () => {
      calls.push('health')
      if (options.failHealth !== undefined) throw new Error(options.failHealth)
      return options.defaults === undefined ? HEALTH : { ...HEALTH, defaults: options.defaults }
    },
    listProjects: async () => { calls.push('projects/list'); return [...projects] },
    createProject: async (name) => {
      calls.push('projects/create')
      counter += 1
      const project: ProjectRecord = {
        schemaVersion: 1, id: `prj-${counter}`, name,
        createdAt: `2026-10-14T00:00:0${counter}.000Z`, updatedAt: `2026-10-14T00:00:0${counter}.000Z`,
      }
      projects.push(project)
      return project
    },
    removeProject: async (id) => {
      calls.push('projects/remove')
      const index = projects.findIndex(project => project.id === id)
      if (index < 0) return false
      projects.splice(index, 1)
      return true
    },
    listAssets: async (projectId) => {
      calls.push('assets/list')
      return assets.filter(asset => asset.projectId === projectId)
    },
    attachAsset: async input => {
      calls.push('assets/attach')
      const existing = assets.find(asset => asset.projectId === input.projectId && asset.path === input.path)
      if (existing !== undefined) return { asset: existing, created: false }
      counter += 1
      const asset: AssetRecord = {
        schemaVersion: 1, id: `ast-${counter}`, projectId: input.projectId, kind: input.kind,
        path: input.path, bytes: input.bytes ?? 0, createdAt: `2026-10-14T01:00:0${counter}.000Z`,
      }
      assets.push(asset)
      return { asset, created: true }
    },
    removeAsset: async (id) => {
      calls.push('assets/remove')
      const index = assets.findIndex(asset => asset.id === id)
      if (index < 0) return false
      assets.splice(index, 1)
      return true
    },
    // `A-2`：批量删除（测试替身）。不存在的 id 进 skipped；force 才能删被引用的。
    removeAssets: async input => {
      calls.push('assets/remove-many')
      let removed = 0
      const skipped: Array<{ id: string; reason: string }> = []
      for (const id of input.ids.slice(0, 200)) {
        const index = assets.findIndex(asset => asset.id === id)
        if (index < 0) { skipped.push({ id, reason: '不存在' }); continue }
        const referenced = referencedAssetIds.size > 0 && referencedAssetIds.has(id)
        if (referenced && input.force !== true) {
          skipped.push({ id, reason: '素材被时间轴引用，需 force' })
          continue
        }
        assets.splice(index, 1)
        removed += 1
      }
      return { removed, skipped }
    },
    renameProject: async (id, name) => {
      calls.push('projects/rename')
      const index = projects.findIndex(project => project.id === id)
      const updated = { ...projects[index]!, name }
      projects[index] = updated
      return updated
    },
    listResources: async (projectId, kind) => {
      calls.push('resources/list')
      return resources.filter(resource => resource.projectId === projectId && (kind === undefined || resource.kind === kind))
    },
    createResource: async input => {
      calls.push('resources/create')
      counter += 1
      const resource: ResourceRecord = {
        schemaVersion: 1, id: `res-${counter}`, projectId: input.projectId, kind: input.kind, name: input.name,
        createdAt: '2026-10-14T02:00:00.000Z', updatedAt: '2026-10-14T02:00:00.000Z',
        scope: 'project',
        ...input.note === undefined ? {} : { note: input.note },
        ...input.assetPath === undefined ? {} : { assetPath: input.assetPath },
        ...input.assetPaths === undefined || input.assetPaths.length === 0 ? {} : { assetPaths: [...input.assetPaths] },
      }
      resources.push(resource)
      return resource
    },
    // `A153`/`A-3`：改资源（测试替身）。按宿主口径合并：
    // `assetPaths` 传数组=整组替换、`null`=清除；`assetPath: null` 清旧单图；不传=保留。
    updateResource: async input => {
      calls.push('resources/update')
      const index = resources.findIndex(resource => resource.id === input.id)
      if (index < 0) throw new Error(`unknown resource: ${input.id}`)
      const current = resources[index]!
      const mutable: Record<string, unknown> = { ...current }
      if (input.name !== undefined) mutable.name = input.name
      if (input.note !== undefined) mutable.note = input.note
      if (input.assetPath !== undefined) {
        if (input.assetPath === null) delete mutable.assetPath
        else mutable.assetPath = input.assetPath
      }
      if (input.assetPaths !== undefined) {
        if (input.assetPaths === null) delete mutable.assetPaths
        else mutable.assetPaths = [...input.assetPaths]
      }
      const updated = mutable as unknown as ResourceRecord
      resources[index] = updated
      return updated
    },
    removeResource: async (id) => {
      calls.push('resources/remove')
      const index = resources.findIndex(resource => resource.id === id)
      if (index < 0) return false
      resources.splice(index, 1)
      return true
    },
    listTasks: async () => { calls.push('tasks/list'); return [...tasks] },
    // `F3`：在飞生成快照（宿主注册表口径，带 startedAt）
    listRunningTasks: async () => { calls.push('tasks/running'); return [...runningGenerations] },
    runWorkflow: async (workflowId, only) => {
      calls.push('workflows/run')
      runPayloads.push({ workflowId, ...only === undefined ? {} : { only } })
      runSequence += 1
      const run: WorkflowRunRecord = {
        schemaVersion: 1, id: `run-${runSequence}`, workflowId, projectId: 'prj-1', status: 'succeeded',
        graph: { nodes: [], edges: [] },
        nodeRuns: [{
          nodeId: 'i', kind: 'image-generate', status: 'succeeded',
          startedAt: '2026-10-15T00:00:00.000Z', outputPath: '/tmp/out/shot.png',
        }],
        startedAt: '2026-10-15T00:00:00.000Z', finishedAt: '2026-10-15T00:00:00.000Z',
      }
      runs.unshift(run)
      return run
    },
    listRuns: async () => { calls.push('workflows/runs'); return [...runs] },
    cancelRun: async (runId) => {
      calls.push('workflows/run-cancel')
      const run = runs.find(candidate => candidate.id === runId)
      if (run === undefined) return false
      runs[runs.indexOf(run)] = { ...run, status: 'cancelled' }
      return true
    },
    retryRun: async (runId) => {
      calls.push('workflows/run-retry')
      const previous = runs.find(candidate => candidate.id === runId)
      runSequence += 1
      const run: WorkflowRunRecord = {
        schemaVersion: 1, id: `run-${runSequence}`, workflowId: previous?.workflowId ?? 'wfl-1',
        projectId: previous?.projectId ?? 'prj-1', status: 'running', graph: { nodes: [], edges: [] },
        nodeRuns: [], startedAt: '2026-10-15T00:00:01.000Z',
      }
      runs.unshift(run)
      return run
    },
    // `B-11`：素材库体检三端点（测试替身）。未提供报告时返回空结果，
    // 让测试只声明它关心的那份数据。
    assetSizeReport: async () => {
      calls.push('assets/size-report')
      return options.sizeReport ?? { totalBytes: 0, topBytes: 0, topShare: 0, medianBytes: 0, count: 0, top: [] }
    },
    assetDuplicates: async () => {
      calls.push('assets/duplicates')
      return options.duplicates ?? { groups: [], reclaimableBytes: 0, hashedFiles: 0, skippedFiles: 0 }
    },
    assetProjectStats: async () => {
      calls.push('assets/project-stats')
      return options.projectStats ?? { totalBytes: 0, projects: [], topShare: 0 }
    },
    probeFfmpeg: async () => {
      calls.push('media/ffmpeg')
      return options.ffmpeg ?? { available: true, version: '7.1.1', path: '/opt/homebrew/bin/ffmpeg', encoders: { h264: true, aac: true } }
    },
    saveDefaults: async (patch) => { calls.push('defaults/save'); savedDefaults.push(patch) },
    listResourceUsage: async () => { calls.push('resources/usage'); return [] },
    renderTimeline: async (timelineId, _projectId, options) => {
      calls.push('timelines/render')
      lastExportOptions = options
      renderJobs = [{ id: 'render-1', timelineId, projectId: 'prj-1', status: 'running', percent: 0, startedAt: '2026-10-16T00:00:00.000Z' }]
      return renderJobs[0]!
    },
    listRenders: async () => {
      calls.push('timelines/renders')
      // 第二次轮询就"渲染完成"，模拟真实进度收尾
      renderPolls += 1
      if (renderPolls > 1 && renderJobs[0] !== undefined) {
        renderJobs = [{ ...renderJobs[0]!, status: 'succeeded', percent: 100, outputPath: '/tmp/outputs/movie.mp4', bytes: 2048, durationMs: 1000 }]
      }
      return [...renderJobs]
    },
    cancelRender: async (renderId) => {
      calls.push('timelines/render-cancel')
      if (renderJobs[0]?.id !== renderId) return false
      renderJobs = [{ ...renderJobs[0]!, status: 'cancelled', error: '渲染已取消' }]
      return true
    },
    listTimelines: async () => {
      calls.push('timelines/list')
      return [...timelines]
    },
    saveTimeline: async (input) => {
      calls.push('timelines/save')
      const stamp = '2026-10-16T00:00:00.000Z'
      const existing = input.id === undefined ? undefined : timelines.find(row => row.id === input.id)
      const record: TimelineRecord = {
        schemaVersion: 1, id: existing?.id ?? `tml-${timelines.length + 1}`, projectId: input.projectId,
        name: input.name ?? '未命名时间轴', frameRate: input.frameRate ?? 30,
        burnSubtitles: input.burnSubtitles ?? existing?.burnSubtitles ?? true,
        tracks: input.tracks as TimelineTrack[], createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
        ...input.exportFormat === undefined ? {} : { exportFormat: input.exportFormat },
        ...input.normalizeLoudness === undefined ? {} : { normalizeLoudness: input.normalizeLoudness },
      }
      const index = timelines.findIndex(row => row.id === record.id)
      if (index < 0) timelines.push(record)
      else timelines[index] = record
      return record
    },
    removeTimeline: async (id) => {
      calls.push('timelines/remove')
      const index = timelines.findIndex(row => row.id === id)
      if (index < 0) return false
      timelines.splice(index, 1)
      return true
    },
    listWorkflows: async (projectId) => {
      calls.push('workflows/list')
      return workflows.filter(workflow => workflow.projectId === projectId)
    },
    saveWorkflow: async input => {
      calls.push('workflows/save')
      const stamp = '2026-10-15T00:00:00.000Z'
      const existing = workflows.find(workflow => workflow.id === input.id)
      const record: WorkflowRecord = {
        schemaVersion: 1,
        id: existing?.id ?? `wfl-${workflows.length + 1}`,
        projectId: input.projectId,
        name: input.name ?? '未命名工作流',
        nodes: input.nodes as WorkflowRecord['nodes'],
        edges: input.edges as WorkflowRecord['edges'],
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      }
      if (existing === undefined) workflows.push(record)
      else workflows[workflows.indexOf(existing)] = record
      return record
    },
    removeWorkflow: async (id) => {
      calls.push('workflows/remove')
      const index = workflows.findIndex(workflow => workflow.id === id)
      if (index < 0) return false
      workflows.splice(index, 1)
      return true
    },
    compactAssets: async () => {
      calls.push('maintenance/compact')
      const seen = new Map<string, AssetRecord>()
      let removed = 0
      for (const asset of [...assets]) {
        const key = `${asset.projectId}:${asset.path}`
        if (seen.has(key)) { removed += 1; assets.splice(assets.indexOf(asset), 1); continue }
        seen.set(key, asset)
      }
      return removed
    },
    cancelTask: async (id) => {
      calls.push('tasks/cancel')
      const index = tasks.findIndex(task => task.id === id)
      if (index < 0) return false
      tasks[index] = { ...tasks[index]!, status: 'cancelled' }
      return true
    },
    assignTask: async (id, projectId) => {
      calls.push('tasks/assign')
      const index = tasks.findIndex(task => task.id === id)
      const updated = { ...tasks[index]!, projectId }
      tasks[index] = updated
      return updated
    },
    listOutputs: async () => { calls.push('outputs/list'); return [OUTPUT_IMAGE, OUTPUT_VIDEO] },
    getDiagnostics: async () => {
      calls.push('diagnostics')
      return {
        plugin: { name: 'dsh-image-video', version: '0.3.1' },
        provider: 'threerouter', outputsDir: '/tmp/outputs',
        data: { projects: 1, assets: 1, tasks: 0, resources: 0, runningRuns: 0, writeCount: 1, fileBytes: 2048 },
        renders: {
          running: 0, queued: 0,
          recent: [],
          stats: { finished: 3, failed: 0, cancelled: 1, durationMs: { p50: 1000, p90: 2000 } },
        },
        runs: { running: 0 },
        cache: { nodeResults: 0 },
        outputs: { files: 2, bytes: 4_098_048, referenced: 1, oldestAt: '2026-10-14T09:00:00.000Z', newestAt: '2026-10-14T10:00:00.000Z' },
        errors: { errors: [], errorCount: 0 },
      }
    },
  }
  return { api, calls, projects, assets, tasks, resources, workflows, timelines, savedDefaults, runPayloads, runningGenerations, referencedAssetIds, composePayloads, extractInputs, prompts, exportOptions: () => lastExportOptions }
}

/** Props for one render; the seat binds far more than this component reads. */
export function clientProps(overrides: { visible?: boolean; fullscreen?: boolean; api?: WorkbenchApi } = {}): WorkbenchProps {
  const useTabInfo = () => ({
    sidebar: { expanded: true, fullscreen: overrides.fullscreen ?? false },
    panel: { id: 'pane-1' },
    tab: { visible: overrides.visible ?? true },
  })
  return {
    kind: 'dsh-image-video-workbench',
    t: (key: keyof typeof en) => en[key],
    useTabInfo,
    api: overrides.api ?? fakeApi().api,
  } as unknown as WorkbenchProps
}

/** Create the first project through the UI and wait for it to land. */
export async function createProject(host: ReturnType<typeof fakeApi>, name: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(en.newProject), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: en.create }))
  await waitFor(() => { expect(host.projects).toHaveLength(1) })
}

/**
 * jsdom 不实现媒体播放：挂载 `<video>` 的测试先补上 `play`/`pause`。
 * @returns 恢复原实现的函数，调用方放进 `afterAll`。
 */
export function stubMediaPlayback(): () => void {
  const originalPlay = HTMLMediaElement.prototype.play
  const originalPause = HTMLMediaElement.prototype.pause
  HTMLMediaElement.prototype.play = () => Promise.resolve()
  HTMLMediaElement.prototype.pause = () => {}
  return () => {
    HTMLMediaElement.prototype.play = originalPlay
    HTMLMediaElement.prototype.pause = originalPause
  }
}

/** Re-export so test files need one import for render/screen/waitFor too. */
export { cleanup, render, screen, waitFor, fireEvent }
export type { ReactNode }
