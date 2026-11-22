// P7-13 (A-174; spec/cancel.md "fal.ai Seedance", OI-51): a paid video run the provider has
// started is charged whether it is stopped or not, so the app lets it finish. job.cancel
// refuses it (cancel.ts) and a close leaves it running for the next open (close-jobs.ts).
// Only a running video_generation row qualifies; every other kind keeps its rules.
import { writeJob, type LiveJob, type RunnerState } from './live'
import { runningResult } from './job-end'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'

const stageOf = (row: JobRow) => {
  const result = row.result
  if (typeof result !== 'object' || result === null || Array.isArray(result)) return undefined
  return (result as Record<string, unknown>).stage
}

// A running video_generation row with a remote ID, of a provider that is not local and whose
// cancel is may_finish, at stage working.
export function leftRunningOnClose(row: JobRow, provider: ProviderInfo | undefined): boolean {
  return (
    row.kind === 'video_generation' &&
    row.status === 'running' &&
    row.remoteJobId !== null &&
    provider !== undefined &&
    !provider.local &&
    provider.cancel === 'may_finish' &&
    stageOf(row) === 'working'
  )
}

// The close lets go of the job: it is not asked to stop and its signal is not fired (the video
// handler would send the provider's cancel). The row stays running with result.leftRunning,
// later writes from this process are dropped, and the runner no longer holds it, so the next
// projectOpened of this project picks it up as a left-over.
export function leaveRunning(state: RunnerState, live: LiveJob): void {
  writeJob(state, live.projectId, live.id, {
    result: { ...runningResult(live), leftRunning: true },
  })
  live.ended = true
  live.clearWait()
  state.active.delete(live.id)
  state.pump()
  for (const listener of [...state.onEnd]) listener()
}
