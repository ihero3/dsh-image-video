/**
 * ffmpeg 的**唯一解析点**与特性检测（`T5-4`）。
 *
 * 口径（`R-TML-6`/`R-TML-7`）：时间轴导出依赖 ffmpeg，但"有没有装、装在哪、支不支持
 * 需要的编码器"必须在这里集中回答，并且**失败也要可操作**——给机器可读的 code 加一句
 * 人能照着做的话（装它 / 设 `DSH_FFMPEG_PATH` 指过去），而不是让上层抛一句看不出
 * 下一步的英文栈。
 */
import { access, constants } from 'node:fs/promises'
import { execFile } from 'node:child_process'

/** 机器可读的失败码（UI 据此给不同下一步动作）。 */
export type MediaFfmpegCode = 'MEDIA_FFMPEG_UNAVAILABLE' | 'MEDIA_FFMPEG_ENCODER_MISSING' | 'MEDIA_FFMPEG_NOT_EXECUTABLE'

/** 探测结果。 */
export interface FfmpegProbe {
  readonly available: boolean
  readonly code?: MediaFfmpegCode
  readonly path?: string
  readonly version?: string
  /** 导出需要的两个编码器是否都在。 */
  readonly encoders?: { readonly h264: boolean; readonly aac: boolean }
  /** 给人看的、可操作的一句话。 */
  readonly message?: string
}

/** 跑一个命令，返回 stdout（测试可注入）。 */
export type RunCommand = (file: string, args: readonly string[]) => Promise<{ code: number; stdout: string; stderr: string }>

/** 环境里可覆盖 ffmpeg 位置的变量名。 */
export const FFMPEG_PATH_ENV = 'DSH_FFMPEG_PATH'

const DEFAULT_CANDIDATES: readonly string[] = [
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/usr/bin/ffmpeg',
]

const defaultRun: RunCommand = (file, args) => new Promise(resolve => {
  execFile(file, [...args], { timeout: 10_000 }, (error, stdout, stderr) => {
    const code = error === null ? 0 : typeof (error as { code?: unknown }).code === 'number'
      ? (error as { code: number }).code
      : 1
    resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
  })
})

/** 提示语：怎么把 ffmpeg 装上或指给宿主。 */
function installHint(): string {
  return `未找到可用的 ffmpeg。macOS 可执行 \`brew install ffmpeg\`；已装在别处就设 ${FFMPEG_PATH_ENV}=/path/to/ffmpeg 后重试。`
}

/** 从 `ffmpeg -version` 输出里取版本号。 */
export function parseFfmpegVersion(stdout: string): string | undefined {
  return /ffmpeg version (\S+)/.exec(stdout)?.[1]
}

/** 从 `-encoders` 输出里看有没有需要的编码器。 */
export function parseEncoders(stdout: string): { h264: boolean; aac: boolean } {
  return {
    h264: /\blibx264\b/.test(stdout) || /\bh264_videotoolbox\b/.test(stdout) || /\bh264\b/.test(stdout),
    aac: /\baac\b/.test(stdout) || /\baac_at\b/.test(stdout),
  }
}

/**
 * 解析 ffmpeg 并检测特性。解析顺序：`DSH_FFMPEG_PATH` → PATH 上的 `ffmpeg` → 常见安装位置。
 * @param options.env - 环境变量（默认 `process.env`）。
 * @param options.run - 命令执行器（测试注入）。
 * @param options.candidates - 额外候选路径。
 * @returns 探测结果；不可用时 `available: false` 且带 code 与可操作文案。
 */
export async function probeFfmpeg(options: {
  env?: Record<string, string | undefined>
  run?: RunCommand
  candidates?: readonly string[]
  /** 只认给定候选（不再退回 PATH/常见安装位置）——"检查指定副本"的诊断用。 */
  strict?: boolean
} = {}): Promise<FfmpegProbe> {
  const env = options.env ?? process.env
  const run = options.run ?? defaultRun
  const explicit = env[FFMPEG_PATH_ENV]
  const candidates = [
    ...explicit === undefined || explicit === '' ? [] : [explicit],
    ...options.candidates ?? [],
    ...DEFAULT_CANDIDATES.slice(options.candidates === undefined ? 0 : DEFAULT_CANDIDATES.length),
  ]

  let found: string | undefined
  let sawPermissionProblem = false
  for (const candidate of options.strict === true ? candidates : [...candidates, 'ffmpeg']) {
    if (candidate === 'ffmpeg') {
      // PATH 上的 ffmpeg：直接试跑，跑不动就当没有
      const attempt = await run('ffmpeg', ['-version']).catch(() => undefined)
      if (attempt !== undefined && attempt.code === 0) { found = 'ffmpeg'; break }
      continue
    }
    try {
      await access(candidate, constants.X_OK)
      found = candidate
      break
    } catch (error) {
      if ((error as { code?: string }).code === 'EACCES') sawPermissionProblem = true
    }
  }

  if (found === undefined) {
    return {
      available: false,
      code: sawPermissionProblem ? 'MEDIA_FFMPEG_NOT_EXECUTABLE' : 'MEDIA_FFMPEG_UNAVAILABLE',
      message: sawPermissionProblem
        ? `找到 ffmpeg 但没有执行权限（${installHint()}）`
        : installHint(),
    }
  }

  const versionRun = await run(found, ['-version']).catch(() => ({ code: 1, stdout: '', stderr: 'spawn failed' }))
  if (versionRun.code !== 0) {
    const permission = /EACCES|permission denied/i.test(versionRun.stderr)
    return {
      available: false,
      code: permission ? 'MEDIA_FFMPEG_NOT_EXECUTABLE' : 'MEDIA_FFMPEG_UNAVAILABLE',
      path: found,
      message: permission
        ? `ffmpeg 存在但跑不起来（权限被拒）：${found}。修权限或设 ${FFMPEG_PATH_ENV} 指向可执行副本。`
        : `ffmpeg 无法执行（退出码 ${versionRun.code}）：${versionRun.stderr.trim().slice(0, 200)}`,
    }
  }
  const version = parseFfmpegVersion(versionRun.stdout)

  const encodersRun = await run(found, ['-hide_banner', '-encoders']).catch(() => ({ code: 1, stdout: '', stderr: '' }))
  const encoders = parseEncoders(encodersRun.stdout)
  if (!encoders.h264) {
    return {
      available: false,
      code: 'MEDIA_FFMPEG_ENCODER_MISSING',
      path: found,
      ...version === undefined ? {} : { version },
      encoders,
      message: `这份 ffmpeg 没有 H.264 编码器（试过 libx264/videotoolbox）。装带 libx264 的构建：\`brew install ffmpeg\`，或用 ${FFMPEG_PATH_ENV} 指向带编码器的副本。`,
    }
  }

  return { available: true, path: found, ...version === undefined ? {} : { version }, encoders }
}
