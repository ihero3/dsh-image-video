/**
 * 从图片元数据里提取 ComfyUI / LiblibAI 工作流 JSON。
 *
 * ComfyUI 出图时会把工作流写进 PNG 的 tEXt / iTXt 文本块：
 * - `workflow`：UI 保存格式（nodes + links，带布局）；
 * - `prompt`：API 格式（class_type + inputs）。
 * 这里只读取未压缩文本块，不引入解压依赖；zTXt / 压缩 iTXt 一律跳过。
 *
 * @module dsh-image-video/client/image-workflow
 */

/** PNG 文件头。 */
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const

/** 可能是工作流 JSON 的文本块关键字。 */
const WORKFLOW_KEYS = ['workflow', 'prompt'] as const

function readU32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16)
    | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)
}

/** 找 null 终止符，返回 keyword 与正文的起始位置。 */
function splitKeyword(data: Uint8Array): { keyword: string; start: number } | undefined {
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] === 0) {
      return { keyword: new TextDecoder().decode(data.subarray(0, index)), start: index + 1 }
    }
  }
  return undefined
}

function looksLikeWorkflow(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.startsWith('{') && (trimmed.includes('"nodes"') || trimmed.includes('"class_type"'))
}

/**
 * 读取 PNG 里的工作流 JSON 文本。
 * @param bytes - 图片文件字节。
 * @returns 找到的第一个工作流 JSON 原文；没有元数据或不是 PNG 时返回 undefined。
 */
export function readWorkflowFromImage(bytes: Uint8Array): string | undefined {
  if (bytes.length < PNG_SIGNATURE.length || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
    return undefined
  }
  let offset = PNG_SIGNATURE.length
  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset)
    const type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8))
    const dataStart = offset + 8
    if (length < 0 || dataStart + length + 4 > bytes.length) break
    const data = bytes.subarray(dataStart, dataStart + length)
    if (type === 'tEXt') {
      const split = splitKeyword(data)
      if (split !== undefined && (WORKFLOW_KEYS as readonly string[]).includes(split.keyword)) {
        const text = new TextDecoder().decode(data.subarray(split.start))
        if (looksLikeWorkflow(text)) return text
      }
    } else if (type === 'iTXt') {
      const split = splitKeyword(data)
      if (split !== undefined && (WORKFLOW_KEYS as readonly string[]).includes(split.keyword)
        && data[split.start] === 0) {
        // iTXt：keyword\0 flag(0) method languageTag\0 translatedKeyword\0 text
        let cursor = split.start + 2
        while (cursor < data.length && data[cursor] !== 0) cursor += 1
        cursor += 1
        while (cursor < data.length && data[cursor] !== 0) cursor += 1
        cursor += 1
        const text = new TextDecoder().decode(data.subarray(cursor))
        if (looksLikeWorkflow(text)) return text
      }
    }
    offset = dataStart + length + 4
  }
  return undefined
}
