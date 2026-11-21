// Cancel (SPEC 6.11.2). Built in the next unit of slice D.
import type { RunnerState } from './live'

export async function cancelJob(_state: RunnerState, _projectId: string, _jobId: string) {
  throw new Error('cancel is not built yet')
}

export async function cancelAll(_state: RunnerState, _projectId: string) {
  throw new Error('cancelAll is not built yet')
}
