// Whether a run's row offers Cancel (spec/cancel.md "job.cancel"). It is true exactly when
// cancelRefusal in src/main/jobs/cancel.ts accepts the job: queued on any provider; running,
// unless it is a background job other than pictures on a provider whose cancel is 'none', or a
// video run a paid may_finish provider has started (P7-13, cancel_would_still_charge).
// A test holds the two to the same answer for every kind, status and provider.
import { JOB_KIND_CLASSES } from '@/shared/config/job-kinds'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'

function wouldStillCharge(row: JobRow, provider: ProviderInfo | undefined): boolean {
  const result = row.result as { stage?: unknown } | null
  return (
    row.kind === 'video_generation' &&
    row.remoteJobId !== null &&
    provider?.local === false &&
    provider.cancel === 'may_finish' &&
    typeof result === 'object' &&
    result !== null &&
    !Array.isArray(result) &&
    result.stage === 'working'
  )
}

export function cancelShown(row: JobRow, provider: ProviderInfo | undefined): boolean {
  if (row.status === 'queued') return true
  if (row.status !== 'running') return false
  if (wouldStillCharge(row, provider)) return false
  if (provider?.cancel !== 'none') return true
  return row.kind === 'image_generation' || JOB_KIND_CLASSES[row.kind] === 'attached'
}
