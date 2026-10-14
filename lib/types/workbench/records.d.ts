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
/** Longest project name the store accepts (kept short enough for the tab header). */
export declare const MAX_PROJECT_NAME_LENGTH = 60;
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
