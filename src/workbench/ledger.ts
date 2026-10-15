/**
 * Generation → task ledger.
 *
 * Wraps a generation tool so every call lands in the workbench ledger, without
 * editing the tools themselves: the wrapper reads the tool's structured output
 * (it already reports provider, model, path and size) and writes one record.
 *
 * The ledger is *observational*: a store failure is logged and swallowed, never
 * turned into a failed generation — a paid call must not be lost because a JSON
 * write went wrong.
 */
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { GenerationRegistry } from './cancel.ts'
import type { MediaKind } from './records.ts'
import type { TaskPatch, WorkbenchStore } from './store.ts'

/** Fields the ledger can read off a generation tool's structured output. */
export interface GenerationOutcome {
  provider?: string
  model?: string
  prompt?: string
  outputPath?: string
  bytes?: number
}

/**
 * Details the ledger can read off a tool *request*.
 *
 * A running row that says only "running" is useless in the panel, and the model /
 * prompt are known the moment the call starts — recording them makes the row
 * informative while the provider is still working.
 * @param args - the tool's validated arguments.
 * @returns the fields worth filing up front.
 */
export function extractRequest(args: unknown): { model?: string; prompt?: string } {
  if (typeof args !== 'object' || args === null) return {}
  const record = args as Record<string, unknown>
  const out: { model?: string; prompt?: string } = {}
  if (typeof record.model === 'string' && record.model !== '') out.model = record.model
  if (typeof record.prompt === 'string' && record.prompt !== '') out.prompt = record.prompt
  return out
}

/** First string value among the keys a tool might use for its produced file. */
const PATH_KEYS = ['localPath', 'outputPath', 'path', 'videoPath', 'filePath'] as const

/**
 * Pull the ledger-relevant fields out of a tool's structured output.
 * Unknown shapes yield `{}` — the record is still written, just without details.
 * @param value - whatever the tool returned.
 * @returns the extracted outcome.
 */
export function extractOutcome(value: unknown): GenerationOutcome {
  if (typeof value !== 'object' || value === null) return {}
  const record = value as Record<string, unknown>
  const outcome: {
    provider?: string; model?: string; prompt?: string; outputPath?: string; bytes?: number
  } = {}
  if (typeof record.provider === 'string') outcome.provider = record.provider
  if (typeof record.model === 'string') outcome.model = record.model
  if (typeof record.prompt === 'string') outcome.prompt = record.prompt
  for (const key of PATH_KEYS) {
    if (typeof record[key] === 'string' && record[key] !== '') { outcome.outputPath = record[key]; break }
  }
  if (typeof record.bytes === 'number' && Number.isFinite(record.bytes)) outcome.bytes = record.bytes
  return outcome
}

/** How one tool call is filed. */
export interface TaskLedgerOptions {
  readonly store: WorkbenchStore
  readonly kind: MediaKind
  /** Registry that makes the running call cancellable from the workbench. */
  readonly registry: GenerationRegistry
  /** Set when the call belongs to a project from the start (unused today). */
  readonly projectId?: string
  /** Failure reporter; defaults to `console.warn`. */
  readonly onError?: (message: string) => void
}

/** Report a ledger problem, never letting it break the call it describes. */
function report(options: TaskLedgerOptions, message: string): void {
  ;(options.onError ?? ((text: string) => { console.warn(`image-video workbench: ${text}`) }))(message)
}

/** Write the ending of a call onto its record (or open one when that failed). */
async function finish(options: TaskLedgerOptions, taskId: string | undefined, patch: TaskPatch): Promise<void> {
  try {
    if (taskId === undefined) {
      await options.store.recordTask({ kind: options.kind, status: patch.status ?? 'failed', ...patch })
      return
    }
    await options.store.updateTask(taskId, patch)
  } catch (error) {
    report(options, `could not finish ${options.kind} task: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Wrap a tool so each call is recorded in the ledger and can be cancelled.
 *
 * The record is opened as `running` *before* the provider call starts, which is
 * what makes the task visible in the workbench while it runs and gives the
 * cancel endpoint an id to target.
 * @param tool - the tool definition to wrap.
 * @param options - store, registry, media kind and failure reporter.
 * @returns a tool with the same shape, whose calls are recorded and cancellable.
 */
export function withTaskLedger<T extends ToolDefinition>(tool: T, options: TaskLedgerOptions): T {
  const execute = tool.execute.bind(tool)
  const wrapped = {
    ...tool,
    async execute(args: Parameters<typeof execute>[0], exec: Parameters<typeof execute>[1]) {
      const startedAt = new Date().toISOString()
      let taskId: string | undefined
      let controller: AbortController | undefined
      try {
        const running = await options.store.recordTask({
          kind: options.kind, status: 'running', startedAt, ...extractRequest(args),
        })
        taskId = running.id
        controller = options.registry.register(running.id, options.kind, startedAt)
      } catch (error) {
        report(options, `could not open ${options.kind} task record: ${error instanceof Error ? error.message : String(error)}`)
      }

      // 工具自身的中止信号（工具调用超时/取消）与本注册表的取消信号取并集，
      // 这样 UI 的「取消」能真的掐断提交/轮询，而不是只改账本。
      const execSignal = (exec as { signal?: AbortSignal } | undefined)?.signal
      const toolExec = controller === undefined || execSignal === undefined
        ? exec
        : { ...exec, signal: AbortSignal.any([execSignal, controller.signal]) }

      try {
        const value = await execute(args, toolExec)
        await finish(options, taskId, {
          status: (controller?.signal.aborted ?? false) ? 'cancelled' : 'succeeded',
          ...extractOutcome(value),
        })
        return value
      } catch (error) {
        await finish(options, taskId, {
          status: (controller?.signal.aborted ?? false) ? 'cancelled' : 'failed',
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      } finally {
        if (taskId !== undefined) options.registry.release(taskId)
      }
    },
  }
  return wrapped as T
}
