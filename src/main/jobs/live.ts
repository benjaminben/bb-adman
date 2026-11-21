// The runner's in-memory state (SPEC 3.6 "Jobs"): the jobs it is running now, and the one
// write path for a job row, which emits job.updated after the write.
import type { CoreDeps } from '../core-deps'
import type { BusEvent, CommandBus } from '../commands/bus'
import { readJob, updateJob, type JobChange } from './job-store'
import type { JobKindHandler } from './types'
import type { JobEnd } from './job-end'
import type { JobKind } from '../../shared/config/job-kinds'
import type { ProviderInfo } from '../../shared/schemas/queries/app'

export type JobRunnerOptions = {
  // Read when a job runs: core.ts builds CoreDeps and the bus after the runner.
  deps: () => CoreDeps
  bus: () => CommandBus
  emit: (event: BusEvent) => void
  handlers: JobKindHandler[]
  // How long a cancel waits for the provider to confirm, by provider ID, and how long a close
  // waits (SPEC 6.11.2). For tests; left out, the runner uses cancel-wait.ts.
  cancelWaitMs?: (providerId: string) => number
  closeWaitMs?: number
}

export type LiveJob = {
  id: string
  projectId: string
  kind: JobKind
  providerId: string
  provider: ProviderInfo | undefined
  controller: AbortController
  // Set once the row has its final status; later writes are dropped.
  ended: boolean
  cancelAsked: boolean
  // What the handler kept through jc.keep, and the provider's stage and queue position
  // (SPEC 6.11.1 [1.38]). job-end.ts builds the result from them.
  kept: Record<string, unknown>
  shown: { stage?: string; queuePosition?: number }
  // Ends the job once, through endChange; later calls do nothing.
  finish: (end: JobEnd) => void
  // Clears the cancel wait, when one is set (SPEC 6.11.2).
  clearWait: () => void
}

export type RunnerState = {
  opts: JobRunnerOptions
  active: Map<string, LiveJob>
  // IDs this process enqueued and has not yet started or ended (SPEC 3.6 "Jobs" item 2).
  enqueued: Set<string>
  pump: () => void
  // Called after every end of a job; the close wait listens here (close-jobs.ts).
  onEnd: Set<() => void>
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
