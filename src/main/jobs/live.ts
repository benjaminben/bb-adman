// The runner's in-memory state (SPEC 3.6 "Jobs"): the jobs it is running now, and the one
// write path for a job row, which emits job.updated after the write.
import type { CoreDeps } from '../core-deps'
import type { BusEvent, CommandBus } from '../commands/bus'
import { readJob, updateJob, type JobChange } from './job-store'
import type { JobKindHandler } from './types'
import type { ProviderInfo } from '../../shared/schemas/queries/app'

export type JobRunnerOptions = {
  // Read when a job runs: core.ts builds CoreDeps and the bus after the runner.
  deps: () => CoreDeps
  bus: () => CommandBus
  emit: (event: BusEvent) => void
  handlers: JobKindHandler[]
  // How long a cancel waits for the provider to confirm (SPEC 6.11.2), by provider ID.
  cancelWaitMs: (providerId: string) => number
}

export type LiveJob = {
  id: string
  projectId: string
  kind: string
  providerId: string
  provider: ProviderInfo | undefined
  controller: AbortController
  // Set once the row has its final status; later writes are dropped.
  ended: boolean
  cancelAsked: boolean
  // The result while running: stage, queuePosition, cancelAsked (SPEC 6.11.1, 6.11.2).
  running: Record<string, unknown>
  // Ends the job at once with the given change, when cancel cannot wait for the handler.
  finish: (change: JobChange) => void
  // Clears the cancel wait, when one is set (SPEC 6.11.2).
  clearWait: () => void
}

export type RunnerState = {
  opts: JobRunnerOptions
  active: Map<string, LiveJob>
  pump: () => void
}

export function nowText(state: RunnerState): string {
  return state.opts.deps().now().toISOString()
}

// Writes one change and emits the stored row. Nothing happens once the project is closed.
export function writeJob(
  state: RunnerState,
  projectId: string,
  id: string,
  change: JobChange,
): void {
  const handle = state.opts.deps().projects.get(projectId)
  if (!handle) return
  updateJob(handle, id, change, nowText(state))
  emitJob(state, projectId, id)
}

export function emitJob(state: RunnerState, projectId: string, id: string): void {
  const handle = state.opts.deps().projects.get(projectId)
  const row = handle ? readJob(handle, id) : null
  if (row) state.opts.emit({ name: 'job.updated', payload: row })
}
