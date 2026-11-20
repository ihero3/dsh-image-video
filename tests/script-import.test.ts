/**
 * Script file import (B-20): txt / md / docx / pdf parsing and honest failures.
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractDocxText, extractPdfText, readScriptFile } from '../src/host/script-import.ts'

/**
 * 造一个只有单个「存储模式」条目的 zip（docx 的最小可读形态）。
 * @param name - 条目名。
 * @param content - 条目内容。
 * @returns zip 字节。
 */
function storedZip(name: string, content: Buffer): Buffer {
  const nameBytes = Buffer.from(name, 'utf8')
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt32LE(0, 10)
  header.writeUInt32LE(0, 14)
  header.writeUInt32LE(content.length, 18)
  header.writeUInt32LE(content.length, 22)
  header.writeUInt16LE(nameBytes.length, 26)
  header.writeUInt16LE(0, 28)
  return Buffer.concat([header, nameBytes, content])
}

/** 临时目录里落一个文件并返回路径。 */
async function tempFile(name: string, content: Buffer | string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'iv-script-'))
  const path = join(dir, name)
  await writeFile(path, content)
  return path
}

describe('extractDocxText', () => {
  it('keeps paragraph breaks and decodes entities', () => {
    const xml = [
      '<w:document><w:body>',
      '<w:p><w:r><w:t>第一幕</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>小雨 &amp; 黑伞</w:t></w:r></w:p>',
      '</w:body></w:document>',
    ].join('')
    const text = extractDocxText(xml)
    expect(text).toContain('第一幕\n')
    expect(text).toContain('小雨 & 黑伞')
  })
})

/**
 * 造一个结构完整（含 xref）的单页 PDF——解析器不吃「看起来像 PDF」的假文件。
 * @param content - 页面内容流。
 * @returns PDF 字节。
 */
function buildPdf(content: string): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

describe('extractPdfText', () => {
  it('reads text from a PDF content stream', async () => {
    const pdf = buildPdf('BT /F1 12 Tf 20 100 Td (Act one: rainy street at midnight) Tj ET')
    expect(await extractPdfText(pdf)).toContain('Act one: rainy street')
  })

  it('returns nothing for a page without text operators', async () => {
    expect(await extractPdfText(buildPdf('q Q'))).toBe('')
  })
})

describe('readScriptFile', () => {
  it('reads a plain text script and strips the BOM', async () => {
    const path = await tempFile('episode.txt', '\uFEFF小雨撑着黑伞。\n远处霓虹闪烁。')
    const imported = await readScriptFile(path)
    expect(imported.fileName).toBe('episode.txt')
    expect(imported.text.startsWith('小雨')).toBe(true)
    expect(imported.bytes).toBeGreaterThan(0)
  })

  it('reads a docx body from the zip container', async () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>小雨推开旧楼的门</w:t></w:r></w:p></w:body></w:document>'
    const path = await tempFile('episode.docx', storedZip('word/document.xml', Buffer.from(xml, 'utf8')))
    const imported = await readScriptFile(path)
    expect(imported.text).toContain('小雨推开旧楼的门')
  })

  it('rejects an unsupported extension', async () => {
    const path = await tempFile('episode.rtf', 'hello')
    await expect(readScriptFile(path)).rejects.toThrow(/不支持的文件类型/u)
  })

  it('rejects a pdf without readable text instead of returning garbage', async () => {
    const path = await tempFile('scan.pdf', buildPdf('q Q'))
    await expect(readScriptFile(path)).rejects.toThrow(/提取不到可读文字/u)
  })

  it('rejects a broken pdf with an actionable message', async () => {
    const path = await tempFile('broken.pdf', 'not a pdf at all')
    await expect(readScriptFile(path)).rejects.toThrow(/解析失败/u)
  })

  it('rejects an empty document', async () => {
    const path = await tempFile('empty.md', '   \n\n  ')
    await expect(readScriptFile(path)).rejects.toThrow(/没有可读的文字/u)
  })
})
