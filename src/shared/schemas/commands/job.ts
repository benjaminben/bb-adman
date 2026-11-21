import { z } from 'zod'
import { projectScoped } from './project-scoped'

// SPEC 4.2 job commands [1.8]. Built in Phase 2 slice D.
export const jobRetryInput = projectScoped.extend({ jobId: z.string().min(1) })
export type JobRetryInput = z.infer<typeof jobRetryInput>

export const jobCancelInput = projectScoped.extend({ jobId: z.string().min(1) })
export type JobCancelInput = z.infer<typeof jobCancelInput>

export const jobMarkSeenInput = projectScoped.extend({
  jobIds: z.array(z.string().min(1)).min(1),
})
export type JobMarkSeenInput = z.infer<typeof jobMarkSeenInput>

// Every generation.* command and job.retry return this as soon as the job row exists.
export type JobStarted = { jobId: string }
