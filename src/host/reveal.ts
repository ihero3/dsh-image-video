/**
 * 在系统文件管理器里打开本地产物目录（人工清理用）。
 *
 * 只做"打开目录"，**不做删除**：清理是破坏性动作，交给人自己在 Finder / 资源管理器里做
 * （产品决定，见 `docs/快速创建.md` §六）。所以这里既没有清理按钮，也没有 dryRun 之类的
 * 半自动路径。
 *
 * 实现刻意不引第三方依赖：`open` / `explorer` / `xdg-open` 三个平台命令覆盖桌面三平台；
 * 远程宿主（headless / WSL 无桌面）打不开时**如实返回原因**，界面把路径给用户手动打开，
 * 不假装成功。
 *
 * @module dsh-image-video/host/reveal
 */
import { execFile } from 'node:child_process'
import { isAbsolute } from 'node:path'

/** 打开目录的结果：失败时带上可读原因，界面据此给"手动打开 <路径>"。 */
export interface RevealResult {
  /** 是否成功唤起文件管理器。 */
  readonly ok: boolean
  /** 被打开的绝对路径（失败时也返回，供界面展示）。 */
  readonly path: string
  /** `ok:false` 时的人话原因。 */
  readonly reason?: string
}

/** 执行一条外部命令（可注入，测试里替换成替身，不真的弹窗口）。 */
export type RevealRunner = (command: string, args: readonly string[]) => Promise<void>

/** 默认执行器：8 秒超时；命令不存在/权限不足都折成异常交给上层转成人话。 */
const defaultRun: RevealRunner = (command, args) => new Promise((resolvePromise, rejectPromise) => {
  execFile(command, [...args], { timeout: 8_000 }, (error) => {
    if (error === null) resolvePromise()
    else rejectPromise(error)
  })
})

/**
 * 按当前平台选择"打开目录"的命令。
 * @param path - 要打开的绝对目录。
 * @returns 命令与参数；平台未知时抛错（由调用方折成原因）。
 */
export function revealCommand(path: string): { readonly command: string, readonly args: readonly string[] } {
  switch (process.platform) {
    case 'darwin': return { command: 'open', args: [path] }
    case 'win32': return { command: 'explorer', args: [path] }
    default: return { command: 'xdg-open', args: [path] }
  }
}

/**
 * 打开一个目录。**永不抛错**：任何失败都转成 `{ok:false, reason}`。
 * @param directory - 本地产物目录（绝对路径）。
 * @param run - 执行器；缺省真的唤起系统文件管理器。
 * @returns 结果（成功或带原因的失败）。
 */
export async function revealDirectory(directory: string, run: RevealRunner = defaultRun): Promise<RevealResult> {
  if (directory.trim() === '' || !isAbsolute(directory)) {
    return { ok: false, path: directory, reason: '产物目录不是绝对路径，宿主无法定位' }
  }
  const { command, args } = revealCommand(directory)
  try {
    await run(command, args)
    return { ok: true, path: directory }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, path: directory, reason: `无法唤起文件管理器（${command}）：${message.slice(0, 120)}` }
  }
}
