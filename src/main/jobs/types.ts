// SPEC 14 "Contract between the slices" (D and H): the job service on CoreDeps.jobs and the
// job kind handler. Frozen contract (Phase 2 step 0). Slice D built the runner (`runner.ts`).
import type { CoreDeps } from '../core-deps'
import type { ProjectContext } from '../commands/types'
import type { RunProgress } from '../providers/types'
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
  // [1.38] Sets seen_at on each named job that succeeded and has none, inside the calling
  // command's transaction. Emits job.updated for each row it changed, after the command has
  // ended.
  markSeen(ctx: ProjectContext, jobIds: string[]): void
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
  // [1.38] True once a stop was asked for or the job has ended.
  cancelled(): boolean
  // Sends a command through the bus as the user.
  system(command: string, input: unknown): Promise<Result<unknown>>
  // [1.38] What a provider reports while it works. Written into the job: `progress` from
  // `fraction`, and `result.stage`, `result.queuePosition` while the job runs.
  onProgress(p: RunProgress): void
  // [1.38] Stores the provider's own ID for the run in `remote_job_id`, and emits job.updated.
  setRemoteJobId(id: string): void
  // [1.38] What has arrived so far, for example { assetIds: [...] }. Each call replaces the
  // last. It is in `result` while the job runs and stays there if the job does not succeed.
  keep(value: Record<string, unknown>): void
}

export type JobKindHandler = {
  kind: JobKind
  // Returns the value for job.result.
  run(jc: JobRunContext, job: JobRow): Promise<unknown>
}
