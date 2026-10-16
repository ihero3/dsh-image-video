/**
 * Workbench domain records (phase 2, first slice): projects and their media assets.
 *
 * Deliberately plain data: everything here round-trips through JSON so a project
 * directory stays readable and hand-editable (`D5`: JSON manifest + asset
 * directory). Nothing in this file touches the filesystem or the framework.
 */

/** Schema version stamped into every stored record, so later migrations have a hook. */
export const WORKBENCH_SCHEMA_VERSION = 1

/** One project: the container every asset, task and workflow belongs to. */
export interface ProjectRecord {
  readonly schemaVersion: number
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly updatedAt: string
}

/** One media asset registered into a project (a file under the output directory). */
export interface AssetRecord {
  readonly schemaVersion: number
  readonly id: string
  readonly projectId: string
  readonly kind: MediaKind
  /** Absolute path of the file. The host never copies it during this slice. */
  readonly path: string
  readonly bytes: number
  readonly createdAt: string
  /** Provider/model that produced it, when known. */
  readonly provider?: string
  readonly model?: string
  /** Prompt that produced it, when known. */
  readonly prompt?: string
}

/**
 * Lifecycle of one generation as the workbench records it.
 *
 * `queued`/`running` exist so the ledger can be written *before* the provider
 * answers (a long video job outlives the tab), and `cancelled` is distinct from
 * `failed` because the user asked for it.
 */
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'imported-idle'

/** One generation attempt, recorded by the host when a tool call finishes. */
export interface TaskRecord {
  readonly schemaVersion: number
  readonly id: string
  readonly kind: MediaKind
  readonly status: TaskStatus
  /** Provider and model actually used, when the tool reported them. */
  readonly provider?: string
  readonly model?: string
  /** The prompt as submitted. */
  readonly prompt?: string
  /** Absolute path of the produced file, when the call succeeded. */
  readonly outputPath?: string
  /** Size of that file in bytes. */
  readonly bytes?: number
  /** Project this task was filed into, once the user registers its output. */
  readonly projectId?: string
  /** Failure message for `failed` (and the reason for `cancelled`). */
  readonly error?: string
  /** When the call started / last changed. */
  readonly createdAt: string
  readonly updatedAt: string
}

/** Media kinds the workbench distinguishes today. */
export type MediaKind = 'image' | 'video'

/**
 * Kinds of reusable creative resource the workbench keeps per project.
 *
 * `voice` deliberately carries metadata only in this version (`D6`): the field is
 * a name plus notes, no sample playback until a TTS provider is wired.
 */
export type ResourceKind = 'role' | 'scene' | 'prop' | 'brand' | 'style' | 'voice' | 'motion-track'

/** One reusable creative resource inside a project. */
/**
 * 轨迹关键帧（`T2-6`，`R-MED-4`）：归一化坐标 + 时间点，只存数字，序列化即 JSON。
 * `x`/`y` 取画面比例（0 = 左边/上边，1 = 右边/下边），`scale` 是相对缩放。
 */
export interface MotionKeyframe {
  readonly tMs: number
  readonly x: number
  readonly y: number
  readonly scale?: number
}

/** 一条轨迹最多多少个关键帧。 */
export const MAX_MOTION_KEYFRAMES = 120
/** 轨迹最长覆盖 10 分钟。 */
export const MAX_MOTION_DURATION_MS = 600_000

export interface ResourceRecord {
  readonly schemaVersion: number
  readonly id: string
  readonly projectId: string
  readonly kind: ResourceKind
  readonly name: string
  /** Free-form description (appearance, mood, usage notes). */
  readonly note?: string
  /** 轨迹资源的关键帧（只有 `motion-track` 用）。 */
  readonly keyframes?: readonly MotionKeyframe[]
  readonly createdAt: string
  readonly updatedAt: string
}

/** Longest project name the store accepts (kept short enough for the tab header). */
export const MAX_PROJECT_NAME_LENGTH = 60

/** Longest resource name the workbench accepts. */
export const MAX_RESOURCE_NAME_LENGTH = 80

/**
 * Validate a resource name.
 * @param value - raw name.
 * @returns the trimmed name.
 * @throws {Error} when it is empty or too long.
 */
export function normalizeResourceName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('resource name must be a string')
  const name = value.trim()
  if (name.length === 0) throw new Error('resource name must not be empty')
  if (name.length > MAX_RESOURCE_NAME_LENGTH) {
    throw new Error(`resource name must be at most ${MAX_RESOURCE_NAME_LENGTH} characters`)
  }
  return name
}

/**
 * Mint a record id. Time-ordered prefix plus randomness keeps ids sortable and
 * collision-free without pulling in a uuid dependency.
 * @param prefix - short kind marker (`prj` | `ast`).
 * @returns the new id.
 */
export function newWorkbenchId(prefix: string): string {
  const time = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${time}-${random}`
}

/**
 * Validate a user-supplied project name.
 * @param value - raw name from the client.
 * @returns the trimmed name.
 * @throws {Error} when the name is empty or too long.
 */
export function normalizeProjectName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('project name must be a string')
  const name = value.trim()
  if (name.length === 0) throw new Error('project name must not be empty')
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    throw new Error(`project name must be at most ${MAX_PROJECT_NAME_LENGTH} characters`)
  }
  return name
}

/**
 * Validate a resource kind.
 * @param value - raw kind.
 * @returns the kind.
 * @throws {Error} when it is none of the six known kinds.
 */
export function normalizeResourceKind(value: unknown): ResourceKind {
  if (value === 'role' || value === 'scene' || value === 'prop'
    || value === 'brand' || value === 'style' || value === 'voice' || value === 'motion-track') return value
  throw new Error('resource kind must be one of role/scene/prop/brand/style/voice/motion-track')
}

/**
 * 校验并归一化轨迹关键帧。
 * @param value - 待校验的关键帧数组。
 * @returns 归一化后的关键帧。
 * @throws {Error} 数量、时间点、坐标或缩放越界时（越界一律拒，不做静默截断）。
 */
export function normalizeKeyframes(value: unknown): MotionKeyframe[] {
  if (!Array.isArray(value)) throw new Error('motion keyframes must be an array')
  if (value.length === 0) throw new Error('motion track needs at least one keyframe')
  if (value.length > MAX_MOTION_KEYFRAMES) {
    throw new Error(`motion track supports at most ${MAX_MOTION_KEYFRAMES} keyframes, got ${value.length}`)
  }
  let previous = -1
  return value.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null) throw new Error(`keyframe ${index} must be an object`)
    const frame = raw as Record<string, unknown>
    const number = (key: string, min: number, max: number): number => {
      const candidate = frame[key]
      if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
        throw new Error(`keyframe ${index} ${key} must be a finite number`)
      }
      if (candidate < min || candidate > max) {
        throw new Error(`keyframe ${index} ${key} must be between ${min} and ${max}`)
      }
      return candidate
    }
    const tMs = Math.round(number('tMs', 0, MAX_MOTION_DURATION_MS))
    if (index > 0 && tMs < previous) throw new Error(`keyframe ${index} tMs must not go backwards`)
    previous = tMs
    const x = number('x', 0, 1)
    const y = number('y', 0, 1)
    const scale = frame.scale === undefined ? undefined : number('scale', 0.1, 10)
    return { tMs, x, y, ...scale === undefined ? {} : { scale } }
  })
}

/** 把坐标说成"人话"（供约束文本用）。 */
function describePosition(x: number, y: number): string {
  const horizontal = x < 0.34 ? '左' : x > 0.66 ? '右' : '中'
  const vertical = y < 0.34 ? '上' : y > 0.66 ? '下' : '中'
  return `${vertical}${horizontal}`
}

/**
 * 轨迹 → 约束文本（`T2-6` 的可断言产物）：把关键帧翻译成供给模型的运动约束。
 * @param keyframes - 归一化关键帧。
 * @returns 一行行"时间段 + 运动"的自然语言约束。
 */
export function describeMotionTrack(keyframes: readonly MotionKeyframe[]): string {
  if (keyframes.length === 0) return '无轨迹约束'
  return keyframes
    .map((frame, index) => {
      const from = (frame.tMs / 1000).toFixed(1)
      const where = describePosition(frame.x, frame.y)
      const scale = frame.scale === undefined ? '' : `，缩放 ${frame.scale.toFixed(2)}x`
      if (index === 0) return `${from}s 起：主体位于画面${where}${scale}`
      const previous = keyframes[index - 1]!
      const to = (previous.tMs / 1000).toFixed(1)
      return `${to}s→${from}s：移动到画面${where}${scale}`
    })
    .join('；')
}

/**
 * Validate a task status.
 * @param value - raw status.
 * @returns the status.
 * @throws {Error} when it is not one of the five known states.
 */
export function normalizeTaskStatus(value: unknown): TaskStatus {
  if (value === 'queued' || value === 'running' || value === 'succeeded'
    || value === 'failed' || value === 'cancelled') return value
  throw new Error('task status must be one of queued/running/succeeded/failed/cancelled')
}

/**
 * Validate a media kind from the client.
 * @param value - raw kind.
 * @returns the kind.
 * @throws {Error} when it is neither `image` nor `video`.
 */
export function normalizeMediaKind(value: unknown): MediaKind {
  if (value === 'image' || value === 'video') return value
  throw new Error('media kind must be "image" or "video"')
}
