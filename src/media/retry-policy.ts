/**
 * 渲染失败的重试策略（Track A / A114）。
 *
 * 边界（重要）：
 * - **生成类调用（图/视频）绝不自动重试** —— 会重复计费。
 * - 渲染是**本地 ffmpeg**，只花 CPU 不产生费用，因此"瞬时失败"可以安全重试一次；
 *   即便如此也做成**显式 opt-in**（`retryTransient: true`），默认不重试。
 *
 * 只对"重试可能改变结果"的失败重试：超时、输出损坏/被杀、磁盘写失败。
 * 素材缺失、时间轴非法、ffmpeg 不可用、用户取消 —— 重试也是同样结果，一律不重试。
 */

/** 值得重试一次的错误码（白名单：宁可少重试，不等于多试）。 */
const TRANSIENT_CODES = new Set([
  'MEDIA_OUTPUT_INVALID',
  'MEDIA_RENDER_TIMEOUT',
  'MEDIA_RENDER_FAILED',
])

/** 绝不重试的错误码（显式列出，便于审阅；其余按白名单判断）。 */
const PERMANENT_CODES = new Set([
  'MEDIA_TIMELINE_EMPTY',
  'MEDIA_TIMELINE_OVERLAP',
  'MEDIA_ASSET_MISSING',
  'MEDIA_FFMPEG_UNAVAILABLE',
  'MEDIA_FFMPEG_ENCODER_MISSING',
  'MEDIA_ENCODER_UNSUPPORTED',
  'MEDIA_DISK_FULL',
  'MEDIA_RENDER_CANCELLED',
])

/**
 * 判断一次渲染失败是否值得自动重试。
 * @param code - `RenderError.code`（未知码视为不可重试，保守）。
 * @returns 可重试返回 true。
 */
export function isTransientRenderFailure(code: string | undefined): boolean {
  if (code === undefined) return false
  if (PERMANENT_CODES.has(code)) return false
  return TRANSIENT_CODES.has(code)
}

/** 最多自动重试几次（当前策略：一次）。 */
export const MAX_AUTO_RETRIES = 1
