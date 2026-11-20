/**
 * Text-model storyboard planning (B-20): four-step prompts, tolerant parsing,
 * entity-isolated prompts, and single-shot replanning.
 */
import { describe, expect, it } from 'vitest'
import {
  assembleStoryboardShots,
  buildStoryboardStepPrompt,
  parseShotRewrite,
  parseStoryboardDrafts,
  parseStoryboardEntities,
  type StoryboardEntityLibrary,
} from '../src/workbench/storyboard-plan.ts'
import { planStoryboardWithModel, replanStoryboardShot, type StoryboardModelCaller } from '../src/host/storyboard-llm.ts'

const roles = [{ name: '小雨', prompt: '二十岁女孩，短发，黑色风衣' }]
const props = [{ name: '黑伞', prompt: '黑色长柄雨伞，伞骨完好' }]
const scenes = [{ name: '雨夜街头', prompt: '旧城区街道，霓虹反光，深夜小雨' }]

/** 一个按步骤返回固定 JSON 的假调用器（不碰网络）。 */
function fakeCaller(outputs: Record<string, string>): StoryboardModelCaller {
  return async call => {
    const output = outputs[call.step]
    if (output === undefined) throw new Error(`unexpected step ${call.step}`)
    return output
  }
}

describe('storyboard step prompts', () => {
  it('names every extracted entity in the shots step', () => {
    const library: StoryboardEntityLibrary = {
      roles: roles.map(entity => ({ kind: 'role' as const, ...entity })),
      props: props.map(entity => ({ kind: 'prop' as const, ...entity })),
      scenes: scenes.map(entity => ({ kind: 'scene' as const, ...entity })),
    }
    const prompt = buildStoryboardStepPrompt('shots', { script: '小雨撑伞走过街头。', shots: 4, library })
    expect(prompt.input).toContain('小雨')
    expect(prompt.input).toContain('黑伞')
    expect(prompt.input).toContain('雨夜街头')
    expect(prompt.input).toContain('约 4 个分镜')
    expect(prompt.system).toContain('不要重新描述角色长相')
  })

  it('appends the selected skill to the step system prompt', () => {
    const prompt = buildStoryboardStepPrompt('roles', { script: '小雨撑伞走过街头。', skillPrompt: '每个镜头都要有雨水反光。' })
    expect(prompt.system).toContain('每个镜头都要有雨水反光。')
  })

  it('rejects an empty script', () => {
    expect(() => buildStoryboardStepPrompt('roles', { script: '   ' })).toThrow(/剧本不能为空/u)
  })
})

describe('storyboard parsing', () => {
  it('tolerates code fences and adds the isolation constraints', () => {
    const raw = '```json\n[{"name":"小雨","prompt":"二十岁女孩，短发"}]\n```'
    const [entity] = parseStoryboardEntities('roles', raw)
    expect(entity?.name).toBe('小雨')
    expect(entity?.prompt).toContain('纯白背景')
    expect(entity?.prompt).toContain('三视图')
  })

  it('keeps only entity names in shots and drops empty entries', () => {
    const drafts = parseStoryboardDrafts(JSON.stringify([
      { shot: '小雨撑伞回头', roles: ['小雨'], props: ['黑伞'], scene: '雨夜街头', action: '回头', camera: '近景跟拍' },
      { roles: [] },
    ]))
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.action).toBe('回头')
  })

  it('fails loudly when the model returns no usable shots', () => {
    expect(() => parseStoryboardDrafts('抱歉，我无法完成。')).toThrow(/JSON 数组/u)
  })

  it('parses a single rewritten shot object', () => {
    const draft = parseShotRewrite('```json\n{"shot":"小雨停下","roles":["小雨"],"action":"停下","camera":"特写"}\n```')
    expect(draft.shot).toBe('小雨停下')
    expect(draft.camera).toBe('特写')
  })
})

describe('shot assembly', () => {
  it('concatenates entity prompts and never re-describes appearance inline', () => {
    const library: StoryboardEntityLibrary = {
      roles: roles.map(entity => ({ kind: 'role' as const, ...entity })),
      props: props.map(entity => ({ kind: 'prop' as const, ...entity })),
      scenes: scenes.map(entity => ({ kind: 'scene' as const, ...entity })),
    }
    const [shot] = assembleStoryboardShots(library, [{
      shot: '小雨撑伞回头',
      roles: ['小雨'],
      props: ['黑伞'],
      scene: '雨夜街头',
      action: '回头看向镜头',
      camera: '近景跟拍',
    }])
    expect(shot?.imagePrompt).toContain('二十岁女孩')
    expect(shot?.imagePrompt).toContain('黑色长柄雨伞')
    expect(shot?.imagePrompt).toContain('旧城区街道')
    expect(shot?.imagePrompt).toContain('回头看向镜头')
    expect(shot?.videoPrompt).not.toContain('二十岁女孩')
    expect(shot?.characters).toEqual(['小雨'])
    expect(shot?.scene).toBe('雨夜街头')
  })
})

describe('planStoryboardWithModel', () => {
  it('runs the four steps in order and returns an entity library', async () => {
    const steps: string[] = []
    const caller: StoryboardModelCaller = async call => {
      steps.push(call.step)
      const table: Record<string, string> = {
        roles: JSON.stringify(roles),
        props: JSON.stringify(props),
        scenes: JSON.stringify(scenes),
        shots: JSON.stringify([
          { shot: '小雨撑伞走过', roles: ['小雨'], props: ['黑伞'], scene: '雨夜街头', action: '撑伞前行', camera: '中景跟拍' },
        ]),
      }
      const output = table[call.step]
      if (output === undefined) throw new Error('unexpected')
      return output
    }
    const planned = await planStoryboardWithModel(caller, { script: '小雨撑伞走过雨夜街头。' })
    expect(steps).toEqual(['roles', 'props', 'scenes', 'shots'])
    expect(planned.shots).toHaveLength(1)
    expect(planned.library.roles[0]?.name).toBe('小雨')
  })

  it('passes the skill prompt to every step of a model plan', async () => {
    const systems: string[] = []
    const caller: StoryboardModelCaller = async call => {
      systems.push(call.system)
      const table: Record<string, string> = {
        roles: JSON.stringify(roles),
        props: JSON.stringify(props),
        scenes: JSON.stringify(scenes),
        shots: JSON.stringify([
          { shot: '小雨撑伞走过', roles: ['小雨'], props: ['黑伞'], scene: '雨夜街头', action: '撑伞前行', camera: '中景跟拍' },
        ]),
      }
      const output = table[call.step]
      if (output === undefined) throw new Error('unexpected')
      return output
    }
    await planStoryboardWithModel(caller, { script: '小雨撑伞走过雨夜街头。', skillPrompt: '镜头保持冷色调。' })
    expect(systems).toHaveLength(4)
    expect(systems.every(system => system.includes('镜头保持冷色调。'))).toBe(true)
  })

  it('propagates failures so the host can fall back to rules', async () => {
    const caller = fakeCaller({ roles: '[]' })
    await expect(planStoryboardWithModel(caller, { script: '小雨走过。' })).rejects.toThrow(/没有给出可用的角色/u)
  })

  it('keeps untouched shots when replanning a single shot', async () => {
    const library: StoryboardEntityLibrary = {
      roles: roles.map(entity => ({ kind: 'role' as const, ...entity })),
      props: [],
      scenes: scenes.map(entity => ({ kind: 'scene' as const, ...entity })),
    }
    const caller: StoryboardModelCaller = async call => {
      expect(call.step).toBe('rewrite')
      return JSON.stringify({ shot: '重写后的第二镜', roles: ['小雨'], scene: '雨夜街头', action: '停下', camera: '特写' })
    }
    const shots = [
      { index: 1, shot: '第一镜', characters: ['小雨'], scene: '雨夜街头', imagePrompt: 'a', videoPrompt: 'b' },
      { index: 2, shot: '第二镜', characters: ['小雨'], scene: '雨夜街头', imagePrompt: 'c', videoPrompt: 'd' },
      { index: 3, shot: '第三镜', characters: [], imagePrompt: 'e', videoPrompt: 'f' },
    ]
    const next = await replanStoryboardShot(caller, { script: '小雨走过。', library, shots, index: 2 })
    expect(next).toHaveLength(3)
    expect(next[0]?.shot).toBe('第一镜')
    expect(next[1]?.shot).toBe('重写后的第二镜')
    expect(next[2]?.shot).toBe('第三镜')
    expect(next.map(shot => shot.index)).toEqual([1, 2, 3])
  })

  it('rejects an out-of-range shot index', async () => {
    const caller = fakeCaller({ rewrite: '{}' })
    await expect(replanStoryboardShot(caller, { script: '小雨走过。', shots: [], index: 1 })).rejects.toThrow(/找不到第 1 镜/u)
  })
})
