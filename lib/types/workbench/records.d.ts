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
 * Validate a media kind from the client.
 * @param value - raw kind.
 * @returns the kind.
 * @throws {Error} when it is neither `image` nor `video`.
 */
export declare function normalizeMediaKind(value: unknown): MediaKind;
