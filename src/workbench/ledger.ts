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
import type { MediaKind, TaskStatus } from './records.ts'
import type { TaskInput, WorkbenchStore } from './store.ts'

/** Fields the ledger can read off a generation tool's structured output. */
export interface GenerationOutcome {
  provider?: string
  model?: string
  prompt?: string
  outputPath?: string
  bytes?: number
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
  /** Set when the call belongs to a project from the start (unused today). */
  readonly projectId?: string
  /** Failure reporter; defaults to `console.warn`. */
  readonly onError?: (message: string) => void
}

/** Write one record, never letting the ledger break the call it describes. */
async function file(options: TaskLedgerOptions, input: Omit<TaskInput, 'kind'>): Promise<void> {
  try {
    await options.store.recordTask({ ...input, kind: options.kind, ...options.projectId === undefined ? {} : { projectId: options.projectId } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ;(options.onError ?? ((text: string) => { console.warn(`image-video workbench: ${text}`) }))(
      `could not record ${options.kind} task: ${message}`,
    )
  }
}

/**
 * Wrap a tool so each call is recorded in the ledger.
 * @param tool - the tool definition to wrap.
 * @param options - store, media kind and failure reporter.
 * @returns a tool with the same shape, whose calls are recorded.
 */
export function withTaskLedger<T extends ToolDefinition>(tool: T, options: TaskLedgerOptions): T {
  const execute = tool.execute.bind(tool)
  const wrapped = {
    ...tool,
    async execute(args: Parameters<typeof execute>[0], exec: Parameters<typeof execute>[1]) {
      const startedAt = new Date().toISOString()
      try {
        const value = await execute(args, exec)
        await file(options, { status: 'succeeded' satisfies TaskStatus, startedAt, ...extractOutcome(value) })
        return value
      } catch (error) {
        await file(options, {
          status: 'failed' satisfies TaskStatus,
          startedAt,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  }
  return wrapped as T
}
