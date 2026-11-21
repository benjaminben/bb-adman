// job.earlierOptions (spec/ai-jobs.md "The three queries"). P4-1 stub, replaced by P4-2: it
// answers an empty list.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import {
  jobEarlierOptionsInput,
  type EarlierOptions,
} from '@/shared/schemas/queries/earlier-options'
import { AppError } from '@/shared/schemas/result'

export function earlierOptionsQueries(_deps: CoreDeps): Record<string, QueryFn> {
  return {
    'job.earlierOptions': (raw): EarlierOptions => {
      if (!jobEarlierOptionsInput.safeParse(raw).success) {
        throw new AppError('INVALID_INPUT', 'Some values are not valid.')
      }
      return []
    },
  }
}
