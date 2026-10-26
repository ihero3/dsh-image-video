/**
 * 模型能力卡（`B-6`）：把"选哪个模型"从猜测变成可查的事实。
 *
 * 竞品用一篇营销页介绍模型；我们要的是**决策所需的最小信息**：擅长什么、支持哪些玩法
 * （首尾帧/参考图/参考视频）、时长与分辨率上限、成本档位、提示词怎么写。
 *
 * 硬约束（与代码事实保持一致，见 `runtime-defaults.ts`）：
 * - `REFERENCE_VIDEO_CAPABLE_MODELS = ['wan3.0-video']` —— 只有它支持参考视频/续写；
 * - `MULTI_FRAME_CAPABLE_MODELS = ['MiniMax-H3','minimax-h3','wan3.0-video']` —— 多关键帧；
 * - `VIDEO_DURATION_UNSUPPORTED` 里的模型**不能**自定义时长（传了会被上游拒绝）；
 * - 能力卡只描述"我们实际接入并验证过"的模型，不写没验证过的猜测（`verified` 字段）。
 *
 * 能力卡只从**宿主端点**下发（`models/catalog`），不进客户端 bundle：
 * 客户端产物里出现服务商/模型名会被 `client-no-hardcoding` 判为部署事实泄漏。
 *
 * @module dsh-image-video/media/model-catalog
 */
import { MULTI_FRAME_CAPABLE_MODELS, REFERENCE_VIDEO_CAPABLE_MODELS, VIDEO_DURATION_UNSUPPORTED } from '../runtime-defaults.ts'

/** 卡片描述的一个能力项：支持/不支持 + 人话说明。 */
export interface CapabilityFlag {
  readonly supported: boolean
  readonly note?: string
}

/** 一张模型能力卡。 */
export interface ModelCapabilityCard {
  /** 模型 id（调用 `model` 参数时用它）。 */
  readonly id: string
  /** 展示名。 */
  readonly name: string
  /** 厂商家族（用于归组展示）。 */
  readonly family: string
  /** 能用于哪些生成类型。 */
  readonly kinds: ReadonlyArray<'image' | 'video'>
  /** 一句话擅长。 */
  readonly strength: string
  /** 成本档位（低/中/高，用于粗排）。 */
  readonly costTier: 'low' | 'medium' | 'high'
  /** 视频类：时长能力。图片类无此字段。 */
  readonly duration?: {
    readonly minSec: number
    readonly maxSec: number
    /** true = 支持自定义时长；false = 上游按内置档位出片。 */
    readonly customizable: boolean
    readonly note?: string
  }
  /** 支持的宽高比。 */
  readonly aspectRatios: readonly string[]
  /** 视频类：分辨率档位。 */
  readonly resolutions?: readonly string[]
  /** 玩法支持矩阵。 */
  readonly features: {
    /** 首帧驱动（图生视频）。 */
    readonly imageToVideo: boolean
    /** 首尾帧。 */
    readonly firstLastFrame: CapabilityFlag
    /** 多关键帧（按时间点排参考图）。 */
    readonly multiFrame: CapabilityFlag
    /** 参考视频（编辑 / 续写）。 */
    readonly referenceVideo: CapabilityFlag
    /** 音频/对口型。 */
    readonly audio: CapabilityFlag
  }
  /** 提示词建议（来自实测与官方文档的经验）。 */
  readonly promptTips: readonly string[]
  /** 事实来源：`verified` = 我们实测过；`catalog` = 以服务商目录为准，未逐项实测。 */
  readonly verified: boolean
}

/** 视频通用宽高比（与 `VIDEO_ASPECT_RATIOS` 一致）。 */
const VIDEO_RATIOS = ['16:9', '9:16', '1:1'] as const
/** 图片常用比例。 */
const IMAGE_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16'] as const

/** 生成能力卡（顺序即推荐展示顺序：先默认/通用，再专项）。 */
export const MODEL_CARDS: readonly ModelCapabilityCard[] = [
  {
    id: 'qwen-image-3.0',
    name: 'Qwen Image 3.0',
    family: 'qwen',
    kinds: ['image'],
    strength: '通用文生图/图生图，中文提示词友好，出图稳定',
    costTier: 'low',
    aspectRatios: IMAGE_RATIOS,
    features: {
      imageToVideo: false,
      firstLastFrame: { supported: false },
      multiFrame: { supported: false, note: '图片模型不谈多关键帧' },
      referenceVideo: { supported: false },
      audio: { supported: false },
    },
    promptTips: [
      '主体 + 环境 + 光线 + 风格四段式最容易出好图',
      '融合生图时先用「姿态/镜头」预设，再补一句动作描述',
      '多参考图（≥2 张）会按序作为底图/风格参考，首图权重最高',
    ],
    verified: true,
  },
  {
    id: 'minimax-h3',
    name: 'MiniMax H3',
    family: 'minimax',
    kinds: ['video'],
    strength: '图生视频默认模型，支持首尾帧与多关键帧，动作自然',
    costTier: 'medium',
    duration: { minSec: 1, maxSec: 30, customizable: true },
    aspectRatios: VIDEO_RATIOS,
    resolutions: ['480P', '768P', '2K'],
    features: {
      imageToVideo: true,
      firstLastFrame: { supported: true },
      multiFrame: { supported: true, note: '按 position 传 0s/1s… 的关键帧序列' },
      referenceVideo: { supported: false, note: '参考视频/续写请用 wan3.0-video' },
      audio: { supported: true, note: '部分版本支持有声；以服务商能力为准' },
    },
    promptTips: [
      '写"镜头怎么动 + 主体做什么"，不要只写画面内容',
      '首帧已经决定构图，提示词里别再描述构图',
      '时长 >10s 时建议拆成两个镜头再拼',
    ],
    verified: true,
  },
  {
    id: 'wan3.0-video',
    name: 'Wan 3.0 Video',
    family: 'wan',
    kinds: ['video'],
    strength: 'All-in-One：既能参考图/多关键帧，也能参考视频做「编辑」与「续写」',
    costTier: 'high',
    duration: { minSec: 1, maxSec: 30, customizable: true },
    aspectRatios: [...VIDEO_RATIOS, 'adaptive'],
    resolutions: ['480P', '1080P'],
    features: {
      imageToVideo: true,
      firstLastFrame: { supported: true },
      multiFrame: { supported: true },
      referenceVideo: { supported: true, note: '唯一支持参考视频的模型：编辑（改内容）与续写（往后接）都走它' },
      audio: { supported: false },
    },
    promptTips: [
      '编辑：明确说"替换/改成/去掉"什么，保留原片动作由模型负责',
      '续写：用 continuation=true，提示词只写"接下来发生什么"',
      '参考视频越长越贵，先把要改的片段剪出来再传',
    ],
    verified: true,
  },
  {
    id: 'wan2.2-t2v-plus',
    name: 'Wan 2.2 T2V Plus',
    family: 'wan',
    kinds: ['video'],
    strength: '纯文生视频，画风扎实',
    costTier: 'low',
    duration: { minSec: 1, maxSec: 30, customizable: false, note: '上游按内置档位出片：传 duration 会被拒绝（工具会自动丢弃）' },
    aspectRatios: VIDEO_RATIOS,
    features: {
      imageToVideo: false,
      firstLastFrame: { supported: false },
      multiFrame: { supported: false },
      referenceVideo: { supported: false },
      audio: { supported: false },
    },
    promptTips: ['不支持图生视频：别传 image/media', '时长交给上游档位，不要纠结秒数'],
    verified: true,
  },
  {
    id: 'wan2.7-t2v',
    name: 'Wan 2.7 T2V',
    family: 'wan',
    kinds: ['video'],
    strength: '纯文生视频，提示词遵循度高',
    costTier: 'medium',
    duration: { minSec: 1, maxSec: 30, customizable: false, note: '上游按内置档位出片（工具会自动丢弃 duration）' },
    aspectRatios: VIDEO_RATIOS,
    features: {
      imageToVideo: false,
      firstLastFrame: { supported: false },
      multiFrame: { supported: false },
      referenceVideo: { supported: false },
      audio: { supported: false },
    },
    promptTips: ['不支持图生视频', '把"运镜 + 主体动作 + 光线"写清楚，胜过多写形容词'],
    verified: true,
  },
] as const

/**
 * 取能力卡。
 * @param kind - 可选：只取图片或视频能力卡。
 * @returns 能力卡列表（`verified` 的排在前面）。
 */
export function modelCards(kind?: 'image' | 'video'): readonly ModelCapabilityCard[] {
  const cards = kind === undefined ? MODEL_CARDS : MODEL_CARDS.filter(card => card.kinds.includes(kind))
  return [...cards].sort((left, right) => Number(right.verified) - Number(left.verified))
}

/** 自检：能力卡与运行时能力常量必须一致（改一边忘另一边 = 卡片骗人）。 */
export function catalogConsistencyIssues(): readonly string[] {
  const issues: string[] = []
  for (const card of MODEL_CARDS) {
    if (!card.kinds.includes('video')) continue
    const supportsRefVideo = REFERENCE_VIDEO_CAPABLE_MODELS.some(model => model.toLowerCase() === card.id.toLowerCase())
    if (card.features.referenceVideo.supported !== supportsRefVideo) {
      issues.push(`${card.id}: referenceVideo 能力与 REFERENCE_VIDEO_CAPABLE_MODELS 不一致`)
    }
    const supportsMulti = MULTI_FRAME_CAPABLE_MODELS.some(model => model.toLowerCase() === card.id.toLowerCase())
    if (card.features.multiFrame.supported !== supportsMulti) {
      issues.push(`${card.id}: multiFrame 能力与 MULTI_FRAME_CAPABLE_MODELS 不一致`)
    }
    const durationLocked = [...VIDEO_DURATION_UNSUPPORTED].some(model => model.toLowerCase() === card.id.toLowerCase())
    if (card.duration !== undefined && card.duration.customizable === durationLocked) {
      issues.push(`${card.id}: 自定义时长能力与 VIDEO_DURATION_UNSUPPORTED 不一致`)
    }
  }
  return issues
}
