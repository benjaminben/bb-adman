// Cancel (SPEC 6.11.2 [REQ: FR-281, FR-270], 3.6 "Jobs" items 4 and 6). Both functions start
// after the calling command's transaction has ended, like every other runner write.
//   queued                                 cancelled at once, every provider
//   running, attached kind                 cancelled at once; the app stops waiting
//   running, background, cancel 'none'     refused: cancel_not_supported
//   running, background, stops/may_finish  result.cancelAsked, signal fired, then the outcome:
//     the handler ends ProviderCancelled   cancelled                ("stopped")
//     the handler returns its result       succeeded, finishedAfterCancel
//     nothing within the provider's wait   cancelled, outcomeUnknown
// A video job's cancel(remoteJobId) call waits for CU-6, which writes remote_job_id.
import { activeJobs, readJob } from './job-store'
import { writeJob, type LiveJob, type RunnerState } from './live'
import { JOB_KIND_CLASSES } from '../../shared/config/job-kinds'
import type { ProviderInfo } from '../../shared/schemas/queries/app'
import type { JobRow } from '../../shared/schemas/rows/job'
import { AppError } from '../../shared/schemas/result'

export const JOB_ENDED_MESSAGE = 'This job has already ended.'

const afterTransaction = () => Promise.resolve()

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

function askToStop(state: RunnerState, live: LiveJob): void {
  live.cancelAsked = true
  live.running = { ...live.running, cancelAsked: true }
  writeJob(state, live.projectId, live.id, { result: live.running })
  live.controller.abort()
  const timer = setTimeout(() => {
    live.finish({ status: 'cancelled', result: { ...live.running, outcomeUnknown: true } })
  }, state.opts.cancelWaitMs(live.providerId))
  live.clearWait = () => clearTimeout(timer)
}

export async function cancelJob(state: RunnerState, projectId: string, jobId: string) {
  await afterTransaction()
  const deps = state.opts.deps()
  const handle = deps.projects.requireOpen(projectId)
  const row = readJob(handle, jobId)
  if (!row) throw new AppError('NOT_FOUND', 'That job is not in this project.', { jobId })
  const refusal = cancelRefusal(
    row,
    deps.providers.find((p) => p.id === row.provider),
  )
  if (refusal) throw refusal
  const live = state.active.get(jobId)
  if (!live) return writeJob(state, projectId, jobId, { status: 'cancelled' })
  if (JOB_KIND_CLASSES[row.kind] === 'attached') return live.finish({ status: 'cancelled' })
  if (!live.cancelAsked) askToStop(state, live)
}

// Closing the project: nothing can wait, so every running job ends now. Its signal is fired
// and, as no provider confirmed, its outcome is unknown.
export async function cancelAll(state: RunnerState, projectId: string) {
  await afterTransaction()
  const handle = state.opts.deps().projects.get(projectId)
  if (!handle) return
  for (const job of activeJobs(handle)) {
    const live = state.active.get(job.id)
    if (!live) {
      writeJob(state, projectId, job.id, { status: 'cancelled' })
      continue
    }
    live.cancelAsked = true
    live.controller.abort()
    const result = { ...live.running, cancelAsked: true, outcomeUnknown: true }
    live.finish({ status: 'cancelled', result })
  }
}
