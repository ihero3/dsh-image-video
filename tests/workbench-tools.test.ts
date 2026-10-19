/**
 * Agent 工具面（`T6-3`，需求 `R-AGT-2`）。
 *
 * 这个文件守两条纪律：① **参数不许幻觉**——不认识的动作要把合法取值列回去，
 * 引用不存在的素材/项目要报错，绝不"猜一个差不多的"；② **能跑通整条链路**——
 * 对话里下达"把素材拼成 10 秒的片子并导出"必须真的能完成。
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { MAX_TOOL_CLIPS, MAX_TOOL_ROWS, createWorkbenchTools } from '../src/tools/workbench.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { GenerationRegistry } from '../src/workbench/cancel.ts'
import { WorkflowRunner, type GenerationTool } from '../src/workbench/runner.ts'
import { RenderRegistry } from '../src/media/render-registry.ts'
import { RenderService } from '../src/media/render.ts'
import { timelineDurationMs } from '../src/workbench/timeline.ts'

const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))) })

/** 一套真实依赖 + 假生成工具（不花任何生成额度）。 */
async function harness() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-workbench-tools-'))
  dirs.push(directory)
  const store = new WorkbenchStore({ directory })
  const outputs = await mkdtemp(join(tmpdir(), 'dsh-workbench-tools-out-'))
  dirs.push(outputs)
  const generateImage: GenerationTool = { async execute() { return { localPath: join(outputs, 'shot.png'), bytes: 10 } } }
  const generateVideo: GenerationTool = { async execute() { return { videoPath: join(outputs, 'clip.mp4'), bytes: 20 } } }
  const runner = new WorkflowRunner({ store, newRunId: () => `run-${Date.now().toString(36)}`, generateImage, generateVideo, retryDelayMs: 1 })
  const renders = new RenderRegistry({
    // 渲染器只用来起任务：run 是空实现，测试只断言"任务起来了"
    render: new RenderService({ outputsDir: outputs, probe: async () => ({ available: true, path: '/usr/bin/true' }), run: async () => undefined }),
  })
  const tools = createWorkbenchTools({
    store, renders, runner, registry: new GenerationRegistry(),
    outputsDir: '/tmp/outputs',
    // `A63`：探测桩——只认一个"好"路径，其余视为越界/无效
    probeAsset: async relative => relative === 'outputs/good.mp4'
      ? { width: 320, height: 240, fps: 30, durationMs: 2000, hasAudio: false }
      : undefined,
  })
  const byName = new Map(tools.map(tool => [tool.name, tool]))
  const call = async (name: string, args: Record<string, unknown>): Promise<{ text: string; value: unknown }> => {
    const tool = byName.get(name)
    if (tool === undefined) throw new Error(`没有工具 ${name}`)
    const result = await tool.execute(args, {} as never)
    const text = typeof result === 'string' ? result : JSON.stringify(result)
    return { text, value: JSON.parse(text) as unknown }
  }
  return { store, outputs, tools, byName, call, directory }
}

/** 造一个真实存在的小文件（attach 用）。 */
async function touch(dir: string, name: string): Promise<string> {
  const path = join(dir, name)
  await writeFile(path, 'x')
  return path
}

describe('agent tool surface (T6-3)', () => {
  it('lists workflow templates without needing a project (A67)', async () => {
    const { call } = await harness()
    const result = await call('workbench_workflow', { action: 'templates' })
    expect((result.value as { templates: unknown[] }).templates.length).toBeGreaterThan(0)
  })

  it('adds a clip using only the timeline id (A67)', async () => {
    const { store, call, outputs } = await harness()
    const project = await store.createProject('A67')
    const file = await touch(outputs, 'clip.mp4')
    await store.attachAsset({ projectId: project.id, path: file, kind: 'video' })
    const timeline = await store.saveTimeline({ projectId: project.id, tracks: [{ id: 'v1', kind: 'video', clips: [] }] })
    await call('workbench_timeline', { action: 'add-clip', timelineId: timeline.id, clips: [{ assetPath: file, durationMs: 1000 }] })
    const saved = await store.findTimeline(timeline.id)
    expect(saved?.tracks[0]?.clips).toHaveLength(1)
  })

  it('probes real media through the tool surface (A63/A65)', async () => {
    const { call } = await harness()
    const result = await call('workbench_assets', { action: 'probe', path: 'outputs/good.mp4' })
    // 结构化断言（`json()` 输出是格式化的，别用字符串匹配）
    expect(result.value).toMatchObject({ path: 'outputs/good.mp4', spec: { width: 320, height: 240, durationMs: 2000 } })
  })

  it('rejects probe paths outside the allowed boundary (A63/A65)', async () => {
    const { call } = await harness()
    await expect(call('workbench_assets', { action: 'probe', path: '/etc/passwd' })).rejects.toThrow(/探测失败/)
  })


  it('registers the five tools and documents every allowed action', async () => {
    const { byName } = await harness()
    expect([...byName.keys()].sort()).toEqual(['workbench_assets', 'workbench_projects', 'workbench_tasks', 'workbench_timeline', 'workbench_workflow'])
    const expected: Record<string, string[]> = {
      workbench_projects: ['list', 'create', 'rename'],
      workbench_assets: ['list', 'attach', 'probe'],
      workbench_timeline: ['list', 'add-clip', 'export'],
      workbench_workflow: ['list', 'save', 'run', 'runs'],
      workbench_tasks: ['list', 'renders', 'cancel'],
    }
    for (const [name, actions] of Object.entries(expected)) {
      const tool = byName.get(name)
      expect(tool?.description).toBeTruthy()
      for (const action of actions) {
        // 动作取值必须写在描述里，模型才不至于自己发明一个
        expect(tool?.description).toContain(action)
      }
    }
  })

  it('exposes no destructive actions: deletes stay in the UI (T6-5)', async () => {
    const { byName } = await harness()
    // 工具面刻意不提供删除：模型无法在无确认的情况下删掉项目/素材（`R-AGT-4`）。
    // 唯一有破坏性的动作是 cancel，且必须显式给 taskId / renderId。
    for (const tool of byName.values()) {
      expect(tool.description).not.toMatch(/\b(delete|remove|删除)\b/i)
    }
    const tasks = byName.get('workbench_tasks')
    expect(tasks?.description).toContain('取消')
    expect(tasks?.description).toMatch(/只有在用户明确要求时/)
  })

  it('creates, lists and renames projects, and rejects an unknown action with the valid list', async () => {
    const { call } = await harness()
    const created = await call('workbench_projects', { action: 'create', name: '对话项目' })
    const id = (created.value as { project: { id: string } }).project.id
    const listed = await call('workbench_projects', { action: 'list' })
    expect((listed.value as { count: number }).count).toBe(1)
    const renamed = await call('workbench_projects', { action: 'rename', projectId: id, name: '改过名' })
    expect((renamed.value as { project: { name: string } }).project.name).toBe('改过名')

    await expect(call('workbench_projects', { action: 'destroy', projectId: id })).rejects.toThrow(/合法取值：list \/ create \/ rename/)
    await expect(call('workbench_projects', { action: 'rename', projectId: 'nope', name: 'x' })).rejects.toThrow(/找不到项目/)
  })

  it('refuses asset paths that were never registered (no guessing)', async () => {
    const { call, store, outputs } = await harness()
    const project = await store.createProject('素材项目')
    await call('workbench_timeline', { action: 'list', projectId: project.id })
    const timeline = await store.saveTimeline({ projectId: project.id, name: '成片', tracks: [
      { id: 'v1', kind: 'video', clips: [] },
      { id: 's1', kind: 'subtitle', clips: [] },
    ] })
    const missing = await call('workbench_timeline', {
      action: 'add-clip', projectId: project.id, timelineId: timeline.id, track: 'video',
      clips: [{ assetPath: '/tmp/never-registered.mp4', startMs: 0, durationMs: 1000 }],
    }).catch(error => error as Error)
    expect(String(missing)).toMatch(/不在项目/)
    expect(String(missing)).toMatch(/workbench_assets attach/)

    // 登记过之后就能加
    await call('workbench_assets', { action: 'attach', projectId: project.id, path: await touch(outputs, 'a.mp4') })
    const listed = await call('workbench_assets', { action: 'list', projectId: project.id })
    expect((listed.value as { count: number }).count).toBe(1)
  })

  it('builds a 10-second cut from assets and exports it (R-AGT-2 acceptance)', async () => {
    const { call, store, outputs } = await harness()
    const project = await store.createProject('十秒片子')
    const first = await touch(outputs, 'first.mp4')
    const second = await touch(outputs, 'second.mp4')

    for (const path of [first, second]) {
      const attached = await call('workbench_assets', { action: 'attach', projectId: project.id, path, kind: 'video' })
      expect((attached.value as { created: boolean }).created).toBe(true)
    }
    const timeline = await store.saveTimeline({ projectId: project.id, name: '10 秒成片', tracks: [
      { id: 'v1', kind: 'video', clips: [] },
      { id: 's1', kind: 'subtitle', clips: [] },
    ] })

    // 4s + 3s + 3s = 10s，起点不传就自动接着排
    await call('workbench_timeline', {
      action: 'add-clip', projectId: project.id, timelineId: timeline.id, track: 'video',
      clips: [
        { assetPath: first, durationMs: 4000 },
        { assetPath: second, durationMs: 3000 },
        { assetPath: first, durationMs: 3000 },
      ],
    })
    await call('workbench_timeline', {
      action: 'add-clip', projectId: project.id, timelineId: timeline.id, track: 'subtitle',
      clips: [{ text: '十秒片子', durationMs: 2000 }],
    })

    const stored = await store.findTimeline(timeline.id)
    expect(stored).toBeDefined()
    expect(timelineDurationMs(stored!.tracks)).toBe(10_000)

    const listed = await call('workbench_timeline', { action: 'list', projectId: project.id })
    const row = (listed.value as { timelines: Array<{ totalMs: number; tracks: Array<{ kind: string; clips: number }> }> }).timelines[0]
    expect(row?.totalMs).toBe(10_000)
    expect(row?.tracks.map(track => track.clips)).toEqual([3, 1])

    const exported = await call('workbench_timeline', { action: 'export', projectId: project.id, timelineId: timeline.id })
    const render = (exported.value as { render: { id: string; status: string } }).render
    expect(render.id).toMatch(/^render-/)
    expect(render.status).toBe('running')

    const jobs = await call('workbench_tasks', { action: 'renders', projectId: project.id })
    expect((jobs.value as { renders: Array<{ id: string }> }).renders[0]?.id).toBe(render.id)
  })

  it('caps batch sizes and clamps list limits', async () => {
    const { call, store, outputs } = await harness()
    const project = await store.createProject('上限')
    for (let index = 0; index <= MAX_TOOL_ROWS; index += 1) {
      await store.attachAsset({ projectId: project.id, path: await touch(outputs, `f-${index}.mp4`), kind: 'video' })
    }
    const listed = await call('workbench_assets', { action: 'list', projectId: project.id, limit: 5 })
    expect((listed.value as { count: number }).count).toBe(5)
    const capped = await call('workbench_assets', { action: 'list', projectId: project.id, limit: 999 })
    expect((capped.value as { count: number }).count).toBe(MAX_TOOL_ROWS)

    const timeline = await store.saveTimeline({ projectId: project.id, tracks: [{ id: 'v1', kind: 'video', clips: [] }] })
    const assets = await store.listAssets(project.id)
    const tooMany = Array.from({ length: MAX_TOOL_CLIPS + 1 }, () => ({ assetPath: assets[0]!.path, durationMs: 1000 }))
    await expect(call('workbench_timeline', { action: 'add-clip', projectId: project.id, timelineId: timeline.id, clips: tooMany }))
      .rejects.toThrow(new RegExp(`一次最多加 ${MAX_TOOL_CLIPS}`))
    await expect(call('workbench_timeline', { action: 'add-clip', projectId: project.id, timelineId: timeline.id, clips: [] }))
      .rejects.toThrow(/至少一个片段/)
  })

  it('turns a script into timed subtitle clips through the tool surface (A14)', async () => {
    const { call, store } = await harness()
    const project = await store.createProject('字幕项目')
    const timeline = await store.saveTimeline({
      projectId: project.id, tracks: [
        { id: 'v1', kind: 'video', clips: [] },
        { id: 's1', kind: 'subtitle', clips: [] },
      ],
    })
    const result = await call('workbench_timeline', {
      action: 'add-subtitles', projectId: project.id, timelineId: timeline.id,
      text: '第一句台词。第二句台词。第三句台词。', startMs: 0, endMs: 6000,
    })
    const value = result.value as { timeline: { added: number }, subtitles: Array<{ text: string; durationMs: number }> }
    expect(value.timeline.added).toBe(3)
    expect(value.subtitles.map(row => row.text)).toEqual(['第一句台词', '第二句台词', '第三句台词'])
    const saved = (await store.findTimeline(timeline.id))!
    const subtitleTrack = saved.tracks.find(track => track.kind === 'subtitle')!
    expect(subtitleTrack.clips).toHaveLength(3)
    // 再追加一段：应接在末尾而不是覆盖
    await call('workbench_timeline', {
      action: 'add-subtitles', projectId: project.id, timelineId: timeline.id, text: '第四句。', startMs: 6000, endMs: 8000,
    })
    expect((await store.findTimeline(timeline.id))!.tracks.find(track => track.kind === 'subtitle')!.clips).toHaveLength(4)
  })

  it('lists and instantiates the drama template through the tool surface (A10)', async () => {
    const { call, store } = await harness()
    const project = await store.createProject('漫剧项目')
    const listed = await call('workbench_workflow', { action: 'templates', projectId: project.id })
    const templates = (listed.value as { templates: Array<{ id: string; nodes: string[] }> }).templates
    expect(templates.some(template => template.id === 'drama-series')).toBe(true)

    const created = await call('workbench_workflow', {
      action: 'from-template', projectId: project.id, templateId: 'drama-series',
    })
    const workflow = (created.value as { workflow: { id: string; nodes: number; edges: number } }).workflow
    expect(workflow.nodes).toBe(7)
    expect(workflow.edges).toBe(6)
    // 真存进了 store，能在 list 里看到
    expect((await store.listWorkflows(project.id)).some(record => record.id === workflow.id)).toBe(true)
    await expect(call('workbench_workflow', { action: 'from-template', projectId: project.id, templateId: 'nope' }))
      .rejects.toThrow(/没有模板/)
  })

  it('edits timelines through the tool surface: trim / remove-clip / set-format / set-track (A6)', async () => {
    const { call, store, outputs } = await harness()
    const project = await store.createProject('工具剪片')
    const assetPath = await touch(outputs, 'clip.mp4')
    await store.attachAsset({ projectId: project.id, path: assetPath, kind: 'video' })
    const timeline = await store.saveTimeline({ projectId: project.id, tracks: [
      { id: 'v1', kind: 'video', clips: [] },
      { id: 'a1', kind: 'audio', clips: [] },
    ] })
    await call('workbench_timeline', {
      action: 'add-clip', projectId: project.id, timelineId: timeline.id, track: 'video',
      clips: [{ assetPath, durationMs: 5000 }],
    })
    const before = (await store.findTimeline(timeline.id))!
    const clipId = before.tracks[0]!.clips[0]!.id

    // trim：改起点/时长/源偏移
    await call('workbench_timeline', {
      action: 'trim', projectId: project.id, timelineId: timeline.id,
      trims: [{ clipId, startMs: 1000, durationMs: 2500, inMs: 500 }],
    })
    const trimmed = (await store.findTimeline(timeline.id))!.tracks[0]!.clips[0]!
    expect(trimmed).toMatchObject({ startMs: 1000, durationMs: 2500, inMs: 500 })
    // 不存在的 clipId 要报错（不许猜）
    await expect(call('workbench_timeline', {
      action: 'trim', projectId: project.id, timelineId: timeline.id, trims: [{ clipId: 'nope', startMs: 0 }],
    })).rejects.toThrow(/不存在/)

    // set-format：导出规格（越界由 store 校验拒绝）
    const formatted = await call('workbench_timeline', {
      action: 'set-format', projectId: project.id, timelineId: timeline.id,
      width: 1080, height: 1920, frameRate: 30,
    })
    expect((formatted.value as { timeline: { exportFormat: { width: number } } }).timeline.exportFormat.width).toBe(1080)
    await expect(call('workbench_timeline', {
      action: 'set-format', projectId: project.id, timelineId: timeline.id, width: 641, height: 360, frameRate: 30,
    })).rejects.toThrow(/even number/)

    // set-track：音量与静音
    const tracked = await call('workbench_timeline', {
      action: 'set-track', projectId: project.id, timelineId: timeline.id, track: 'audio', volume: 0.6, muted: false,
    })
    const audio = (tracked.value as { timeline: { tracks: Array<{ kind: string; volume: number | null }> } }).timeline.tracks.find(row => row.kind === 'audio')
    expect(audio?.volume).toBe(0.6)

    // drop-clip：把片段移出时间轴
    await call('workbench_timeline', { action: 'drop-clip', projectId: project.id, timelineId: timeline.id, clipIds: [clipId] })
    expect((await store.findTimeline(timeline.id))!.tracks[0]!.clips).toHaveLength(0)
  })

  it('applies an export preset through set-format (A31)', async () => {
    const { call, store } = await harness()
    const project = await store.createProject('预设项目')
    const timeline = await store.saveTimeline({ projectId: project.id, tracks: [] })
    await call('workbench_timeline', {
      action: 'set-format', projectId: project.id, timelineId: timeline.id, presetId: 'douyin-vertical',
    })
    expect((await store.findTimeline(timeline.id))?.exportFormat).toMatchObject({ width: 1080, height: 1920, frameRate: 30 })
    await expect(call('workbench_timeline', {
      action: 'set-format', projectId: project.id, timelineId: timeline.id, presetId: 'nope',
    })).rejects.toThrow(/没有导出预设/)
  })

  it('reports render-cancel honestly for unknown ids (A6)', async () => {
    const { call } = await harness()
    const result = await call('workbench_tasks', { action: 'render-cancel', renderId: 'render-nope' })
    expect(result.value).toMatchObject({ cancelled: false, status: null })
    expect((result.value as { hint: string }).hint).toContain('没有找到')
  })

  it('saves, runs and reports workflow runs through the tool surface', async () => {
    const { call, store } = await harness()
    const project = await store.createProject('工具跑图')
    const saved = await call('workbench_workflow', {
      action: 'save', projectId: project.id, name: '一张图',
      nodes: [{ id: 'v', kind: 'video-generate', params: { prompt: '齿轮' } }], edges: [],
    })
    const workflowId = (saved.value as { workflow: { id: string } }).workflow.id
    const started = await call('workbench_workflow', { action: 'run', projectId: project.id, workflowId })
    expect((started.value as { run: { id: string } }).run.id).toBeTruthy()

    await new Promise(resolve => { setTimeout(resolve, 150) })
    const runs = await call('workbench_workflow', { action: 'runs', projectId: project.id })
    const run = (runs.value as { runs: Array<{ status: string; nodes: Array<{ id: string; status: string; outputPath?: string }> }> }).runs[0]
    expect(run?.status).toBe('succeeded')
    expect(run?.nodes[0]).toMatchObject({ id: 'v', status: 'succeeded' })
    expect(run?.nodes[0]?.outputPath).toContain('clip.mp4')

    const listed = await call('workbench_workflow', { action: 'list', projectId: project.id })
    expect((listed.value as { count: number }).count).toBe(1)
    await expect(call('workbench_workflow', { action: 'explode' })).rejects.toThrow(/不认识 action=explode.*templates/)
  })

  it('lists tasks and reports a no-op cancel honestly', async () => {
    const { call } = await harness()
    const listed = await call('workbench_tasks', { action: 'list' })
    expect((listed.value as { count: number }).count).toBe(0)
    const cancelled = await call('workbench_tasks', { action: 'cancel', taskId: 'task-nope' })
    expect(cancelled.value).toMatchObject({ cancelledTask: false, cancelledRender: false })
    await expect(call('workbench_tasks', { action: 'cancel' })).rejects.toThrow(/taskId 或 renderId/)
  })
})

