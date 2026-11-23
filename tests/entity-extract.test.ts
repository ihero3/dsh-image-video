/**
 * 剧本实体提取（`B-23`）：提示词与解析的边界。
 *
 * 提示词的分区差异、围栏/废话容错、去重、上限与"没有可用条目"都在这层收口，
 * 宿主只负责调模型。
 */
import { describe, expect, it } from 'vitest'
import { buildExtractPrompt, MAX_EXTRACT_ITEMS, parseExtractItems } from '../src/workbench/entity-extract.ts'

describe('buildExtractPrompt', () => {
  it('按分区给出不同的提取要求，并带上剧本原文', () => {
    const role = buildExtractPrompt('林夏撑伞走来', 'role')
    expect(role).toContain('所有角色')
    expect(role).toContain('林夏撑伞走来')
    expect(role).toContain('JSON')
    expect(buildExtractPrompt('x', 'scene')).toContain('场景与地点')
    expect(buildExtractPrompt('x', 'prop')).toContain('道具与服装')
  })
})

describe('parseExtractItems', () => {
  it('容忍代码块围栏与前后废话，按名称去重', () => {
    const raw = '说明\n```json\n[{"name":"林夏","note":"撑红伞"},{"name":"林夏","note":"二"},{"name":"老周","description":"卖伞"}]\n```\n完'
    expect(parseExtractItems(raw)).toEqual([
      { name: '林夏', note: '撑红伞' },
      { name: '老周', note: '卖伞' },
    ])
  })

  it('丢掉空名与非对象条目，截断到上限', () => {
    const items = Array.from({ length: MAX_EXTRACT_ITEMS + 5 }, (_, index) => ({ name: `角色${index}`, note: '' }))
    const raw = JSON.stringify([null, {}, { name: '  ' }, ...items])
    const parsed = parseExtractItems(raw)
    expect(parsed).toHaveLength(MAX_EXTRACT_ITEMS)
    expect(parsed[0]).toEqual({ name: '角色0', note: '' })
  })

  it('没有数组或没有可用条目时报错', () => {
    expect(() => parseExtractItems('没有 JSON')).toThrow('没有条目')
    expect(() => parseExtractItems('[]')).toThrow('模型没有返回可用的条目')
    expect(() => parseExtractItems('[{"note":"只有说明"}]')).toThrow('模型没有返回可用的条目')
  })
})
