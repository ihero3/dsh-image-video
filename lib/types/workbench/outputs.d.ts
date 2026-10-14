import type { MediaKind } from './records.ts';
/** One file found under the output directory. */
export interface OutputFile {
    /** File name (no directory). */
    readonly name: string;
    /** Absolute path. */
    readonly path: string;
    /** Media kind derived from the extension. */
    readonly kind: MediaKind;
    /** Size in bytes. */
    readonly bytes: number;
    /** Last modification time (ISO 8601). */
    readonly modifiedAt: string;
}
/** Default page size for the listing. */
export declare const DEFAULT_OUTPUT_LIMIT = 40;
/**
 * List the newest media files in a directory.
 * @param directory - absolute output directory.
 * @param limit - maximum entries to return (newest first).
 * @returns the listing; empty when the directory does not exist.
 */
export declare function listOutputs(directory: string, limit?: number): Promise<OutputFile[]>;
