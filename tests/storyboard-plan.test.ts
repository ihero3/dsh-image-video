/** Storyboard planning (A-7): deterministic, honest split of a script into shots. */
import { describe, expect, it } from 'vitest'
import { planStoryboard } from '../src/workbench/storyboard.ts'

const resources = [
  { id: 'r1', kind: 'role', name: '小雨' },
  { id: 'r2', kind: 'scene', name: '雨夜街头' },
  { id: 'r3', kind: 'prop', name: '黑伞' },
]

describe('planStoryboard', () => {
  it('splits a script into shots with prompts', () => {
    const { shots } = planStoryboard({ script: '小雨站在雨夜街头。她撑开黑伞。远处霓虹闪烁。', resources })
    expect(shots).toHaveLength(3)
    expect(shots[0]!.index).toBe(1)
    expect(shots[0]!.characters).toContain('小雨')
    expect(shots[0]!.scene).toBe('雨夜街头')
    expect(shots.every(shot => shot.imagePrompt.trim() !== '' && shot.videoPrompt.trim() !== '')).toBe(true)
  })

  it('honours a requested shot count and caps it at the sentence count', () => {
    const { shots } = planStoryboard({ script: '第一句。第二句。', shots: 5 })
    expect(shots).toHaveLength(2)
  })

  it('reports which resources were referenced', () => {
    const { referencedResourceIds } = planStoryboard({ script: '小雨在雨夜街头撑开黑伞。', resources })
    expect(referencedResourceIds).toContain('r1')
    expect(referencedResourceIds).toContain('r2')
    expect(referencedResourceIds).toContain('r3')
  })

  it('rejects an empty script instead of inventing shots', () => {
    expect(() => planStoryboard({ script: '   ' })).toThrow('剧本不能为空')
  })
})
