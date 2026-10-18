/**
 * Agent 工具面（`T6-3`，需求 `R-AGT-2`）。
 *
 * 让对话里的模型能驱动工作台：列出/创建项目、查素材、把素材放进时间轴、创建与运行
 * 工作流、查任务与运行记录、起一次导出。
 *
 * 两条纪律：
 * - **参数不许幻觉**：每个动作都校验必填项，遇到不认识的 `action` 直接把合法取值列回去；
 *   引用的 id / 路径必须真实存在，绝不"猜一个差不多的"。
 * - **批量有上限**：一次调用最多返回 {@link MAX_TOOL_ROWS} 行、最多接收
 *   {@link MAX_TOOL_CLIPS} 个片段，避免模型一次把整个库塞进上下文。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { GenerationRegistry } from '../workbench/cancel.ts'
import type { RenderRegistry } from '../media/render-registry.ts'
import type { WorkflowRunner } from '../workbench/runner.ts'
import { newWorkbenchId } from '../workbench/records.ts'
import type { WorkbenchStore } from '../workbench/store.ts'

/** 一次返回给模型的最大行数。 */
export const MAX_TOOL_ROWS = 50
/** 一次调用最多处理的片段数。 */
export const MAX_TOOL_CLIPS = 20

/** 工具依赖。 */
export interface WorkbenchToolsDeps {
  readonly store: WorkbenchStore
  readonly renders: RenderRegistry
  readonly runner: WorkflowRunner
  readonly registry: GenerationRegistry
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function requireString(args: Record<string, unknown>, key: string, action: string): string {
  const value = args[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${action} 需要参数 ${key}（非空字符串）`)
  }
  return value.trim()
}

function optionalLimit(args: Record<string, unknown>): number {
  const raw = args.limit
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return MAX_TOOL_ROWS
  return Math.max(1, Math.min(MAX_TOOL_ROWS, Math.round(raw)))
}

function unknownAction(tool: string, action: string, allowed: readonly string[]): never {
  throw new Error(`${tool} 不认识 action=${action}；合法取值：${allowed.join(' / ')}`)
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/**
 * 造出全部工作台工具。
 * @param deps - 存储、运行器、导出与取消表。
 * @returns 工具定义数组（调用方用 `ctx.tools.register` 注册，disposer 交给框架）。
 */
export function createWorkbenchTools(deps: WorkbenchToolsDeps) {
  const { store, renders, runner } = deps

  const projects = defineTool({
    name: 'workbench_projects',
    description:
      '工作台的项目：list（列出全部项目，可按名称过滤）、create（新建项目）、rename（改名）。'
      + '项目是素材/时间轴/工作流的归属单位；拿不准用哪个就先 list。',
    // 工具结果就是给模型看的 JSON 文本；声明成 string 才能让 defineTool
    // 正确推断出参类型（缺省会被推成 never）
    output: {
      schema: { type: 'string', description: 'JSON 文本结果' },
      // 结果是给模型读的 JSON 文本，直接变成一条文本内容块
      render: (_args, value): ContentBlock[] => [{ type: 'text', text: value }],
    },
    parameters: {
      action: { type: 'string', required: true, description: 'list / create / rename' },
      name: { type: 'string', description: 'create 时的项目名（1-80 字）；rename 时的新名字' },
      projectId: { type: 'string', description: 'rename 时的项目 id' },
      filter: { type: 'string', description: 'list 时按名称包含此子串过滤（可选）' },
      limit: { type: 'integer', description: `list 最多返回多少行（默认 ${MAX_TOOL_ROWS}）` },
      trims: {
        type: 'array',
        description: `trim 时改哪些片段（≤${MAX_TOOL_CLIPS}）：每项 {clipId, startMs?, durationMs?, inMs?}`,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            clipId: { type: 'string', description: '片段 id（timeline list 里拿）' },
            startMs: { type: 'integer', description: '新的起点（毫秒）' },
            durationMs: { type: 'integer', description: '新的时长（毫秒）' },
            inMs: { type: 'integer', description: '源内偏移（毫秒）' },
          },
        },
      },
      clipIds: { type: 'array', description: 'drop-clip 时要移出时间轴的片段 id', items: { type: 'string', description: '片段 id' } },
      width: { type: 'integer', description: 'set-format 时导出宽度（偶数 128–4096）' },
      height: { type: 'integer', description: 'set-format 时导出高度（偶数 128–4096）' },
      frameRate: { type: 'integer', description: 'set-format 时导出帧率（24/25/30/60）' },
      bitrateKbps: { type: 'integer', description: 'set-format 时视频码率（kbps，可选）' },
      track: { type: 'string', description: 'set-track 时的轨道：video / audio / subtitle（默认 audio）' },
      volume: { type: 'number', description: 'set-track 时的轨道音量（0–2）' },
      muted: { type: 'boolean', description: 'set-track 时是否静音' },
    },
    async execute(args) {
      const input = asRecord(args)
      const action = requireString(input, 'action', 'workbench_projects')
      if (action === 'list') {
        const filter = typeof input.filter === 'string' && input.filter !== '' ? input.filter : undefined
        const rows = (await store.listProjects())
          .filter(project => filter === undefined || project.name.includes(filter))
          .slice(0, optionalLimit(input))
        return json({ projects: rows.map(project => ({ id: project.id, name: project.name, updatedAt: project.updatedAt })), count: rows.length })
      }
      if (action === 'create') {
        const project = await store.createProject(requireString(input, 'name', 'workbench_projects create'))
        return json({ project: { id: project.id, name: project.name } })
      }
      if (action === 'rename') {
        const target = requireString(input, 'projectId', 'workbench_projects rename')
        const updated = await store.renameProject(target, requireString(input, 'name', 'workbench_projects rename'))
        if (updated === undefined) throw new Error(`找不到项目 ${target}`)
        return json({ project: { id: updated.id, name: updated.name } })
      }
      return unknownAction('workbench_projects', action, ['list', 'create', 'rename'])
    },
  })

  const assets = defineTool({
    name: 'workbench_assets',
    description:
      '工作台的素材（生成出来的图/视频文件）：list（按项目列出，可按素材种类过滤）、attach（把一个已存在的文件路径登记成素材）。'
      + '素材不复制文件，只记录路径；重复登记同一路径会返回已有的那条（created=false）。',
    // 工具结果就是给模型看的 JSON 文本；声明成 string 才能让 defineTool
    // 正确推断出参类型（缺省会被推成 never）
    output: {
      schema: { type: 'string', description: 'JSON 文本结果' },
      // 结果是给模型读的 JSON 文本，直接变成一条文本内容块
      render: (_args, value): ContentBlock[] => [{ type: 'text', text: value }],
    },
    parameters: {
      action: { type: 'string', required: true, description: 'list / attach' },
      projectId: { type: 'string', required: true, description: '项目 id（先 list workbench_projects）' },
      path: { type: 'string', description: 'attach 时的文件绝对路径' },
      kind: { type: 'string', description: "attach 时的素材种类：image / video（默认按扩展名推断）" },
      prompt: { type: 'string', description: 'attach 时记录产生它的提示词（可选）' },
      limit: { type: 'integer', description: `list 最多返回多少行（默认 ${MAX_TOOL_ROWS}）` },
    },
    async execute(args) {
      const input = asRecord(args)
      const action = requireString(input, 'action', 'workbench_assets')
      const projectId = requireString(input, 'projectId', 'workbench_assets')
      if (action === 'list') {
        const kind = typeof input.kind === 'string' && (input.kind === 'image' || input.kind === 'video') ? input.kind : undefined
        const rows = (await store.listAssets(projectId))
          .filter(asset => kind === undefined || asset.kind === kind)
          .slice(0, optionalLimit(input))
        return json({
          assets: rows.map(asset => ({ id: asset.id, kind: asset.kind, path: asset.path, bytes: asset.bytes, createdAt: asset.createdAt })),
          count: rows.length,
        })
      }
      if (action === 'attach') {
        const path = requireString(input, 'path', 'workbench_assets attach')
        const kind = input.kind === 'image' || input.kind === 'video'
          ? input.kind
          : /\.(png|jpe?g|webp|gif)$/i.test(path) ? 'image' as const : 'video' as const
        const attached = await store.attachAsset({
          projectId, path, kind,
          ...typeof input.prompt === 'string' && input.prompt !== '' ? { prompt: input.prompt } : {},
        })
        return json({ asset: { id: attached.asset.id, kind: attached.asset.kind, path: attached.asset.path }, created: attached.created })
      }
      return unknownAction('workbench_assets', action, ['list', 'attach'])
    },
  })

  const timeline = defineTool({
    name: 'workbench_timeline',
    description:
      '时间轴（成片）：list、add-clip（加素材/字幕）、trim（改片段起止/时长/源偏移）、drop-clip（把片段移出时间轴）、'
      + 'set-format（导出分辨率/帧率/码率）、set-track（轨道音量/静音）、'
      + 'export（起一次导出，返回 renderId，用 workbench_tasks 轮询进度）。'
      + `一次最多加 ${MAX_TOOL_CLIPS} 个片段。视频轨片段带 startMs/durationMs（毫秒）；没有 startMs 时自动接在末尾。`,
    // 工具结果就是给模型看的 JSON 文本；声明成 string 才能让 defineTool
    // 正确推断出参类型（缺省会被推成 never）
    output: {
      schema: { type: 'string', description: 'JSON 文本结果' },
      // 结果是给模型读的 JSON 文本，直接变成一条文本内容块
      render: (_args, value): ContentBlock[] => [{ type: 'text', text: value }],
    },
    parameters: {
      action: { type: 'string', required: true, description: 'list / add-clip / export' },
      projectId: { type: 'string', required: true, description: '项目 id' },
      timelineId: { type: 'string', description: 'add-clip / export 时的时间轴 id（list 里拿）' },
      track: { type: 'string', description: "add-clip 时的轨道：video / audio / subtitle（默认 video）" },
      clips: {
        type: 'array',
        description: `add-clip 时的片段数组（≤${MAX_TOOL_CLIPS}）：每项 {assetPath|text, startMs?, durationMs?}`,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            assetPath: { type: 'string', description: '已登记的素材路径（workbench_assets list 里拿）' },
            text: { type: 'string', description: '字幕轨的文本' },
            startMs: { type: 'integer', description: '起点（毫秒），省略则接在末尾' },
            durationMs: { type: 'integer', description: '时长（毫秒），默认 3000' },
          },
        },
      },
      limit: { type: 'integer', description: `list 最多返回多少行（默认 ${MAX_TOOL_ROWS}）` },
    },
    async execute(args) {
      const input = asRecord(args)
      const action = requireString(input, 'action', 'workbench_timeline')
      const projectId = requireString(input, 'projectId', 'workbench_timeline')
      if (action === 'list') {
        const rows = (await store.listTimelines(projectId)).slice(0, optionalLimit(input))
        return json({
          timelines: rows.map(item => ({
            id: item.id, name: item.name, frameRate: item.frameRate, burnSubtitles: item.burnSubtitles,
            totalMs: item.tracks.reduce((longest, track) => track.clips.reduce((inner, clip) => Math.max(inner, clip.startMs + clip.durationMs), longest), 0),
            tracks: item.tracks.map(track => ({ kind: track.kind, clips: track.clips.length })),
          })),
          count: rows.length,
        })
      }
      if (action === 'add-clip') {
        const timelineId = requireString(input, 'timelineId', 'workbench_timeline add-clip')
        const current = await store.findTimeline(timelineId)
        if (current === undefined) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list 看清楚有哪些`)
        const rawClips = Array.isArray(input.clips) ? input.clips : []
        if (rawClips.length === 0) throw new Error('add-clip 需要 clips 数组，且至少一个片段')
        if (rawClips.length > MAX_TOOL_CLIPS) throw new Error(`一次最多加 ${MAX_TOOL_CLIPS} 个片段，收到 ${rawClips.length} 个`)
        const trackKind = input.track === 'audio' || input.track === 'subtitle' ? input.track : 'video'
        const knownAssets = new Set((await store.listAssets(projectId)).map(asset => asset.path))
        const tracks = current.tracks.map(track => ({ ...track, clips: [...track.clips] }))
        const target = tracks.find(track => track.kind === trackKind)
        if (target === undefined) throw new Error(`时间轴 ${timelineId} 没有 ${trackKind} 轨`)
        for (const [index, raw] of rawClips.entries()) {
          const clip = asRecord(raw)
          const end = target.clips.reduce((longest, item) => Math.max(longest, item.startMs + item.durationMs), 0)
          const startMs = typeof clip.startMs === 'number' && Number.isFinite(clip.startMs) ? Math.round(clip.startMs) : end
          const durationMs = typeof clip.durationMs === 'number' && Number.isFinite(clip.durationMs) ? Math.round(clip.durationMs) : 3000
          // 片段 id 必须真唯一：早先 `clip-${毫秒}-${下标}` 在同一毫秒内会撞 id（不同轨道下标都是 0）
          const id = newWorkbenchId('clip')
          if (trackKind === 'subtitle') {
            const text = typeof clip.text === 'string' ? clip.text : ''
            if (text.trim() === '') throw new Error(`第 ${index + 1} 个字幕片段缺 text`)
            target.clips.push({ id, text, startMs, durationMs })
            continue
          }
          const assetPath = typeof clip.assetPath === 'string' ? clip.assetPath : ''
          if (assetPath.trim() === '') throw new Error(`第 ${index + 1} 个片段缺 assetPath`)
          if (!knownAssets.has(assetPath)) {
            throw new Error(`素材 ${assetPath} 不在项目 ${projectId} 的素材里；先用 workbench_assets attach 登记它，别猜路径`)
          }
          target.clips.push({ id, assetPath, startMs, durationMs })
        }
        const saved = await store.saveTimeline({
          id: current.id, projectId: current.projectId, name: current.name,
          tracks, frameRate: current.frameRate, burnSubtitles: current.burnSubtitles,
        })
        return json({ timeline: { id: saved.id, tracks: saved.tracks.map(track => ({ kind: track.kind, clips: track.clips.length })) } })
      }
      if (action === 'trim') {
        const timelineId = requireString(input, 'timelineId', 'workbench_timeline trim')
        const current = await store.findTimeline(timelineId)
        if (current === undefined) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list`)
        const trims = Array.isArray(input.trims) ? input.trims : []
        if (trims.length === 0) throw new Error('trim 需要 trims 数组，且至少一项')
        if (trims.length > MAX_TOOL_CLIPS) throw new Error(`一次最多改 ${MAX_TOOL_CLIPS} 个片段`)
        const byId = new Map(trims.map(raw => {
          const trim = asRecord(raw)
          return [requireString(trim, 'clipId', 'workbench_timeline trim'), trim] as const
        }))
        let touched = 0
        const tracks = current.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => {
            const trim = byId.get(clip.id)
            if (trim === undefined) return clip
            touched += 1
            return {
              ...clip,
              ...typeof trim.startMs === 'number' ? { startMs: Math.max(0, Math.round(trim.startMs)) } : {},
              ...typeof trim.durationMs === 'number' ? { durationMs: Math.max(1, Math.round(trim.durationMs)) } : {},
              ...typeof trim.inMs === 'number' ? { inMs: Math.max(0, Math.round(trim.inMs)) } : {},
            }
          }),
        }))
        if (touched !== byId.size) throw new Error(`有 ${byId.size - touched} 个 clipId 不存在；先 action=list 确认`)
        const saved = await store.saveTimeline({
          id: current.id, projectId: current.projectId, name: current.name,
          tracks, frameRate: current.frameRate, burnSubtitles: current.burnSubtitles,
          exportFormat: current.exportFormat,
        })
        return json({ timeline: { id: saved.id, trimmed: touched, tracks: saved.tracks.map(track => ({ kind: track.kind, clips: track.clips.length })) } })
      }
      if (action === 'drop-clip') {
        const timelineId = requireString(input, 'timelineId', 'workbench_timeline drop-clip')
        const current = await store.findTimeline(timelineId)
        if (current === undefined) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list`)
        const clipIds = (Array.isArray(input.clipIds) ? input.clipIds : []).filter((id): id is string => typeof id === 'string')
        if (clipIds.length === 0) throw new Error('drop-clip 需要 clipIds 数组')
        if (clipIds.length > MAX_TOOL_CLIPS) throw new Error(`一次最多移出 ${MAX_TOOL_CLIPS} 个片段`)
        const drop = new Set(clipIds)
        let removed = 0
        const tracks = current.tracks.map(track => ({
          ...track,
          clips: track.clips.filter(clip => {
            const hit = drop.has(clip.id)
            if (hit) removed += 1
            return !hit
          }),
        }))
        const saved = await store.saveTimeline({
          id: current.id, projectId: current.projectId, name: current.name, tracks,
          frameRate: current.frameRate, burnSubtitles: current.burnSubtitles, exportFormat: current.exportFormat,
        })
        return json({ timeline: { id: saved.id, dropped: removed } })
      }
      if (action === 'set-format') {
        const timelineId = requireString(input, 'timelineId', 'workbench_timeline set-format')
        const current = await store.findTimeline(timelineId)
        if (current === undefined) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list`)
        const saved = await store.saveTimeline({
          id: current.id, projectId: current.projectId, name: current.name, tracks: current.tracks,
          frameRate: current.frameRate, burnSubtitles: current.burnSubtitles,
          exportFormat: {
            ...current.exportFormat ?? {},
            ...typeof input.width === 'number' ? { width: input.width } : {},
            ...typeof input.height === 'number' ? { height: input.height } : {},
            ...typeof input.frameRate === 'number' ? { frameRate: input.frameRate } : {},
            ...typeof input.bitrateKbps === 'number' ? { bitrateKbps: input.bitrateKbps } : {},
          },
        })
        return json({ timeline: { id: saved.id, exportFormat: saved.exportFormat } })
      }
      if (action === 'set-track') {
        const timelineId = requireString(input, 'timelineId', 'workbench_timeline set-track')
        const current = await store.findTimeline(timelineId)
        if (current === undefined) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list`)
        const kind = input.track === 'video' || input.track === 'subtitle' ? input.track : 'audio'
        const tracks = current.tracks.map(track => track.kind !== kind ? track : {
          ...track,
          ...typeof input.volume === 'number' ? { volume: input.volume } : {},
          ...typeof input.muted === 'boolean' ? { muted: input.muted } : {},
        })
        const saved = await store.saveTimeline({
          id: current.id, projectId: current.projectId, name: current.name, tracks,
          frameRate: current.frameRate, burnSubtitles: current.burnSubtitles, exportFormat: current.exportFormat,
        })
        return json({ timeline: { id: saved.id, tracks: saved.tracks.map(track => ({ kind: track.kind, volume: track.volume ?? null, muted: track.muted ?? false })) } })
      }
      if (action === 'export') {
        const timelineId = requireString(input, 'timelineId', 'workbench_timeline export')
        const doc = await store.findTimeline(timelineId)
        if (doc === undefined) throw new Error(`找不到时间轴 ${timelineId}；先用 action=list`)
        const job = renders.start(doc)
        return json({ render: { id: job.id, status: job.status, hint: '用 workbench_tasks action=renders 轮询进度；status=succeeded 时 outputPath 是产物' } })
      }
      return unknownAction('workbench_timeline', action, ['list', 'add-clip', 'trim', 'drop-clip', 'set-format', 'set-track', 'export'])
    },
  })

  const workflow = defineTool({
    name: 'workbench_workflow',
    description:
      '专业工作流（画布图）：list（列项目的流程）、save（创建/覆盖一张图；节点 kind 必须来自节点目录）、'
      + 'run（跑起来，返回 runId；默认**复用同参数上次的成功产物**，refresh=true 才强制重新生成）、'
      + 'runs（查运行记录与每个节点的状态/产物）。'
      + '跑之前宿主会用与画布同一份校验拒绝非法图（必填/端口/环），所以先 save 再 run。',
    // 工具结果就是给模型看的 JSON 文本；声明成 string 才能让 defineTool
    // 正确推断出参类型（缺省会被推成 never）
    output: {
      schema: { type: 'string', description: 'JSON 文本结果' },
      // 结果是给模型读的 JSON 文本，直接变成一条文本内容块
      render: (_args, value): ContentBlock[] => [{ type: 'text', text: value }],
    },
    parameters: {
      action: { type: 'string', required: true, description: 'list / save / run / runs' },
      projectId: { type: 'string', required: true, description: '项目 id' },
      workflowId: { type: 'string', description: 'save 覆盖时 / run 时的流程 id' },
      name: { type: 'string', description: 'save 时的流程名' },
      nodes: {
        type: 'array',
        description: 'save 时的节点数组：{id, kind, params?, position?}',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', description: '节点 id（图内唯一）' },
            kind: { type: 'string', description: '节点种类，如 image-generate / video-generate / script' },
            params: { type: 'object', description: '节点参数（按种类）', additionalProperties: true },
            position: { type: 'object', description: '画布坐标 {x,y}', additionalProperties: true },
          },
        },
      },
      edges: {
        type: 'array',
        description: 'save 时的连线数组：{id?, source, target}',
        items: { type: 'object', description: '连线', additionalProperties: true },
      },
      limit: { type: 'integer', description: `list / runs 最多返回多少行（默认 ${MAX_TOOL_ROWS}）` },
      refresh: { type: 'boolean', description: 'run 时是否跳过成功结果缓存、强制重新生成（默认复用缓存，省钱）' },
    },
    async execute(args) {
      const input = asRecord(args)
      const action = requireString(input, 'action', 'workbench_workflow')
      const projectId = requireString(input, 'projectId', 'workbench_workflow')
      if (action === 'list') {
        const rows = (await store.listWorkflows(projectId)).slice(0, optionalLimit(input))
        return json({ workflows: rows.map(item => ({ id: item.id, name: item.name, nodes: item.nodes.length, edges: item.edges.length, updatedAt: item.updatedAt })), count: rows.length })
      }
      if (action === 'save') {
        // 画布坐标是"界面细节"，模型不该为此编数字：缺 position 时按加入顺序自动排布
        const rawNodes = Array.isArray(input.nodes) ? input.nodes : []
        const nodes = rawNodes.map((raw, index) => {
          const node = asRecord(raw)
          const position = asRecord(node.position)
          const finite = typeof position.x === 'number' && Number.isFinite(position.x)
            && typeof position.y === 'number' && Number.isFinite(position.y)
          return {
            ...node,
            position: finite ? { x: position.x, y: position.y } : { x: 40 + (index % 3) * 240, y: 40 + Math.floor(index / 3) * 140 },
          }
        })
        const saved = await store.saveWorkflow({
          ...typeof input.workflowId === 'string' && input.workflowId !== '' ? { id: input.workflowId } : {},
          projectId,
          name: typeof input.name === 'string' && input.name !== '' ? input.name : '对话创建的流程',
          nodes,
          edges: Array.isArray(input.edges) ? input.edges : [],
        })
        return json({ workflow: { id: saved.id, name: saved.name, nodes: saved.nodes.length, edges: saved.edges.length } })
      }
      if (action === 'run') {
        const workflowId = requireString(input, 'workflowId', 'workbench_workflow run')
        const doc = await store.findWorkflow(workflowId)
        if (doc === undefined) throw new Error(`找不到流程 ${workflowId}；先用 action=list`)
        const run = await runner.begin(doc, input.refresh === true ? { bypassCache: true } : {})
        return json({ run: { id: run.id, status: run.status, ...run.error === undefined ? {} : { error: run.error } } })
      }
      if (action === 'runs') {
        const rows = (await store.listRuns(projectId, typeof input.workflowId === 'string' && input.workflowId !== '' ? input.workflowId : undefined))
          .slice(0, optionalLimit(input))
        return json({
          runs: rows.map(run => ({
            id: run.id, workflowId: run.workflowId, status: run.status, startedAt: run.startedAt,
            nodes: run.nodeRuns.map(node => ({ id: node.nodeId, status: node.status, ...node.outputPath === undefined ? {} : { outputPath: node.outputPath }, ...node.attempts === undefined ? {} : { attempts: node.attempts } })),
          })),
          count: rows.length,
        })
      }
      return unknownAction('workbench_workflow', action, ['list', 'save', 'run', 'runs'])
    },
  })

  // 这个 schema（只 action 必填）会让 defineTool 的泛型把结果类型收敛成 never，
  // 运行时行为不受影响；出参形状由上面 4 个工具共用，注册处只看共同形状。
  const tasks = defineTool({
    name: 'workbench_tasks',
    description:
      '任务与运行记录：list（生成任务账本：模型/提示词/状态/产物/耗时）、renders（导出任务与进度）、cancel（按 id 取消生成任务或导出）。'
      + '取消是不可逆动作，只有在用户明确要求时才调用。',
    // 工具结果就是给模型看的 JSON 文本；声明成 string 才能让 defineTool
    // 正确推断出参类型（缺省会被推成 never）
    output: {
      schema: { type: 'string', description: 'JSON 文本结果' },
      // 结果是给模型读的 JSON 文本，直接变成一条文本内容块
      render: (_args, value): ContentBlock[] => [{ type: 'text', text: value }],
    },
    parameters: {
      action: { type: 'string', required: true, description: 'list / renders / cancel' },
      projectId: { type: 'string', description: 'list 时按项目过滤（可选）' },
      taskId: { type: 'string', description: 'cancel 时的生成任务 id' },
      renderId: { type: 'string', description: 'cancel 时的导出任务 id' },
      limit: { type: 'integer', description: `list / renders 最多返回多少行（默认 ${MAX_TOOL_ROWS}）` },
    },
    async execute(args) {
      const input = asRecord(args)
      const action = requireString(input, 'action', 'workbench_tasks')
      if (action === 'list') {
        const projectId = typeof input.projectId === 'string' && input.projectId !== '' ? input.projectId : undefined
        const rows = await store.listTasks(optionalLimit(input), projectId)
        return json({
          tasks: rows.map(task => ({
            id: task.id, kind: task.kind, status: task.status, model: task.model, provider: task.provider,
            ...task.outputPath === undefined ? {} : { outputPath: task.outputPath }, createdAt: task.createdAt,
          })),
          count: rows.length,
        })
      }
      if (action === 'renders') {
        const projectId = typeof input.projectId === 'string' && input.projectId !== '' ? input.projectId : undefined
        const rows = renders.list(projectId).slice(0, optionalLimit(input))
        return json({ renders: rows.map(job => ({ id: job.id, timelineId: job.timelineId, status: job.status, percent: job.percent, ...job.outputPath === undefined ? {} : { outputPath: job.outputPath } })), count: rows.length })
      }
      if (action === 'render-cancel') {
        const renderId = requireString(input, 'renderId', 'workbench_tasks render-cancel')
        const cancelled = renders.cancel(renderId)
        const job = renders.list().find(candidate => candidate.id === renderId)
        return json({
          cancelled,
          status: job?.status ?? null,
          hint: cancelled ? '已请求取消（排队中的会直接摘掉，在跑的会杀掉 ffmpeg 并清理半成品）' : '没有找到在跑的导出任务（可能已结束）',
        })
      }
      if (action === 'cancel') {
        const taskId = typeof input.taskId === 'string' && input.taskId !== '' ? input.taskId : undefined
        const renderId = typeof input.renderId === 'string' && input.renderId !== '' ? input.renderId : undefined
        if (taskId === undefined && renderId === undefined) throw new Error('cancel 需要 taskId 或 renderId')
        const cancelledTask = taskId === undefined ? false : deps.registry.cancel(taskId)
        const cancelledRender = renderId === undefined ? false : renders.cancel(renderId)
        return json({ cancelledTask, cancelledRender, hint: cancelledTask || cancelledRender ? undefined : '没有找到在跑的任务（可能已经结束）' })
      }
      return unknownAction('workbench_tasks', action, ['list', 'renders', 'cancel', 'render-cancel'])
    },
  })

  // 五个工具的参数 schema 各不相同，这里用一次显式断言收敛成共同形状（注册处只看共同形状）
  const tools = [projects, assets, timeline, workflow, tasks]
  return tools as unknown as Array<ReturnType<typeof defineTool>>
}
