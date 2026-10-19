/**
 * 预设 → 存储 → 导出 的端到端一致性（持续交付轮 R5）。
 *
 * 之前只验证了"预设值本身合法"，没验证"按预设真能出片"——特别是 9:16 竖屏这种
 * 与源素材比例差异很大的情况（320×240 源 → 1080×1920 成片，靠 scale+pad 兜住）。
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { EXPORT_PRESETS, presetToFormat } from '../src/workbench/presets.ts'
import { WorkbenchStore } from '../src/workbench/store.ts'
import { RenderService, probeMediaSpec } from '../src/media/render.ts'

const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const dirs: string[] = []
afterAll(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function temp(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(directory)
  return directory
}

describe('preset → store → export (R5)', () => {
  it('exports at the vertical preset spec from a landscape source (真机，零生成花费)', async () => {
    const work = await temp('dsh-preset-work-')
    const outputs = await temp('dsh-preset-out-')
    const source = join(work, 'src.mp4')
    await new Promise<void>((resolve, reject) => {
      execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
        '-i', 'testsrc=size=320x240:rate=30:duration=1', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', source],
        error => { error === null ? resolve() : reject(error) })
    })

    // 1) 按预设写进时间轴（走真实的 store 校验）
    const store = new WorkbenchStore({ directory: await temp('dsh-preset-store-') })
    const project = await store.createProject('预设导出')
    const format = presetToFormat('douyin-vertical')
    const timeline = await store.saveTimeline({
      projectId: project.id, exportFormat: format,
      tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'v', assetPath: source, startMs: 0, durationMs: 1000 }] }],
    })
    expect(timeline.exportFormat).toMatchObject({ width: 1080, height: 1920, frameRate: 30 })

    // 2) 真按这个规格出片
    const service = new RenderService({ outputsDir: outputs })
    const result = await service.render(timeline)
    const spec = await probeMediaSpec(FFMPEG, result.outputPath)
    expect(spec?.width).toBe(1080)
    expect(spec?.height).toBe(1920)
    expect(result.bytes).toBeGreaterThan(1000)
  }, 90_000)

  it('every preset can be stored and read back unchanged', async () => {
    const store = new WorkbenchStore({ directory: await temp('dsh-preset-all-') })
    const project = await store.createProject('全部预设')
    for (const preset of EXPORT_PRESETS) {
      const saved = await store.saveTimeline({ projectId: project.id, exportFormat: presetToFormat(preset.id), tracks: [] })
      expect(saved.exportFormat).toMatchObject({ width: preset.width, height: preset.height, frameRate: preset.frameRate })
    }
  })
})
