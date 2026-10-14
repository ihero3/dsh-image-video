/**
 * In-flight generation registry: the seam that makes "cancel" real.
 *
 * A workbench cancel must abort the *provider call* (a long video job keeps
 * billing until it is truly stopped), so the ledger wrapper registers a private
 * `AbortController` per running generation and hands the tool a *combined*
 * signal (the tool's own execution signal plus this one). Cancelling flips the
 * controller; the tool's submit/poll path sees an aborted signal and unwinds, and
 * the wrapper records `cancelled` instead of `failed`.
 *
 * The registry is process-local and in-memory on purpose: a generation cannot
 * outlive the process that owns its HTTP request, and a stale entry would only
 * invite the UI to cancel something that no longer exists.
 */
import type { MediaKind, TaskStatus } from './records.ts'

/** One generation that can still be cancelled. */
export interface RunningGeneration {
  readonly id: string
  readonly kind: MediaKind
  /** When the call started (ISO 8601). */
  readonly startedAt: string
}

/** Outcome the ledger should file when a call ends. */
export interface GenerationEnding {
  readonly status: Extract<TaskStatus, 'succeeded' | 'failed' | 'cancelled'>
}

/** Running generations, keyed by their ledger task id. */
export class GenerationRegistry {
  private readonly running = new Map<string, { controller: AbortController; kind: MediaKind; startedAt: string }>()

  /**
   * Register a generation and mint the controller that cancels it.
   * @param id - ledger task id.
   * @param kind - media kind.
   * @param startedAt - ISO stamp the call started at.
   * @returns the controller whose signal the tool must honour.
   */
  register(id: string, kind: MediaKind, startedAt: string): AbortController {
    const controller = new AbortController()
    this.running.set(id, { controller, kind, startedAt })
    return controller
  }

  /**
   * Forget a generation (called when the call ends, however it ends).
   * @param id - ledger task id.
   */
  release(id: string): void {
    this.running.delete(id)
  }

  /**
   * Cancel one running generation.
   * @param id - ledger task id.
   * @returns `true` when something was actually cancelled.
   */
  cancel(id: string): boolean {
    const entry = this.running.get(id)
    if (entry === undefined) return false
    entry.controller.abort(new Error('cancelled from the workbench'))
    return true
  }

  /** Snapshot of what can be cancelled right now, newest first. */
  list(): RunningGeneration[] {
    return [...this.running.entries()]
      .map(([id, entry]) => ({ id, kind: entry.kind, startedAt: entry.startedAt }))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
  }

  /** How many generations are running. */
  get size(): number {
    return this.running.size
  }

  /**
   * Map the ending of a call onto a ledger status.
   * @param cancelled - whether our controller was the reason it stopped.
   * @returns the status to file.
   */
  ending(cancelled: boolean): GenerationEnding {
    return { status: cancelled ? 'cancelled' : 'succeeded' }
  }
}
