/**
 * Workbench host face: the one RPC channel the browser half calls.
 *
 * The channel carries the connection's result envelope — structured refusals
 * instead of thrown errors — and every answer stays free of credentials and of
 * paths beyond the configured output directory. Today it answers only the
 * health check; the project / asset / task endpoints join the same channel in
 * later phases. The channel name and the health shape live in
 * `src/workbench-contract.ts`, which both halves import, so the browser bundle
 * carries them without pulling in any host code.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the host connection merge (`ctx.connection`) and the handler signature.
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { PLUGIN_VERSION } from '../version.ts'
import { WORKBENCH_RPC_CHANNEL, type WorkbenchHealth } from '../workbench-contract.ts'
import type { WorkbenchStore } from '../workbench/store.ts'
import { listOutputs, type OutputFile } from '../workbench/outputs.ts'
import type { GenerationRegistry } from '../workbench/cancel.ts'
import {
  normalizeMediaKind, normalizeProjectName, normalizeResourceKind, normalizeResourceName,
} from '../workbench/records.ts'

export { WORKBENCH_RPC_CHANNEL }
export type { WorkbenchHealth }

/**
 * What happened when this process tried to register the channel.
 *
 * The failure this surfaces is worth stating plainly: `connection.rpc.handle()`
 * registers its web route on the **context that read the service**, so a caller
 * whose context cannot see `webServer` makes the registration throw — and all the
 * browser half ever sees is `HTTP 405`. Recording it here (and serving it from
 * `/image-video/status`) turns that silent 405 into a readable fact.
 */
export interface WorkbenchRpcStatus {
  /** Channel the workbench registers under. */
  readonly channel: string
  /** `true` once `connection.rpc.handle` returned (the web route exists). */
  readonly registered: boolean
  /** `true` while the plugin is still waiting for the deferred injects. */
  readonly awaiting: boolean
  /** Registration failure message, when it threw. */
  readonly error?: string
}

let status: WorkbenchRpcStatus = { channel: WORKBENCH_RPC_CHANNEL, registered: false, awaiting: false }

/** Read the host-side registration state (served by `/image-video/status`). */
export function workbenchRpcStatus(): WorkbenchRpcStatus {
  return status
}

/** Host facts the channel answers with, plus the store behind the project API. */
export interface WorkbenchRpcDeps {
  /** Configured provider name (`threerouter` | `wanx` | `minimax` | `seedance`). */
  provider: string
  /** Resolved absolute output directory. */
  outputsDir: string
  /** Projects, assets, resources and the task ledger (phase 2). */
  store: WorkbenchStore
  /** In-flight generations the workbench may cancel. */
  registry: GenerationRegistry
}

/**
 * Build the channel handler.
 * @param deps - host facts the answers are built from.
 * @returns the connection RPC handler.
 */
export function createWorkbenchHandler(deps: WorkbenchRpcDeps): ConnectionRpcHandler {
  return async (endpoint, payload) => {
    try {
      const value = await answer(deps, endpoint, payload)
      return { ok: true, value }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        error: {
          code: message.startsWith('unknown workbench endpoint') ? 'workbench/unknown-endpoint'
            : message.startsWith('invalid workbench payload') ? 'workbench/invalid-payload'
            : 'workbench/failed',
          message,
          details: {},
        },
      }
    }
  }
}

/**
 * Answer one endpoint. Payloads are read field by field through {@link field}, so a
 * malformed request fails with a named error instead of a TypeError deep in the store.
 * @param deps - host facts.
 * @param endpoint - channel-relative endpoint.
 * @param payload - raw request payload.
 * @returns the endpoint's value.
 */
async function answer(deps: WorkbenchRpcDeps, endpoint: string, payload: unknown): Promise<unknown> {
  switch (endpoint) {
    case 'health': {
      const value: WorkbenchHealth = {
        plugin: 'dsh-image-video',
        version: PLUGIN_VERSION,
        channel: WORKBENCH_RPC_CHANNEL,
        provider: deps.provider,
        outputsDir: deps.outputsDir,
        at: new Date().toISOString(),
      }
      return value
    }
    // ---- 阶段 2 首个切片：项目 / 素材 / 产物清单 ----------------------------------
    case 'projects/list':
      return { projects: await deps.store.listProjects() }
    case 'projects/create':
      // 校验放在 handler 这层，错误码才能准确报成 invalid-payload（store 仍持有规则本身）
      return { project: await deps.store.createProject(validated(() => normalizeProjectName(field(payload, 'name')))) }
    case 'projects/remove':
      return { removed: await deps.store.removeProject(text(payload, 'id')) }
    case 'assets/list':
      return { assets: await deps.store.listAssets(text(payload, 'projectId')) }
    case 'assets/attach': {
      const attached = await deps.store.attachAsset({
        projectId: text(payload, 'projectId'),
        path: text(payload, 'path'),
        kind: validated(() => normalizeMediaKind(text(payload, 'kind'))),
        bytes: optionalNumber(payload, 'bytes'),
        provider: optionalText(payload, 'provider'),
        model: optionalText(payload, 'model'),
        prompt: optionalText(payload, 'prompt'),
      })
      return attached
    }
    case 'assets/remove':
      return { removed: await deps.store.removeAsset(text(payload, 'id')) }
    case 'projects/rename': {
      const id = text(payload, 'id')
      const project = await deps.store.renameProject(id, validated(() => normalizeProjectName(field(payload, 'name'))))
      if (project === undefined) throw new Error(`unknown project: ${id}`)
      return { project }
    }
    // ---- 创作资源（阶段 2）------------------------------------------------------
    case 'resources/list': {
      const kind = optionalText(payload, 'kind')
      const resources = await deps.store.listResources(
        text(payload, 'projectId'),
        kind === undefined ? undefined : validated(() => normalizeResourceKind(kind)),
      )
      return { resources }
    }
    case 'resources/create':
      return {
        resource: await deps.store.createResource({
          projectId: text(payload, 'projectId'),
          kind: validated(() => normalizeResourceKind(text(payload, 'kind'))),
          name: validated(() => normalizeResourceName(field(payload, 'name'))),
          note: optionalText(payload, 'note'),
        }),
      }
    case 'resources/remove':
      return { removed: await deps.store.removeResource(text(payload, 'id')) }
    case 'tasks/list': {
      const limit = optionalNumber(payload, 'limit')
      const projectId = optionalText(payload, 'projectId')
      return { tasks: await deps.store.listTasks(limit ?? undefined, projectId) }
    }
    // ---- 工作流文档（阶段 4）----------------------------------------------------
    case 'workflows/list':
      return { workflows: await deps.store.listWorkflows(text(payload, 'projectId')) }
    case 'workflows/save':
      return {
        workflow: await deps.store.saveWorkflow({
          id: optionalText(payload, 'id'),
          projectId: text(payload, 'projectId'),
          name: optionalText(payload, 'name'),
          nodes: field(payload, 'nodes') ?? [],
          edges: field(payload, 'edges') ?? [],
        }),
      }
    case 'workflows/remove':
      return { removed: await deps.store.removeWorkflow(text(payload, 'id')) }
    // ---- 维护：把幂等上线前留下的重复素材记录合并 -------------------------------
    case 'maintenance/compact':
      return { removed: await deps.store.compactAssets() }
    case 'tasks/cancel':
      return { cancelled: deps.registry.cancel(text(payload, 'id')) }
    case 'tasks/running':
      return { running: deps.registry.list() }
    case 'tasks/assign': {
      const id = text(payload, 'id')
      const task = await deps.store.updateTask(id, { projectId: text(payload, 'projectId') })
      if (task === undefined) throw new Error(`unknown task: ${id}`)
      return { task }
    }
    case 'outputs/list': {
      const limit = optionalNumber(payload, 'limit')
      const outputs: OutputFile[] = await listOutputs(deps.outputsDir, limit ?? undefined)
      return { outputs, directory: deps.outputsDir }
    }
    default:
      throw new Error(`unknown workbench endpoint: ${endpoint}`)
  }
}

/**
 * Run a payload validation, re-tagging its failure so the client sees
 * `workbench/invalid-payload` instead of a generic failure.
 * @param validate - validator to run.
 * @returns the validated value.
 */
function validated<T>(validate: () => T): T {
  try {
    return validate()
  } catch (error) {
    throw new Error(`invalid workbench payload: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Read one required string field. */
function text(payload: unknown, key: string): string {
  const value = field(payload, key)
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`invalid workbench payload: ${key} must be a non-empty string`)
  }
  return value
}

/** Read one optional string field. */
function optionalText(payload: unknown, key: string): string | undefined {
  const value = field(payload, key)
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(`invalid workbench payload: ${key} must be a string`)
  return value
}

/** Read one optional number field. */
function optionalNumber(payload: unknown, key: string): number | undefined {
  const value = field(payload, key)
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`invalid workbench payload: ${key} must be a finite number`)
  }
  return value
}

/** Read one field out of an untyped payload. */
function field(payload: unknown, key: string): unknown {
  if (typeof payload !== 'object' || payload === null) {
    if (payload === undefined) return undefined
    throw new Error('invalid workbench payload: expected an object')
  }
  return (payload as Record<string, unknown>)[key]
}

/**
 * Register the channel on this plugin's fiber: the disposer lifts it on unload,
 * so a disabled plugin leaves no callable endpoint behind.
 * @param ctx - host context already carrying the `connection` service.
 * @param deps - host facts the answers are built from.
 */
export function registerWorkbenchRpc(ctx: Context, deps: WorkbenchRpcDeps): void {
  status = { ...status, awaiting: true }
  ctx.effect(() => {
    const connection = ctx.get('connection')
    // Effect callbacks must hand back a disposer; with no connection there is
    // nothing to lift, so the channel simply never exists.
    if (connection === undefined) return () => {}
    try {
      const remove = connection.rpc.handle(WORKBENCH_RPC_CHANNEL, createWorkbenchHandler(deps))
      status = { channel: WORKBENCH_RPC_CHANNEL, registered: true, awaiting: false }
      return () => {
        status = { channel: WORKBENCH_RPC_CHANNEL, registered: false, awaiting: false }
        void remove()
      }
    } catch (error) {
      // 不抛出：注册失败不该连累工具与既有路由，但必须被记录（见 WorkbenchRpcStatus）。
      status = {
        channel: WORKBENCH_RPC_CHANNEL,
        registered: false,
        awaiting: false,
        error: error instanceof Error ? error.message : String(error),
      }
      return () => {}
    }
  }, 'dsh-image-video: workbench RPC channel')
}
