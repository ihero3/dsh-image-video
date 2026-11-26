/**
 * 画布侧纯函数（自动排列 / 节点库检索）。
 *
 * 这些逻辑决定"一眼看到的图是不是像一条流水线"，但依赖 DOM 的交互测试覆盖不了，
 * 所以单独按纯函数测：深度分列、同列保序、菱形依赖、环、检索分词。
 */
import { describe, expect, it } from 'vitest'
import { LAYOUT_COLUMN_GAP, LAYOUT_PAD, LAYOUT_ROW_GAP, autoLayout, filterItems } from '../src/client/workflow-layout.ts'

const node = (id: string, x = 0, y = 0) => ({ id, position: { x, y } })
const edge = (source: string, target: string) => ({ source, target })

describe('autoLayout', () => {
  it('puts a chain in one row, left to right by depth', () => {
    const positions = autoLayout(
      [node('a'), node('b'), node('c')],
      [edge('a', 'b'), edge('b', 'c')],
    )
    expect(positions.get('a')).toEqual({ x: LAYOUT_PAD, y: LAYOUT_PAD })
    expect(positions.get('b')).toEqual({ x: LAYOUT_PAD + LAYOUT_COLUMN_GAP, y: LAYOUT_PAD })
    expect(positions.get('c')).toEqual({ x: LAYOUT_PAD + LAYOUT_COLUMN_GAP * 2, y: LAYOUT_PAD })
  })

  it('stacks siblings in the same column and keeps the user ordering', () => {
    const positions = autoLayout(
      // 第二个节点原本在上方：排版后仍在上方
      [node('root', 0, 0), node('low', 0, 300), node('high', 0, 40)],
      [edge('root', 'low'), edge('root', 'high')],
    )
    const high = positions.get('high')!
    const low = positions.get('low')!
    expect(high.x).toBe(low.x)
    expect(high.y).toBe(LAYOUT_PAD)
    expect(low.y).toBe(LAYOUT_PAD + LAYOUT_ROW_GAP)
  })

  it('uses the longest path so a diamond does not collapse into one column', () => {
    const positions = autoLayout(
      [node('a'), node('b'), node('c'), node('d')],
      [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')],
    )
    // d 要等 b、c 都跑完：至少在第 2 列，不能和 b / c 挤在一起
    expect(positions.get('d')!.x).toBe(LAYOUT_PAD + LAYOUT_COLUMN_GAP * 2)
  })

  it('does not throw on a cycle and still places every node', () => {
    const positions = autoLayout(
      [node('a'), node('b'), node('c')],
      [edge('a', 'b'), edge('b', 'a'), edge('b', 'c')],
    )
    expect(positions.size).toBe(3)
    for (const id of ['a', 'b', 'c']) expect(positions.get(id)).toBeDefined()
  })

  it('ignores edges that reference missing nodes', () => {
    const positions = autoLayout([node('a'), node('b')], [edge('a', 'ghost'), edge('ghost', 'b')])
    expect(positions.get('a')).toEqual({ x: LAYOUT_PAD, y: LAYOUT_PAD })
    expect(positions.get('b')).toEqual({ x: LAYOUT_PAD, y: LAYOUT_PAD + LAYOUT_ROW_GAP })
  })
})

describe('filterItems', () => {
  const items = [
    { kind: 'video-generate', label: '视频生成' },
    { kind: 'image-generate', label: '图片生成' },
    { kind: 'script', label: '脚本' },
  ]

  it('returns everything for a blank query', () => {
    expect(filterItems(items, '   ')).toHaveLength(3)
  })

  it('matches the localized name and the kind id, case-insensitively', () => {
    expect(filterItems(items, '视频').map(item => item.kind)).toEqual(['video-generate'])
    expect(filterItems(items, 'VIDEO').map(item => item.kind)).toEqual(['video-generate'])
    expect(filterItems(items, 'script').map(item => item.kind)).toEqual(['script'])
  })

  it('requires every whitespace-separated token to match', () => {
    expect(filterItems(items, '视频 generate').map(item => item.kind)).toEqual(['video-generate'])
    expect(filterItems(items, '视频 image')).toEqual([])
  })

  it('returns nothing rather than everything for a miss', () => {
    expect(filterItems(items, '不存在的节点')).toEqual([])
  })
})
