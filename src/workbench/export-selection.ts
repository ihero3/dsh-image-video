/**
 * 导出条"下拉档位" → 实际规格（`B2`）。
 *
 * 界面上的三个下拉给的是**档位**（480P/768P/2K、24/25/30/60、16:9/9:16/1:1/3:4），
 * 渲染器只认 `timeline.exportFormat` 的 `{width,height,frameRate}`。这一层负责换算，
 * 口径与多比例切片（`derive-ratios.ts`）保持一致：**短边不变**，宽高必须是偶数。
 *
 * 为什么要单独一个模块：`timeline.ts` 不认识多比例白名单，`derive-ratios.ts` 又已经
 * 依赖 `timeline.ts`，把换算塞进任一侧都会形成环。
 *
 * @module dsh-image-video/workbench/export-selection
 */
import { sizeForRatio } from './derive-ratios.ts'
import {
  DEFAULT_EXPORT_FORMAT, EXPORT_DIMENSION_RANGE, EXPORT_FRAME_RATES, normalizeExportFormat,
  type TimelineExportFormat,
} from './timeline.ts'

/**
 * 分辨率档位 → 短边像素。
 *
 * 短边而不是长边：竖屏 2K 应该是 1440×2560，横屏 2K 是 2560×1440，两者短边都是 1440。
 * 按长边算会让竖屏变成 2560 高，超出用户对"2K"的预期。
 */
export const EXPORT_RESOLUTION_SHORT_SIDES: Readonly<Record<string, number>> = {
  '480': 480,
  '768': 768,
  '2k': 1440,
}

/** 画幅档位 → 比例名（与 `locales.ts` 的 `16:9 / 3:4 / 1:1 / 9:16` 文案一一对应）。 */
export const EXPORT_ASPECT_PRESETS: Readonly<Record<string, string>> = {
  landscape: '16:9',
  portrait: '3:4',
  square: '1:1',
  vertical: '9:16',
}

/** "模型默认"：不覆盖分辨率，沿用时间轴自己的规格。 */
const KEEP_RESOLUTION = 'default'

/** 客户端下拉的原始取值（字符串档位，宿主负责校验）。 */
export interface ExportSelection {
  readonly resolution?: string
  readonly fps?: number
  readonly aspect?: string
}

/** 夹到导出允许范围并取偶（与 `derive-ratios` 同口径）。 */
function clampEven(value: number): number {
  const rounded = Math.round(value / 2) * 2
  return Math.max(EXPORT_DIMENSION_RANGE.min, Math.min(EXPORT_DIMENSION_RANGE.max, rounded))
}

/** 是否带了任何一个能改变规格的档位。 */
export function hasExportSelection(selection: ExportSelection): boolean {
  return selection.resolution !== undefined || selection.fps !== undefined || selection.aspect !== undefined
}

/**
 * 把档位合并到时间轴既有规格上。
 *
 * 规则：
 * - `resolution` 缺省或 `default` → 保留原短边；其他值必须是已知档位，否则**抛错**（不静默降级）。
 * - `aspect` 缺省 → 按原画幅等比缩放；给定则用该比例重新算宽高（短边不变）。
 * - `fps` 缺省 → 保留原帧率；给定必须落在 {@link EXPORT_FRAME_RATES} 内。
 * - 画面参数一变就**丢掉原码率**：8Mbps 是给 1080p 定的，套到 2K 会严重欠码（与 `estimate.ts` 同一判断）。
 *
 * @param base - 时间轴现有 `exportFormat`（可为 `undefined`／历史脏值，内部先规范化并抛错）。
 * @param selection - 客户端档位。
 * @returns 可直接交给渲染器的规格。
 * @throws {Error} 档位未知、帧率不支持、尺寸越界时。
 */
export function resolveExportFormat(base: unknown, selection: ExportSelection): TimelineExportFormat {
  const kept = normalizeExportFormat(base)
  const baseShort = Math.min(kept.width, kept.height)

  let shortSide = baseShort
  const resolution = selection.resolution
  if (resolution !== undefined && resolution !== '' && resolution !== KEEP_RESOLUTION) {
    const preset = EXPORT_RESOLUTION_SHORT_SIDES[resolution]
    if (preset === undefined) {
      const allowed = [KEEP_RESOLUTION, ...Object.keys(EXPORT_RESOLUTION_SHORT_SIDES)].join(' / ')
      throw new Error(`不支持的分辨率档位「${resolution}」：可选 ${allowed}`)
    }
    shortSide = preset
  }

  let width: number
  let height: number
  const aspect = selection.aspect
  if (aspect === undefined || aspect === '') {
    // 只换了分辨率：按原画幅等比缩放，避免把 16:9 的片子压成方图
    const scale = shortSide / baseShort
    width = clampEven(kept.width * scale)
    height = clampEven(kept.height * scale)
  } else {
    const ratio = EXPORT_ASPECT_PRESETS[aspect]
    if (ratio === undefined) {
      throw new Error(`不支持的画幅档位「${aspect}」：可选 ${Object.keys(EXPORT_ASPECT_PRESETS).join(' / ')}`)
    }
    // 传 shortSide×shortSide 进去，让 sizeForRatio 只把它当"短边"用。
    // `derive-ratios` 的白名单只有横版 4:3、没有竖版 3:4 → 用转置得到竖版，避免为 UI 加宽白名单。
    const sized = sizeForRatio({ width: shortSide, height: shortSide, frameRate: kept.frameRate }, ratio === '3:4' ? '4:3' : ratio)
    if (ratio === '3:4') {
      width = sized.height
      height = sized.width
    } else {
      width = sized.width
      height = sized.height
    }
  }

  let frameRate = kept.frameRate
  if (selection.fps !== undefined) {
    const rounded = Math.round(selection.fps)
    if (!Number.isFinite(selection.fps) || !EXPORT_FRAME_RATES.includes(rounded)) {
      throw new Error(`不支持的帧率「${selection.fps}」：可选 ${EXPORT_FRAME_RATES.join(' / ')}`)
    }
    frameRate = rounded
  }

  const pictureChanged = width !== kept.width || height !== kept.height || frameRate !== kept.frameRate
  const bitrateKbps = pictureChanged ? undefined : kept.bitrateKbps
  return {
    width,
    height,
    frameRate,
    ...bitrateKbps === undefined ? {} : { bitrateKbps },
  }
}

/** 规格是否与时间轴现有的一致（一致就不必覆盖，省掉一次无意义的格式透传）。 */
export function sameExportFormat(left: TimelineExportFormat, right: unknown): boolean {
  const other = normalizeExportFormat(right ?? DEFAULT_EXPORT_FORMAT)
  return left.width === other.width
    && left.height === other.height
    && left.frameRate === other.frameRate
    && left.bitrateKbps === other.bitrateKbps
}
