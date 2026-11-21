// job.earlierOptions (spec/ai-jobs.md "The three queries"): the picture and cut-out runs of a
// layer, with the pictures they kept. Open to both actors.
import { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'
import type { JobRow } from '@/shared/schemas/rows/job'

export const jobEarlierOptionsInput = projectScoped.extend({ layerId: z.string().min(1) })
export type JobEarlierOptionsInput = z.infer<typeof jobEarlierOptionsInput>

// The IDs in the run's result.assetIds whose rows still exist, in that order.
export type EarlierOption = {
  job: JobRow
  assets: Array<{ assetId: string; width: number; height: number; missing: boolean }>
}
// Newest first, at most 50.
export type EarlierOptions = EarlierOption[]
