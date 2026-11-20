/**
 * 剧本文件导入（`B-20`）：把本地剧本文件读成纯文本，交给分镜拆解。
 *
 * 支持 `txt` / `md` / `docx` / `pdf` 四类。解析在**宿主**侧完成：界面上传的剧本动辄几十 MB，
 * 放到浏览器里解压/解码既慢又不可靠。
 *
 * PDF 交给 `pdfjs-dist` 提取（含 CID 字体的 `ToUnicode` 映射，中文不再乱码）；
 * 扫描件这类没有文字层的文件提取不出可读文字时**明确拒绝**并让用户改用 Word/txt。
 *
 * @module dsh-image-video/host/script-import
 */

import { readFile, stat } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'
import { extname } from 'node:path'

/** 导入结果：纯文本 + 原文件信息（界面用来回显文件名）。 */
export interface ImportedScript {
  readonly fileName: string
  readonly text: string
  readonly bytes: number
}

/** 支持的文件扩展名。 */
export const SCRIPT_IMPORT_EXTENSIONS: readonly string[] = ['.txt', '.md', '.markdown', '.docx', '.pdf']

/**
 * 一份剧本文件的文本上限：按「整本长篇小说」定，约 200 万字
 * （《平凡的世界》约 100 万字），超出才拒绝；拆解侧另有单段 2 万字窗口。
 */
export const MAX_IMPORTED_SCRIPT_CHARS = 2_000_000

/** 导入文件的字节上限：超出直接拒绝，不去读一个大到会拖垮进程的文件。 */
export const MAX_IMPORTED_SCRIPT_BYTES = 50 * 1024 * 1024

/** zip 本地文件头签名（`PK\x03\x04`）。 */
const ZIP_LOCAL_HEADER = 0x04034b50

/**
 * 从 zip 容器里取一个文件的原始字节（只读本地文件头，够用且不引入解压依赖）。
 * @param buffer - 整个 zip 文件。
 * @param entryName - 目标条目名（如 `word/document.xml`）。
 * @returns 解压后的字节；找不到条目时 `undefined`。
 */
function readZipEntry(buffer: Buffer, entryName: string): Buffer | undefined {
  let offset = 0
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== ZIP_LOCAL_HEADER) {
      offset += 1
      continue
    }
    const method = buffer.readUInt16LE(offset + 8)
    const compressedSize = buffer.readUInt32LE(offset + 18)
    const nameLength = buffer.readUInt16LE(offset + 26)
    const extraLength = buffer.readUInt16LE(offset + 28)
    const dataStart = offset + 30 + nameLength + extraLength
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8')
    if (name !== entryName) {
      // 大小未知（数据描述符）时无法安全跳过：整段扫描代价可控，逐字节找下一个头
      offset = compressedSize === 0 ? offset + 4 : dataStart + compressedSize
      continue
    }
    if (compressedSize === 0) return undefined
    const data = buffer.subarray(dataStart, dataStart + compressedSize)
    if (method === 0) return Buffer.from(data)
    if (method === 8) return inflateRawSync(data)
    return undefined
  }
  return undefined
}

/**
 * 反解 Word 正文里的 XML 文本（段落换行、实体反转义）。
 * @param xml - `word/document.xml` 的内容。
 * @returns 纯文本。
 */
export function extractDocxText(xml: string): string {
  // 先把段落/换行/制表转成等价的控制字符，再一次性剥掉所有标签——
  // 只取 `w:t` 会丢掉段落边界，剧本就会粘成一整段。
  const withBreaks = xml
    .replace(/<w:tab\/>/gu, '\t')
    .replace(/<w:br\/>/gu, '\n')
    .replace(/<\/w:p>/gu, '\n')
  return decodeXmlEntities(withBreaks.replace(/<[^>]+>/gu, ''))
}

/** XML 文本实体反转义（Word 只用到这几个）。 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, '&')
}

/**
 * 从 PDF 里提取文字。
 *
 * 中文 PDF 的正文通常是 CID 字体按字形编码存的字节，直接读 `Tj` 字符串只会得到乱码，
 * 必须经字体自带的 `ToUnicode` 映射才能还原成文字。这里交给 `pdfjs-dist` 处理
 * （它同时覆盖对象流、交叉引用流、加密拒绝等边界），本项目不再自己维护 PDF 解析。
 *
 * @param buffer - 整个 PDF 文件。
 * @returns 提取到的文本（按页换行；可能为空串）。
 * @throws {Error} PDF 损坏、加密或解码失败时。
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // 体积大且只在导入 PDF 时用得到：动态加载，避免拖慢宿主启动
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  })
  try {
    const document = await task.promise
    const pages: string[] = []
    let total = 0
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index)
      const content = await page.getTextContent()
      const text = content.items
        .map(item => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ''}` : ''))
        .join('')
      pages.push(text)
      total += text.length
      // 到了全文上限就不再解码剩余页：整本长篇也装得下，但不至于无限拖住宿主
      if (total >= MAX_IMPORTED_SCRIPT_CHARS) break
      page.cleanup()
    }
    return normalizePdfTypography(pages.join('\n'))
      .replace(/[ \t]+\n/gu, '\n')
      .replace(/\n{3,}/gu, '\n\n')
      .trim()
  } finally {
    // 走 loading task 收尾：加载本身就失败时，文档对象还不存在
    await task.destroy()
  }
}

/**
 * 修正 PDF 提取出的兼容字符：有些字体的 `ToUnicode` 指向康熙部首/兼容汉字
 * （如 `⼈` `⼤` `⼀`），肉眼几乎一样但码点不同，会让模型匹配和搜索失准。
 * 只归一化这两段，不动中文标点。
 * @param text - 原始提取文本。
 * @returns 归一化后的文本。
 */
function normalizePdfTypography(text: string): string {
  return text.replace(/[\u2E80-\u2FDF\uF900-\uFAFF]/gu, char => char.normalize('NFKC'))
}

/**
 * 把一份剧本文件的字节转成纯文本（浏览器上传与本地路径共用）。
 * @param fileName - 文件名（只用扩展名决定解析方式，也原样回显）。
 * @param buffer - 文件内容。
 * @returns 文件名、文本与字节数。
 * @throws {Error} 扩展名不支持、文件过大、解析失败或提取不到可读文字时。
 */
export async function extractScriptBytes(fileName: string, buffer: Buffer): Promise<ImportedScript> {
  const extension = extname(fileName).toLowerCase()
  if (!SCRIPT_IMPORT_EXTENSIONS.includes(extension)) {
    throw new Error(`不支持的文件类型 ${extension === '' ? '（无扩展名）' : extension}：请用 txt / md / docx / pdf`)
  }
  if (buffer.byteLength > MAX_IMPORTED_SCRIPT_BYTES) {
    throw new Error(`文件超过 ${Math.round(MAX_IMPORTED_SCRIPT_BYTES / 1024 / 1024)} MB，请先精简后再导入`)
  }
  let text: string
  if (extension === '.docx') {
    const xml = readZipEntry(buffer, 'word/document.xml')
    if (xml === undefined) throw new Error('这个 docx 里没有可读的正文（可能已加密或不是 Word 文档）')
    text = extractDocxText(xml.toString('utf8'))
  } else if (extension === '.pdf') {
    try {
      text = await extractPdfText(buffer)
    } catch (cause) {
      throw new Error(`这份 PDF 解析失败（可能已加密或文件损坏）：${cause instanceof Error ? cause.message : String(cause)}`)
    }
    if (text.trim().length < 20) {
      throw new Error('这份 PDF 提取不到可读文字（可能是扫描件或使用了嵌入字体编码）：请改用 Word / txt，或先做文字识别')
    }
  } else {
    text = buffer.toString('utf8').replace(/^\uFEFF/u, '')
  }
  const normalized = text.replace(/\r\n?/gu, '\n').trim()
  if (normalized === '') throw new Error('文件里没有可读的文字')
  if (normalized.length > MAX_IMPORTED_SCRIPT_CHARS) {
    throw new Error(`文件正文超过 ${MAX_IMPORTED_SCRIPT_CHARS} 字，请先拆分后再导入`)
  }
  return { fileName: fileName.split(/[\\/]/u).pop() ?? fileName, text: normalized, bytes: buffer.byteLength }
}

/**
 * 读取一份本地剧本文件并转成纯文本。
 * @param path - 本地文件路径。
 * @returns 文件名、文本与字节数。
 * @throws {Error} 文件读不出或解析失败时。
 */
export async function readScriptFile(path: string): Promise<ImportedScript> {
  const info = await stat(path).catch(() => undefined)
  if (info === undefined) throw new Error(`读不到文件：${path}`)
  if (!info.isFile()) throw new Error(`${path} 不是一个文件`)
  if (info.size > MAX_IMPORTED_SCRIPT_BYTES) {
    throw new Error(`文件超过 ${Math.round(MAX_IMPORTED_SCRIPT_BYTES / 1024 / 1024)} MB，请先精简后再导入`)
  }
  return extractScriptBytes(path, await readFile(path))
}
