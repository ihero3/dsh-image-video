/**
 * 文本模型版分镜拆解的宿主编排（`B-20`）。
 *
 * 领域侧（`workbench/storyboard-plan.ts`）只负责提示词与解析；本模块负责**按顺序调用**
 * 四步（角色 → 道具 → 场景 → 分镜），并把「调用方式」抽象成一个最小函数接口 ——
 * 这样单测能用一个假调用器把整条链路跑通，不必碰真实模型服务。
 *
 * @module dsh-image-video/host/storyboard-llm
 */

import type { StoryboardShot } from '../workbench/storyboard.ts'
import {
  assembleStoryboardShots,
  buildShotRewritePrompt,
  buildStoryboardStepPrompt,
  parseShotRewrite,
  parseStoryboardDrafts,
  parseStoryboardEntities,
  STORYBOARD_STEPS,
  type StoryboardEntityLibrary,
  type StoryboardShotDraft,
  type StoryboardStep,
} from '../workbench/storyboard-plan.ts'

/** 一次模型调用请求。 */
export interface StoryboardModelCall {
  /** 步骤标签（`roles` / `props` / `scenes` / `shots` / `rewrite`）：只用于错误信息。 */
  readonly step: StoryboardStep | 'rewrite'
  readonly system: string
  readonly input: string
  readonly signal?: AbortSignal
}

/**
 * 模型调用器：输入提示词，返回模型文本输出。
 * 宿主侧实现见 `host/rpc.ts`（`dsh-llm` 的 `prepareCall` + `stream`）。
 */
export type StoryboardModelCaller = (call: StoryboardModelCall) => Promise<string>

/** 一次模型拆解的完整产物。 */
export interface ModelStoryboardPlan {
  readonly shots: StoryboardShot[]
  /** 三类实体：界面可展示/复用，局部重拆时原样回传。 */
  readonly library: StoryboardEntityLibrary
}

/**
 * 仅凭提示词拆解时，重拆某一镜所需的「当前镜头草案」。
 * 分镜表里只有成品提示词，没有动作/镜头拆分，所以这里从成品里还原可用的部分。
 * @param shot - 已成形的分镜。
 * @returns 供改写提示词使用的草案（动作与镜头用整段视频提示词兜底）。
 */
function draftOf(shot: StoryboardShot): StoryboardShotDraft {
  return {
    shot: shot.shot,
    roles: [...shot.characters],
    props: [],
    ...shot.scene === undefined ? {} : { scene: shot.scene },
    action: shot.videoPrompt,
    camera: '沿用原镜头',
  }
}

/**
 * 用文本模型完成四步拆解。
 * @param caller - 模型调用器。
 * @param input - 剧本、目标镜数、选中的导演技能与取消信号。
 * @returns 分镜表与实体库。
 * @throws {Error} 任一步模型调用失败或输出无法解析时（由调用方决定回落）。
 */
export async function planStoryboardWithModel(
  caller: StoryboardModelCaller,
  input: {
    readonly script: string
    readonly shots?: number
    readonly signal?: AbortSignal
    /** 选中的导演技能正文：追加到每一步的系统提示。 */
    readonly skillPrompt?: string
  },
): Promise<ModelStoryboardPlan> {
  let library: StoryboardEntityLibrary = { roles: [], props: [], scenes: [] }
  for (const step of STORYBOARD_STEPS) {
    const prompt = buildStoryboardStepPrompt(step, {
      script: input.script,
      ...input.shots === undefined ? {} : { shots: input.shots },
      library,
      ...input.skillPrompt === undefined ? {} : { skillPrompt: input.skillPrompt },
    })
    const raw = await caller({
      step,
      system: prompt.system,
      input: prompt.input,
      ...input.signal === undefined ? {} : { signal: input.signal },
    })
    if (step === 'roles') library = { ...library, roles: parseStoryboardEntities('roles', raw) }
    else if (step === 'props') library = { ...library, props: parseStoryboardEntities('props', raw) }
    else if (step === 'scenes') library = { ...library, scenes: parseStoryboardEntities('scenes', raw) }
    else {
      const shots = assembleStoryboardShots(library, parseStoryboardDrafts(raw))
      if (shots.length === 0) throw new Error('模型没有给出可用的分镜')
      return { shots, library }
    }
  }
  throw new Error('模型拆解没有产出分镜')
}

/**
 * 局部重拆：只让模型重写指定的某一镜，其余镜头保持原样。
 * @param caller - 模型调用器。
 * @param input - 剧本、实体库、当前分镜表、要重写的镜号（1-based）与取消信号。
 * @returns 新的分镜表（镜号连续，未重写的镜头原样保留）。
 * @throws {Error} 镜号不存在、模型调用失败或输出无法解析时。
 */
export async function replanStoryboardShot(
  caller: StoryboardModelCaller,
  input: {
    readonly script: string
    readonly library?: StoryboardEntityLibrary
    readonly shots: readonly StoryboardShot[]
    readonly index: number
    readonly signal?: AbortSignal
    /** 选中的导演技能正文：追加到重写提示的系统提示。 */
    readonly skillPrompt?: string
  },
): Promise<StoryboardShot[]> {
  const position = input.shots.findIndex(shot => shot.index === input.index)
  if (position < 0) throw new Error(`找不到第 ${input.index} 镜，无法重拆`)
  const current = draftOf(input.shots[position]!)
  const prompt = buildShotRewritePrompt({
    script: input.script,
    ...input.library === undefined ? {} : { library: input.library },
    current,
    ...input.shots[position - 1] === undefined ? {} : { before: input.shots[position - 1]!.shot },
    ...input.shots[position + 1] === undefined ? {} : { after: input.shots[position + 1]!.shot },
    ...input.skillPrompt === undefined ? {} : { skillPrompt: input.skillPrompt },
  })
  const raw = await caller({
    step: 'rewrite',
    system: prompt.system,
    input: prompt.input,
    ...input.signal === undefined ? {} : { signal: input.signal },
  })
  const rewritten = assembleStoryboardShots(
    input.library ?? { roles: [], props: [], scenes: [] },
    [parseShotRewrite(raw)],
  )[0]
  if (rewritten === undefined) throw new Error('模型没有给出可用的镜头')
  const shots = [...input.shots]
  shots[position] = { ...rewritten, index: input.index }
  return shots.map((shot, index) => ({ ...shot, index: index + 1 }))
}
