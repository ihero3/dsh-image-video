/**
 * 剧本层级生成（`B-22`）：提示词、模型输出解析与规则回落。
 *
 * 覆盖三个契约：
 * - 提示词把三级数量写明（模型少给时由解析层补齐上限）；
 * - 解析层容忍代码块围栏与非数组字段，逐级封顶，丢弃空项；
 * - 没有模型时按句子数均匀切集、切段，并沿用确定性分镜规则。
 */
import { describe, expect, it } from 'vitest'
import {
  MAX_PLAN_EPISODES, buildEpisodePlanPrompt, parseEpisodePlan, planEpisodesByRules,
  type EpisodePlanRequest,
} from '../src/workbench/episode-plan.ts'

const request: EpisodePlanRequest = {
  script: '第一场 雨夜街头。林夏撑伞走来。第二场 天台。她抬头看霓虹。第三场 地铁。车门关上。',
  brief: '',
  episodes: 1,
  segments: 2,
  shots: 2,
  shotDurationSec: 5,
}

describe('episode plan', () => {
  it('writes the requested scale into the prompt', () => {
    const prompt = buildEpisodePlanPrompt(request)
    expect(prompt).toContain('共 1 集')
    expect(prompt).toContain('每集 2 段')
    expect(prompt).toContain('每段 2 个分镜')
    expect(prompt).toContain('第一场 雨夜街头')
  })

  it('uses the one-line idea when the script is empty', () => {
    const prompt = buildEpisodePlanPrompt({ ...request, script: '', brief: '外卖员卷入一场雨夜追逐' })
    expect(prompt).toContain('一句话创意：外卖员卷入一场雨夜追逐')
  })

  it('parses fenced JSON, caps every level and drops empty entries', () => {
    const raw = [
      '```json',
      JSON.stringify({
        episodes: [
          {
            title: '雨夜',
            script: '第一集正文',
            segments: [
              { promptText: '雨夜街头', shots: [{ shot: '撑伞', imagePrompt: '雨夜', videoPrompt: '走来' }, { shot: '空镜' }, { shot: '只有视频', videoPrompt: '抬头' }] },
              { promptText: '', shots: [{ imagePrompt: '丢弃' }] },
            ],
          },
          { title: '第二集', script: '第二集正文', segments: [{ promptText: '天台', shots: [] }] },
        ],
      }),
      '```',
    ].join('\n')
    const plan = parseEpisodePlan(raw, { ...request, episodes: 1, segments: 2, shots: 3 })
    expect(plan).toHaveLength(1)
    expect(plan[0]!.title).toBe('雨夜')
    expect(plan[0]!.script).toBe('第一集正文')
    expect(plan[0]!.segments).toHaveLength(1)
    // 第二个分镜只给了镜头描述：两条提示词都空，丢弃
    expect(plan[0]!.segments[0]!.shots).toHaveLength(2)
    expect(plan[0]!.segments[0]!.shots[0]!.imagePrompt).toBe('雨夜')
    expect(plan[0]!.segments[0]!.shots[0]!.videoPrompt).toBe('走来')
    // 只给视频提示词时，画面提示词回落到它
    expect(plan[0]!.segments[0]!.shots[1]!.imagePrompt).toBe('抬头')
    expect(plan[0]!.segments[0]!.shots[1]!.videoPrompt).toBe('抬头')
    expect(plan[0]!.segments[0]!.durationSec).toBe(10)
  })

  it('rejects output without a usable episode', () => {
    expect(() => parseEpisodePlan('没有 JSON', request)).toThrow(/没有返回 JSON/)
    expect(() => parseEpisodePlan('{"episodes":[]}', request)).toThrow(/没有可用的集/)
  })

  it('splits a script into the requested episode / segment / shot counts by rules', () => {
    const plan = planEpisodesByRules({ ...request, episodes: 2, segments: 2, shots: 2 })
    expect(plan).toHaveLength(2)
    expect(plan.every(episode => episode.segments.length === 2)).toBe(true)
    expect(plan.every(episode => episode.segments.every(segment => segment.shots.length > 0))).toBe(true)
    expect(plan[0]!.script).not.toBe('')
  })

  it('clamps counts to the declared maxima', () => {
    const plan = planEpisodesByRules({ ...request, episodes: MAX_PLAN_EPISODES + 5, segments: 1, shots: 1 })
    expect(plan).toHaveLength(MAX_PLAN_EPISODES)
  })

  it('refuses an empty script when falling back to rules', () => {
    expect(() => planEpisodesByRules({ ...request, script: '  ' })).toThrow(/剧本不能为空/)
  })

  it('tolerates missing or non-array model fields', () => {
    // episodes 不是数组 → 没有可用集
    expect(() => parseEpisodePlan('{"episodes":"x"}', request)).toThrow(/没有可用的集/)
    // segments 不是数组 → 该集被丢弃
    const noSegments = JSON.stringify({ episodes: [{ script: '正文', segments: 'x' }] })
    expect(() => parseEpisodePlan(noSegments, request)).toThrow(/没有可用的集/)
    // shots 不是数组 → 分段保留但零镜，时长回落到下限
    const plan = parseEpisodePlan(
      JSON.stringify({ episodes: [{ script: '', segments: [{ promptText: '街口', shots: 'x' }] }] }),
      request,
    )
    expect(plan[0]!.segments[0]!.shots).toEqual([])
    expect(plan[0]!.segments[0]!.durationSec).toBe(1)
    // 缺标题按空串
    expect(plan[0]!.title).toBe('')
  })

  it('caps segment duration at 60 seconds and clamps non-finite counts', () => {
    const shots = Array.from({ length: 20 }, (_, index) => ({ imagePrompt: `镜${index}` }))
    const plan = parseEpisodePlan(
      JSON.stringify({ episodes: [{ segments: [{ promptText: '长段', shots }] }] }),
      { ...request, shots: 20, shotDurationSec: 10 },
    )
    expect(plan[0]!.segments[0]!.shots).toHaveLength(20)
    expect(plan[0]!.segments[0]!.durationSec).toBe(60)

    const clamped = planEpisodesByRules({
      ...request, episodes: Number.NaN, segments: Number.POSITIVE_INFINITY, shots: Number.NaN,
    })
    expect(clamped).toHaveLength(1)
    expect(clamped[0]!.segments.length).toBeGreaterThan(0)
  })

  it('recycles sentences when there are more episodes than sentences', () => {
    const plan = planEpisodesByRules({ ...request, script: '只有一句。', episodes: 3, segments: 2, shots: 1 })
    expect(plan).toHaveLength(3)
    expect(plan.every(episode => episode.script === '只有一句')).toBe(true)
    expect(plan.every(episode => episode.segments.length === 2)).toBe(true)
  })
})
