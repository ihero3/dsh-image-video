/**
 * 一键自动流水线（P0-2）：**剧本 → 分镜 →（生图）→ 生视频** 的工作流编排。
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

/** 物料生成模式：图生视频（先出图再视频）/ 文生视频（直接出视频）。 */
export type PipelineMode = 'image-to-video' | 'text-to-video'

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
  /** 每镜时长（秒），默认 5。 */
  readonly duration?: number
  /** 严格模式：剧本提到的角色/场景必须已在项目资源库里（缺了就拒绝）。 */
  readonly strictResources?: boolean
  /** 追加到每条生图/生视频提示词后的风格约束（可来自 style 资源）。 */
  readonly styleNote?: string
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
}

/** 一条分镜的编排结果（与工作流节点一一对应，便于 UI 展开预览）。 */
export interface PipelineShot {
  readonly index: number
  readonly shot: string
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
  const resources = input.resources ?? []
  const ratio = options.ratio ?? '16:9'
  const duration = Number.isFinite(options.duration) && (options.duration ?? 0) > 0 ? Math.round(options.duration as number) : 5
  const style = options.styleNote === undefined || options.styleNote.trim() === '' ? '' : `，${options.styleNote.trim()}`

  const warnings: string[] = []
  const shotCount = options.shots === undefined ? undefined : Math.min(MAX_SHOTS, Math.max(1, Math.round(options.shots)))
  const plan = planStoryboard({
    script: input.script,
    ...shotCount === undefined ? {} : { shots: shotCount },
    resources,
  })
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
  if (options.imageModel === undefined) warnings.push('未指定生图模型：将使用宿主默认模型')
  if (options.videoModel === undefined) warnings.push('未指定生视频模型：将使用宿主默认模型')
  if (shotCount !== undefined && plan.shots.length < shotCount) {
    warnings.push(`剧本只够拆 ${plan.shots.length} 个分镜（要求 ${shotCount}）：已按句子数封顶`)
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
    const imagePrompt = `${shot.imagePrompt}${style}`
    const videoPrompt = `${shot.videoPrompt}${style}`
    shots.push({ index: shotNo, shot: shot.shot, imagePrompt, videoPrompt })
    const x = 40 + index * 320

    if (mode === 'image-to-video') {
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
      position: { x: mode === 'image-to-video' ? x + 220 : x, y: mode === 'image-to-video' ? 120 : 120 },
      params: {
        ...options.videoModel === undefined ? {} : { model: options.videoModel },
        prompt: videoPrompt,
        ratio,
        duration,
        resolution: '',
        referenceVideo: '',
        compare: false,
      },
    })
    if (mode === 'image-to-video') {
      edges.push({ id: `e${shotNo}-image-video`, source: `shot${shotNo}-image`, target: `shot${shotNo}-video` })
    }
  })

  return {
    name: `一键成片 · ${plan.shots.length} 镜（${mode === 'image-to-video' ? '图生视频' : '文生视频'}）`,
    mode,
    nodes,
    edges,
    shots,
    diagnostics: {
      shots: plan.shots.length,
      nodes: nodes.length,
      warnings,
      missingResources,
    },
  }
}
