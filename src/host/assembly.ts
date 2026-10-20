/**
 * 宿主装配的可测纯函数（Track A / A140）。
 *
 * `src/index.ts` 是插件入口，大部分是"注册与装配"（没有活宿主跑不起来），但其中
 * **策略解析**这类纯逻辑是可以、也应该单测的。抽到这里，index 只负责把它们接起来。
 */

/** 输出目录保留策略（由环境变量配置）。 */
export interface RetentionPolicy {
  readonly maxFiles?: number
  readonly maxBytes?: number
}

/**
 * 从环境变量解析保留策略（`A38` 的配置入口）。
 *
 * 规则：`DSH_OUTPUT_MAX_FILES`（文件数）与 `DSH_OUTPUT_MAX_GB`（总 GB）；
 * **两个都没配 → 返回 undefined**（等于"不提示"，不打扰用户）。
 * @param env - 环境变量（测试可注入）。
 * @returns 策略；未配置时 undefined。
 */
export function parseRetentionPolicy(env: Record<string, string | undefined>): RetentionPolicy | undefined {
  const maxFiles = Number(env.DSH_OUTPUT_MAX_FILES ?? '') || undefined
  const maxGb = Number(env.DSH_OUTPUT_MAX_GB ?? '') || undefined
  if (maxFiles === undefined && maxGb === undefined) return undefined
  return {
    ...maxFiles === undefined ? {} : { maxFiles },
    ...maxGb === undefined ? {} : { maxBytes: Math.round(maxGb * 1024 ** 3) },
  }
}

/** 解析导出预设选择（`A31`/`A48` 的入口）：非法值一律回退默认，不让脏配置炸掉导出。 */
export function normalizePresetId(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * 用"人话"总结一次预检/导出（`A84`）：
 * @param input - 问题数、耗时、体积与未使用素材数。
 * @returns 一句话总结。
 */
export function summarizePreflight(input: {
  readonly blockingIssues: number
  readonly humanBytes: string
  readonly humanPredicted: string
  readonly unusedAssets: number
  readonly unusedBytes?: string
  /** 成片时长与比例的人话（如 `45 秒 / 16:9`）。 */
  readonly durationAndAspect?: string
}): string {
  const parts = [
    input.blockingIssues === 0 ? '可以导出' : `暂不建议导出（${input.blockingIssues} 个问题要先处理）`,
    `约 ${input.humanBytes}`,
    `导出预计 ${input.humanPredicted}`,
    ...input.durationAndAspect === undefined ? [] : [`预计 ${input.durationAndAspect}`],
    input.unusedAssets > 0
      ? `项目里有 ${input.unusedAssets} 个素材从未使用${input.unusedBytes === undefined ? '' : `（可选清理 ${input.unusedBytes}）`}`
      : '素材都在用',
  ]
  return parts.join('；')
}
