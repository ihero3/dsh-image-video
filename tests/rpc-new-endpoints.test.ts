/**
 * 新端点级覆盖（Track A / A136）。
 *
 * `src/host/rpc.ts` 此前大量新端点的 inline handler 没有端点级测试（纯函数测了、路由没测）。
 * 这里补上：assets/usage、assets/size-report、assets/project-stats、maintenance/integrity、
 * maintenance/archive、renders/overview、diagnostics、subtitles/export|import、timelines/estimate|preflight。
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createWorkbenchHandler } from '../src/host/rpc.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { GenerationRegistry } from '../src/workbench/cancel.ts'
import { WorkflowRunner } from '../src/workbench/runner.ts'
import { RenderRegistry } from '../src/media/render-registry.ts'
import { RenderService } from '../src/media/render.ts'

async function harness(options: { llm?: unknown } = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'dsh-cov-rpc-'))
  const outputsDir = await mkdtemp(join(tmpdir(), 'dsh-cov-out-'))
  await writeFile(join(outputsDir, 'clip.mp4'), 'mp4')
  const store = new WorkbenchStore({ directory: dataDir, now: () => new Date('2026-10-20T00:00:00.000Z') })
  const registry = new GenerationRegistry()
  let runSequence = 0
  const runner = new WorkflowRunner({
    store,
    newRunId: () => `run-${++runSequence}`,
    generateImage: { async execute() { return { localPath: join(outputsDir, 'shot.png'), bytes: 10 } } },
    generateVideo: { async execute() { return { videoPath: join(outputsDir, 'clip.mp4'), bytes: 20 } } },
  })
  const renders = new RenderRegistry({
    render: new RenderService({ outputsDir }),
    registerAsset: async job => {
      if (job.outputPath === undefined) return
      await store.attachAsset({ projectId: job.projectId, path: job.outputPath, kind: 'video', bytes: job.bytes })
    },
  })
  const handler = createWorkbenchHandler({
    provider: 'threevideo', outputsDir, store, registry, runner, renders,
    ...options.llm === undefined ? {} : { llm: options.llm as never },
    defaults: () => ({
      mediaMode: 'image', imageProvider: 'threevideo', imageSize: '1024*1024', imageStyle: null,
      videoProvider: 'threevideo', videoAspectRatio: '16:9', videoDuration: 5,
    }),
  })
  async function ok<T>(endpoint: string, payload?: unknown): Promise<T> {
    const result = await handler(endpoint, payload, new AbortController().signal, {} as never)
    if (!result.ok) throw new Error(`refused: ${result.error.code} ${result.error.message}`)
    return result.value as T
  }
  const project = await store.createProject('覆盖测试')
  return { handler, ok, store, outputsDir, project }
}

describe('new endpoint coverage (A136)', () => {
  it('serves diagnostics, archive, overview and project stats', async () => {
    const { ok, store } = await harness()
    const diagnostics = await ok<{ logFiles: unknown[] }>('diagnostics', {})
    expect(Array.isArray(diagnostics.logFiles)).toBe(true)

    const archive = await ok<{ dryRun: boolean; archivedTasks: number }>('maintenance/archive', {})
    expect(archive.dryRun).toBe(true)

    const overview = await ok<{ overview: { running: { count: number }; recentItems: unknown[] } }>('renders/overview', {})
    expect(overview.overview.running.count).toBe(0)
    expect(overview.overview.recentItems).toEqual([])

    const integrity = await ok<{ integrity: { healthy: boolean } }>('maintenance/integrity', {})
    expect(integrity.integrity.healthy).toBe(true)
    void store
  })

  it('serves asset usage, size report and project stats', async () => {
    const { ok, store, project } = await harness()
    await store.attachAsset({ projectId: project.id, path: 'outputs/clip.mp4', kind: 'video', bytes: 100 })
    const usage = await ok<{ summary: { total: number; unused: number } }>('assets/usage', {})
    expect(usage.summary.total).toBe(1)
    expect(usage.summary.unused).toBe(1)

    const size = await ok<{ size: { count: number; top: unknown[] } }>('assets/size-report', { topN: 5 })
    expect(size.size.count).toBe(1)

    const stats = await ok<{ stats: { projects: Array<{ projectId: string; bytes: number }> } }>('assets/project-stats', {})
    expect(stats.stats.projects.some(row => row.projectId === project.id && row.bytes === 100)).toBe(true)
  })

  it('serves subtitle export/import and timeline estimate/preflight', async () => {
    const { ok, store, project } = await harness()
    const saved = await store.saveTimeline({
      projectId: project.id,
      tracks: [
        { id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: 'outputs/clip.mp4', startMs: 0, durationMs: 2000 }] },
        { id: 's1', kind: 'subtitle', clips: [{ id: 's1c', text: '你好', startMs: 0, durationMs: 800 }] },
      ],
    })
    const exported = await ok<{ text: string; cues: number }>('subtitles/export', { timelineId: saved.id })
    expect(exported.cues).toBe(1)
    expect(exported.text).toContain('00:00:00,000 --> 00:00:00,800')

    const imported = await ok<{ imported: number }>('subtitles/import', {
      timelineId: saved.id,
      srt: '1\n00:00:01,000 --> 00:00:02,000\n导入一句\n',
    })
    expect(imported.imported).toBe(1)

    const estimate = await ok<{ estimate: { durationMs: number; estimatedBytes: number } }>('timelines/estimate', { timelineId: saved.id })
    expect(estimate.estimate.durationMs).toBeGreaterThan(0)
    expect(estimate.estimate.estimatedBytes).toBeGreaterThan(0)

    const preflight = await ok<{ summaryLine: string; ok: boolean }>('timelines/preflight', { timelineId: saved.id })
    expect(preflight.summaryLine.length).toBeGreaterThan(0)
  })

  it('generates episodes → segments → shots in one call (rules fallback)', async () => {
    const { ok, store, project } = await harness()
    const result = await ok<{
      episodes: Array<{ id: string; no: number; script: { text: string }; segments: Array<{ id: string; order: number; storyboardId?: string }>; storyboards: Array<{ shots: Array<{ order: number }> }> }>
    }>('episodes/generate', {
      projectId: project.id,
      script: '第一场 雨夜。第二场 天台。第三场 地铁。第四场 片场。',
      episodes: 2,
      segments: 2,
      shots: 2,
      shotDurationSec: 4,
    })
    // 集号默认从 0 起，段 / 镜顺序恒为 1..n
    expect(result.episodes.map(episode => episode.no)).toEqual([0, 1])
    expect(result.episodes.every(episode => episode.script.text !== '')).toBe(true)
    expect(result.episodes.every(episode => episode.segments.length === 2)).toBe(true)
    expect(result.episodes.every(episode => episode.segments.map(segment => segment.order).join(',') === '1,2')).toBe(true)
    expect(result.episodes.every(episode => episode.storyboards.length === 2)).toBe(true)
    // 规则分镜不注水：句子不够时以句子数为准，但顺序号恒为 1..n
    expect(result.episodes.every(episode => episode.storyboards.every(storyboard => (
      storyboard.shots.length > 0
      && storyboard.shots.every((shot, index) => shot.order === index + 1)
    )))).toBe(true)
    expect((await store.listEpisodes(project.id)).map(episode => episode.no)).toEqual([0, 1])
  })

  it('fills the target episode first, then creates siblings', async () => {
    const { ok, store, project } = await harness()
    const target = await store.createEpisode(project.id, {})
    const result = await ok<{ episodes: Array<{ id: string; no: number; segments: unknown[] }> }>('episodes/generate', {
      projectId: project.id,
      episodeId: target.id,
      script: '第一场。第二场。',
      episodes: 2,
      segments: 1,
      shots: 1,
    })
    expect(result.episodes.map(episode => episode.no)).toEqual([0, 1])
    expect(result.episodes[0]!.id).toBe(target.id)
    expect(result.episodes[0]!.segments).toHaveLength(1)
  })

  it('refuses generation without a script or an idea', async () => {
    const { handler, project } = await harness()
    const result = await handler('episodes/generate', { projectId: project.id }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('请先写剧本')
  })

  it('refuses a brief-only request when no text model is available', async () => {
    const { handler, project } = await harness()
    const result = await handler('episodes/generate', { projectId: project.id, brief: '雨夜追逐' }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('请选择文本模型')
  })

  it('lets the text model write the script and the whole hierarchy', async () => {
    const raw = JSON.stringify({
      episodes: [{
        title: '雨夜',
        script: '第一集正文',
        segments: [
          { promptText: '街口', shots: [{ shot: '撑伞', imagePrompt: '雨夜街口', videoPrompt: '撑伞走来' }] },
          { promptText: '天台', shots: [{ shot: '抬头', imagePrompt: '天台风', videoPrompt: '抬头' }] },
        ],
      }],
    })
    let calls = 0
    const llm = {
      prepareCall: async () => ({
        config: {},
        stream: async function* () {
          calls += 1
          yield { type: 'block-start', index: 0, blockType: 'text' }
          yield { type: 'text-delta', index: 0, text: raw }
          yield { type: 'block-end', index: 0, block: { type: 'text', text: raw } }
          yield { type: 'finish', reason: 'stop' }
        },
      }),
    }
    const { ok, project } = await harness({ llm })
    const result = await ok<{
      episodes: Array<{ title: string; script: { text: string }; segments: unknown[]; storyboards: Array<{ shots: Array<{ order: number }> }> }>
    }>('episodes/generate', {
      projectId: project.id,
      brief: '雨夜追逐',
      provider: 'deepseek',
      model: 'deepseek-chat',
      episodes: 1,
      segments: 2,
      shots: 1,
    })
    expect(calls).toBe(1)
    expect(result.episodes).toHaveLength(1)
    expect(result.episodes[0]!.title).toBe('雨夜')
    expect(result.episodes[0]!.script.text).toBe('第一集正文')
    expect(result.episodes[0]!.segments).toHaveLength(2)
    expect(result.episodes[0]!.storyboards).toHaveLength(2)
  })

  it('falls back to rules when the text model fails but a script exists', async () => {
    const llm = {
      prepareCall: async () => ({
        config: {},
        stream: async function* () {
          throw new Error('模型不可用')
        },
      }),
    }
    const { ok, project } = await harness({ llm })
    const result = await ok<{ episodes: Array<{ segments: unknown[] }> }>('episodes/generate', {
      projectId: project.id,
      script: '第一场。第二场。',
      provider: 'deepseek',
      model: 'deepseek-chat',
      episodes: 1,
      segments: 1,
      shots: 1,
    })
    expect(result.episodes).toHaveLength(1)
    expect(result.episodes[0]!.segments).toHaveLength(1)
  })

  it('inherits image / video / skill defaults and matches project resources', async () => {
    const { ok, store, project } = await harness()
    // 资源带备注：规则拆分把角色 / 场景提示带进分镜；无备注的资源同样可用
    await store.createResource({ projectId: project.id, kind: 'role', name: '林夏', note: '红围巾' })
    await store.createResource({ projectId: project.id, kind: 'scene', name: '天台' })
    const result = await ok<{ episodes: Array<{ segments: Array<{ promptText: string; imageModel?: string; videoModel?: string; skillId?: string }> }> }>(
      'episodes/generate',
      {
        projectId: project.id,
        script: '林夏走在雨里。她抬头看霓虹。',
        episodes: 1,
        segments: 1,
        shots: 1,
        imageModel: 'img-model',
        videoModel: 'video-model',
        skillId: 'skill-1',
      },
    )
    const segment = result.episodes[0]!.segments[0]!
    expect(segment.imageModel).toBe('img-model')
    expect(segment.videoModel).toBe('video-model')
    expect(segment.skillId).toBe('skill-1')
    expect(segment.promptText).toContain('林夏')
    // 空串表示"不指定"，不落成空字段
    const bare = await ok<{ episodes: Array<{ segments: Array<{ imageModel?: string }> }> }>('episodes/generate', {
      projectId: project.id, script: '一句。', episodes: 1, segments: 1, shots: 1, imageModel: '',
    })
    expect(bare.episodes[0]!.segments[0]!.imageModel).toBeUndefined()
  })

  it('reports a missing project id after drafting by rules', async () => {
    const { handler } = await harness()
    // 不传取消信号同样可用（signal 可选）
    const result = await handler('episodes/generate', { script: '一句。' }, undefined as never, {} as never)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/projectId|项目|缺少/)
  })

  it('writes the model draft into the target episode and keeps zero-shot segments', async () => {
    const raw = JSON.stringify({
      episodes: [{
        title: '天台',
        script: '目标集正文',
        segments: [
          { promptText: '空段', shots: [] },
          { promptText: '有镜', shots: [{ imagePrompt: '天台', videoPrompt: '抬头' }] },
        ],
      }],
    })
    const llm = {
      prepareCall: async () => ({
        config: {},
        stream: async function* () {
          yield { type: 'text-delta', index: 0, text: raw }
          yield { type: 'block-end', index: 0, block: { type: 'text', text: raw } }
        },
      }),
    }
    const { ok, store, project } = await harness({ llm })
    const target = await store.createEpisode(project.id, {})
    const result = await ok<{
      episodes: Array<{ id: string; title: string; script: { text: string }; segments: unknown[]; storyboards: Array<{ shots: unknown[] }> }>
    }>('episodes/generate', {
      projectId: project.id,
      episodeId: target.id,
      script: '旧正文',
      provider: 'deepseek',
      model: 'deepseek-chat',
      episodes: 1,
      segments: 2,
      shots: 1,
    })
    expect(result.episodes[0]!.id).toBe(target.id)
    expect(result.episodes[0]!.title).toBe('天台')
    expect(result.episodes[0]!.script.text).toBe('目标集正文')
    expect(result.episodes[0]!.segments).toHaveLength(2)
    // 零镜分段不建分镜记录
    expect(result.episodes[0]!.storyboards).toHaveLength(1)
  })

  it('rethrows model failures when there is no script to fall back to', async () => {
    const llm = {
      prepareCall: async () => ({
        config: {},
        stream: async function* () {
          throw new Error('模型挂了')
        },
      }),
    }
    const { handler, project } = await harness({ llm })
    const result = await handler(
      'episodes/generate',
      { projectId: project.id, brief: '雨夜追逐', provider: 'deepseek', model: 'deepseek-chat' },
      new AbortController().signal,
      {} as never,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('模型挂了')
  })

  it('bulk-registers outputs and imports external files (A152)', async () => {
    const { ok, outputsDir, project } = await harness()

    // 批量登记（一次调用多条的路径）
    const bulk = await ok<{ created: number; assets: Array<{ path: string }> }>('assets/attach-many', {
      projectId: project.id,
      items: [{ path: join(outputsDir, 'clip.mp4'), kind: 'video', bytes: 3 }],
    })
    expect(bulk.created).toBe(1)
    expect(bulk.assets[0]?.path).toBe(join(outputsDir, 'clip.mp4'))

    // 外部文件导入：复制进 outputs 才能走 /outputs 预览
    const sourceDir = await mkdtemp(join(tmpdir(), 'dsh-import-'))
    const source = join(sourceDir, 'outside.png')
    await writeFile(source, 'png-bytes')
    await writeFile(join(sourceDir, 'notes.txt'), 'text') // 存在但扩展名不支持 → 应被跳过并说明原因
    const imported = await ok<{ imported: number; assets: Array<{ path: string }>; skipped: Array<{ path: string; reason: string }> }>(
      'media/import',
      { projectId: project.id, paths: [source, join(sourceDir, 'missing.png'), join(sourceDir, 'notes.txt')] },
    )
    expect(imported.imported).toBe(1)
    expect(imported.assets[0]?.path.startsWith(outputsDir)).toBe(true)
    expect(imported.skipped.length).toBe(2)
    expect(imported.skipped.some(entry => entry.reason.includes('不支持的扩展名'))).toBe(true)
  })

  it('keeps a reference image on resources (A153)', async () => {
    const { ok, project } = await harness()
    const created = await ok<{ resource: { id: string; assetPath?: string } }>('resources/create', {
      projectId: project.id, kind: 'role', name: '小雨', assetPath: '/tmp/outputs/ref.png',
    })
    expect(created.resource.assetPath).toBe('/tmp/outputs/ref.png')

    // 只改名字/备注时，参考图要保留
    const renamed = await ok<{ resource: { name: string; assetPath?: string } }>('resources/update', {
      id: created.resource.id, name: '小雨（红衣）', note: '女主角',
    })
    expect(renamed.resource.name).toBe('小雨（红衣）')
    expect(renamed.resource.assetPath).toBe('/tmp/outputs/ref.png')

    // 显式 null 才清除
    const cleared = await ok<{ resource: { assetPath?: string } }>('resources/update', {
      id: created.resource.id, assetPath: null,
    })
    expect(cleared.resource.assetPath).toBeUndefined()
  })

  it('removes assets in bulk (A-2)', async () => {
    const { ok, project, outputsDir } = await harness()
    const attached = await ok<{ asset: { id: string } }>('assets/attach', { projectId: project.id, path: join(outputsDir, 'clip.mp4'), kind: 'video' })
    const bulk = await ok<{ removed: number; skipped: Array<{ id: string }> }>('assets/remove-many', { ids: [attached.asset.id, 'ast-missing'], force: true })
    expect(bulk.removed).toBe(1)
    expect(bulk.skipped.length).toBe(1)
  })

  it('stores multiple reference images on a resource (A-3)', async () => {
    const { ok, project } = await harness()
    const created = await ok<{ resource: { id: string; assetPaths?: string[] } }>('resources/create', {
      projectId: project.id, kind: 'role', name: '小雨', assetPaths: ['/o/a.png', '/o/b.png'],
    })
    expect(created.resource.assetPaths).toEqual(['/o/a.png', '/o/b.png'])
    const cleared = await ok<{ resource: { assetPaths?: string[] } }>('resources/update', { id: created.resource.id, assetPaths: null })
    expect(cleared.resource.assetPaths).toBeUndefined()
  })

  it('splits and copies clips over RPC (A-9)', async () => {
    const { ok, store, project, outputsDir } = await harness()
    const saved = await store.saveTimeline({
      projectId: project.id,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: join(outputsDir, 'clip.mp4'), startMs: 0, durationMs: 2000 }] }],
    })
    const split = await ok<{ timeline: { tracks: Array<{ clips: Array<{ id: string; durationMs: number }> }> }; leftId: string; rightId: string }>(
      'timelines/split-clip', { timelineId: saved.id, clipId: 'c1', atMs: 800 },
    )
    expect(split.timeline.tracks[0]!.clips.length).toBe(2)
    expect(split.leftId).toBe('c1')
    expect(split.rightId).not.toBe('c1')

    const copied = await ok<{ timeline: { tracks: Array<{ clips: unknown[] }> } }>(
      'timelines/copy-clip', { timelineId: saved.id, clipId: split.rightId },
    )
    expect(copied.timeline.tracks[0]!.clips.length).toBe(3)
  })

  it('refuses to compose without a generation adapter instead of faking success (A-4)', async () => {
    const { handler, project } = await harness()
    const result = await handler('media/compose', { projectId: project.id, prompt: '小雨在雨夜街头', resourceIds: [] }, new AbortController().signal)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('生成能力未装配')
    }
  })

  it('saves/lists/removes prompts and refuses extraction without any model (A-5)', async () => {
    const { ok, handler } = await harness()
    const saved = await ok<{ prompt: { id: string; name: string } }>('prompts/save', { name: '雨夜', text: '雨夜霓虹街头，电影感' })
    expect(saved.prompt.name).toBe('雨夜')
    expect((await ok<{ prompts: unknown[] }>('prompts/list')).prompts.length).toBe(1)
    expect((await ok<{ removed: boolean }>('prompts/remove', { id: saved.prompt.id })).removed).toBe(true)

    const refused = await handler('prompts/extract', { path: '/tmp/whatever.png' }, new AbortController().signal, {} as never)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.error.message).toContain('请选择文本模型')

    // 选了模型但宿主没装文本模型服务：同样如实报错，不伪造结果
    const noService = await handler('prompts/extract', {
      path: '/tmp/whatever.png', provider: 'fake', model: 'fake-text',
    }, new AbortController().signal, {} as never)
    expect(noService.ok).toBe(false)
    if (!noService.ok) expect(noService.error.message).toContain('文本模型服务')
  })
})

describe('entities/extract (B-23)', () => {
  it('refuses an empty script or a missing text model', async () => {
    const { handler } = await harness()
    const empty = await handler('entities/extract', { category: 'role', script: '  ' }, new AbortController().signal, {} as never)
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.error.message).toContain('请先把剧本写进当前集')

    const noModel = await handler('entities/extract', { category: 'role', script: '林夏撑伞走来。' }, new AbortController().signal, {} as never)
    expect(noModel.ok).toBe(false)
    if (!noModel.ok) expect(noModel.error.message).toContain('请选择文本模型')
  })

  it('refuses an unknown category instead of silently picking one', async () => {
    const { handler } = await harness()
    const result = await handler('entities/extract', { category: 'brand', script: '林夏撑伞走来。' }, new AbortController().signal, {} as never)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('未知的提取分区')
  })

  it('returns parsed candidates from the text model', async () => {
    const raw = '```json\n[{"name":"林夏","note":"二十岁，红伞"},{"name":"林夏","note":"重复"},{"name":"老周","note":""}]\n```'
    const prompts: string[] = []
    const llm = {
      prepareCall: async () => ({
        config: {},
        stream: async function* (options: { messages: Array<{ content: Array<{ text?: string }> }> }) {
          prompts.push(options.messages[0]?.content[0]?.text ?? '')
          yield { type: 'block-start', index: 0, blockType: 'text' }
          yield { type: 'text-delta', index: 0, text: raw }
          yield { type: 'block-end', index: 0, block: { type: 'text', text: raw } }
          yield { type: 'finish', reason: 'stop' }
        },
      }),
    }
    const { ok } = await harness({ llm })
    const result = await ok<{ items: Array<{ name: string; note: string }> }>('entities/extract', {
      category: 'role',
      script: '雨夜街头，林夏撑伞走来。老周在屋檐下等她。',
      provider: 'deepseek',
      model: 'deepseek-chat',
    })
    expect(result.items).toEqual([
      { name: '林夏', note: '二十岁，红伞' },
      { name: '老周', note: '' },
    ])
    // 提示词带上了分区要求与剧本原文
    expect(prompts[0]).toContain('所有角色')
    expect(prompts[0]).toContain('老周在屋檐下等她')
  })
})
