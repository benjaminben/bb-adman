// campaign.paidCount (spec/ai-jobs.md "The three queries"). P4-1 stub, replaced by P4-2: it
// answers zeros.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { campaignPaidCountInput, type PaidCount } from '@/shared/schemas/queries/paid-count'
import { AppError } from '@/shared/schemas/result'

export function paidCountQueries(_deps: CoreDeps): Record<string, QueryFn> {
  return {
    'campaign.paidCount': (raw): PaidCount => {
      if (!campaignPaidCountInput.safeParse(raw).success) {
        throw new AppError('INVALID_INPUT', 'Some values are not valid.')
      }
      return { pictures: 0, videos: 0, text: 0 }
    },
  }
}
