// SPEC 3.6 "Jobs" item 6: on opening a project, every job left queued or running by a
// process that is gone. A video job with a remote run ID is resumed; a ComfyUI job is never
// picked up, because the app does not contact the ComfyUI address on open [1.24]; a queued
// job is cancelled (it sent nothing); any other running job failed as interrupted.
import { activeJobs, readJob, type JobChange } from './job-store'
import { endUnreadable, writeJob, type RunnerState } from './live'
import { startJob } from './run-job'
import type { JobRow } from '../../shared/schemas/rows/job'

export const INTERRUPTED = 'interrupted'

function resumable(state: RunnerState, row: JobRow): boolean {
  return (
    row.kind === 'video_generation' &&
    row.remoteJobId !== null &&
    state.opts.handlers.some((h) => h.kind === row.kind)
  )
}

function endOf(row: JobRow): JobChange {
  if (row.provider === 'comfyui') {
    return {
      status: 'failed',
      errorKind: 'offline',
      errorReason: 'lost_contact',
      errorDetail: INTERRUPTED,
    }
  }
  if (row.status === 'queued') return { status: 'cancelled' }
  return { status: 'failed', errorKind: 'other', errorReason: null, errorDetail: INTERRUPTED }
}

export function projectOpened(state: RunnerState, projectId: string): void {
  const handle = state.opts.deps().projects.get(projectId)
  if (!handle) return
  for (const job of activeJobs(handle)) {
    // [1.38] A row this process enqueued or is running is its own, not a left-over (Y15).
    if (state.active.has(job.id) || state.enqueued.has(job.id)) continue
    const row = readJob(handle, job.id, state.opts.deps().log)
    if (!row) {
      endUnreadable(state, handle, job.id)
      continue
    }
    if (row.provider !== 'comfyui' && resumable(state, row)) startJob(state, projectId, row)
    else writeJob(state, projectId, row.id, endOf(row))
  }
}
