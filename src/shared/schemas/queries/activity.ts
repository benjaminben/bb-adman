// job.activity (spec/ai-jobs.md "The three queries"): every job of the project, newest first,
// with the names of where each belongs. Open to both actors.
import { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'
import type { JobRow } from '@/shared/schemas/rows/job'

export const ACTIVITY_LIMIT_MAX = 500
export const ACTIVITY_LIMIT_DEFAULT = 200

export const jobActivityInput = projectScoped.extend({
  limit: z.number().int().min(1).max(ACTIVITY_LIMIT_MAX).default(ACTIVITY_LIMIT_DEFAULT),
})
export type JobActivityInput = z.infer<typeof jobActivityInput>

// Each name is null when the job has no such ID or the row is gone. variantLabel is
// "{title} · {sizeLabel} · {language}".
export type JobPlace = {
  campaignName: string | null
  variantLabel: string | null
  layerName: string | null
}
export type JobActivity = Array<{ job: JobRow; place: JobPlace }>
