/**
 * 剧本 → 集 → 分段 → 分镜：整棵结构的生成草案（`B-22`）。
 *
 * 两个来源，产出同一份 {@link EpisodePlanEpisode}：
 * - 选文本模型时由模型一次给出完整结构（每集剧本、每集分段、每段分镜）；
 * - 没有模型或模型失败时用规则切分剧本，保证"粘了剧本就能拆"。
 *
 * 本模块只有纯数据与解析，不碰网络与存储：模型调用在 `host/rpc.ts`，落库走
 * `WorkbenchStore`。解析容错（代码块围栏、缺字段、超量）在这里收口，宿主只处理
 * "能不能用"。
 *
 * 三个层级都按默认数生成：集号缺省交给宿主（从 0 递增），段/镜顺序恒为 1..n。
 *
 * @module dsh-image-video/workbench/episode-plan
 */
import { planStoryboard, type PlanResource } from './storyboard.ts'

/** 一次生成的集数上限。 */
export const MAX_PLAN_EPISODES = 12

/** 每集分段数上限。 */
export const MAX_PLAN_SEGMENTS = 20

/** 每段分镜数上限。 */
export const MAX_PLAN_SHOTS = 20

/** 集数缺省：新剧本先落一集，用户再按需加集。 */
export const DEFAULT_PLAN_EPISODES = 1

/** 每集分段数缺省。 */
export const DEFAULT_PLAN_SEGMENTS = 3

/** 每段分镜数缺省。 */
export const DEFAULT_PLAN_SHOTS = 4

/** 一段分镜对应的镜头时长缺省（秒）。 */
export const DEFAULT_PLAN_SHOT_SEC = 6

/** 一镜草案。 */
export interface EpisodePlanShot {
  readonly shot: string
  readonly imagePrompt: string
  readonly videoPrompt: string
  readonly durationSec: number
}

/** 一段草案。 */
export interface EpisodePlanSegment {
  readonly promptText: string
  readonly durationSec: number
  readonly shots: readonly EpisodePlanShot[]
}

/** 一集草案；集号由宿主按下一个默认号分配，模型不决定编号。 */
export interface EpisodePlanEpisode {
  readonly title: string
  readonly script: string
  readonly segments: readonly EpisodePlanSegment[]
}

/** 生成请求：剧本与一句话创意二选一（都为空时模型无从下笔）。 */
export interface EpisodePlanRequest {
  /** 已写好的剧本；给了就直接用它拆分。 */
  readonly script: string
  /** 一句话创意：剧本为空时由模型先写剧本。 */
  readonly brief: string
  readonly episodes: number
  readonly segments: number
  readonly shots: number
  /** 每镜时长（秒），用于反推分段时长。 */
  readonly shotDurationSec: number
}

/** 整数夹取。 */
function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** 请求里的三级数量收敛到合法区间。 */
function countsOf(request: EpisodePlanRequest): { episodes: number, segments: number, shots: number } {
  return {
    episodes: clampInt(request.episodes, 1, MAX_PLAN_EPISODES),
    segments: clampInt(request.segments, 1, MAX_PLAN_SEGMENTS),
    shots: clampInt(request.shots, 1, MAX_PLAN_SHOTS),
  }
}

/**
 * 生成模型提示词。
 *
 * 数量写死在提示词里：模型漏写时解析层会补齐，但提示词先讲清目标规模，
 * 免得模型只给一集一镜。
 * @param request - 剧本 / 创意与三级数量。
 * @returns 系统提示词。
 */
export function buildEpisodePlanPrompt(request: EpisodePlanRequest): string {
  const { episodes, segments, shots } = countsOf(request)
  const source = request.script.trim() === ''
    ? `一句话创意：${request.brief.trim()}`
    : `已有剧本（可在保持剧情的基础上按集切分）：\n${request.script.trim()}`
  return [
    '你是短剧的编剧兼分镜师。把素材整理成可以直接开拍的层级结构：集 → 分段 → 分镜。',
    `要求：共 ${episodes} 集；每集 ${segments} 段；每段 ${shots} 个分镜。`,
    '每集先写完整剧本正文（包含该集的分段剧情），再按剧情顺序拆成分段；每个分段用 1–3 句可直接生图的画面描述。',
    '每个分镜写一行镜头描述，以及画面提示词与视频提示词；画面提示词只写可见画面，视频提示词只写运动与连续性。',
    '集标题取剧情要点（不要写“第几集”前缀）；集号不给。',
    '只输出 JSON，不要 Markdown 代码块与任何前后缀文字。格式：',
    '{"episodes":[{"title":"标题","script":"本集剧本正文","segments":[{"promptText":"分段画面描述","shots":[{"shot":"镜头描述","imagePrompt":"画面提示词","videoPrompt":"视频提示词"}]}]}]}',
    source,
  ].join('\n')
}

/** 取第一个能解析的 JSON 对象：优先代码块，其次整段首尾花括号。 */
function extractJson(raw: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/iu.exec(raw)
  const body = fenced?.[1] ?? (() => {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    return start >= 0 && end > start ? raw.slice(start, end + 1) : ''
  })()
  if (body.trim() === '') throw new Error('模型没有返回 JSON 结构')
  return JSON.parse(body) as unknown
}

/** 读一个字符串字段；非字符串按空串处理。 */
function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 读一个对象数组；非数组按空数组处理。 */
function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/**
 * 解析模型输出。
 *
 * 数量以模型给的结构为准，但逐级封顶：模型多给不会撑爆画布，少给就少拆。
 * 一集连剧本都没有时仍保留该集；一段没有提示词时丢弃；一镜两条提示词都空时丢弃。
 * @param raw - 模型原始输出。
 * @param request - 原始请求（用于补每镜时长与数量上限）。
 * @returns 至少一集、每集至少一段的结构。
 * @throws {Error} 没有 JSON、或解析不出任何可用集时。
 */
export function parseEpisodePlan(raw: string, request: EpisodePlanRequest): EpisodePlanEpisode[] {
  const parsed = extractJson(raw)
  const { episodes: maxEpisodes, segments: maxSegments, shots: maxShots } = countsOf(request)
  const shotSec = clampInt(request.shotDurationSec, 1, 60)
  const root = parsed as { episodes?: unknown }
  const episodes = readArray(root.episodes)
    .slice(0, maxEpisodes)
    .map((episode): EpisodePlanEpisode | undefined => {
      const record = episode as { title?: unknown, script?: unknown, segments?: unknown }
      const script = readText(record.script)
      const segments = readArray(record.segments)
        .slice(0, maxSegments)
        .map((segment): EpisodePlanSegment | undefined => {
          const entry = segment as { promptText?: unknown, shots?: unknown }
          const promptText = readText(entry.promptText)
          if (promptText === '') return undefined
          const shots = readArray(entry.shots)
            .slice(0, maxShots)
            .map((shot): EpisodePlanShot | undefined => {
              const draft = shot as { shot?: unknown, imagePrompt?: unknown, videoPrompt?: unknown }
              const imagePrompt = readText(draft.imagePrompt)
              const videoPrompt = readText(draft.videoPrompt)
              if (imagePrompt === '' && videoPrompt === '') return undefined
              return {
                shot: readText(draft.shot),
                imagePrompt: imagePrompt === '' ? videoPrompt : imagePrompt,
                videoPrompt: videoPrompt === '' ? imagePrompt : videoPrompt,
                durationSec: shotSec,
              }
            })
            .filter((entry): entry is EpisodePlanShot => entry !== undefined)
          return {
            promptText,
            durationSec: Math.min(60, Math.max(1, shots.length * shotSec)),
            shots,
          }
        })
        .filter((entry): entry is EpisodePlanSegment => entry !== undefined)
      if (segments.length === 0) return undefined
      return { title: readText(record.title), script, segments }
    })
    .filter((entry): entry is EpisodePlanEpisode => entry !== undefined)
  if (episodes.length === 0) throw new Error('模型返回的结构里没有可用的集 / 分段')
  return episodes
}

/** 把剧本切成句子级碎片。 */
function splitScript(script: string): string[] {
  return script
    .split(/[\n。！？!?；;]+/u)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk !== '')
}

/**
 * 按数量把条目均匀分组；数量多于条目时循环复用，保证每组至少一条。
 * @param items - 句子碎片（非空）。
 * @param count - 目标组数。
 * @returns 长度恒为 `count` 的分组。
 */
function spread(items: readonly string[], count: number): string[][] {
  if (count > items.length) {
    return Array.from({ length: count }, (_, index) => [items[index % items.length]!])
  }
  return Array.from({ length: count }, (_, index) => {
    const from = Math.floor(index * items.length / count)
    const to = Math.max(from + 1, Math.floor((index + 1) * items.length / count))
    return items.slice(from, Math.min(items.length, to))
  })
}

/**
 * 规则拆分：剧本 → 集 → 段 → 镜。
 *
 * 集与段按句子数均匀切；每段再交给确定性的 `planStoryboard` 出提示词。
 * 句子比要求的镜数还少时以句子数为准（不注水）。
 * @param request - 剧本与三级数量。
 * @param resources - 项目资源（用于命中角色 / 场景）。
 * @returns 结构与模型版一致。
 * @throws {Error} 剧本为空时。
 */
export function planEpisodesByRules(
  request: EpisodePlanRequest,
  resources: readonly PlanResource[] = [],
): EpisodePlanEpisode[] {
  const { episodes, segments, shots } = countsOf(request)
  const chunks = splitScript(request.script)
  if (chunks.length === 0) throw new Error('剧本不能为空：至少需要一句话')
  const shotSec = clampInt(request.shotDurationSec, 1, 60)
  return spread(chunks, episodes).map((episodeSlice): EpisodePlanEpisode => {
    const script = episodeSlice.join('。')
    const segmentChunks = spread(episodeSlice, segments)
    return {
      title: '',
      script,
      segments: segmentChunks.map((segmentSlice): EpisodePlanSegment => {
        const promptText = segmentSlice.join('。')
        const planned = planStoryboard({ script: promptText, shots, resources })
        const plannedShots = planned.shots.map((shot): EpisodePlanShot => ({
          shot: shot.shot,
          imagePrompt: shot.imagePrompt,
          videoPrompt: shot.videoPrompt,
          durationSec: shotSec,
        }))
        return {
          promptText,
          durationSec: Math.min(60, Math.max(1, plannedShots.length * shotSec)),
          shots: plannedShots,
        }
      }),
    }
  })
}
