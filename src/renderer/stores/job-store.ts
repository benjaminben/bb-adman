// A run's paid request count (SPEC 14 1.41 TP-2). Z-1: the per-page job store and its asset ID
// reader are gone; nothing used them any more.
import type { JobRow } from '@/shared/schemas/rows/job'
import { imageJobRequest } from '@/shared/schemas/jobs/image-generation'

// How many paid requests a retry sends, for its paid confirm line: the pictures a picture job
// asked for, or one submit for a video job.
export function requestCount(row: JobRow): number | null {
  if (row.kind === 'video_generation') return 1
  const parsed = imageJobRequest.safeParse(row.request)
  return parsed.success ? parsed.data.count : null
}
