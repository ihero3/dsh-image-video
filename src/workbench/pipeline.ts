/**
 * 一键自动流水线（P0-2）：**剧本 → 分镜 →（生图）→ 生视频** 的工作流编排。
 *
 * 三种模式共用同一条编排骨架（`B2`）：`image-to-video`（首帧图 → 视频）、
 * `text-to-video`（直接文生视频）、`video-to-video`（参考片复刻，**不经过生图**）。
 *
 * 设计口径：
 * - **纯函数**：只吃剧本/选项/资源，产出「可直接 `workflows/save` + `workflows/run` 的草稿」，
 *   不碰存储、不发网络、不调模型 —— 这样能被单测钉死，也能被 UI 预览/二次编辑；
 * - **复用既有能力**：分镜拆解用 `planStoryboard`（A-7），执行用现成的画布 runner，
 *   本模块只做"编排"这一件事，不新增执行语义；
 * - **诚实**：能出的警告（资源缺失、分镜被截断、模型未选）都写进 `diagnostics`，
 *   严格模式下缺物料直接拒绝，不假装能跑。
 *
 * @module dsh-image-video/workbench/pipeline
 */
import { planStoryboard, type PlanResource } from './storyboard.ts'
import type { WorkflowEdge, WorkflowNode } from './workflow.ts'

/**
 * 物料生成模式：
 * - `image-to-video`：先出首帧图，再用图生视频（可控性最好）；
 * - `text-to-video`：跳过生图，直接文生视频（最快）；
 * - `video-to-video`：拿一段参考视频做**复刻**（保留构图/运镜/动作，按剧本换场景与主体），
 *   同样**不经过生图**（`B2`，2026-11-05 产品新增）。
 */
export type PipelineMode = 'image-to-video' | 'text-to-video' | 'video-to-video'

/**
 * 每镜默认时长（秒）。
 * 产品口径 `B4`（2026-11-05）定为 6（旧实现是 5）：一个镜头要留给运镜与表情变化，
 * 5 秒在实际片段里常显得"刚起势就切走"。
 */
export const DEFAULT_SHOT_DURATION = 6

/** 单镜时长下界（秒）：0 及以下没有语义，按非法值处理。 */
export const MIN_SHOT_DURATION = 1

/** 单镜时长上界（秒）：与 `generate_video` 的 1–30 秒硬上限对齐，超过会被上游拒绝。 */
export const MAX_SHOT_DURATION = 30

/** 一键流水线选项（全部可选，缺省即"能跑就行"）。 */
export interface PipelineOptions {
  /** 物料生成模式，默认 `image-to-video`（可控性更好）。 */
  readonly mode?: PipelineMode
  /** 目标分镜数；缺省按句子数。 */
  readonly shots?: number
  /** 生图模型（留空用宿主默认）。 */
  readonly imageModel?: string
  /** 生视频模型（留空用宿主默认）。 */
  readonly videoModel?: string
  /** 画面比例，默认 `16:9`。 */
  readonly ratio?: string
  /** 每镜时长（秒），默认 6；单镜可被 `shotDurations` 覆盖。 */
  readonly duration?: number
  /**
   * 逐镜时长覆盖（秒，`B5`）：用户在「生成分镜」里手工改过的每镜时长，
   * 下标与分镜一一对应；缺项 / 非正数回落到 `duration`，超过 30 秒按 30 秒封顶。
   */
  readonly shotDurations?: readonly number[]
  /**
   * 参考视频（本地路径 / http(s) URL / 输出目录里的文件名）：**仅** `video-to-video` 使用，
   * 落在视频节点的 `referenceVideo` 参数上（沿用画布 `video-generate` 的既有参数名）。
   * 该模式没给参考片时如实告警，而不是假装还能复刻。
   */
  readonly referenceVideo?: string
  /** 严格模式：剧本提到的角色/场景必须已在项目资源库里（缺了就拒绝）。 */
  readonly strictResources?: boolean
  /** 追加到每条生图/生视频提示词后的风格约束（可来自 style 资源）。 */
  readonly styleNote?: string
  /**
   * 显式挑选的物料（资源 id，`B-18`）：给了就只用这些资源参与编排；
   * 不给则沿用"剧本里命中哪些名字就用哪些"的自动匹配。
   */
  readonly resourceIds?: readonly string[]
}

/** 编排诊断：既有"非阻断提醒"，也有"严格模式会拒绝"的缺物料清单。 */
export interface PipelineDiagnostics {
  /** 实际编排的分镜数。 */
  readonly shots: number
  /** 节点总数（含生图/生视频）。 */
  readonly nodes: number
  /** 非阻断提醒。 */
  readonly warnings: readonly string[]
  /** 剧本提到但资源库里找不到的物料名（严格模式下拒绝执行）。 */
  readonly missingResources: readonly string[]
  /**
   * 本次编排**真正用到**的资源（`B-18` / 显式挑选回显）：
   * 手动挑选时 = 选中的资源；自动匹配时 = 剧本里命中的资源。
   * 旧宿主不返回该字段，客户端按"没有就不渲染"处理。
   */
  readonly matchedResources: readonly { readonly name: string; readonly resourceId: string; readonly kind: string }[]
}

/** 一条分镜的编排结果（与工作流节点一一对应，便于 UI 展开预览）。 */
export interface PipelineShot {
  readonly index: number
  readonly shot: string
  /**
   * 本镜**实际**时长（秒）：回显 `shotDurations` 覆盖后的结果（缺省为 `duration`）。
   * UI 直接渲染这一列即可，不用自己再算一遍回落/封顶规则。
   */
  readonly duration: number
  readonly imagePrompt: string
  readonly videoPrompt: string
}

/** 编排草稿：直接交给 `workflows/save` 的载荷。 */
export interface PipelineDraft {
  readonly name: string
  readonly mode: PipelineMode
  readonly nodes: readonly WorkflowNode[]
  readonly edges: readonly WorkflowEdge[]
  readonly shots: readonly PipelineShot[]
  readonly diagnostics: PipelineDiagnostics
}

/** 分镜上限：与画布规模上限对齐（每镜最多 2 个节点）。 */
const MAX_SHOTS = 60

/** 模式的中文标签：工作流名字与诊断共用一份，避免两处各写一套口径。 */
const MODE_LABELS: Readonly<Record<PipelineMode, string>> = {
  'image-to-video': '图生视频',
  'text-to-video': '文生视频',
  'video-to-video': '视频生视频（复刻）',
}

/**
 * `video-to-video` 的复刻语义补充。
 * 节点参数只能表达"用哪段参考片"，表达不了"要保留什么、要改什么"；提示词里补一句，
 * 与画布「参考视频复刻」模板同口径（保留原片构图/运镜/动作，按剧本替换场景与主体）。
 */
const REMAKE_PROMPT_SUFFIX = '；以参考视频为底片复刻：保持原片的构图、运镜与人物动作，按剧本替换场景与主体'

/**
 * 时长归一：只接受"正的有限数字"，四舍五入到整秒并收敛到 1–30 秒。
 * 为什么要收敛：上游视频模型硬上限 30 秒，超了会在生成时被拒——与其把脏值交给 runner，
 * 不如在编排阶段就定死，并留下一条可照做的提醒。
 * @param value - 外部传入的时长（可能是脏值）。
 * @returns 合法则返回整秒数；非法返回 `undefined`，由调用方回落。
 */
function toShotDuration(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return Math.min(MAX_SHOT_DURATION, Math.max(MIN_SHOT_DURATION, Math.round(value)))
}

/**
 * 把剧本编排成一张可执行的工作流草稿。
 * @param input - 剧本、选项、以及项目里已有的创作资源（用于识别角色/场景）。
 * @returns 工作流草稿 + 诊断。
 * @throws {Error} 剧本为空、或严格模式下缺物料时。
 */
export function planPipeline(input: {
  readonly script: string
  readonly options?: PipelineOptions
  readonly resources?: readonly PlanResource[]
}): PipelineDraft {
  const options = input.options ?? {}
  const mode = options.mode ?? 'image-to-video'
  /** 只有 `image-to-video` 有生图环节（`video-to-video` 直接拿参考片复刻）。 */
  const hasImageStage = mode === 'image-to-video'
  /** `video-to-video` 的复刻语义只在给了参考片时成立。 */
  const referenceVideo = mode === 'video-to-video' ? (options.referenceVideo ?? '').trim() : ''
  /** 每镜时长的全局缺省：脏值静默回落默认值，超上限则封顶并提醒（见下）。 */
  const requestedDuration = options.duration
  const duration = toShotDuration(requestedDuration) ?? DEFAULT_SHOT_DURATION
  const allResources = input.resources ?? []
  // `B-18`：显式挑选优先（只用指定资源）；未知 id 如实提醒，不静默忽略
  const selectedIds = options.resourceIds === undefined || options.resourceIds.length === 0
    ? undefined
    : [...new Set(options.resourceIds)]
  const resources = selectedIds === undefined
    ? allResources
    : allResources.filter(resource => selectedIds.includes(resource.id))
  const unknownSelected = selectedIds === undefined ? [] : selectedIds.filter(id => !allResources.some(resource => resource.id === id))
  const ratio = options.ratio ?? '16:9'
  const style = options.styleNote === undefined || options.styleNote.trim() === '' ? '' : `，${options.styleNote.trim()}`

  const warnings: string[] = []
  const shotCount = options.shots === undefined ? undefined : Math.min(MAX_SHOTS, Math.max(1, Math.round(options.shots)))
  const plan = planStoryboard({
    script: input.script,
    ...shotCount === undefined ? {} : { shots: shotCount },
    resources,
  })
  // 手动挑选 = 选中的都算"用到"；自动匹配 = 只算剧本里真正命中的
  const matchedResources = (selectedIds === undefined
    ? resources.filter(resource => plan.referencedResourceIds.includes(resource.id))
    : resources
  ).map(resource => ({ name: resource.name, resourceId: resource.id, kind: resource.kind }))
  if (plan.shots.length === 0) throw new Error('剧本拆不出分镜：请至少写一句可拍摄的描述')

  // 物料体检：剧本提到的角色/场景是否都登记了
  const known = new Set(resources.map(resource => resource.name))
  const mentioned = new Set<string>()
  for (const shot of plan.shots) {
    for (const character of shot.characters) mentioned.add(character)
    if (shot.scene !== undefined) mentioned.add(shot.scene)
  }
  const missingResources = [...mentioned].filter(name => !known.has(name)).sort((left, right) => left.localeCompare(right, 'zh'))
  if (resources.length === 0) {
    warnings.push('项目里还没有角色/场景/物品资源：分镜只能按剧本文本生图，角色一致性没有保障')
  }
  // 生图模型只在有生图环节时才相关：文生视频/视频生视频报"未指定生图模型"会误导用户
  if (hasImageStage && options.imageModel === undefined) warnings.push('未指定生图模型：将使用宿主默认模型')
  if (options.videoModel === undefined) warnings.push('未指定生视频模型：将使用宿主默认模型')
  if (shotCount !== undefined && plan.shots.length < shotCount) {
    warnings.push(`剧本只够拆 ${plan.shots.length} 个分镜（要求 ${shotCount}）：已按句子数封顶`)
  }
  if (unknownSelected.length > 0) {
    warnings.push(`手动挑选里有 ${unknownSelected.length} 个资源 id 不存在（已忽略）：${unknownSelected.join('、')}`)
  }
  // `B4`：全局时长超上限要封顶并说清——上游视频模型不支持 >30 秒，不提前拦就是运行时报错
  if (typeof requestedDuration === 'number' && Number.isFinite(requestedDuration) && requestedDuration > MAX_SHOT_DURATION) {
    warnings.push(`每镜时长 ${requestedDuration} 秒超过 ${MAX_SHOT_DURATION} 秒上限：已按 ${MAX_SHOT_DURATION} 秒编排`)
  }
  // `B5`：逐镜时长的脏值/越界/多余项都要讲明白，别让用户以为界面上改的数字被悄悄丢了
  const shotDurations = options.shotDurations ?? []
  const consideredDurations = shotDurations.slice(0, plan.shots.length)
  const invalidDurations = consideredDurations.filter(value => toShotDuration(value) === undefined).length
  // 四舍五入与封顶都算"修正过"：用户填 30.4 秒也会被改成 30，必须能看见
  const adjustedDurations = consideredDurations.filter(value => {
    const seconds = toShotDuration(value)
    return seconds !== undefined && seconds !== value
  }).length
  if (invalidDurations > 0) {
    warnings.push(`逐镜时长里有 ${invalidDurations} 个不是正数：这些镜按每镜 ${duration} 秒编排`)
  }
  if (adjustedDurations > 0) {
    warnings.push(`逐镜时长里有 ${adjustedDurations} 个不是整秒或超出 ${MIN_SHOT_DURATION}–${MAX_SHOT_DURATION} 秒：已按整秒并在区间内封顶`)
  }
  if (shotDurations.length > plan.shots.length) {
    warnings.push(`逐镜时长给了 ${shotDurations.length} 个，但本次只编排 ${plan.shots.length} 镜：多余的已忽略`)
  }
  // `B2`：复刻模式没参考片时只能从零生成，如实说清楚；不冒充"复刻已就绪"
  if (mode === 'video-to-video' && referenceVideo === '') {
    warnings.push('视频生视频（复刻）需要一段参考视频：当前没填，分镜只能按剧本从零生成；请补上参考片，或改用图生视频')
  }
  if (options.strictResources === true) {
    // 严格模式的可判定口径：**必须**已有角色/场景资源可用，且剧本里识别到的物料都能对上。
    // （无法凭剧本凭空判断"王五"是不是角色名——那不是严格模式的职责，是资源登记的职责。）
    if (resources.length === 0) {
      throw new Error(
        '严格模式：项目里还没有任何角色/场景资源 —— 请先在「资源」面板登记角色与场景'
        + '（登记后剧本里的名字才会被自动匹配），或改用随意模式',
      )
    }
    const unmatched = missingResources
    if (unmatched.length > 0) {
      throw new Error(
        `严格模式：这些物料在资源库里对不上 —— ${unmatched.join('、')}；请补登记或改用随意模式`,
      )
    }
  }

  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []
  const shots: PipelineShot[] = []
  plan.shots.forEach((shot, index) => {
    const shotNo = index + 1
    // `B5`：每镜用**自己的**时长（界面上手工改过的分镜可以逐镜不同），缺项回落全局值
    const shotDuration = toShotDuration(shotDurations[index]) ?? duration
    const imagePrompt = `${shot.imagePrompt}${style}`
    const videoPrompt = `${shot.videoPrompt}${style}${mode === 'video-to-video' ? REMAKE_PROMPT_SUFFIX : ''}`
    shots.push({ index: shotNo, shot: shot.shot, duration: shotDuration, imagePrompt, videoPrompt })
    const x = 40 + index * 320

    if (hasImageStage) {
      nodes.push({
        id: `shot${shotNo}-image`,
        kind: 'image-generate',
        position: { x, y: 120 },
        params: {
          ...options.imageModel === undefined ? {} : { model: options.imageModel },
          prompt: imagePrompt,
          ratio,
        },
      })
    }
    nodes.push({
      id: `shot${shotNo}-video`,
      kind: 'video-generate',
      position: { x: hasImageStage ? x + 220 : x, y: 120 },
      params: {
        ...options.videoModel === undefined ? {} : { model: options.videoModel },
        prompt: videoPrompt,
        ratio,
        // `B4`/`B5`：节点参数用本镜自己的秒数，不能全用全局值
        duration: shotDuration,
        resolution: '',
        // `B2`：复刻模式把参考片透传给画布既有的 `referenceVideo` 参数（不另立节点/参数）；
        // 只有真的给了参考片才产「原片/复刻」对比片（`compare`），否则纯属白花钱。
        referenceVideo,
        compare: referenceVideo !== '',
      },
    })
    if (hasImageStage) {
      edges.push({ id: `e${shotNo}-image-video`, source: `shot${shotNo}-image`, target: `shot${shotNo}-video` })
    }
  })

  return {
    name: `一键成片 · ${plan.shots.length} 镜（${MODE_LABELS[mode]}）`,
    mode,
    nodes,
    edges,
    shots,
    diagnostics: {
      shots: plan.shots.length,
      nodes: nodes.length,
      warnings,
      missingResources,
      matchedResources,
    },
  }
}
