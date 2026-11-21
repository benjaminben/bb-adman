// Closing a project (JobService.cancelAll; SPEC 6.11.2 "Closing a project" [1.38], 3.6 "Jobs"
// item 6). Every signal is fired.
//   queued                                     cancelled at once
//   running, attached kind                     cancelled at once
//   running, background, cancel 'none'         cancelled at once, stoppedWaiting; not asked
//   running, background, any other provider    asked to stop as job.cancel does, then waited
//                                              for; the outcome, or cancelled, outcomeUnknown
// The close waits at most closeWaitMs for the whole project and ends as soon as no job of the
// project is running. Then every job still queued or running is ended at once.
import { activeJobs } from './job-store'
import { writeJob, type LiveJob, type RunnerState } from './live'
import { afterTransaction, askToStop } from './cancel'
import { CLOSE_WAIT_MS } from './cancel-wait'
import type { JobEnd } from './job-end'
import { JOB_KIND_CLASSES } from '../../shared/config/job-kinds'

// The end of a job close does not wait for, or null when its provider is asked and waited for.
function endWithoutWaiting(live: LiveJob): JobEnd | null {
  if (JOB_KIND_CLASSES[live.kind] === 'attached') return { status: 'cancelled' }
  if (live.provider?.cancel === 'none') return { status: 'cancelled', stoppedWaiting: true }
  return null
}

function liveOf(state: RunnerState, projectId: string): LiveJob[] {
  return [...state.active.values()].filter((l) => l.projectId === projectId)
}

function endQueued(state: RunnerState, projectId: string): void {
  const handle = state.opts.deps().projects.get(projectId)
  if (!handle) return
  for (const job of activeJobs(handle)) {
    if (state.active.has(job.id)) continue
    state.enqueued.delete(job.id)
    writeJob(state, projectId, job.id, { status: 'cancelled' })
  }
}

// Resolves when no job of the project is running, or after ms. Leaves no timer or listener.
function waitForProject(state: RunnerState, projectId: string, ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (liveOf(state, projectId).length === 0) return resolve()
    const stop = () => {
      clearTimeout(timer)
      state.onEnd.delete(check)
      resolve()
    }
    const check = () => {
      if (liveOf(state, projectId).length === 0) stop()
    }
    const timer = setTimeout(stop, ms)
    state.onEnd.add(check)
  })
}

export async function cancelAll(state: RunnerState, projectId: string): Promise<void> {
  await afterTransaction()
  if (!state.opts.deps().projects.get(projectId)) return
  // [1.40] SPEC 6.11.2: while the close runs, pump starts no job of this project.
  state.closing.add(projectId)
  try {
    endQueued(state, projectId)
    for (const live of liveOf(state, projectId)) {
      const end = endWithoutWaiting(live)
      if (!end) {
        if (!live.cancelAsked) askToStop(state, live)
        continue
      }
      live.controller.abort()
      live.finish(end)
    }
    await waitForProject(state, projectId, state.opts.closeWaitMs ?? CLOSE_WAIT_MS)
    endQueued(state, projectId)
    for (const live of liveOf(state, projectId)) {
      const end = endWithoutWaiting(live)
      if (!end) live.cancelAsked = true
      live.controller.abort()
      live.finish(end ?? { status: 'cancelled', outcomeUnknown: true })
    }
  } finally {
    state.closing.delete(projectId)
  }
}
