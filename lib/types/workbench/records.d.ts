/**
 * Workbench domain records (phase 2, first slice): projects and their media assets.
 *
 * Deliberately plain data: everything here round-trips through JSON so a project
 * directory stays readable and hand-editable (`D5`: JSON manifest + asset
 * directory). Nothing in this file touches the filesystem or the framework.
 */
/** Schema version stamped into every stored record, so later migrations have a hook. */
export declare const WORKBENCH_SCHEMA_VERSION = 4;
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
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'imported-idle';
/**
 * 资源使用记录（`R-QCK-3`）：某条产物在生成时用到了哪个创作资源。
 *
 * 口径：产物由某张工作流跑出来时，**该图里的 `resource-reference` 节点**就算用到了这些资源
 * （图是工作单位；逐条追到"某节点直连的上游资源"在 V1 太细，收益也不大）。
 */
export interface ResourceUsageRecord {
    readonly resourceId: string;
    readonly projectId: string;
    readonly assetPath: string;
    readonly runId: string;
    readonly nodeId: string;
    readonly at: string;
}
/**
 * 用户自定义导出预设（`A48`，全局库，不属于某个项目）。
 *
 * 与内置预设（`src/workbench/presets.ts` 的只读常量）分开：内置的随代码发版，
 * 用户的随工作台数据走 `schemaVersion` 迁移。
 */
export interface ExportPresetRecord {
    readonly id: string;
    readonly name: string;
    readonly width: number;
    readonly height: number;
    readonly frameRate: number;
    readonly bitrateKbps?: number;
    readonly createdAt: string;
}
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
/** 资源作用域（`R-COL-1`）：V1 只用 `project`，字段先留好。 */
export type ResourceScope = 'project' | 'team' | 'public';
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
    /**
     * 参考图（`A153`）：该资源对应的定妆照/参考素材路径（outputs 内的相对或绝对路径）。
     * 角色/场景资源挂上它，多镜生成时才有可对齐的视觉锚点。
     */
    readonly assetPath?: string;
    /**
     * 多张参考图（`A-3`）：角色的多角度定妆照 / 场景的多张基准。首图视为底图。
     * 保留 `assetPath` 兼容旧数据（读的时候合并：`assetPaths ?? [assetPath]`）。
     */
    readonly assetPaths?: readonly string[];
    /**
     * 资源作用域（`R-COL-1`，后置能力）：保留 `project`/`team`/`public` 字段，
     * **V1 一律写 `project`**，UI 不提供团队/公共入口。
     */
    readonly scope: ResourceScope;
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
/**
 * 校验资源作用域（`R-COL-1`）。
 * @param value - 原始取值；缺省即 `project`（V1 只写这一个）。
 * @returns 作用域。
 * @throws {Error} 取值不在白名单时。
 */
export declare function normalizeResourceScope(value: unknown): ResourceScope;
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
