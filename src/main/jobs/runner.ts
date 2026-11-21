// The job runner (SPEC 3.6 "Jobs", 6.11; SPEC 14 slice D). Takes queued jobs oldest first,
// at most JOBS_AT_ONCE_PER_PROVIDER per provider across open projects, and is the only writer
// of job rows. The row is inserted inside the calling command's transaction; the runner looks
// at it only after that transaction has ended, so a command that fails starts nothing.
import { ulid } from 'ulid'
import { activeJobs, insertQueued, markSeenRow, readJob } from './job-store'
import { emitJob, nowText, type JobRunnerOptions, type RunnerState } from './live'
import { startJob } from './run-job'
import { projectOpened } from './start-up'
import { cancelJob } from './cancel'
import { cancelAll } from './close-jobs'
import type { JobService } from './types'
import { JOBS_AT_ONCE_PER_PROVIDER } from '../../shared/config/job-kinds'

export { runOptions } from './progress'
export type { JobRunnerOptions }

export function createJobRunner(opts: JobRunnerOptions): JobService {
  const state: RunnerState = {
    opts,
    active: new Map(),
    enqueued: new Set(),
    pump,
    onEnd: new Set(),
  }

  function runningFor(providerId: string): number {
    let n = 0
    for (const live of state.active.values()) if (live.providerId === providerId) n++
    return n
  }

  // SPEC 3.6 "Jobs" item 2 [1.38]: only a queued row this process enqueued is ever started.
  function pump(): void {
    for (const handle of opts.deps().projects.all()) {
      for (const job of activeJobs(handle)) {
        if (job.status !== 'queued' || !state.enqueued.has(job.id)) continue
        if (runningFor(job.provider ?? '') >= JOBS_AT_ONCE_PER_PROVIDER) continue
        const row = readJob(handle, job.id)
        if (row) startJob(state, handle.projectId, row)
      }
    }
  }

  return {
    enqueue(ctx, req) {
      const id = ulid()
      insertQueued(ctx.project, id, req, nowText(state))
      state.enqueued.add(id)
      // Runs once the command's transaction has ended; a rolled-back row is not there.
      queueMicrotask(() => {
        if (!readJob(ctx.project, id)) state.enqueued.delete(id)
        emitJob(state, ctx.project.projectId, id)
        pump()
      })
      return id
    },
    markSeen(ctx, jobIds) {
      const now = nowText(state)
      const marked = jobIds.filter((id) => markSeenRow(ctx.project, id, now))
      // After the command's transaction: a rolled-back mark leaves seenAt null, and no event.
      queueMicrotask(() => {
        for (const id of marked) {
          if (readJob(ctx.project, id)?.seenAt) emitJob(state, ctx.project.projectId, id)
        }
      })
    },
    cancel: (projectId, jobId) => cancelJob(state, projectId, jobId),
    cancelAll: (projectId) => cancelAll(state, projectId),
    activeCount(projectId) {
      const handle = opts.deps().projects.get(projectId)
      return handle ? activeJobs(handle).length : 0
    },
    async projectOpened(projectId) {
      projectOpened(state, projectId)
      pump()
    },
  }
}
