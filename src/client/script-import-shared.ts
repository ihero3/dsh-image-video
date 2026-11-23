/**
 * 剧本文件导入的共享逻辑：剧本分段与角色/场景/道具分区都用它。
 *
 * 文件名先占位、解析成功后把原文一并写进共享 store：文件名一直看得到，
 * 原文也单独留着（不依赖可编辑的剧本输入框），三个提取分区拿它当输入来源。
 *
 * @module dsh-image-video/client/script-import-shared
 */
import type { ImportedScriptView, WorkbenchApi } from './api.ts'
import type { WorkbenchFieldSetter } from './workbench-store.ts'

/** 浏览器没有 Buffer：把文件字节转 base64。 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

/** 一次导入的结果：成功解析的文件内容与失败原因（都带文件名）。 */
export interface SharedImportResult {
  readonly done: readonly ImportedScriptView[]
  readonly failures: readonly string[]
}

/**
 * 导入一批文件并把结果写进共享列表。
 *
 * 一份失败不影响其它份；同名文件只留一条（再次导入覆盖原文）。
 * @param api - 工作台 API（负责 txt/md/docx/pdf 解析）。
 * @param files - 浏览器选中的文件。
 * @param setFiles - 共享列表的 setter。
 * @returns 成功解析的文件与失败原因。
 */
export async function importScriptFilesShared(
  api: WorkbenchApi,
  files: readonly File[],
  setFiles: WorkbenchFieldSetter<'pipelineImportedFiles'>,
): Promise<SharedImportResult> {
  if (files.length === 0) return { done: [], failures: [] }
  const picked = files
  // 选中就先挂出来：用户立刻看到文件名进来了，解析失败也留在列表里说明原因
  setFiles(current => {
    const known = new Set(current.map(item => item.name))
    const added = picked
      .filter(file => !known.has(file.name))
      .map(file => ({ name: file.name, text: '', status: 'importing' as const }))
    return [...current, ...added]
  })
  const done: ImportedScriptView[] = []
  const failures: string[] = []
  for (const file of picked) {
    try {
      const base64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()))
      const imported: ImportedScriptView = await api.importScript({ fileName: file.name, base64 })
      done.push(imported)
      // 原文单独存一份：之后用户改剧本框、生成剧本都不动它
      setFiles(current => current.map(item => item.name === file.name
        ? { name: item.name, text: imported.text, status: 'done' as const }
        : item))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      failures.push(`${file.name}：${message}`)
      setFiles(current => current.map(item => item.name === file.name
        ? { name: item.name, text: item.text, status: 'failed' as const, error: message }
        : item))
    }
  }
  return { done, failures }
}
