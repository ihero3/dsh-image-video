/**
 * Workbench domain records (phase 2, first slice): projects and their media assets.
 *
 * Deliberately plain data: everything here round-trips through JSON so a project
 * directory stays readable and hand-editable (`D5`: JSON manifest + asset
 * directory). Nothing in this file touches the filesystem or the framework.
 */
/** Schema version stamped into every stored record, so later migrations have a hook. */
export declare const WORKBENCH_SCHEMA_VERSION = 1;
/** One project: the container every asset, task and workflow belongs to. */
export interface ProjectRecord {
    readonly schemaVersion: number;
    readonly id: string;
    readonly name: string;
    readonly createdAt: string;
    readonly updatedAt: string;
}
/** One media asset registered into a project (a file under the output directory). */
export interface AssetRecord {
    readonly schemaVersion: number;
    readonly id: string;
    readonly projectId: string;
    readonly kind: MediaKind;
    /** Absolute path of the file. The host never copies it during this slice. */
    readonly path: string;
    readonly bytes: number;
    readonly createdAt: string;
    /** Provider/model that produced it, when known. */
    readonly provider?: string;
    readonly model?: string;
    /** Prompt that produced it, when known. */
    readonly prompt?: string;
}
/**
 * Lifecycle of one generation as the workbench records it.
 *
 * `queued`/`running` exist so the ledger can be written *before* the provider
 * answers (a long video job outlives the tab), and `cancelled` is distinct from
 * `failed` because the user asked for it.
 */
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
/** One generation attempt, recorded by the host when a tool call finishes. */
export interface TaskRecord {
    readonly schemaVersion: number;
    readonly id: string;
    readonly kind: MediaKind;
    readonly status: TaskStatus;
    /** Provider and model actually used, when the tool reported them. */
    readonly provider?: string;
    readonly model?: string;
    /** The prompt as submitted. */
    readonly prompt?: string;
    /** Absolute path of the produced file, when the call succeeded. */
    readonly outputPath?: string;
    /** Size of that file in bytes. */
    readonly bytes?: number;
    /** Project this task was filed into, once the user registers its output. */
    readonly projectId?: string;
    /** Failure message for `failed` (and the reason for `cancelled`). */
    readonly error?: string;
    /** When the call started / last changed. */
    readonly createdAt: string;
    readonly updatedAt: string;
}
/** Media kinds the workbench distinguishes today. */
export type MediaKind = 'image' | 'video';
/**
 * Kinds of reusable creative resource the workbench keeps per project.
 *
 * `voice` deliberately carries metadata only in this version (`D6`): the field is
 * a name plus notes, no sample playback until a TTS provider is wired.
 */
export type ResourceKind = 'role' | 'scene' | 'prop' | 'brand' | 'style' | 'voice' | 'motion-track';
/** One reusable creative resource inside a project. */
/**
 * 轨迹关键帧（`T2-6`，`R-MED-4`）：归一化坐标 + 时间点，只存数字，序列化即 JSON。
 * `x`/`y` 取画面比例（0 = 左边/上边，1 = 右边/下边），`scale` 是相对缩放。
 */
export interface MotionKeyframe {
    readonly tMs: number;
    readonly x: number;
    readonly y: number;
    readonly scale?: number;
}
/** 一条轨迹最多多少个关键帧。 */
export declare const MAX_MOTION_KEYFRAMES = 120;
/** 轨迹最长覆盖 10 分钟。 */
export declare const MAX_MOTION_DURATION_MS = 600000;
export interface ResourceRecord {
    readonly schemaVersion: number;
    readonly id: string;
    readonly projectId: string;
    readonly kind: ResourceKind;
    readonly name: string;
    /** Free-form description (appearance, mood, usage notes). */
    readonly note?: string;
    /** 轨迹资源的关键帧（只有 `motion-track` 用）。 */
    readonly keyframes?: readonly MotionKeyframe[];
    readonly createdAt: string;
    readonly updatedAt: string;
}
/** Longest project name the store accepts (kept short enough for the tab header). */
export declare const MAX_PROJECT_NAME_LENGTH = 60;
/** Longest resource name the workbench accepts. */
export declare const MAX_RESOURCE_NAME_LENGTH = 80;
/**
 * Validate a resource name.
 * @param value - raw name.
 * @returns the trimmed name.
 * @throws {Error} when it is empty or too long.
 */
export declare function normalizeResourceName(value: unknown): string;
/**
 * Mint a record id. Time-ordered prefix plus randomness keeps ids sortable and
 * collision-free without pulling in a uuid dependency.
 * @param prefix - short kind marker (`prj` | `ast`).
 * @returns the new id.
 */
export declare function newWorkbenchId(prefix: string): string;
/**
 * Validate a user-supplied project name.
 * @param value - raw name from the client.
 * @returns the trimmed name.
 * @throws {Error} when the name is empty or too long.
 */
export declare function normalizeProjectName(value: unknown): string;
/**
 * Validate a resource kind.
 * @param value - raw kind.
 * @returns the kind.
 * @throws {Error} when it is none of the six known kinds.
 */
export declare function normalizeResourceKind(value: unknown): ResourceKind;
/**
 * 校验并归一化轨迹关键帧。
 * @param value - 待校验的关键帧数组。
 * @returns 归一化后的关键帧。
 * @throws {Error} 数量、时间点、坐标或缩放越界时（越界一律拒，不做静默截断）。
 */
export declare function normalizeKeyframes(value: unknown): MotionKeyframe[];
/**
 * 轨迹 → 约束文本（`T2-6` 的可断言产物）：把关键帧翻译成供给模型的运动约束。
 * @param keyframes - 归一化关键帧。
 * @returns 一行行"时间段 + 运动"的自然语言约束。
 */
export declare function describeMotionTrack(keyframes: readonly MotionKeyframe[]): string;
/**
 * Validate a task status.
 * @param value - raw status.
 * @returns the status.
 * @throws {Error} when it is not one of the five known states.
 */
export declare function normalizeTaskStatus(value: unknown): TaskStatus;
/**
 * Validate a media kind from the client.
 * @param value - raw kind.
 * @returns the kind.
 * @throws {Error} when it is neither `image` nor `video`.
 */
export declare function normalizeMediaKind(value: unknown): MediaKind;
