// Cancel (SPEC 6.11.2 [REQ: FR-281, FR-270], 3.6 "Jobs" item 4). cancelJob starts after the
// calling command's transaction has ended, like every other runner write. Close: close-jobs.ts.
//   queued                                 cancelled at once, every provider
//   running, attached kind                 cancelled at once; the app stops waiting
//   running, background, cancel 'none'     refused: cancel_not_supported
//   running, background, stops/may_finish  result.cancelAsked, signal fired, then the outcome:
//     the handler ends ProviderCancelled   cancelled                ("stopped")
//     the handler returns its result       succeeded, finishedAfterCancel
//     nothing within the provider's wait   cancelled, outcomeUnknown
// The runner calls no adapter: a video job's cancel(remoteJobId) call is made by the video job
// kind handler when the signal fires (SPEC 6.11.2, "How the runner learns the outcome").
import { readJob } from './job-store'
import { writeJob, type LiveJob, type RunnerState } from './live'
import { cancelWaitFor } from './cancel-wait'
import { runningResult } from './job-end'
import { JOB_KIND_CLASSES } from '../../shared/config/job-kinds'
import type { ProviderInfo } from '../../shared/schemas/queries/app'
import type { JobRow } from '../../shared/schemas/rows/job'
import { AppError } from '../../shared/schemas/result'

export const JOB_ENDED_MESSAGE = 'This job has already ended.'

export const afterTransaction = () => Promise.resolve()

// The refusal for job.cancel on this row, or null when it may be cancelled.
export function cancelRefusal(row: JobRow, provider: ProviderInfo | undefined): AppError | null {
  if (row.status !== 'queued' && row.status !== 'running') {
    return new AppError('RULE_VIOLATION', JOB_ENDED_MESSAGE, { reason: 'job_wrong_state' })
  }
  const background = JOB_KIND_CLASSES[row.kind] === 'background'
  if (row.status === 'running' && background && provider?.cancel === 'none') {
    const label = provider.label
    return new AppError('RULE_VIOLATION', `${label} cannot stop a request once it is sent.`, {
      reason: 'cancel_not_supported',
    })
  }
  return null
}

// Asks the provider to stop, as job.cancel does, and starts the provider's wait.
export function askToStop(state: RunnerState, live: LiveJob): void {
  live.cancelAsked = true
  writeJob(state, live.projectId, live.id, { result: runningResult(live) })
  live.controller.abort()
  const waitMs = (state.opts.cancelWaitMs ?? cancelWaitFor)(live.providerId)
  const timer = setTimeout(() => {
    live.finish({ status: 'cancelled', outcomeUnknown: true })
  }, waitMs)
  live.clearWait = () => clearTimeout(timer)
}

export async function cancelJob(state: RunnerState, projectId: string, jobId: string) {
  await afterTransaction()
  const deps = state.opts.deps()
  const handle = deps.projects.requireOpen(projectId)
  const row = readJob(handle, jobId, deps.log)
  if (!row) throw new AppError('NOT_FOUND', 'That job is not in this project.', { jobId })
  const refusal = cancelRefusal(
    row,
    deps.providers.find((p) => p.id === row.provider),
  )
  if (refusal) throw refusal
  const live = state.active.get(jobId)
  if (!live) {
    state.enqueued.delete(jobId)
    return writeJob(state, projectId, jobId, { status: 'cancelled' })
  }
  if (JOB_KIND_CLASSES[row.kind] === 'attached') return live.finish({ status: 'cancelled' })
  if (!live.cancelAsked) askToStop(state, live)
}
