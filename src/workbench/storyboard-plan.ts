/**
 * 剧本 → 视觉资产 → 分镜：文本模型版拆解（`B-20`）。
 *
 * 设计口径（与产品约定一致）：
 * - **分步拆解**：角色 / 道具 / 场景 / 分镜四次独立调用，每次只吃固定 JSON Schema，
 *   不指望一次调用把所有实体吐全；
 * - **实体隔离**：角色、道具、场景各自先得到一条**独立提示词**（纯白背景 / 空镜约束写死在
 *   代码里），分镜阶段只**按名字引用**实体，由本模块把实体提示词拼进画面提示词 —— 模型在分镜里
 *   重新描写长相，是画面穿帮的主要来源；
 * - **纯函数 + 容错解析**：模型输出可能带代码块围栏、多余说明、字段缺失；这里只取能用的部分，
 *   解析不出任何可用实体时如实抛错，由宿主回落到规则拆解（`planStoryboard`）。
 *
 * 本模块不碰网络与存储：调用与落库在 `host/storyboard-llm.ts` 与 RPC 层。
 *
 * @module dsh-image-video/workbench/storyboard-plan
 */

import type { StoryboardShot } from './storyboard.ts'

/** 分镜上限：与画布规模上限一致（每镜最多 2 个节点）。 */
export const MAX_STORYBOARD_SHOTS = 60

/** 送入模型的剧本正文上限（字符）：超出直接拒绝，不静默截断。 */
export const MAX_STORYBOARD_SCRIPT_CHARS = 20_000

/** 拆解步骤，按依赖顺序执行。 */
export type StoryboardStep = 'roles' | 'props' | 'scenes' | 'shots'

/** 四步的执行顺序：分镜必须在三类实体之后。 */
export const STORYBOARD_STEPS: readonly StoryboardStep[] = ['roles', 'props', 'scenes', 'shots']

/** 一条实体（角色 / 道具 / 场景）及其独立的生成提示词。 */
export interface StoryboardEntity {
  readonly kind: 'role' | 'prop' | 'scene'
  /** 实体名：分镜阶段只引用它，不重复描述外观。 */
  readonly name: string
  /** 该实体的独立提示词（已含隔离约束）。 */
  readonly prompt: string
}

/** 实体库：四步拆解里前三步的产物。 */
export interface StoryboardEntityLibrary {
  readonly roles: readonly StoryboardEntity[]
  readonly props: readonly StoryboardEntity[]
  readonly scenes: readonly StoryboardEntity[]
}

/** 模型给出的一镜草案：只引用实体名，不重复外观描述。 */
export interface StoryboardShotDraft {
  readonly shot: string
  readonly roles: readonly string[]
  readonly props: readonly string[]
  readonly scene?: string
  readonly action: string
  readonly camera: string
}

/** 角色提示词的固定约束（实体隔离）：不写场景、不写动作，只保证定妆一致。 */
const ROLE_CONSTRAINT = '，Netflix 剧集质感，纯白背景，画面左侧为角色正面全脸特写，'
  + '右侧为同一角色的正面、侧面、背面三视图，五官与服装一致，不出现场景、道具与其他人物'

/** 道具提示词的固定约束：纯白背景独立呈现。 */
const PROP_CONSTRAINT = '，纯白背景独立呈现，产品级柔光与清晰边缘，不出现场景、人物与其他道具'

/** 场景提示词的固定约束：电影质感空镜。 */
const SCENE_CONSTRAINT = '，电影质感空镜，不出现人物与主要道具，交代空间结构、光线方向与时间氛围'

/** 画面提示词的固定收尾：统一构图与一致性口径。 */
const IMAGE_SUFFIX = '电影感构图，主体清晰，光影统一，人物外观与角色定妆一致，避免穿帮'

/** 视频提示词的固定收尾：只写运动与连续性，不重复外观。 */
const VIDEO_SUFFIX = '镜头运动克制，画面连贯，人物外观与首帧一致'

/** 各步骤的系统提示（写死，不让模型自由发挥格式）。 */
const STEP_SYSTEM: Readonly<Record<StoryboardStep, string>> = {
  roles: [
    '你是短剧与短视频的前期美术。第一步：从剧本里抽取所有需要出场的角色（人名或固定称谓）。',
    '为每个角色写一条可直接用于生图的「角色定妆提示词」：只描述角色本身（年龄、性别、脸型、发型、服装、气质），',
    '不要写场景、动作、剧情与镜头。',
    '只输出 JSON 数组，不要 Markdown 代码块，不要任何前后缀文字。格式：',
    '[{"name":"角色名","prompt":"角色定妆提示词"}]',
  ].join('\n'),
  props: [
    '你是短剧与短视频的前期美术。第二步：从剧本里抽取所有需要单独出图的道具（关键物件、信件、武器、道具设备等）。',
    '为每个道具写一条可直接用于生图的「道具提示词」：只描述道具本身（材质、颜色、形态、细节与做工），不要写场景与人物。',
    '只输出 JSON 数组，不要 Markdown 代码块，不要任何前后缀文字。格式：',
    '[{"name":"道具名","prompt":"道具提示词"}]',
  ].join('\n'),
  scenes: [
    '你是短剧与短视频的前期美术。第三步：从剧本里抽取所有需要单独出图的场景（地点 + 时间/氛围）。',
    '为每个场景写一条可直接用于生图的「场景提示词」：只描述空间、陈设、光线与时间氛围，不要写人物与主要道具。',
    '只输出 JSON 数组，不要 Markdown 代码块，不要任何前后缀文字。格式：',
    '[{"name":"场景名","prompt":"场景提示词"}]',
  ].join('\n'),
  shots: [
    '你是短剧与短视频的分镜师。第四步：基于已确定的角色、道具、场景，把剧本拆成按剧情顺序排列的分镜。',
    '每个分镜要能单独生成 5–30 秒的画面：写清动作与表情、景别与运镜。',
    'roles / props / scene 只能引用给定名单里的名字，不要重新描述角色长相、服装或场景细节（那会导致画面穿帮）。',
    '只输出 JSON 数组，不要 Markdown 代码块，不要任何前后缀文字。格式：',
    '[{"shot":"镜头一句话描述","roles":["角色名"],"props":["道具名"],"scene":"场景名","action":"动作与表情","camera":"景别与运镜"}]',
  ].join('\n'),
}

/**
 * 规范剧本正文：去首尾空白并校验长度。
 * @param script - 剧本正文。
 * @returns 可送入模型的正文。
 * @throws {Error} 正文为空或超过 {@link MAX_STORYBOARD_SCRIPT_CHARS} 时。
 */
export function normalizeStoryboardScript(script: string): string {
  const text = script.trim()
  if (text === '') throw new Error('剧本不能为空：至少需要一句话')
  if (text.length > MAX_STORYBOARD_SCRIPT_CHARS) {
    throw new Error(`剧本超过 ${MAX_STORYBOARD_SCRIPT_CHARS} 字，请先分段再拆解`)
  }
  return text
}

/** 一款拆解步骤的输入：剧本 + 目标镜数 + 已确定的实体库。 */
export interface StoryboardStepInput {
  readonly script: string
  /** 目标分镜数；缺省由模型按剧情决定。 */
  readonly shots?: number
  /** 前三步产出的实体库（`shots` 步骤用）。 */
  readonly library?: StoryboardEntityLibrary
  /** 选中的导演技能正文：追加到系统提示末尾，用于约束拆解口径。 */
  readonly skillPrompt?: string
}

/**
 * 把技能正文追加到系统提示末尾（技能叠加在内置导演口径之上）。
 * @param system - 步骤自带系统提示。
 * @param skillPrompt - 技能正文；空串或缺省时原样返回。
 * @returns 合并后的系统提示。
 */
function withSkill(system: string, skillPrompt?: string): string {
  const skill = (skillPrompt ?? '').trim()
  if (skill === '') return system
  return `${system}\n\n本次拆解还必须遵守下面的技能要求：\n${skill}`
}

/**
 * 构造某一步的系统提示与用户输入。
 * @param step - 拆解步骤。
 * @param input - 剧本、目标镜数与已确定的实体库。
 * @returns 该步的系统提示与用户消息正文。
 */
export function buildStoryboardStepPrompt(
  step: StoryboardStep,
  input: StoryboardStepInput,
): { readonly system: string; readonly input: string } {
  const script = normalizeStoryboardScript(input.script)
  if (step !== 'shots') {
    return { system: withSkill(STEP_SYSTEM[step], input.skillPrompt), input: `剧本：\n\n${script}` }
  }
  const library = input.library ?? { roles: [], props: [], scenes: [] }
  const names = (entities: readonly StoryboardEntity[]): string =>
    entities.length === 0 ? '（无）' : entities.map(entity => entity.name).join('、')
  const target = input.shots === undefined
    ? ''
    : `\n请拆成约 ${Math.min(MAX_STORYBOARD_SHOTS, Math.max(1, Math.round(input.shots)))} 个分镜。`
  return {
    system: withSkill(STEP_SYSTEM.shots, input.skillPrompt),
    input: [
      `剧本：\n\n${script}`,
      '',
      `角色：${names(library.roles)}`,
      `道具：${names(library.props)}`,
      `场景：${names(library.scenes)}`,
      target,
    ].join('\n'),
  }
}

/**
 * 从模型输出里取出 JSON 数组（容忍代码块围栏与前后缀说明）。
 * @param raw - 模型原始文本。
 * @returns 解析出的数组。
 * @throws {Error} 找不到数组或 JSON 不合法时。
 */
function parseArray(raw: string): unknown[] {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON 数组')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch (error) {
    throw new Error(`模型返回的不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Array.isArray(parsed)) throw new Error('模型返回的不是 JSON 数组')
  return parsed
}

/** 字符串字段取值：非空字符串才可用。 */
function readText(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text === '' ? undefined : text
}

/** 字符串数组字段取值：过滤空项并去重。 */
function readNames(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (!Array.isArray(value)) return []
  const names = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map(entry => entry.trim())
    .filter(entry => entry !== '')
  return [...new Set(names)]
}

/**
 * 解析实体步骤（角色 / 道具 / 场景）的输出。
 * @param step - `roles` / `props` / `scenes`。
 * @param raw - 模型原始文本。
 * @returns 带隔离约束的实体列表（最多 60 条）。
 * @throws {Error} 没有任何合法实体时。
 */
export function parseStoryboardEntities(
  step: 'roles' | 'props' | 'scenes',
  raw: string,
): StoryboardEntity[] {
  const kind = step === 'roles' ? 'role' : step === 'props' ? 'prop' : 'scene'
  const constraint = step === 'roles' ? ROLE_CONSTRAINT : step === 'props' ? PROP_CONSTRAINT : SCENE_CONSTRAINT
  const entities: StoryboardEntity[] = []
  const seen = new Set<string>()
  for (const entry of parseArray(raw).slice(0, 60)) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const name = readText(record, 'name')
    const prompt = readText(record, 'prompt')
    if (name === undefined || prompt === undefined || seen.has(name)) continue
    seen.add(name)
    entities.push({ kind, name, prompt: `${prompt}${constraint}` })
  }
  if (entities.length === 0) throw new Error(`模型没有给出可用的${step === 'roles' ? '角色' : step === 'props' ? '道具' : '场景'}`)
  return entities
}

/**
 * 解析分镜步骤的输出。
 * @param raw - 模型原始文本。
 * @returns 镜头草案（最多 {@link MAX_STORYBOARD_SHOTS} 条，`shot` 为空的条目丢弃）。
 * @throws {Error} 没有任何合法分镜时。
 */
export function parseStoryboardDrafts(raw: string): StoryboardShotDraft[] {
  const drafts: StoryboardShotDraft[] = []
  for (const entry of parseArray(raw).slice(0, MAX_STORYBOARD_SHOTS)) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const shot = readText(record, 'shot')
    if (shot === undefined) continue
    drafts.push({
      shot,
      roles: readNames(record, 'roles'),
      props: readNames(record, 'props'),
      ...readText(record, 'scene') === undefined ? {} : { scene: readText(record, 'scene') as string },
      action: readText(record, 'action') ?? shot,
      camera: readText(record, 'camera') ?? '中景，固定机位',
    })
  }
  if (drafts.length === 0) throw new Error('模型没有给出可用的分镜')
  return drafts
}

/**
 * 单镜重写的系统提示：只改这一镜，其余镜头不动（局部重拆）。
 * @param input - 剧本、实体库、待改写的镜头与前后镜描述。
 * @returns 系统提示与用户消息正文。
 */
export function buildShotRewritePrompt(input: {
  readonly script: string
  readonly library?: StoryboardEntityLibrary
  readonly current: StoryboardShotDraft
  readonly before?: string
  readonly after?: string
  /** 选中的导演技能正文：追加到系统提示末尾。 */
  readonly skillPrompt?: string
}): { readonly system: string; readonly input: string } {
  const script = normalizeStoryboardScript(input.script)
  const library = input.library ?? { roles: [], props: [], scenes: [] }
  const names = (entities: readonly StoryboardEntity[]): string =>
    entities.length === 0 ? '（无）' : entities.map(entity => entity.name).join('、')
  return {
    system: withSkill([
      '你是短剧与短视频的分镜师。只重写指定的**一个**镜头，不要动其他镜头，不要输出数组。',
      'roles / props / scene 只能引用给定名单里的名字，不要重新描述角色长相或场景细节。',
      '只输出一个 JSON 对象，不要 Markdown 代码块，不要任何前后缀文字。格式：',
      '{"shot":"镜头一句话描述","roles":["角色名"],"props":["道具名"],"scene":"场景名","action":"动作与表情","camera":"景别与运镜"}',
    ].join('\n'), input.skillPrompt),
    input: [
      `剧本：\n\n${script}`,
      '',
      `角色：${names(library.roles)}`,
      `道具：${names(library.props)}`,
      `场景：${names(library.scenes)}`,
      '',
      `上一镜：${input.before ?? '（无）'}`,
      `待改写：${JSON.stringify({
        shot: input.current.shot,
        roles: input.current.roles,
        props: input.current.props,
        scene: input.current.scene ?? '',
        action: input.current.action,
        camera: input.current.camera,
      })}`,
      `下一镜：${input.after ?? '（无）'}`,
    ].join('\n'),
  }
}

/**
 * 解析单镜重写的输出（容忍围栏与说明）。
 * @param raw - 模型原始文本。
 * @returns 改写后的镜头草案。
 * @throws {Error} 找不到对象或缺少 `shot` 时。
 */
export function parseShotRewrite(raw: string): StoryboardShotDraft {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON 对象')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch (error) {
    throw new Error(`模型返回的不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('模型返回的不是 JSON 对象')
  }
  const record = parsed as Record<string, unknown>
  const shot = readText(record, 'shot')
  if (shot === undefined) throw new Error('模型没有给出镜头描述')
  return {
    shot,
    roles: readNames(record, 'roles'),
    props: readNames(record, 'props'),
    ...readText(record, 'scene') === undefined ? {} : { scene: readText(record, 'scene') as string },
    action: readText(record, 'action') ?? shot,
    camera: readText(record, 'camera') ?? '中景，固定机位',
  }
}

/** 把实体库拍平成「名字 → 提示词」的查找表（同名跨类时先到先得）。 */
function entityIndex(library: StoryboardEntityLibrary): Map<string, StoryboardEntity> {
  const index = new Map<string, StoryboardEntity>()
  for (const entity of [...library.roles, ...library.props, ...library.scenes]) {
    if (!index.has(entity.name)) index.set(entity.name, entity)
  }
  return index
}

/**
 * 把镜头草案与实体库拼成可执行的分镜表。
 *
 * 画面提示词 = 场景提示词 + 角色定妆提示词 + 道具提示词 + 动作 + 镜头 + 一致性收尾；
 * 视频提示词只写动作、镜头与连续性。分镜里**不重复**描述外观，一致性由实体提示词承担。
 * @param library - 前三步产出的实体库。
 * @param drafts - 第四步产出的镜头草案。
 * @returns 1-based 连续编号的分镜表。
 */
export function assembleStoryboardShots(
  library: StoryboardEntityLibrary,
  drafts: readonly StoryboardShotDraft[],
): StoryboardShot[] {
  const index = entityIndex(library)
  return drafts.slice(0, MAX_STORYBOARD_SHOTS).map((draft, position) => {
    const scene = draft.scene === undefined ? undefined : index.get(draft.scene)
    const roles = draft.roles.map(name => index.get(name)).filter((entity): entity is StoryboardEntity => entity !== undefined)
    const props = draft.props.map(name => index.get(name)).filter((entity): entity is StoryboardEntity => entity !== undefined)
    const parts = [
      scene === undefined ? '' : `场景：${scene.prompt}`,
      roles.length === 0 ? '' : `角色：${roles.map(entity => entity.prompt).join('；')}`,
      props.length === 0 ? '' : `道具：${props.map(entity => entity.prompt).join('；')}`,
      `动作与表情：${draft.action}`,
      `镜头：${draft.camera}`,
    ].filter(part => part !== '')
    return {
      index: position + 1,
      shot: draft.shot.slice(0, 40),
      characters: draft.roles,
      ...draft.scene === undefined ? {} : { scene: draft.scene },
      imagePrompt: `${parts.join('；')}；${IMAGE_SUFFIX}`,
      videoPrompt: `动作与表情：${draft.action}；镜头：${draft.camera}；${VIDEO_SUFFIX}`,
    }
  })
}
