/**
 * 剧本自动拆段：提示词构造与模型输出解析。
 *
 * 解析要容忍模型常见的"代码块 + 前后缀说明"，同时把不合法的分段丢掉，
 * 不能把整段不可用的输出写进集记录。
 */
import { describe, expect, it } from 'vitest'
import {
  buildSplitInput, MAX_SPLIT_SCRIPT_CHARS, parseSplitProposals,
} from '../src/workbench/script-split.ts'

describe('script split', () => {
  it('builds the user message and refuses empty or oversized scripts', () => {
    expect(buildSplitInput('  第一场  ')).toContain('第一场')
    expect(() => buildSplitInput('   ')).toThrow(/剧本为空/)
    expect(() => buildSplitInput('字'.repeat(MAX_SPLIT_SCRIPT_CHARS + 1))).toThrow(/超过/)
  })

  it('parses a JSON array wrapped in a markdown fence and prose', () => {
    const raw = '好的，拆分如下：\n```json\n[{"promptText":"雨夜街头，主角回头","durationSec":8},{"promptText":"清晨客厅"}]\n```\n以上。'
    expect(parseSplitProposals(raw)).toEqual([
      { promptText: '雨夜街头，主角回头', durationSec: 8 },
      { promptText: '清晨客厅' },
    ])
  })

  it('drops entries without a prompt and clamps out-of-range durations', () => {
    const raw = '[{"promptText":"  "},{"promptText":"短","durationSec":0},{"promptText":"长","durationSec":9999},{"nope":1}]'
    expect(parseSplitProposals(raw)).toEqual([
      { promptText: '短' },
      { promptText: '长', durationSec: 60 },
    ])
  })

  it('reports unusable model output instead of inventing segments', () => {
    expect(() => parseSplitProposals('没有 JSON')).toThrow(/JSON 数组/)
    expect(() => parseSplitProposals('[{"promptText":}]')).toThrow(/不是合法 JSON/)
    expect(() => parseSplitProposals('[1,2]')).toThrow(/没有给出可用的分段/)
    expect(() => parseSplitProposals('[]')).toThrow(/没有给出可用的分段/)
  })
})
