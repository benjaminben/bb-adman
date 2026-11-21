import { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'
import type { JobRow } from '@/shared/schemas/rows/job'

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

// [1.24] SPEC 4.3 job.getServerMessage: user-only; the cleaned server text or null.
export const jobServerMessageInput = projectScoped.extend({ jobId: z.string().min(1) })
export type JobServerMessage = { text: string | null }

// MCP-D job.get: one wire row of the project, or NOT_FOUND. Open to both actors; the MCP tool
// cuts the row down with agentJobView.
export const jobGetInput = projectScoped.extend({ jobId: z.string().min(1) })
