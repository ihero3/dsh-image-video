import { describe, expect, it } from 'vitest'
import type { SkillRecord } from '../src/workbench/skills.ts'
import { activeSkillId, insertSkillToken, removeSkillToken, stripSkillTokens } from '../src/client/skill-tokens.tsx'

const skill = (id: string, name: string): SkillRecord => ({
  schemaVersion: 1, id, kind: 'director', name, description: '', prompt: 'prompt',
  builtin: false, enabled: true, createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z',
})

describe('Skill token 交互', () => {
  const skills = [skill('skl-1', '电影感分镜'), skill('skl-2', '写实广告')]

  it('选中时把可读 token 追加插入文本，多个技能可共存', () => {
    const withFirst = insertSkillToken('开场', skills[0]!, skills)
    expect(withFirst).toBe('开场 【@电影感分镜】')
    const withSecond = insertSkillToken(withFirst, skills[1]!, skills)
    expect(withSecond).toBe('开场 【@电影感分镜】 【@写实广告】')
    // 单 Skill 口沿用第一个生效的技能
    expect(activeSkillId(withSecond, skills)).toBe('skl-1')
    // 重复选同一个不会插入第二份
    expect(insertSkillToken(withSecond, skills[1]!, skills)).toBe(withSecond)
  })

  it('删掉某一个 token 后该技能回到未选状态，其他技能保留，正文不残留技能标记', () => {
    const text = insertSkillToken(insertSkillToken('开场', skills[0]!, skills), skills[1]!, skills)
    expect(removeSkillToken(text, skills[0]!)).toBe('开场 【@写实广告】')
    expect(activeSkillId(removeSkillToken(text, skills[0]!), skills)).toBe('skl-2')
    const textWithSecondOnly = removeSkillToken(text, skills[0]!)
    expect(removeSkillToken(textWithSecondOnly, skills[1]!)).toBe('开场')
    expect(activeSkillId(removeSkillToken(textWithSecondOnly, skills[1]!), skills)).toBe('')
    expect(stripSkillTokens(`${text}\n\n第二场`, skills)).toBe('开场\n\n第二场')
  })
})
