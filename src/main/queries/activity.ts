// job.activity (spec/ai-jobs.md "The three queries"). P4-1 stub, replaced by P4-2: it answers
// an empty list.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { jobActivityInput, type JobActivity } from '@/shared/schemas/queries/activity'
import { AppError } from '@/shared/schemas/result'

export function activityQueries(_deps: CoreDeps): Record<string, QueryFn> {
  return {
    'job.activity': (raw): JobActivity => {
      if (!jobActivityInput.safeParse(raw).success) {
        throw new AppError('INVALID_INPUT', 'Some values are not valid.')
      }
      return []
    },
  }
}
