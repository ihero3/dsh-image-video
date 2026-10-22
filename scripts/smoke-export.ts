/**
 * 零花费导出冒烟（发布验收用）：**不触发任何 LLM 生成**，只走真实导出链路。
 *
 * 做什么：
 * 1. 用本机 ffmpeg 合成一段 3 秒测试视频（`testsrc` 信号源，零成本、可重复）；
 * 2. 建一个真实工作台（临时目录）→ 登记素材 → 写时间轴（视频轨 + 字幕轨）；
 * 3. 用**生产同一套** `RenderService` + `RenderRegistry` 起一次导出，轮询到完成；
 * 4. 断言：成片存在且有字节数、时长接近 3s、封面/字幕随片交付、成片自动登记为素材。
 *
 * 用法：`npx tsx scripts/smoke-export.ts`
 * 退出码：0 = 通过；1 = 失败（打印失败阶段与原因）。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { RenderRegistry, type RenderJob } from '../src/media/render-registry.ts'
import { RenderService } from '../src/media/render.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'

const run = promisify(execFile)
const scratch = await mkdtemp(join(tmpdir(), 'dsh-smoke-export-'))
const fail = (message: string): never => {
  console.error(`\n✗ 冒烟失败：${message}`)
  process.exit(1)
}

try {
  const outputsDir = join(scratch, 'outputs')
  const workbenchDir = join(scratch, 'workbench')
  const sourceDir = join(scratch, 'src')
  await run('mkdir', ['-p', outputsDir, sourceDir])

  // 1) 零成本夹具：3 秒测试视频（无网络、无生成调用）
  const fixture = join(sourceDir, 'smoke-fixture.mp4')
  await run('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30',
    '-t', '3', '-pix_fmt', 'yuv420p', fixture,
  ])
  const fixtureBytes = (await stat(fixture)).size
  console.log(`· 夹具：${fixture}（${fixtureBytes} B，ffmpeg testsrc 合成）`)

  // 2) 真实工作台：项目 → 素材 → 时间轴
  const store = new WorkbenchStore({ directory: workbenchDir })
  const project = await store.createProject('导出冒烟')
  await store.attachAsset({ projectId: project.id, path: fixture, kind: 'video', bytes: fixtureBytes })
  const timeline = await store.saveTimeline({
    projectId: project.id,
    name: '冒烟成片',
    burnSubtitles: true,
    tracks: [
      { id: 'v1', kind: 'video', clips: [{ id: 'c1', assetPath: fixture, startMs: 0, durationMs: 3000 }] },
      { id: 's1', kind: 'subtitle', clips: [{ id: 'c2', startMs: 0, durationMs: 2000, text: 'Smoke test' }] },
    ],
  })
  console.log(`· 时间轴：${timeline.id}（2 轨 / 3000ms）`)

  // 3) 生产同一套导出实现
  const registered: string[] = []
  const registry = new RenderRegistry({
    render: new RenderService({ outputsDir }),
    registerAsset: async job => {
      if (job.outputPath === undefined) return
      registered.push(job.outputPath)
      await store.attachAsset({
        projectId: job.projectId, path: job.outputPath, kind: 'video',
        bytes: job.bytes, prompt: `冒烟导出（${job.timelineId}）`,
      })
    },
  })
  const started = registry.start(timeline)
  console.log(`· 导出已开始：${started.id}`)

  // 4) 轮询到终态（导出是异步队列，最多等 3 分钟）
  const deadline = Date.now() + 180_000
  let job: RenderJob = started
  while (job.status === 'running' && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 500))
    job = registry.get(started.id) ?? job
  }
  if (job.status === 'running') fail(`导出 3 分钟未结束（percent ${job.percent}%）`)
  if (job.status !== 'succeeded') fail(`导出未成功：status=${job.status} code=${job.code ?? '?'} ${job.error ?? ''}`)

  // 5) 断言
  if (job.outputPath === undefined) fail('成功但没有 outputPath')
  const output = await stat(job.outputPath).catch(() => undefined)
  if (output === undefined || output.size === 0) fail(`成片不存在或为空：${job.outputPath}`)
  if (job.durationMs === undefined || Math.abs(job.durationMs - 3000) > 400) {
    fail(`成片时长异常：${job.durationMs}ms（期望 ≈3000ms）`)
  }
  const summary = job.summary
  if (summary === undefined) fail('缺少导出摘要（summary）')

  const cover = summary.thumbnailFile === undefined ? undefined : await stat(summary.thumbnailFile).catch(() => undefined)
  const subtitle = summary.subtitleFile === undefined ? undefined : await stat(summary.subtitleFile).catch(() => undefined)
  if (cover === undefined || cover.size === 0) fail('缺少封面帧（thumbnailFile）')
  if (subtitle === undefined || subtitle.size === 0) fail('缺少随片字幕（subtitleFile）')
  if (registered.length !== 1) fail(`成片应自动登记为 1 条素材，实际 ${registered.length}`)

  const renders = registry.list(project.id)
  if (renders.length !== 1 || renders[0]?.status !== 'succeeded') fail('渲染台账记录不符')

  console.log(`
✓ 零花费导出冒烟通过
  render id      : ${job.id}
  成片           : ${job.outputPath}（${output.size} B / ${job.durationMs} ms）
  封面帧         : ${summary.thumbnailFile}
  随片字幕       : ${summary.subtitleFile}
  自动登记素材   : ${registered[0]}
  台账           : ${renders.length} 条 succeeded
  花费           : 0（夹具由 ffmpeg 本地合成，未调用任何模型）`)
} finally {
  await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
}
