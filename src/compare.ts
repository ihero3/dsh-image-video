/**
 * 原片 / 复刻对比片合成：把参考视频与复刻结果并成一条可直接对照的对比片。
 *
 * 拼接方向按**原片画幅**自动选择：竖屏（3:4、9:16 等 height ≥ width）左右并排，
 * 横屏（4:3、16:9 等 width > height）上下堆叠。理由是画布形状——竖屏再上下堆叠
 * 会得到极端细长的画面、横屏再左右并排会得到极端宽扁的画面，两者都难以观看。
 *
 * 依赖 ffmpeg / ffprobe，与首帧压缩、参考视频压缩共用同一条外部依赖。
 * @module dsh-image-video/compare
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

const execFileAsync = promisify(execFile)

/** 对比片拼接方向：竖屏原片左右并排（side-by-side）、横屏原片上下堆叠（stacked）。 */
export type CompareLayout = 'side-by-side' | 'stacked'

/** 单格高度上限：对比片用于对照动作与构图，720p 一档足够。 */
const CELL_HEIGHT = 720

/** 对比片帧率：两侧统一到固定帧率，拼接才不掉帧。 */
const COMPARE_FPS = 30

/** 标签字体候选：命中即叠加 ORIGINAL / AI RECREATED 角标，全部未命中则不加（不影响合成）。 */
const LABEL_FONTS: ReadonlyArray<string> = [
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
  'C:/Windows/Fonts/arial.ttf',
]

/**
 * 按原片画幅选择拼接方向。
 * @param width - 原片宽度（像素）。
 * @param height - 原片高度（像素）。
 * @returns 竖屏（含正方形）为左右并排，横屏为上下堆叠。
 */
export function resolveCompareLayout(width: number, height: number): CompareLayout {
  return height >= width ? 'side-by-side' : 'stacked'
}

/**
 * 探测视频画幅。
 * @param path - 本地路径或可被 ffprobe 读取的 URL。
 * @returns 视频宽高（像素）。
 * @throws ffprobe 不可用或无法解析画幅时抛错。
 */
async function probeFrameSize(path: string): Promise<{ width: number; height: number }> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path,
  ])
  const [width, height] = stdout.trim().split(',').map(Number)
  if (width === undefined || height === undefined || !(width > 0) || !(height > 0)) {
    throw new Error(`无法探测视频画幅：${path}`)
  }
  return { width, height }
}

/** 找到可用于角标的字体文件；找不到返回 undefined（对比片照常合成，只是没有角标）。 */
async function findLabelFont(): Promise<string | undefined> {
  for (const font of LABEL_FONTS) {
    try {
      await access(font)
      return font
    } catch {
      // 该候选不存在：继续试下一个
    }
  }
  return undefined
}

/**
 * 单侧视频链：等比缩放进 cellW×cellH 画布并居中，统一帧率，可选叠加角标。
 * @param index - 输入序号（0=原片，1=复刻结果）。
 * @param label - 角标文字；undefined 表示不叠加。
 * @param font - 角标字体文件；label 有值且字体可用时才生效。
 * @param cellW - 单格宽度（像素）。
 * @param cellH - 单格高度（像素）。
 * @returns filter_complex 中的一条链。
 */
function cellChain(index: number, label: string | undefined, font: string | undefined, cellW: number, cellH: number): string {
  const base = `[${index}:v]scale=${cellW}:${cellH}:force_original_aspect_ratio=decrease,`
    + `pad=${cellW}:${cellH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${COMPARE_FPS}`
  const badge = label !== undefined && font !== undefined
    ? `,drawtext=fontfile=${font}:text='${label}':x=18:y=16:fontsize=${Math.max(16, Math.round(cellH / 21))}:fontcolor=white:box=1:boxcolor=black@0.55`
    : ''
  return `${base}${badge}[c${index}]`
}

/** 对比片合成依赖。 */
export interface ComparisonDeps {
  /** 参考视频：本地路径或 http(s) URL（对比片左侧/上方的原片）。 */
  source: string
  /** 复刻结果本地路径。 */
  result: string
  signal?: AbortSignal
}

/** 对比片合成结果。 */
export interface ComparisonOutput {
  /** 合成后的字节（由调用方经 writeOutputFile 落盘）。 */
  data: Uint8Array
  /** 输出 MIME 类型。 */
  contentType: string
  /** 本次采用的拼接方向。 */
  layout: CompareLayout
  /** 合成片宽度（像素）。 */
  width: number
  /** 合成片高度（像素）。 */
  height: number
  /** 单格宽度（像素）。 */
  cellWidth: number
  /** 单格高度（像素）。 */
  cellHeight: number
}

/**
 * 合成对比片：左/上为原片、右/下为复刻结果，两侧等比缩放、统一帧率、按较短者截断。
 * @param deps - 原片路径、复刻结果路径与取消信号。
 * @returns 对比片字节与本次实际采用的画布参数。
 * @throws ffprobe 无法读画幅、或 ffmpeg 合成失败时抛错（由调用方决定是否降级为提示）。
 */
export async function renderComparison(deps: ComparisonDeps): Promise<ComparisonOutput> {
  const frame = await probeFrameSize(deps.source)
  const layout = resolveCompareLayout(frame.width, frame.height)
  const cellHeight = Math.min(CELL_HEIGHT, frame.height)
  const cellWidth = Math.max(2, Math.round((cellHeight * frame.width) / frame.height / 2) * 2)
  const font = await findLabelFont()
  const stack = layout === 'side-by-side' ? 'hstack' : 'vstack'
  const filters = [
    cellChain(0, 'ORIGINAL', font, cellWidth, cellHeight),
    cellChain(1, 'AI RECREATED', font, cellWidth, cellHeight),
    `[c0][c1]${stack}=inputs=2[v]`,
  ].join(';')

  const outPath = join(tmpdir(), `dsh-compare-${randomBytes(6).toString('hex')}.mp4`)
  try {
    await execFileAsync('ffmpeg', [
      '-y', '-v', 'error',
      '-i', deps.source,
      '-i', deps.result,
      '-filter_complex', filters,
      '-map', '[v]', '-shortest',
      '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      outPath,
    ], deps.signal === undefined ? {} : { signal: deps.signal })
    const data = await readFile(outPath)
    if (data.byteLength === 0) throw new Error('对比片合成为空文件')
    return {
      data,
      contentType: 'video/mp4',
      layout,
      width: layout === 'side-by-side' ? cellWidth * 2 : cellWidth,
      height: layout === 'side-by-side' ? cellHeight : cellHeight * 2,
      cellWidth,
      cellHeight,
    }
  } finally {
    await unlink(outPath).catch(() => {})
  }
}
