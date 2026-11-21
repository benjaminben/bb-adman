// SPEC 14 "Contract between the slices" (D and H): the job service on CoreDeps.jobs and the
// job kind handler. Frozen contract (Phase 2 step 0). Slice D builds the runner; core.ts
// holds a stand-in until then.
import type { CoreDeps } from '../core-deps'
import type { ProjectContext } from '../commands/types'
import type { JobKind } from '../../shared/config/job-kinds'
import type { JobRow } from '../../shared/schemas/rows/job'
import type { Result } from '../../shared/schemas/result'

export type EnqueueRequest = {
  kind: JobKind
  campaignId: string | null
  variantId: string | null
  layerId: string | null
  slot: string | null
  provider: string
  model: string
  request: unknown // JSON, enough to retry
  // [1.35] SPEC 6.11.1: who started the run. Required: every caller says.
  startedBy: 'user' | 'agent'
}

export type JobService = {
  // Inserts the queued row inside the calling command's transaction and returns the job
  // ID. The runner starts the job after the command has succeeded.
  enqueue(ctx: ProjectContext, job: EnqueueRequest): string
  cancel(projectId: string, jobId: string): Promise<void>
  cancelAll(projectId: string): Promise<void>
  activeCount(projectId: string): number
  projectOpened(projectId: string): Promise<void>
}

export type JobRunContext = {
  deps: CoreDeps
  projectId: string
  // [1.24] Fired by job.cancel; handed to the provider as RunOptions.signal (SPEC 6.11.2).
  signal: AbortSignal
  // Runs one provider call: adds one to paid_calls when the provider's `local` is false
  // (SPEC 6.11.1), and turns a ProviderFailure into the job's error kind.
  call<T>(fn: () => Promise<T>): Promise<T>
  progress(fraction: number): void
  cancelled(): boolean
  // Sends a command through the bus as the user.
  system(command: string, input: unknown): Promise<Result<unknown>>
}

export type JobKindHandler = {
  kind: JobKind
  // Returns the value for job.result.
  run(jc: JobRunContext, job: JobRow): Promise<unknown>
}
