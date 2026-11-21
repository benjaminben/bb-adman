import { z } from 'zod'
import { projectScoped } from '../commands/project-scoped'
import type { JobRow } from '../rows/job'

// SPEC 4.3 job.list [1.8]. Built in Phase 2 slice D. Newest first.
// state: active = queued or running, unseen = succeeded with no seenAt, failed.
export const jobListInput = projectScoped.extend({
  campaignId: z.string().min(1).optional(),
  variantId: z.string().min(1).optional(),
  layerId: z.string().min(1).optional(),
  state: z.enum(['active', 'unseen', 'failed']).optional(),
  limit: z.number().int().positive().default(200),
})
export type JobListInput = z.infer<typeof jobListInput>

export type JobList = JobRow[]
