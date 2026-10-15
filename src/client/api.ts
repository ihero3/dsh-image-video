/**
 * The browser half's typed face over the `/image-video` channel.
 *
 * Endpoint names and result shapes are mirrored by hand (the host half is a
 * different bundle), so this file is the single place the client names them —
 * `tests/client-rpc-transport.test.ts` pins the channel and the route form, and
 * the host handler's own tests pin the payloads.
 */
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { WORKBENCH_RPC_CHANNEL, type WorkbenchHealth } from '../workbench-contract.ts'
import type { AssetRecord, MediaKind, ProjectRecord, ResourceKind, ResourceRecord, TaskRecord } from '../workbench/records.ts'
import type { OutputFile } from '../workbench/outputs.ts'

/** What the workbench UI may ask the host (phase 2, first slice). */
export interface WorkbenchApi {
  /** Host facts (version, provider, output directory). */
  health: () => Promise<WorkbenchHealth>
  /** Every project, newest first. */
  listProjects: () => Promise<ProjectRecord[]>
  /** Create a project from a user-supplied name. */
  createProject: (name: string) => Promise<ProjectRecord>
  /** Remove a project (records only; media files stay on disk). */
  removeProject: (id: string) => Promise<boolean>
  /** One project's assets, newest first. */
  listAssets: (projectId: string) => Promise<AssetRecord[]>
  /** Register an existing output file as an asset of a project. */
  attachAsset: (input: {
    projectId: string
    path: string
    kind: MediaKind
    bytes?: number
    provider?: string
    model?: string
    prompt?: string
  }) => Promise<{ asset: AssetRecord; created: boolean }>
  /** Remove one asset record. */
  removeAsset: (id: string) => Promise<boolean>
  /** Rename a project. */
  renameProject: (id: string, name: string) => Promise<ProjectRecord>
  /** One project's resources, newest first (optionally one kind). */
  listResources: (projectId: string, kind?: ResourceKind) => Promise<ResourceRecord[]>
  /** Create a resource inside a project. */
  createResource: (input: {
    projectId: string
    kind: ResourceKind
    name: string
    note?: string
  }) => Promise<ResourceRecord>
  /** Remove one resource record. */
  removeResource: (id: string) => Promise<boolean>
  /** Recorded generations, newest first. */
  listTasks: (limit?: number) => Promise<TaskRecord[]>
  /** Cancel one running generation (aborts the provider call). */
  cancelTask: (id: string) => Promise<boolean>
  /** File a recorded generation into a project. */
  assignTask: (id: string, projectId: string) => Promise<TaskRecord>
  /** Newest media files under the output directory. */
  listOutputs: (limit?: number) => Promise<OutputFile[]>
}

/**
 * Build the API over a client connection.
 * @param connection - the client connection handle (`ctx.get('connection')`).
 * @returns the typed API.
 */
export function createWorkbenchApi(connection: ConnectionHandle): WorkbenchApi {
  /** Call one endpoint and unwrap the connection result envelope. */
  async function call<T>(endpoint: string, payload: unknown = {}): Promise<T> {
    const result = await connection.rpc.call(WORKBENCH_RPC_CHANNEL, endpoint, payload)
    if (!result.ok) throw new Error(result.error?.message ?? `workbench ${endpoint} failed`)
    return result.value as T
  }
  return {
    health: () => call<WorkbenchHealth>('health'),
    listProjects: async () => (await call<{ projects: ProjectRecord[] }>('projects/list')).projects,
    createProject: async name => (await call<{ project: ProjectRecord }>('projects/create', { name })).project,
    removeProject: async id => (await call<{ removed: boolean }>('projects/remove', { id })).removed,
    listAssets: async projectId => (await call<{ assets: AssetRecord[] }>('assets/list', { projectId })).assets,
    attachAsset: input => call<{ asset: AssetRecord; created: boolean }>('assets/attach', input),
    removeAsset: async id => (await call<{ removed: boolean }>('assets/remove', { id })).removed,
    renameProject: async (id, name) => (await call<{ project: ProjectRecord }>('projects/rename', { id, name })).project,
    listResources: async (projectId, kind) =>
      (await call<{ resources: ResourceRecord[] }>('resources/list', { projectId, kind })).resources,
    createResource: async input => (await call<{ resource: ResourceRecord }>('resources/create', input)).resource,
    removeResource: async id => (await call<{ removed: boolean }>('resources/remove', { id })).removed,
    listTasks: async limit => (await call<{ tasks: TaskRecord[] }>('tasks/list', { limit })).tasks,
    cancelTask: async id => (await call<{ cancelled: boolean }>('tasks/cancel', { id })).cancelled,
    assignTask: async (id, projectId) => (await call<{ task: TaskRecord }>('tasks/assign', { id, projectId })).task,
    listOutputs: async limit => (await call<{ outputs: OutputFile[] }>('outputs/list', { limit })).outputs,
  }
}
