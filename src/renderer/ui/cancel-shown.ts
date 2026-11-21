// Whether a run's row offers Cancel (spec/cancel.md "job.cancel"). It is true exactly when
// cancelRefusal in src/main/jobs/cancel.ts accepts the job: queued on any provider; running,
// unless it is a background job other than pictures on a provider whose cancel is 'none'.
// A test holds the two to the same answer for every kind, status and provider.
import { JOB_KIND_CLASSES } from '@/shared/config/job-kinds'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'

export function cancelShown(row: JobRow, provider: ProviderInfo | undefined): boolean {
  if (row.status === 'queued') return true
  if (row.status !== 'running') return false
  if (provider?.cancel !== 'none') return true
  return row.kind === 'image_generation' || JOB_KIND_CLASSES[row.kind] === 'attached'
}
