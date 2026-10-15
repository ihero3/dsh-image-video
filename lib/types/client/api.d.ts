/**
 * The browser half's typed face over the `/image-video` channel.
 *
 * Endpoint names and result shapes are mirrored by hand (the host half is a
 * different bundle), so this file is the single place the client names them —
 * `tests/client-rpc-transport.test.ts` pins the channel and the route form, and
 * the host handler's own tests pin the payloads.
 */
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
import { type WorkbenchHealth } from '../workbench-contract.ts';
import type { AssetRecord, MediaKind, ProjectRecord, ResourceKind, ResourceRecord, TaskRecord } from '../workbench/records.ts';
import type { OutputFile } from '../workbench/outputs.ts';
/** What the workbench UI may ask the host (phase 2, first slice). */
export interface WorkbenchApi {
    /** Host facts (version, provider, output directory). */
    health: () => Promise<WorkbenchHealth>;
    /** Every project, newest first. */
    listProjects: () => Promise<ProjectRecord[]>;
    /** Create a project from a user-supplied name. */
    createProject: (name: string) => Promise<ProjectRecord>;
    /** Remove a project (records only; media files stay on disk). */
    removeProject: (id: string) => Promise<boolean>;
    /** One project's assets, newest first. */
    listAssets: (projectId: string) => Promise<AssetRecord[]>;
    /** Register an existing output file as an asset of a project. */
    attachAsset: (input: {
        projectId: string;
        path: string;
        kind: MediaKind;
        bytes?: number;
        provider?: string;
        model?: string;
        prompt?: string;
    }) => Promise<{
        asset: AssetRecord;
        created: boolean;
    }>;
    /** Remove one asset record. */
    removeAsset: (id: string) => Promise<boolean>;
    /** Rename a project. */
    renameProject: (id: string, name: string) => Promise<ProjectRecord>;
    /** One project's resources, newest first (optionally one kind). */
    listResources: (projectId: string, kind?: ResourceKind) => Promise<ResourceRecord[]>;
    /** Create a resource inside a project. */
    createResource: (input: {
        projectId: string;
        kind: ResourceKind;
        name: string;
        note?: string;
    }) => Promise<ResourceRecord>;
    /** Remove one resource record. */
    removeResource: (id: string) => Promise<boolean>;
    /** Recorded generations, newest first. */
    listTasks: (limit?: number) => Promise<TaskRecord[]>;
    /** Cancel one running generation (aborts the provider call). */
    cancelTask: (id: string) => Promise<boolean>;
    /** File a recorded generation into a project. */
    assignTask: (id: string, projectId: string) => Promise<TaskRecord>;
    /** Newest media files under the output directory. */
    listOutputs: (limit?: number) => Promise<OutputFile[]>;
}
/**
 * Build the API over a client connection.
 * @param connection - the client connection handle (`ctx.get('connection')`).
 * @returns the typed API.
 */
export declare function createWorkbenchApi(connection: ConnectionHandle): WorkbenchApi;
