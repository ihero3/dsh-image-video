/**
 * 诊断日志落盘 + 轮转（Track A / A100）。
 *
 * 现状：DiagnosticsCollector 只在内存环形 50 条（`A18`）—— 进程重启即丢，
 * "上次为什么失败"事后无从查起。这里把诊断事件同时写到磁盘，并按大小轮转。
 *
 * 安全：沿用 Collector 的脱敏口径（**不写提示词、不写绝对路径**），只写事件名/错误摘要/时间。
 */
import { appendFile, mkdir, readFile, rename, stat, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** 落盘条目（与 Collector 的快照同构，不含提示词与路径）。 */
export interface DiagnosticLogEntry {
  readonly at: string
  readonly level: 'info' | 'warn' | 'error'
  readonly event: string
  readonly message?: string
  readonly [field: string]: unknown
}

/** 轮转策略。 */
export interface RotationPolicy {
  /** 单个文件的最大字节（默认 1MB）。 */
  readonly maxBytes?: number
  /** 保留几份（含当前文件，默认 3）。 */
  readonly keep?: number
}

export interface LogFileInfo {
  readonly path: string
  readonly bytes: number
  readonly current: boolean
}

/** 判断是否需要轮转（纯函数，便于单测）。 */
export function shouldRotate(currentBytes: number, incomingBytes: number, policy: RotationPolicy = {}): boolean {
  const maxBytes = Math.max(1024, policy.maxBytes ?? 1024 * 1024)
  return currentBytes > 0 && currentBytes + incomingBytes > maxBytes
}

/** 轮转后的文件名：`base` → `base.1`（旧的依次后移）。 */
export function rotatedName(basePath: string, index: number): string {
  return `${basePath}.${index}`
}

/**
 * 追加一条诊断日志（必要时先轮转）。
 * @param input - 日志路径、条目与轮转策略。
 * @returns 写入后的当前文件字节数。
 */
export async function appendDiagnosticLog(input: {
  path: string
  entry: DiagnosticLogEntry
  policy?: RotationPolicy
}): Promise<number> {
  const { path, entry } = input
  const policy = input.policy ?? {}
  const keep = Math.max(1, policy.keep ?? 3)
  const keepFloat = keep
  const line = `${JSON.stringify(entry)}\n`
  const lineBytes = Buffer.byteLength(line, 'utf8')
  await mkdir(dirname(path), { recursive: true }).catch(() => undefined)
  const currentBytes = await stat(path).then(info => info.size).catch(() => 0)
  if (shouldRotate(currentBytes, lineBytes, { ...policy, keep: keepFloat })) {
    // 从最旧的一份开始腾位置：base.(keep-1) 丢弃，其余后移，最后 base → base.1
    await unlink(rotatedName(path, keep - 1)).catch(() => undefined)
    for (let index = keep - 2; index >= 1; index -= 1) {
      await rename(rotatedName(path, index), rotatedName(path, index + 1)).catch(() => undefined)
    }
    await rename(path, rotatedName(path, 1)).catch(() => undefined)
  }
  await appendFile(path, line, 'utf8')
  return (await stat(path).then(info => info.size).catch(() => 0)) + 0
}

/** 列出当前日志文件与轮转副本（诊断端点用）。 */
export async function listDiagnosticLogs(path: string, policy: RotationPolicy = {}): Promise<LogFileInfo[]> {
  const keep = Math.max(1, policy.keep ?? 3)
  const files: LogFileInfo[] = []
  const current = await stat(path).then(info => info.size).catch(() => undefined)
  if (current !== undefined) files.push({ path, bytes: current, current: true })
  for (let index = 1; index < keep; index += 1) {
    const rotated = rotatedName(path, index)
    const bytes = await stat(rotated).then(info => info.size).catch(() => undefined)
    if (bytes !== undefined) files.push({ path: rotated, bytes, current: false })
  }
  return files
}

/** 读回最近若干行（给"事后排查"用；默认 200 行）。 */
export async function tailDiagnosticLog(path: string, lines = 200): Promise<string[]> {
  const text = await readFile(path, 'utf8').catch(() => '')
  return text.trim() === '' ? [] : text.trim().split('\n').slice(-Math.max(1, lines))
}

/** 默认日志路径（与工作台数据同目录）。 */
export function defaultDiagnosticLogPath(workbenchDir: string): string {
  return join(workbenchDir, 'diagnostics.log')
}
