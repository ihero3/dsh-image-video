/**
 * 从 ComfyUI / LiblibAI 出图的 PNG 文本块里提取工作流 JSON。
 * 测试手工构造最小 PNG（不校验 CRC，解析器也不依赖它）。
 */
import { describe, expect, it } from 'vitest'
import { readWorkflowFromImage } from '../src/client/image-workflow.ts'

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

function u32(value: number): number[] {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]
}

function chunk(type: string, data: number[]): number[] {
  return [...u32(data.length), ...[...type].map(char => char.charCodeAt(0)), ...data, 0, 0, 0, 0]
}

function png(blocks: number[][]): Uint8Array {
  return new Uint8Array([...SIGNATURE, ...blocks.flat()])
}

function textBlock(keyword: string, text: string): number[] {
  return chunk('tEXt', [...[...keyword].map(char => char.charCodeAt(0)), 0, ...[...text].map(char => char.charCodeAt(0))])
}

const workflow = '{"nodes":[{"id":"1","type":"KSampler","pos":[0,0],"widgets_values":[]}],"links":[]}'

describe('image-workflow', () => {
  it('extracts a workflow stored in a PNG tEXt block', () => {
    const bytes = png([
      chunk('IHDR', u32(1).concat(u32(1))),
      textBlock('workflow', workflow),
      chunk('IEND', []),
    ])
    expect(readWorkflowFromImage(bytes)).toBe(workflow)
  })

  it('recognizes the prompt key and ignores unrelated text blocks', () => {
    const bytes = png([
      textBlock('Comment', 'hello'),
      textBlock('prompt', '{"6":{"class_type":"CLIPTextEncode","inputs":{}}}'),
    ])
    expect(readWorkflowFromImage(bytes)).toContain('CLIPTextEncode')
  })

  it('returns undefined for non-PNG bytes or images without workflow metadata', () => {
    expect(readWorkflowFromImage(new Uint8Array([1, 2, 3]))).toBeUndefined()
    expect(readWorkflowFromImage(png([textBlock('Comment', workflow)]))).toBeUndefined()
  })

  it('reads uncompressed iTXt workflow blocks', () => {
    const keyword = [...'workflow'].map(char => char.charCodeAt(0))
    const payload = [...keyword, 0, 0, 0, ...[..."en"].map(char => char.charCodeAt(0)), 0, 0,
      ...[...workflow].map(char => char.charCodeAt(0))]
    expect(readWorkflowFromImage(png([chunk('iTXt', payload)]))).toBe(workflow)
  })
})
